/**
 * PaymentService — exemple canonique du pattern transactionnel Payment + PaymentAllocation.
 *
 * Invariants appliqués ici (Phase 2 §7.1, Phase 2.1 Décision #6) :
 *  1. Payment ≠ PaymentAllocation : un encaissement réel unique, ventilé sur
 *     une ou plusieurs échéances (RentSchedule) via des lignes distinctes.
 *     Exemple canonique : un paiement de 750 000 FCFA peut être ventilé en
 *     3 lignes de 250 000 FCFA sur 3 échéances — jamais modélisé comme 3
 *     paiements distincts.
 *  2. Σ(allocations.amount) ne doit jamais dépasser payment.amount.
 *  3. La création du Payment, de ses PaymentAllocation, et de la
 *     CommissionTransaction associée se fait dans UNE SEULE transaction
 *     Prisma — soit tout réussit, soit rien n'est persisté.
 *  4. L'écriture d'AuditLog fait partie de la même transaction.
 *  5. Autorisation vérifiée AVANT toute écriture (assertPermission).
 */

import { prisma } from "@/lib/prisma";
import { ConflictError, ValidationError } from "@/lib/errors";
import { assertPermission, type AuthorizedActor } from "@/server/permissions/check";
import { recordAuditEvent } from "@/server/audit/log";
import {
  createPaymentWithAllocations,
  findActiveCommissionRule,
  createCommissionTransaction,
  sumAllocationsForRentSchedule,
} from "@/server/repositories/paymentRepository";
import { recordPaymentSchema, type RecordPaymentInput } from "@/server/validation/payment";

export interface RecordPaymentContext {
  actor: AuthorizedActor;
  ipAddress?: string;
  userAgent?: string;
}

export async function recordPayment(rawInput: RecordPaymentInput, context: RecordPaymentContext) {
  assertPermission(context.actor, "payments", "CREATE");

  const input = recordPaymentSchema.parse(rawInput);

  const totalAllocated = input.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  if (totalAllocated > input.amount) {
    throw new ValidationError(
      "La somme des ventilations dépasse le montant encaissé.",
      { totalAllocated, paymentAmount: input.amount },
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    // Défense en profondeur : re-vérifier, dans la transaction, qu'aucune
    // échéance ciblée n'est déjà intégralement couverte par d'autres allocations
    // (protection contre une double-saisie concurrente).
    for (const allocation of input.allocations) {
      const rentSchedule = await tx.rentSchedule.findUnique({ where: { id: allocation.rentScheduleId } });
      if (!rentSchedule) {
        throw new ValidationError(`Échéance introuvable : ${allocation.rentScheduleId}`);
      }
      const alreadyAllocated = await sumAllocationsForRentSchedule(tx, allocation.rentScheduleId);
      const projectedTotal = Number(alreadyAllocated) + allocation.amount;
      if (projectedTotal > Number(rentSchedule.amountDue)) {
        throw new ConflictError(
          `La ventilation dépasse le montant dû pour l'échéance ${allocation.rentScheduleId}.`,
        );
      }
    }

    const payment = await createPaymentWithAllocations(tx, {
      tenantId: input.tenantId,
      leaseId: input.leaseId,
      methodId: input.methodId,
      amount: input.amount,
      date: input.date,
      reference: input.reference,
      recordedBy: context.actor.userId,
      allocations: input.allocations,
    });

    // Commission KINAP : calculée sur le paiement (jamais sur la caution —
    // Deposit est un modèle distinct, jamais mélangé ici), au taux de la
    // règle ACTIVE unique.
    const activeRule = await findActiveCommissionRule(tx);
    if (activeRule) {
      const commissionAmount = input.amount * Number(activeRule.rate);
      await createCommissionTransaction(tx, {
        paymentId: payment.id,
        ruleId: activeRule.id,
        amount: commissionAmount,
      });
    }

    await recordAuditEvent(tx, {
      userId: context.actor.userId,
      action: "payment.recorded",
      entityType: "Payment",
      entityId: payment.id,
      newValue: {
        amount: input.amount,
        leaseId: input.leaseId,
        tenantId: input.tenantId,
        allocationsCount: input.allocations.length,
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return payment;
  });

  return result;
}

/**
 * Contre-passation (reversal) — jamais de suppression physique. Le paiement
 * original est marqué REVERSED et conserve son historique complet.
 */
export async function reversePayment(
  paymentId: string,
  reason: string,
  context: RecordPaymentContext,
) {
  assertPermission(context.actor, "payments", "REVERSE");

  if (!reason || reason.trim().length < 5) {
    throw new ValidationError("Un motif de contre-passation détaillé est requis.");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!existing) {
      throw new ValidationError("Paiement introuvable.");
    }
    if (existing.status === "REVERSED") {
      throw new ConflictError("Ce paiement a déjà été contre-passé.");
    }

    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: { status: "REVERSED", reversedAt: new Date(), reversalReason: reason },
    });

    await recordAuditEvent(tx, {
      userId: context.actor.userId,
      action: "payment.reversed",
      entityType: "Payment",
      entityId: paymentId,
      oldValue: { status: existing.status },
      newValue: { status: "REVERSED", reason },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return updated;
  });
}
