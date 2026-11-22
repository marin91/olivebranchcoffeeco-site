// Pure slot math, no I/O. Runs entirely against the browser clock for this
// mock-data build — a real backend must redo this with a server-side
// TimeZoneInfo rather than trusting the client clock (see decisions.md).
import { orderingConfig } from '../../data/orderingConfig';
import type { PickupSlotDto } from './types';

function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function dayHoursFor(date: Date) {
  return orderingConfig.weeklyHours[date.getDay()];
}

function atMinute(date: Date, minute: number): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minute);
  return d;
}

export function isShopOpenAt(date: Date): boolean {
  const hours = dayHoursFor(date);
  const m = minutesOfDay(date);
  return m >= hours.open && m < hours.close;
}

export function isAcceptingOrdersAt(date: Date): boolean {
  const hours = dayHoursFor(date);
  const m = minutesOfDay(date);
  return m >= hours.open && m <= hours.close - orderingConfig.lastOrderBeforeCloseMinutes;
}

export function generateSlotsForDay(date: Date): Date[] {
  const hours = dayHoursFor(date);
  const lastSlotStart = hours.close - orderingConfig.noSlotWithinMinutesOfClose;
  const slots: Date[] = [];
  for (let m = hours.open; m <= lastSlotStart; m += orderingConfig.slotMinutes) {
    slots.push(atMinute(date, m));
  }
  return slots;
}

export function slotKey(slot: Date): string {
  return slot.toISOString();
}

export function formatSlotLabel(slot: Date): string {
  return slot.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function resolveAsapSlot(now: Date, slots: Date[]): Date | undefined {
  const earliest = new Date(now.getTime() + orderingConfig.minLeadMinutes * 60000);
  return slots.find((s) => s.getTime() >= earliest.getTime());
}

export function buildSlotDtos(
  now: Date,
  date: Date,
  isSlotFull: (slot: Date) => boolean,
): PickupSlotDto[] {
  return generateSlotsForDay(date)
    .filter((slot) => slot.getTime() >= now.getTime())
    .map((slot) => ({
      startIso: slot.toISOString(),
      label: formatSlotLabel(slot),
      isFull: isSlotFull(slot),
    }));
}
