import { z } from "zod";

import { ACCOUNT_NATURES, RESULT_CLASSIFICATIONS } from "./account.model";

const accountNatureSchema = z.enum([
  ACCOUNT_NATURES.ACTIVO,
  ACCOUNT_NATURES.PASIVO,
  ACCOUNT_NATURES.PATRIMONIO_NETO,
  ACCOUNT_NATURES.RESULTADO,
]);

const resultClassificationSchema = z.enum([
  RESULT_CLASSIFICATIONS.GASTOS_PRODUCCION,
  RESULT_CLASSIFICATIONS.GASTOS_ADMIN_COMERCIAL,
  RESULT_CLASSIFICATIONS.GENERAL,
]);

export const createAccountSchema = z.object({
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(2).max(180),
  naturaleza: accountNatureSchema,
  resultClassification: resultClassificationSchema.nullish(),
  parentAccountId: z.string().trim().min(1).optional(),
  isActive: z.boolean().optional(),
}).superRefine((value, context) => {
  if (
    value.naturaleza === ACCOUNT_NATURES.RESULTADO &&
    !value.resultClassification
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["resultClassification"],
      message: "Result classification is required for RESULTADO accounts",
    });
  }

  if (
    value.naturaleza !== ACCOUNT_NATURES.RESULTADO &&
    value.resultClassification !== undefined &&
    value.resultClassification !== null
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["resultClassification"],
      message: "Result classification only applies to RESULTADO accounts",
    });
  }
});

export const updateAccountSchema = z
  .object({
    code: z.string().trim().min(1).max(30).optional(),
    name: z.string().trim().min(2).max(180).optional(),
    naturaleza: accountNatureSchema.optional(),
    resultClassification: resultClassificationSchema.nullish(),
    parentAccountId: z.string().trim().min(1).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    if (Object.keys(value).length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one field must be provided",
      });
      return;
    }

    if (
      value.naturaleza === ACCOUNT_NATURES.RESULTADO &&
      value.resultClassification === null
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["resultClassification"],
        message: "Result classification cannot be null for RESULTADO accounts",
      });
    }

    if (
      value.naturaleza !== undefined &&
      value.naturaleza !== ACCOUNT_NATURES.RESULTADO &&
      value.resultClassification !== undefined &&
      value.resultClassification !== null
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["resultClassification"],
        message: "Result classification only applies to RESULTADO accounts",
      });
    }
  });

export const listAccountsSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().trim().optional(),
  naturaleza: accountNatureSchema.optional(),
  resultClassification: resultClassificationSchema.optional(),
  activeOnly: z.enum(["true", "false"]).optional(),
  parentAccountId: z.string().trim().optional(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type ListAccountsInput = z.infer<typeof listAccountsSchema>;
