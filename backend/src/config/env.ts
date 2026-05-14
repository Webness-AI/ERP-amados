import "dotenv/config";

import { z } from "zod";

const rawEnv = { ...process.env };

if (!rawEnv.MONGO_URI && rawEnv.MONGODB_URI) {
  rawEnv.MONGO_URI = rawEnv.MONGODB_URI;
}

if (!rawEnv.JWT_ACCESS_SECRET && rawEnv.JWT_SECRET) {
  rawEnv.JWT_ACCESS_SECRET = rawEnv.JWT_SECRET;
}

if (!rawEnv.JWT_REFRESH_SECRET && rawEnv.JWT_SECRET) {
  rawEnv.JWT_REFRESH_SECRET = rawEnv.JWT_SECRET;
}

if (!rawEnv.JWT_ACCESS_EXPIRES_IN && rawEnv.JWT_EXPIRES_IN) {
  rawEnv.JWT_ACCESS_EXPIRES_IN = rawEnv.JWT_EXPIRES_IN;
}

if (!rawEnv.JWT_REFRESH_EXPIRES_IN && rawEnv.JWT_EXPIRES_IN) {
  rawEnv.JWT_REFRESH_EXPIRES_IN = rawEnv.JWT_EXPIRES_IN;
}

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGO_URI: z.string().min(1).default("mongodb://127.0.0.1:27017/erp_amados"),
  JWT_ACCESS_SECRET: z.string().min(16).default("change-me-access-secret"),
  JWT_REFRESH_SECRET: z.string().min(16).default("change-me-refresh-secret"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(8).max(14).default(10),
  CORS_ORIGIN: z
    .string()
    .default("http://localhost:5173,http://localhost:5174"),
  DASHBOARD_ALERTS_SCHEDULER_ENABLED: z
    .string()
    .default("true")
    .transform((value) => value.toLowerCase() !== "false"),
  DASHBOARD_ALERTS_REFRESH_EVERY_MINUTES: z.coerce
    .number()
    .int()
    .min(1)
    .max(24 * 60)
    .default(15),
  DASHBOARD_ALERTS_RUN_ON_STARTUP: z
    .string()
    .default("true")
    .transform((value) => value.toLowerCase() !== "false"),
});

const parsedEnv = envSchema.safeParse(rawEnv);

if (!parsedEnv.success) {
  const formattedErrors = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment variables: ${formattedErrors}`);
}

export const env = parsedEnv.data;

export const corsOrigins = env.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);
