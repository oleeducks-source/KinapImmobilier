/**
 * Repository Payment — accès aux données uniquement, aucune règle métier ici.
 * Les règles métier (invariants, montants, autorisation) vivent dans
 * src/server/services/payments/paymentService.ts.
 */

import type { Prisma, PrismaClient } from "@prisma/client";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export interface CreatePaymentWithAllocationsInput {
  tenantId: string;
  leaseId: string;
  methodId: string;
  amount: Prisma.Decimal | number;
  date: Date;
  reference?: string;
  recordedBy: string;
  allocations: Array<{ rentScheduleId: string; amount: Prisma.Decimal | number }>;
}

export async function createPaymentWithAllocations(
  client: PrismaLike,
  input: CreatePaymentWithAllocationsInput,
) {
  return client.payment.create({
    data: {
      tenantId: input.tenantId,
      leaseId: input.leaseId,
      methodId: input.methodId,
      amount: input.amount,
      date: input.date,
      reference: input.reference,
      recordedBy: input.recordedBy,
      allocations: {
        create: input.allocations.map((allocation) => ({
          rentScheduleId: allocation.rentScheduleId,
          amount: allocation.amount,
        })),
      },
    },
    include: { allocations: true },
  });
}

export async function sumAllocationsForRentSchedule(
  client: PrismaLike,
  rentScheduleId: string,
): Promise<Prisma.Decimal> {
  const result = await client.paymentAllocation.aggregate({
    where: { rentScheduleId, deletedAt: null },
    _sum: { amount: true },
  });
  return result._sum.amount ?? (0 as unknown as Prisma.Decimal);
}

export async function findActiveCommissionRule(client: PrismaLike) {
  return client.commissionRule.findFirst({ where: { status: "ACTIVE" } });
}

export async function createCommissionTransaction(
  client: PrismaLike,
  input: { paymentId: string; ruleId: string; amount: Prisma.Decimal | number },
) {
  return client.commissionTransaction.create({ data: input });
}
