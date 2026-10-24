// Animated hero backdrop: "airtime flowing" — drifting colour glows, signal
// waves streaming across, broadcast rings pulsing out, and little data
// packets (₦, GB, 4G, network dots) rising through the page.
//
// Pure CSS/SVG (transform + opacity only, GPU-friendly, no video download).
// Everything stops for people who prefer reduced motion (globals.css).
// Positions are fixed numbers, so server and browser render the same markup.

const PACKETS = [
  { x: 6, delay: 0, dur: 13, label: "₦", tone: "violet" },
  { x: 14, delay: 4.5, dur: 16, label: "1GB", tone: "sky" },
  { x: 23, delay: 8, dur: 12, dot: "bg-yellow-400" },
  { x: 31, delay: 2, dur: 15, label: "4G", tone: "violet" },
  { x: 42, delay: 10, dur: 14, dot: "bg-red-500" },
  { x: 51, delay: 6, dur: 17, label: "₦", tone: "sky" },
  { x: 60, delay: 1, dur: 13, dot: "bg-emerald-500" },
  { x: 68, delay: 7.5, dur: 15, label: "2GB", tone: "violet" },
  { x: 76, delay: 3, dur: 12, dot: "bg-lime-500" },
  { x: 84, delay: 9, dur: 16, label: "₦", tone: "sky" },
  { x: 92, delay: 5, dur: 14, label: "5G", tone: "violet" },
  { x: 47, delay: 12, dur: 18, label: "500MB", tone: "sky" },
];

// Gentle, low waves in a thin band (viewBox units: 1200 x 100).
const WAVES = [
  { y: 50, amp: 14, dur: 14, opacity: 0.45, width: 1.75, grad: "wave-a" },
  { y: 56, amp: 10, dur: 19, opacity: 0.3, width: 1.25, grad: "wave-b" },
  { y: 44, amp: 8, dur: 23, opacity: 0.22, width: 1, grad: "wave-a" },
];

// One period-repeating sine path, 2400 wide so it can slide by 1200 seamlessly.
const wavePath = (y, amp) => {
  const period = 600;
  let d = `M 0 ${y}`;
  for (let x = 0; x < 2400; x += period) {
    d += ` Q ${x + period / 4} ${y - amp} ${x + period / 2} ${y} T ${x + period} ${y}`;
  }
  return d;
};

export default function HeroBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Drifting colour glows */}
      <div className="hero-blob absolute -left-24 -top-32 h-[26rem] w-[26rem] rounded-full bg-violet-500/30 blur-3xl" />
      <div className="hero-blob absolute -right-28 top-16 h-[24rem] w-[24rem] rounded-full bg-sky-400/30 blur-3xl" style={{ animationDelay: "-6s", animationDuration: "22s" }} />
      <div className="hero-blob absolute left-1/3 top-[45%] h-[20rem] w-[20rem] rounded-full bg-indigo-500/20 blur-3xl" style={{ animationDelay: "-11s", animationDuration: "26s" }} />

      {/* Faint grid */}
      <div className="hero-grid absolute inset-0" />

      {/* Broadcast rings */}
      <div className="absolute left-1/2 top-[78%] -translate-x-1/2 -translate-y-1/2 lg:left-[72%] lg:top-1/2">
        {[0, 1.6, 3.2].map((d) => (
          <span
            key={d}
            className="hero-ring absolute left-1/2 top-1/2 h-[16rem] w-[16rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet-400/25 sm:h-[22rem] sm:w-[22rem] sm:border-violet-400/35"
            style={{ animationDelay: `${d}s` }}
          />
        ))}
      </div>

      {/* Signal waves streaming across */}
      <svg
        className="hero-waves absolute inset-x-0 top-[46%] h-28 w-full sm:top-[40%] sm:h-40 lg:top-auto lg:bottom-[12%] lg:h-48"
        viewBox="0 0 1200 100"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="wave-a" x1="0" x2="1">
            <stop offset="0" stopColor="#8b5cf6" stopOpacity="0" />
            <stop offset="0.35" stopColor="#8b5cf6" />
            <stop offset="0.7" stopColor="#38bdf8" />
            <stop offset="1" stopColor="#38bdf8" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="wave-b" x1="0" x2="1">
            <stop offset="0" stopColor="#38bdf8" stopOpacity="0" />
            <stop offset="0.4" stopColor="#6366f1" />
            <stop offset="0.75" stopColor="#a78bfa" />
            <stop offset="1" stopColor="#a78bfa" stopOpacity="0" />
          </linearGradient>
        </defs>
        {WAVES.map((w, i) => (
          <g key={i} className="hero-wave" style={{ animationDuration: `${w.dur}s`, animationDirection: i % 2 ? "reverse" : "normal" }}>
            <path
              d={wavePath(w.y, w.amp)}
              fill="none"
              stroke={`url(#${w.grad})`}
              strokeWidth={w.width}
              strokeOpacity={w.opacity}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}
      </svg>

      {/* Rising data packets */}
      {PACKETS.map((p, i) => (
        <span
          key={i}
          className="hero-packet absolute bottom-[-2rem]"
          style={{ left: `${p.x}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }}
        >
          {p.dot ? (
            <span className={`block h-2.5 w-2.5 rounded-full ${p.dot} shadow-[0_0_14px_currentColor] opacity-80`} />
          ) : (
            <span
              className={`block rounded-full px-2 py-0.5 font-display text-[10px] font-bold backdrop-blur-sm ${
                p.tone === "violet"
                  ? "bg-violet-500/15 text-violet-600 ring-1 ring-violet-400/30 dark:text-violet-300"
                  : "bg-sky-400/15 text-sky-600 ring-1 ring-sky-400/30 dark:text-sky-300"
              }`}
            >
              {p.label}
            </span>
          )}
        </span>
      ))}

      {/* Soft fade into the next section */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-slate-50" />
    </div>
  );
}
