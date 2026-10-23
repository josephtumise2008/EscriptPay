import AirtimeForm from "@/components/AirtimeForm";

export const metadata = { title: "Buy Airtime" };

export default async function BuyAirtimePage({ searchParams }) {
  const sp = await (searchParams ?? {});
  const network = typeof sp.network === "string" ? sp.network : "";
  const amount = typeof sp.amount === "string" ? sp.amount : "";

  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
              Buy Airtime
            </h1>
            <p className="mt-1.5 hidden text-sm text-ink-500 sm:block sm:text-base">
              Recharge any Nigerian number on MTN, Airtel, Glo or 9mobile.
            </p>
          </div>
        </div>
      </header>

      <AirtimeForm initialNetwork={network} initialAmount={amount} />
    </div>
  );
}