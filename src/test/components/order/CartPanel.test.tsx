import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CartPanel from '../../../components/order/CartPanel';
import { ESPRESSO_LINE, LATTE_LINE } from '../../fixtures/cart';

describe('CartPanel', () => {
  it('shows an empty-cart message and no subtotal/continue when there are no lines', () => {
    render(<CartPanel lines={[]} onRemove={vi.fn()} onContinue={vi.fn()} />);

    expect(screen.getByText(/your order is empty/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue/i })).not.toBeInTheDocument();
  });

  it('renders each line with quantity, modifiers, and its own total', () => {
    render(<CartPanel lines={[ESPRESSO_LINE, LATTE_LINE]} onRemove={vi.fn()} onContinue={vi.fn()} />);

    expect(screen.getByText('2× Espresso')).toBeInTheDocument();
    expect(screen.getByText('1× Olive Branch Latte')).toBeInTheDocument();
    expect(screen.getByText('16 oz, Oat milk')).toBeInTheDocument();
    // Espresso: $3.25 × 2 = $6.50. Latte: ($5.50 + $0.75 + $0.75) × 1 = $7.00.
    expect(screen.getByText('$6.50')).toBeInTheDocument();
    expect(screen.getByText('$7.00')).toBeInTheDocument();
  });

  it('sums the subtotal across all lines and their modifiers', () => {
    render(<CartPanel lines={[ESPRESSO_LINE, LATTE_LINE]} onRemove={vi.fn()} onContinue={vi.fn()} />);

    // $6.50 + $7.00 = $13.50
    expect(screen.getByText('Subtotal').nextElementSibling).toHaveTextContent('$13.50');
  });

  it('calls onRemove with the clicked line\'s id, not any other line', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<CartPanel lines={[ESPRESSO_LINE, LATTE_LINE]} onRemove={onRemove} onContinue={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /remove olive branch latte/i }));

    expect(onRemove).toHaveBeenCalledExactlyOnceWith(LATTE_LINE.id);
  });

  it('calls onContinue when Continue is clicked', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(<CartPanel lines={[ESPRESSO_LINE]} onRemove={vi.fn()} onContinue={onContinue} />);

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onContinue).toHaveBeenCalledOnce();
  });
});
