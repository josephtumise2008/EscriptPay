"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useDismiss } from "@/hooks/useDismiss";

// App-wide dropdown, styled and animated like the account menu.
//
//   <Select label="Status" value={v} onChange={setV}
//           options={[{ value: "all", label: "All statuses" }, ...]} />
//
// Keyboard: Enter/Space/Arrow keys open it; arrows, Home/End move; typing a
// letter jumps to the next matching option; Enter selects; Escape/Tab close.
export default function Select({
  id,
  label,
  hideLabel = true,
  value,
  onChange,
  options,
  placeholder = "Select…",
  className = "",
  size = "md",
  align = "left",
}) {
  const autoId = useId();
  const baseId = id || `select-${autoId.replace(/:/g, "")}`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = options[selectedIndex];

  const close = useCallback(() => setOpen(false), []);
  useDismiss({ open, onClose: close, containerRef, triggerRef });

  const openList = () => {
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  // Keep the highlighted option focused and visible.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector(`[data-index="${active}"]`);
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const choose = (option) => {
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onTriggerKeyDown = (e) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openList();
    }
  };

  const onListKeyDown = (e) => {
    const last = options.length - 1;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(last, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(last);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (options[active]) choose(options[active]);
    } else if (e.key === "Tab") {
      setOpen(false);
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      const ch = e.key.toLowerCase();
      const order = [...options.slice(active + 1), ...options.slice(0, active + 1)];
      const hit = order.find((o) => o.label.toLowerCase().startsWith(ch));
      if (hit) setActive(options.indexOf(hit));
    }
  };

  const sizes = size === "sm" ? "h-9 pl-3 pr-2 text-xs" : "h-11 pl-3.5 pr-2.5 text-sm";

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <span id={`${baseId}-label`} className={hideLabel ? "sr-only" : "mb-1.5 block text-sm font-semibold text-ink-700"}>
          {label}
        </span>
      )}
      <button
        ref={triggerRef}
        id={baseId}
        type="button"
        onClick={() => (open ? close() : openList())}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${baseId}-list`}
        aria-labelledby={label ? `${baseId}-label ${baseId}` : undefined}
        className={`focus-ring press flex w-full items-center justify-between gap-2 rounded-xl border bg-white font-medium ${sizes} ${
          open ? "border-cyan-400 ring-4 ring-cyan-100/70" : "border-slate-200 hover:border-slate-300"
        }`}
      >
        <span className={`truncate ${selected ? "text-ink-800" : "text-ink-400"}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`shrink-0 text-ink-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <ul
        id={`${baseId}-list`}
        ref={listRef}
        role="listbox"
        aria-labelledby={label ? `${baseId}-label` : undefined}
        data-state={open ? "open" : "closed"}
        inert={!open}
        onKeyDown={onListKeyDown}
        style={{ transformOrigin: align === "right" ? "top right" : "top left" }}
        className={`popover absolute top-full z-50 mt-2 max-h-72 min-w-full overflow-y-auto overscroll-contain rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-[0_24px_60px_-20px_rgb(15_23_42/0.45)] ${
          align === "right" ? "right-0" : "left-0"
        }`}
      >
        {options.map((option, index) => {
          const isSelected = option.value === value;
          return (
            <li
              key={option.value}
              role="option"
              aria-selected={isSelected}
              data-index={index}
              tabIndex={-1}
              onClick={() => choose(option)}
              onMouseMove={() => active !== index && setActive(index)}
              className={`flex cursor-pointer items-center justify-between gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm outline-none ${
                index === active ? "bg-slate-100" : ""
              } ${isSelected ? "font-semibold text-cyan-700" : "font-medium text-ink-800"}`}
            >
              {option.label}
              <Check size={15} aria-hidden="true" className={isSelected ? "text-cyan-600" : "invisible"} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
