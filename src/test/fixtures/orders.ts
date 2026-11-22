import type { OrderDto } from '../../lib/ordering/types';

// A single-item Confirmed order. Override `status` (and `cancelReason` for a
// shop-initiated cancel) per test — the shape otherwise represents a normal,
// already-placed ASAP order.
export const CONFIRMED_ORDER: OrderDto = {
  reference: 'OB-7Q4K',
  token: 'test-token-7q4k',
  status: 'Confirmed',
  items: [
    {
      itemSlug: 'espresso',
      name: 'Espresso',
      quantity: 1,
      unitBasePriceCents: 325,
      lineTotalCents: 325,
      modifiers: [],
    },
  ],
  subtotalCents: 325,
  customerName: 'Miguel Test',
  phoneE164: '+19515551234',
  phoneDisplay: '(951) 555-1234',
  isScheduled: false,
  pickupAtIso: '2026-11-22T20:15:00.000Z',
  createdAtIso: '2026-11-22T20:00:00.000Z',
};
