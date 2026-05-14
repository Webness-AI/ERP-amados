import { AppError } from "../../core/errors/app-error";
import { DOMAIN_EVENTS } from "../../core/events/domain-events";
import { eventBus } from "../../core/events/event-bus";
import {
  buildPaginatedResponse,
  parsePaginationInput,
} from "../../core/utils/pagination";
import {
  CASH_DIRECTIONS,
  CASH_PAYMENT_METHODS,
  CASH_SOURCES,
} from "../cash/cash-movement.model";
import { createCashMovementInternal } from "../cash/cash.service";
import {
  FIXED_EXPENSE_FREQUENCIES,
  FIXED_EXPENSE_STATUSES,
  type FixedExpense,
  type FixedExpenseDocument,
  FixedExpenseModel,
} from "./fixed-expense.model";
import type {
  CreateFixedExpenseInput,
  ListFixedExpensesInput,
  PayFixedExpenseInput,
  UpdateFixedExpenseInput,
} from "./fixed-expense.schemas";

type Actor = {
  id: string;
};

function normalizeOptionalString(value?: string | null): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getNextDueDate(
  baseDate: Date,
  frequency: FixedExpense["frequency"],
): Date {
  const next = new Date(baseDate);

  if (frequency === FIXED_EXPENSE_FREQUENCIES.MENSUAL) {
    next.setMonth(next.getMonth() + 1);
    return next;
  }

  if (frequency === FIXED_EXPENSE_FREQUENCIES.BIMESTRAL) {
    next.setMonth(next.getMonth() + 2);
    return next;
  }

  if (frequency === FIXED_EXPENSE_FREQUENCIES.TRIMESTRAL) {
    next.setMonth(next.getMonth() + 3);
    return next;
  }

  next.setFullYear(next.getFullYear() + 1);
  return next;
}

export async function createFixedExpense(
  input: CreateFixedExpenseInput,
  actor: Actor,
): Promise<FixedExpense> {
  const expense = await FixedExpenseModel.create({
    name: input.name,
    amount: Number(input.amount.toFixed(2)),
    currency: input.currency.toUpperCase(),
    frequency: input.frequency,
    status: FIXED_EXPENSE_STATUSES.ACTIVO,
    nextDueDate: new Date(input.nextDueDate),
    lastPaidAt: null,
    notes: normalizeOptionalString(input.notes),
    payments: [],
    createdBy: actor.id,
    updatedBy: actor.id,
  });

  eventBus.publish({
    name: DOMAIN_EVENTS.GASTO_FIJO_PROGRAMADO,
    payload: {
      fixedExpenseId: expense.id,
      name: expense.name,
      amount: expense.amount,
      currency: expense.currency,
      nextDueDate: expense.nextDueDate.toISOString(),
    },
    occurredAt: new Date().toISOString(),
    actorId: actor.id,
    correlationId: expense.id,
  });

  return expense.toObject();
}

export async function listFixedExpenses(
  query: ListFixedExpensesInput,
): Promise<{
  items: FixedExpense[];
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

  if (query.status) {
    filter.status = query.status;
  }

  if (query.search && query.search.trim().length > 0) {
    const regex = new RegExp(query.search.trim(), "i");
    filter.$or = [{ name: regex }, { currency: regex }];
  }

  if (query.dueOnly === "true") {
    filter.nextDueDate = { $lte: new Date(Date.now() + 72 * 60 * 60 * 1000) };
  }

  if (query.overdueOnly === "true") {
    filter.nextDueDate = { $lt: new Date() };
    filter.status = FIXED_EXPENSE_STATUSES.ACTIVO;
  }

  const [items, total] = await Promise.all([
    FixedExpenseModel.find(filter)
      .sort({ nextDueDate: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    FixedExpenseModel.countDocuments(filter),
  ]);

  return buildPaginatedResponse({
    items,
    total,
    page,
    limit,
  });
}

export async function getFixedExpenseById(id: string): Promise<FixedExpense> {
  const expense = await FixedExpenseModel.findOne({
    _id: id,
    deletedAt: null,
  }).lean();

  if (!expense) {
    throw new AppError(
      "Fixed expense not found",
      404,
      "FIXED_EXPENSE_NOT_FOUND",
    );
  }

  return expense;
}

export async function updateFixedExpense(
  id: string,
  input: UpdateFixedExpenseInput,
  actor: Actor,
): Promise<FixedExpense> {
  const updatePayload: Partial<FixedExpense> = {
    updatedBy: actor.id,
  };

  if (input.name !== undefined) {
    updatePayload.name = input.name;
  }

  if (input.amount !== undefined) {
    updatePayload.amount = Number(input.amount.toFixed(2));
  }

  if (input.currency !== undefined) {
    updatePayload.currency = input.currency.toUpperCase();
  }

  if (input.frequency !== undefined) {
    updatePayload.frequency = input.frequency;
  }

  if (input.status !== undefined) {
    updatePayload.status = input.status;
  }

  if (input.nextDueDate !== undefined) {
    updatePayload.nextDueDate = new Date(input.nextDueDate);
  }

  if (input.notes !== undefined) {
    updatePayload.notes = normalizeOptionalString(input.notes);
  }

  const expense = await FixedExpenseModel.findOneAndUpdate(
    { _id: id, deletedAt: null },
    updatePayload,
    { new: true },
  ).lean();

  if (!expense) {
    throw new AppError(
      "Fixed expense not found",
      404,
      "FIXED_EXPENSE_NOT_FOUND",
    );
  }

  return expense;
}

function registerPaymentOnExpense(
  expense: FixedExpenseDocument,
  amount: number,
  paidAt: Date,
  actorId: string,
  note?: string,
): void {
  expense.payments.push({
    amount,
    paidAt,
    note: normalizeOptionalString(note),
    createdBy: actorId,
  });

  expense.lastPaidAt = paidAt;
  expense.nextDueDate = getNextDueDate(expense.nextDueDate, expense.frequency);
}

export async function payFixedExpense(
  id: string,
  input: PayFixedExpenseInput,
  actor: Actor,
): Promise<FixedExpense> {
  const expense = await FixedExpenseModel.findOne({
    _id: id,
    deletedAt: null,
  });

  if (!expense) {
    throw new AppError(
      "Fixed expense not found",
      404,
      "FIXED_EXPENSE_NOT_FOUND",
    );
  }

  if (expense.status !== FIXED_EXPENSE_STATUSES.ACTIVO) {
    throw new AppError(
      "Fixed expense is not active",
      409,
      "FIXED_EXPENSE_NOT_ACTIVE",
    );
  }

  const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
  const amount = Number((input.amount ?? expense.amount).toFixed(2));

  registerPaymentOnExpense(expense, amount, paidAt, actor.id, input.note);
  expense.updatedBy = actor.id;
  await expense.save();

  await createCashMovementInternal({
    source: CASH_SOURCES.CASH,
    direction: CASH_DIRECTIONS.EXPENSE,
    paymentMethod: CASH_PAYMENT_METHODS.TRANSFERENCIA,
    amount,
    currency: expense.currency,
    concept: `Pago gasto fijo ${expense.name}`,
    actorId: actor.id,
    referenceType: "fixed-expense",
    referenceId: expense.id,
    occurredAt: paidAt,
  });

  eventBus.publish({
    name: DOMAIN_EVENTS.GASTO_PAGADO,
    payload: {
      fixedExpenseId: expense.id,
      amount,
      currency: expense.currency,
      paidAt: paidAt.toISOString(),
    },
    occurredAt: new Date().toISOString(),
    actorId: actor.id,
    correlationId: expense.id,
  });

  return expense.toObject();
}

export async function refreshFixedExpenseAlerts(actor: Actor): Promise<{
  overdue: number;
  dueSoon: number;
}> {
  const now = new Date();
  const next72Hours = new Date(now.getTime() + 72 * 60 * 60 * 1000);

  const expenses = await FixedExpenseModel.find({
    deletedAt: null,
    status: FIXED_EXPENSE_STATUSES.ACTIVO,
  });

  let overdue = 0;
  let dueSoon = 0;

  for (const expense of expenses) {
    if (expense.nextDueDate.getTime() < now.getTime()) {
      overdue += 1;
      eventBus.publish({
        name: DOMAIN_EVENTS.VENCIMIENTO_VENCIDO_DETECTADO,
        payload: {
          fixedExpenseId: expense.id,
          nextDueDate: expense.nextDueDate.toISOString(),
          amount: expense.amount,
          currency: expense.currency,
        },
        occurredAt: new Date().toISOString(),
        actorId: actor.id,
        correlationId: expense.id,
      });
      continue;
    }

    if (expense.nextDueDate.getTime() <= next72Hours.getTime()) {
      dueSoon += 1;
      eventBus.publish({
        name: DOMAIN_EVENTS.VENCIMIENTO_PROXIMO_DETECTADO,
        payload: {
          fixedExpenseId: expense.id,
          nextDueDate: expense.nextDueDate.toISOString(),
          amount: expense.amount,
          currency: expense.currency,
        },
        occurredAt: new Date().toISOString(),
        actorId: actor.id,
        correlationId: expense.id,
      });
    }
  }

  return { overdue, dueSoon };
}

export async function softDeleteFixedExpense(
  id: string,
  actor: Actor,
): Promise<void> {
  const expense = await FixedExpenseModel.findOneAndUpdate(
    { _id: id, deletedAt: null },
    {
      status: FIXED_EXPENSE_STATUSES.PAUSADO,
      deletedAt: new Date(),
      deletedBy: actor.id,
      updatedBy: actor.id,
    },
    { new: true },
  ).lean();

  if (!expense) {
    throw new AppError(
      "Fixed expense not found",
      404,
      "FIXED_EXPENSE_NOT_FOUND",
    );
  }
}
