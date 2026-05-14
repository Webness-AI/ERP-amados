import { z } from "zod";

import { ROLES } from "../auth/roles";

const roleSchema = z.enum([ROLES.ADMIN_GENERAL, ROLES.ADMIN, ROLES.USER]);

export const createUserSchema = z.object({
  firstName: z.string().trim().min(2).max(120),
  lastName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(128),
  role: roleSchema.default(ROLES.USER),
});

export const updateUserSchema = z
  .object({
    firstName: z.string().trim().min(2).max(120).optional(),
    lastName: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().email().max(200).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const updateUserRoleSchema = z.object({
  role: roleSchema,
});

export const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
});

export const resetUserPasswordSchema = z.object({
  newPassword: z.string().min(8).max(128),
});

export const listUsersSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().trim().optional(),
  role: roleSchema.optional(),
  activeOnly: z.enum(["true", "false"]).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type ResetUserPasswordInput = z.infer<typeof resetUserPasswordSchema>;
export type ListUsersInput = z.infer<typeof listUsersSchema>;
