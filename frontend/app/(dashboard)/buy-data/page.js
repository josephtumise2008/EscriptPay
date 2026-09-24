import BuyForm from "@/components/BuyForm";
import TestModeBadge from "@/components/TestModeBadge";

export const metadata = { title: "Buy Data" };

export default function BuyDataPage() {
  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
              Buy Data
            </h1>
            <p className="mt-1.5 text-sm text-ink-500 sm:text-base">
              Select a network, choose a bundle, and enter the number to top up.
            </p>
          </div>
          <TestModeBadge />
        </div>
      </header>
      <BuyForm />
    </div>
  );
}