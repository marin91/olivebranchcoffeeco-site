// Seam for swapping the mock for a real /api-backed client once the backend
// exists. Every component depends on this module, not on mockClient directly.
import { createMockOrderingClient, type OrderingClient } from './mockClient';

export type { OrderingClient } from './mockClient';

let client: OrderingClient | null = null;

export function getOrderingClient(): OrderingClient {
  if (!client) client = createMockOrderingClient();
  return client;
}
