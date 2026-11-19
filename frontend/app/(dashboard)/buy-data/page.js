import { Suspense } from "react";
import { BuyDataFromUrl } from "@/components/FormsFromUrl";

export const metadata = { title: "Buy Data" };

export default function BuyDataPage() {

  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
              Buy Data
            </h1>
            <p className="mt-1.5 hidden text-sm text-ink-500 sm:block sm:text-base">
              Select a network, choose a bundle, and enter the number to top up.
            </p>
          </div>
        </div>
      </header>
      <Suspense fallback={<FormSkeleton />}>
        <BuyDataFromUrl />
      </Suspense>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]" aria-hidden="true">
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-14 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}
