"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getAppConfig } from "@/lib/api";
import { isStandalone, platformHint } from "@/lib/pwa";

// Web push through OneSignal (daily gift box alerts).
//
// - The OneSignal App ID comes from the backend (/api/config → pushAppId), so
//   turning push on is one Vercel env var (ONESIGNAL_APP_ID) + redeploy.
// - OneSignal runs inside our own service worker (/sw.js imports its worker
//   script), so the offline/PWA behaviour stays the same and there is only
//   one service worker.
// - Signed-in browsers are tagged with the EscriptPay user id (External ID),
//   so the backend can remind exactly the people whose gift is still waiting.
// - Production only, like the service worker itself.

const SDK_URL = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
let started = null; // Promise<OneSignal | null>

const withOneSignal = (fn) =>
  new Promise((resolve, reject) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        resolve(await fn(OneSignal));
      } catch (error) {
        reject(error);
      }
    });
  });

const start = () => {
  if (started) return started;
  started = (async () => {
    if (typeof window === "undefined" || process.env.NODE_ENV !== "production") return null;
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return null;
    const config = await getAppConfig().catch(() => null);
    const appId = config && config.pushAppId;
    if (!appId) return null;

    if (!document.querySelector(`script[src="${SDK_URL}"]`)) {
      const script = document.createElement("script");
      script.src = SDK_URL;
      script.defer = true;
      document.head.appendChild(script);
    }
    return withOneSignal(async (OneSignal) => {
      await OneSignal.init({
        appId,
        serviceWorkerPath: "sw.js",
        serviceWorkerParam: { scope: "/" },
        notifyButton: { enable: false },
        welcomeNotification: { disable: true },
      });
      return OneSignal;
    });
  })().catch(() => null);
  return started;
};

// Mounted once in the root layout: links/unlinks the browser to the user.
export function PushRegister() {
  const { user } = useAuth();
  const userId = user?.id || null;

  useEffect(() => {
    let cancelled = false;
    start().then((OneSignal) => {
      if (!OneSignal || cancelled) return;
      const action = userId ? OneSignal.login(String(userId)) : OneSignal.logout();
      Promise.resolve(action).catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return null;
}

// For the "Turn on gift alerts" button.
//   state: "loading" | "unavailable" | "install-first" (iPhone: add to Home
//          Screen first) | "blocked" | "off" | "on"
export function usePushAlerts() {
  const [state, setState] = useState("loading");

  const read = useCallback(async () => {
    const OneSignal = await start();
    if (!OneSignal) {
      const iosBrowser = ["ios", "ios-other"].includes(platformHint()) && !isStandalone();
      setState(iosBrowser ? "install-first" : "unavailable");
      return;
    }
    if (!OneSignal.Notifications.isPushSupported()) {
      const iosBrowser = ["ios", "ios-other"].includes(platformHint()) && !isStandalone();
      setState(iosBrowser ? "install-first" : "unavailable");
      return;
    }
    if (typeof Notification !== "undefined" && Notification.permission === "denied") {
      setState("blocked");
      return;
    }
    setState(OneSignal.Notifications.permission && OneSignal.User?.PushSubscription?.optedIn !== false ? "on" : "off");
  }, []);

  useEffect(() => {
    // Reading the browser's permission is an external system: sync it once.
    read();
  }, [read]);

  const enable = useCallback(async () => {
    const OneSignal = await start();
    if (!OneSignal) return false;
    try {
      if (!OneSignal.Notifications.permission) await OneSignal.Notifications.requestPermission();
      if (OneSignal.User?.PushSubscription && OneSignal.Notifications.permission) await OneSignal.User.PushSubscription.optIn();
    } catch {
      // The person closed the prompt.
    }
    await read();
    return OneSignal.Notifications.permission === true;
  }, [read]);

  // Turns alerts off for this phone (the browser permission stays, so turning
  // them back on is one tap with no prompt).
  const disable = useCallback(async () => {
    const OneSignal = await start();
    if (!OneSignal) return;
    try {
      await OneSignal.User?.PushSubscription?.optOut();
    } catch {
      // ignore
    }
    setState("off");
  }, []);

  return { state, enable, disable };
}
