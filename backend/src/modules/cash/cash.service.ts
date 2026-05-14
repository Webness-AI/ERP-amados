import { AppError } from "../../core/errors/app-error";
import {
  buildPaginatedResponse,
  parsePaginationInput,
} from "../../core/utils/pagination";
import type {
  CreateCashMovementInput,
  ListCashMovementsInput,
} from "./cash.schemas";
import {
  CashMovementModel,
  type CashMovement,
  type CashDirection,
  type CashPaymentMethod,
  type CashSource,
} from "./cash-movement.model";

type Actor = {
  id: string;
};

export type CreateCashMovementInternalInput = {
  source: CashSource;
  direction: CashDirection;
  paymentMethod: CashPaymentMethod;
  amount: number;
  currency: string;
  concept: string;
  actorId: string;
  clientId?: string | null;
  projectId?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  occurredAt?: Date;
};

function normalizeOptionalString(value?: string | null): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function createCashMovementInternal(
  input: CreateCashMovementInternalInput,
): Promise<CashMovement> {
  const movement = await CashMovementModel.create({
    source: input.source,
    direction: input.direction,
    paymentMethod: input.paymentMethod,
    amount: input.amount,
    currency: input.currency.toUpperCase(),
    concept: input.concept,
    clientId: input.clientId ?? null,
    projectId: input.projectId ?? null,
    referenceType: normalizeOptionalString(input.referenceType),
    referenceId: normalizeOptionalString(input.referenceId),
    occurredAt: input.occurredAt ?? new Date(),
    createdBy: input.actorId,
    updatedBy: input.actorId,
  });

  return movement.toObject();
}

export async function createCashMovement(
  input: CreateCashMovementInput,
  actor: Actor,
): Promise<CashMovement> {
  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : null;

  return createCashMovementInternal({
    source: input.source,
    direction: input.direction,
    paymentMethod: input.paymentMethod,
    amount: input.amount,
    currency: input.currency,
    concept: input.concept,
    actorId: actor.id,
    clientId: input.clientId ?? null,
    projectId: input.projectId ?? null,
    referenceType: input.referenceType ?? null,
    referenceId: input.referenceId ?? null,
    ...(occurredAt ? { occurredAt } : {}),
  });
}

export async function listCashMovements(
  query: ListCashMovementsInput,
): Promise<{
  items: CashMovement[];
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

  if (query.source) {
    filter.source = query.source;
  }

  if (query.direction) {
    filter.direction = query.direction;
  }

  if (query.paymentMethod) {
    filter.paymentMethod = query.paymentMethod;
  }

  if (query.referenceType) {
    filter.referenceType = query.referenceType;
  }

  if (query.referenceId) {
    filter.referenceId = query.referenceId;
  }

  if (query.search && query.search.trim().length > 0) {
    const regex = new RegExp(query.search.trim(), "i");
    filter.$or = [
      { concept: regex },
      { currency: regex },
      { referenceId: regex },
    ];
  }

  const [items, total] = await Promise.all([
    CashMovementModel.find(filter)
      .sort({ occurredAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CashMovementModel.countDocuments(filter),
  ]);

  return buildPaginatedResponse({
    items,
    total,
    page,
    limit,
  });
}

export async function getCashMovementById(id: string): Promise<CashMovement> {
  const movement = await CashMovementModel.findOne({
    _id: id,
    deletedAt: null,
  }).lean();

  if (!movement) {
    throw new AppError(
      "Cash movement not found",
      404,
      "CASH_MOVEMENT_NOT_FOUND",
    );
  }

  return movement;
}
