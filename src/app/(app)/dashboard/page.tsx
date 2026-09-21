import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";

/**
 * Tableau de bord — FONDATIONS UNIQUEMENT (Phase 0 §28). Ce que ce composant
 * livre : la question directrice ("Où en sont les fonds de KINAP
 * IMMOBILIER ?"), la structure des filtres, les coquilles de KPI, et
 * l'emplacement du tableau de PeriodStatement récent. Le calcul réel des
 * montants (branché sur PeriodStatement/CommissionTransaction/Disbursement)
 * est explicitement hors périmètre Phase 0 — module complet à venir.
 */
export default function DashboardPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <div>
        <h1 style={{ fontSize: 20, marginBottom: 4 }}>Où en sont les fonds de KINAP IMMOBILIER ?</h1>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
          Vue d&apos;ensemble de la période en cours — module complet à venir.
        </p>
      </div>

      {/* Coquille de filtres — période, propriété, statut. Branchement réel hors Phase 0. */}
      <Card style={{ display: "flex", gap: "var(--space-4)", alignItems: "center" }}>
        <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Filtres : période, bien, statut</span>
        <Badge tone="info">Fondation — à compléter</Badge>
      </Card>

      {/* Coquilles de KPI. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-4)" }}>
        {[
          "Total dû (période)",
          "Total encaissé (période)",
          "Commission KINAP",
          "Net disponible KINAP",
        ].map((label) => (
          <Card key={label}>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 8 }}>{label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text-muted)" }}>—</p>
          </Card>
        ))}
      </div>

      {/* Emplacement du tableau des relevés de période récents. */}
      <Card>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Relevés de période récents</p>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
          Aucune donnée — module PeriodStatement complet à venir (calcul, clôture, réouverture
          exceptionnelle).
        </p>
      </Card>
    </div>
  );
}
