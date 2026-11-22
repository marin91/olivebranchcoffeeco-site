import { describe, expect, it } from 'vitest';
import {
  cartItemCount,
  cartPrepUnits,
  cartSubtotalCents,
  formatCents,
  lineTotalCents,
  lineUnitPriceCents,
} from '../../../lib/ordering/pricing';
import { ESPRESSO_LINE, LATTE_LINE } from '../../fixtures/cart';
import type { CartLine } from '../../../lib/ordering/types';

describe('formatCents', () => {
  it('formats whole dollars, sub-dollar amounts, and zero with two decimal places', () => {
    expect(formatCents(325)).toBe('$3.25');
    expect(formatCents(5)).toBe('$0.05');
    expect(formatCents(0)).toBe('$0.00');
    expect(formatCents(123456)).toBe('$1234.56');
  });
});

describe('lineUnitPriceCents', () => {
  it('is just the base price when there are no modifiers', () => {
    expect(lineUnitPriceCents(ESPRESSO_LINE)).toBe(325);
  });

  it('adds every modifier delta onto the base price', () => {
    // Latte fixture: $5.50 base + 16oz (+$0.75) + oat milk (+$0.75)
    expect(lineUnitPriceCents(LATTE_LINE)).toBe(700);
  });
});

describe('lineTotalCents', () => {
  it('multiplies the unit price (base + modifiers) by quantity', () => {
    expect(lineTotalCents(ESPRESSO_LINE)).toBe(650); // $3.25 x 2
    expect(lineTotalCents(LATTE_LINE)).toBe(700); // $7.00 x 1
  });
});

describe('cartSubtotalCents', () => {
  it('sums line totals across the cart', () => {
    expect(cartSubtotalCents([ESPRESSO_LINE, LATTE_LINE])).toBe(1350);
  });

  it('is zero for an empty cart', () => {
    expect(cartSubtotalCents([])).toBe(0);
  });
});

describe('cartPrepUnits', () => {
  it('multiplies each line\'s prepUnits by its quantity, not just counting lines', () => {
    const heavyLine: CartLine = { ...LATTE_LINE, id: 'line-heavy', prepUnits: 3, quantity: 2 };
    expect(cartPrepUnits([heavyLine])).toBe(6);
  });

  it('sums prep units across every line in the cart', () => {
    expect(cartPrepUnits([ESPRESSO_LINE, LATTE_LINE])).toBe(3); // (1x2) + (1x1)
  });

  it('is zero for an empty cart', () => {
    expect(cartPrepUnits([])).toBe(0);
  });
});

describe('cartItemCount', () => {
  it('sums quantities, not the number of distinct lines', () => {
    expect(cartItemCount([ESPRESSO_LINE, LATTE_LINE])).toBe(3); // 2 + 1
  });

  it('is zero for an empty cart', () => {
    expect(cartItemCount([])).toBe(0);
  });
});
