/**
 * OtpService — génération, envoi, et vérification des codes OTP.
 *
 * Règles :
 *  - le code n'est jamais stocké en clair (seulement son hash) ni loggé ;
 *  - un code a un nombre de tentatives limité (RATE_LIMIT_OTP_MAX_ATTEMPTS) ;
 *  - un code expiré ou déjà consommé est toujours rejeté ;
 *  - le provider concret (Twilio, mock, ...) est injecté via l'interface OtpProvider —
 *    ce service ne connaît jamais un SDK de fournisseur directement.
 */

import { prisma } from "@/lib/prisma";
import { getEnv } from "@/config/env";
import { RateLimitedError, ValidationError } from "@/lib/errors";
import type { OtpProvider } from "@/server/otp/provider";
import { TwilioOtpProvider } from "@/server/otp/providers/twilio";
import { MockOtpProvider } from "@/server/otp/providers/mock";
import { hashOtpCode, generateOtpCode, OTP_TTL_MS } from "@/server/otp/crypto";
import type { OtpPurpose } from "@prisma/client";

let cachedProvider: OtpProvider | undefined;

/** Résout le provider actif selon OTP_PROVIDER — jamais codé en dur ailleurs. */
export function getOtpProvider(): OtpProvider {
  if (!cachedProvider) {
    const env = getEnv();
    cachedProvider = env.OTP_PROVIDER === "twilio" ? new TwilioOtpProvider() : new MockOtpProvider();
  }
  return cachedProvider;
}

export interface RequestOtpInput {
  userId: string;
  phoneNumber: string;
  purpose: OtpPurpose;
}

export async function requestOtp(input: RequestOtpInput): Promise<void> {
  const env = getEnv();
  const windowStart = new Date(Date.now() - env.RATE_LIMIT_OTP_WINDOW_SECONDS * 1000);

  const recentCount = await prisma.otpCode.count({
    where: { userId: input.userId, purpose: input.purpose, createdAt: { gte: windowStart } },
  });

  if (recentCount >= env.RATE_LIMIT_OTP_MAX_ATTEMPTS) {
    throw new RateLimitedError("Trop de demandes de code. Merci de réessayer plus tard.");
  }

  const code = generateOtpCode();
  const codeHash = hashOtpCode(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.otpCode.create({
    data: {
      userId: input.userId,
      purpose: input.purpose,
      codeHash,
      expiresAt,
      maxAttempts: env.RATE_LIMIT_OTP_MAX_ATTEMPTS,
    },
  });

  const provider = getOtpProvider();
  await provider.sendOtp(input.phoneNumber, code);
  // Le code lui-même n'est jamais journalisé, ni ici ni dans le provider.
}

export interface VerifyOtpInput {
  userId: string;
  purpose: OtpPurpose;
  code: string;
}

export async function verifyOtp(input: VerifyOtpInput): Promise<boolean> {
  const otpRecord = await prisma.otpCode.findFirst({
    where: {
      userId: input.userId,
      purpose: input.purpose,
      consumedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otpRecord) {
    throw new ValidationError("Aucun code de vérification en attente.");
  }

  if (otpRecord.expiresAt < new Date()) {
    throw new ValidationError("Le code de vérification a expiré.");
  }

  if (otpRecord.attempts >= otpRecord.maxAttempts) {
    throw new RateLimitedError("Nombre maximal de tentatives atteint pour ce code.");
  }

  const isValid = hashOtpCode(input.code) === otpRecord.codeHash;

  await prisma.otpCode.update({
    where: { id: otpRecord.id },
    data: {
      attempts: { increment: 1 },
      consumedAt: isValid ? new Date() : undefined,
    },
  });

  return isValid;
}
