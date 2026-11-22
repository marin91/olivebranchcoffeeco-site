import { cartSubtotalCents, formatCents, lineTotalCents } from '../../lib/ordering/pricing';
import type { CartLine, OrderingErrorCode } from '../../lib/ordering/types';
import type { WhoAndWhenValue } from './WhoAndWhen';

const ERROR_COPY: Record<OrderingErrorCode, string> = {
  ShopClosed: "We're closed for online orders right now — please call or come by.",
  OrderingPaused: "We've paused online orders for the moment — please call the shop.",
  SlotFull: 'That pickup time just filled up. Pick another time and try again.',
  SlotPast: 'That pickup time has already passed. Pick another time.',
  ItemUnavailable: "One of your items just sold out — go back and swap it out.",
  InvalidPhone: "That phone number doesn't look right. Double-check it and try again.",
  TooManyOpenOrders: "You've already got an order in progress — pick that one up before ordering again.",
  NotFound: "We couldn't find that order.",
  Network: "Couldn't reach the shop. Check your connection and try again.",
};

function pickupLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function ReviewStep({
  lines,
  who,
  resolvedPickupIso,
  isSubmitting,
  errorCode,
  onEditCart,
  onEditDetails,
  onSubmit,
}: {
  lines: CartLine[];
  who: WhoAndWhenValue;
  resolvedPickupIso: string | null;
  isSubmitting: boolean;
  errorCode: OrderingErrorCode | null;
  onEditCart: () => void;
  onEditDetails: () => void;
  onSubmit: () => void;
}) {
  const subtotal = cartSubtotalCents(lines);

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between">
          <p className="eyebrow">Your order</p>
          <button type="button" onClick={onEditCart} className="text-sm font-medium text-moss hover:underline">
            Edit
          </button>
        </div>
        <ul className="mt-4 divide-y divide-olive-100">
          {lines.map((line) => (
            <li key={line.id} className="flex items-start justify-between gap-4 py-3 text-sm">
              <div>
                <p className="font-medium text-olive-900">
                  {line.quantity}× {line.name}
                </p>
                {line.modifiers.length > 0 && (
                  <p className="text-olive-600">{line.modifiers.map((m) => m.name).join(', ')}</p>
                )}
              </div>
              <span className="shrink-0 text-olive-700">{formatCents(lineTotalCents(line))}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t border-olive-200 pt-3">
          <span className="font-serif text-lg text-olive-900">Subtotal</span>
          <span className="font-serif text-lg text-olive-900">{formatCents(subtotal)}</span>
        </div>
        <p className="mt-1 text-xs text-olive-600">Tax calculated at pickup. Pay in person — no card needed now.</p>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <p className="eyebrow">Pickup details</p>
          <button type="button" onClick={onEditDetails} className="text-sm font-medium text-moss hover:underline">
            Edit
          </button>
        </div>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-olive-600">Name</dt>
            <dd className="text-olive-900">{who.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-olive-600">We'll text</dt>
            <dd className="text-olive-900">{who.phoneRaw}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-olive-600">Pickup time</dt>
            <dd className="text-olive-900">
              {resolvedPickupIso ? pickupLabel(resolvedPickupIso) : 'As soon as possible'}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-olive-600">
          Double-check that number — we'll text it the moment this order is confirmed.
        </p>
      </div>

      {errorCode && (
        <div className="rounded-xl border border-clay-400 bg-clay-400/10 p-4 text-sm text-clay-600">
          {ERROR_COPY[errorCode]}
        </div>
      )}

      <button type="button" onClick={onSubmit} disabled={isSubmitting} className="btn-primary w-full disabled:opacity-50">
        {isSubmitting ? 'Placing order…' : `Place order · ${formatCents(subtotal)}`}
      </button>
    </div>
  );
}
