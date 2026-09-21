/**
 * Abstraction OTPProvider (Phase 2.1 Décision #2).
 *
 * Chaîne : Auth → OtpService → OTPProvider (interface) → implémentation concrète.
 * Aucun appelant du service OTP ne doit connaître Twilio (ou tout autre
 * fournisseur) directement — cela permet de changer de fournisseur SMS sans
 * toucher à la logique métier d'authentification.
 */

export interface OtpProvider {
  /** Envoie un code OTP déjà généré vers le numéro donné. */
  sendOtp(phoneNumber: string, code: string): Promise<void>;
}
