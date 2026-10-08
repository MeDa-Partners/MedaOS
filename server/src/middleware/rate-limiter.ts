import rateLimit from 'express-rate-limit';

/**
 * Strict rate limiter for authentication endpoints to prevent brute-force attacks.
 * Allows at most 10 login attempts per 15 minutes per IP address.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    error: {
      message: 'Too many login attempts. Please try again in 15 minutes.',
    },
  },
});

/**
 * General API rate limiter for standard endpoints.
 */
export const standardRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many requests. Please slow down.',
    },
  },
});
