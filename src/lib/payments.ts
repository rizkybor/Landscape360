import { authFetch } from './authFetch';

// Paid plans through Midtrans (api/payments.ts). Prepaid per period: each payment adds days to
// the plan. The pricing page is not public yet; these are used by the payment return notice
// and the test page (VITE_PAYMENTS_TEST).

export interface PlanProduct {
  id: string;
  name: string;
  plan: 'Pro' | 'Enterprise';
  role: 'pengguna360' | 'monitor360';
  days: number;
  price: number; // Rupiah
}

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';

export interface OrderStatus {
  orderId: string;
  product: string;
  amount: number;
  status: PaymentStatus;
  periodEnd: string | null;
}

const readError = async (res: Response) => ((await res.json().catch(() => ({}))) as { error?: string }).error ?? `Request failed (${res.status})`;

export const formatRupiah = (amount: number) => `Rp ${amount.toLocaleString('id-ID')}`;

/** What can be bought, with the server's prices */
export const fetchProducts = async (): Promise<PlanProduct[]> => {
  const res = await fetch('/api/payments?products');
  if (!res.ok) throw new Error(await readError(res));
  return ((await res.json()) as { products: PlanProduct[] }).products;
};

/** Creates the order and sends the browser to Midtrans's payment page */
export const startCheckout = async (productId: string) => {
  const res = await authFetch('/api/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product: productId }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const { redirectUrl } = (await res.json()) as { redirectUrl: string };
  window.location.assign(redirectUrl);
};

export const fetchOrderStatus = async (orderId: string): Promise<OrderStatus> => {
  const res = await authFetch(`/api/payments?order=${encodeURIComponent(orderId)}`);
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as OrderStatus;
};

/** The order id in "?payment=" (Midtrans sends the buyer back there), or null */
export const parsePaymentReturn = (search: string): string | null => {
  const id = new URLSearchParams(search).get('payment');
  return id && /^L360-[A-Za-z0-9-]{8,40}$/.test(id) ? id : null;
};
