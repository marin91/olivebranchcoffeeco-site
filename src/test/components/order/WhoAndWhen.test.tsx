import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WhoAndWhen, { type WhoAndWhenValue } from '../../../components/order/WhoAndWhen';
import type { AvailabilityDto } from '../../../lib/ordering/types';
import { OPEN_AVAILABILITY } from '../../fixtures/availability';

const EMPTY_VALUE: WhoAndWhenValue = {
  name: '',
  phoneRaw: '',
  email: '',
  note: '',
  pickupMode: 'asap',
  pickupSlotIso: null,
};

// WhoAndWhen is a controlled component with no state of its own — this harness
// holds the state so typing/clicking in the test behaves like it does for a
// real caller (OrderApp), instead of asserting against stale re-renders.
function Harness({
  availability = OPEN_AVAILABILITY,
  onContinue = vi.fn(),
  onBack = vi.fn(),
}: {
  availability?: AvailabilityDto | null;
  onContinue?: () => void;
  onBack?: () => void;
}) {
  const [value, setValue] = useState(EMPTY_VALUE);
  return <WhoAndWhen value={value} availability={availability} onChange={setValue} onBack={onBack} onContinue={onContinue} />;
}

function continueButton() {
  return screen.getByRole('button', { name: /review order/i });
}

describe('WhoAndWhen', () => {
  it('keeps Continue disabled until a name and a valid phone are entered', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(continueButton()).toBeDisabled();

    await user.type(screen.getByLabelText(/name/i), 'Miguel');
    expect(continueButton()).toBeDisabled();

    await user.type(screen.getByLabelText(/phone number/i), '9515551234');
    expect(continueButton()).toBeEnabled();
  });

  it('shows a phone format hint only once digits have been entered, not on an empty field', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.queryByText(/enter a 10-digit phone number/i)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/phone number/i), '555');
    expect(screen.getByText(/enter a 10-digit phone number/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/phone number/i), '1234567');
    expect(screen.queryByText(/enter a 10-digit phone number/i)).not.toBeInTheDocument();
  });

  it('accepts an 11-digit phone number with a leading country code 1', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText(/name/i), 'Miguel');
    await user.type(screen.getByLabelText(/phone number/i), '19515551234');

    expect(continueButton()).toBeEnabled();
  });

  it('requires a pickup slot once scheduling is chosen, defaults to no requirement for ASAP', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText(/name/i), 'Miguel');
    await user.type(screen.getByLabelText(/phone number/i), '9515551234');
    expect(continueButton()).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /pick a time/i }));
    expect(continueButton()).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '12:15 PM' }));
    expect(continueButton()).toBeEnabled();
  });

  it('disables Continue while ordering is paused, even with otherwise valid fields', async () => {
    const user = userEvent.setup();
    render(<Harness availability={{ ...OPEN_AVAILABILITY, isOrderingPaused: true }} />);

    await user.type(screen.getByLabelText(/name/i), 'Miguel');
    await user.type(screen.getByLabelText(/phone number/i), '9515551234');

    expect(continueButton()).toBeDisabled();
  });

  it('fires onBack and onContinue when their buttons are clicked', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onContinue = vi.fn();
    render(<Harness onBack={onBack} onContinue={onContinue} />);

    await user.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalledOnce();

    await user.type(screen.getByLabelText(/name/i), 'Miguel');
    await user.type(screen.getByLabelText(/phone number/i), '9515551234');
    await user.click(continueButton());
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
