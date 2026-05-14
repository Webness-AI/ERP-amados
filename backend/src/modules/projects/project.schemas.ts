import { z } from "zod";

import { PROJECT_STATUSES } from "./project.model";

export const createProjectSchema = z.object({
  clientId: z.string().min(1),
  budgetId: z.string().min(1).optional(),
  name: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2000).optional(),
  status: z
    .enum([
      PROJECT_STATUSES.CONSULTA,
      PROJECT_STATUSES.PRESUPUESTADO,
      PROJECT_STATUSES.APROBADO,
      PROJECT_STATUSES.COMPRADO,
      PROJECT_STATUSES.PRODUCCION,
      PROJECT_STATUSES.INSTALACION,
      PROJECT_STATUSES.PAUSADO,
      PROJECT_STATUSES.FINALIZADO,
      PROJECT_STATUSES.CANCELADO,
    ])
    .optional(),
  deliveryDate: z.string().datetime().optional(),
});

export const updateProjectSchema = createProjectSchema
  .omit({ clientId: true })
  .partial();

export const updateProjectStatusSchema = z.object({
  status: z.enum([
    PROJECT_STATUSES.CONSULTA,
    PROJECT_STATUSES.PRESUPUESTADO,
    PROJECT_STATUSES.APROBADO,
    PROJECT_STATUSES.COMPRADO,
    PROJECT_STATUSES.PRODUCCION,
    PROJECT_STATUSES.INSTALACION,
    PROJECT_STATUSES.PAUSADO,
    PROJECT_STATUSES.FINALIZADO,
    PROJECT_STATUSES.CANCELADO,
  ]),
});

export const createProjectFromBudgetSchema = z.object({
  name: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2000).optional(),
  deliveryDate: z.string().datetime().optional(),
});

export const listProjectsSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().trim().optional(),
  clientId: z.string().trim().optional(),
  status: z
    .enum([
      PROJECT_STATUSES.CONSULTA,
      PROJECT_STATUSES.PRESUPUESTADO,
      PROJECT_STATUSES.APROBADO,
      PROJECT_STATUSES.COMPRADO,
      PROJECT_STATUSES.PRODUCCION,
      PROJECT_STATUSES.INSTALACION,
      PROJECT_STATUSES.PAUSADO,
      PROJECT_STATUSES.FINALIZADO,
      PROJECT_STATUSES.CANCELADO,
    ])
    .optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type UpdateProjectStatusInput = z.infer<
  typeof updateProjectStatusSchema
>;
export type CreateProjectFromBudgetInput = z.infer<
  typeof createProjectFromBudgetSchema
>;
export type ListProjectsInput = z.infer<typeof listProjectsSchema>;
