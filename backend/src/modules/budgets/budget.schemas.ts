import { z } from "zod";

import { BUDGET_MARGIN_TYPES, BUDGET_STATUSES } from "./budget.model";

const budgetItemSchema = z.object({
  description: z.string().trim().min(1).max(240),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0).optional(),
});

const budgetMaterialSchema = z.object({
  materialId: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0).optional(),
});

export const createBudgetSchema = z.object({
  clientId: z.string().min(1).optional(),
  prospectName: z.string().trim().min(2).max(180).optional(),
  prospectContactName: z.string().trim().min(2).max(180).optional(),
  prospectEmail: z.string().trim().email().max(120).optional(),
  prospectPhone: z.string().trim().max(40).optional(),
  prospectNotes: z.string().trim().max(1000).optional(),
  prospectLocalidad: z.string().trim().max(180).optional(),
  prospectContacto: z.string().trim().max(140).optional(),
  prospectDireccion: z.string().trim().max(500).optional(),
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2000).optional(),
  currency: z.string().trim().min(1).max(10).default("ARS"),
  items: z.array(budgetItemSchema).default([]),
  materials: z.array(budgetMaterialSchema).default([]),
  laborHours: z.number().min(0).default(0),
  laborCost: z.number().min(0).default(0),
  hourlyRate: z.number().min(0).default(0),
  sellerCommission: z.number().min(0).default(0),
  employeeBonus: z.number().min(0).default(0),
  shippingCost: z.number().min(0).default(0),
  packagingCost: z.number().min(0).default(0),
  marginType: z
    .enum([BUDGET_MARGIN_TYPES.COMUN_40, BUDGET_MARGIN_TYPES.COCINA_55])
    .default(BUDGET_MARGIN_TYPES.COMUN_40),
  enableCommercialPricing: z.boolean().optional(),
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

export const acceptBudgetSchema = z.object({
  clientName: z.string().trim().min(2).max(140).optional(),
  contactName: z.string().trim().min(2).max(140).optional(),
  email: z.string().trim().email().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(1000).optional(),
  projectName: z.string().trim().min(2).max(180).optional(),
  projectDescription: z.string().trim().max(2000).optional(),
  projectDeliveryDate: z.string().datetime().optional(),
  collectionDueDate: z.string().datetime().optional(),
  collectionNotes: z.string().trim().max(1500).optional(),
});

export const acceptBudgetWithDiscountSchema = acceptBudgetSchema;

export const rejectBudgetSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

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
export type BudgetMaterialInput = z.infer<typeof budgetMaterialSchema>;
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type ReviseBudgetInput = z.infer<typeof reviseBudgetSchema>;
export type AcceptBudgetInput = z.infer<typeof acceptBudgetSchema>;
export type AcceptBudgetWithDiscountInput = z.infer<
  typeof acceptBudgetWithDiscountSchema
>;
export type RejectBudgetInput = z.infer<typeof rejectBudgetSchema>;
export type UpdateBudgetStatusInput = z.infer<typeof updateBudgetStatusSchema>;
export type ListBudgetsInput = z.infer<typeof listBudgetsSchema>;
