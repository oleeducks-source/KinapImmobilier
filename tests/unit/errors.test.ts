import { describe, it, expect } from "vitest";
import { toPublicErrorShape, ValidationError, GENERIC_INTERNAL_ERROR_MESSAGE } from "@/lib/errors";

describe("gestion homogène des erreurs — jamais de fuite interne", () => {
  it("une AppError connue conserve son message et son code", () => {
    const shape = toPublicErrorShape(new ValidationError("Montant invalide."));
    expect(shape.code).toBe("VALIDATION_ERROR");
    expect(shape.message).toBe("Montant invalide.");
    expect(shape.httpStatus).toBe(400);
  });

  it("une erreur Prisma/technique inattendue est masquée par un message générique", () => {
    const prismaLikeError = new Error(
      "PrismaClientKnownRequestError: Invalid \`prisma.payment.create()\` invocation at DATABASE_URL=postgresql://real:secret@host/db",
    );
    const shape = toPublicErrorShape(prismaLikeError);
    expect(shape.code).toBe("INTERNAL_ERROR");
    expect(shape.message).toBe(GENERIC_INTERNAL_ERROR_MESSAGE);
    expect(shape.message).not.toContain("DATABASE_URL");
    expect(shape.message).not.toContain("secret");
  });

  it("une chaîne lancée comme erreur ne fuit jamais son contenu brut", () => {
    // eslint-disable-next-line no-throw-literal
    const shape = toPublicErrorShape("erreur brute non contrôlée avec DATABASE_URL=postgres://x");
    expect(shape.message).toBe(GENERIC_INTERNAL_ERROR_MESSAGE);
  });
});
