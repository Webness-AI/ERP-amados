import { z } from "zod";

import { BUDGET_STATUSES } from "./budget.model";

const budgetItemSchema = z.object({
  description: z.string().trim().min(1).max(240),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
});

export const createBudgetSchema = z.object({
  clientId: z.string().min(1),
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2000).optional(),
  currency: z.string().trim().min(1).max(10).default("ARS"),
  items: z.array(budgetItemSchema).min(1),
  status: z
    .enum([
      BUDGET_STATUSES.DRAFT,
      BUDGET_STATUSES.SENT,
      BUDGET_STATUSES.REJECTED,
      BUDGET_STATUSES.CANCELED,
    ])
    .optional(),
});

export const reviseBudgetSchema = createBudgetSchema
  .omit({ clientId: true })
  .partial();

export const updateBudgetStatusSchema = z.object({
  status: z.enum([
    BUDGET_STATUSES.DRAFT,
    BUDGET_STATUSES.SENT,
    BUDGET_STATUSES.APPROVED,
    BUDGET_STATUSES.REJECTED,
    BUDGET_STATUSES.CANCELED,
  ]),
});

export const listBudgetsSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().trim().optional(),
  clientId: z.string().trim().optional(),
  status: z
    .enum([
      BUDGET_STATUSES.DRAFT,
      BUDGET_STATUSES.SENT,
      BUDGET_STATUSES.APPROVED,
      BUDGET_STATUSES.REJECTED,
      BUDGET_STATUSES.CANCELED,
    ])
    .optional(),
});

export type BudgetItemInput = z.infer<typeof budgetItemSchema>;
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type ReviseBudgetInput = z.infer<typeof reviseBudgetSchema>;
export type UpdateBudgetStatusInput = z.infer<typeof updateBudgetStatusSchema>;
export type ListBudgetsInput = z.infer<typeof listBudgetsSchema>;
