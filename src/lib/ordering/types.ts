export type OrderStatus = 'Confirmed' | 'InProgress' | 'Ready' | 'PickedUp' | 'Canceled' | 'NoShow';

export type CancelReason = 'Customer' | 'Shop' | 'Capacity';

export type SelectedModifier = {
  groupSlug: string;
  optionSlug: string;
  name: string;
  priceDeltaCents: number;
};

export type CartLine = {
  id: string;
  itemSlug: string;
  name: string;
  unitBasePriceCents: number;
  prepUnits: number;
  quantity: number;
  modifiers: SelectedModifier[];
};

export type OrderItemDto = {
  itemSlug: string;
  name: string;
  quantity: number;
  unitBasePriceCents: number;
  lineTotalCents: number;
  modifiers: SelectedModifier[];
};

export type OrderDto = {
  reference: string;
  token: string;
  status: OrderStatus;
  items: OrderItemDto[];
  subtotalCents: number;
  customerName: string;
  phoneE164: string;
  phoneDisplay: string;
  email?: string;
  note?: string;
  isScheduled: boolean;
  pickupAtIso: string;
  createdAtIso: string;
  cancelReason?: CancelReason;
};

export type PickupSlotDto = {
  startIso: string;
  label: string;
  isFull: boolean;
};

export type AvailabilityDto = {
  isShopOpen: boolean;
  isAcceptingOrders: boolean;
  isOrderingPaused: boolean;
  earliestAsapIso?: string;
  slotsToday: PickupSlotDto[];
  slotsTomorrow: PickupSlotDto[];
};

export type OrderingErrorCode =
  | 'ShopClosed'
  | 'OrderingPaused'
  | 'SlotFull'
  | 'SlotPast'
  | 'ItemUnavailable'
  | 'InvalidPhone'
  | 'TooManyOpenOrders'
  | 'NotFound'
  | 'Network';

export class OrderingError extends Error {
  code: OrderingErrorCode;

  constructor(code: OrderingErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'OrderingError';
  }
}

export type AdminSettingsDto = {
  onlineOrderingEnabled: boolean;
};

export type MenuItemAvailabilityDto = {
  slug: string;
  name: string;
  categorySlug: string;
  isSoldOut: boolean;
};

export type CreateOrderRequest = {
  idempotencyKey: string;
  lines: CartLine[];
  customerName: string;
  phoneRaw: string;
  email?: string;
  note?: string;
  pickupMode: 'asap' | 'scheduled';
  pickupSlotIso?: string;
};
