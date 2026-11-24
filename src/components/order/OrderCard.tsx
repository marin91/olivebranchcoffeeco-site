import { useState } from 'react';
import { formatCents } from '../../lib/ordering/pricing';
import type { OrderDto } from '../../lib/ordering/types';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

const BIG_BUTTON = 'flex-1 rounded-xl px-4 py-4 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';

export default function OrderCard({
  order,
  isOverdue,
  isBusy,
  onStart,
  onReady,
  onPickedUp,
  onNoShow,
  onCancel,
}: {
  order: OrderDto;
  isOverdue: boolean;
  isBusy: boolean;
  onStart: (token: string) => void;
  onReady: (token: string) => void;
  onPickedUp: (token: string) => void;
  onNoShow: (token: string) => void;
  onCancel: (token: string) => void;
}) {
  const canCancel = order.status === 'Confirmed' || order.status === 'InProgress' || order.status === 'Ready';
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${
        isOverdue ? 'border-clay-400 bg-clay-400/10' : 'border-olive-100 bg-cream-100'
      }`}
    >
      <button type="button" onClick={() => setShowDetails(true)} className="w-full text-left">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-serif text-2xl text-olive-900">{order.reference}</p>
          <p className="text-lg font-semibold text-olive-900">{formatTime(order.pickupAtIso)}</p>
        </div>
        <p className="mt-1 text-lg text-olive-800">{firstName(order.customerName)}</p>

        <ul className="mt-3 space-y-1 text-base text-olive-900">
          {order.items.map((item, i) => (
            <li key={i}>
              <span className="font-medium">
                {item.quantity}× {item.name}
              </span>
              {item.modifiers.length > 0 && (
                <span className="text-olive-600"> — {item.modifiers.map((m) => m.name).join(', ')}</span>
              )}
            </li>
          ))}
        </ul>

        {order.note && <p className="mt-2 text-sm italic text-olive-600">"{order.note}"</p>}

        {isOverdue && <p className="mt-2 text-sm font-semibold text-clay-600">Past pickup time</p>}
      </button>

      {showDetails && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Order ${order.reference} details`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-olive-900/40 p-4"
          onClick={() => setShowDetails(false)}
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-olive-100 bg-cream-50 p-6 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-serif text-xl text-olive-900">{order.reference}</p>
                <p className="text-sm text-olive-600">
                  {formatTime(order.pickupAtIso)}
                  {!order.isScheduled && ' (ASAP)'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDetails(false)}
                aria-label="Close"
                className="text-olive-500 hover:text-clay-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 space-y-1 text-sm">
              <p className="font-medium text-olive-900">{order.customerName}</p>
              <p className="text-olive-700">{order.phoneDisplay}</p>
              {order.email && <p className="text-olive-700">{order.email}</p>}
            </div>

            <ul className="mt-4 space-y-2 border-t border-olive-100 pt-4 text-sm">
              {order.items.map((item, i) => (
                <li key={i} className="flex items-start justify-between gap-3">
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

            <div className="mt-3 flex items-center justify-between border-t border-olive-200 pt-3">
              <span className="font-serif text-lg text-olive-900">Total</span>
              <span className="font-serif text-lg text-olive-900">{formatCents(order.subtotalCents)}</span>
            </div>
            <p className="mt-1 text-xs text-olive-600">Tax calculated at pickup.</p>

            {order.note && <p className="mt-3 text-sm italic text-olive-600">"{order.note}"</p>}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {order.status === 'Confirmed' && (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onStart(order.token)}
            className={`${BIG_BUTTON} bg-moss text-cream-50 hover:bg-moss-800`}
          >
            Start
          </button>
        )}
        {order.status === 'InProgress' && (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onReady(order.token)}
            className={`${BIG_BUTTON} bg-moss text-cream-50 hover:bg-moss-800`}
          >
            Ready
          </button>
        )}
        {order.status === 'Ready' && (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onPickedUp(order.token)}
            className={`${BIG_BUTTON} bg-moss text-cream-50 hover:bg-moss-800`}
          >
            Picked Up
          </button>
        )}
        {isOverdue && (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onNoShow(order.token)}
            className={`${BIG_BUTTON} border border-clay-400 text-clay-600 hover:bg-clay-400/10`}
          >
            No-show
          </button>
        )}
        {canCancel && (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onCancel(order.token)}
            className={`${BIG_BUTTON} border border-olive-300 text-olive-700 hover:bg-olive-100`}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
