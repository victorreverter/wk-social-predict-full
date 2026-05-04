/**
 * Rate Limiter Utility
 * Implements client-side rate limiting for API calls
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  message: string;
}

interface RateLimitState {
  requests: number[];
  blockedUntil?: number;
}

class RateLimiter {
  private limits: Map<string, RateLimitState>;
  private configs: Map<string, RateLimitConfig>;

  constructor() {
    this.limits = new Map();
    this.configs = new Map();
  }

  /**
   * Configure rate limit for a specific action
   */
  configure(action: string, config: RateLimitConfig): void {
    this.configs.set(action, config);
    if (!this.limits.has(action)) {
      this.limits.set(action, { requests: [] });
    }
  }

  /**
   * Check if request is allowed and record it if so
   * Returns true if allowed, false if rate limited
   */
  check(action: string): { allowed: boolean; remaining?: number; resetAt?: number } {
    const config = this.configs.get(action);
    if (!config) {
      // No config means no limit
      return { allowed: true };
    }

    const state = this.limits.get(action);
    if (!state) {
      return { allowed: true };
    }

    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Remove old requests outside the window
    state.requests = state.requests.filter(timestamp => timestamp > windowStart);

    // Check if blocked
    if (state.blockedUntil && now < state.blockedUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: state.blockedUntil
      };
    }

    // Clear block if expired
    if (state.blockedUntil && now >= state.blockedUntil) {
      state.blockedUntil = undefined;
    }

    // Check if under limit
    if (state.requests.length < config.maxRequests) {
      state.requests.push(now);
      return {
        allowed: true,
        remaining: config.maxRequests - state.requests.length,
        resetAt: now + config.windowMs
      };
    }

    // Rate limited
    const resetAt = state.requests[0] + config.windowMs;
    return {
      allowed: false,
      remaining: 0,
      resetAt
    };
  }

  /**
   * Get current rate limit status
   */
  getStatus(action: string): { current: number; max: number; remaining: number } | null {
    const config = this.configs.get(action);
    const state = this.limits.get(action);

    if (!config || !state) {
      return null;
    }

    const now = Date.now();
    const windowStart = now - config.windowMs;
    const currentRequests = state.requests.filter(timestamp => timestamp > windowStart).length;

    return {
      current: currentRequests,
      max: config.maxRequests,
      remaining: Math.max(0, config.maxRequests - currentRequests)
    };
  }

  /**
   * Reset rate limit for an action
   */
  reset(action: string): void {
    const state = this.limits.get(action);
    if (state) {
      state.requests = [];
      state.blockedUntil = undefined;
    }
  }

  /**
   * Reset all rate limits
   */
  resetAll(): void {
    this.limits.forEach(state => {
      state.requests = [];
      state.blockedUntil = undefined;
    });
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();

/**
 * Default rate limit configurations
 */
export const defaultRateLimits = {
  // Prediction save: 10 requests per minute
  PREDICTION_SAVE: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many save attempts. Please wait a moment.'
  },
  
  // Auth attempts: 5 per minute (prevent brute force)
  AUTH_ATTEMPT: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many authentication attempts. Please try again later.'
  },
  
  // Password reset: 3 per hour
  PASSWORD_RESET: {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'Too many password reset requests. Please try again later.'
  },
  
  // Username check: 10 per minute
  USERNAME_CHECK: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many username checks. Please wait.'
  },
  
  // Data fetch: 100 per minute
  DATA_FETCH: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many requests. Please slow down.'
  }
};

/**
 * Initialize default rate limits
 */
export function initializeRateLimits(): void {
  Object.entries(defaultRateLimits).forEach(([action, config]) => {
    rateLimiter.configure(action, config);
  });
}

/**
 * Hook-like utility for rate-limited operations
 */
export async function withRateLimit<T>(
  action: string,
  operation: () => Promise<T>,
  onRateLimit?: () => void
): Promise<T | null> {
  const result = rateLimiter.check(action);
  
  if (!result.allowed) {
    if (onRateLimit) {
      onRateLimit();
    }
    return null;
  }
  
  try {
    return await operation();
  } catch (error) {
    throw error;
  }
}
