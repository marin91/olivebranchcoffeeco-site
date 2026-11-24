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

  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${
        isOverdue ? 'border-clay-400 bg-clay-400/10' : 'border-olive-100 bg-cream-100'
      }`}
    >
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
