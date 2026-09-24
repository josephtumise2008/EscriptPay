export default function BackgroundGradient({ className = "" }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden ${className}`}
    >
      <div className="absolute inset-0 bg-[linear-gradient(120deg,#f8fafc_0%,#f0f9ff_45%,#faf5ff_100%)] dark:bg-[linear-gradient(120deg,#0b1120_0%,#0c2036_45%,#1a1440_100%)]" />
      <div className="absolute -top-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-cyan-200/40 blur-3xl" />
      <div className="absolute top-1/3 -right-32 h-[26rem] w-[26rem] rounded-full bg-sky-200/40 blur-3xl" />
      <div className="absolute -bottom-40 left-1/4 h-[24rem] w-[24rem] rounded-full bg-purple-lite-200/40 blur-3xl" />
    </div>
  );
}