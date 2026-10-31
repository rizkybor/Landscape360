import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchProducts, formatRupiah, startCheckout, type PlanProduct } from "../lib/payments";
import { useSurveyStore } from "../store/useSurveyStore";

// Test page for Midtrans payments (sandbox). Only routed when VITE_PAYMENTS_TEST=true, so it is
// not part of the public site; the real pricing page comes later.
export const PaymentsTestPage = () => {
  const { user, subscriptionStatus, userRole } = useSurveyStore();
  const [products, setProducts] = useState<PlanProduct[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts().then(setProducts, (err: Error) => setError(err.message));
  }, []);

  const buy = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      await startCheckout(id);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  };

  return (
    <main className="min-h-screen bg-sand-50 text-ink p-6">
      <div className="max-w-xl mx-auto space-y-4">
        <h1 className="text-lg font-bold">Payments test (Midtrans sandbox)</h1>
        <p className="text-xs text-sand-600">
          Not linked from the site. {user ? `Signed in as ${user.email}: ${subscriptionStatus} · ${userRole}.` : "Sign in on the map first."}{" "}
          <Link to="/" className="underline">Back to the map</Link>
        </p>
        {error && <p className="text-xs font-bold text-brick-600">{error}</p>}
        <ul className="space-y-2">
          {products.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 rounded-lg bg-white border border-sand-200 px-3 py-2 text-sm">
              <span>
                <strong>{p.name}</strong>
                <span className="block text-[11px] text-sand-500">
                  {p.plan} · {p.role} · {p.days} days · {p.id}
                </span>
              </span>
              <button
                onClick={() => buy(p.id)}
                disabled={!user || busy !== null}
                className="cursor-pointer shrink-0 px-3 py-1.5 rounded-lg bg-forest-800 text-white text-xs font-bold disabled:opacity-40"
              >
                {busy === p.id ? "Opening…" : formatRupiah(p.price)}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
};
