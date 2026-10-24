// Lets phones add EscriptPay to the home screen with its own icon.
export default function manifest() {
  return {
    name: "EscriptPay",
    short_name: "EscriptPay",
    description: "Cheaper data. Instant airtime.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0b1124",
    theme_color: "#6d28d9",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
