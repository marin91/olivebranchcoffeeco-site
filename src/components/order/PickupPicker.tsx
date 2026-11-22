import type { AvailabilityDto } from '../../lib/ordering/types';

function formatIso(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function PickupPicker({
  availability,
  pickupMode,
  selectedSlotIso,
  onPickupModeChange,
  onSelectSlot,
}: {
  availability: AvailabilityDto | null;
  pickupMode: 'asap' | 'scheduled';
  selectedSlotIso: string | null;
  onPickupModeChange: (mode: 'asap' | 'scheduled') => void;
  onSelectSlot: (iso: string) => void;
}) {
  if (!availability) {
    return <p className="text-sm text-olive-600">Checking pickup availability…</p>;
  }

  if (availability.isOrderingPaused) {
    return (
      <div className="rounded-xl border border-clay-400 bg-clay-400/10 p-4 text-sm text-clay-600">
        We've paused online orders for the moment — please call the shop at {''}
        <a href="tel:+19515347625" className="font-medium underline">
          (951) 534-7625
        </a>{' '}
        or come on in.
      </div>
    );
  }

  if (!availability.isShopOpen || !availability.isAcceptingOrders) {
    return (
      <div className="rounded-xl border border-olive-200 bg-olive-100 p-4 text-sm text-olive-700">
        We're closed for online pickup orders right now. Check our hours on the Contact page, or browse tomorrow's
        slots below.
        {availability.slotsTomorrow.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {availability.slotsTomorrow.slice(0, 6).map((slot) => (
              <button
                key={slot.startIso}
                type="button"
                disabled={slot.isFull}
                onClick={() => onSelectSlot(slot.startIso)}
                className={
                  selectedSlotIso === slot.startIso
                    ? 'rounded-full border border-moss bg-moss px-4 py-2 text-sm font-medium text-cream-50'
                    : 'rounded-full border border-olive-300 px-4 py-2 text-sm font-medium text-olive-800 hover:bg-olive-50 disabled:cursor-not-allowed disabled:opacity-40'
                }
              >
                Tomorrow {slot.label}
                {slot.isFull && ' · Full'}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPickupModeChange('asap')}
          className={
            pickupMode === 'asap'
              ? 'flex-1 rounded-full bg-moss px-4 py-2 text-sm font-medium text-cream-50'
              : 'flex-1 rounded-full border border-olive-300 px-4 py-2 text-sm font-medium text-olive-800 hover:bg-olive-100'
          }
        >
          As soon as possible
        </button>
        <button
          type="button"
          onClick={() => onPickupModeChange('scheduled')}
          className={
            pickupMode === 'scheduled'
              ? 'flex-1 rounded-full bg-moss px-4 py-2 text-sm font-medium text-cream-50'
              : 'flex-1 rounded-full border border-olive-300 px-4 py-2 text-sm font-medium text-olive-800 hover:bg-olive-100'
          }
        >
          Pick a time
        </button>
      </div>

      {pickupMode === 'asap' && (
        <p className="mt-3 text-sm text-olive-700">
          {availability.earliestAsapIso
            ? `Ready around ${formatIso(availability.earliestAsapIso)}.`
            : "We're slammed right now — no pickup times left today. Try scheduling for tomorrow."}
        </p>
      )}

      {pickupMode === 'scheduled' && (
        <div className="mt-3">
          {availability.slotsToday.length === 0 ? (
            <p className="text-sm text-olive-700">No times left today.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availability.slotsToday.map((slot) => (
                <button
                  key={slot.startIso}
                  type="button"
                  disabled={slot.isFull}
                  onClick={() => onSelectSlot(slot.startIso)}
                  className={
                    selectedSlotIso === slot.startIso
                      ? 'rounded-full border border-moss bg-moss px-4 py-2 text-sm font-medium text-cream-50'
                      : 'rounded-full border border-olive-300 px-4 py-2 text-sm font-medium text-olive-800 hover:bg-olive-50 disabled:cursor-not-allowed disabled:opacity-40'
                  }
                >
                  {slot.label}
                  {slot.isFull && ' · Full'}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
