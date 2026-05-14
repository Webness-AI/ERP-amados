import { z } from "zod";

import {
  PRODUCTION_PRIORITIES,
  PRODUCTION_STATUSES,
} from "./production-order.model";

const productionStatusSchema = z.enum([
  PRODUCTION_STATUSES.PENDIENTE,
  PRODUCTION_STATUSES.CORTE,
  PRODUCTION_STATUSES.ARMADO,
  PRODUCTION_STATUSES.INSTALACION,
  PRODUCTION_STATUSES.FINALIZADO,
]);

const productionPrioritySchema = z.enum([
  PRODUCTION_PRIORITIES.LOW,
  PRODUCTION_PRIORITIES.MEDIUM,
  PRODUCTION_PRIORITIES.HIGH,
]);

export const createProductionOrderSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().min(2).max(200),
  priority: productionPrioritySchema.default(PRODUCTION_PRIORITIES.MEDIUM),
  assigneeName: z.string().trim().min(2).max(140).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const updateProductionOrderSchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    priority: productionPrioritySchema.optional(),
    assigneeName: z.string().trim().min(2).max(140).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const updateProductionOrderStatusSchema = z.object({
  status: productionStatusSchema,
});

export const listProductionOrdersSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  projectId: z.string().trim().optional(),
  status: productionStatusSchema.optional(),
  priority: productionPrioritySchema.optional(),
  search: z.string().trim().optional(),
});

export type CreateProductionOrderInput = z.infer<
  typeof createProductionOrderSchema
>;
export type UpdateProductionOrderInput = z.infer<
  typeof updateProductionOrderSchema
>;
export type UpdateProductionOrderStatusInput = z.infer<
  typeof updateProductionOrderStatusSchema
>;
export type ListProductionOrdersInput = z.infer<
  typeof listProductionOrdersSchema
>;
