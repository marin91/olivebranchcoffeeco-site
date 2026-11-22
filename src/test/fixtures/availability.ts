import type { AvailabilityDto } from '../../lib/ordering/types';

// A shop that's open, accepting orders, and has room in both today's ASAP
// slot and a couple of scheduled slots. The default starting point for any
// test that doesn't care about closures/pauses/full slots — override fields
// with spread (`{ ...OPEN_AVAILABILITY, isOrderingPaused: true }`) for those.
export const OPEN_AVAILABILITY: AvailabilityDto = {
  isShopOpen: true,
  isAcceptingOrders: true,
  isOrderingPaused: false,
  earliestAsapIso: '2026-11-22T20:00:00.000Z',
  slotsToday: [
    { startIso: '2026-11-22T20:00:00.000Z', label: '12:00 PM', isFull: false },
    { startIso: '2026-11-22T20:15:00.000Z', label: '12:15 PM', isFull: false },
  ],
  slotsTomorrow: [],
};
