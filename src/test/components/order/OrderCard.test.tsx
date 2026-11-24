import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrderCard from '../../../components/order/OrderCard';
import { CONFIRMED_ORDER } from '../../fixtures/orders';

const NOOP_HANDLERS = {
  onStart: vi.fn(),
  onReady: vi.fn(),
  onPickedUp: vi.fn(),
  onNoShow: vi.fn(),
  onCancel: vi.fn(),
};

describe('OrderCard', () => {
  it('renders the reference, pickup time, first name, items, and modifiers', () => {
    render(<OrderCard order={CONFIRMED_ORDER} isOverdue={false} isBusy={false} {...NOOP_HANDLERS} />);

    expect(screen.getByText(CONFIRMED_ORDER.reference)).toBeInTheDocument();
    expect(screen.getByText('Miguel')).toBeInTheDocument();
    expect(screen.getByText(/1× Espresso/)).toBeInTheDocument();
  });

  it('shows the customer note when present', () => {
    render(<OrderCard order={{ ...CONFIRMED_ORDER, note: 'Extra hot please' }} isOverdue={false} isBusy={false} {...NOOP_HANDLERS} />);

    expect(screen.getByText('"Extra hot please"')).toBeInTheDocument();
  });

  it('shows Start and Cancel for a Confirmed order, and calls onStart with its token', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<OrderCard order={CONFIRMED_ORDER} isOverdue={false} isBusy={false} {...NOOP_HANDLERS} onStart={onStart} />);

    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ready' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Picked Up' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(onStart).toHaveBeenCalledExactlyOnceWith(CONFIRMED_ORDER.token);
  });

  it('shows Ready and Cancel for an InProgress order, and calls onReady with its token', async () => {
    const user = userEvent.setup();
    const onReady = vi.fn();
    render(
      <OrderCard
        order={{ ...CONFIRMED_ORDER, status: 'InProgress' }}
        isOverdue={false}
        isBusy={false}
        {...NOOP_HANDLERS}
        onReady={onReady}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Ready' }));
    expect(onReady).toHaveBeenCalledExactlyOnceWith(CONFIRMED_ORDER.token);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('shows Picked Up and Cancel for a Ready order, and calls onPickedUp with its token', async () => {
    const user = userEvent.setup();
    const onPickedUp = vi.fn();
    render(
      <OrderCard
        order={{ ...CONFIRMED_ORDER, status: 'Ready' }}
        isOverdue={false}
        isBusy={false}
        {...NOOP_HANDLERS}
        onPickedUp={onPickedUp}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Picked Up' }));
    expect(onPickedUp).toHaveBeenCalledExactlyOnceWith(CONFIRMED_ORDER.token);
  });

  it('shows a No-show button and overdue copy only when overdue, and calls onNoShow with its token', async () => {
    const user = userEvent.setup();
    const onNoShow = vi.fn();
    render(<OrderCard order={CONFIRMED_ORDER} isOverdue={true} isBusy={false} {...NOOP_HANDLERS} onNoShow={onNoShow} />);

    expect(screen.getByText('Past pickup time')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'No-show' }));
    expect(onNoShow).toHaveBeenCalledExactlyOnceWith(CONFIRMED_ORDER.token);
  });

  it('hides Cancel once the order has reached a terminal state', () => {
    render(<OrderCard order={{ ...CONFIRMED_ORDER, status: 'PickedUp' }} isOverdue={false} isBusy={false} {...NOOP_HANDLERS} />);

    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('disables every action button while busy', () => {
    render(<OrderCard order={CONFIRMED_ORDER} isOverdue={false} isBusy={true} {...NOOP_HANDLERS} />);

    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
