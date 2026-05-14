import { Router } from "express";

import { authMiddleware } from "../../core/auth/auth.middleware";
import { authorizeMiddleware } from "../../core/auth/authorize.middleware";
import { AppError } from "../../core/errors/app-error";
import { ROLES } from "../auth/roles";
import {
  createFixedExpense,
  getFixedExpenseById,
  listFixedExpenses,
  payFixedExpense,
  refreshFixedExpenseAlerts,
  softDeleteFixedExpense,
  updateFixedExpense,
} from "./fixed-expense.service";
import {
  createFixedExpenseSchema,
  listFixedExpensesSchema,
  payFixedExpenseSchema,
  updateFixedExpenseSchema,
} from "./fixed-expense.schemas";

const fixedExpenseRouter = Router();
const READ_ROLES = [ROLES.ADMIN_GENERAL, ROLES.ADMIN, ROLES.USER];
const WRITE_ROLES = [ROLES.ADMIN_GENERAL, ROLES.ADMIN];

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

fixedExpenseRouter.get(
  "/",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const query = listFixedExpensesSchema.parse(req.query);
      const result = await listFixedExpenses(query);

      res.status(200).json({
        ok: true,
        data: result,
      });
    })().catch(next);
  },
);

fixedExpenseRouter.get(
  "/:id",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const expenseId = requireRouteParam(req.params.id, "id");
      const expense = await getFixedExpenseById(expenseId);

      res.status(200).json({
        ok: true,
        data: { expense },
      });
    })().catch(next);
  },
);

fixedExpenseRouter.post(
  "/",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const payload = createFixedExpenseSchema.parse(req.body);
      const expense = await createFixedExpense(payload, { id: req.user!.id });

      res.status(201).json({
        ok: true,
        data: { expense },
      });
    })().catch(next);
  },
);

fixedExpenseRouter.patch(
  "/:id",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const expenseId = requireRouteParam(req.params.id, "id");
      const payload = updateFixedExpenseSchema.parse(req.body);
      const expense = await updateFixedExpense(expenseId, payload, {
        id: req.user!.id,
      });

      res.status(200).json({
        ok: true,
        data: { expense },
      });
    })().catch(next);
  },
);

fixedExpenseRouter.post(
  "/:id/pay",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const expenseId = requireRouteParam(req.params.id, "id");
      const payload = payFixedExpenseSchema.parse(req.body);
      const expense = await payFixedExpense(expenseId, payload, {
        id: req.user!.id,
      });

      res.status(200).json({
        ok: true,
        data: { expense },
      });
    })().catch(next);
  },
);

fixedExpenseRouter.post(
  "/refresh-alerts",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const result = await refreshFixedExpenseAlerts({ id: req.user!.id });

      res.status(200).json({
        ok: true,
        data: result,
      });
    })().catch(next);
  },
);

fixedExpenseRouter.delete(
  "/:id",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const expenseId = requireRouteParam(req.params.id, "id");
      await softDeleteFixedExpense(expenseId, { id: req.user!.id });

      res.status(200).json({
        ok: true,
        data: { message: "Fixed expense deleted" },
      });
    })().catch(next);
  },
);

export { fixedExpenseRouter };
