// Minimal in-memory sliding-window rate limiter.
//
// No external dependency: request timestamps are kept per (namespace + IP)
// key and pruned on each request. Good enough for the staging app and for
// constant-load sites; swap for a Redis-backed store if the app ever scales
// to multiple servers.
//
//   rateLimit({ windowMs: 60000, max: 10, namespace: "auth" })

const buckets = new Map();

const WINDOW_MS_DEFAULT = 60 * 1000;
const MAX_DEFAULT = 10;

const sweep = (key, windowMs) => {
  const now = Date.now();
  const list = buckets.get(key) || [];

  // Prune timestamps outside the window (cheap FIFO sweep).
  while (list.length && list[0] <= now - windowMs) list.shift();

  buckets.set(key, list);
  return list;
};

// Keep the bucket map from growing forever.
const MAX_KEYS = 10000;
const pruneBuckets = () => {
  if (buckets.size > MAX_KEYS) {
    const now = Date.now();
    for (const [key, list] of buckets) {
      while (list.length && list[0] <= now - WINDOW_MS_DEFAULT) list.shift();
      if (list.length === 0) buckets.delete(key);
    }
  }
};

const rateLimit = ({ windowMs = WINDOW_MS_DEFAULT, max = MAX_DEFAULT, namespace = "api" } = {}) => {
  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const key = `${namespace}:${ip}`;

    pruneBuckets();
    const list = sweep(key, windowMs);

    if (list.length >= max) {
      const retryAfterSec = Math.ceil((windowMs - (Date.now() - list[0])) / 1000);
      res.setHeader("Retry-After", String(retryAfterSec));
      return res.status(429).json({
        success: false,
        message: "Too many requests. Please slow down and try again shortly.",
      });
    }

    list.push(Date.now());
    return next();
  };
};

module.exports = { rateLimit };