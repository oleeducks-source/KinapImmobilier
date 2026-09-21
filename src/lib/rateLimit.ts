/**
 * Rate limiting générique, à seuils configurables via l'environnement
 * (voir .env.example — RATE_LIMIT_*). Phase 0 §20.
 *
 * Implémentation Phase 0 : compteur en base (table dédiée en mémoire du
 * process pour le login ; l'OTP utilise directement la table `otp_codes`
 * comme fenêtre glissante — voir src/server/otp/service.ts). Cette version
 * en mémoire de processus est une fondation ; en production multi-instance,
 * elle devra être remplacée par un store partagé (ex. Redis) — noté comme
 * dette explicite plutôt que masquée.
 */

import { RateLimitedError } from "@/lib/errors";

interface Attempt {
  count: number;
  windowStart: number;
}

const attemptsByKey = new Map<string, Attempt>();

export interface RateLimitOptions {
  maxAttempts: number;
  windowSeconds: number;
}

/**
 * Vérifie et incrémente le compteur pour `key` (ex. `login:${email}` ou
 * `login:ip:${ip}`). Lève RateLimitedError si le seuil est dépassé.
 */
export function enforceRateLimit(key: string, options: RateLimitOptions): void {
  const now = Date.now();
  const windowMs = options.windowSeconds * 1000;
  const existing = attemptsByKey.get(key);

  if (!existing || now - existing.windowStart > windowMs) {
    attemptsByKey.set(key, { count: 1, windowStart: now });
    return;
  }

  if (existing.count >= options.maxAttempts) {
    throw new RateLimitedError();
  }

  existing.count += 1;
}

/** À appeler après une tentative réussie (ex. login réussi) pour lever le compteur. */
export function resetRateLimit(key: string): void {
  attemptsByKey.delete(key);
}
