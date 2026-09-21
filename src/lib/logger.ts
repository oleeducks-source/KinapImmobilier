/**
 * Logger minimal et sûr.
 *
 * Règle absolue (Phase 0 §29) : ne jamais logger un secret, un mot de passe,
 * un code OTP, un token de session, ou le contenu de DATABASE_URL /
 * SESSION_SECRET / STORAGE_SECRET_ACCESS_KEY / OTP_TWILIO_AUTH_TOKEN.
 * Ce module fournit un point de passage unique pour appliquer un masquage
 * systématique plutôt que de compter sur la discipline de chaque appelant.
 */

import { getEnv } from "@/config/env";

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** Clés dont la valeur est toujours remplacée par "[REDACTED]" avant log. */
const SENSITIVE_KEYS = new Set([
  "password",
  "passwordHash",
  "otp",
  "otpCode",
  "codeHash",
  "token",
  "tokenHash",
  "sessionSecret",
  "authToken",
  "secretAccessKey",
  "accessKeyId",
  "databaseUrl",
  "database_url",
]);

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }

  const output: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = [...SENSITIVE_KEYS].some((sensitive) =>
      lowerKey.includes(sensitive.toLowerCase()),
    );
    output[key] = isSensitive ? "[REDACTED]" : redact(val, depth + 1);
  }
  return output;
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  let minLevel: LogLevel = "info";
  try {
    minLevel = getEnv().LOG_LEVEL;
  } catch {
    // En cas d'échec de validation d'env, on log quand même (utile au tout démarrage).
  }

  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) {
    return;
  }

  const safeContext = context ? redact(context) : undefined;
  const entry = {
    level,
    message,
    ...(safeContext ? { context: safeContext } : {}),
    timestamp: new Date().toISOString(),
  };

  // eslint-disable-next-line no-console
  const writer = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  writer(JSON.stringify(entry));
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => log("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => log("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => log("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => log("error", message, context),
};
