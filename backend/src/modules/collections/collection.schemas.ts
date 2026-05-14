import { z } from "zod";

import {
  COLLECTION_PAYMENT_METHODS,
  COLLECTION_STATUSES,
} from "./collection.model";

const collectionStatusSchema = z.enum([
  COLLECTION_STATUSES.PENDIENTE,
  COLLECTION_STATUSES.SENADO,
  COLLECTION_STATUSES.PARCIAL,
  COLLECTION_STATUSES.COBRADO,
  COLLECTION_STATUSES.VENCIDO,
]);

const paymentMethodSchema = z.enum([
  COLLECTION_PAYMENT_METHODS.EFECTIVO,
  COLLECTION_PAYMENT_METHODS.TRANSFERENCIA,
  COLLECTION_PAYMENT_METHODS.TARJETA,
  COLLECTION_PAYMENT_METHODS.CHEQUE,
  COLLECTION_PAYMENT_METHODS.OTRO,
]);

export const createCollectionSchema = z.object({
  clientId: z.string().min(1),
  projectId: z.string().min(1).optional(),
  totalAmount: z.number().positive(),
  laborAmountPending: z.number().min(0).default(0),
  currency: z.string().trim().min(1).max(12).default("ARS"),
  dueDate: z.string().datetime().optional(),
  notes: z.string().trim().max(1500).optional(),
});

export const registerCollectionPaymentSchema = z.object({
  amount: z.number().positive(),
  paymentMethod: paymentMethodSchema,
  paidAt: z.string().datetime().optional(),
  note: z.string().trim().max(1000).optional(),
});

export const listCollectionsSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  clientId: z.string().trim().optional(),
  projectId: z.string().trim().optional(),
  status: collectionStatusSchema.optional(),
  dueOnly: z.enum(["true", "false"]).optional(),
  overdueOnly: z.enum(["true", "false"]).optional(),
});

export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;
export type RegisterCollectionPaymentInput = z.infer<
  typeof registerCollectionPaymentSchema
>;
export type ListCollectionsInput = z.infer<typeof listCollectionsSchema>;
