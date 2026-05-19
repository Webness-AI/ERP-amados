import { Router } from "express";

import { authMiddleware } from "../../core/auth/auth.middleware";
import { authorizeMiddleware } from "../../core/auth/authorize.middleware";
import { AppError } from "../../core/errors/app-error";
import { ROLES } from "../auth/roles";
import {
  createManualJournalEntry,
  getBalanceSheetReport,
  getFinancialStatementReport,
  getGeneralLedgerReport,
  getIncomeStatementReport,
  getJournalEntryById,
  getTrialBalanceReport,
  listJournalEntries,
  reverseJournalEntry,
} from "./journal-entry.service";
import {
  createJournalEntrySchema,
  generalLedgerQuerySchema,
  listJournalEntriesSchema,
  reportRangeSchema,
  reverseJournalEntrySchema,
} from "./journal-entry.schemas";

const accountingRouter = Router();
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

accountingRouter.get(
  "/journal-entries",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const query = listJournalEntriesSchema.parse(req.query);
      const result = await listJournalEntries(query);

      res.status(200).json({
        ok: true,
        data: result,
      });
    })().catch(next);
  },
);

accountingRouter.get(
  "/journal-entries/:id",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const entryId = requireRouteParam(req.params.id, "id");
      const entry = await getJournalEntryById(entryId);

      res.status(200).json({
        ok: true,
        data: { entry },
      });
    })().catch(next);
  },
);

accountingRouter.post(
  "/journal-entries",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const payload = createJournalEntrySchema.parse(req.body);
      const entry = await createManualJournalEntry(payload, {
        id: req.user!.id,
      });

      res.status(201).json({
        ok: true,
        data: { entry },
      });
    })().catch(next);
  },
);

accountingRouter.post(
  "/journal-entries/:id/reverse",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const entryId = requireRouteParam(req.params.id, "id");
      const payload = reverseJournalEntrySchema.parse(req.body);
      const entry = await reverseJournalEntry(entryId, payload.reason, {
        id: req.user!.id,
      });

      res.status(201).json({
        ok: true,
        data: { entry },
      });
    })().catch(next);
  },
);

accountingRouter.get(
  "/reports/trial-balance",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const query = reportRangeSchema.parse(req.query);
      const report = await getTrialBalanceReport(query);

      res.status(200).json({
        ok: true,
        data: report,
      });
    })().catch(next);
  },
);

accountingRouter.get(
  "/reports/general-ledger",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const query = generalLedgerQuerySchema.parse(req.query);
      const report = await getGeneralLedgerReport(query);

      res.status(200).json({
        ok: true,
        data: report,
      });
    })().catch(next);
  },
);

accountingRouter.get(
  "/reports/income-statement",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const query = reportRangeSchema.parse(req.query);
      const report = await getIncomeStatementReport(query);

      res.status(200).json({
        ok: true,
        data: report,
      });
    })().catch(next);
  },
);

accountingRouter.get(
  "/reports/financial-statement",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const query = reportRangeSchema.parse(req.query);
      const report = await getFinancialStatementReport(query);

      res.status(200).json({
        ok: true,
        data: report,
      });
    })().catch(next);
  },
);

accountingRouter.get(
  "/reports/balance-sheet",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const query = reportRangeSchema.parse(req.query);
      const report = await getBalanceSheetReport(query);

      res.status(200).json({
        ok: true,
        data: report,
      });
    })().catch(next);
  },
);

export { accountingRouter };
