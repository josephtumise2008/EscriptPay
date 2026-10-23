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

export const metadata = {
  title: {
    default: "EscriptPay — Buy Data. Stay Connected.",
    template: "%s | EscriptPay",
  },
  description:
    "Fast, simple and reliable data and airtime purchases in Nigeria with EscriptPay.",
  keywords: ["EscriptPay", "buy data", "airtime", "Nigeria", "fintech"],
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