/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Hide the dev-only Next.js "N" badge; it covered page content on mobile.
  // (It never appears in production builds.)
  devIndicators: false,
};

export default nextConfig;