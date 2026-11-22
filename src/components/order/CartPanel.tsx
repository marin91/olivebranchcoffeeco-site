import { cartSubtotalCents, formatCents, lineTotalCents } from '../../lib/ordering/pricing';
import type { CartLine } from '../../lib/ordering/types';

export default function CartPanel({
  lines,
  onRemove,
  onContinue,
}: {
  lines: CartLine[];
  onRemove: (id: string) => void;
  onContinue: () => void;
}) {
  if (lines.length === 0) {
    return (
      <div className="sticky bottom-4 rounded-2xl border border-olive-100 bg-cream-100 p-5 text-center text-sm text-olive-600">
        Your order is empty — tap an item to add it.
      </div>
    );
  }

  const subtotal = cartSubtotalCents(lines);

  return (
    <div className="sticky bottom-4 space-y-4 rounded-2xl border border-olive-100 bg-cream-100 p-5 shadow-sm">
      <ul className="space-y-3">
        {lines.map((line) => (
          <li key={line.id} className="flex items-start justify-between gap-3 text-sm">
            <div>
              <p className="font-medium text-olive-900">
                {line.quantity}× {line.name}
              </p>
              {line.modifiers.length > 0 && (
                <p className="text-olive-600">{line.modifiers.map((m) => m.name).join(', ')}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-olive-700">{formatCents(lineTotalCents(line))}</span>
              <button
                type="button"
                onClick={() => onRemove(line.id)}
                aria-label={`Remove ${line.name}`}
                className="text-olive-500 hover:text-clay-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between border-t border-olive-200 pt-3">
        <span className="font-serif text-lg text-olive-900">Subtotal</span>
        <span className="font-serif text-lg text-olive-900">{formatCents(subtotal)}</span>
      </div>
      <p className="text-xs text-olive-600">Tax calculated at pickup. Pay in person — no card needed now.</p>

      <button type="button" onClick={onContinue} className="btn-primary w-full">
        Continue
      </button>
    </div>
  );
}
