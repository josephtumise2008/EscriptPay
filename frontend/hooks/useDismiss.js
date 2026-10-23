"use client";

import { useEffect } from "react";

// Closes a popover on outside pointer-down or Escape. On Escape, focus goes
// back to the trigger so keyboard users are not stranded.
export function useDismiss({ open, onClose, containerRef, triggerRef }) {
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) onClose();
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        triggerRef?.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, containerRef, triggerRef]);
}

// Arrow-key navigation between [role="menuitem"] elements inside a menu.
export function handleMenuKeyDown(e, menuEl) {
  if (!menuEl) return;
  const items = Array.from(menuEl.querySelectorAll('[role="menuitem"]'));
  if (items.length === 0) return;
  const index = items.indexOf(document.activeElement);
  let next = null;
  if (e.key === "ArrowDown") next = items[(index + 1) % items.length];
  else if (e.key === "ArrowUp") next = items[(index - 1 + items.length) % items.length];
  else if (e.key === "Home") next = items[0];
  else if (e.key === "End") next = items[items.length - 1];
  else if (e.key === "Tab") return; // let Tab leave naturally
  if (next) {
    e.preventDefault();
    next.focus();
  }
}
