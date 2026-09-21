import { redirect } from "next/navigation";

/**
 * Racine de l'application : redirige vers la connexion. L'authentification
 * réelle (résolution de session côté serveur) redirigera à son tour vers le
 * tableau de bord si une session valide existe déjà — voir
 * src/app/(app)/layout.tsx pour cette vérification.
 */
export default function RootPage() {
  redirect("/login");
}
