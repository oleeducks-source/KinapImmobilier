"use server";

/**
 * Server actions d'authentification — le seul point d'entrée réel pour
 * login/logout/recovery/OTP. Câblées aux pages sous src/app/(auth)/.
 *
 * Pattern volontairement sans `useFormState`/`useActionState` : la version
 * de react-dom installée ici (18.3.1 stable, pas le build canary que Next.js
 * utilise en interne pour ces hooks) ne les expose pas. On utilise donc le
 * pattern standard compatible React 18 stable : `<form action={...}>` +
 * redirection avec un paramètre `?error=` lu côté serveur par la page.
 *
 * Toute erreur métier (AppError) est convertie en message sûr avant d'être
 * placée dans l'URL de redirection (jamais de stack, jamais de détail Prisma).
 */

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { login, completeLoginWithOtp, logout as logoutService } from "@/server/auth/loginService";
import { requestPasswordReset, confirmPasswordReset } from "@/server/auth/recoveryService";
import {
  setSessionCookie,
  clearSessionCookie,
  getSessionCookie,
  setPendingLoginCookie,
  getPendingLoginUserId,
  clearPendingLoginCookie,
} from "@/server/auth/cookies";
import { toPublicErrorShape } from "@/lib/errors";
import { logger } from "@/lib/logger";

async function requestContext() {
  const headerList = await headers();
  return {
    ipAddress: headerList.get("x-forwarded-for") ?? undefined,
    userAgent: headerList.get("user-agent") ?? undefined,
  };
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function loginAction(formData: FormData): Promise<void> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirectWithError("/login", "Adresse e-mail ou mot de passe invalide.");
  }

  let outcome: Awaited<ReturnType<typeof login>>;
  try {
    const context = await requestContext();
    outcome = await login(parsed.data.email, parsed.data.password, context);
  } catch (error) {
    logger.warn("Échec de connexion");
    const shape = toPublicErrorShape(error);
    redirectWithError("/login", shape.message);
  }

  if (outcome.status === "otp_required") {
    await setPendingLoginCookie(outcome.userId);
    redirect("/verify-otp");
  }

  await setSessionCookie(outcome.session.token, outcome.session.expiresAt);
  redirect("/dashboard");
}

const otpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Le code doit contenir 6 chiffres."),
});

export async function verifyLoginOtpAction(formData: FormData): Promise<void> {
  const parsed = otpSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) {
    redirectWithError("/verify-otp", "Le code doit contenir 6 chiffres.");
  }

  const pendingUserId = await getPendingLoginUserId();
  if (!pendingUserId) {
    redirectWithError("/login", "Session de connexion expirée. Merci de vous reconnecter.");
  }

  let session: Awaited<ReturnType<typeof completeLoginWithOtp>>;
  try {
    const context = await requestContext();
    session = await completeLoginWithOtp(pendingUserId, parsed.data.code, context);
  } catch (error) {
    const shape = toPublicErrorShape(error);
    redirectWithError("/verify-otp", shape.message);
  }

  await clearPendingLoginCookie();
  await setSessionCookie(session.token, session.expiresAt);
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  const token = await getSessionCookie();
  if (token) {
    try {
      await logoutService(token, undefined);
    } catch {
      logger.warn("Erreur lors de la déconnexion (session déjà invalide ?)");
    }
  }
  await clearSessionCookie();
  redirect("/login");
}

const recoverRequestSchema = z.object({ email: z.string().email() });

export async function recoverRequestAction(formData: FormData): Promise<void> {
  const parsed = recoverRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    redirectWithError("/recover", "Adresse e-mail invalide.");
  }

  const { userId } = await requestPasswordReset(parsed.data.email);

  if (userId) {
    await setPendingLoginCookie(userId);
  }

  // Toujours la même redirection, que l'email existe ou non (anti-énumération).
  redirect("/recover/confirm");
}

const recoverConfirmSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Le code doit contenir 6 chiffres."),
  newPassword: z.string().min(12, "Le mot de passe doit contenir au moins 12 caractères."),
});

export async function recoverConfirmAction(formData: FormData): Promise<void> {
  const parsed = recoverConfirmSchema.safeParse({
    code: formData.get("code"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) {
    redirectWithError("/recover/confirm", parsed.error.issues[0]?.message ?? "Formulaire invalide.");
  }

  const pendingUserId = await getPendingLoginUserId();
  if (!pendingUserId) {
    redirectWithError("/recover", "Session de récupération expirée. Merci de recommencer.");
  }

  try {
    await confirmPasswordReset(pendingUserId, parsed.data.code, parsed.data.newPassword);
  } catch (error) {
    const shape = toPublicErrorShape(error);
    redirectWithError("/recover/confirm", shape.message);
  }

  await clearPendingLoginCookie();
  redirect("/login");
}
