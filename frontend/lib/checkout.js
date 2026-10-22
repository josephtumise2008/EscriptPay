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

// Returns "redirecting" when the browser is leaving for checkout.
export const continueAfterOrder = (router, data) => {
  if (data && data.checkoutUrl) {
    if (!isTrustedCheckoutUrl(data.checkoutUrl)) {
      throw new Error("Unexpected payment page. Please contact support.");
    }
    window.location.assign(data.checkoutUrl);
    return "redirecting";
  }
  router.push(`/success?ref=${encodeURIComponent(data.transaction.transactionId)}`);
  return "done";
};
