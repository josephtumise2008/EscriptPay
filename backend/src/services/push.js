// Web push notifications through OneSignal (onesignal.com).
//
// Setup: ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY (OneSignal dashboard →
// Settings → Keys & IDs). Backend only; the App ID is also served to the
// browser through /api/config (it is not secret). Without them, pushes are
// skipped and the API keeps working.
//
// The frontend logs each subscribed browser in to OneSignal with the
// EscriptPay user id as its External ID, so we can target users by id.

const ONESIGNAL_URL = "https://api.onesignal.com/notifications";
// OneSignal's built-in segment containing every subscribed browser.
const ALL_SUBSCRIBERS = process.env.ONESIGNAL_SEGMENT || "Total Subscriptions";
const MAX_IDS_PER_REQUEST = 2000;

const pushConfig = (env = process.env) => {
  const appId = (env.ONESIGNAL_APP_ID || "").trim();
  const apiKey = (env.ONESIGNAL_REST_API_KEY || "").trim();
  return { appId, apiKey, enabled: Boolean(appId && apiKey) };
};

const createPushService = ({ fetchImpl = (...args) => fetch(...args), env = process.env, logEvent = () => {} } = {}) => {
  const post = async (body) => {
    const { appId, apiKey } = pushConfig(env);
    const response = await fetchImpl(ONESIGNAL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // New OneSignal keys use "Key"; legacy keys used "Basic".
        Authorization: `${apiKey.startsWith("os_") ? "Key" : "Basic"} ${apiKey}`,
      },
      body: JSON.stringify({ app_id: appId, target_channel: "push", ...body }),
      signal: AbortSignal.timeout(15000),
    });
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    if (!response.ok) {
      const error = new Error(`OneSignal answered ${response.status}`);
      error.status = response.status;
      error.details = data && data.errors;
      throw error;
    }
    return data || {};
  };

  // message: { heading, text, url, topic }
  const content = ({ heading, text, url, topic }) => ({
    headings: { en: heading },
    contents: { en: text },
    ...(url ? { url } : {}),
    // Replaces an older unread notification of the same topic on the device.
    ...(topic ? { web_push_topic: topic } : {}),
    chrome_web_icon: env.ONESIGNAL_ICON_URL || undefined,
  });

  const toEveryone = async (message) => {
    if (!pushConfig(env).enabled) return { skipped: "not_configured" };
    const data = await post({ included_segments: [ALL_SUBSCRIBERS], ...content(message) });
    logEvent("push.sent", { audience: "all", id: data.id || null });
    return { sent: true, id: data.id || null };
  };

  const toUsers = async (userIds, message) => {
    if (!pushConfig(env).enabled) return { skipped: "not_configured" };
    const ids = [...new Set((userIds || []).map(String))];
    if (!ids.length) return { sent: false, users: 0 };
    let batches = 0;
    for (let i = 0; i < ids.length; i += MAX_IDS_PER_REQUEST) {
      await post({ include_aliases: { external_id: ids.slice(i, i + MAX_IDS_PER_REQUEST) }, ...content(message) });
      batches += 1;
    }
    logEvent("push.sent", { audience: "users", users: ids.length, batches });
    return { sent: true, users: ids.length, batches };
  };

  return { toEveryone, toUsers, enabled: () => pushConfig(env).enabled };
};

module.exports = { createPushService, pushConfig };
