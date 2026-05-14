import { z } from "zod";

import {
  CASH_DIRECTIONS,
  CASH_PAYMENT_METHODS,
  CASH_SOURCES,
} from "./cash-movement.model";

const cashSourceSchema = z.enum([CASH_SOURCES.CASH, CASH_SOURCES.BANK]);
const cashDirectionSchema = z.enum([
  CASH_DIRECTIONS.INCOME,
  CASH_DIRECTIONS.EXPENSE,
]);
const paymentMethodSchema = z.enum([
  CASH_PAYMENT_METHODS.EFECTIVO,
  CASH_PAYMENT_METHODS.TRANSFERENCIA,
  CASH_PAYMENT_METHODS.TARJETA,
  CASH_PAYMENT_METHODS.CHEQUE,
  CASH_PAYMENT_METHODS.OTRO,
]);

export const createCashMovementSchema = z.object({
  source: cashSourceSchema,
  direction: cashDirectionSchema,
  paymentMethod: paymentMethodSchema.default(CASH_PAYMENT_METHODS.EFECTIVO),
  amount: z.number().positive(),
  currency: z.string().trim().min(1).max(12).default("ARS"),
  concept: z.string().trim().min(2).max(280),
  clientId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  referenceType: z.string().trim().max(80).optional(),
  referenceId: z.string().trim().max(120).optional(),
  occurredAt: z.string().datetime().optional(),
});

export const listCashMovementsSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  source: cashSourceSchema.optional(),
  direction: cashDirectionSchema.optional(),
  paymentMethod: paymentMethodSchema.optional(),
  referenceType: z.string().trim().optional(),
  referenceId: z.string().trim().optional(),
  search: z.string().trim().optional(),
});

export type CreateCashMovementInput = z.infer<typeof createCashMovementSchema>;
export type ListCashMovementsInput = z.infer<typeof listCashMovementsSchema>;
