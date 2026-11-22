import { useEffect, useRef, useState } from 'react';
import { getOrderingClient } from '../../lib/ordering/client';
import { OrderingError, type AvailabilityDto, type CartLine, type OrderingErrorCode } from '../../lib/ordering/types';
import CartPanel from './CartPanel';
import MenuGrid from './MenuGrid';
import ReviewStep from './ReviewStep';
import WhoAndWhen, { type WhoAndWhenValue } from './WhoAndWhen';

type Step = 'menu' | 'details' | 'review';

const EMPTY_WHO: WhoAndWhenValue = {
  name: '',
  phoneRaw: '',
  email: '',
  note: '',
  pickupMode: 'asap',
  pickupSlotIso: null,
};

export default function OrderApp() {
  const [step, setStep] = useState<Step>('menu');
  const [lines, setLines] = useState<CartLine[]>([]);
  const [who, setWho] = useState<WhoAndWhenValue>(EMPTY_WHO);
  const [availability, setAvailability] = useState<AvailabilityDto | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorCode, setErrorCode] = useState<OrderingErrorCode | null>(null);
  const idempotencyKey = useRef(crypto.randomUUID());

  function refreshAvailability() {
    getOrderingClient()
      .getAvailability()
      .then(setAvailability)
      .catch(() => setAvailability(null));
  }

  useEffect(refreshAvailability, []);

  function addLine(line: CartLine) {
    setLines((prev) => [...prev, line]);
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  function goToDetails() {
    refreshAvailability();
    setStep('details');
  }

  function goToReview() {
    refreshAvailability();
    setErrorCode(null);
    setStep('review');
  }

  const resolvedPickupIso =
    who.pickupMode === 'asap' ? availability?.earliestAsapIso ?? null : who.pickupSlotIso;

  async function handleSubmit() {
    setIsSubmitting(true);
    setErrorCode(null);
    try {
      const order = await getOrderingClient().createOrder({
        idempotencyKey: idempotencyKey.current,
        lines,
        customerName: who.name,
        phoneRaw: who.phoneRaw,
        email: who.email || undefined,
        note: who.note || undefined,
        pickupMode: who.pickupMode,
        pickupSlotIso: who.pickupMode === 'scheduled' ? who.pickupSlotIso ?? undefined : undefined,
      });
      window.location.href = `/order/status?token=${order.token}`;
    } catch (err) {
      if (err instanceof OrderingError) {
        setErrorCode(err.code);
        if (err.code === 'SlotFull' || err.code === 'SlotPast') {
          refreshAvailability();
        }
      } else {
        setErrorCode('Network');
      }
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      {step === 'menu' && (
        <div className="space-y-8">
          <MenuGrid onAdd={addLine} />
          <CartPanel lines={lines} onRemove={removeLine} onContinue={goToDetails} />
        </div>
      )}

      {step === 'details' && (
        <WhoAndWhen
          value={who}
          availability={availability}
          onChange={setWho}
          onBack={() => setStep('menu')}
          onContinue={goToReview}
        />
      )}

      {step === 'review' && (
        <ReviewStep
          lines={lines}
          who={who}
          resolvedPickupIso={resolvedPickupIso}
          isSubmitting={isSubmitting}
          errorCode={errorCode}
          onEditCart={() => setStep('menu')}
          onEditDetails={() => setStep('details')}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
