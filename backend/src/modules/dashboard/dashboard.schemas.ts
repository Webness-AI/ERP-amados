import { z } from "zod";

export const dashboardOverviewQuerySchema = z
  .object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  })
  .strict();

export const dashboardAlertsQuerySchema = z
  .object({
    horizonHours: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
  })
  .strict();

export type DashboardOverviewQuery = z.infer<
  typeof dashboardOverviewQuerySchema
>;
export type DashboardAlertsQuery = z.infer<typeof dashboardAlertsQuerySchema>;
