import { z } from "zod";

import { DOMAIN_EVENTS } from "../../core/events/domain-events";

const journalEntryLineSchema = z
  .object({
    accountCode: z.string().trim().min(1).max(60),
    debit: z.number().min(0),
    credit: z.number().min(0),
    description: z.string().trim().max(500).optional(),
  })
  .refine((line) => line.debit > 0 || line.credit > 0, {
    message: "Each line must have debit or credit",
  })
  .refine((line) => !(line.debit > 0 && line.credit > 0), {
    message: "A line cannot have both debit and credit",
  });

export const createJournalEntrySchema = z.object({
  entryDate: z.string().datetime().optional(),
  description: z.string().trim().min(3).max(600),
  currency: z.string().trim().min(1).max(12).default("ARS"),
  lines: z.array(journalEntryLineSchema).min(2),
  originEvent: z
    .enum([
      DOMAIN_EVENTS.PRESUPUESTO_APROBADO,
      DOMAIN_EVENTS.MATERIAL_RESERVADO,
      DOMAIN_EVENTS.MATERIAL_ASIGNADO_A_PROYECTO,
      DOMAIN_EVENTS.STOCK_BAJO_DETECTADO,
      DOMAIN_EVENTS.LISTA_COMPRA_GENERADA,
      DOMAIN_EVENTS.COMPRA_RECIBIDA,
      DOMAIN_EVENTS.VENTA_CONFIRMADA,
      DOMAIN_EVENTS.CMV_REGISTRADO,
      DOMAIN_EVENTS.PAGO_RECIBIDO,
      DOMAIN_EVENTS.GASTO_FIJO_PROGRAMADO,
      DOMAIN_EVENTS.GASTO_PAGADO,
      DOMAIN_EVENTS.VENCIMIENTO_PROXIMO_DETECTADO,
      DOMAIN_EVENTS.VENCIMIENTO_VENCIDO_DETECTADO,
      DOMAIN_EVENTS.PROYECTO_FINALIZADO,
    ])
    .optional(),
  originEntityType: z.string().trim().max(80).optional(),
  originEntityId: z.string().trim().max(120).optional(),
  correlationId: z.string().trim().max(180).optional(),
});

export const reverseJournalEntrySchema = z.object({
  reason: z.string().trim().min(3).max(300),
});

export const listJournalEntriesSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  originEvent: z
    .enum([
      DOMAIN_EVENTS.PRESUPUESTO_APROBADO,
      DOMAIN_EVENTS.MATERIAL_RESERVADO,
      DOMAIN_EVENTS.MATERIAL_ASIGNADO_A_PROYECTO,
      DOMAIN_EVENTS.STOCK_BAJO_DETECTADO,
      DOMAIN_EVENTS.LISTA_COMPRA_GENERADA,
      DOMAIN_EVENTS.COMPRA_RECIBIDA,
      DOMAIN_EVENTS.VENTA_CONFIRMADA,
      DOMAIN_EVENTS.CMV_REGISTRADO,
      DOMAIN_EVENTS.PAGO_RECIBIDO,
      DOMAIN_EVENTS.GASTO_FIJO_PROGRAMADO,
      DOMAIN_EVENTS.GASTO_PAGADO,
      DOMAIN_EVENTS.VENCIMIENTO_PROXIMO_DETECTADO,
      DOMAIN_EVENTS.VENCIMIENTO_VENCIDO_DETECTADO,
      DOMAIN_EVENTS.PROYECTO_FINALIZADO,
    ])
    .optional(),
  originEntityType: z.string().trim().optional(),
  originEntityId: z.string().trim().optional(),
  accountCode: z.string().trim().optional(),
  search: z.string().trim().optional(),
});

export const reportRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const generalLedgerQuerySchema = z.object({
  accountCode: z.string().trim().min(1).max(60),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;
export type ReverseJournalEntryInput = z.infer<
  typeof reverseJournalEntrySchema
>;
export type ListJournalEntriesInput = z.infer<typeof listJournalEntriesSchema>;
export type ReportRangeInput = z.infer<typeof reportRangeSchema>;
export type GeneralLedgerQueryInput = z.infer<typeof generalLedgerQuerySchema>;
