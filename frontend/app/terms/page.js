import LegalPage from "@/components/LegalPage";
import { BUSINESS } from "@/lib/data";

export const metadata = {
  title: "Terms of Service — EscriptPay",
  description: "The terms for using EscriptPay to buy airtime and data in Nigeria.",
};

const sections = [
  {
    id: "about",
    title: "About EscriptPay",
    body: (
      <p>
        EscriptPay ({BUSINESS.website}) is an online service operated by {BUSINESS.owner}, trading as {BUSINESS.name},{" "}
        {BUSINESS.location}. It lets you buy mobile airtime and data bundles for MTN, Airtel, Glo and 9mobile numbers in
        Nigeria. By creating an account or making a purchase you agree to these terms.
      </p>
    ),
  },
  {
    id: "account",
    title: "Your account",
    body: (
      <ul>
        <li>You must give accurate details and verify your email address before buying.</li>
        <li>Keep your password private. You are responsible for activity on your account.</li>
        <li>Tell us straight away if you think someone else has accessed your account.</li>
        <li>You must be legally able to enter into a contract to use EscriptPay.</li>
      </ul>
    ),
  },
  {
    id: "orders",
    title: "Orders, prices and payment",
    body: (
      <>
        <ul>
          <li>The price shown at checkout is the price you pay for the bundle or airtime. Prices can change; the price confirmed at checkout applies to that order.</li>
          <li>You can pay by card, bank transfer or USSD through our payment partner, Paystack, or from your EscriptPay wallet.</li>
          <li>Card and bank details are entered on Paystack&apos;s secure checkout. EscriptPay never sees or stores your full card details.</li>
          <li>An order is only processed after the payment is confirmed by our server with the payment provider.</li>
        </ul>
        <p>
          <strong>Check the phone number and network before you pay.</strong> Airtime and data sent to the number you entered
          cannot be taken back. See our Refund Policy for what happens if a mistake is made.
        </p>
      </>
    ),
  },
  {
    id: "delivery",
    title: "Delivery",
    body: (
      <p>
        Orders are fulfilled through licensed airtime and data suppliers and usually arrive within seconds. Sometimes a
        mobile network is slow or unavailable; the order then stays &ldquo;pending&rdquo; while it is retried and checked,
        which can take up to about an hour. Your order history always shows the current status. Data plan validity,
        speed and how bundles are counted are set by the mobile network, not by EscriptPay.
      </p>
    ),
  },
  {
    id: "wallet",
    title: "Wallet",
    body: (
      <ul>
        <li>You can add money to your EscriptPay wallet and use it to pay for purchases on EscriptPay.</li>
        <li>When you fund the wallet by card, transfer or USSD, the payment processing fee is shown and added to the amount you pay, so your wallet receives the full amount you chose.</li>
        <li>The wallet is not a bank account and does not earn interest. Balances cannot be transferred to other users.</li>
        <li>If you would like an unused balance returned, contact us — see the Refund Policy.</li>
      </ul>
    ),
  },
  {
    id: "use",
    title: "Acceptable use",
    body: (
      <ul>
        <li>Don&apos;t use EscriptPay for fraud, with stolen cards or accounts, or to break the law.</li>
        <li>Don&apos;t try to interfere with, overload or get around the security of the service.</li>
        <li>We may pause or close accounts and hold or reverse transactions that we reasonably believe are fraudulent or abusive, and we may report fraud to the relevant authorities.</li>
      </ul>
    ),
  },
  {
    id: "availability",
    title: "Availability and liability",
    body: (
      <p>
        We work to keep EscriptPay available and accurate, but the service depends on mobile networks, payment providers
        and suppliers outside our control, so we can&apos;t promise it will always be uninterrupted. To the extent the law
        allows, our responsibility for any order is limited to delivering it or refunding the amount you paid for it.
        Nothing in these terms limits rights you have under Nigerian consumer protection law.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes and law",
    body: (
      <p>
        We may update these terms; the date at the top shows the latest version, and the version in force when you place
        an order applies to that order. These terms are governed by the laws of the Federal Republic of Nigeria.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      current="/terms"
      intro="Please read these terms before using EscriptPay. They explain how buying airtime and data, payments, the wallet and your account work."
      sections={sections}
    />
  );
}
