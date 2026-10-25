export type EventItem = {
  title: string;
  date: string;
  description: string;
};

export const upcomingEvents: EventItem[] = [
  {
    title: 'Latte Art Night',
    date: 'November 6, 2026 · 6:00pm',
    description: 'Hands-on latte art class for small groups. Space is limited to 10 guests.',
  },
  {
    title: 'Local Roaster Tasting',
    date: 'November 20, 2026 · 5:30pm',
    description: 'A guided cupping with a different guest roaster each month.',
  },
  {
    title: 'Holiday Pop-Up Market',
    date: 'December 13, 2026 · 10:00am',
    description: 'Local makers, mulled cider, and seasonal drinks on the patio.',
  },
];
