// After an order is created the backend either returns a Paystack checkout
// URL (pay first) or, in test mode, a finished transaction.
//
// Only Paystack-hosted HTTPS pages are followed, so a tampered response can
// never send the customer to an arbitrary site.
export const isTrustedCheckoutUrl = (url) => {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "paystack.com" || parsed.hostname.endsWith(".paystack.com"))
    );
  } catch {
    return false;
  }
};

// Paystack's popup checkout (InlineJS v2). Paying inside a popup on our own
// page keeps customers in the app: on an iPhone home-screen app, a full-page
// redirect to Paystack opens Safari and the customer ends up there instead of
// back in EscriptPay.
const PAYSTACK_INLINE_SRC = "https://js.paystack.co/v2/inline.js";
let paystackLoader = null;

const loadPaystack = () => {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.PaystackPop) return Promise.resolve(window.PaystackPop);
  if (!paystackLoader) {
    paystackLoader = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = PAYSTACK_INLINE_SRC;
      script.async = true;
      script.onload = () => (window.PaystackPop ? resolve(window.PaystackPop) : reject(new Error("Paystack did not load")));
      script.onerror = () => {
        paystackLoader = null;
        reject(new Error("Paystack did not load"));
      };
      document.head.appendChild(script);
    });
  }
  return paystackLoader;
};

// Warm the script up (e.g. when a payment form opens) so the popup is instant.
export const preloadCheckout = () => {
  loadPaystack().catch(() => {});
};

// checkout.paystack.com/<access_code>
const accessCodeFrom = (url) => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "checkout.paystack.com") return "";
    const code = parsed.pathname.replace(/^\/+|\/+$/g, "");
    return /^[A-Za-z0-9]+$/.test(code) ? code : "";
  } catch {
    return "";
  }
};

// Opens Paystack as a popup on this page. Falls back to the full Paystack
// page if the popup can't load (the old redirect flow still works).
//   onSuccess(reference) — Paystack says it's paid; we still verify on the server
//   onCancel()           — customer closed the popup
export const openCheckout = async ({ checkoutUrl, accessCode, onSuccess, onCancel }) => {
  if (!isTrustedCheckoutUrl(checkoutUrl)) {
    throw new Error("Unexpected payment page. Please contact support.");
  }
  const code = (typeof accessCode === "string" && /^[A-Za-z0-9]+$/.test(accessCode) && accessCode) || accessCodeFrom(checkoutUrl);
  if (code) {
    try {
      const PaystackPop = await loadPaystack();
      const popup = new PaystackPop();
      popup.resumeTransaction(code, {
        onSuccess: (transaction) => onSuccess && onSuccess(transaction && (transaction.reference || transaction.trxref)),
        onCancel: () => onCancel && onCancel(),
        onError: () => window.location.assign(checkoutUrl),
      });
      return "popup";
    } catch {
      // fall through to the full page
    }
  }
  window.location.assign(checkoutUrl);
  return "redirecting";
};

// After an order is created: pay in the popup (then confirm in-app), or in
// test mode go straight to the order page.
export const continueAfterOrder = (router, data, from = "") => {
  // `from` lets the order page's Back button return to the right form even
  // when the page is reopened later (refresh, shared link).
  const origin = from ? `&from=${encodeURIComponent(from)}` : "";
  const orderPage = `/success?ref=${encodeURIComponent(data.transaction.transactionId)}${origin}`;
  if (data && data.checkoutUrl) {
    const fallbackRef = data.transaction.paymentReference || data.transaction.transactionId;
    return openCheckout({
      checkoutUrl: data.checkoutUrl,
      accessCode: data.accessCode,
      onSuccess: (reference) => router.push(`/payment/callback?reference=${encodeURIComponent(reference || fallbackRef)}`),
      // Closed without paying: the order page shows "Complete payment".
      onCancel: () => router.push(orderPage),
    });
  }
  router.push(orderPage);
  return "done";
};
