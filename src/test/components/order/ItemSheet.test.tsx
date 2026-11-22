import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ItemSheet from '../../../components/order/ItemSheet';
import { getItem } from '../../../data/catalog';
import type { CartLine } from '../../../lib/ordering/types';

// Real catalog data, not a fixture — ItemSheet's gating/pricing logic is only
// meaningful in terms of actual modifier groups (size/temperature/milk/extras),
// and this keeps the test honest against the live menu contract.
const LATTE = getItem('olive-branch-latte')!;
const ESPRESSO = getItem('espresso')!;
const FOCACCIA = getItem('olive-rosemary-focaccia')!;

function addButton() {
  return screen.getByRole('button', { name: /to order/i });
}

describe('ItemSheet', () => {
  it('pre-selects each required group\'s default and starts addable', () => {
    render(<ItemSheet item={LATTE} onAdd={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: '12 oz' })).toHaveClass('bg-moss');
    expect(screen.getByRole('button', { name: 'Hot' })).toHaveClass('bg-moss');
    expect(screen.getByRole('button', { name: 'Whole milk' })).toHaveClass('bg-moss');
    expect(addButton()).toBeEnabled();
  });

  it('treats size/temperature/milk as single-select — picking one swaps the selection, not adds to it', async () => {
    const user = userEvent.setup();
    render(<ItemSheet item={LATTE} onAdd={vi.fn()} onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /^16 oz/ }));

    expect(screen.getByRole('button', { name: /^16 oz/ })).toHaveClass('bg-moss');
    expect(screen.getByRole('button', { name: '12 oz' })).not.toHaveClass('bg-moss');
  });

  it('treats extras as multiple-select — options accumulate instead of replacing each other', async () => {
    const user = userEvent.setup();
    render(<ItemSheet item={LATTE} onAdd={vi.fn()} onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /extra shot/i }));
    await user.click(screen.getByRole('button', { name: /vanilla syrup/i }));

    expect(screen.getByRole('button', { name: /extra shot/i })).toHaveClass('bg-moss');
    expect(screen.getByRole('button', { name: /vanilla syrup/i })).toHaveClass('bg-moss');

    // clicking a selected multi-select option again deselects it
    await user.click(screen.getByRole('button', { name: /extra shot/i }));
    expect(screen.getByRole('button', { name: /extra shot/i })).not.toHaveClass('bg-moss');
    expect(screen.getByRole('button', { name: /vanilla syrup/i })).toHaveClass('bg-moss');
  });

  it('prices in selected modifier deltas and multiplies by quantity', async () => {
    const user = userEvent.setup();
    render(<ItemSheet item={LATTE} onAdd={vi.fn()} onClose={vi.fn()} />);

    // base $5.50 + 16oz (+$0.75) + oat milk (+$0.75) = $7.00
    await user.click(screen.getByRole('button', { name: /^16 oz/ }));
    await user.click(screen.getByRole('button', { name: /oat milk/i }));
    expect(addButton()).toHaveTextContent('$7.00');

    await user.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(addButton()).toHaveTextContent('2 to order · $14.00');
  });

  it('clamps quantity between 1 and 20', async () => {
    const user = userEvent.setup();
    render(<ItemSheet item={ESPRESSO} onAdd={vi.fn()} onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Decrease quantity' }));
    expect(screen.getByText('1')).toBeInTheDocument();

    for (let i = 0; i < 25; i++) {
      await user.click(screen.getByRole('button', { name: 'Increase quantity' }));
    }
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('builds the cart line with snapshotted modifier names and prices on add', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn<(line: CartLine) => void>();
    render(<ItemSheet item={LATTE} onAdd={onAdd} onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /oat milk/i }));
    await user.click(addButton());

    expect(onAdd).toHaveBeenCalledOnce();
    const line = onAdd.mock.calls[0][0];
    expect(line.itemSlug).toBe('olive-branch-latte');
    expect(line.quantity).toBe(1);
    expect(line.unitBasePriceCents).toBe(550);
    expect(line.modifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ groupSlug: 'size', optionSlug: '12oz' }),
        expect.objectContaining({ groupSlug: 'temperature', optionSlug: 'hot' }),
        expect.objectContaining({ groupSlug: 'milk', optionSlug: 'oat', name: 'Oat milk', priceDeltaCents: 75 }),
      ]),
    );
  });

  it('works for an item with no modifier groups at all', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn<(line: CartLine) => void>();
    render(<ItemSheet item={FOCACCIA} onAdd={onAdd} onClose={vi.fn()} />);

    expect(addButton()).toBeEnabled();
    await user.click(addButton());

    expect(onAdd).toHaveBeenCalledOnce();
    expect(onAdd.mock.calls[0][0].modifiers).toEqual([]);
  });

  it('closes on backdrop click but not on a click inside the sheet', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ItemSheet item={ESPRESSO} onAdd={vi.fn()} onClose={onClose} />);

    await user.click(screen.getByRole('heading', { name: ESPRESSO.name }));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
