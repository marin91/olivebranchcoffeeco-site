import { useEffect, useState } from 'react';
import { getOrderingClient } from '../../lib/ordering/client';
import { formatCents, lineTotalCents } from '../../lib/ordering/pricing';
import { OrderingError, type OrderDto, type OrderStatus as Status } from '../../lib/ordering/types';
import { site } from '../../data/site';

const STATUS_COPY: Record<Status, { label: string; tone: string }> = {
  Confirmed: { label: 'Confirmed', tone: 'bg-moss text-cream-50' },
  InProgress: { label: "We're making it", tone: 'bg-clay-500 text-cream-50' },
  Ready: { label: 'Ready for pickup', tone: 'bg-moss text-cream-50' },
  PickedUp: { label: 'Picked up', tone: 'bg-olive-300 text-olive-900' },
  Canceled: { label: 'Canceled', tone: 'bg-olive-200 text-olive-700' },
  NoShow: { label: 'Missed pickup', tone: 'bg-olive-200 text-olive-700' },
};

function pickupLabel(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function OrderStatus() {
  const [reference, setReference] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderDto | null | 'loading' | 'not-found'>('loading');
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref');
    setReference(ref);
    if (!ref) {
      setOrder('not-found');
      return;
    }
    getOrderingClient()
      .getOrder(ref)
      .then((result) => setOrder(result ?? 'not-found'))
      .catch(() => setOrder('not-found'));
  }, []);

  async function handleCancel() {
    if (!reference) return;
    try {
      const updated = await getOrderingClient().cancelOrder(reference);
      setOrder(updated);
      setConfirmingCancel(false);
    } catch (err) {
      setCancelError(err instanceof OrderingError ? err.message : 'Could not cancel this order.');
      setConfirmingCancel(false);
    }
  }

  if (order === 'loading') {
    return <p className="text-sm text-olive-600">Looking up your order…</p>;
  }

  if (order === 'not-found' || order === null) {
    return (
      <div className="rounded-xl border border-olive-200 bg-olive-100 p-6 text-sm text-olive-700">
        <p>We couldn't find that order. Double-check the link we texted you, or call the shop.</p>
        <a href={`tel:${site.phone}`} className="mt-3 inline-block font-medium text-moss hover:underline">
          {site.phone}
        </a>
      </div>
    );
  }

  const statusCopy = STATUS_COPY[order.status];

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Order {order.reference}</p>
        <div className="mt-3 flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusCopy.tone}`}>{statusCopy.label}</span>
          {order.status === 'Canceled' && order.cancelReason === 'Shop' && (
            <span className="text-sm text-clay-500">Canceled by the shop — sorry about that.</span>
          )}
        </div>
        <p className="mt-2 text-sm text-olive-700">
          Pickup: {order.isScheduled ? pickupLabel(order.pickupAtIso) : `~${pickupLabel(order.pickupAtIso)} (ASAP)`}
        </p>
      </div>

      <div>
        <p className="eyebrow">Items</p>
        <ul className="mt-3 divide-y divide-olive-100">
          {order.items.map((item, i) => (
            <li key={i} className="flex items-start justify-between gap-4 py-3 text-sm">
              <div>
                <p className="font-medium text-olive-900">
                  {item.quantity}× {item.name}
                </p>
                {item.modifiers.length > 0 && (
                  <p className="text-olive-600">{item.modifiers.map((m) => m.name).join(', ')}</p>
                )}
              </div>
              <span className="shrink-0 text-olive-700">{formatCents(item.lineTotalCents)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-center justify-between border-t border-olive-200 pt-3">
          <span className="font-serif text-lg text-olive-900">Subtotal</span>
          <span className="font-serif text-lg text-olive-900">{formatCents(order.subtotalCents)}</span>
        </div>
        <p className="mt-1 text-xs text-olive-600">Tax calculated at pickup. Pay in person.</p>
      </div>

      {order.status === 'Confirmed' && (
        <div>
          {confirmingCancel ? (
            <div className="rounded-xl border border-clay-400 bg-clay-400/10 p-4">
              <p className="text-sm text-clay-600">Cancel this order?</p>
              <div className="mt-3 flex gap-3">
                <button type="button" onClick={handleCancel} className="btn-secondary border-clay-400 text-clay-600 hover:bg-clay-400/10">
                  Yes, cancel
                </button>
                <button type="button" onClick={() => setConfirmingCancel(false)} className="btn-secondary">
                  Never mind
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmingCancel(true)} className="btn-secondary">
              Cancel order
            </button>
          )}
          {cancelError && <p className="mt-2 text-sm text-clay-500">{cancelError}</p>}
        </div>
      )}

      {order.status === 'InProgress' && (
        <a href={`tel:${site.phone}`} className="btn-secondary inline-block">
          Call the shop
        </a>
      )}
    </div>
  );
}
