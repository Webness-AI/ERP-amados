import { Router } from "express";

import { authMiddleware } from "../../core/auth/auth.middleware";
import { authorizeMiddleware } from "../../core/auth/authorize.middleware";
import { AppError } from "../../core/errors/app-error";
import { ROLES } from "../auth/roles";
import {
  acceptBudgetWithDiscount,
  acceptBudgetAndCreateProject,
  applyBudgetRecalculation,
  createBudget,
  getBudgetMaterialPriceSuggestion,
  getBudgetPricingAuditTrail,
  getBudgetById,
  listBudgets,
  recalculateBudgetPricing,
  rejectBudgetWithDiscount,
  reviseBudget,
  softDeleteBudget,
  updateBudgetStatus,
} from "./budget.service";
import {
  acceptBudgetSchema,
  acceptBudgetWithDiscountSchema,
  createBudgetSchema,
  listBudgetsSchema,
  rejectBudgetSchema,
  reviseBudgetSchema,
  updateBudgetStatusSchema,
} from "./budget.schemas";

const READ_ROLES = [ROLES.ADMIN_GENERAL, ROLES.ADMIN, ROLES.USER];
const WRITE_ROLES = [ROLES.ADMIN_GENERAL, ROLES.ADMIN];

const budgetRouter = Router();

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

budgetRouter.get(
  "/",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const query = listBudgetsSchema.parse(req.query);
      const result = await listBudgets(query);

      res.status(200).json({
        ok: true,
        data: result,
      });
    })().catch(next);
  },
);

budgetRouter.get(
  "/materials/:materialId/price-suggestion",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const materialId = requireRouteParam(req.params.materialId, "materialId");
      const suggestion = await getBudgetMaterialPriceSuggestion(materialId);

      res.status(200).json({
        ok: true,
        data: suggestion,
      });
    })().catch(next);
  },
);

budgetRouter.get(
  "/:id/audit-trail",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const budgetId = requireRouteParam(req.params.id, "id");
      const trail = await getBudgetPricingAuditTrail(budgetId);

      res.status(200).json({
        ok: true,
        data: { trail },
      });
    })().catch(next);
  },
);

budgetRouter.get(
  "/:id",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const budgetId = requireRouteParam(req.params.id, "id");
      const budget = await getBudgetById(budgetId);

      res.status(200).json({
        ok: true,
        data: { budget },
      });
    })().catch(next);
  },
);

budgetRouter.post(
  "/",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const payload = createBudgetSchema.parse(req.body);
      const budget = await createBudget(payload, { id: req.user!.id });

      res.status(201).json({
        ok: true,
        data: { budget },
      });
    })().catch(next);
  },
);

budgetRouter.post(
  "/:id/revisions",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const budgetId = requireRouteParam(req.params.id, "id");
      const payload = reviseBudgetSchema.parse(req.body);
      const budget = await reviseBudget(budgetId, payload, {
        id: req.user!.id,
      });

      res.status(201).json({
        ok: true,
        data: { budget },
      });
    })().catch(next);
  },
);

budgetRouter.patch(
  "/:id/status",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const budgetId = requireRouteParam(req.params.id, "id");
      const payload = updateBudgetStatusSchema.parse(req.body);
      const budget = await updateBudgetStatus(budgetId, payload, {
        id: req.user!.id,
      });

      res.status(200).json({
        ok: true,
        data: { budget },
      });
    })().catch(next);
  },
);

budgetRouter.post(
  "/:id/accept",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const budgetId = requireRouteParam(req.params.id, "id");
      const payload = acceptBudgetSchema.parse(req.body);
      const result = await acceptBudgetAndCreateProject(budgetId, payload, {
        id: req.user!.id,
      });

      res.status(200).json({
        ok: true,
        data: result,
      });
    })().catch(next);
  },
);

budgetRouter.post(
  "/:id/accept-with-discount",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const budgetId = requireRouteParam(req.params.id, "id");
      const payload = acceptBudgetWithDiscountSchema.parse(req.body);
      const result = await acceptBudgetWithDiscount(budgetId, payload, {
        id: req.user!.id,
      });

      res.status(200).json({
        ok: true,
        data: result,
      });
    })().catch(next);
  },
);

budgetRouter.post(
  "/:id/recalculate/apply",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const budgetId = requireRouteParam(req.params.id, "id");
      const result = await applyBudgetRecalculation(budgetId, {
        id: req.user!.id,
      });

      res.status(200).json({
        ok: true,
        data: result,
      });
    })().catch(next);
  },
);

budgetRouter.post(
  "/:id/recalculate",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const budgetId = requireRouteParam(req.params.id, "id");
      const result = await recalculateBudgetPricing(budgetId, {
        id: req.user!.id,
      });

      res.status(200).json({
        ok: true,
        data: result,
      });
    })().catch(next);
  },
);

budgetRouter.post(
  "/:id/reject",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const budgetId = requireRouteParam(req.params.id, "id");
      const payload = rejectBudgetSchema.parse(req.body);
      const budget = await rejectBudgetWithDiscount(budgetId, payload, {
        id: req.user!.id,
      });

      res.status(200).json({
        ok: true,
        data: { budget },
      });
    })().catch(next);
  },
);

budgetRouter.delete(
  "/:id",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const budgetId = requireRouteParam(req.params.id, "id");
      await softDeleteBudget(budgetId, { id: req.user!.id });

      res.status(200).json({
        ok: true,
        data: { message: "Budget deleted" },
      });
    })().catch(next);
  },
);

export { budgetRouter };
