import LegalPage from "@/components/LegalPage";
import { BUSINESS } from "@/lib/data";

export const metadata = {
  title: "Refund Policy — EscriptPay",
  description: "When and how EscriptPay refunds airtime, data and wallet payments.",
};

const sections = [
  {
    id: "failed",
    title: "Failed orders are refunded",
    body: (
      <ul>
        <li><strong>Paid from your wallet:</strong> if the network or our supplier confirms the order failed, the full amount goes back to your EscriptPay wallet automatically.</li>
        <li><strong>Paid by card, transfer or USSD:</strong> if the order is confirmed as failed, we refund the amount to your original payment method through Paystack. We start the refund as soon as the failure is confirmed; your bank decides how long it takes to show (often a few business days).</li>
        <li>You don&apos;t need to do anything for a confirmed failed order, but you can contact us if you haven&apos;t seen your refund.</li>
      </ul>
    ),
  },
  {
    id: "pending",
    title: "Pending orders",
    body: (
      <p>
        If a network is slow, an order can stay &ldquo;pending&rdquo; while it is retried and checked — usually minutes,
        occasionally up to about an hour. Please don&apos;t pay again for the same order while it is pending. Once the final
        result is known, the order is either delivered or refunded as above.
      </p>
    ),
  },
  {
    id: "delivered",
    title: "Delivered orders",
    body: (
      <ul>
        <li>Airtime and data that were successfully delivered to the number you entered cannot be refunded or reversed — this is how mobile networks work.</li>
        <li><strong>Wrong number:</strong> please double-check before paying. If you sent to the wrong number, contact us immediately; we&apos;ll ask the supplier, but we can&apos;t promise a reversal.</li>
        <li>Questions about data speed, coverage or how a network counts usage need to go to the mobile network.</li>
      </ul>
    ),
  },
  {
    id: "wallet",
    title: "Unused wallet balance",
    body: (
      <p>
        You can ask for an unused wallet balance to be returned by emailing {BUSINESS.supportEmail} from the address on
        your account. We&apos;ll confirm your identity and send it back to your original payment method or a bank account in
        your name.
      </p>
    ),
  },
  {
    id: "charged-twice",
    title: "Charged but no order, or charged twice",
    body: (
      <p>
        Every payment is matched to exactly one order on our server. If you were debited but don&apos;t see the order — or
        believe you were charged twice — email us your transaction ID (starts with ESCP-), the amount and the date. We&apos;ll
        check with Paystack and either complete the order or refund it.
      </p>
    ),
  },
  {
    id: "how",
    title: "How to ask for help",
    body: (
      <p>
        Email {BUSINESS.supportEmail} or use the contact form within 30 days of the order, with your transaction ID. We aim
        to reply within one business day.
      </p>
    ),
  },
];

export default function RefundsPage() {
  return (
    <LegalPage
      title="Refund Policy"
      current="/refunds"
      intro="We want every order to arrive. When it doesn't, here's exactly what happens to your money."
      sections={sections}
    />
  );
}
