import { describe, it, expect } from "vitest";
import { enforceRateLimit, resetRateLimit } from "@/lib/rateLimit";
import { RateLimitedError } from "@/lib/errors";

describe("rate limiting", () => {
  it("bloque après le nombre maximal de tentatives", () => {
    const key = `test:${Math.random()}`;
    const options = { maxAttempts: 3, windowSeconds: 60 };

    enforceRateLimit(key, options);
    enforceRateLimit(key, options);
    enforceRateLimit(key, options);

    expect(() => enforceRateLimit(key, options)).toThrow(RateLimitedError);
  });

  it("réinitialise le compteur après un succès", () => {
    const key = `test:${Math.random()}`;
    const options = { maxAttempts: 1, windowSeconds: 60 };

    enforceRateLimit(key, options);
    resetRateLimit(key);

    expect(() => enforceRateLimit(key, options)).not.toThrow();
  });
});
