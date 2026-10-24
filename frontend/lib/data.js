// ------------------------------------------------------------------
// STATIC CONTENT (FAQ + contact details)
// ------------------------------------------------------------------
// Only statements the product actually supports today. Plans, prices and
// transactions always come from the backend.

export const FAQ_ITEMS = [
  {
    question: "Is EscriptPay live yet?",
    answer:
      "Not yet. EscriptPay is currently in test mode: you can create an account and place orders to try the full flow, but no money is charged and no data or airtime is delivered. The site will clearly say when real purchases are switched on.",
  },
  {
    question: "Which networks can I buy for?",
    answer:
      "MTN, Airtel, Glo and 9mobile. Data bundles are listed per network with their price and validity, and airtime can be bought in any whole amount from ₦100 to ₦10,000.",
  },
  {
    question: "How will I pay?",
    answer:
      "Payments will go through a secure hosted checkout. EscriptPay never asks for or stores your card details. Your order is only processed after our server has confirmed the payment with the payment provider — a browser redirect alone is never treated as proof of payment.",
  },
  {
    question: "Is the price I see the price I pay?",
    answer:
      "Yes. Prices are set on our server and shown before you confirm. The amount is calculated on the server for every order, so it cannot be changed from your browser.",
  },
  {
    question: "How do I know what happened to my order?",
    answer:
      "Every order gets a transaction ID and a receipt. Your transaction history shows whether payment and delivery are pending, successful or failed, so you never have to guess.",
  },
  {
    question: "Can I share my data with my friends?",
    answer:
      "Plans marked 'Share' are bundles your network lets you share or gift to other numbers on the same network. Plans without the Share tag are for use on the receiving line only. Exact sharing rules are set by each network.",
  },
  {
    question: "Will this data plan work with my device?",
    answer:
      "Data is added to the phone number you enter, so it works on any device using that SIM — phones, tablets, MiFi or hotspots — as long as the line is active on the network you selected.",
  },
  {
    question: "How long does the data last?",
    answer:
      "Each plan shows its validity (for example 1 day, 7 days or 30 days) before you buy. Expiry, rollover and stacking rules are set by your network provider.",
  },
  {
    question: "How can I check my data balance?",
    answer:
      "Use your network's official balance-check code or app. Your network will usually also send a confirmation SMS once data or airtime arrives.",
  },
  {
    question: "Can I resell EscriptPay products?",
    answer:
      "A reseller program is planned but not available yet. It will be announced on this site once it opens.",
  },
];

// Contact details. `published: false` means the values below are NOT real
// support channels yet: the site labels them as placeholders and the contact
// form stays disabled. Replace the values and set `published: true` once the
// official support email/phone exist.
export const CONTACT = {
  published: false,
  email: "support@escriptpay.com",
  phone: "+234 800 000 0000",
  hours: "To be announced",
};

// Business details used on the Terms, Privacy and Refund pages. The support
// email is the one registered as EscriptPay's support contact with Paystack.
export const BUSINESS = {
  name: "EscriptPay",
  owner: "Abimbade Joseph Onaopemiposi",
  location: "Ibadan, Oyo State, Nigeria",
  supportEmail: "joseescript@gmail.com",
  website: "https://escriptpay.com",
  policiesUpdated: "24 October 2026",
};

// Kept for any older imports.
export const CONTACT_PLACEHOLDERS = {
  email: `${CONTACT.email} (placeholder)`,
  phone: `${CONTACT.phone} (placeholder)`,
  supportHours: CONTACT.hours,
};

// Optional hero photo for the homepage. Put the image file in
// frontend/public/images/ and set `src` (e.g. "/images/hero-customer.jpg").
// While `src` is empty the hero shows the live price list in a phone frame.
// Use a photo you own or have the rights to; it is decorative, not a customer
// testimonial.
export const HERO_PHOTO = {
  src: "",
  alt: "Smiling customer buying mobile data on EscriptPay with a smartphone",
};
