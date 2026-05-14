import { Router } from "express";

import { authMiddleware } from "../../core/auth/auth.middleware";
import { authorizeMiddleware } from "../../core/auth/authorize.middleware";
import { AppError } from "../../core/errors/app-error";
import { ROLES } from "../auth/roles";
import {
  createProject,
  createProjectFromApprovedBudget,
  getProjectById,
  listProjects,
  softDeleteProject,
  updateProject,
  updateProjectStatus,
} from "./project.service";
import {
  createProjectFromBudgetSchema,
  createProjectSchema,
  listProjectsSchema,
  updateProjectSchema,
  updateProjectStatusSchema,
} from "./project.schemas";

const READ_ROLES = [ROLES.ADMIN_GENERAL, ROLES.ADMIN, ROLES.USER];
const WRITE_ROLES = [ROLES.ADMIN_GENERAL, ROLES.ADMIN];

const projectRouter = Router();

function requireRouteParam(value: unknown, paramName: string): string {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  throw new AppError(
    `Missing route param: ${paramName}`,
    400,
    "INVALID_ROUTE_PARAM",
  );
}

projectRouter.get(
  "/",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const query = listProjectsSchema.parse(req.query);
      const result = await listProjects(query);

      res.status(200).json({
        ok: true,
        data: result,
      });
    })().catch(next);
  },
);

projectRouter.get(
  "/:id",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const projectId = requireRouteParam(req.params.id, "id");
      const project = await getProjectById(projectId);

      res.status(200).json({
        ok: true,
        data: { project },
      });
    })().catch(next);
  },
);

projectRouter.post(
  "/",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const payload = createProjectSchema.parse(req.body);
      const project = await createProject(payload, { id: req.user!.id });

      res.status(201).json({
        ok: true,
        data: { project },
      });
    })().catch(next);
  },
);

projectRouter.post(
  "/from-budget/:budgetId",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const budgetId = requireRouteParam(req.params.budgetId, "budgetId");
      const payload = createProjectFromBudgetSchema.parse(req.body);
      const project = await createProjectFromApprovedBudget(budgetId, payload, {
        id: req.user!.id,
      });

      res.status(201).json({
        ok: true,
        data: { project },
      });
    })().catch(next);
  },
);

projectRouter.patch(
  "/:id",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const projectId = requireRouteParam(req.params.id, "id");
      const payload = updateProjectSchema.parse(req.body);
      const project = await updateProject(projectId, payload, {
        id: req.user!.id,
      });

      res.status(200).json({
        ok: true,
        data: { project },
      });
    })().catch(next);
  },
);

projectRouter.patch(
  "/:id/status",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const projectId = requireRouteParam(req.params.id, "id");
      const payload = updateProjectStatusSchema.parse(req.body);
      const project = await updateProjectStatus(projectId, payload, {
        id: req.user!.id,
      });

      res.status(200).json({
        ok: true,
        data: { project },
      });
    })().catch(next);
  },
);

projectRouter.delete(
  "/:id",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const projectId = requireRouteParam(req.params.id, "id");
      await softDeleteProject(projectId, { id: req.user!.id });

      res.status(200).json({
        ok: true,
        data: { message: "Project deleted" },
      });
    })().catch(next);
  },
);

export { projectRouter };
