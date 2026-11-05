import CableForm from "@/components/bills/CableForm";

export const metadata = { title: "Cable TV" };

export default function Page() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">Cable TV</h1>
        <p className="mt-1.5 hidden text-sm text-ink-500 sm:block sm:text-base">Renew DStv, GOtv or StarTimes, a little cheaper than usual when you pay from your wallet.</p>
      </header>
      <CableForm />
    </div>
  );
}
