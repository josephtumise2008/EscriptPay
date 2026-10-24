import LegalPage from "@/components/LegalPage";
import { BUSINESS } from "@/lib/data";

export const metadata = {
  title: "Privacy Policy — EscriptPay",
  description: "How EscriptPay collects, uses and protects your personal data.",
};

const sections = [
  {
    id: "who",
    title: "Who we are",
    body: (
      <p>
        {BUSINESS.name} is operated by {BUSINESS.owner}, {BUSINESS.location}. We are responsible for the personal data
        described here. Contact: {BUSINESS.supportEmail}.
      </p>
    ),
  },
  {
    id: "collect",
    title: "What we collect",
    body: (
      <ul>
        <li><strong>Account details:</strong> your name, email address, phone number, state (optional) and a securely hashed password.</li>
        <li><strong>Orders:</strong> the network, plan or amount, recipient phone number, price, status and references for each purchase, and your wallet activity.</li>
        <li><strong>Messages:</strong> what you send us through the contact form.</li>
        <li><strong>Technical data:</strong> basic information needed to run and secure the service, such as your IP address for rate-limiting and logs kept by our hosting provider.</li>
      </ul>
    ),
  },
  {
    id: "not-collect",
    title: "What we don't collect",
    body: (
      <p>
        We never receive or store your full card number, CVV, PIN or bank login. Payments are entered on Paystack&apos;s
        secure checkout.
      </p>
    ),
  },
  {
    id: "use",
    title: "How we use it",
    body: (
      <ul>
        <li>To create and secure your account, including sending verification codes and password reset emails.</li>
        <li>To process payments, deliver airtime and data, issue receipts and handle refunds.</li>
        <li>To answer your messages and resolve issues with orders.</li>
        <li>To prevent fraud and keep the service safe, and to meet legal and accounting obligations.</li>
      </ul>
    ),
  },
  {
    id: "share",
    title: "Who we share it with",
    body: (
      <>
        <p>We only share what each partner needs to provide its service to us:</p>
        <ul>
          <li><strong>Paystack</strong> — processes your payments (your email and payment amount).</li>
          <li><strong>Our airtime and data supplier</strong> — receives the recipient phone number, network and order to deliver it.</li>
          <li><strong>Hosting and database providers</strong> (Vercel, MongoDB Atlas) — store and run the service.</li>
          <li><strong>Email provider</strong> — sends verification codes and account emails.</li>
          <li>Authorities, where the law requires it.</li>
        </ul>
        <p>We do not sell your personal data.</p>
      </>
    ),
  },
  {
    id: "keep",
    title: "How long we keep it",
    body: (
      <p>
        We keep your account details while your account is open. Order and payment records are kept for as long as needed
        for accounting, tax, dispute and legal purposes. Verification codes and password reset links expire within an hour
        and are stored only in scrambled (hashed) form.
      </p>
    ),
  },
  {
    id: "rights",
    title: "Your rights",
    body: (
      <p>
        Under the Nigeria Data Protection Act 2023 you can ask to see the personal data we hold about you, correct it,
        delete it (where we don&apos;t need to keep it by law), or object to how we use it. Email {BUSINESS.supportEmail}{" "}
        from the address on your account. You can also complain to the Nigeria Data Protection Commission.
      </p>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and storage",
    body: (
      <p>
        We use one essential cookie to keep you signed in, and your browser&apos;s local storage to remember preferences
        such as light/dark theme and whether your balance is hidden. We don&apos;t use advertising cookies.
      </p>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>
        Passwords are hashed, sessions use a secure httpOnly cookie, connections are encrypted (HTTPS), and payments are
        verified on our server before any order is processed. No system is perfectly secure, so please use a strong,
        unique password.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      current="/privacy"
      intro="This policy explains what personal data EscriptPay collects, why, who we share it with and the choices you have."
      sections={sections}
    />
  );
}
