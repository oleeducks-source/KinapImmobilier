import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { loginAction } from "@/app/(auth)/actions";

/**
 * Écran de connexion. Le formulaire est branché directement sur la server
 * action `loginAction` (verifyPassword → session/OTP → cookie). Pas de
 * `useFormState`/`useActionState` : react-dom 18.3.1 stable ne les expose
 * pas ici — l'erreur éventuelle est donc portée par `?error=` et affichée
 * côté serveur.
 */
export default async function LoginPage({
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
        <h1 style={{ fontSize: 18, marginBottom: 4 }}>KINAP IMMOBILIER</h1>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 24 }}>
          Connexion à votre espace de gestion
        </p>

        {error ? (
          <p
            role="alert"
            style={{
              fontSize: 13,
              color: "var(--color-danger, #c0392b)",
              marginBottom: 16,
            }}
          >
            {error}
          </p>
        ) : null}

        <form action={loginAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input id="email" name="email" type="email" label="Adresse e-mail" required autoComplete="username" />
          <Input
            id="password"
            name="password"
            type="password"
            label="Mot de passe"
            required
            autoComplete="current-password"
          />
          <Button type="submit">Se connecter</Button>
        </form>

        <a
          href="/recover"
          style={{ display: "block", marginTop: 16, fontSize: 13, color: "var(--color-primary)" }}
        >
          Mot de passe oublié ?
        </a>
      </Card>
    </main>
  );
}
