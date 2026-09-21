/**
 * Écriture centralisée de l'AuditLog.
 *
 * Règles absolues :
 *  - AuditLog n'est jamais purgé ni modifié après écriture (pas de update/delete
 *    exposé ici, volontairement — seule `recordAuditEvent` existe) ;
 *  - toute opération sensible (création/validation/reversal de paiement,
 *    décaissement, clôture de période, gestion des utilisateurs) DOIT être
 *    journalisée, y compris en cas d'échec (result: "failure") ;
 *  - oldValue/newValue ne doivent jamais contenir de secret (mot de passe,
 *    token, code OTP, DATABASE_URL...). Défense en profondeur : en plus de la
 *    discipline attendue des appelants, `recordAuditEvent` applique lui-même
 *    un masquage automatique (même logique que src/lib/logger.ts) avant
 *    écriture — un oubli d'un appelant ne suffit donc plus, à lui seul, à
 *    faire fuiter un secret dans une table qui, par ailleurs, est immuable
 *    (voir les triggers `audit_logs_no_update`/`audit_logs_no_delete`).
 */

import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@prisma/client";

/** Clés dont la valeur est toujours remplacée avant écriture en AuditLog. */
const AUDIT_SENSITIVE_KEYS = [
  "password",
  "passwordhash",
  "otp",
  "otpcode",
  "codehash",
  "token",
  "tokenhash",
  "sessionsecret",
  "authtoken",
  "secretaccesskey",
  "accesskeyid",
  "databaseurl",
  "database_url",
];

/** Exporté pour tests unitaires purs (aucune dépendance Prisma). */
export function redactAuditValue(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactAuditValue(item, depth + 1));
  }
  const output: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = AUDIT_SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive));
    output[key] = isSensitive ? "[REDACTED]" : redactAuditValue(val, depth + 1);
  }
  return output;
}

export interface AuditEventInput {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  reason?: string;
  result?: "success" | "failure";
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

/**
 * Accepte soit le client Prisma global, soit un client de transaction (`tx`),
 * pour que l'écriture d'audit fasse partie de la même transaction atomique
 * que l'opération métier qu'elle journalise (ex. création d'un Disbursement).
 */
type PrismaLike = PrismaClient | Prisma.TransactionClient;

export async function recordAuditEvent(
  client: PrismaLike,
  event: AuditEventInput,
): Promise<void> {
  await client.auditLog.create({
    data: {
      userId: event.userId,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      oldValue: event.oldValue ? (redactAuditValue(event.oldValue) as Prisma.InputJsonValue) : undefined,
      newValue: event.newValue ? (redactAuditValue(event.newValue) as Prisma.InputJsonValue) : undefined,
      reason: event.reason,
      result: event.result ?? "success",
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      correlationId: event.correlationId,
    },
  });
}

/**
 * Variante hors-transaction pour les cas où l'audit doit être écrit même si
 * l'opération métier a échoué (ex. tentative de connexion refusée).
 */
export async function recordAuditEventStandalone(event: AuditEventInput): Promise<void> {
  await recordAuditEvent(prisma, event);
}
