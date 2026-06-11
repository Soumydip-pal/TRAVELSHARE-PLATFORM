/**
 * Security & Rate-Limiting Middleware
 * Production-grade in-memory rate limiting.
 */

const hits = new Map();

function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 100, message = "Too many requests" } = {}) {
  return (req, res, next) => {
    const ip  = req.ip || req.connection.remoteAddress || "unknown";
    const key = `${ip}:${req.path.split("/")[2] || "global"}`;
    const now = Date.now();

    if (!hits.has(key) || hits.get(key).resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    const entry = hits.get(key);
    entry.count += 1;

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader("Retry-After", retryAfter);
      return res.status(429).json({ error: message, retryAfter });
    }

    next();
  };
}

// Auth limiter — generous, no lockout
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: "Too many requests from this IP, please try again later.",
});

const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 300,
  message: "Rate limit exceeded.",
});

const mlLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: "ML API rate limit exceeded.",
});

function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === "object") {
    const clean = (obj) => {
      if (typeof obj === "string") {
        return obj
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
          .replace(/javascript:/gi, "")
          .trim();
      }
      if (Array.isArray(obj)) return obj.map(clean);
      if (obj && typeof obj === "object") {
        return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, clean(v)]));
      }
      return obj;
    };
    req.body = clean(req.body);
  }
  next();
}

function requestLogger(req, res, next) {
  if (process.env.NODE_ENV !== "production") {
    const start = Date.now();
    res.on("finish", () => {
      const ms    = Date.now() - start;
      const color = res.statusCode >= 400 ? "\x1b[31m" : "\x1b[32m";
      const reset = "\x1b[0m";
      console.log(`${color}${res.statusCode}${reset} ${req.method} ${req.originalUrl} — ${ms}ms`);
    });
  }
  next();
}

module.exports = { createRateLimiter, authLimiter, apiLimiter, mlLimiter, sanitizeBody, requestLogger };
