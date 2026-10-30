// Lets search engines crawl the public pages; account pages stay out.
export default function robots() {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/wallet", "/history", "/profile", "/settings", "/admin", "/success", "/payment/", "/verify-email", "/reset-password", "/buy-data", "/buy-airtime"] }],
    sitemap: "https://escriptpay.com/sitemap.xml",
    host: "https://escriptpay.com",
  };
}
