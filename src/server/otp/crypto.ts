/**
 * Fonctions pures de génération/hachage OTP — extraites de otp/service.ts
 * pour être testables indépendamment de Prisma (aucune dépendance base de
 * données ici). otp/service.ts orchestre ces fonctions avec la persistance.
 */

import { randomInt, createHash } from "node:crypto";

export const OTP_CODE_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function hashOtpCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function generateOtpCode(): string {
  const max = 10 ** OTP_CODE_LENGTH;
  return randomInt(0, max).toString().padStart(OTP_CODE_LENGTH, "0");
}
