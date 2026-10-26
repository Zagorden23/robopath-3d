/**
 * Sliding-window Rate Limiter Middleware for authentication and API protection.
 */

export function createRateLimiter({
  windowMs = 60 * 1000,
  maxRequests = 40,
  message = 'Too many requests from this IP, please try again shortly.',
} = {}) {
  const hits = new Map();

  return function rateLimiterMiddleware(req, res, next) {
    if (process.env.DISABLE_RATE_LIMIT === 'true') {
      return next();
    }

    const key = req.ip || req.headers['x-forwarded-for'] || 'local';
    const now = Date.now();
    const record = hits.get(key) || { count: 0, resetTime: now + windowMs };

    if (now > record.resetTime) {
      record.count = 0;
      record.resetTime = now + windowMs;
    }

    record.count += 1;
    hits.set(key, record);

    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - record.count)));

    if (record.count > maxRequests) {
      return res.status(429).json({
        ok: false,
        error: message,
      });
    }

    return next();
  };
}
