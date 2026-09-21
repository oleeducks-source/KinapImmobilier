import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { verifyLoginOtpAction } from "@/app/(auth)/actions";

export default async function VerifyOtpPage({
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
        <h1 style={{ fontSize: 18, marginBottom: 4 }}>Vérification en deux étapes</h1>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 24 }}>
          Un code à 6 chiffres vous a été envoyé par SMS. Il expire dans 5 minutes.
        </p>

        {error ? (
          <p role="alert" style={{ fontSize: 13, color: "var(--color-danger, #c0392b)", marginBottom: 16 }}>
            {error}
          </p>
        ) : null}

        <form action={verifyLoginOtpAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
          <Button type="submit">Valider</Button>
        </form>
      </Card>
    </main>
  );
}
