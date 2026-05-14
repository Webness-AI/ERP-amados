export const ROLES = {
  ADMIN_GENERAL: "ADMIN_GENERAL",
  ADMIN: "ADMIN",
  USER: "USER",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
