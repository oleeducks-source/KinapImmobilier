/**
 * Schémas de validation côté serveur — Payment.
 *
 * Rappel Phase 0 §17 : toute validation qui compte se fait ici, côté serveur.
 * Une validation côté formulaire UI est un confort pour l'utilisateur, jamais
 * une garantie — le service métier revalide systématiquement via ces schémas.
 */

import { z } from "zod";

export const recordPaymentAllocationSchema = z.object({
  rentScheduleId: z.string().uuid(),
  amount: z.number().positive("Le montant alloué doit être strictement positif."),
});

export const recordPaymentSchema = z.object({
  tenantId: z.string().uuid(),
  leaseId: z.string().uuid(),
  methodId: z.string().uuid(),
  amount: z.number().positive("Le montant encaissé doit être strictement positif."),
  date: z.coerce.date(),
  reference: z.string().max(200).optional(),
  allocations: z
    .array(recordPaymentAllocationSchema)
    .min(1, "Un encaissement doit être ventilé sur au moins une échéance."),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
