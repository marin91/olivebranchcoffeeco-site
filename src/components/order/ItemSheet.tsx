import { useState } from 'react';
import { getModifierGroup, type MenuItem } from '../../data/catalog';
import { formatCents } from '../../lib/ordering/pricing';
import type { CartLine, SelectedModifier } from '../../lib/ordering/types';

function defaultSelections(item: MenuItem): Record<string, string[]> {
  const selections: Record<string, string[]> = {};
  for (const groupSlug of item.modifierGroupSlugs) {
    const group = getModifierGroup(groupSlug);
    if (!group) continue;
    selections[groupSlug] = group.defaultOptionSlug ? [group.defaultOptionSlug] : [];
  }
  return selections;
}

export default function ItemSheet({
  item,
  onAdd,
  onClose,
}: {
  item: MenuItem;
  onAdd: (line: CartLine) => void;
  onClose: () => void;
}) {
  const [selections, setSelections] = useState<Record<string, string[]>>(() => defaultSelections(item));
  const [quantity, setQuantity] = useState(1);

  function toggleOption(groupSlug: string, optionSlug: string, selectionType: 'single' | 'multiple') {
    setSelections((prev) => {
      const current = prev[groupSlug] ?? [];
      if (selectionType === 'single') {
        return { ...prev, [groupSlug]: [optionSlug] };
      }
      const next = current.includes(optionSlug)
        ? current.filter((s) => s !== optionSlug)
        : [...current, optionSlug];
      return { ...prev, [groupSlug]: next };
    });
  }

  const selectedModifiers: SelectedModifier[] = item.modifierGroupSlugs.flatMap((groupSlug) => {
    const group = getModifierGroup(groupSlug);
    if (!group) return [];
    const picked = selections[groupSlug] ?? [];
    return group.options
      .filter((o) => picked.includes(o.slug))
      .map((o) => ({ groupSlug, optionSlug: o.slug, name: o.name, priceDeltaCents: o.priceDeltaCents }));
  });

  const unitPriceCents =
    item.basePriceCents + selectedModifiers.reduce((sum, m) => sum + m.priceDeltaCents, 0);

  const canAdd = item.modifierGroupSlugs.every((groupSlug) => {
    const group = getModifierGroup(groupSlug);
    if (!group) return true;
    const picked = selections[groupSlug] ?? [];
    return picked.length >= group.minSelect;
  });

  function handleAdd() {
    if (!canAdd) return;
    onAdd({
      id: crypto.randomUUID(),
      itemSlug: item.slug,
      name: item.name,
      unitBasePriceCents: item.basePriceCents,
      prepUnits: item.prepUnits,
      quantity,
      modifiers: selectedModifiers,
    });
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-cream-50 p-6 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-2xl text-olive-900">{item.name}</h2>
            <p className="mt-1 text-sm text-olive-700">{item.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full p-1 text-olive-500 hover:text-olive-800"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-6 space-y-6">
          {item.modifierGroupSlugs.map((groupSlug) => {
            const group = getModifierGroup(groupSlug);
            if (!group) return null;
            const picked = selections[groupSlug] ?? [];
            return (
              <fieldset key={groupSlug}>
                <legend className="eyebrow">
                  {group.name}
                  {group.minSelect > 0 && <span className="ml-1 text-clay-500">required</span>}
                </legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {group.options.map((option) => {
                    const isSelected = picked.includes(option.slug);
                    return (
                      <button
                        key={option.slug}
                        type="button"
                        onClick={() => toggleOption(groupSlug, option.slug, group.selectionType)}
                        className={
                          isSelected
                            ? 'rounded-full border border-moss bg-moss px-4 py-2 text-sm font-medium text-cream-50'
                            : 'rounded-full border border-olive-300 px-4 py-2 text-sm font-medium text-olive-800 hover:bg-olive-100'
                        }
                      >
                        {option.name}
                        {option.priceDeltaCents > 0 && (
                          <span className="ml-1 opacity-80">+{formatCents(option.priceDeltaCents)}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}

          <div>
            <p className="eyebrow">Quantity</p>
            <div className="mt-3 flex items-center gap-4">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-olive-300 text-olive-800 hover:bg-olive-100"
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="w-6 text-center text-lg">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-olive-300 text-olive-800 hover:bg-olive-100"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <button type="button" onClick={handleAdd} disabled={!canAdd} className="btn-primary mt-8 w-full disabled:opacity-50">
          Add {quantity > 1 ? `${quantity} ` : ''}to order · {formatCents(unitPriceCents * quantity)}
        </button>
      </div>
    </div>
  );
}
