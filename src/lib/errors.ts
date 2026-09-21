/**
 * Hiérarchie d'erreurs homogène.
 *
 * Règle absolue (Phase 0 §18) : aucune erreur renvoyée au client ne doit jamais
 * exposer une stack trace, un message Prisma brut, DATABASE_URL, ou tout autre
 * détail d'infrastructure. Toute erreur inattendue est mappée vers un message
 * générique côté client ; le détail réel part uniquement dans les logs serveur.
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  /** Détails sûrs à renvoyer au client (jamais de stack, jamais de secrets). */
  readonly publicDetails?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    httpStatus: number,
    publicDetails?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.publicDetails = publicDetails;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, publicDetails?: Record<string, unknown>) {
    super("VALIDATION_ERROR", message, 400, publicDetails);
    this.name = "ValidationError";
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "Authentification requise.") {
    super("UNAUTHENTICATED", message, 401);
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Action non autorisée.") {
    super("FORBIDDEN", message, 403);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Ressource introuvable.") {
    super("NOT_FOUND", message, 404);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super("CONFLICT", message, 409);
    this.name = "ConflictError";
  }
}

export class RateLimitedError extends AppError {
  constructor(message = "Trop de tentatives. Merci de réessayer plus tard.") {
    super("RATE_LIMITED", message, 429);
    this.name = "RateLimitedError";
  }
}

/**
 * Message générique unique renvoyé pour toute erreur non prévue (Prisma,
 * réseau, bug interne...). Ne jamais renvoyer error.message d'une exception
 * non contrôlée au client.
 */
export const GENERIC_INTERNAL_ERROR_MESSAGE =
  "Une erreur interne est survenue. Merci de réessayer ou de contacter le support.";

/**
 * Convertit n'importe quelle erreur interceptée en une forme sûre pour une
 * réponse API (jamais de stack, jamais de message brut d'origine externe).
 * Le détail complet doit être loggé séparément côté serveur AVANT cet appel.
 */
export function toPublicErrorShape(error: unknown): {
  code: ErrorCode;
  message: string;
  httpStatus: number;
  details?: Record<string, unknown>;
} {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      httpStatus: error.httpStatus,
      details: error.publicDetails,
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message: GENERIC_INTERNAL_ERROR_MESSAGE,
    httpStatus: 500,
  };
}
