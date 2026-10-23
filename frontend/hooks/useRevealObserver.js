"use client";

import { useEffect } from "react";

// Adds .is-visible to [data-reveal] elements as they scroll into view.
// Elements are only hidden while html.js is set (see globals.css), and any
// failure here reveals everything, so content can never stay invisible.
export function useRevealObserver() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll("[data-reveal]:not(.is-visible), [data-reveal-stagger]:not(.is-visible)"));
    const showAll = () => els.forEach((el) => el.classList.add("is-visible"));

    if (!("IntersectionObserver" in window)) {
      showAll();
      return undefined;
    }

    let observer;
    try {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1, rootMargin: "0px 0px -32px 0px" }
      );
      els.forEach((el) => observer.observe(el));
    } catch {
      showAll();
      return undefined;
    }
    return () => observer.disconnect();
  }, []);
}
