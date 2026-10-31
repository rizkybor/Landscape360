import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Loader2, X, XCircle } from "lucide-react";
import { fetchOrderStatus, parsePaymentReturn, type OrderStatus } from "../lib/payments";
import { useSurveyStore } from "../store/useSurveyStore";

const clearParam = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete("payment");
  url.searchParams.delete("order_id");
  url.searchParams.delete("status_code");
  url.searchParams.delete("transaction_status");
  window.history.replaceState(null, "", url.pathname + url.search + url.hash);
};

// Back from Midtrans's payment page (/?payment=<order id>): shows whether the payment went
// through, and reloads the plan when it did. A payment still pending (e.g. a bank transfer not
// made yet) is checked again a few times.
export const PaymentReturn = () => {
  const [orderId] = useState(() => parsePaymentReturn(window.location.search));
  const user = useSurveyStore((s) => s.user);
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (!orderId || !user) return;
    let cancelled = false;
    let tries = 0;
    const check = async () => {
      try {
        const o = await fetchOrderStatus(orderId);
        if (cancelled) return;
        setOrder(o);
        if (o.status === "paid") await useSurveyStore.getState().loadUserProfile();
        else if (o.status === "pending" && ++tries < 6) setTimeout(check, 5000);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [orderId, user]);

  if (!orderId || closed) return null;

  const close = () => {
    clearParam();
    setClosed(true);
  };
  const until = order?.periodEnd ? new Date(order.periodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;
  const [Icon, tone, text] = error
    ? [XCircle, "text-brick-600", error]
    : !user
      ? [Clock, "text-sand-700", "Sign in to see your payment."]
      : !order
        ? [Loader2, "text-sand-700", "Checking your payment…"]
        : order.status === "paid"
          ? [CheckCircle2, "text-forest-700", `Payment received. Your plan is active${until ? ` until ${until}` : ""}.`]
          : order.status === "pending"
            ? [Clock, "text-gold-800", "Waiting for your payment. Your plan starts as soon as it arrives."]
            : order.status === "refunded"
              ? [XCircle, "text-brick-600", "This payment was refunded."]
              : [XCircle, "text-brick-600", `The payment ${order.status === "expired" ? "expired" : "did not go through"}. Your plan has not changed.`];

  return (
    <div role="status" className="fixed z-[70] top-4 left-1/2 -translate-x-1/2 w-[min(360px,calc(100vw-2rem))] flex items-start gap-2 rounded-xl bg-white border border-sand-200 shadow-xl px-3 py-2.5 text-xs text-ink">
      <Icon size={16} className={`${tone} shrink-0 mt-px ${!order && !error && user ? "animate-spin" : ""}`} />
      <span className={`flex-1 font-semibold ${tone}`}>{text}</span>
      <button onClick={close} className="cursor-pointer p-0.5 rounded hover:bg-sand-100 text-sand-500" aria-label="Close">
        <X size={14} />
      </button>
    </div>
  );
};
