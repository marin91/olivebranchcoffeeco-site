import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockOrderingClient } from '../../../lib/ordering/mockClient';
import { type CreateOrderRequest } from '../../../lib/ordering/types';
import { ESPRESSO_LINE } from '../../fixtures/cart';

// Monday local time: weekday hours 7:00-16:00, matches slots.test.ts's reference
// day. All of mockClient's time logic reads the local clock directly (see its
// own "no I/O" design), so the clock must be frozen for deterministic slots.
const MONDAY = (hour: number, minute = 0) => new Date(2026, 0, 5, hour, minute);

// mockClient simulates latency via a real setTimeout before doing anything
// else — with fake (non-advancing) timers, that promise never settles on its
// own. Rather than let the clock auto-advance in real time (which drifted the
// resolved "now" past exact slot boundaries under simulated latency), every
// call here is paired with a deterministic, fixed clock advance.
const LATENCY_MS = 400;

async function run<T>(promise: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(LATENCY_MS);
  return promise;
}

async function expectRejects(promise: Promise<unknown>, matcher: Record<string, unknown>) {
  const assertion = expect(promise).rejects.toMatchObject(matcher);
  await vi.advanceTimersByTimeAsync(LATENCY_MS);
  await assertion;
}

function setNow(date: Date) {
  vi.setSystemTime(date);
}

function setMockForce(value: string | null) {
  window.history.pushState({}, '', value ? `/order?mockForce=${value}` : '/order');
}

function buildRequest(overrides: Partial<CreateOrderRequest> = {}): CreateOrderRequest {
  return {
    idempotencyKey: crypto.randomUUID(),
    lines: [ESPRESSO_LINE],
    customerName: 'Miguel Test',
    phoneRaw: '9515551234',
    pickupMode: 'asap',
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  setNow(MONDAY(10, 1)); // :01, not :00 — see note on earliest-slot assertions below
  window.localStorage.clear();
  setMockForce(null);
});

afterEach(() => {
  vi.useRealTimers();
  window.history.pushState({}, '', '/');
});

describe('getAvailability', () => {
  it('reports open hours, accepting orders, and an ASAP slot during business hours', async () => {
    const client = createMockOrderingClient();
    const availability = await run(client.getAvailability());

    expect(availability.isShopOpen).toBe(true);
    expect(availability.isAcceptingOrders).toBe(true);
    expect(availability.isOrderingPaused).toBe(false);
    // now=10:01, lead=15min -> earliest=10:16 -> first slot at/after that is 10:30.
    // (10:01, not 10:00, so earliest doesn't land exactly on a slot boundary.)
    expect(availability.earliestAsapIso).toBe(MONDAY(10, 30).toISOString());
    expect(availability.slotsToday.length).toBeGreaterThan(0);
  });

  it('reports closed outside business hours', async () => {
    setNow(MONDAY(2, 0));
    const client = createMockOrderingClient();
    const availability = await run(client.getAvailability());

    expect(availability.isShopOpen).toBe(false);
    expect(availability.isAcceptingOrders).toBe(false);
  });

  it('honors the ShopClosed and OrderingPaused mockForce hooks', async () => {
    const client = createMockOrderingClient();

    setMockForce('ShopClosed');
    const closed = await run(client.getAvailability());
    expect(closed).toEqual({ isShopOpen: false, isAcceptingOrders: false, isOrderingPaused: false, slotsToday: [], slotsTomorrow: [] });

    setMockForce('OrderingPaused');
    const paused = await run(client.getAvailability());
    expect(paused.isOrderingPaused).toBe(true);
    expect(paused.isAcceptingOrders).toBe(false);
  });

  it('recovers to defaults instead of crashing on corrupted localStorage', async () => {
    window.localStorage.setItem('ob-orders-v1', '{not valid json');
    window.localStorage.setItem('ob-slot-reservations-v1', '{not valid json');
    const client = createMockOrderingClient();

    const availability = await run(client.getAvailability());

    expect(availability.slotsToday.every((s) => s.isFull === false)).toBe(true);
  });

  it('reflects a slot that is already at capacity as full', async () => {
    const fullSlotIso = MONDAY(10, 30).toISOString(); // the slot that would otherwise resolve first
    window.localStorage.setItem(
      'ob-slot-reservations-v1',
      JSON.stringify({ [fullSlotIso]: { reservedOrders: 10, reservedPrepUnits: 0 } }),
    );
    const client = createMockOrderingClient();

    const availability = await run(client.getAvailability());

    expect(availability.slotsToday.find((s) => s.startIso === fullSlotIso)?.isFull).toBe(true);
    expect(availability.earliestAsapIso).toBe(MONDAY(10, 45).toISOString()); // skips the full 10:30 slot
  });
});

describe('createOrder — forced failure hooks', () => {
  it.each(['SlotFull', 'Network', 'TooManyOpenOrders', 'ItemUnavailable'] as const)('honors ?mockForce=%s', async (code) => {
    setMockForce(code);
    const client = createMockOrderingClient();

    await expectRejects(client.createOrder(buildRequest()), { code });
  });
});

describe('createOrder — validation', () => {
  it('rejects an item that is not in the catalog as ItemUnavailable', async () => {
    const client = createMockOrderingClient();
    const line = { ...ESPRESSO_LINE, itemSlug: 'discontinued-item', name: 'Discontinued Thing' };

    await expectRejects(client.createOrder(buildRequest({ lines: [line] })), { code: 'ItemUnavailable' });
  });

  it('rejects an unparseable phone number', async () => {
    const client = createMockOrderingClient();

    await expectRejects(client.createOrder(buildRequest({ phoneRaw: '123' })), { code: 'InvalidPhone' });
  });

  it('rejects an ASAP order placed while the shop is closed', async () => {
    setNow(MONDAY(2, 0));
    const client = createMockOrderingClient();

    await expectRejects(client.createOrder(buildRequest()), { code: 'ShopClosed', message: expect.stringContaining('closed right now') });
  });

  it('rejects an ASAP order placed after the online-order cutoff, even though the shop is still open', async () => {
    setNow(MONDAY(15, 50)); // open until 16:00, but cutoff is 15 min before close (15:45)
    const client = createMockOrderingClient();

    await expectRejects(client.createOrder(buildRequest()), {
      code: 'ShopClosed',
      message: expect.stringContaining('stopped taking online orders'),
    });
  });

  it('allows a scheduled order even while the shop happens to be closed right now', async () => {
    setNow(MONDAY(2, 0));
    const client = createMockOrderingClient();

    const order = await run(
      client.createOrder(buildRequest({ pickupMode: 'scheduled', pickupSlotIso: MONDAY(7, 0).toISOString() })),
    );

    expect(order.status).toBe('Confirmed');
    expect(order.isScheduled).toBe(true);
  });

  it('requires a pickupSlotIso when scheduling, and rejects one that has already passed', async () => {
    const client = createMockOrderingClient();

    await expectRejects(client.createOrder(buildRequest({ pickupMode: 'scheduled' })), { code: 'SlotPast' });
    await expectRejects(
      client.createOrder(buildRequest({ pickupMode: 'scheduled', pickupSlotIso: MONDAY(9, 0).toISOString() })),
      { code: 'SlotPast' },
    );
  });

  it('rejects ASAP ordering once no slot remains before the close cutoff', async () => {
    // Monday's last bookable slot is 15:30; lead time pushes earliest past it.
    setNow(MONDAY(15, 25));
    const client = createMockOrderingClient();

    await expectRejects(client.createOrder(buildRequest()), { code: 'SlotFull' });
  });

  it('rejects a scheduled order whose chosen slot is already at capacity', async () => {
    // Deliberately scheduled, not ASAP: resolveAsapSlot pre-filters full slots
    // out before reserveSlot is ever reached, so ASAP can never observe this
    // branch — only an explicit (possibly stale) slot choice can.
    const targetSlotIso = MONDAY(11, 0).toISOString();
    window.localStorage.setItem(
      'ob-slot-reservations-v1',
      JSON.stringify({ [targetSlotIso]: { reservedOrders: 10, reservedPrepUnits: 0 } }),
    );
    const client = createMockOrderingClient();

    await expectRejects(
      client.createOrder(buildRequest({ pickupMode: 'scheduled', pickupSlotIso: targetSlotIso })),
      { code: 'SlotFull' },
    );
  });

  it('rejects a third open order from the same phone number (cap is 2)', async () => {
    const client = createMockOrderingClient();
    await run(client.createOrder(buildRequest({ idempotencyKey: 'key-1' })));
    await run(client.createOrder(buildRequest({ idempotencyKey: 'key-2' })));

    await expectRejects(client.createOrder(buildRequest({ idempotencyKey: 'key-3' })), { code: 'TooManyOpenOrders' });
  });
});

describe('createOrder — success path', () => {
  it('builds a Confirmed order with normalized phone, snapshotted items, and a human reference', async () => {
    const client = createMockOrderingClient();
    const order = await run(client.createOrder(buildRequest({ phoneRaw: '(951) 555-1234' })));

    expect(order.status).toBe('Confirmed');
    expect(order.reference).toMatch(/^OB-[A-Z0-9]{4}$/);
    expect(order.phoneE164).toBe('+19515551234');
    expect(order.phoneDisplay).toBe('(951) 555-1234');
    expect(order.subtotalCents).toBe(650); // $3.25 x 2
    expect(order.items).toEqual([
      expect.objectContaining({ itemSlug: 'espresso', quantity: 2, lineTotalCents: 650 }),
    ]);
    expect(order.isScheduled).toBe(false);
    expect(order.pickupAtIso).toBe(MONDAY(10, 30).toISOString());
    // mockClient's own idempotency bookkeeping must never leak into the public DTO.
    expect(order).not.toHaveProperty('idempotencyKey');
  });

  it('accepts an 11-digit phone number with a leading country code', async () => {
    const client = createMockOrderingClient();
    const order = await run(client.createOrder(buildRequest({ phoneRaw: '19515551234' })));

    expect(order.phoneE164).toBe('+19515551234');
  });

  it('returns the same order for a repeated idempotency key instead of creating a second one', async () => {
    const client = createMockOrderingClient();
    const request = buildRequest({ idempotencyKey: 'same-key' });

    const first = await run(client.createOrder(request));
    const second = await run(client.createOrder(request));

    expect(second).toEqual(first);
  });
});

describe('getOrder', () => {
  it('finds an order by its token, excludes internal bookkeeping, and returns null for an unknown token', async () => {
    const client = createMockOrderingClient();
    const created = await run(client.createOrder(buildRequest()));

    const found = await run(client.getOrder(created.token));
    expect(found).toEqual(created);
    expect(found).not.toHaveProperty('idempotencyKey');
    expect(await run(client.getOrder('not-a-real-token'))).toBeNull();
  });
});

describe('cancelOrder', () => {
  it('cancels a Confirmed order, tagging it as customer-initiated, without leaking bookkeeping', async () => {
    const client = createMockOrderingClient();
    const created = await run(client.createOrder(buildRequest()));

    const canceled = await run(client.cancelOrder(created.token));

    expect(canceled.status).toBe('Canceled');
    expect(canceled.cancelReason).toBe('Customer');
    expect(canceled).not.toHaveProperty('idempotencyKey');
  });

  it('releases the slot reservation so a new order can take its place', async () => {
    const client = createMockOrderingClient();
    const targetSlotIso = MONDAY(11, 0).toISOString();
    window.localStorage.setItem(
      'ob-slot-reservations-v1',
      JSON.stringify({ [targetSlotIso]: { reservedOrders: 9, reservedPrepUnits: 0 } }),
    );
    const scheduled = { pickupMode: 'scheduled' as const, pickupSlotIso: targetSlotIso };
    const created = await run(client.createOrder(buildRequest(scheduled))); // 10th order, fills the slot
    await expectRejects(
      client.createOrder(buildRequest({ ...scheduled, idempotencyKey: 'blocked', phoneRaw: '9515559999' })),
      { code: 'SlotFull' },
    );

    await run(client.cancelOrder(created.token));

    const retried = await run(
      client.createOrder(buildRequest({ ...scheduled, idempotencyKey: 'retry', phoneRaw: '9515559999' })),
    );
    expect(retried.status).toBe('Confirmed');
  });

  it('rejects canceling an order that is not Confirmed', async () => {
    const client = createMockOrderingClient();
    const created = await run(client.createOrder(buildRequest()));
    await run(client.cancelOrder(created.token)); // now Canceled

    await expectRejects(client.cancelOrder(created.token), { code: 'NotFound' });
  });

  it('rejects an unknown token', async () => {
    const client = createMockOrderingClient();

    await expectRejects(client.cancelOrder('not-a-real-token'), { code: 'NotFound' });
  });
});

describe('admin — kill switch and sold-out overrides', () => {
  it('pauses availability and blocks new orders once online ordering is disabled', async () => {
    const client = createMockOrderingClient();
    await run(client.setOnlineOrderingEnabled(false));

    const availability = await run(client.getAvailability());
    expect(availability.isOrderingPaused).toBe(true);
    expect(availability.isAcceptingOrders).toBe(false);
    expect(availability.earliestAsapIso).toBeUndefined();

    await expectRejects(client.createOrder(buildRequest()), { code: 'OrderingPaused' });
  });

  it('resumes accepting orders once re-enabled', async () => {
    const client = createMockOrderingClient();
    await run(client.setOnlineOrderingEnabled(false));
    await run(client.setOnlineOrderingEnabled(true));

    const order = await run(client.createOrder(buildRequest()));
    expect(order.status).toBe('Confirmed');
  });

  it('blocks ordering a sold-out item and reflects it in menu availability', async () => {
    const client = createMockOrderingClient();
    await run(client.setItemSoldOut('espresso', true));

    const menu = await run(client.getMenuAvailability());
    expect(menu.find((m) => m.slug === 'espresso')?.isSoldOut).toBe(true);
    expect(menu.find((m) => m.slug === 'cortado')?.isSoldOut).toBe(false);

    await expectRejects(client.createOrder(buildRequest()), { code: 'ItemUnavailable' });
  });

  it('allows ordering again once an item is marked available', async () => {
    const client = createMockOrderingClient();
    await run(client.setItemSoldOut('espresso', true));
    await run(client.setItemSoldOut('espresso', false));

    const order = await run(client.createOrder(buildRequest()));
    expect(order.status).toBe('Confirmed');
  });
});

describe('admin — board queries and transitions', () => {
  it('lists only Confirmed, InProgress, and Ready orders, sorted by pickup time', async () => {
    const client = createMockOrderingClient();
    const later = await run(
      client.createOrder(buildRequest({ idempotencyKey: 'later', pickupMode: 'scheduled', pickupSlotIso: MONDAY(14, 0).toISOString() })),
    );
    const earlier = await run(client.createOrder(buildRequest({ idempotencyKey: 'earlier', phoneRaw: '9515559999' })));
    const pickedUp = await run(client.createOrder(buildRequest({ idempotencyKey: 'done', phoneRaw: '9515558888' })));
    await run(client.startOrder(pickedUp.token));
    await run(client.markReady(pickedUp.token));
    await run(client.markPickedUp(pickedUp.token));

    const board = await run(client.listBoardOrders());

    expect(board.map((o) => o.token)).toEqual([earlier.token, later.token]);
  });

  it('walks a Confirmed order through InProgress, Ready, and PickedUp', async () => {
    const client = createMockOrderingClient();
    const created = await run(client.createOrder(buildRequest()));

    const started = await run(client.startOrder(created.token));
    expect(started.status).toBe('InProgress');

    const ready = await run(client.markReady(created.token));
    expect(ready.status).toBe('Ready');

    const pickedUp = await run(client.markPickedUp(created.token));
    expect(pickedUp.status).toBe('PickedUp');
  });

  it('rejects an out-of-order transition', async () => {
    const client = createMockOrderingClient();
    const created = await run(client.createOrder(buildRequest()));

    await expectRejects(client.markReady(created.token), { code: 'NotFound' });
    await expectRejects(client.markPickedUp(created.token), { code: 'NotFound' });
  });

  it('marks a Confirmed, InProgress, or Ready order as a no-show', async () => {
    const client = createMockOrderingClient();
    const confirmed = await run(client.createOrder(buildRequest({ idempotencyKey: 'a', phoneRaw: '9515551111' })));
    const inProgress = await run(client.createOrder(buildRequest({ idempotencyKey: 'b', phoneRaw: '9515552222' })));
    await run(client.startOrder(inProgress.token));

    expect((await run(client.markNoShow(confirmed.token))).status).toBe('NoShow');
    expect((await run(client.markNoShow(inProgress.token))).status).toBe('NoShow');
  });

  it('cancels a shop-initiated order, tags the reason, and releases its slot', async () => {
    const client = createMockOrderingClient();
    const targetSlotIso = MONDAY(11, 0).toISOString();
    window.localStorage.setItem(
      'ob-slot-reservations-v1',
      JSON.stringify({ [targetSlotIso]: { reservedOrders: 9, reservedPrepUnits: 0 } }),
    );
    const scheduled = { pickupMode: 'scheduled' as const, pickupSlotIso: targetSlotIso };
    const created = await run(client.createOrder(buildRequest(scheduled))); // 10th order, fills the slot

    const canceled = await run(client.cancelOrderByShop(created.token));
    expect(canceled.status).toBe('Canceled');
    expect(canceled.cancelReason).toBe('Shop');

    const retried = await run(
      client.createOrder(buildRequest({ ...scheduled, idempotencyKey: 'retry', phoneRaw: '9515559999' })),
    );
    expect(retried.status).toBe('Confirmed');
  });

  it('rejects canceling or no-showing an order that already reached a terminal state', async () => {
    const client = createMockOrderingClient();
    const created = await run(client.createOrder(buildRequest()));
    await run(client.cancelOrderByShop(created.token));

    await expectRejects(client.cancelOrderByShop(created.token), { code: 'NotFound' });
    await expectRejects(client.markNoShow(created.token), { code: 'NotFound' });
  });

  it('rejects an unknown token for every owner action', async () => {
    const client = createMockOrderingClient();

    await expectRejects(client.startOrder('nope'), { code: 'NotFound' });
    await expectRejects(client.markReady('nope'), { code: 'NotFound' });
    await expectRejects(client.markPickedUp('nope'), { code: 'NotFound' });
    await expectRejects(client.markNoShow('nope'), { code: 'NotFound' });
    await expectRejects(client.cancelOrderByShop('nope'), { code: 'NotFound' });
  });
});
