/**
 * LoginService — orchestration réelle de la connexion.
 *
 * Flux :
 *   credentials (email + mot de passe)
 *     → rate limiting (par email)
 *     → recherche utilisateur (jamais révéler si l'email existe ou non)
 *     → verifyPassword (Argon2id)
 *     → si otpRequired=true  : OTP envoyé (provider configuré), pas de
 *       session complète tant que le code n'est pas vérifié — le pending
 *       login est matérialisé par un cookie dédié (voir auth/cookies.ts)
 *     → sinon : session complète créée immédiatement
 *
 * Chaque tentative (succès ou échec) génère un AuditLog. Le message
 * d'erreur renvoyé à l'appelant est volontairement générique — ne permet
 * jamais de distinguer "email inconnu" de "mot de passe incorrect".
 */

import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/server/auth/password";
import { createSession, type CreatedSession } from "@/server/auth/session";
import { requestOtp } from "@/server/otp/service";
import { recordAuditEvent } from "@/server/audit/log";
import { enforceRateLimit, resetRateLimit } from "@/lib/rateLimit";
import { getEnv } from "@/config/env";
import { UnauthenticatedError, ForbiddenError } from "@/lib/errors";

const GENERIC_LOGIN_ERROR = "Identifiants incorrects.";

export interface LoginContext {
  ipAddress?: string;
  userAgent?: string;
}

export type LoginResult =
  | { status: "authenticated"; userId: string; session: CreatedSession }
  | { status: "otp_required"; userId: string };

export async function login(
  email: string,
  password: string,
  context: LoginContext,
): Promise<LoginResult> {
  const env = getEnv();
  const rateLimitKey = `login:${email.toLowerCase()}`;

  enforceRateLimit(rateLimitKey, {
    maxAttempts: env.RATE_LIMIT_LOGIN_MAX_ATTEMPTS,
    windowSeconds: env.RATE_LIMIT_LOGIN_WINDOW_SECONDS,
  });

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  // Toujours faire vérifier un hash, même si l'utilisateur n'existe pas,
  // pour ne pas exposer un timing différent entre "email inconnu" et
  // "mauvais mot de passe" (protection contre l'énumération de comptes).
  const DUMMY_HASH =
    "$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  const passwordIsValid = await verifyPassword(user?.passwordHash ?? DUMMY_HASH, password);

  if (!user || !passwordIsValid || user.status !== "ACTIVE" || user.deletedAt) {
    await recordAuditEvent(prisma, {
      action: "auth.login_failed",
      entityType: "User",
      entityId: user?.id,
      result: "failure",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      reason: !user ? "email_unknown" : !passwordIsValid ? "bad_password" : "account_inactive",
    });
    throw new UnauthenticatedError(GENERIC_LOGIN_ERROR);
  }

  resetRateLimit(rateLimitKey);

  if (user.otpRequired) {
    if (!user.phone) {
      // Compte mal configuré : OTP requis mais aucun numéro enregistré.
      // Ne jamais échouer silencieusement — c'est un vrai défaut de données,
      // pas une erreur de saisie de l'utilisateur.
      await recordAuditEvent(prisma, {
        userId: user.id,
        action: "auth.login_blocked_missing_phone",
        entityType: "User",
        entityId: user.id,
        result: "failure",
      });
      throw new ForbiddenError(
        "Vérification en deux étapes requise mais aucun numéro n'est enregistré pour ce compte. Contactez un administrateur.",
      );
    }

    await requestOtp({ userId: user.id, phoneNumber: user.phone, purpose: "LOGIN" });
    await recordAuditEvent(prisma, {
      userId: user.id,
      action: "auth.login_otp_requested",
      entityType: "User",
      entityId: user.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return { status: "otp_required", userId: user.id };
  }

  const session = await createSession({
    userId: user.id,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  await recordAuditEvent(prisma, {
    userId: user.id,
    action: "auth.login_succeeded",
    entityType: "User",
    entityId: user.id,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return { status: "authenticated", userId: user.id, session };
}

/** Deuxième étape pour les comptes avec otpRequired=true : code vérifié -> session complète. */
export async function completeLoginWithOtp(
  userId: string,
  code: string,
  context: LoginContext,
): Promise<CreatedSession> {
  const { verifyOtp } = await import("@/server/otp/service");

  const isValid = await verifyOtp({ userId, purpose: "LOGIN", code });

  if (!isValid) {
    await recordAuditEvent(prisma, {
      userId,
      action: "auth.login_otp_failed",
      entityType: "User",
      entityId: userId,
      result: "failure",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    throw new UnauthenticatedError("Code de vérification incorrect.");
  }

  const session = await createSession({
    userId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  await recordAuditEvent(prisma, {
    userId,
    action: "auth.login_succeeded_with_otp",
    entityType: "User",
    entityId: userId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return session;
}

export async function logout(sessionToken: string, userId: string | undefined): Promise<void> {
  const { revokeSession } = await import("@/server/auth/session");
  await revokeSession(sessionToken);
  await recordAuditEvent(prisma, {
    userId,
    action: "auth.logout",
    entityType: "User",
    entityId: userId,
  });
}
