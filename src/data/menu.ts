export type MenuItem = {
  name: string;
  description: string;
  price: string;
};

export type MenuCategory = {
  title: string;
  items: MenuItem[];
};

export const menu: MenuCategory[] = [
  {
    title: 'Espresso',
    items: [
      { name: 'Espresso', description: 'Single or double, pulled slow', price: '$3.25' },
      { name: 'Cortado', description: 'Equal parts espresso and steamed milk', price: '$4.25' },
      { name: 'Olive Branch Latte', description: 'House vanilla-olive syrup, oat or whole milk', price: '$5.50' },
      { name: 'Cappuccino', description: 'Dry foam, served warm not hot', price: '$4.75' },
    ],
  },
  {
    title: 'Drip & Pour-Over',
    items: [
      { name: 'Drip Coffee', description: 'Rotating single-origin, brewed fresh every 30 minutes', price: '$3.00' },
      { name: 'Pour-Over', description: "Barista's choice of guest roaster", price: '$5.00' },
      { name: 'Cold Brew', description: 'Steeped 18 hours, served over ice', price: '$4.25' },
    ],
  },
  {
    title: 'From the Kitchen',
    items: [
      { name: 'Olive & Rosemary Focaccia', description: 'Baked daily, served warm', price: '$4.50' },
      { name: 'Fig & Ricotta Toast', description: 'Sourdough, local honey', price: '$8.00' },
      { name: 'Almond Croissant', description: 'Laminated in-house', price: '$4.75' },
    ],
  },
];
