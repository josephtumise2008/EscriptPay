import AirtimeForm from "@/components/AirtimeForm";
import TestModeBadge from "@/components/TestModeBadge";

export const metadata = { title: "Buy Airtime" };

export default function BuyAirtimePage() {
  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
              Buy Airtime
            </h1>
            <p className="mt-1.5 text-sm text-ink-500 sm:text-base">
              Recharge any Nigerian number on MTN, Airtel, Glo or 9mobile.
            </p>
          </div>
          <TestModeBadge />
        </div>
      </header>

      <AirtimeForm />
    </div>
  );
}