// Lets phones add EscriptPay to the home screen with its own icon.
export default function manifest() {
  return {
    id: "/",
    name: "EscriptPay — Data & Airtime",
    short_name: "EscriptPay",
    description: "Cheaper data. Instant airtime.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    categories: ["finance", "utilities"],
    background_color: "#0b1124",
    theme_color: "#0b1124",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Buy data", url: "/buy-data", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Buy airtime", url: "/buy-airtime", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Wallet", url: "/wallet", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
