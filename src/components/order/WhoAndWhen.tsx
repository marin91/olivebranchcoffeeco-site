import type { AvailabilityDto } from '../../lib/ordering/types';
import PickupPicker from './PickupPicker';

export type WhoAndWhenValue = {
  name: string;
  phoneRaw: string;
  email: string;
  note: string;
  pickupMode: 'asap' | 'scheduled';
  pickupSlotIso: string | null;
};

function isPhonePlausible(raw: string) {
  const digits = raw.replace(/\D/g, '');
  const tenDigit = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  return tenDigit.length === 10;
}

export default function WhoAndWhen({
  value,
  availability,
  onChange,
  onBack,
  onContinue,
}: {
  value: WhoAndWhenValue;
  availability: AvailabilityDto | null;
  onChange: (value: WhoAndWhenValue) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const phoneOk = isPhonePlausible(value.phoneRaw);
  const nameOk = value.name.trim().length > 0;
  const slotOk = value.pickupMode === 'asap' ? true : Boolean(value.pickupSlotIso);
  const canContinue = nameOk && phoneOk && slotOk && availability?.isOrderingPaused !== true;

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Who's picking up</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="order-name" className="block text-sm font-medium text-olive-800">
              Name
            </label>
            <input
              id="order-name"
              type="text"
              required
              value={value.name}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
              className="mt-1 w-full rounded-lg border border-olive-300 px-3 py-2 text-olive-900 focus:outline-none focus:ring-2 focus:ring-moss"
            />
          </div>
          <div>
            <label htmlFor="order-phone" className="block text-sm font-medium text-olive-800">
              Phone number
            </label>
            <input
              id="order-phone"
              type="tel"
              inputMode="tel"
              required
              placeholder="(951) 555-0100"
              value={value.phoneRaw}
              onChange={(e) => onChange({ ...value, phoneRaw: e.target.value })}
              className="mt-1 w-full rounded-lg border border-olive-300 px-3 py-2 text-olive-900 focus:outline-none focus:ring-2 focus:ring-moss"
            />
            {value.phoneRaw.length > 0 && !phoneOk && (
              <p className="mt-1 text-xs text-clay-500">Enter a 10-digit phone number.</p>
            )}
            <p className="mt-1 text-xs text-olive-600">We'll text this number when your order's confirmed and ready.</p>
          </div>
          <div>
            <label htmlFor="order-email" className="block text-sm font-medium text-olive-800">
              Email <span className="text-olive-500">(optional)</span>
            </label>
            <input
              id="order-email"
              type="email"
              value={value.email}
              onChange={(e) => onChange({ ...value, email: e.target.value })}
              className="mt-1 w-full rounded-lg border border-olive-300 px-3 py-2 text-olive-900 focus:outline-none focus:ring-2 focus:ring-moss"
            />
          </div>
          <div>
            <label htmlFor="order-note" className="block text-sm font-medium text-olive-800">
              Note <span className="text-olive-500">(optional)</span>
            </label>
            <input
              id="order-note"
              type="text"
              placeholder="Extra hot, allergy note, etc."
              value={value.note}
              onChange={(e) => onChange({ ...value, note: e.target.value })}
              className="mt-1 w-full rounded-lg border border-olive-300 px-3 py-2 text-olive-900 focus:outline-none focus:ring-2 focus:ring-moss"
            />
          </div>
        </div>
      </div>

      <div>
        <p className="eyebrow">When</p>
        <div className="mt-4">
          <PickupPicker
            availability={availability}
            pickupMode={value.pickupMode}
            selectedSlotIso={value.pickupSlotIso}
            onPickupModeChange={(mode) => onChange({ ...value, pickupMode: mode })}
            onSelectSlot={(iso) => onChange({ ...value, pickupMode: 'scheduled', pickupSlotIso: iso })}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onBack} className="btn-secondary">
          Back
        </button>
        <button type="button" onClick={onContinue} disabled={!canContinue} className="btn-primary flex-1 disabled:opacity-50">
          Review order
        </button>
      </div>
    </div>
  );
}
