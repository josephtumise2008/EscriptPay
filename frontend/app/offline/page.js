import Logo from "@/components/Logo";

export const metadata = { title: "You're offline" };

// Shown by the service worker when the phone has no connection.
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <Logo size={44} />
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900">You&apos;re offline</h1>
      <p className="max-w-xs text-sm text-ink-500">
        Check your internet connection and try again. Nothing was charged while you were offline.
      </p>
      <a
        href="/dashboard"
        className="gradient-btn focus-ring inline-flex h-12 items-center justify-center rounded-2xl px-6 text-sm font-bold brand-contrast"
      >
        Try again
      </a>
    </main>
  );
}
