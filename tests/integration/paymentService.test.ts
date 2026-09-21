/**
 * Test d'intégration — nécessite une base PostgreSQL disponible via
 * DATABASE_URL (voir .github/workflows/ci.yml pour la configuration CI).
 * Ignoré automatiquement si la variable n'est pas définie, pour ne pas
 * casser un lancement local sans base configurée.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDatabase)("PaymentService — invariant transactionnel", () => {
  let prisma: import("@prisma/client").PrismaClient;
  let recordPayment: typeof import("@/server/services/payments/paymentService").recordPayment;

  beforeAll(async () => {
    const { prisma: prismaClient } = await import("@/lib/prisma");
    prisma = prismaClient;
    ({ recordPayment } = await import("@/server/services/payments/paymentService"));
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it(
    "rejette une ventilation dont la somme dépasse le montant encaissé, sans rien persister",
    async () => {
      const actor = { userId: "00000000-0000-0000-0000-000000000099", roleName: "COMPTABLE" as const };

      await expect(
        recordPayment(
          {
            tenantId: "00000000-0000-0000-0000-000000000001",
            leaseId: "00000000-0000-0000-0000-000000000001",
            methodId: "00000000-0000-0000-0000-000000000001",
            amount: 100000,
            date: new Date("2026-01-01"),
            allocations: [{ rentScheduleId: "00000000-0000-0000-0000-000000000001", amount: 200000 }],
          },
          { actor },
        ),
      ).rejects.toThrow();

      const paymentCount = await prisma.payment.count({
        where: { tenantId: "00000000-0000-0000-0000-000000000001" },
      });
      expect(paymentCount).toBe(0);
    },
  );
});
