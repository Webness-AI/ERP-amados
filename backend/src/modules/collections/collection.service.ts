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
import { ClientModel } from "../clients/client.model";
import { ProjectModel } from "../projects/project.model";
import {
  COLLECTION_STATUSES,
  type Collection,
  type CollectionDocument,
  CollectionModel,
} from "./collection.model";
import type {
  CreateCollectionInput,
  ListCollectionsInput,
  RegisterCollectionPaymentInput,
} from "./collection.schemas";

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

async function assertProjectExistsIfProvided(
  projectId?: string,
): Promise<void> {
  if (!projectId) {
    return;
  }

  const exists = await ProjectModel.exists({
    _id: projectId,
    deletedAt: null,
    isActive: true,
  });

  if (!exists) {
    throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");
  }
}

function recalculateCollectionTotals(collection: CollectionDocument): void {
  collection.pendingAmount = Number(
    (collection.totalAmount - collection.paidAmount).toFixed(2),
  );

  if (collection.pendingAmount <= 0) {
    collection.pendingAmount = 0;
    collection.status = COLLECTION_STATUSES.COBRADO;
    return;
  }

  if (collection.paidAmount > 0) {
    collection.status = COLLECTION_STATUSES.PARCIAL;
    return;
  }

  if (collection.dueDate && collection.dueDate.getTime() < Date.now()) {
    collection.status = COLLECTION_STATUSES.VENCIDO;
    return;
  }

  collection.status = COLLECTION_STATUSES.PENDIENTE;
}

function toCashPaymentMethod(
  paymentMethod: RegisterCollectionPaymentInput["paymentMethod"],
): (typeof CASH_PAYMENT_METHODS)[keyof typeof CASH_PAYMENT_METHODS] {
  if (paymentMethod === "EFECTIVO") {
    return CASH_PAYMENT_METHODS.EFECTIVO;
  }
  if (paymentMethod === "TRANSFERENCIA") {
    return CASH_PAYMENT_METHODS.TRANSFERENCIA;
  }
  if (paymentMethod === "TARJETA") {
    return CASH_PAYMENT_METHODS.TARJETA;
  }
  if (paymentMethod === "CHEQUE") {
    return CASH_PAYMENT_METHODS.CHEQUE;
  }
  return CASH_PAYMENT_METHODS.OTRO;
}

export async function createCollection(
  input: CreateCollectionInput,
  actor: Actor,
): Promise<Collection> {
  await assertClientExists(input.clientId);
  await assertProjectExistsIfProvided(input.projectId);

  const totalAmount = Number(input.totalAmount.toFixed(2));
  const collection = await CollectionModel.create({
    clientId: input.clientId,
    projectId: input.projectId ?? null,
    status: COLLECTION_STATUSES.PENDIENTE,
    totalAmount,
    paidAmount: 0,
    pendingAmount: totalAmount,
    laborAmountPending: Number(input.laborAmountPending.toFixed(2)),
    currency: input.currency.toUpperCase(),
    dueDate: input.dueDate ? new Date(input.dueDate) : null,
    notes: normalizeOptionalString(input.notes),
    payments: [],
    createdBy: actor.id,
    updatedBy: actor.id,
  });

  if (collection.dueDate && collection.dueDate.getTime() < Date.now()) {
    collection.status = COLLECTION_STATUSES.VENCIDO;
    await collection.save();
    eventBus.publish({
      name: DOMAIN_EVENTS.VENCIMIENTO_VENCIDO_DETECTADO,
      payload: {
        collectionId: collection.id,
        projectId: collection.projectId ? String(collection.projectId) : null,
        clientId: String(collection.clientId),
        dueDate: collection.dueDate.toISOString(),
      },
      occurredAt: new Date().toISOString(),
      actorId: actor.id,
      correlationId: collection.id,
    });
  }

  return collection.toObject();
}

export async function listCollections(query: ListCollectionsInput): Promise<{
  items: Collection[];
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

  if (query.projectId) {
    filter.projectId = query.projectId;
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.dueOnly === "true") {
    filter.dueDate = { $ne: null };
  }

  if (query.overdueOnly === "true") {
    filter.dueDate = { $lt: new Date() };
    filter.status = { $ne: COLLECTION_STATUSES.COBRADO };
  }

  const [items, total] = await Promise.all([
    CollectionModel.find(filter)
      .sort({ dueDate: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CollectionModel.countDocuments(filter),
  ]);

  return buildPaginatedResponse({
    items,
    total,
    page,
    limit,
  });
}

export async function getCollectionById(id: string): Promise<Collection> {
  const collection = await CollectionModel.findOne({
    _id: id,
    deletedAt: null,
  }).lean();

  if (!collection) {
    throw new AppError("Collection not found", 404, "COLLECTION_NOT_FOUND");
  }

  return collection;
}

export async function registerCollectionPayment(
  id: string,
  input: RegisterCollectionPaymentInput,
  actor: Actor,
): Promise<Collection> {
  const collection = await CollectionModel.findOne({
    _id: id,
    deletedAt: null,
  });

  if (!collection) {
    throw new AppError("Collection not found", 404, "COLLECTION_NOT_FOUND");
  }

  if (collection.status === COLLECTION_STATUSES.COBRADO) {
    throw new AppError(
      "Collection already fully paid",
      409,
      "COLLECTION_ALREADY_PAID",
    );
  }

  if (input.amount > collection.pendingAmount) {
    throw new AppError(
      "Payment amount exceeds pending amount",
      409,
      "PAYMENT_EXCEEDS_PENDING",
    );
  }

  const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();

  collection.payments.push({
    amount: Number(input.amount.toFixed(2)),
    paymentMethod: input.paymentMethod,
    paidAt,
    note: normalizeOptionalString(input.note),
    createdBy: actor.id,
  });

  collection.paidAmount = Number(
    (collection.paidAmount + input.amount).toFixed(2),
  );
  recalculateCollectionTotals(collection);
  collection.updatedBy = actor.id;
  await collection.save();

  await createCashMovementInternal({
    source: CASH_SOURCES.CASH,
    direction: CASH_DIRECTIONS.INCOME,
    paymentMethod: toCashPaymentMethod(input.paymentMethod),
    amount: Number(input.amount.toFixed(2)),
    currency: collection.currency,
    concept: `Cobranza ${collection.id}`,
    actorId: actor.id,
    clientId: String(collection.clientId),
    projectId: collection.projectId ? String(collection.projectId) : null,
    referenceType: "collection",
    referenceId: collection.id,
    occurredAt: paidAt,
  });

  eventBus.publish({
    name: DOMAIN_EVENTS.PAGO_RECIBIDO,
    payload: {
      collectionId: collection.id,
      clientId: String(collection.clientId),
      projectId: collection.projectId ? String(collection.projectId) : null,
      amount: Number(input.amount.toFixed(2)),
      paymentMethod: input.paymentMethod,
      paidAt: paidAt.toISOString(),
    },
    occurredAt: new Date().toISOString(),
    actorId: actor.id,
    correlationId: collection.id,
  });

  return collection.toObject();
}

export async function refreshCollectionDueStatus(actor: Actor): Promise<{
  overdue: number;
  dueSoon: number;
}> {
  const now = new Date();
  const next72Hours = new Date(now.getTime() + 72 * 60 * 60 * 1000);

  const candidates = await CollectionModel.find({
    deletedAt: null,
    status: { $ne: COLLECTION_STATUSES.COBRADO },
    dueDate: { $ne: null },
  });

  let overdue = 0;
  let dueSoon = 0;

  for (const collection of candidates) {
    const dueDate = collection.dueDate;
    if (!dueDate) {
      continue;
    }

    if (dueDate.getTime() < now.getTime()) {
      if (collection.status !== COLLECTION_STATUSES.VENCIDO) {
        collection.status = COLLECTION_STATUSES.VENCIDO;
        collection.updatedBy = actor.id;
        await collection.save();
      }

      overdue += 1;
      eventBus.publish({
        name: DOMAIN_EVENTS.VENCIMIENTO_VENCIDO_DETECTADO,
        payload: {
          collectionId: collection.id,
          clientId: String(collection.clientId),
          projectId: collection.projectId ? String(collection.projectId) : null,
          dueDate: dueDate.toISOString(),
        },
        occurredAt: new Date().toISOString(),
        actorId: actor.id,
        correlationId: collection.id,
      });
      continue;
    }

    if (dueDate.getTime() <= next72Hours.getTime()) {
      dueSoon += 1;
      eventBus.publish({
        name: DOMAIN_EVENTS.VENCIMIENTO_PROXIMO_DETECTADO,
        payload: {
          collectionId: collection.id,
          clientId: String(collection.clientId),
          projectId: collection.projectId ? String(collection.projectId) : null,
          dueDate: dueDate.toISOString(),
        },
        occurredAt: new Date().toISOString(),
        actorId: actor.id,
        correlationId: collection.id,
      });
    }
  }

  return { overdue, dueSoon };
}
