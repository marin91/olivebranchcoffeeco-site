import { describe, expect, it } from 'vitest';
import {
  buildSlotDtos,
  formatSlotLabel,
  generateSlotsForDay,
  isAcceptingOrdersAt,
  isShopOpenAt,
  resolveAsapSlot,
  slotKey,
} from '../../../lib/ordering/slots';

// All functions here read Date#getHours()/getDay() (local time) by design —
// see the "no I/O" comment in slots.ts — so test dates are built with the
// local Date(y, m, d, h, mi) constructor, never ISO/UTC strings, to stay
// correct regardless of the machine's timezone.
const MONDAY = (hour: number, minute = 0) => new Date(2026, 0, 5, hour, minute); // weekday hours 7:00-16:00
const SUNDAY = (hour: number, minute = 0) => new Date(2026, 0, 4, hour, minute); // weekend hours 8:00-15:00

describe('isShopOpenAt', () => {
  it('is open at the exact opening minute and closed just before it', () => {
    expect(isShopOpenAt(MONDAY(7, 0))).toBe(true);
    expect(isShopOpenAt(MONDAY(6, 59))).toBe(false);
  });

  it('is open one minute before close and closed at the exact close minute', () => {
    expect(isShopOpenAt(MONDAY(15, 59))).toBe(true);
    expect(isShopOpenAt(MONDAY(16, 0))).toBe(false);
  });

  it('uses weekend hours on Sunday, not weekday hours', () => {
    expect(isShopOpenAt(SUNDAY(7, 30))).toBe(false); // weekday-only hour
    expect(isShopOpenAt(SUNDAY(8, 0))).toBe(true);
    expect(isShopOpenAt(SUNDAY(15, 0))).toBe(false); // weekend closes at 15:00
  });
});

describe('isAcceptingOrdersAt', () => {
  it('stops accepting orders lastOrderBeforeCloseMinutes before the shop actually closes', () => {
    // Monday closes at 16:00, cutoff is 15 minutes earlier: 15:45.
    expect(isAcceptingOrdersAt(MONDAY(15, 45))).toBe(true);
    expect(isAcceptingOrdersAt(MONDAY(15, 46))).toBe(false);
  });

  it('matches isShopOpenAt at opening time', () => {
    expect(isAcceptingOrdersAt(MONDAY(7, 0))).toBe(true);
    expect(isAcceptingOrdersAt(MONDAY(6, 59))).toBe(false);
  });
});

describe('generateSlotsForDay', () => {
  it('starts at opening time and stops noSlotWithinMinutesOfClose short of close', () => {
    const slots = generateSlotsForDay(MONDAY(0, 0));

    expect(slots[0]).toEqual(MONDAY(7, 0));
    expect(slots.at(-1)).toEqual(MONDAY(15, 30)); // 16:00 close - 30min buffer
  });

  it('spaces slots slotMinutes apart with no gaps or overlaps', () => {
    const slots = generateSlotsForDay(MONDAY(0, 0));

    for (let i = 1; i < slots.length; i++) {
      expect(slots[i].getTime() - slots[i - 1].getTime()).toBe(15 * 60_000);
    }
  });

  it('generates a shorter run on weekend hours', () => {
    const weekday = generateSlotsForDay(MONDAY(0, 0));
    const weekend = generateSlotsForDay(SUNDAY(0, 0));

    expect(weekend.length).toBeLessThan(weekday.length);
    expect(weekend[0]).toEqual(SUNDAY(8, 0));
    expect(weekend.at(-1)).toEqual(SUNDAY(14, 30)); // 15:00 close - 30min buffer
  });
});

describe('slotKey', () => {
  it('produces distinct, stable keys for distinct slots', () => {
    const [first, second] = generateSlotsForDay(MONDAY(0, 0));

    expect(slotKey(first)).not.toBe(slotKey(second));
    expect(slotKey(first)).toBe(first.toISOString());
  });
});

describe('formatSlotLabel', () => {
  it('formats morning and afternoon times as 12-hour clock strings', () => {
    expect(formatSlotLabel(MONDAY(7, 0))).toBe('7:00 AM');
    expect(formatSlotLabel(MONDAY(15, 30))).toBe('3:30 PM');
  });
});

describe('resolveAsapSlot', () => {
  it('returns the first slot at or after now + minLeadMinutes', () => {
    const slots = generateSlotsForDay(MONDAY(0, 0));

    // now=7:00, lead=15min -> earliest=7:15 -> first slot >= 7:15 is 7:15 itself.
    expect(resolveAsapSlot(MONDAY(7, 0), slots)).toEqual(MONDAY(7, 15));
  });

  it('skips a slot that falls inside the lead window', () => {
    const slots = generateSlotsForDay(MONDAY(0, 0));

    // now=7:05 -> earliest=7:20 -> 7:15 is too soon, 7:30 is the first valid slot.
    expect(resolveAsapSlot(MONDAY(7, 5), slots)).toEqual(MONDAY(7, 30));
  });

  it('returns undefined when no slot clears the lead window', () => {
    expect(resolveAsapSlot(MONDAY(7, 0), [])).toBeUndefined();
    expect(resolveAsapSlot(MONDAY(16, 0), [MONDAY(7, 0)])).toBeUndefined();
  });
});

describe('buildSlotDtos', () => {
  it('excludes slots that have already passed relative to now', () => {
    const dtos = buildSlotDtos(MONDAY(12, 0), MONDAY(0, 0), () => false);

    expect(dtos.every((d) => new Date(d.startIso).getTime() >= MONDAY(12, 0).getTime())).toBe(true);
    expect(dtos.some((d) => d.startIso === MONDAY(7, 0).toISOString())).toBe(false);
    expect(dtos.some((d) => d.startIso === MONDAY(12, 0).toISOString())).toBe(true);
  });

  it('keeps every slot for a future day regardless of today\'s now', () => {
    const dtos = buildSlotDtos(MONDAY(12, 0), SUNDAY(0, 0) /* earlier date, as "tomorrow" would be later */, () => false);

    // All of Sunday's slots are already in the past relative to Monday noon.
    expect(dtos).toHaveLength(0);
  });

  it('threads the isSlotFull predicate through to each dto', () => {
    const slots = generateSlotsForDay(MONDAY(0, 0));
    const fullSlot = slots[2];
    const dtos = buildSlotDtos(MONDAY(0, 0), MONDAY(0, 0), (slot) => slot.getTime() === fullSlot.getTime());

    expect(dtos.find((d) => d.startIso === fullSlot.toISOString())?.isFull).toBe(true);
    expect(dtos.find((d) => d.startIso === slots[0].toISOString())?.isFull).toBe(false);
  });
});
