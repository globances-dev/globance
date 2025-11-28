// Simple in-memory rate limiter
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export function rateLimit(
  key: string,
  limit: number = 10,
  windowMs: number = 60000 // 1 minute
): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // Clean up expired entries
  if (entry && entry.resetTime < now) {
    rateLimitStore.delete(key);
  }

  // Get or create entry
  const current = rateLimitStore.get(key) || {
    count: 0,
    resetTime: now + windowMs,
  };

  // Check if limit exceeded
  if (current.count >= limit) {
    return false; // Rate limited
  }

  // Increment counter
  current.count++;
  rateLimitStore.set(key, current);
  return true; // OK
}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 300000);
