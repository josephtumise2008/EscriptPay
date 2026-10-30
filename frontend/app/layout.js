import { Inter, Sora } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { WalletProvider } from "@/lib/wallet-context";
import ThemeProvider from "@/components/ThemeProvider";
import AppSplash from "@/components/AppSplash";
import { SPLASH_CSS, SPLASH_SCRIPT } from "@/lib/splash";
import { InstallSheetHost } from "@/components/InstallApp";
import { PwaRegister } from "@/lib/pwa";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

const SITE_URL = "https://escriptpay.com";

// [css width, css height, pixel ratio] of iPhones and iPads, portrait.
const DEVICES = [
  [440, 956, 3], [402, 874, 3], [430, 932, 3], [393, 852, 3], [428, 926, 3], [390, 844, 3],
  [375, 812, 3], [414, 896, 3], [414, 896, 2], [414, 736, 3], [375, 667, 2], [320, 568, 2],
  [1024, 1366, 2], [834, 1194, 2], [820, 1180, 2], [768, 1024, 2],
];
const STARTUP_IMAGES = [
  ...DEVICES.map(([w, h, r]) => ({
    url: `/splash/launch-${w * r}x${h * r}.png`,
    media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r})`,
  })),
  // Fallback for any other screen size.
  { url: "/splash/launch-1179x2556.png" },
];
const TITLE = "EscriptPay — Cheaper data. Instant airtime.";
const DESCRIPTION =
  "Buy MTN, Airtel, Glo and 9mobile data and airtime in seconds. Fund your wallet once and buy in one tap, with a receipt for every order.";

const STRUCTURED_DATA = [
  { "@context": "https://schema.org", "@type": "WebSite", name: "EscriptPay", alternateName: "EscriptPay.com", url: `${SITE_URL}/` },
  { "@context": "https://schema.org", "@type": "Organization", name: "EscriptPay", url: `${SITE_URL}/`, logo: `${SITE_URL}/icons/icon-512.png` },
];

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s | EscriptPay",
  },
  description: DESCRIPTION,
  applicationName: "EscriptPay",
  keywords: ["EscriptPay", "buy data", "cheap data", "airtime", "MTN", "Airtel", "Glo", "9mobile", "Nigeria"],
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "EscriptPay",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_NG",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  appleWebApp: {
    title: "EscriptPay",
    capable: true,
    statusBarStyle: "black-translucent",
    // iPhone/iPad launch screens (otherwise iOS shows white while the app opens).
    startupImage: STARTUP_IMAGES,
  },
  formatDetection: { telephone: false },
  // iOS only uses the launch screens (and full-screen mode) with this tag;
  // Next.js now writes the newer "mobile-web-app-capable" name only.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport = {
  // Draw to the very edges of iPhones. Chrome on iPhone otherwise leaves a
  // strip under the bottom tab bar where the page scrolls through. Headers
  // and the page sit below the status bar only in the installed app
  // (--top-inset in globals.css), so nothing jumps in the browser.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1124" },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} ${sora.variable}`} suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: SPLASH_CSS }} />
        {/* Tells Google the site name and logo for search results. */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }} />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var d=document.documentElement;d.classList.add("js");try{var p=localStorage.getItem("escriptpay-theme");var t=(p==="light"||p==="dark")?p:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");d.classList.toggle("dark",t==="dark");d.style.colorScheme=t;}catch(e){}
${SPLASH_SCRIPT}
window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__epInstall=e;window.dispatchEvent(new Event("ep-installable"));});
})();`,
          }}
        />
      </head>
      <body>
        <AppSplash />
        <ThemeProvider>
          <AuthProvider>
            <WalletProvider>{children}</WalletProvider>
            <InstallSheetHost />
          </AuthProvider>
        </ThemeProvider>
        <PwaRegister />
      </body>
    </html>
  );
}