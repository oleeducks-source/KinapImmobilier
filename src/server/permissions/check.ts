/**
 * Vérification serveur des autorisations — SEULE source de vérité.
 *
 * Toute route API / server action DOIT appeler requirePermission() avant
 * d'exécuter une opération sensible. Un masquage de bouton côté UI n'est
 * jamais suffisant : un utilisateur qui contourne l'UI (appel direct à
 * l'API) doit être bloqué ici.
 */

import { prisma } from "@/lib/prisma";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { PERMISSION_MATRIX, type ModuleLiteral, type PermissionActionLiteral } from "@/server/permissions/matrix";
import type { AuthenticatedSession } from "@/server/auth/session";

export interface AuthorizedActor {
  userId: string;
  roleName: keyof typeof PERMISSION_MATRIX;
}

/** Charge le rôle de l'utilisateur associé à une session déjà validée. */
export async function loadActor(session: AuthenticatedSession): Promise<AuthorizedActor> {
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { role: true },
  });

  if (!user || user.status !== "ACTIVE" || user.deletedAt) {
    throw new UnauthenticatedError();
  }

  return { userId: user.id, roleName: user.role.name };
}

/**
 * Vérifie qu'un acteur peut exécuter `action` sur `module`. Lève ForbiddenError
 * sinon. Ne renvoie jamais d'information sur les permissions d'autres rôles.
 */
export function assertPermission(
  actor: AuthorizedActor,
  module: ModuleLiteral,
  action: PermissionActionLiteral,
): void {
  const allowedActions = PERMISSION_MATRIX[actor.roleName][module] ?? [];
  if (!allowedActions.includes(action)) {
    throw new ForbiddenError(`Action "${action}" non autorisée sur "${module}" pour ce rôle.`);
  }
}

export function hasPermission(
  actor: AuthorizedActor,
  module: ModuleLiteral,
  action: PermissionActionLiteral,
): boolean {
  const allowedActions = PERMISSION_MATRIX[actor.roleName][module] ?? [];
  return allowedActions.includes(action);
}
