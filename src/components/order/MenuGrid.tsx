import { useState } from 'react';
import { categories, items, type MenuItem } from '../../data/catalog';
import { formatCents } from '../../lib/ordering/pricing';
import ItemSheet from './ItemSheet';
import type { CartLine } from '../../lib/ordering/types';

export default function MenuGrid({ onAdd }: { onAdd: (line: CartLine) => void }) {
  const [activeItem, setActiveItem] = useState<MenuItem | null>(null);

  const orderable = items.filter((i) => i.isActive);

  return (
    <div className="space-y-12">
      {categories.map((category) => (
        <div key={category.slug}>
          <h2 className="font-serif text-2xl text-olive-900">{category.title}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {orderable
              .filter((item) => item.categorySlug === category.slug)
              .map((item) => (
                <button
                  key={item.slug}
                  type="button"
                  disabled={!item.isOrderable}
                  onClick={() => setActiveItem(item)}
                  className="flex items-start justify-between gap-4 rounded-xl border border-olive-100 bg-cream-50 p-4 text-left transition-colors hover:border-moss hover:bg-olive-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-olive-100 disabled:hover:bg-cream-50"
                >
                  <div>
                    <p className="font-serif text-lg text-olive-900">{item.name}</p>
                    <p className="mt-1 text-sm text-olive-700">{item.description}</p>
                    {!item.isOrderable && <p className="mt-1 text-xs font-medium text-clay-500">Sold out today</p>}
                  </div>
                  <p className="shrink-0 text-sm font-medium text-olive-600">{formatCents(item.basePriceCents)}</p>
                </button>
              ))}
          </div>
        </div>
      ))}

      {activeItem && (
        <ItemSheet
          item={activeItem}
          onClose={() => setActiveItem(null)}
          onAdd={(line) => {
            onAdd(line);
            setActiveItem(null);
          }}
        />
      )}
    </div>
  );
}
