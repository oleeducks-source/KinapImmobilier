/**
 * Validation stricte des variables d'environnement au démarrage.
 *
 * Référence : Phase 2.1 Décision #1 (séparation Dev/Staging/Prod) et Phase 0 §9.
 * Règles non négociables :
 *  - toute variable manquante ou mal formée fait échouer le démarrage (fail fast) ;
 *  - aucune valeur par défaut "silencieuse" pour un secret ;
 *  - les variables serveur (DATABASE_URL, SESSION_SECRET, STORAGE_*, OTP_TWILIO_*)
 *    ne sont JAMAIS exposées au navigateur — seules les variables préfixées
 *    NEXT_PUBLIC_* le sont, et elles sont listées explicitement ci-dessous ;
 *  - ce module ne logue jamais la valeur des secrets, seulement leur présence/absence.
 */

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["development", "staging", "production"]),

  DATABASE_URL: z.string().min(1, "DATABASE_URL est requis"),
  DIRECT_DATABASE_URL: z.string().min(1, "DIRECT_DATABASE_URL est requis"),

  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET doit contenir au moins 32 caractères"),

  OTP_PROVIDER: z.enum(["twilio", "mock"]).default("mock"),
  OTP_TWILIO_ACCOUNT_SID: z.string().optional(),
  OTP_TWILIO_AUTH_TOKEN: z.string().optional(),
  OTP_TWILIO_FROM_NUMBER: z.string().optional(),

  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_REGION: z.string().optional(),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  STORAGE_MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(10485760),

  APP_URL: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url(),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  RATE_LIMIT_LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_LOGIN_WINDOW_SECONDS: z.coerce.number().int().positive().default(900),
  RATE_LIMIT_OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  RATE_LIMIT_OTP_WINDOW_SECONDS: z.coerce.number().int().positive().default(300),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | undefined;

function parseEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    // Volontairement pas de console.error avec l'objet complet de process.env :
    // on ne logue jamais l'environnement brut, qui peut contenir des secrets.
    throw new Error(
      `Configuration invalide — démarrage interrompu.\nVariables en cause :\n${missing}`,
    );
  }

  const env = parsed.data;

  // Cohérence provider OTP : si "twilio" est sélectionné, ses identifiants sont requis.
  if (env.OTP_PROVIDER === "twilio") {
    const twilioMissing = [
      ["OTP_TWILIO_ACCOUNT_SID", env.OTP_TWILIO_ACCOUNT_SID],
      ["OTP_TWILIO_AUTH_TOKEN", env.OTP_TWILIO_AUTH_TOKEN],
      ["OTP_TWILIO_FROM_NUMBER", env.OTP_TWILIO_FROM_NUMBER],
    ].filter(([, value]) => !value);

    if (twilioMissing.length > 0) {
      throw new Error(
        `OTP_PROVIDER=twilio requiert ${twilioMissing
          .map(([name]) => name)
          .join(", ")} — démarrage interrompu.`,
      );
    }
  }

  // Garde-fou explicite : aucune variable serveur ne doit être dupliquée sous
  // un nom NEXT_PUBLIC_*. La liste des variables publiques autorisées est fermée.
  const allowedPublicVars = new Set(["NEXT_PUBLIC_APP_URL"]);
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("NEXT_PUBLIC_") && !allowedPublicVars.has(key)) {
      throw new Error(
        `Variable publique non autorisée détectée : ${key}. ` +
          `Seules ces variables NEXT_PUBLIC_* sont permises : ${[...allowedPublicVars].join(", ")}.`,
      );
    }
  }

  return env;
}

/**
 * Point d'accès unique et paresseux à l'environnement validé.
 * Ne jamais lire process.env directement ailleurs dans le code applicatif.
 */
export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = parseEnv();
  }
  return cachedEnv;
}

/**
 * Appelé explicitement au bootstrap serveur (voir src/app/layout.tsx / instrumentation)
 * pour échouer immédiatement plutôt que sur la première requête.
 */
export function assertEnvOrExit(): void {
  try {
    getEnv();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
