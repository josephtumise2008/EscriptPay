import { Inter, Sora } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { WalletProvider } from "@/lib/wallet-context";
import ThemeProvider from "@/components/ThemeProvider";
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
const TITLE = "EscriptPay — Cheaper data. Instant airtime.";
const DESCRIPTION =
  "Buy MTN, Airtel, Glo and 9mobile data and airtime in seconds. Fund your wallet once and buy in one tap, with a receipt for every order.";

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
  appleWebApp: { title: "EscriptPay", capable: true, statusBarStyle: "black-translucent" },
};

export const viewport = {
  // Lets the bottom tab bar reach the bottom edge of iPhones (behind the home
  // indicator) instead of leaving a strip where the page shows through.
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
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var d=document.documentElement;d.classList.add("js");try{var p=localStorage.getItem("escriptpay-theme");var t=(p==="light"||p==="dark")?p:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");d.classList.toggle("dark",t==="dark");d.style.colorScheme=t;}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <WalletProvider>{children}</WalletProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}