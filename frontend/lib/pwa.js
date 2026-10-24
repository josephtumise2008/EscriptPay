"use client";

import { useEffect, useState } from "react";

// Install support for the EscriptPay app.
// Chrome, Edge and Android fire `beforeinstallprompt`; the inline script in
// the root layout stores it on window.__epInstall as early as possible (it can
// fire before React mounts). iPhone/iPad and Mac Safari have no prompt, so we
// show short "Add to Home Screen" instructions instead.

export const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true);

export const platformHint = () => {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent || "";
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(ua) || iPadOS) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua)) return "mac-safari";
  return null;
};

export function useInstallApp() {
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [hint, setHint] = useState(null);

  useEffect(() => {
    setInstalled(isStandalone());
    setHint(platformHint());
    if (window.__epInstall) setPrompt(window.__epInstall);
    const onPrompt = () => setPrompt(window.__epInstall || null);
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("ep-installable", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("ep-installable", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!prompt) return false;
    prompt.prompt();
    const choice = await prompt.userChoice.catch(() => null);
    window.__epInstall = null;
    setPrompt(null);
    return choice?.outcome === "accepted";
  };

  // Something to offer: a real prompt, or instructions for this platform.
  const available = !installed && (Boolean(prompt) || Boolean(hint));
  return { available, canPrompt: Boolean(prompt), hint, install, installed };
}

// Registers the service worker (production only, after the page has loaded).
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
