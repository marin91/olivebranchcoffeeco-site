import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminBoard from '../../../components/order/AdminBoard';
import { CONFIRMED_ORDER } from '../../fixtures/orders';

const { getOrderingClient } = vi.hoisted(() => ({ getOrderingClient: vi.fn() }));
vi.mock('../../../lib/ordering/client', () => ({ getOrderingClient }));

type ClientOverrides = Partial<{
  listBoardOrders: ReturnType<typeof vi.fn>;
  getAdminSettings: ReturnType<typeof vi.fn>;
  getMenuAvailability: ReturnType<typeof vi.fn>;
  startOrder: ReturnType<typeof vi.fn>;
  markReady: ReturnType<typeof vi.fn>;
  markPickedUp: ReturnType<typeof vi.fn>;
  markNoShow: ReturnType<typeof vi.fn>;
  cancelOrderByShop: ReturnType<typeof vi.fn>;
  setOnlineOrderingEnabled: ReturnType<typeof vi.fn>;
  setItemSoldOut: ReturnType<typeof vi.fn>;
}>;

function mockClient(overrides: ClientOverrides = {}) {
  const client = {
    listBoardOrders: overrides.listBoardOrders ?? vi.fn().mockResolvedValue([]),
    getAdminSettings: overrides.getAdminSettings ?? vi.fn().mockResolvedValue({ onlineOrderingEnabled: true }),
    getMenuAvailability: overrides.getMenuAvailability ?? vi.fn().mockResolvedValue([]),
    startOrder: overrides.startOrder ?? vi.fn(),
    markReady: overrides.markReady ?? vi.fn(),
    markPickedUp: overrides.markPickedUp ?? vi.fn(),
    markNoShow: overrides.markNoShow ?? vi.fn(),
    cancelOrderByShop: overrides.cancelOrderByShop ?? vi.fn(),
    setOnlineOrderingEnabled: overrides.setOnlineOrderingEnabled ?? vi.fn().mockResolvedValue(undefined),
    setItemSoldOut: overrides.setItemSoldOut ?? vi.fn().mockResolvedValue(undefined),
  };
  getOrderingClient.mockReturnValue(client);
  return client;
}

beforeEach(() => {
  getOrderingClient.mockReset();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AdminBoard', () => {
  it('shows a loading state before the first poll resolves', () => {
    mockClient();
    render(<AdminBoard />);

    expect(screen.getByText(/loading the board/i)).toBeInTheDocument();
  });

  it('shows an empty-board message when there are no active orders', async () => {
    mockClient();
    render(<AdminBoard />);

    expect(await screen.findByText(/nothing on the board/i)).toBeInTheDocument();
  });

  it('buckets a Confirmed order due soon into Now, and a far-out one into Upcoming', async () => {
    vi.setSystemTime(new Date('2026-11-23T12:00:00.000Z'));
    const dueSoon = { ...CONFIRMED_ORDER, token: 'due-soon', reference: 'OB-SOON', pickupAtIso: '2026-11-23T12:05:00.000Z' };
    const farOut = { ...CONFIRMED_ORDER, token: 'far-out', reference: 'OB-FAR', pickupAtIso: '2026-11-23T14:00:00.000Z' };
    mockClient({ listBoardOrders: vi.fn().mockResolvedValue([dueSoon, farOut]) });
    render(<AdminBoard />);

    const nowColumn = (await screen.findByText('Now (1)')).closest('div')!;
    expect(within(nowColumn).getByText('OB-SOON')).toBeInTheDocument();

    const upcomingColumn = screen.getByText('Upcoming (1)').closest('div')!;
    expect(within(upcomingColumn).getByText('OB-FAR')).toBeInTheDocument();
  });

  it('buckets a Ready order into Ready regardless of pickup time', async () => {
    vi.setSystemTime(new Date('2026-11-23T12:00:00.000Z'));
    const ready = { ...CONFIRMED_ORDER, status: 'Ready' as const, pickupAtIso: '2026-11-23T14:00:00.000Z' };
    mockClient({ listBoardOrders: vi.fn().mockResolvedValue([ready]) });
    render(<AdminBoard />);

    const readyColumn = (await screen.findByText('Ready (1)')).closest('div')!;
    expect(within(readyColumn).getByText(CONFIRMED_ORDER.reference)).toBeInTheDocument();
    expect(screen.getByText('Now (0)')).toBeInTheDocument();
  });

  it('calls startOrder and refetches the board when Start is clicked', async () => {
    const user = userEvent.setup();
    const listBoardOrders = vi
      .fn()
      .mockResolvedValueOnce([CONFIRMED_ORDER])
      .mockResolvedValue([{ ...CONFIRMED_ORDER, status: 'InProgress' }]);
    const startOrder = vi.fn().mockResolvedValue({ ...CONFIRMED_ORDER, status: 'InProgress' });
    mockClient({ listBoardOrders, startOrder });
    render(<AdminBoard />);

    await user.click(await screen.findByRole('button', { name: 'Start' }));

    expect(startOrder).toHaveBeenCalledWith(CONFIRMED_ORDER.token);
    expect(await screen.findByRole('button', { name: 'Ready' })).toBeInTheDocument();
  });

  it('toggles the pause button label and shows the paused banner', async () => {
    const user = userEvent.setup();
    const getAdminSettings = vi
      .fn()
      .mockResolvedValueOnce({ onlineOrderingEnabled: true })
      .mockResolvedValue({ onlineOrderingEnabled: false });
    const setOnlineOrderingEnabled = vi.fn().mockResolvedValue(undefined);
    mockClient({ getAdminSettings, setOnlineOrderingEnabled });
    render(<AdminBoard />);

    const pauseButton = await screen.findByRole('button', { name: 'Pause online ordering' });
    await user.click(pauseButton);

    expect(setOnlineOrderingEnabled).toHaveBeenCalledWith(false);
    expect(await screen.findByRole('button', { name: 'Resume online ordering' })).toBeInTheDocument();
    expect(screen.getByText(/online ordering is paused/i)).toBeInTheDocument();
  });

  it('toggles an item sold-out from the Sold out today panel', async () => {
    const user = userEvent.setup();
    const getMenuAvailability = vi
      .fn()
      .mockResolvedValueOnce([{ slug: 'espresso', name: 'Espresso', categorySlug: 'espresso', isSoldOut: false }])
      .mockResolvedValue([{ slug: 'espresso', name: 'Espresso', categorySlug: 'espresso', isSoldOut: true }]);
    const setItemSoldOut = vi.fn().mockResolvedValue(undefined);
    mockClient({ getMenuAvailability, setItemSoldOut });
    render(<AdminBoard />);

    await user.click(await screen.findByRole('button', { name: 'Sold out today' }));
    await user.click(await screen.findByRole('button', { name: 'Available' }));

    expect(setItemSoldOut).toHaveBeenCalledWith('espresso', true);
    expect(await screen.findByRole('button', { name: 'Sold out' })).toBeInTheDocument();
  });

  it('shows an error banner when a poll fails', async () => {
    mockClient({ listBoardOrders: vi.fn().mockRejectedValue(new Error('network down')) });
    render(<AdminBoard />);

    expect(await screen.findByText(/could not reach the order board/i)).toBeInTheDocument();
  });
});
