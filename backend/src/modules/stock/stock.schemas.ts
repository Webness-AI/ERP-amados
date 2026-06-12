import { z } from "zod";

import { MATERIAL_CATEGORIES } from "./material.model";
import { STOCK_MOVEMENT_TYPES } from "./stock-movement.model";

const materialCategorySchema = z.enum([
  MATERIAL_CATEGORIES.MADERA,
  MATERIAL_CATEGORIES.HERRAJES,
  MATERIAL_CATEGORIES.OTROS,
]);

const stockMovementTypeSchema = z.enum([
  STOCK_MOVEMENT_TYPES.INGRESO,
  STOCK_MOVEMENT_TYPES.RESERVA,
  STOCK_MOVEMENT_TYPES.CONSUMO,
  STOCK_MOVEMENT_TYPES.AJUSTE,
  STOCK_MOVEMENT_TYPES.DEVOLUCION,
]);

export const createMaterialSchema = z.object({
  sku: z.string().trim().min(1).max(60),
  name: z.string().trim().min(2).max(180).optional(),
  supplierId: z.string().trim().min(1).max(60),
  category: materialCategorySchema,
  type: z.string().trim().min(1).max(80).optional(),
  color: z.string().trim().min(1).max(80).optional(),
  note: z.string().trim().max(1000).optional(),
  unit: z.string().trim().min(1).max(30).default("u"),
  unitPrice: z.number().min(0).default(0),
  minStock: z.number().min(0).default(0),
});

export const updateMaterialSchema = z
  .object({
    name: z.string().trim().min(2).max(180).optional(),
    category: materialCategorySchema.optional(),
    sku: z.string().trim().min(1).max(60).nullable().optional(),
    supplierId: z.string().trim().min(1).max(60).optional(),
    type: z.string().trim().min(1).max(80).optional(),
    color: z.string().trim().min(1).max(80).optional(),
    note: z.string().trim().max(1000).optional(),
    unit: z.string().trim().min(1).max(30).optional(),
    unitPrice: z.number().min(0).optional(),
    minStock: z.number().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const listMaterialsSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().trim().optional(),
  category: materialCategorySchema.optional(),
  activeOnly: z.enum(["true", "false"]).optional(),
  lowStockOnly: z.enum(["true", "false"]).optional(),
});

export const registerStockMovementSchema = z.object({
  materialId: z.string().min(1),
  type: stockMovementTypeSchema,
  quantity: z.number().positive(),
  unitCost: z.number().min(0).optional(),
  projectId: z.string().min(1).optional(),
  note: z.string().trim().max(1000).optional(),
});

export const upsertProjectMaterialRequirementSchema = z.object({
  projectId: z.string().min(1),
  materialId: z.string().min(1),
  requiredQuantity: z.number().positive(),
});

export const listProjectMaterialRequirementsSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  projectId: z.string().trim().optional(),
  materialId: z.string().trim().optional(),
});

export const reserveMaterialForProjectSchema = z.object({
  quantity: z.number().positive(),
});

export const listPurchaseSuggestionsSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  category: materialCategorySchema.optional(),
  search: z.string().trim().optional(),
});

export const listPurchaseRecommendationsSchema = z.object({
  projectId: z.string().trim().optional(),
  search: z.string().trim().optional(),
});

export const listStockMovementsSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  materialId: z.string().trim().optional(),
  projectId: z.string().trim().optional(),
  type: stockMovementTypeSchema.optional(),
});

export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>;
export type ListMaterialsInput = z.infer<typeof listMaterialsSchema>;
export type RegisterStockMovementInput = z.infer<
  typeof registerStockMovementSchema
>;
export type ListStockMovementsInput = z.infer<typeof listStockMovementsSchema>;
export type UpsertProjectMaterialRequirementInput = z.infer<
  typeof upsertProjectMaterialRequirementSchema
>;
export type ListProjectMaterialRequirementsInput = z.infer<
  typeof listProjectMaterialRequirementsSchema
>;
export type ReserveMaterialForProjectInput = z.infer<
  typeof reserveMaterialForProjectSchema
>;
export type ListPurchaseSuggestionsInput = z.infer<
  typeof listPurchaseSuggestionsSchema
>;
export type ListPurchaseRecommendationsInput = z.infer<
  typeof listPurchaseRecommendationsSchema
>;
