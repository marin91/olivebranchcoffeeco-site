import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import OrderApp from '../../../components/order/OrderApp';
import { OrderingError } from '../../../lib/ordering/types';
import { OPEN_AVAILABILITY } from '../../fixtures/availability';
import { CONFIRMED_ORDER } from '../../fixtures/orders';

const { getOrderingClient } = vi.hoisted(() => ({ getOrderingClient: vi.fn() }));
vi.mock('../../../lib/ordering/client', () => ({ getOrderingClient }));

function mockClient(overrides: { getAvailability?: ReturnType<typeof vi.fn>; createOrder?: ReturnType<typeof vi.fn> } = {}) {
  const client = {
    getAvailability: overrides.getAvailability ?? vi.fn().mockResolvedValue(OPEN_AVAILABILITY),
    createOrder: overrides.createOrder ?? vi.fn().mockResolvedValue(CONFIRMED_ORDER),
  };
  getOrderingClient.mockReturnValue(client);
  return client;
}

// Drives the real child components (MenuGrid -> ItemSheet -> CartPanel ->
// WhoAndWhen) through to the review step, adding one Espresso. OrderApp has
// no seam to stub its children, so exercising orchestration necessarily
// re-walks their UI — the per-component test files cover their own internals
// in depth; this covers the wiring between them.
async function addEspressoAndReachReview(user: UserEvent) {
  await user.click(screen.getByRole('button', { name: /^Espresso/ }));
  await user.click(screen.getByRole('button', { name: /to order/i }));
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.type(await screen.findByLabelText(/name/i), 'Miguel Test');
  await user.type(screen.getByLabelText(/phone number/i), '9515551234');
  await user.click(screen.getByRole('button', { name: /review order/i }));
  await screen.findByRole('button', { name: /place order/i });
}

beforeEach(() => {
  getOrderingClient.mockReset();
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { ...window.location, href: '' },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OrderApp', () => {
  it('starts on the menu step with an empty cart', () => {
    mockClient();
    render(<OrderApp />);

    expect(screen.getByText(/your order is empty/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/name/i)).not.toBeInTheDocument();
  });

  it('moves an added item from the menu into the cart, then into the review step', async () => {
    const user = userEvent.setup();
    mockClient();
    render(<OrderApp />);

    await addEspressoAndReachReview(user);

    expect(screen.getByText('1× Espresso')).toBeInTheDocument();
    expect(screen.getByText('Miguel Test')).toBeInTheDocument();
    expect(screen.getByText('9515551234')).toBeInTheDocument();
  });

  it('lets Back and Edit navigate between steps without losing cart state', async () => {
    const user = userEvent.setup();
    mockClient();
    render(<OrderApp />);

    await user.click(screen.getByRole('button', { name: /^Espresso/ }));
    await user.click(screen.getByRole('button', { name: /to order/i }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await user.click(await screen.findByRole('button', { name: 'Back' }));
    expect(screen.getByText('1× Espresso')).toBeInTheDocument(); // still in cart, back on menu step

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText(/name/i), 'Miguel Test');
    await user.type(screen.getByLabelText(/phone number/i), '9515551234');
    await user.click(screen.getByRole('button', { name: /review order/i }));

    await screen.findByText('Pickup details');
    const [, editDetails] = screen.getAllByRole('button', { name: 'Edit' });
    await user.click(editDetails);
    expect(screen.getByLabelText(/name/i)).toHaveValue('Miguel Test'); // details preserved
  });

  it('submits with the idempotency key and redirects to the token URL on success', async () => {
    const user = userEvent.setup();
    const order = { ...CONFIRMED_ORDER, token: 'order-token-xyz' };
    const createOrder = vi.fn().mockResolvedValue(order);
    mockClient({ createOrder });
    render(<OrderApp />);

    await addEspressoAndReachReview(user);
    await user.click(screen.getByRole('button', { name: /place order/i }));

    expect(createOrder).toHaveBeenCalledOnce();
    const request = createOrder.mock.calls[0][0];
    expect(request.idempotencyKey).toEqual(expect.any(String));
    expect(request.customerName).toBe('Miguel Test');
    expect(request.lines).toHaveLength(1);
    expect(window.location.href).toBe('/order/status?token=order-token-xyz');
  });

  it('shows the SlotFull error and refreshes availability, without redirecting', async () => {
    const user = userEvent.setup();
    const getAvailability = vi.fn().mockResolvedValue(OPEN_AVAILABILITY);
    const createOrder = vi.fn().mockRejectedValue(new OrderingError('SlotFull', 'That pickup time just filled up.'));
    mockClient({ getAvailability, createOrder });
    render(<OrderApp />);

    await addEspressoAndReachReview(user);
    const callsBeforeSubmit = getAvailability.mock.calls.length;

    await user.click(screen.getByRole('button', { name: /place order/i }));

    expect(await screen.findByText(/just filled up/i)).toBeInTheDocument();
    expect(window.location.href).toBe('');
    expect(getAvailability.mock.calls.length).toBeGreaterThan(callsBeforeSubmit);
  });

  it('shows a generic Network error for a non-OrderingError failure, without refreshing availability', async () => {
    const user = userEvent.setup();
    const getAvailability = vi.fn().mockResolvedValue(OPEN_AVAILABILITY);
    const createOrder = vi.fn().mockRejectedValue(new Error('boom'));
    mockClient({ getAvailability, createOrder });
    render(<OrderApp />);

    await addEspressoAndReachReview(user);
    const callsBeforeSubmit = getAvailability.mock.calls.length;

    await user.click(screen.getByRole('button', { name: /place order/i }));

    expect(await screen.findByText(/couldn't reach the shop/i)).toBeInTheDocument();
    expect(getAvailability.mock.calls.length).toBe(callsBeforeSubmit);
  });

  it('removes an item from the cart and shows the empty-cart message again', async () => {
    const user = userEvent.setup();
    mockClient();
    render(<OrderApp />);

    await user.click(screen.getByRole('button', { name: /^Espresso/ }));
    await user.click(screen.getByRole('button', { name: /to order/i }));
    expect(screen.getByText('1× Espresso')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /remove espresso/i }));

    expect(screen.getByText(/your order is empty/i)).toBeInTheDocument();
  });

  it('returns to the menu step (cart intact) via the "Your order" Edit link on review', async () => {
    const user = userEvent.setup();
    mockClient();
    render(<OrderApp />);

    await addEspressoAndReachReview(user);
    const [editCart] = screen.getAllByRole('button', { name: 'Edit' });
    await user.click(editCart);

    expect(screen.getByText('1× Espresso')).toBeInTheDocument();
    expect(screen.queryByLabelText(/name/i)).not.toBeInTheDocument();
  });

  it('falls back to null availability without crashing when the initial fetch fails', async () => {
    const user = userEvent.setup();
    mockClient({ getAvailability: vi.fn().mockRejectedValue(new Error('network down')) });
    render(<OrderApp />);

    await user.click(screen.getByRole('button', { name: /^Espresso/ }));
    await user.click(screen.getByRole('button', { name: /to order/i }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText(/checking pickup availability/i)).toBeInTheDocument();
  });

  it('submits the selected slot, not ASAP availability, when scheduling is chosen', async () => {
    const user = userEvent.setup();
    const createOrder = vi.fn().mockResolvedValue(CONFIRMED_ORDER);
    mockClient({ createOrder });
    render(<OrderApp />);

    await user.click(screen.getByRole('button', { name: /^Espresso/ }));
    await user.click(screen.getByRole('button', { name: /to order/i }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(await screen.findByLabelText(/name/i), 'Miguel Test');
    await user.type(screen.getByLabelText(/phone number/i), '9515551234');

    await user.click(screen.getByRole('button', { name: /pick a time/i }));
    const slot = OPEN_AVAILABILITY.slotsToday[1];
    await user.click(screen.getByRole('button', { name: slot.label }));
    await user.click(screen.getByRole('button', { name: /review order/i }));
    await user.click(await screen.findByRole('button', { name: /place order/i }));

    const request = createOrder.mock.calls[0][0];
    expect(request.pickupMode).toBe('scheduled');
    expect(request.pickupSlotIso).toBe(slot.startIso);
  });

  it('also refreshes availability on a SlotPast error', async () => {
    const user = userEvent.setup();
    const getAvailability = vi.fn().mockResolvedValue(OPEN_AVAILABILITY);
    const createOrder = vi.fn().mockRejectedValue(new OrderingError('SlotPast', 'That pickup time has already passed.'));
    mockClient({ getAvailability, createOrder });
    render(<OrderApp />);

    await addEspressoAndReachReview(user);
    const callsBeforeSubmit = getAvailability.mock.calls.length;
    await user.click(screen.getByRole('button', { name: /place order/i }));

    expect(await screen.findByText(/already passed/i)).toBeInTheDocument();
    expect(getAvailability.mock.calls.length).toBeGreaterThan(callsBeforeSubmit);
  });

  it('does not refresh availability for an OrderingError that is neither SlotFull nor SlotPast', async () => {
    const user = userEvent.setup();
    const getAvailability = vi.fn().mockResolvedValue(OPEN_AVAILABILITY);
    const createOrder = vi.fn().mockRejectedValue(new OrderingError('InvalidPhone', "That phone number doesn't look right."));
    mockClient({ getAvailability, createOrder });
    render(<OrderApp />);

    await addEspressoAndReachReview(user);
    const callsBeforeSubmit = getAvailability.mock.calls.length;
    await user.click(screen.getByRole('button', { name: /place order/i }));

    expect(await screen.findByText(/doesn't look right/i)).toBeInTheDocument();
    expect(getAvailability.mock.calls.length).toBe(callsBeforeSubmit);
  });

  it('reuses the same idempotency key across a failed and a retried submit', async () => {
    const user = userEvent.setup();
    const createOrder = vi.fn().mockRejectedValueOnce(new OrderingError('SlotFull', 'Full.')).mockResolvedValueOnce(CONFIRMED_ORDER);
    mockClient({ createOrder });
    render(<OrderApp />);

    await addEspressoAndReachReview(user);
    await user.click(screen.getByRole('button', { name: /place order/i }));
    await screen.findByText(/just filled up/i);
    await user.click(screen.getByRole('button', { name: /place order/i }));

    expect(createOrder).toHaveBeenCalledTimes(2);
    const [firstKey] = [createOrder.mock.calls[0][0].idempotencyKey];
    const [secondKey] = [createOrder.mock.calls[1][0].idempotencyKey];
    expect(secondKey).toBe(firstKey);
  });
});
