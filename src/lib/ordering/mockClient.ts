// Stand-in for the real /api backend. Persists to localStorage so the status
// page and a page refresh behave like a real order would. Enforces the same
// rules a server should (capacity, hours, idempotency, phone format) so the
// UI is designed against real failure states instead of a happy path.
import { items as catalogItems } from '../../data/catalog';
import { orderingConfig } from '../../data/orderingConfig';
import {
  buildSlotDtos,
  generateSlotsForDay,
  isAcceptingOrdersAt,
  isShopOpenAt,
  resolveAsapSlot,
  slotKey,
} from './slots';
import { cartPrepUnits, cartSubtotalCents, lineTotalCents } from './pricing';
import {
  OrderingError,
  type AdminSettingsDto,
  type AvailabilityDto,
  type CancelReason,
  type CreateOrderRequest,
  type MenuItemAvailabilityDto,
  type OrderDto,
  type OrderStatus,
} from './types';

const ORDERS_KEY = 'ob-orders-v1';
const SLOTS_KEY = 'ob-slot-reservations-v1';
const ADMIN_SETTINGS_KEY = 'ob-admin-settings-v1';
const SIMULATED_LATENCY_MS = 350;

type SlotReservation = { reservedOrders: number; reservedPrepUnits: number };
// The stored record carries the idempotency key for createOrder's own replay
// lookup; it's never part of the public OrderDto contract, so every external
// return point (getOrder, cancelOrder, the idempotent-replay branch) must
// strip it via toPublicOrder before handing the order back to a caller.
type StoredOrder = OrderDto & { idempotencyKey: string };

function toPublicOrder(stored: StoredOrder): OrderDto {
  const { idempotencyKey: _idempotencyKey, ...order } = stored;
  return order;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function forcedFailure(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('mockForce');
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function getOrders(): StoredOrder[] {
  return readJson<StoredOrder[]>(ORDERS_KEY, []);
}

function saveOrders(orders: StoredOrder[]) {
  writeJson(ORDERS_KEY, orders);
}

type StoredAdminSettings = { onlineOrderingEnabled: boolean; soldOutSlugs: string[] };

const DEFAULT_ADMIN_SETTINGS: StoredAdminSettings = { onlineOrderingEnabled: true, soldOutSlugs: [] };

function getAdminSettingsStored(): StoredAdminSettings {
  return readJson<StoredAdminSettings>(ADMIN_SETTINGS_KEY, DEFAULT_ADMIN_SETTINGS);
}

function saveAdminSettingsStored(settings: StoredAdminSettings) {
  writeJson(ADMIN_SETTINGS_KEY, settings);
}

function getReservations(): Record<string, SlotReservation> {
  return readJson<Record<string, SlotReservation>>(SLOTS_KEY, {});
}

function saveReservations(reservations: Record<string, SlotReservation>) {
  writeJson(SLOTS_KEY, reservations);
}

function isSlotFull(slot: Date): boolean {
  const reservation = getReservations()[slotKey(slot)];
  if (!reservation) return false;
  return (
    reservation.reservedOrders >= orderingConfig.maxOrdersPerSlot ||
    reservation.reservedPrepUnits >= orderingConfig.maxPrepUnitsPerSlot
  );
}

function reserveSlot(slot: Date, prepUnits: number): boolean {
  const reservations = getReservations();
  const key = slotKey(slot);
  const current = reservations[key] ?? { reservedOrders: 0, reservedPrepUnits: 0 };
  if (
    current.reservedOrders + 1 > orderingConfig.maxOrdersPerSlot ||
    current.reservedPrepUnits + prepUnits > orderingConfig.maxPrepUnitsPerSlot
  ) {
    return false;
  }
  reservations[key] = {
    reservedOrders: current.reservedOrders + 1,
    reservedPrepUnits: current.reservedPrepUnits + prepUnits,
  };
  saveReservations(reservations);
  return true;
}

function releaseSlot(slot: Date, prepUnits: number) {
  const reservations = getReservations();
  const key = slotKey(slot);
  const current = reservations[key];
  if (!current) return;
  reservations[key] = {
    reservedOrders: Math.max(0, current.reservedOrders - 1),
    reservedPrepUnits: Math.max(0, current.reservedPrepUnits - prepUnits),
  };
  saveReservations(reservations);
}

function normalizePhone(raw: string): { e164: string; display: string } | null {
  const digits = raw.replace(/\D/g, '');
  const tenDigit = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (tenDigit.length !== 10) return null;
  const areaCode = tenDigit.slice(0, 3);
  const prefix = tenDigit.slice(3, 6);
  const line = tenDigit.slice(6);
  return {
    e164: `+1${tenDigit}`,
    display: `(${areaCode}) ${prefix}-${line}`,
  };
}

function makeReference(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `OB-${code}`;
}

function makeToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function releaseOrderSlot(order: StoredOrder) {
  const prepUnits = order.items.reduce(
    (sum, item) => sum + item.quantity * (catalogItems.find((c) => c.slug === item.itemSlug)?.prepUnits ?? 1),
    0,
  );
  releaseSlot(new Date(order.pickupAtIso), prepUnits);
}

// Shared by every owner-side status change that doesn't release capacity
// (only Cancel does — see cancelOrderByShop). Reuses the NotFound code for an
// invalid transition, same as the customer-facing cancelOrder, since the mock
// has no dedicated "invalid transition" error and the UI never needs to tell
// the two apart.
function applyOwnerTransition(token: string, allowedFrom: OrderStatus[], to: OrderStatus): StoredOrder {
  const orders = getOrders();
  const index = orders.findIndex((o) => o.token === token);
  if (index === -1) throw new OrderingError('NotFound', 'Order not found.');

  const order = orders[index];
  if (!allowedFrom.includes(order.status)) {
    throw new OrderingError('NotFound', `Order is ${order.status}, not eligible for this action.`);
  }

  const updated: StoredOrder = { ...order, status: to };
  orders[index] = updated;
  saveOrders(orders);
  return updated;
}

export interface OrderingClient {
  getAvailability(): Promise<AvailabilityDto>;
  createOrder(request: CreateOrderRequest): Promise<OrderDto>;
  // Keyed by the opaque token, never the human-readable reference — the
  // reference is short and guessable, and is for the customer to read back
  // to staff, not for authenticating a status/cancel lookup.
  getOrder(token: string): Promise<OrderDto | null>;
  cancelOrder(token: string): Promise<OrderDto>;

  // Owner-side (admin board). No auth boundary exists in the mock — that's an
  // SWA built-in auth + route-rule concern for the real backend, not this seam.
  listBoardOrders(): Promise<OrderDto[]>;
  startOrder(token: string): Promise<OrderDto>;
  markReady(token: string): Promise<OrderDto>;
  markPickedUp(token: string): Promise<OrderDto>;
  markNoShow(token: string): Promise<OrderDto>;
  cancelOrderByShop(token: string): Promise<OrderDto>;
  getAdminSettings(): Promise<AdminSettingsDto>;
  setOnlineOrderingEnabled(enabled: boolean): Promise<void>;
  getMenuAvailability(): Promise<MenuItemAvailabilityDto[]>;
  setItemSoldOut(itemSlug: string, soldOut: boolean): Promise<void>;
}

export function createMockOrderingClient(): OrderingClient {
  return {
    async getAvailability(): Promise<AvailabilityDto> {
      await wait(SIMULATED_LATENCY_MS);

      const forced = forcedFailure();
      if (forced === 'ShopClosed') {
        return { isShopOpen: false, isAcceptingOrders: false, isOrderingPaused: false, slotsToday: [], slotsTomorrow: [] };
      }
      if (forced === 'OrderingPaused') {
        return { isShopOpen: true, isAcceptingOrders: false, isOrderingPaused: true, slotsToday: [], slotsTomorrow: [] };
      }

      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const { onlineOrderingEnabled } = getAdminSettingsStored();

      const slotsToday = buildSlotDtos(now, now, isSlotFull);
      const slotsTomorrow = buildSlotDtos(now, tomorrow, isSlotFull);

      const asapSlot = onlineOrderingEnabled
        ? resolveAsapSlot(
            now,
            generateSlotsForDay(now).filter((s) => !isSlotFull(s)),
          )
        : undefined;

      return {
        isShopOpen: isShopOpenAt(now),
        isAcceptingOrders: isAcceptingOrdersAt(now) && onlineOrderingEnabled,
        isOrderingPaused: !onlineOrderingEnabled,
        earliestAsapIso: asapSlot?.toISOString(),
        slotsToday,
        slotsTomorrow,
      };
    },

    async createOrder(request: CreateOrderRequest): Promise<OrderDto> {
      await wait(SIMULATED_LATENCY_MS);

      const forced = forcedFailure();
      if (forced === 'SlotFull') throw new OrderingError('SlotFull', 'That pickup time just filled up.');
      if (forced === 'Network') throw new OrderingError('Network', 'Could not reach the shop. Check your connection and try again.');
      if (forced === 'TooManyOpenOrders') {
        throw new OrderingError('TooManyOpenOrders', "You've got an order already in progress. Pick that one up before ordering again.");
      }
      if (forced === 'ItemUnavailable') {
        throw new OrderingError('ItemUnavailable', 'One of your items just sold out.');
      }

      // Re-check orderability at submit time, not just at add-to-cart time — an
      // item can go sold out (statically, or via the admin board's runtime
      // toggle) while the customer is still filling out the form.
      const { soldOutSlugs } = getAdminSettingsStored();
      const unavailableLine = request.lines.find((line) => {
        const catalogItem = catalogItems.find((c) => c.slug === line.itemSlug);
        return !catalogItem || !catalogItem.isActive || !catalogItem.isOrderable || soldOutSlugs.includes(line.itemSlug);
      });
      if (unavailableLine) {
        throw new OrderingError('ItemUnavailable', `${unavailableLine.name} just sold out — go back and swap it out.`);
      }

      const byIdempotency = getOrders().find((o) => o.idempotencyKey === request.idempotencyKey);
      if (byIdempotency) return toPublicOrder(byIdempotency);

      if (!getAdminSettingsStored().onlineOrderingEnabled) {
        throw new OrderingError('OrderingPaused', "We've paused online orders for the moment — please call the shop.");
      }

      const now = new Date();
      // "Closed right now" only blocks ASAP orders — a scheduled order for a future
      // open slot is valid even if the shop happens to be closed at submit time.
      if (request.pickupMode === 'asap') {
        if (!isShopOpenAt(now)) throw new OrderingError('ShopClosed', "We're closed right now — come back during shop hours.");
        if (!isAcceptingOrdersAt(now)) {
          throw new OrderingError('ShopClosed', "We've stopped taking online orders for today, but come on in.");
        }
      }

      const phone = normalizePhone(request.phoneRaw);
      if (!phone) throw new OrderingError('InvalidPhone', "That phone number doesn't look right.");

      const openOrders = getOrders().filter(
        (o) => o.phoneE164 === phone.e164 && (o.status === 'Confirmed' || o.status === 'InProgress'),
      );
      if (openOrders.length >= orderingConfig.maxOpenOrdersPerPhone) {
        throw new OrderingError('TooManyOpenOrders', "You've got an order already in progress. Pick that one up before ordering again.");
      }

      let pickupSlot: Date;
      if (request.pickupMode === 'asap') {
        const resolved = resolveAsapSlot(now, generateSlotsForDay(now).filter((s) => !isSlotFull(s)));
        if (!resolved) throw new OrderingError('SlotFull', "We're slammed right now — no pickup times left today.");
        pickupSlot = resolved;
      } else {
        if (!request.pickupSlotIso) throw new OrderingError('SlotPast', 'Pick a pickup time.');
        pickupSlot = new Date(request.pickupSlotIso);
        if (pickupSlot.getTime() < now.getTime()) throw new OrderingError('SlotPast', 'That pickup time has already passed — pick another.');
      }

      const prepUnits = cartPrepUnits(request.lines);
      const reserved = reserveSlot(pickupSlot, prepUnits);
      if (!reserved) throw new OrderingError('SlotFull', 'That pickup time just filled up — pick another.');

      const orderItems = request.lines.map((line) => ({
        itemSlug: line.itemSlug,
        name: line.name,
        quantity: line.quantity,
        unitBasePriceCents: line.unitBasePriceCents,
        lineTotalCents: lineTotalCents(line),
        modifiers: line.modifiers,
      }));

      const order: OrderDto = {
        reference: makeReference(),
        token: makeToken(),
        status: 'Confirmed',
        items: orderItems,
        subtotalCents: cartSubtotalCents(request.lines),
        customerName: request.customerName.trim(),
        phoneE164: phone.e164,
        phoneDisplay: phone.display,
        email: request.email?.trim() || undefined,
        note: request.note?.trim() || undefined,
        isScheduled: request.pickupMode === 'scheduled',
        pickupAtIso: pickupSlot.toISOString(),
        createdAtIso: now.toISOString(),
      };

      const orders = getOrders();
      orders.push({ ...order, idempotencyKey: request.idempotencyKey });
      saveOrders(orders);

      return order;
    },

    async getOrder(token: string): Promise<OrderDto | null> {
      await wait(SIMULATED_LATENCY_MS);
      const match = getOrders().find((o) => o.token === token);
      return match ? toPublicOrder(match) : null;
    },

    async cancelOrder(token: string): Promise<OrderDto> {
      await wait(SIMULATED_LATENCY_MS);
      const orders = getOrders();
      const index = orders.findIndex((o) => o.token === token);
      if (index === -1) throw new OrderingError('NotFound', 'Order not found.');

      const order = orders[index];
      if (order.status !== 'Confirmed') {
        throw new OrderingError('NotFound', 'This order can no longer be canceled online — call the shop.');
      }

      releaseOrderSlot(order);

      const updated: StoredOrder = { ...order, status: 'Canceled' as OrderStatus, cancelReason: 'Customer' };
      orders[index] = updated;
      saveOrders(orders);
      return toPublicOrder(updated);
    },

    async listBoardOrders(): Promise<OrderDto[]> {
      await wait(SIMULATED_LATENCY_MS);
      return getOrders()
        .filter((o) => o.status === 'Confirmed' || o.status === 'InProgress' || o.status === 'Ready')
        .sort((a, b) => new Date(a.pickupAtIso).getTime() - new Date(b.pickupAtIso).getTime())
        .map(toPublicOrder);
    },

    async startOrder(token: string): Promise<OrderDto> {
      await wait(SIMULATED_LATENCY_MS);
      return toPublicOrder(applyOwnerTransition(token, ['Confirmed'], 'InProgress'));
    },

    async markReady(token: string): Promise<OrderDto> {
      await wait(SIMULATED_LATENCY_MS);
      return toPublicOrder(applyOwnerTransition(token, ['InProgress'], 'Ready'));
    },

    async markPickedUp(token: string): Promise<OrderDto> {
      await wait(SIMULATED_LATENCY_MS);
      return toPublicOrder(applyOwnerTransition(token, ['Ready'], 'PickedUp'));
    },

    async markNoShow(token: string): Promise<OrderDto> {
      await wait(SIMULATED_LATENCY_MS);
      return toPublicOrder(applyOwnerTransition(token, ['Confirmed', 'InProgress', 'Ready'], 'NoShow'));
    },

    async cancelOrderByShop(token: string): Promise<OrderDto> {
      await wait(SIMULATED_LATENCY_MS);
      const orders = getOrders();
      const index = orders.findIndex((o) => o.token === token);
      if (index === -1) throw new OrderingError('NotFound', 'Order not found.');

      const order = orders[index];
      if (order.status !== 'Confirmed' && order.status !== 'InProgress' && order.status !== 'Ready') {
        throw new OrderingError('NotFound', `Order is ${order.status}, not eligible for this action.`);
      }

      releaseOrderSlot(order);
      const updated: StoredOrder = { ...order, status: 'Canceled' as OrderStatus, cancelReason: 'Shop' as CancelReason };
      orders[index] = updated;
      saveOrders(orders);
      return toPublicOrder(updated);
    },

    async getAdminSettings(): Promise<AdminSettingsDto> {
      await wait(SIMULATED_LATENCY_MS);
      return { onlineOrderingEnabled: getAdminSettingsStored().onlineOrderingEnabled };
    },

    async setOnlineOrderingEnabled(enabled: boolean): Promise<void> {
      await wait(SIMULATED_LATENCY_MS);
      saveAdminSettingsStored({ ...getAdminSettingsStored(), onlineOrderingEnabled: enabled });
    },

    async getMenuAvailability(): Promise<MenuItemAvailabilityDto[]> {
      await wait(SIMULATED_LATENCY_MS);
      const { soldOutSlugs } = getAdminSettingsStored();
      return catalogItems
        .filter((item) => item.isActive)
        .map((item) => ({
          slug: item.slug,
          name: item.name,
          categorySlug: item.categorySlug,
          isSoldOut: soldOutSlugs.includes(item.slug),
        }));
    },

    async setItemSoldOut(itemSlug: string, soldOut: boolean): Promise<void> {
      await wait(SIMULATED_LATENCY_MS);
      const settings = getAdminSettingsStored();
      const soldOutSlugs = soldOut
        ? Array.from(new Set([...settings.soldOutSlugs, itemSlug]))
        : settings.soldOutSlugs.filter((slug) => slug !== itemSlug);
      saveAdminSettingsStored({ ...settings, soldOutSlugs });
    },
  };
}
