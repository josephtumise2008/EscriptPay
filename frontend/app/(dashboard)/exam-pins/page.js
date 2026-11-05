import ExamForm from "@/components/bills/ExamForm";

export const metadata = { title: "Exam PINs" };

export default function Page() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">Exam PINs</h1>
        <p className="mt-1.5 hidden text-sm text-ink-500 sm:block sm:text-base">WAEC result checker and JAMB PINs, delivered instantly.</p>
      </header>
      <ExamForm />
    </div>
  );
}
