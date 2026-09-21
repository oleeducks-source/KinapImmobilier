/**
 * Implémentation OTPProvider via Twilio — provisoire (Phase 2.1 Décision #2).
 *
 * Remplaçable par tout autre fournisseur (Orange, un opérateur local, etc.)
 * sans modifier OtpService : il suffit d'implémenter OtpProvider ailleurs.
 */

import twilio from "twilio";
import type { OtpProvider } from "@/server/otp/provider";
import { getEnv } from "@/config/env";
import { logger } from "@/lib/logger";

export class TwilioOtpProvider implements OtpProvider {
  private readonly client: ReturnType<typeof twilio>;
  private readonly fromNumber: string;

  constructor() {
    const env = getEnv();
    if (!env.OTP_TWILIO_ACCOUNT_SID || !env.OTP_TWILIO_AUTH_TOKEN || !env.OTP_TWILIO_FROM_NUMBER) {
      throw new Error("Configuration Twilio incomplète.");
    }
    this.client = twilio(env.OTP_TWILIO_ACCOUNT_SID, env.OTP_TWILIO_AUTH_TOKEN);
    this.fromNumber = env.OTP_TWILIO_FROM_NUMBER;
  }

  async sendOtp(phoneNumber: string, code: string): Promise<void> {
    try {
      await this.client.messages.create({
        to: phoneNumber,
        from: this.fromNumber,
        body: `KINAP IMMOBILIER — votre code de vérification est ${code}. Il expire dans 5 minutes.`,
      });
    } catch (error) {
      // On ne relaie jamais le détail brut de l'erreur Twilio (peut contenir
      // des informations de compte) au-delà des logs serveur.
      logger.error("Échec d'envoi OTP via Twilio", {
        // Le numéro est partiellement masqué : seuls les 4 derniers chiffres sont conservés.
        phoneSuffix: phoneNumber.slice(-4),
      });
      throw new Error("Échec de l'envoi du code de vérification.");
    }
  }
}
