import ElectricityForm from "@/components/bills/ElectricityForm";

export const metadata = { title: "Electricity" };

export default function Page() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">Electricity</h1>
        <p className="mt-1.5 hidden text-sm text-ink-500 sm:block sm:text-base">Buy prepaid tokens or pay postpaid bills for any electricity company.</p>
      </header>
      <ElectricityForm />
    </div>
  );
}
