/**
 * Object Storage S3-compatible — métadonnées en base (modèle `Document`),
 * fichiers réels hors base de données (Phase 2.1 Décision #4).
 *
 * Règles :
 *  - types acceptés : PDF, JPEG, PNG uniquement ;
 *  - taille max : STORAGE_MAX_FILE_SIZE_BYTES (10 Mo par défaut) ;
 *  - clé de stockage non prévisible (jamais le nom de fichier original) ;
 *  - hash SHA-256 calculé et stocké pour intégrité ;
 *  - téléchargement exclusivement via URL signée à durée limitée, jamais
 *    d'URL publique permanente ;
 *  - le contrôle RBAC sur le téléchargement est fait par l'appelant
 *    (assertPermission sur le module "documents") AVANT génération de l'URL signée.
 */

import { createHash, randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getEnv } from "@/config/env";
import { ValidationError } from "@/lib/errors";

const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes

let cachedClient: S3Client | undefined;

function getClient(): S3Client {
  if (!cachedClient) {
    const env = getEnv();
    cachedClient = new S3Client({
      endpoint: env.STORAGE_ENDPOINT,
      region: env.STORAGE_REGION ?? "auto",
      credentials: {
        accessKeyId: env.STORAGE_ACCESS_KEY_ID ?? "",
        secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY ?? "",
      },
    });
  }
  return cachedClient;
}

export interface UploadDocumentInput {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
}

export interface UploadedDocumentMeta {
  storageKey: string;
  sizeBytes: number;
  sha256: string;
  mimeType: string;
  originalName: string;
}

export async function uploadDocument(input: UploadDocumentInput): Promise<UploadedDocumentMeta> {
  const env = getEnv();

  if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
    throw new ValidationError("Type de fichier non autorisé (PDF, JPEG ou PNG uniquement).");
  }
  if (input.buffer.byteLength > env.STORAGE_MAX_FILE_SIZE_BYTES) {
    throw new ValidationError(
      `Fichier trop volumineux (max ${env.STORAGE_MAX_FILE_SIZE_BYTES / (1024 * 1024)} Mo).`,
    );
  }

  const storageKey = `documents/${randomUUID()}`;
  const sha256 = createHash("sha256").update(input.buffer).digest("hex");

  await getClient().send(
    new PutObjectCommand({
      Bucket: env.STORAGE_BUCKET,
      Key: storageKey,
      Body: input.buffer,
      ContentType: input.mimeType,
    }),
  );

  return {
    storageKey,
    sizeBytes: input.buffer.byteLength,
    sha256,
    mimeType: input.mimeType,
    originalName: input.originalName,
  };
}

/** Génère une URL de téléchargement signée et temporaire. L'appelant DOIT avoir
 * vérifié l'autorisation (assertPermission) avant d'appeler cette fonction. */
export async function getSignedDownloadUrl(storageKey: string): Promise<string> {
  const env = getEnv();
  const command = new GetObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: storageKey });
  return getSignedUrl(getClient(), command, { expiresIn: SIGNED_URL_TTL_SECONDS });
}
