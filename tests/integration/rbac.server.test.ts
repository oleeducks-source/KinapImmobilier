import { describe, it, expect } from "vitest";
import { assertPermission } from "@/server/permissions/check";
import { ForbiddenError } from "@/lib/errors";
import { recordPayment } from "@/server/services/payments/paymentService";

/**
 * RBAC — tests d'intégration au niveau serveur réel.
 *
 * Portée honnête : `assertPermission()` est la SEULE fonction de vérification
 * d'autorisation utilisée par le code serveur (aucune logique dupliquée nulle
 * part ailleurs — cf. src/server/permissions/check.ts). Ces tests l'appellent
 * donc directement, exactement comme le fait chaque service métier réel.
 *
 * Les 4 scénarios explicitement demandés :
 *   - COMPTABLE  → valider un paiement       → autorisé
 *   - GESTIONNAIRE → valider un décaissement → refusé (règle des quatre yeux)
 *   - LECTEUR    → créer un paiement         → refusé
 *   - SUPER_ADMIN → autorisé (contrôle négatif : accès total)
 *
 * Note de portée : il n'existe en Phase 0 aucun endpoint métier "valider un
 * paiement" / "valider un décaissement" (ce serait du développement Phase 1 —
 * explicitement interdit par la mission). Les 4 scénarios sont donc vérifiés
 * au point d'application réel et unique (`assertPermission`), et le scénario
 * "LECTEUR → créer un paiement" est en plus vérifié via le VRAI service
 * `recordPayment()` de bout en bout (il rejette AVANT tout accès Prisma,
 * donc exécutable sans base de données — le rejet est confirmé réel, pas
 * simulé).
 */
describe("RBAC — application serveur réelle (assertPermission)", () => {
  it("COMPTABLE → valider un paiement → autorisé", () => {
    expect(() =>
      assertPermission({ userId: "u-comptable", roleName: "COMPTABLE" }, "payments", "VALIDATE"),
    ).not.toThrow();
  });

  it("GESTIONNAIRE → valider un décaissement → refusé (règle des quatre yeux)", () => {
    expect(() =>
      assertPermission({ userId: "u-gestionnaire", roleName: "GESTIONNAIRE" }, "disbursements", "VALIDATE"),
    ).toThrow(ForbiddenError);
  });

  it("LECTEUR → créer un paiement → refusé", () => {
    expect(() =>
      assertPermission({ userId: "u-lecteur", roleName: "LECTEUR" }, "payments", "CREATE"),
    ).toThrow(ForbiddenError);
  });

  it("SUPER_ADMIN → autorisé sur toute action de tout module déclaré", () => {
    expect(() =>
      assertPermission({ userId: "u-admin", roleName: "SUPER_ADMIN" }, "payments", "VALIDATE"),
    ).not.toThrow();
    expect(() =>
      assertPermission({ userId: "u-admin", roleName: "SUPER_ADMIN" }, "disbursements", "VALIDATE"),
    ).not.toThrow();
  });
});

describe("RBAC — rejet réel au niveau service (pas seulement matrice)", () => {
  it("recordPayment() rejette un LECTEUR avant tout accès Prisma (aucune base requise)", async () => {
    await expect(
      recordPayment(
        {
          tenantId: "t1",
          leaseId: "l1",
          methodId: "m1",
          amount: 100000,
          date: new Date().toISOString(),
          allocations: [{ rentScheduleId: "rs1", amount: 100000 }],
        } as never,
        { actor: { userId: "u-lecteur", roleName: "LECTEUR" } },
      ),
    ).rejects.toThrow(ForbiddenError);
  });
});
