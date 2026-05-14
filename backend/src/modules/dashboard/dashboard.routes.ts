import { Router } from "express";

import { authMiddleware } from "../../core/auth/auth.middleware";
import { authorizeMiddleware } from "../../core/auth/authorize.middleware";
import { ROLES } from "../auth/roles";
import { getDashboardAlertsSchedulerStatus } from "./dashboard-alerts.scheduler";
import {
  dashboardAlertsQuerySchema,
  dashboardOverviewQuerySchema,
} from "./dashboard.schemas";
import {
  getDashboardAlerts,
  getDashboardOverview,
  refreshDashboardAlerts,
} from "./dashboard.service";

const dashboardRouter = Router();
const READ_ROLES = [ROLES.ADMIN_GENERAL, ROLES.ADMIN, ROLES.USER];
const WRITE_ROLES = [ROLES.ADMIN_GENERAL, ROLES.ADMIN];

dashboardRouter.get(
  "/overview",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const query = dashboardOverviewQuerySchema.parse(req.query);
      const data = await getDashboardOverview(query);

      res.status(200).json({
        ok: true,
        data,
      });
    })().catch(next);
  },
);

dashboardRouter.get(
  "/alerts",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const query = dashboardAlertsQuerySchema.parse(req.query);
      const data = await getDashboardAlerts(query);

      res.status(200).json({
        ok: true,
        data,
      });
    })().catch(next);
  },
);

dashboardRouter.post(
  "/alerts/refresh",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const data = await refreshDashboardAlerts({ id: req.user!.id });

      res.status(200).json({
        ok: true,
        data,
      });
    })().catch(next);
  },
);

dashboardRouter.get(
  "/alerts/scheduler-status",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (_req, res) => {
    const data = getDashboardAlertsSchedulerStatus();

    res.status(200).json({
      ok: true,
      data,
    });
  },
);

export { dashboardRouter };
