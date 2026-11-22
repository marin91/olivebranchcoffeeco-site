import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrderStatus from '../../../components/order/OrderStatus';
import { OrderingError } from '../../../lib/ordering/types';
import { CONFIRMED_ORDER } from '../../fixtures/orders';

const { getOrderingClient } = vi.hoisted(() => ({ getOrderingClient: vi.fn() }));
vi.mock('../../../lib/ordering/client', () => ({ getOrderingClient }));

function mockClient(overrides: { getOrder?: ReturnType<typeof vi.fn>; cancelOrder?: ReturnType<typeof vi.fn> } = {}) {
  const client = {
    getOrder: overrides.getOrder ?? vi.fn().mockResolvedValue(CONFIRMED_ORDER),
    cancelOrder: overrides.cancelOrder ?? vi.fn(),
  };
  getOrderingClient.mockReturnValue(client);
  return client;
}

function setUrlToken(token: string | null) {
  const url = token ? `/order/status?token=${token}` : '/order/status';
  window.history.pushState({}, '', url);
}

beforeEach(() => {
  getOrderingClient.mockReset();
});

afterEach(() => {
  window.history.pushState({}, '', '/');
});

describe('OrderStatus', () => {
  it('shows a not-found message and never calls the client when the URL has no token', async () => {
    setUrlToken(null);
    const client = mockClient();
    render(<OrderStatus />);

    expect(await screen.findByText(/couldn't find that order/i)).toBeInTheDocument();
    expect(client.getOrder).not.toHaveBeenCalled();
  });

  it('shows a not-found message when the client resolves no match for the token', async () => {
    setUrlToken('some-token');
    mockClient({ getOrder: vi.fn().mockResolvedValue(null) });
    render(<OrderStatus />);

    expect(await screen.findByText(/couldn't find that order/i)).toBeInTheDocument();
  });

  it('looks up by the opaque token and renders the order once found', async () => {
    setUrlToken(CONFIRMED_ORDER.token);
    const client = mockClient();
    render(<OrderStatus />);

    expect(await screen.findByText(`Order ${CONFIRMED_ORDER.reference}`)).toBeInTheDocument();
    expect(client.getOrder).toHaveBeenCalledWith(CONFIRMED_ORDER.token);
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText(/1× Espresso/)).toBeInTheDocument();
    expect(screen.getAllByText('$3.25')).toHaveLength(2); // line total + subtotal
  });

  it('cancels a Confirmed order through a two-step confirmation', async () => {
    const user = userEvent.setup();
    setUrlToken(CONFIRMED_ORDER.token);
    const canceled = { ...CONFIRMED_ORDER, status: 'Canceled' as const, cancelReason: 'Customer' as const };
    const client = mockClient({ cancelOrder: vi.fn().mockResolvedValue(canceled) });
    render(<OrderStatus />);

    await screen.findByText(`Order ${CONFIRMED_ORDER.reference}`);

    await user.click(screen.getByRole('button', { name: 'Cancel order' }));
    expect(screen.getByText('Cancel this order?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Yes, cancel' }));

    expect(client.cancelOrder).toHaveBeenCalledWith(CONFIRMED_ORDER.token);
    expect(await screen.findByText('Canceled')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
  });

  it('backing out of the cancel confirmation leaves the order untouched', async () => {
    const user = userEvent.setup();
    setUrlToken(CONFIRMED_ORDER.token);
    const client = mockClient();
    render(<OrderStatus />);

    await screen.findByText(`Order ${CONFIRMED_ORDER.reference}`);
    await user.click(screen.getByRole('button', { name: 'Cancel order' }));
    await user.click(screen.getByRole('button', { name: 'Never mind' }));

    expect(screen.getByRole('button', { name: 'Cancel order' })).toBeInTheDocument();
    expect(client.cancelOrder).not.toHaveBeenCalled();
  });

  it('shows the error message and keeps the order Confirmed when cancellation fails', async () => {
    const user = userEvent.setup();
    setUrlToken(CONFIRMED_ORDER.token);
    mockClient({
      cancelOrder: vi.fn().mockRejectedValue(new OrderingError('NotFound', 'This order can no longer be canceled online — call the shop.')),
    });
    render(<OrderStatus />);

    await screen.findByText(`Order ${CONFIRMED_ORDER.reference}`);
    await user.click(screen.getByRole('button', { name: 'Cancel order' }));
    await user.click(screen.getByRole('button', { name: 'Yes, cancel' }));

    expect(await screen.findByText(/no longer be canceled online/i)).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });

  it('shows a call-the-shop link and no cancel option once the order is InProgress', async () => {
    setUrlToken(CONFIRMED_ORDER.token);
    mockClient({ getOrder: vi.fn().mockResolvedValue({ ...CONFIRMED_ORDER, status: 'InProgress' as const }) });
    render(<OrderStatus />);

    await screen.findByText(`Order ${CONFIRMED_ORDER.reference}`);
    expect(screen.getByRole('link', { name: /call the shop/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
  });

  it('notes a shop-initiated cancellation distinctly from a customer one', async () => {
    setUrlToken(CONFIRMED_ORDER.token);
    mockClient({
      getOrder: vi.fn().mockResolvedValue({ ...CONFIRMED_ORDER, status: 'Canceled' as const, cancelReason: 'Shop' as const }),
    });
    render(<OrderStatus />);

    expect(await screen.findByText(/canceled by the shop/i)).toBeInTheDocument();
  });
});
