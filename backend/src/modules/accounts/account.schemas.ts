import { z } from "zod";

import { ACCOUNT_TYPES } from "./account.model";

const accountTypeSchema = z.enum([
  ACCOUNT_TYPES.ASSET,
  ACCOUNT_TYPES.LIABILITY,
  ACCOUNT_TYPES.EQUITY,
  ACCOUNT_TYPES.INCOME,
  ACCOUNT_TYPES.EXPENSE,
]);

export const createAccountSchema = z.object({
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(2).max(180),
  type: accountTypeSchema,
  parentAccountId: z.string().trim().min(1).optional(),
  isActive: z.boolean().optional(),
});

export const updateAccountSchema = z
  .object({
    code: z.string().trim().min(1).max(30).optional(),
    name: z.string().trim().min(2).max(180).optional(),
    type: accountTypeSchema.optional(),
    parentAccountId: z.string().trim().min(1).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const listAccountsSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().trim().optional(),
  type: accountTypeSchema.optional(),
  activeOnly: z.enum(["true", "false"]).optional(),
  parentAccountId: z.string().trim().optional(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type ListAccountsInput = z.infer<typeof listAccountsSchema>;
