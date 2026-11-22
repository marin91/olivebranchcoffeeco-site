// Ordering rules. Capacity limits are intentionally generous — the mechanism is
// in place (see src/lib/ordering/slots.ts) but tuning is deferred until there is
// real order volume to tune against (see decisions.md, "Pickup ordering feature").

export type DayHours = { open: number; close: number }; // minutes from midnight, shop-local time

// Indexed by Date#getDay(): 0 = Sunday ... 6 = Saturday. Mirrors src/data/site.ts
// hours today, but kept separate because these need to be machine-readable and
// the two can drift (e.g. a holiday closure) without this file changing.
const weeklyHours: DayHours[] = [
  { open: 8 * 60, close: 15 * 60 }, // Sun
  { open: 7 * 60, close: 16 * 60 }, // Mon
  { open: 7 * 60, close: 16 * 60 }, // Tue
  { open: 7 * 60, close: 16 * 60 }, // Wed
  { open: 7 * 60, close: 16 * 60 }, // Thu
  { open: 7 * 60, close: 16 * 60 }, // Fri
  { open: 8 * 60, close: 15 * 60 }, // Sat
];

export const orderingConfig = {
  slotMinutes: 15,
  minLeadMinutes: 15,
  lastOrderBeforeCloseMinutes: 15,
  noSlotWithinMinutesOfClose: 30,
  maxOrdersPerSlot: 10,
  maxPrepUnitsPerSlot: 999,
  maxOpenOrdersPerPhone: 2,
  horizonDays: 2,
  weeklyHours,
};
