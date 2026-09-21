import { describe, it, expect } from "vitest";
import { assertPermission, hasPermission } from "@/server/permissions/check";
import { ForbiddenError } from "@/lib/errors";

describe("RBAC — matrice de permissions", () => {
  it("autorise un COMPTABLE à valider un paiement", () => {
    expect(
      hasPermission({ userId: "u1", roleName: "COMPTABLE" }, "payments", "VALIDATE"),
    ).toBe(true);
  });

  it("interdit à un GESTIONNAIRE de valider un décaissement (règle des quatre yeux)", () => {
    expect(
      hasPermission({ userId: "u1", roleName: "GESTIONNAIRE" }, "disbursements", "VALIDATE"),
    ).toBe(false);
  });

  it("interdit à un LECTEUR toute action d'écriture", () => {
    expect(hasPermission({ userId: "u1", roleName: "LECTEUR" }, "tenants", "CREATE")).toBe(false);
  });

  it("assertPermission lève ForbiddenError pour une action non autorisée", () => {
    expect(() =>
      assertPermission({ userId: "u1", roleName: "AGENT_RECOUVREMENT" }, "disbursements", "CREATE"),
    ).toThrow(ForbiddenError);
  });

  it("SUPER_ADMIN a accès à tous les modules déclarés", () => {
    expect(hasPermission({ userId: "u1", roleName: "SUPER_ADMIN" }, "audit_log", "VIEW")).toBe(true);
    expect(hasPermission({ userId: "u1", roleName: "SUPER_ADMIN" }, "users", "DELETE_SOFT")).toBe(true);
  });
});
