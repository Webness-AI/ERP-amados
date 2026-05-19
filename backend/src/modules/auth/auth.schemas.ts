import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email().max(120),
  password: z.string().min(8).max(128),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(8).max(128),
    newPassword: z.string().min(8).max(128),
  })
  .refine((value) => value.oldPassword !== value.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
