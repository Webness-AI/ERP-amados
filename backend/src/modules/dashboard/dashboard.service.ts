import { getIncomeStatementReport } from "../accounting/journal-entry.service";
import { JournalEntryModel } from "../accounting/journal-entry.model";
import { BUDGET_STATUSES, BudgetModel } from "../budgets/budget.model";
import {
  CashMovementModel,
  CASH_DIRECTIONS,
} from "../cash/cash-movement.model";
import {
  COLLECTION_STATUSES,
  CollectionModel,
} from "../collections/collection.model";
import { refreshCollectionDueStatus } from "../collections/collection.service";
import {
  FIXED_EXPENSE_STATUSES,
  FixedExpenseModel,
} from "../fixed-expenses/fixed-expense.model";
import { refreshFixedExpenseAlerts } from "../fixed-expenses/fixed-expense.service";
import {
  ProductionOrderModel,
  PRODUCTION_STATUSES,
} from "../production/production-order.model";
import {
  ProjectModel,
  PROJECT_STATUSES,
  type ProjectStatus,
} from "../projects/project.model";
import { PURCHASE_STATUSES, PurchaseModel } from "../purchases/purchase.model";
import { listPurchaseSuggestions } from "../stock/stock.service";
import type {
  DashboardAlertsQuery,
  DashboardOverviewQuery,
} from "./dashboard.schemas";

type Actor = {
  id: string;
};

type DateRange = {
  from: Date;
  to: Date;
};

const ACTIVE_PROJECT_STATUSES: ProjectStatus[] = [
  PROJECT_STATUSES.CONSULTA,
  PROJECT_STATUSES.PRESUPUESTADO,
  PROJECT_STATUSES.APROBADO,
  PROJECT_STATUSES.COMPRADO,
  PROJECT_STATUSES.PRODUCCION,
  PROJECT_STATUSES.INSTALACION,
  PROJECT_STATUSES.PAUSADO,
];

function normalizeMoney(value: number): number {
  return Number(value.toFixed(2));
}

function parseDateRange(query: DashboardOverviewQuery): DateRange {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from
    ? new Date(query.from)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  return { from, to };
}

function parseAlertsConfig(query: DashboardAlertsQuery): {
  now: Date;
  horizon: Date;
  limit: number;
} {
  const now = new Date();
  const horizonHours = query.horizonHours ? Number(query.horizonHours) : 72;
  const limitRaw = query.limit ? Number(query.limit) : 10;

  const safeHorizonHours = Number.isFinite(horizonHours)
    ? Math.max(1, Math.min(horizonHours, 24 * 30))
    : 72;
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(limitRaw, 50))
    : 10;

  const horizon = new Date(now.getTime() + safeHorizonHours * 60 * 60 * 1000);

  return {
    now,
    horizon,
    limit,
  };
}

export async function getDashboardOverview(
  query: DashboardOverviewQuery,
): Promise<{
  period: { from: string; to: string };
  projects: {
    totalActive: number;
    byStatus: Array<{ status: string; count: number }>;
    deliveryDueSoon: number;
    deliveryOverdue: number;
  };
  sales: {
    approvedBudgets: number;
    approvedAmount: number;
  };
  collections: {
    pendingAmount: number;
    overdueCount: number;
    overdueAmount: number;
    dueSoonCount: number;
    collectedInPeriod: number;
  };
  cash: {
    income: number;
    expense: number;
    net: number;
  };
  purchases: {
    openCount: number;
    receivedAmountInPeriod: number;
  };
  stock: {
    lowStockMaterials: number;
    purchaseSuggestions: number;
    estimatedPurchaseCost: number;
  };
  production: {
    openOrders: number;
    inProgressOrders: number;
    highPriorityOpenOrders: number;
    byStatus: Array<{ status: string; count: number }>;
  };
  accounting: {
    journalEntriesInPeriod: number;
    income: number;
    expenses: number;
    netResult: number;
  };
}> {
  const range = parseDateRange(query);
  const now = new Date();
  const next72Hours = new Date(now.getTime() + 72 * 60 * 60 * 1000);

  const [
    projectStatusRows,
    deliveryDueSoon,
    deliveryOverdue,
    approvedBudgetRows,
    pendingCollectionsRows,
    overdueCollectionsRows,
    dueSoonCollectionsCount,
    collectionPaymentsRows,
    cashRows,
    openPurchasesCount,
    purchasesReceivedRows,
    productionStatusRows,
    highPriorityOpenOrders,
    purchaseSuggestions,
    incomeStatement,
    journalEntriesInPeriod,
  ] = await Promise.all([
    ProjectModel.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          deletedAt: null,
          isActive: true,
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),
    ProjectModel.countDocuments({
      deletedAt: null,
      isActive: true,
      status: { $in: ACTIVE_PROJECT_STATUSES },
      deliveryDate: {
        $gte: now,
        $lte: next72Hours,
      },
    }),
    ProjectModel.countDocuments({
      deletedAt: null,
      isActive: true,
      status: { $in: ACTIVE_PROJECT_STATUSES },
      deliveryDate: {
        $lt: now,
      },
    }),
    BudgetModel.aggregate<{ count: number; amount: number }>([
      {
        $match: {
          deletedAt: null,
          status: BUDGET_STATUSES.APPROVED,
          approvedAt: {
            $gte: range.from,
            $lte: range.to,
          },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          amount: { $sum: "$total" },
        },
      },
    ]),
    CollectionModel.aggregate<{ amount: number }>([
      {
        $match: {
          deletedAt: null,
          status: { $ne: COLLECTION_STATUSES.COBRADO },
        },
      },
      {
        $group: {
          _id: null,
          amount: { $sum: "$pendingAmount" },
        },
      },
    ]),
    CollectionModel.aggregate<{ count: number; amount: number }>([
      {
        $match: {
          deletedAt: null,
          status: { $ne: COLLECTION_STATUSES.COBRADO },
          dueDate: { $lt: now },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          amount: { $sum: "$pendingAmount" },
        },
      },
    ]),
    CollectionModel.countDocuments({
      deletedAt: null,
      status: { $ne: COLLECTION_STATUSES.COBRADO },
      dueDate: {
        $gte: now,
        $lte: next72Hours,
      },
    }),
    CollectionModel.aggregate<{ amount: number }>([
      {
        $match: {
          deletedAt: null,
        },
      },
      {
        $unwind: "$payments",
      },
      {
        $match: {
          "payments.paidAt": {
            $gte: range.from,
            $lte: range.to,
          },
        },
      },
      {
        $group: {
          _id: null,
          amount: { $sum: "$payments.amount" },
        },
      },
    ]),
    CashMovementModel.aggregate<{ direction: string; total: number }>([
      {
        $match: {
          deletedAt: null,
          occurredAt: {
            $gte: range.from,
            $lte: range.to,
          },
        },
      },
      {
        $group: {
          _id: "$direction",
          total: { $sum: "$amount" },
        },
      },
      {
        $project: {
          _id: 0,
          direction: "$_id",
          total: 1,
        },
      },
    ]),
    PurchaseModel.countDocuments({
      deletedAt: null,
      status: {
        $in: [
          PURCHASE_STATUSES.DRAFT,
          PURCHASE_STATUSES.ORDERED,
          PURCHASE_STATUSES.PARTIALLY_RECEIVED,
        ],
      },
    }),
    PurchaseModel.aggregate<{ amount: number }>([
      {
        $match: {
          deletedAt: null,
          receivedAt: {
            $gte: range.from,
            $lte: range.to,
          },
        },
      },
      {
        $group: {
          _id: null,
          amount: { $sum: "$receivedTotal" },
        },
      },
    ]),
    ProductionOrderModel.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          deletedAt: null,
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),
    ProductionOrderModel.countDocuments({
      deletedAt: null,
      status: { $ne: PRODUCTION_STATUSES.FINALIZADO },
      priority: "HIGH",
    }),
    listPurchaseSuggestions({}),
    getIncomeStatementReport({
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    }),
    JournalEntryModel.countDocuments({
      deletedAt: null,
      entryDate: {
        $gte: range.from,
        $lte: range.to,
      },
    }),
  ]);

  const totalActiveProjects = projectStatusRows.reduce(
    (acc, row) => acc + row.count,
    0,
  );
  const approvedBudget = approvedBudgetRows[0] ?? { count: 0, amount: 0 };
  const pendingCollectionsAmount = pendingCollectionsRows[0]?.amount ?? 0;
  const overdueCollections = overdueCollectionsRows[0] ?? {
    count: 0,
    amount: 0,
  };
  const collectedInPeriod = collectionPaymentsRows[0]?.amount ?? 0;

  const cashIncome =
    cashRows.find((row) => row.direction === CASH_DIRECTIONS.INCOME)?.total ??
    0;
  const cashExpense =
    cashRows.find((row) => row.direction === CASH_DIRECTIONS.EXPENSE)?.total ??
    0;

  const receivedPurchasesAmount = purchasesReceivedRows[0]?.amount ?? 0;

  const productionByStatus = productionStatusRows
    .map((row) => ({
      status: row._id,
      count: row.count,
    }))
    .sort((a, b) => a.status.localeCompare(b.status));

  const openOrders = productionByStatus
    .filter((row) => row.status !== PRODUCTION_STATUSES.FINALIZADO)
    .reduce((acc, row) => acc + row.count, 0);

  const inProgressOrders = productionByStatus
    .filter((row) => row.status !== PRODUCTION_STATUSES.PENDIENTE)
    .filter((row) => row.status !== PRODUCTION_STATUSES.FINALIZADO)
    .reduce((acc, row) => acc + row.count, 0);

  return {
    period: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    },
    projects: {
      totalActive: totalActiveProjects,
      byStatus: projectStatusRows
        .map((row) => ({
          status: row._id,
          count: row.count,
        }))
        .sort((a, b) => a.status.localeCompare(b.status)),
      deliveryDueSoon,
      deliveryOverdue,
    },
    sales: {
      approvedBudgets: approvedBudget.count,
      approvedAmount: normalizeMoney(approvedBudget.amount),
    },
    collections: {
      pendingAmount: normalizeMoney(pendingCollectionsAmount),
      overdueCount: overdueCollections.count,
      overdueAmount: normalizeMoney(overdueCollections.amount),
      dueSoonCount: dueSoonCollectionsCount,
      collectedInPeriod: normalizeMoney(collectedInPeriod),
    },
    cash: {
      income: normalizeMoney(cashIncome),
      expense: normalizeMoney(cashExpense),
      net: normalizeMoney(cashIncome - cashExpense),
    },
    purchases: {
      openCount: openPurchasesCount,
      receivedAmountInPeriod: normalizeMoney(receivedPurchasesAmount),
    },
    stock: {
      lowStockMaterials: purchaseSuggestions.pagination.total,
      purchaseSuggestions: purchaseSuggestions.pagination.total,
      estimatedPurchaseCost: normalizeMoney(
        purchaseSuggestions.totals.estimatedTotalCost,
      ),
    },
    production: {
      openOrders,
      inProgressOrders,
      highPriorityOpenOrders,
      byStatus: productionByStatus,
    },
    accounting: {
      journalEntriesInPeriod,
      income: normalizeMoney(incomeStatement.totals.income),
      expenses: normalizeMoney(incomeStatement.totals.expenses),
      netResult: normalizeMoney(incomeStatement.totals.netResult),
    },
  };
}

export async function getDashboardAlerts(query: DashboardAlertsQuery): Promise<{
  config: {
    now: string;
    horizon: string;
    limit: number;
  };
  projects: {
    deliveryDueSoon: Array<{
      id: string;
      name: string;
      status: string;
      deliveryDate: string;
    }>;
    deliveryOverdue: Array<{
      id: string;
      name: string;
      status: string;
      deliveryDate: string;
    }>;
  };
  collections: {
    dueSoon: Array<{
      id: string;
      clientId: string;
      projectId: string | null;
      dueDate: string;
      pendingAmount: number;
      status: string;
    }>;
    overdue: Array<{
      id: string;
      clientId: string;
      projectId: string | null;
      dueDate: string;
      pendingAmount: number;
      status: string;
    }>;
  };
  fixedExpenses: {
    dueSoon: Array<{
      id: string;
      name: string;
      nextDueDate: string;
      amount: number;
      currency: string;
    }>;
    overdue: Array<{
      id: string;
      name: string;
      nextDueDate: string;
      amount: number;
      currency: string;
    }>;
  };
}> {
  const { now, horizon, limit } = parseAlertsConfig(query);

  const [
    projectsDueSoon,
    projectsOverdue,
    collectionsDueSoon,
    collectionsOverdue,
    expensesDueSoon,
    expensesOverdue,
  ] = await Promise.all([
    ProjectModel.find({
      deletedAt: null,
      isActive: true,
      status: { $in: ACTIVE_PROJECT_STATUSES },
      deliveryDate: { $gte: now, $lte: horizon },
    })
      .sort({ deliveryDate: 1 })
      .limit(limit)
      .select("name status deliveryDate")
      .lean(),
    ProjectModel.find({
      deletedAt: null,
      isActive: true,
      status: { $in: ACTIVE_PROJECT_STATUSES },
      deliveryDate: { $lt: now },
    })
      .sort({ deliveryDate: 1 })
      .limit(limit)
      .select("name status deliveryDate")
      .lean(),
    CollectionModel.find({
      deletedAt: null,
      status: { $ne: COLLECTION_STATUSES.COBRADO },
      dueDate: { $gte: now, $lte: horizon },
    })
      .sort({ dueDate: 1 })
      .limit(limit)
      .select("clientId projectId dueDate pendingAmount status")
      .lean(),
    CollectionModel.find({
      deletedAt: null,
      status: { $ne: COLLECTION_STATUSES.COBRADO },
      dueDate: { $lt: now },
    })
      .sort({ dueDate: 1 })
      .limit(limit)
      .select("clientId projectId dueDate pendingAmount status")
      .lean(),
    FixedExpenseModel.find({
      deletedAt: null,
      status: FIXED_EXPENSE_STATUSES.ACTIVO,
      nextDueDate: { $gte: now, $lte: horizon },
    })
      .sort({ nextDueDate: 1 })
      .limit(limit)
      .select("name nextDueDate amount currency")
      .lean(),
    FixedExpenseModel.find({
      deletedAt: null,
      status: FIXED_EXPENSE_STATUSES.ACTIVO,
      nextDueDate: { $lt: now },
    })
      .sort({ nextDueDate: 1 })
      .limit(limit)
      .select("name nextDueDate amount currency")
      .lean(),
  ]);

  return {
    config: {
      now: now.toISOString(),
      horizon: horizon.toISOString(),
      limit,
    },
    projects: {
      deliveryDueSoon: projectsDueSoon.map((project) => ({
        id: String(project._id),
        name: project.name,
        status: project.status,
        deliveryDate: project.deliveryDate
          ? project.deliveryDate.toISOString()
          : "",
      })),
      deliveryOverdue: projectsOverdue.map((project) => ({
        id: String(project._id),
        name: project.name,
        status: project.status,
        deliveryDate: project.deliveryDate
          ? project.deliveryDate.toISOString()
          : "",
      })),
    },
    collections: {
      dueSoon: collectionsDueSoon.map((collection) => ({
        id: String(collection._id),
        clientId: String(collection.clientId),
        projectId: collection.projectId ? String(collection.projectId) : null,
        dueDate: collection.dueDate ? collection.dueDate.toISOString() : "",
        pendingAmount: normalizeMoney(collection.pendingAmount),
        status: collection.status,
      })),
      overdue: collectionsOverdue.map((collection) => ({
        id: String(collection._id),
        clientId: String(collection.clientId),
        projectId: collection.projectId ? String(collection.projectId) : null,
        dueDate: collection.dueDate ? collection.dueDate.toISOString() : "",
        pendingAmount: normalizeMoney(collection.pendingAmount),
        status: collection.status,
      })),
    },
    fixedExpenses: {
      dueSoon: expensesDueSoon.map((expense) => ({
        id: String(expense._id),
        name: expense.name,
        nextDueDate: expense.nextDueDate.toISOString(),
        amount: normalizeMoney(expense.amount),
        currency: expense.currency,
      })),
      overdue: expensesOverdue.map((expense) => ({
        id: String(expense._id),
        name: expense.name,
        nextDueDate: expense.nextDueDate.toISOString(),
        amount: normalizeMoney(expense.amount),
        currency: expense.currency,
      })),
    },
  };
}

export async function refreshDashboardAlerts(actor: Actor): Promise<{
  collections: {
    overdue: number;
    dueSoon: number;
  };
  fixedExpenses: {
    overdue: number;
    dueSoon: number;
  };
}> {
  const [collections, fixedExpenses] = await Promise.all([
    refreshCollectionDueStatus(actor),
    refreshFixedExpenseAlerts(actor),
  ]);

  return {
    collections,
    fixedExpenses,
  };
}
