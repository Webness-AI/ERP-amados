import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { corsOrigins, env } from "./config/env";
import { errorHandlerMiddleware } from "./core/middleware/error-handler.middleware";
import { notFoundMiddleware } from "./core/middleware/not-found.middleware";
import { requestContextMiddleware } from "./core/middleware/request-context.middleware";
import { accountRouter } from "./modules/accounts/account.routes";
import { accountingRouter } from "./modules/accounting/accounting.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { budgetRouter } from "./modules/budgets/budget.routes";
import { cashRouter } from "./modules/cash/cash.routes";
import { clientRouter } from "./modules/clients/client.routes";
import { collectionRouter } from "./modules/collections/collection.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";
import { fixedExpenseRouter } from "./modules/fixed-expenses/fixed-expense.routes";
import { healthRouter } from "./modules/health/health.routes";
import { productionOrderRouter } from "./modules/production/production-order.routes";
import { projectRouter } from "./modules/projects/project.routes";
import { purchaseRouter } from "./modules/purchases/purchase.routes";
import { stockRouter } from "./modules/stock/stock.routes";
import { supplierRouter } from "./modules/suppliers/supplier.routes";
import { userRouter } from "./modules/users/user.routes";

export const app = express();

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, "");
}

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      const normalizedOrigin =
        typeof origin === "string" ? normalizeOrigin(origin) : undefined;
      const isLocalhostDevOrigin =
        typeof normalizedOrigin === "string" &&
        env.NODE_ENV !== "production" &&
        /^http:\/\/localhost:\d+$/.test(normalizedOrigin);

      if (
        !origin ||
        (normalizedOrigin && corsOrigins.includes(normalizedOrigin)) ||
        isLocalhostDevOrigin
      ) {
        callback(null, true);
        return;
      }

      callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(requestContextMiddleware);

app.use("/api/v1", healthRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/accounts", accountRouter);
app.use("/api/v1/accounting", accountingRouter);
app.use("/api/v1/clients", clientRouter);
app.use("/api/v1/budgets", budgetRouter);
app.use("/api/v1/projects", projectRouter);
app.use("/api/v1/stock", stockRouter);
app.use("/api/v1/cash", cashRouter);
app.use("/api/v1/collections", collectionRouter);
app.use("/api/v1/dashboard", dashboardRouter);
app.use("/api/v1/fixed-expenses", fixedExpenseRouter);
app.use("/api/v1/suppliers", supplierRouter);
app.use("/api/v1/purchases", purchaseRouter);
app.use("/api/v1/production-orders", productionOrderRouter);
app.use("/api/v1/users", userRouter);

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);
