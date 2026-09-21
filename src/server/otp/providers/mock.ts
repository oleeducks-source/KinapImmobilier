/**
 * Implémentation OTPProvider "mock" — développement et tests uniquement.
 * N'envoie réellement aucun SMS ; journalise que l'envoi a eu lieu, jamais le code.
 */

import type { OtpProvider } from "@/server/otp/provider";
import { logger } from "@/lib/logger";

export class MockOtpProvider implements OtpProvider {
  async sendOtp(phoneNumber: string): Promise<void> {
    logger.info("OTP simulé (provider mock) — aucun SMS réel envoyé", {
      phoneSuffix: phoneNumber.slice(-4),
    });
  }
}
