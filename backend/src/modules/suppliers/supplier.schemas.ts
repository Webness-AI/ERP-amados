import { z } from "zod";

export const createSupplierSchema = z.object({
  name: z.string().trim().min(2).max(180),
  contactName: z.string().trim().min(2).max(140).optional(),
  email: z.string().trim().email().max(140).optional(),
  phone: z.string().trim().min(3).max(60).optional(),
  notes: z.string().trim().max(1200).optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

export const listSuppliersSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().trim().optional(),
  activeOnly: z.enum(["true", "false"]).optional(),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type ListSuppliersInput = z.infer<typeof listSuppliersSchema>;
