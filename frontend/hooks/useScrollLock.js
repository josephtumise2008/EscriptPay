"use client";

import { useEffect } from "react";

// Stops the page behind an open menu from scrolling.
//
// Only <html> is locked: overflow:hidden on <body> would make it its own
// scroll container and un-stick the sticky headers. A counter lets several
// menus share the lock safely.
//
//   useScrollLock(open)                       always while open
//   useScrollLock(open, "(max-width: 639px)") only on phones
let locks = 0;
let saved = "";

export function useScrollLock(active, media) {
  useEffect(() => {
    if (!active) return undefined;
    if (media && !window.matchMedia(media).matches) return undefined;
    const html = document.documentElement;
    if (locks === 0) {
      saved = html.style.overflow;
      html.style.overflow = "hidden";
    }
    locks += 1;
    return () => {
      locks -= 1;
      if (locks === 0) html.style.overflow = saved;
    };
  }, [active, media]);
}

export const releaseScrollLock = () => {
  locks = 0;
  document.documentElement.style.overflow = saved;
};
