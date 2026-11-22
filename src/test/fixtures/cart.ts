import type { CartLine } from '../../lib/ordering/types';

export const ESPRESSO_LINE: CartLine = {
  id: 'line-espresso',
  itemSlug: 'espresso',
  name: 'Espresso',
  unitBasePriceCents: 325,
  prepUnits: 1,
  quantity: 2,
  modifiers: [],
};

export const LATTE_LINE: CartLine = {
  id: 'line-latte',
  itemSlug: 'olive-branch-latte',
  name: 'Olive Branch Latte',
  unitBasePriceCents: 550,
  prepUnits: 1,
  quantity: 1,
  modifiers: [
    { groupSlug: 'size', optionSlug: '16oz', name: '16 oz', priceDeltaCents: 75 },
    { groupSlug: 'milk', optionSlug: 'oat', name: 'Oat milk', priceDeltaCents: 75 },
  ],
};
