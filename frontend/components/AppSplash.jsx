// Launch screen shown when EscriptPay is opened from the home screen or as an
// installed app. Plain HTML + inline CSS (lib/splash.js) so it paints with the
// first HTML, before React or the stylesheet load. Hidden in the browser.
export default function AppSplash() {
  return (
    <div id="ep-splash" aria-hidden="true" className="ep-splash">
      <div className="ep-splash-glow" />
      <div className="ep-splash-mark">
        <svg className="ep-splash-ring" viewBox="0 0 120 120" fill="none">
          <defs>
            <linearGradient id="ep-splash-ring-grad" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
              <stop stopColor="#a78bfa" />
              <stop offset="0.5" stopColor="#818cf8" />
              <stop offset="1" stopColor="#38bdf8" />
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" r="56" stroke="rgb(255 255 255 / 0.08)" strokeWidth="2" />
          <circle className="ep-splash-arc" cx="60" cy="60" r="56" stroke="url(#ep-splash-ring-grad)" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <svg className="ep-splash-orbit" viewBox="0 0 120 120" fill="none">
          <circle cx="60" cy="4" r="4" fill="#fff" />
          <circle cx="60" cy="4" r="9" fill="rgb(167 139 250 / 0.35)" />
        </svg>
        <svg className="ep-splash-logo" viewBox="0 0 48 48" fill="none">
          <defs>
            <linearGradient id="ep-splash-logo-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop stopColor="#7c3aed" />
              <stop offset="0.55" stopColor="#6366f1" />
              <stop offset="1" stopColor="#38bdf8" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="44" height="44" rx="13" fill="url(#ep-splash-logo-grad)" />
          <path d="M16 30c2.5 4 7 6.5 12 6.5" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
          <path d="M16 34c2.5 4 7 6.5 12 6.5" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.3" />
          <path
            d="M32 14l-13.4 13.4a3.4 3.4 0 004.8 4.8L36.8 18.8a6.6 6.6 0 00-9.3-9.3L13.6 24a9.6 9.6 0 0013.6 13.6"
            stroke="white"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <p className="ep-splash-word">
        Escript<span>Pay</span>
      </p>
      <p className="ep-splash-tag">Cheaper data. Instant airtime.</p>
      <div className="ep-splash-bar"><i /></div>
    </div>
  );
}
