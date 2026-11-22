import type { CartLine } from './types';

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function lineUnitPriceCents(line: Pick<CartLine, 'unitBasePriceCents' | 'modifiers'>): number {
  return line.unitBasePriceCents + line.modifiers.reduce((sum, m) => sum + m.priceDeltaCents, 0);
}

export function lineTotalCents(line: Pick<CartLine, 'unitBasePriceCents' | 'modifiers' | 'quantity'>): number {
  return lineUnitPriceCents(line) * line.quantity;
}

export function cartSubtotalCents(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + lineTotalCents(line), 0);
}

export function cartPrepUnits(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.prepUnits * line.quantity, 0);
}

export function cartItemCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}
