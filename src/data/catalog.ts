// Structured catalog for online ordering. `menu.ts` remains the source for the
// static /menu page; this file is the seed for the ordering feature and will
// become the DB-seed source once a real backend exists (see decisions.md).

export type ModifierOption = {
  slug: string;
  name: string;
  priceDeltaCents: number;
};

export type ModifierGroup = {
  slug: string;
  name: string;
  selectionType: 'single' | 'multiple';
  minSelect: number;
  maxSelect: number;
  defaultOptionSlug?: string;
  options: ModifierOption[];
};

export type MenuItem = {
  slug: string;
  name: string;
  description: string;
  basePriceCents: number;
  categorySlug: string;
  prepUnits: number;
  isActive: boolean;
  isOrderable: boolean;
  sortOrder: number;
  modifierGroupSlugs: string[];
};

export type MenuCategory = {
  slug: string;
  title: string;
  sortOrder: number;
};

export const categories: MenuCategory[] = [
  { slug: 'espresso', title: 'Espresso', sortOrder: 0 },
  { slug: 'drip-pour-over', title: 'Drip & Pour-Over', sortOrder: 1 },
  { slug: 'kitchen', title: 'From the Kitchen', sortOrder: 2 },
];

export const modifierGroups: ModifierGroup[] = [
  {
    slug: 'size',
    name: 'Size',
    selectionType: 'single',
    minSelect: 1,
    maxSelect: 1,
    defaultOptionSlug: '12oz',
    options: [
      { slug: '12oz', name: '12 oz', priceDeltaCents: 0 },
      { slug: '16oz', name: '16 oz', priceDeltaCents: 75 },
      { slug: '20oz', name: '20 oz', priceDeltaCents: 125 },
    ],
  },
  {
    slug: 'temperature',
    name: 'Temperature',
    selectionType: 'single',
    minSelect: 1,
    maxSelect: 1,
    defaultOptionSlug: 'hot',
    options: [
      { slug: 'hot', name: 'Hot', priceDeltaCents: 0 },
      { slug: 'iced', name: 'Iced', priceDeltaCents: 0 },
    ],
  },
  {
    slug: 'milk',
    name: 'Milk',
    selectionType: 'single',
    minSelect: 1,
    maxSelect: 1,
    defaultOptionSlug: 'whole',
    options: [
      { slug: 'whole', name: 'Whole milk', priceDeltaCents: 0 },
      { slug: 'oat', name: 'Oat milk', priceDeltaCents: 75 },
      { slug: 'almond', name: 'Almond milk', priceDeltaCents: 75 },
      { slug: 'none', name: 'No milk', priceDeltaCents: 0 },
    ],
  },
  {
    slug: 'extras',
    name: 'Extras',
    selectionType: 'multiple',
    minSelect: 0,
    maxSelect: 3,
    options: [
      { slug: 'extra-shot', name: 'Extra shot', priceDeltaCents: 125 },
      { slug: 'decaf', name: 'Make it decaf', priceDeltaCents: 0 },
      { slug: 'vanilla-syrup', name: 'Vanilla syrup', priceDeltaCents: 75 },
      { slug: 'caramel-syrup', name: 'Caramel syrup', priceDeltaCents: 75 },
      { slug: 'hazelnut-syrup', name: 'Hazelnut syrup', priceDeltaCents: 75 },
    ],
  },
];

export const items: MenuItem[] = [
  {
    slug: 'espresso',
    name: 'Espresso',
    description: 'Single or double, pulled slow',
    basePriceCents: 325,
    categorySlug: 'espresso',
    prepUnits: 1,
    isActive: true,
    isOrderable: true,
    sortOrder: 0,
    modifierGroupSlugs: ['extras'],
  },
  {
    slug: 'cortado',
    name: 'Cortado',
    description: 'Equal parts espresso and steamed milk',
    basePriceCents: 425,
    categorySlug: 'espresso',
    prepUnits: 1,
    isActive: true,
    isOrderable: true,
    sortOrder: 1,
    modifierGroupSlugs: ['extras'],
  },
  {
    slug: 'olive-branch-latte',
    name: 'Olive Branch Latte',
    description: 'House vanilla-olive syrup, oat or whole milk',
    basePriceCents: 550,
    categorySlug: 'espresso',
    prepUnits: 1,
    isActive: true,
    isOrderable: true,
    sortOrder: 2,
    modifierGroupSlugs: ['size', 'temperature', 'milk', 'extras'],
  },
  {
    slug: 'cappuccino',
    name: 'Cappuccino',
    description: 'Dry foam, served warm not hot',
    basePriceCents: 475,
    categorySlug: 'espresso',
    prepUnits: 1,
    isActive: true,
    isOrderable: true,
    sortOrder: 3,
    modifierGroupSlugs: ['size', 'milk', 'extras'],
  },
  {
    slug: 'drip-coffee',
    name: 'Drip Coffee',
    description: 'Rotating single-origin, brewed fresh every 30 minutes',
    basePriceCents: 300,
    categorySlug: 'drip-pour-over',
    prepUnits: 1,
    isActive: true,
    isOrderable: true,
    sortOrder: 0,
    modifierGroupSlugs: ['size', 'temperature', 'extras'],
  },
  {
    slug: 'pour-over',
    name: 'Pour-Over',
    description: "Barista's choice of guest roaster",
    basePriceCents: 500,
    categorySlug: 'drip-pour-over',
    prepUnits: 1,
    isActive: true,
    isOrderable: true,
    sortOrder: 1,
    modifierGroupSlugs: ['size', 'extras'],
  },
  {
    slug: 'cold-brew',
    name: 'Cold Brew',
    description: 'Steeped 18 hours, served over ice',
    basePriceCents: 425,
    categorySlug: 'drip-pour-over',
    prepUnits: 1,
    isActive: true,
    isOrderable: true,
    sortOrder: 2,
    modifierGroupSlugs: ['size', 'extras'],
  },
  {
    slug: 'olive-rosemary-focaccia',
    name: 'Olive & Rosemary Focaccia',
    description: 'Baked daily, served warm',
    basePriceCents: 450,
    categorySlug: 'kitchen',
    prepUnits: 1,
    isActive: true,
    isOrderable: true,
    sortOrder: 0,
    modifierGroupSlugs: [],
  },
  {
    slug: 'fig-ricotta-toast',
    name: 'Fig & Ricotta Toast',
    description: 'Sourdough, local honey',
    basePriceCents: 800,
    categorySlug: 'kitchen',
    prepUnits: 1,
    isActive: true,
    isOrderable: true,
    sortOrder: 1,
    modifierGroupSlugs: [],
  },
  {
    slug: 'almond-croissant',
    name: 'Almond Croissant',
    description: 'Laminated in-house',
    basePriceCents: 475,
    categorySlug: 'kitchen',
    prepUnits: 1,
    isActive: true,
    isOrderable: true,
    sortOrder: 2,
    modifierGroupSlugs: [],
  },
];

export function getModifierGroup(slug: string): ModifierGroup | undefined {
  return modifierGroups.find((g) => g.slug === slug);
}

export function getItem(slug: string): MenuItem | undefined {
  return items.find((i) => i.slug === slug);
}
