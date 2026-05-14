import { z } from "zod";

import {
  FIXED_EXPENSE_FREQUENCIES,
  FIXED_EXPENSE_STATUSES,
} from "./fixed-expense.model";

const fixedExpenseFrequencySchema = z.enum([
  FIXED_EXPENSE_FREQUENCIES.MENSUAL,
  FIXED_EXPENSE_FREQUENCIES.BIMESTRAL,
  FIXED_EXPENSE_FREQUENCIES.TRIMESTRAL,
  FIXED_EXPENSE_FREQUENCIES.ANUAL,
]);

const fixedExpenseStatusSchema = z.enum([
  FIXED_EXPENSE_STATUSES.ACTIVO,
  FIXED_EXPENSE_STATUSES.PAUSADO,
]);

export const createFixedExpenseSchema = z.object({
  name: z.string().trim().min(2).max(220),
  amount: z.number().positive(),
  currency: z.string().trim().min(1).max(12).default("ARS"),
  frequency: fixedExpenseFrequencySchema.default(
    FIXED_EXPENSE_FREQUENCIES.MENSUAL,
  ),
  nextDueDate: z.string().datetime(),
  notes: z.string().trim().max(1500).optional(),
});

export const updateFixedExpenseSchema = z
  .object({
    name: z.string().trim().min(2).max(220).optional(),
    amount: z.number().positive().optional(),
    currency: z.string().trim().min(1).max(12).optional(),
    frequency: fixedExpenseFrequencySchema.optional(),
    status: fixedExpenseStatusSchema.optional(),
    nextDueDate: z.string().datetime().optional(),
    notes: z.string().trim().max(1500).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const payFixedExpenseSchema = z.object({
  amount: z.number().positive().optional(),
  paidAt: z.string().datetime().optional(),
  note: z.string().trim().max(1000).optional(),
});

export const listFixedExpensesSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: fixedExpenseStatusSchema.optional(),
  dueOnly: z.enum(["true", "false"]).optional(),
  overdueOnly: z.enum(["true", "false"]).optional(),
  search: z.string().trim().optional(),
});

export type CreateFixedExpenseInput = z.infer<typeof createFixedExpenseSchema>;
export type UpdateFixedExpenseInput = z.infer<typeof updateFixedExpenseSchema>;
export type PayFixedExpenseInput = z.infer<typeof payFixedExpenseSchema>;
export type ListFixedExpensesInput = z.infer<typeof listFixedExpensesSchema>;
