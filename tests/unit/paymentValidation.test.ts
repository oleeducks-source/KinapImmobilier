import { describe, it, expect } from "vitest";
import { recordPaymentSchema } from "@/server/validation/payment";

describe("validation Payment — invariant Payment ≠ PaymentAllocation", () => {
  const uuid = "11111111-1111-1111-1111-111111111111";

  it("accepte un paiement ventilé sur plusieurs échéances (ex. 750 000 → 3×250 000)", () => {
    const result = recordPaymentSchema.safeParse({
      tenantId: uuid,
      leaseId: uuid,
      methodId: uuid,
      amount: 750000,
      date: "2026-01-05",
      allocations: [
        { rentScheduleId: uuid, amount: 250000 },
        { rentScheduleId: uuid, amount: 250000 },
        { rentScheduleId: uuid, amount: 250000 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejette un paiement sans aucune ventilation", () => {
    const result = recordPaymentSchema.safeParse({
      tenantId: uuid,
      leaseId: uuid,
      methodId: uuid,
      amount: 100000,
      date: "2026-01-05",
      allocations: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejette un montant négatif ou nul", () => {
    const result = recordPaymentSchema.safeParse({
      tenantId: uuid,
      leaseId: uuid,
      methodId: uuid,
      amount: 0,
      date: "2026-01-05",
      allocations: [{ rentScheduleId: uuid, amount: 100 }],
    });
    expect(result.success).toBe(false);
  });
});
