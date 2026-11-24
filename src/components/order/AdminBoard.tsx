import { useEffect, useRef, useState } from 'react';
import { getOrderingClient } from '../../lib/ordering/client';
import type { AdminSettingsDto, MenuItemAvailabilityDto, OrderDto } from '../../lib/ordering/types';
import OrderCard from './OrderCard';

const POLL_MS = 10_000;
// "Now" = due within 15 minutes, per the design doc's three-column board.
// A separate concept from orderingConfig's slot/grace minutes, which govern
// customer-facing slot generation, not board bucketing.
const DUE_SOON_MINUTES = 15;
const OVERDUE_GRACE_MINUTES = 15;

type Bucket = 'now' | 'upcoming' | 'ready';

function bucketFor(order: OrderDto, now: Date): Bucket {
  if (order.status === 'Ready') return 'ready';
  const minutesUntil = (new Date(order.pickupAtIso).getTime() - now.getTime()) / 60_000;
  return minutesUntil <= DUE_SOON_MINUTES ? 'now' : 'upcoming';
}

function isOverdue(order: OrderDto, now: Date): boolean {
  const minutesUntil = (new Date(order.pickupAtIso).getTime() - now.getTime()) / 60_000;
  return minutesUntil <= -OVERDUE_GRACE_MINUTES;
}

function playChime(ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = 880;
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
  osc.start();
  osc.stop(ctx.currentTime + 0.4);
}

export default function AdminBoard() {
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<AdminSettingsDto | null>(null);
  const [menu, setMenu] = useState<MenuItemAvailabilityDto[]>([]);
  const [busyTokens, setBusyTokens] = useState<Set<string>>(new Set());
  const [soundOn, setSoundOn] = useState(false);
  const [showSoldOut, setShowSoldOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const seenTokensRef = useRef<Set<string> | null>(null);

  async function refresh() {
    try {
      const client = getOrderingClient();
      const [boardOrders, adminSettings, menuAvailability] = await Promise.all([
        client.listBoardOrders(),
        client.getAdminSettings(),
        client.getMenuAvailability(),
      ]);

      // Chime only for Confirmed orders that weren't on the board last poll —
      // skip the very first load so every pre-existing order doesn't chime at once.
      if (seenTokensRef.current && soundOn && audioCtxRef.current) {
        const isNew = boardOrders.some(
          (o) => o.status === 'Confirmed' && !seenTokensRef.current!.has(o.token),
        );
        if (isNew) playChime(audioCtxRef.current);
      }
      seenTokensRef.current = new Set(boardOrders.map((o) => o.token));

      setOrders(boardOrders);
      setSettings(adminSettings);
      setMenu(menuAvailability);
      setError(null);
    } catch {
      setError('Could not reach the order board. Retrying…');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundOn]);

  function enableSound() {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    setSoundOn(true);
  }

  async function withBusy(token: string, action: () => Promise<OrderDto>) {
    setBusyTokens((prev) => new Set(prev).add(token));
    try {
      await action();
      await refresh();
    } catch {
      setError('That action failed — try again.');
    } finally {
      setBusyTokens((prev) => {
        const next = new Set(prev);
        next.delete(token);
        return next;
      });
    }
  }

  const client = getOrderingClient();
  const onStart = (token: string) => withBusy(token, () => client.startOrder(token));
  const onReady = (token: string) => withBusy(token, () => client.markReady(token));
  const onPickedUp = (token: string) => withBusy(token, () => client.markPickedUp(token));
  const onNoShow = (token: string) => withBusy(token, () => client.markNoShow(token));
  const onCancel = (token: string) => withBusy(token, () => client.cancelOrderByShop(token));

  async function togglePause() {
    if (!settings) return;
    await client.setOnlineOrderingEnabled(!settings.onlineOrderingEnabled);
    await refresh();
  }

  async function toggleSoldOut(slug: string, soldOut: boolean) {
    await client.setItemSoldOut(slug, soldOut);
    await refresh();
  }

  if (isLoading) {
    return <p className="p-6 text-lg text-olive-600">Loading the board…</p>;
  }

  const now = new Date();
  const columns: Record<Bucket, OrderDto[]> = { now: [], upcoming: [], ready: [] };
  for (const order of orders) columns[bucketFor(order, now)].push(order);

  const columnDefs: { key: Bucket; title: string }[] = [
    { key: 'now', title: 'Now' },
    { key: 'upcoming', title: 'Upcoming' },
    { key: 'ready', title: 'Ready' },
  ];

  return (
    <div className="min-h-screen bg-cream-50 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl text-olive-900">Pickup Orders</h1>
        <div className="flex flex-wrap items-center gap-2">
          {!soundOn && (
            <button type="button" onClick={enableSound} className="btn-secondary">
              Turn on sound
            </button>
          )}
          <button type="button" onClick={() => setShowSoldOut((v) => !v)} className="btn-secondary">
            Sold out today
          </button>
          <button
            type="button"
            onClick={togglePause}
            disabled={!settings}
            className={
              settings?.onlineOrderingEnabled === false
                ? 'rounded-full bg-clay-500 px-6 py-3 text-sm font-medium text-cream-50 hover:bg-clay-600'
                : 'btn-primary'
            }
          >
            {settings?.onlineOrderingEnabled === false ? 'Resume online ordering' : 'Pause online ordering'}
          </button>
        </div>
      </div>

      {settings?.onlineOrderingEnabled === false && (
        <p className="mt-3 rounded-xl bg-clay-400/10 p-3 text-sm font-medium text-clay-600">
          Online ordering is paused — customers can't submit new orders right now.
        </p>
      )}

      {error && <p className="mt-3 rounded-xl bg-clay-400/10 p-3 text-sm text-clay-600">{error}</p>}

      {showSoldOut && (
        <div className="mt-4 rounded-2xl border border-olive-100 bg-cream-100 p-4">
          <p className="eyebrow">Sold out today</p>
          <ul className="mt-3 space-y-2">
            {menu.map((item) => (
              <li key={item.slug} className="flex items-center justify-between gap-3">
                <span className="text-olive-900">{item.name}</span>
                <button
                  type="button"
                  onClick={() => toggleSoldOut(item.slug, !item.isSoldOut)}
                  className={
                    item.isSoldOut
                      ? 'rounded-full bg-clay-500 px-4 py-2 text-sm font-medium text-cream-50'
                      : 'rounded-full border border-olive-300 px-4 py-2 text-sm font-medium text-olive-800 hover:bg-olive-100'
                  }
                >
                  {item.isSoldOut ? 'Sold out' : 'Available'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {orders.length === 0 ? (
        <p className="mt-10 text-center text-lg text-olive-600">Nothing on the board right now.</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {columnDefs.map((col) => (
            <div key={col.key}>
              <h2 className="eyebrow">
                {col.title} ({columns[col.key].length})
              </h2>
              <div className="mt-3 space-y-3">
                {columns[col.key].map((order) => (
                  <OrderCard
                    key={order.token}
                    order={order}
                    isOverdue={isOverdue(order, now)}
                    isBusy={busyTokens.has(order.token)}
                    onStart={onStart}
                    onReady={onReady}
                    onPickedUp={onPickedUp}
                    onNoShow={onNoShow}
                    onCancel={onCancel}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
