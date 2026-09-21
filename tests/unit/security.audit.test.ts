/**
 * Tests de sécurité fondamentaux (Phase 0 §22 — tests de sécurité requis).
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("sécurité — garde-fous statiques", () => {
  it(".env n'est jamais suivi par git (seul .env.example l'est)", () => {
    const gitignore = fs.readFileSync(path.resolve(__dirname, "../../.gitignore"), "utf-8");
    expect(gitignore).toContain(".env");
  });

  it(".env.example ne contient aucune valeur de secret non vide suspecte", () => {
    const envExample = fs.readFileSync(path.resolve(__dirname, "../../.env.example"), "utf-8");
    // Seules les variables dont le NOM porte un marqueur de secret doivent
    // être vides. On ne regarde que la partie avant "=" pour éviter les faux
    // positifs (ex. DATABASE_URL=postgresql://user:password@... contient le
    // mot "password" dans son placeholder, sans être lui-même un secret nommé).
    const secretVarNamePattern = /SECRET|AUTH_TOKEN|ACCESS_KEY/i;
    const lines = envExample.split("\n").filter((line) => line.includes("="));

    for (const line of lines) {
      const [name, ...rest] = line.split("=");
      if (secretVarNamePattern.test(name ?? "")) {
        expect(rest.join("=").trim()).toBe("");
      }
    }
  });

  it("le schéma Prisma ne définit aucun onDelete: Cascade sur les tables financières critiques", () => {
    const schema = fs.readFileSync(path.resolve(__dirname, "../../prisma/schema.prisma"), "utf-8");

    function extractModelBody(modelName: string): string {
      const match = schema.match(new RegExp(`model ${modelName} \\{([\\s\\S]*?)\\n\\}`));
      return match?.[1] ?? "";
    }

    function fieldLines(modelBody: string): string[] {
      // Ignore les lignes de commentaire pour éviter les faux positifs sur
      // de la documentation qui mentionne un nom de champ en prose.
      return modelBody.split("\n").filter((line) => !line.trim().startsWith("//"));
    }

    for (const model of ["Payment", "Deposit", "CommissionTransaction", "Disbursement"]) {
      const body = extractModelBody(model);
      expect(fieldLines(body).join("\n")).not.toMatch(/onDelete:\s*Cascade/);
    }

    const auditLogBody = fieldLines(extractModelBody("AuditLog")).join("\n");
    expect(auditLogBody).not.toMatch(/^\s*deletedAt\s+DateTime/m);
  });
});
