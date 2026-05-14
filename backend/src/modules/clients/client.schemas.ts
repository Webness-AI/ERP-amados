import { z } from "zod";

export const createClientSchema = z.object({
  name: z.string().trim().min(2).max(140),
  contactName: z.string().trim().min(2).max(140).optional(),
  email: z.string().trim().email().max(120).optional(),
  phone: z.string().trim().min(3).max(40).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const updateClientSchema = createClientSchema.partial();

export const listClientsSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().trim().optional(),
  activeOnly: z.enum(["true", "false"]).optional(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type ListClientsInput = z.infer<typeof listClientsSchema>;
