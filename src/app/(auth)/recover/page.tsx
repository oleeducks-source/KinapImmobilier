import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { recoverRequestAction } from "@/app/(auth)/actions";

export default async function RecoverPage({
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
        <h1 style={{ fontSize: 18, marginBottom: 4 }}>Récupération de compte</h1>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 24 }}>
          Saisissez votre e-mail pour recevoir les instructions de réinitialisation.
        </p>

        {error ? (
          <p role="alert" style={{ fontSize: 13, color: "var(--color-danger, #c0392b)", marginBottom: 16 }}>
            {error}
          </p>
        ) : null}

        <form action={recoverRequestAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input id="email" name="email" type="email" label="Adresse e-mail" required autoComplete="username" />
          <Button type="submit">Envoyer les instructions</Button>
        </form>

        <a href="/login" style={{ display: "block", marginTop: 16, fontSize: 13, color: "var(--color-primary)" }}>
          Retour à la connexion
        </a>
      </Card>
    </main>
  );
}
