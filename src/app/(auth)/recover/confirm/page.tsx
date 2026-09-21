import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { recoverConfirmAction } from "@/app/(auth)/actions";

/**
 * Deuxième étape de la récupération de compte : code OTP (purpose
 * PASSWORD_RESET) + nouveau mot de passe. N'existait pas avant cette
 * session — `recoverConfirmAction` n'avait aucune page pour la soumettre.
 */
export default async function RecoverConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-5)",
      }}
    >
      <Card style={{ width: 360 }}>
        <h1 style={{ fontSize: 18, marginBottom: 4 }}>Nouveau mot de passe</h1>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 24 }}>
          Si un compte existe pour cette adresse, un code à 6 chiffres a été envoyé par SMS.
          Saisissez-le avec votre nouveau mot de passe.
        </p>

        {error ? (
          <p role="alert" style={{ fontSize: 13, color: "var(--color-danger, #c0392b)", marginBottom: 16 }}>
            {error}
          </p>
        ) : null}

        <form action={recoverConfirmAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            label="Code de vérification"
            required
            autoComplete="one-time-code"
          />
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            label="Nouveau mot de passe"
            required
            minLength={12}
            autoComplete="new-password"
          />
          <Button type="submit">Réinitialiser le mot de passe</Button>
        </form>

        <a href="/login" style={{ display: "block", marginTop: 16, fontSize: 13, color: "var(--color-primary)" }}>
          Retour à la connexion
        </a>
      </Card>
    </main>
  );
}
