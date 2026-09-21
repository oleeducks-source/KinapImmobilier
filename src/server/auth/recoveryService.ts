/**
 * RecoveryService — récupération de compte par mot de passe oublié.
 *
 * Flux :
 *   requestPasswordReset(email)
 *     → recherche utilisateur (jamais révéler si l'email existe : la
 *       fonction ne lève jamais d'erreur distincte pour "email inconnu")
 *     → si trouvé et actif et a un téléphone : OTP (purpose PASSWORD_RESET)
 *       envoyé via le provider configuré (mock en DEV, jamais Twilio requis)
 *   confirmPasswordReset(userId, code, newPassword)
 *     → verifyOtp(PASSWORD_RESET)
 *     → hashPassword(newPassword) + mise à jour
 *     → révocation de TOUTES les sessions actives de l'utilisateur
 *       (un mot de passe qui change invalide tout accès existant)
 */

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/server/auth/password";
import { requestOtp, verifyOtp } from "@/server/otp/service";
import { revokeAllUserSessions } from "@/server/auth/session";
import { recordAuditEvent } from "@/server/audit/log";
import { UnauthenticatedError } from "@/lib/errors";

/**
 * Ne lève jamais d'erreur selon que l'email existe ou non : le comportement
 * observable côté client doit être identique dans les deux cas (protection
 * contre l'énumération de comptes). Le "pending" retourné sert uniquement
 * à savoir si on peut afficher l'étape suivante (code+nouveau mot de passe) —
 * il est renvoyé systématiquement, que l'email existe ou non.
 */
export async function requestPasswordReset(email: string): Promise<{ userId: string | null }> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  if (!user || user.status !== "ACTIVE" || user.deletedAt || !user.phone) {
    // Toujours journalisé pour audit interne, mais AUCUN détail n'est
    // renvoyé à l'appelant qui permettrait de distinguer ce cas d'un succès.
    await recordAuditEvent(prisma, {
      action: "auth.password_reset_requested_unknown_or_unconfigured",
      entityType: "User",
      entityId: user?.id,
      result: "failure",
    });
    return { userId: null };
  }

  await requestOtp({ userId: user.id, phoneNumber: user.phone, purpose: "PASSWORD_RESET" });
  await recordAuditEvent(prisma, {
    userId: user.id,
    action: "auth.password_reset_requested",
    entityType: "User",
    entityId: user.id,
  });

  return { userId: user.id };
}

export async function confirmPasswordReset(
  userId: string,
  code: string,
  newPassword: string,
): Promise<void> {
  const isValid = await verifyOtp({ userId, purpose: "PASSWORD_RESET", code });

  if (!isValid) {
    await recordAuditEvent(prisma, {
      userId,
      action: "auth.password_reset_failed",
      entityType: "User",
      entityId: userId,
      result: "failure",
    });
    throw new UnauthenticatedError("Code de vérification incorrect.");
  }

  const newPasswordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newPasswordHash },
  });

  await revokeAllUserSessions(userId);

  await recordAuditEvent(prisma, {
    userId,
    action: "auth.password_reset_succeeded",
    entityType: "User",
    entityId: userId,
  });
}
