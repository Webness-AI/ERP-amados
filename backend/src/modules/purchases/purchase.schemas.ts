import { z } from "zod";

import { PURCHASE_STATUSES } from "./purchase.model";

const purchaseItemSchema = z.object({
  materialId: z.string().min(1),
  quantityOrdered: z.number().positive(),
  unitCost: z.number().min(0),
});

const purchaseStatusSchema = z.enum([
  PURCHASE_STATUSES.DRAFT,
  PURCHASE_STATUSES.ORDERED,
  PURCHASE_STATUSES.PARTIALLY_RECEIVED,
  PURCHASE_STATUSES.RECEIVED,
  PURCHASE_STATUSES.CANCELED,
]);

export const createPurchaseSchema = z.object({
  supplierId: z.string().min(1),
  projectId: z.string().min(1).optional(),
  currency: z.string().trim().min(1).max(12).default("ARS"),
  notes: z.string().trim().max(2000).optional(),
  items: z.array(purchaseItemSchema).min(1),
  status: z
    .enum([PURCHASE_STATUSES.DRAFT, PURCHASE_STATUSES.ORDERED])
    .optional(),
});

export const updatePurchaseStatusSchema = z.object({
  status: purchaseStatusSchema,
});

export const receivePurchaseSchema = z.object({
  receivedItems: z
    .array(
      z.object({
        materialId: z.string().min(1),
        quantityReceived: z.number().positive(),
      }),
    )
    .min(1),
  note: z.string().trim().max(1000).optional(),
});

export const listPurchasesSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().trim().optional(),
  supplierId: z.string().trim().optional(),
  projectId: z.string().trim().optional(),
  status: purchaseStatusSchema.optional(),
});

export type PurchaseItemInput = z.infer<typeof purchaseItemSchema>;
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
export type UpdatePurchaseStatusInput = z.infer<
  typeof updatePurchaseStatusSchema
>;
export type ReceivePurchaseInput = z.infer<typeof receivePurchaseSchema>;
export type ListPurchasesInput = z.infer<typeof listPurchasesSchema>;
