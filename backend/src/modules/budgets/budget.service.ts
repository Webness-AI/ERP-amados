import { eventBus } from "../../core/events/event-bus";
import { DOMAIN_EVENTS } from "../../core/events/domain-events";
import { AppError } from "../../core/errors/app-error";
import {
  buildPaginatedResponse,
  parsePaginationInput,
} from "../../core/utils/pagination";
import { ClientModel } from "../clients/client.model";
import {
  BUDGET_STATUSES,
  type Budget,
  type BudgetItem,
  BudgetModel,
} from "./budget.model";
import type {
  BudgetItemInput,
  CreateBudgetInput,
  ListBudgetsInput,
  ReviseBudgetInput,
  UpdateBudgetStatusInput,
} from "./budget.schemas";

type Actor = {
  id: string;
};

function normalizeOptionalString(value?: string): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function calculateItemTotals(items: BudgetItemInput[]): BudgetItem[] {
  return items.map((item) => {
    const total = Number((item.quantity * item.unitPrice).toFixed(2));
    return {
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total,
    };
  });
}

function calculateTotals(items: BudgetItem[]): {
  subtotal: number;
  total: number;
} {
  const subtotal = Number(
    items.reduce((acc, item) => acc + item.total, 0).toFixed(2),
  );

  return { subtotal, total: subtotal };
}

async function assertClientExists(clientId: string): Promise<void> {
  const exists = await ClientModel.exists({
    _id: clientId,
    deletedAt: null,
    isActive: true,
  });

  if (!exists) {
    throw new AppError("Client not found", 404, "CLIENT_NOT_FOUND");
  }
}

export async function createBudget(
  input: CreateBudgetInput,
  actor: Actor,
): Promise<Budget> {
  await assertClientExists(input.clientId);

  const items = calculateItemTotals(input.items);
  const totals = calculateTotals(items);

  const budget = new BudgetModel({
    clientId: input.clientId,
    title: input.title,
    description: normalizeOptionalString(input.description),
    currency: input.currency.toUpperCase(),
    items,
    subtotal: totals.subtotal,
    total: totals.total,
    status: input.status ?? BUDGET_STATUSES.DRAFT,
    version: 1,
    createdBy: actor.id,
    updatedBy: actor.id,
  });

  await budget.save();

  return budget.toObject();
}

export async function reviseBudget(
  budgetId: string,
  input: ReviseBudgetInput,
  actor: Actor,
): Promise<Budget> {
  const baseBudget = await BudgetModel.findOne({
    _id: budgetId,
    deletedAt: null,
  }).lean();

  if (!baseBudget) {
    throw new AppError("Budget not found", 404, "BUDGET_NOT_FOUND");
  }

  const latestVersion = await BudgetModel.findOne({
    versionGroupId: baseBudget.versionGroupId,
    deletedAt: null,
  })
    .sort({ version: -1 })
    .lean();

  const version = (latestVersion?.version ?? 0) + 1;

  const sourceItems =
    input.items ??
    baseBudget.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }));

  const items = calculateItemTotals(sourceItems);
  const totals = calculateTotals(items);

  const revisedBudget = new BudgetModel({
    clientId: baseBudget.clientId,
    title: input.title ?? baseBudget.title,
    description:
      input.description !== undefined
        ? normalizeOptionalString(input.description)
        : baseBudget.description,
    currency: (input.currency ?? baseBudget.currency).toUpperCase(),
    items,
    subtotal: totals.subtotal,
    total: totals.total,
    status: input.status ?? BUDGET_STATUSES.DRAFT,
    versionGroupId: baseBudget.versionGroupId,
    version,
    parentBudgetId: baseBudget._id,
    createdBy: actor.id,
    updatedBy: actor.id,
  });

  await revisedBudget.save();

  return revisedBudget.toObject();
}

export async function listBudgets(query: ListBudgetsInput): Promise<{
  items: Budget[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}> {
  const { page, limit, skip } = parsePaginationInput(query);
  const filter: Record<string, unknown> = {
    deletedAt: null,
  };

  if (query.clientId) {
    filter.clientId = query.clientId;
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.search && query.search.trim().length > 0) {
    const regex = new RegExp(query.search.trim(), "i");
    filter.$or = [
      { title: regex },
      { description: regex },
      { versionGroupId: regex },
    ];
  }

  const [items, total] = await Promise.all([
    BudgetModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    BudgetModel.countDocuments(filter),
  ]);

  return buildPaginatedResponse({
    items,
    total,
    page,
    limit,
  });
}

export async function getBudgetById(id: string): Promise<Budget> {
  const budget = await BudgetModel.findOne({
    _id: id,
    deletedAt: null,
  }).lean();

  if (!budget) {
    throw new AppError("Budget not found", 404, "BUDGET_NOT_FOUND");
  }

  return budget;
}

export async function updateBudgetStatus(
  budgetId: string,
  input: UpdateBudgetStatusInput,
  actor: Actor,
): Promise<Budget> {
  const budget = await BudgetModel.findOne({
    _id: budgetId,
    deletedAt: null,
  });

  if (!budget) {
    throw new AppError("Budget not found", 404, "BUDGET_NOT_FOUND");
  }

  budget.status = input.status;
  budget.updatedBy = actor.id;

  if (input.status === BUDGET_STATUSES.APPROVED) {
    budget.approvedAt = new Date();
  }

  await budget.save();

  if (input.status === BUDGET_STATUSES.APPROVED) {
    eventBus.publish({
      name: DOMAIN_EVENTS.PRESUPUESTO_APROBADO,
      payload: {
        budgetId: budget.id,
        clientId: String(budget.clientId),
        total: budget.total,
      },
      occurredAt: new Date().toISOString(),
      actorId: actor.id,
      correlationId: budget.id,
    });
  }

  return budget.toObject();
}

export async function softDeleteBudget(
  id: string,
  actor: Actor,
): Promise<void> {
  const budget = await BudgetModel.findOneAndUpdate(
    {
      _id: id,
      deletedAt: null,
    },
    {
      deletedAt: new Date(),
      deletedBy: actor.id,
      updatedBy: actor.id,
      status: BUDGET_STATUSES.CANCELED,
    },
    { new: true },
  ).lean();

  if (!budget) {
    throw new AppError("Budget not found", 404, "BUDGET_NOT_FOUND");
  }
}
