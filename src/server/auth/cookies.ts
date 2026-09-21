/**
 * Pose/lecture/suppression des cookies d'authentification.
 *
 * Point d'accès UNIQUE pour manipuler ces cookies — aucun autre fichier ne
 * doit appeler `cookies().set(...)` directement pour la session, afin que
 * les attributs de sécurité (httpOnly, secure, sameSite) soient garantis
 * cohérents partout.
 */

import { cookies } from "next/headers";
import { getEnv } from "@/config/env";
import { SESSION_COOKIE_NAME } from "@/server/auth/session";

/** Cookie temporaire posé entre "mot de passe validé" et "OTP vérifié"
 * pour les comptes avec otpRequired=true. Ne contient qu'un identifiant
 * utilisateur (pas un secret en soi) — l'accès réel reste gated par le
 * code OTP, vérifié côté serveur via OtpService. Durée de vie courte
 * (10 minutes), alignée sur un temps raisonnable pour saisir le code. */
export const PENDING_LOGIN_COOKIE_NAME = "kinap_pending_login";
const PENDING_LOGIN_TTL_SECONDS = 10 * 60;

function isProduction(): boolean {
  try {
    return getEnv().APP_ENV === "production";
  } catch {
    return process.env.NODE_ENV === "production";
  }
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSessionCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

export async function setPendingLoginCookie(userId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(PENDING_LOGIN_COOKIE_NAME, userId, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: PENDING_LOGIN_TTL_SECONDS,
  });
}

export async function getPendingLoginUserId(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(PENDING_LOGIN_COOKIE_NAME)?.value;
}

export async function clearPendingLoginCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(PENDING_LOGIN_COOKIE_NAME);
}
