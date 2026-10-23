// A realistic phone shell for showing real EscriptPay UI on marketing pages.
// Bezel colours are fixed hex (not theme tokens) so the device always looks
// like a device; the screen inside follows the active theme.
export default function PhoneFrame({ children, className = "" }) {
  return (
    <div
      className={`relative rounded-[2.6rem] bg-[#0b1120] p-[0.6rem] shadow-[0_40px_90px_-30px_rgb(15_23_42/0.6),inset_0_0_0_1.5px_#334155] ${className}`}
    >
      {/* side buttons */}
      <span aria-hidden="true" className="absolute -left-[3px] top-24 h-10 w-[3px] rounded-l bg-[#1e293b]" />
      <span aria-hidden="true" className="absolute -left-[3px] top-36 h-14 w-[3px] rounded-l bg-[#1e293b]" />
      <span aria-hidden="true" className="absolute -right-[3px] top-32 h-16 w-[3px] rounded-r bg-[#1e293b]" />

      <div className="relative overflow-hidden rounded-[2.05rem] bg-slate-50">
        {/* status bar + dynamic island */}
        <div aria-hidden="true" className="relative flex h-9 items-center justify-between px-6 text-[10px] font-semibold text-ink-800">
          <span>9:41</span>
          <span className="absolute left-1/2 top-2 h-[1.15rem] w-[4.6rem] -translate-x-1/2 rounded-full bg-[#0b1120]" />
          <span className="flex items-center gap-1">
            <span className="flex items-end gap-[1.5px]">
              {[3, 5, 7, 9].map((h) => (
                <span key={h} className="w-[2.5px] rounded-sm bg-ink-800" style={{ height: h }} />
              ))}
            </span>
            <span className="ml-1 h-[9px] w-[17px] rounded-[3px] border border-ink-800 p-[1px]">
              <span className="block h-full w-3/4 rounded-[1px] bg-ink-800" />
            </span>
          </span>
        </div>
        {children}
        {/* home indicator */}
        <div aria-hidden="true" className="flex justify-center pb-2 pt-1">
          <span className="h-1 w-24 rounded-full bg-ink-800/80" />
        </div>
      </div>
    </div>
  );
}
