import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { BUSINESS } from "@/lib/data";

const PAGES = [
  { href: "/terms", label: "Terms of service" },
  { href: "/privacy", label: "Privacy policy" },
  { href: "/refunds", label: "Refund policy" },
];

// Shared layout for the legal pages: readable column, section anchors.
export default function LegalPage({ title, intro, current, sections }) {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        <nav aria-label="Legal pages" className="no-scrollbar -mx-4 mb-8 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {PAGES.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              aria-current={p.href === current ? "page" : undefined}
              className={`focus-ring shrink-0 rounded-full px-4 py-2 text-xs font-semibold ${
                p.href === current ? "bg-ink-900 text-white dark:bg-cyan-500 dark:text-[#ffffff]" : "bg-white text-ink-600 ring-1 ring-slate-200 hover:text-ink-900"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </nav>

        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-ink-500">Last updated: {BUSINESS.policiesUpdated}</p>
        <p className="mt-6 text-base leading-relaxed text-ink-600">{intro}</p>

        <ol className="mt-8 space-y-8">
          {sections.map((s, i) => (
            <li key={s.title} id={s.id} className="scroll-mt-24">
              <h2 className="font-display text-lg font-bold text-ink-900">
                {i + 1}. {s.title}
              </h2>
              <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-600 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
                {s.body}
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-12 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-ink-600">
          Questions? Email{" "}
          <a href={`mailto:${BUSINESS.supportEmail}`} className="font-semibold text-cyan-700 hover:underline">
            {BUSINESS.supportEmail}
          </a>{" "}
          or use the <Link href="/#contact" className="font-semibold text-cyan-700 hover:underline">contact form</Link>.
          Please include your transaction ID (starts with ESCP-) for anything about an order.
        </div>
      </main>
      <Footer />
    </>
  );
}
