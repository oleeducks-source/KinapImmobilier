/**
 * Gestion des sessions serveur.
 *
 * Le token de session brut n'est jamais stocké : seul son hash SHA-256 est
 * persisté (table `sessions`), de sorte qu'une fuite de la base ne permette
 * pas de rejouer une session active. Le token brut n'est transmis qu'une
 * seule fois, via un cookie httpOnly + secure + sameSite=lax.
 */

import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { UnauthenticatedError } from "@/lib/errors";

const SESSION_TOKEN_BYTES = 32;
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 heures

export const SESSION_COOKIE_NAME = "kinap_session";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface CreateSessionInput {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface CreatedSession {
  /** Token brut, à poser dans le cookie — n'est jamais renvoyé une seconde fois. */
  token: string;
  expiresAt: Date;
}

export async function createSession(input: CreateSessionInput): Promise<CreatedSession> {
  const token = randomBytes(SESSION_TOKEN_BYTES).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.session.create({
    data: {
      userId: input.userId,
      tokenHash,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export interface AuthenticatedSession {
  sessionId: string;
  userId: string;
  expiresAt: Date;
}

/**
 * Résout un token de cookie en session active. Lève UnauthenticatedError
 * si le token est absent, inconnu, révoqué, ou expiré — jamais de détail
 * plus précis renvoyé au client (pour ne pas faciliter l'énumération).
 */
export async function resolveSession(rawToken: string | undefined): Promise<AuthenticatedSession> {
  if (!rawToken) {
    throw new UnauthenticatedError();
  }

  const tokenHash = hashToken(rawToken);
  const session = await prisma.session.findUnique({ where: { tokenHash } });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw new UnauthenticatedError();
  }

  return { sessionId: session.id, userId: session.userId, expiresAt: session.expiresAt };
}

export async function revokeSession(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await prisma.session.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Révoque toutes les sessions actives d'un utilisateur (ex. changement de mot de passe). */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
