import mongoose from "mongoose";

import { AppError } from "../../core/errors/app-error";
import { DOMAIN_EVENTS } from "../../core/events/domain-events";
import { eventBus } from "../../core/events/event-bus";
import {
  buildPaginatedResponse,
  parsePaginationInput,
} from "../../core/utils/pagination";
import { ProjectModel } from "../projects/project.model";
import {
  STOCK_MOVEMENT_TYPES,
  StockMovementModel,
} from "../stock/stock-movement.model";
import { MaterialModel } from "../stock/material.model";
import { SupplierModel } from "../suppliers/supplier.model";
import {
  PURCHASE_STATUSES,
  type Purchase,
  type PurchaseStatus,
  PurchaseModel,
} from "./purchase.model";
import type {
  CreatePurchaseInput,
  ListPurchasesInput,
  PurchaseItemInput,
  ReceivePurchaseInput,
  UpdatePurchaseStatusInput,
} from "./purchase.schemas";

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

function normalizeItems(items: PurchaseItemInput[]): {
  materialId: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  totalCost: number;
}[] {
  return items.map((item) => {
    const totalCost = Number((item.quantityOrdered * item.unitCost).toFixed(2));
    return {
      materialId: item.materialId,
      quantityOrdered: item.quantityOrdered,
      quantityReceived: 0,
      unitCost: item.unitCost,
      totalCost,
    };
  });
}

function sumEstimatedTotal(items: { totalCost: number }[]): number {
  return Number(
    items.reduce((acc, item) => acc + item.totalCost, 0).toFixed(2),
  );
}

async function assertSupplierExists(supplierId: string): Promise<void> {
  const exists = await SupplierModel.exists({
    _id: supplierId,
    deletedAt: null,
    isActive: true,
  });

  if (!exists) {
    throw new AppError("Supplier not found", 404, "SUPPLIER_NOT_FOUND");
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

async function assertMaterialsExist(items: PurchaseItemInput[]): Promise<void> {
  const materialIds = [...new Set(items.map((item) => item.materialId))];

  const materials = await MaterialModel.find({
    _id: { $in: materialIds },
    deletedAt: null,
    isActive: true,
  })
    .select("_id")
    .lean();

  if (materials.length !== materialIds.length) {
    throw new AppError(
      "One or more materials are invalid",
      404,
      "MATERIAL_NOT_FOUND",
    );
  }
}

function isPurchaseStatusEditable(status: PurchaseStatus): boolean {
  return (
    status === PURCHASE_STATUSES.DRAFT || status === PURCHASE_STATUSES.ORDERED
  );
}

export async function createPurchase(
  input: CreatePurchaseInput,
  actor: Actor,
): Promise<Purchase> {
  await assertSupplierExists(input.supplierId);
  await assertProjectExistsIfProvided(input.projectId);
  await assertMaterialsExist(input.items);

  const items = normalizeItems(input.items);
  const estimatedTotal = sumEstimatedTotal(items);
  const initialStatus = input.status ?? PURCHASE_STATUSES.ORDERED;

  const purchase = await PurchaseModel.create({
    supplierId: input.supplierId,
    projectId: input.projectId ?? null,
    status: initialStatus,
    currency: input.currency.toUpperCase(),
    notes: normalizeOptionalString(input.notes),
    items,
    estimatedTotal,
    receivedTotal: 0,
    orderedAt: initialStatus === PURCHASE_STATUSES.ORDERED ? new Date() : null,
    createdBy: actor.id,
    updatedBy: actor.id,
  });

  return purchase.toObject();
}

export async function listPurchases(query: ListPurchasesInput): Promise<{
  items: Purchase[];
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

  if (query.supplierId) {
    filter.supplierId = query.supplierId;
  }

  if (query.projectId) {
    filter.projectId = query.projectId;
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.search && query.search.trim().length > 0) {
    const regex = new RegExp(query.search.trim(), "i");
    filter.$or = [{ notes: regex }, { currency: regex }];
  }

  const [items, total] = await Promise.all([
    PurchaseModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    PurchaseModel.countDocuments(filter),
  ]);

  return buildPaginatedResponse({
    items,
    total,
    page,
    limit,
  });
}

export async function getPurchaseById(id: string): Promise<Purchase> {
  const purchase = await PurchaseModel.findOne({
    _id: id,
    deletedAt: null,
  }).lean();

  if (!purchase) {
    throw new AppError("Purchase not found", 404, "PURCHASE_NOT_FOUND");
  }

  return purchase;
}

export async function updatePurchaseStatus(
  id: string,
  input: UpdatePurchaseStatusInput,
  actor: Actor,
): Promise<Purchase> {
  const purchase = await PurchaseModel.findOne({
    _id: id,
    deletedAt: null,
  });

  if (!purchase) {
    throw new AppError("Purchase not found", 404, "PURCHASE_NOT_FOUND");
  }

  if (
    purchase.status === PURCHASE_STATUSES.RECEIVED &&
    input.status !== PURCHASE_STATUSES.RECEIVED
  ) {
    throw new AppError(
      "Received purchase cannot change status",
      409,
      "INVALID_PURCHASE_STATUS",
    );
  }

  if (
    input.status === PURCHASE_STATUSES.CANCELED &&
    purchase.receivedTotal > 0
  ) {
    throw new AppError(
      "Cannot cancel a purchase with received items",
      409,
      "PURCHASE_ALREADY_RECEIVED",
    );
  }

  purchase.status = input.status;
  purchase.updatedBy = actor.id;

  if (input.status === PURCHASE_STATUSES.ORDERED && !purchase.orderedAt) {
    purchase.orderedAt = new Date();
  }

  await purchase.save();
  return purchase.toObject();
}

export async function receivePurchase(
  purchaseId: string,
  input: ReceivePurchaseInput,
  actor: Actor,
): Promise<Purchase> {
  const session = await mongoose.startSession();

  try {
    let purchaseResult: Purchase | null = null;
    let totalReceivedDelta = 0;

    await session.withTransaction(async () => {
      const purchase = await PurchaseModel.findOne({
        _id: purchaseId,
        deletedAt: null,
      }).session(session);

      if (!purchase) {
        throw new AppError("Purchase not found", 404, "PURCHASE_NOT_FOUND");
      }

      if (
        !isPurchaseStatusEditable(purchase.status) &&
        purchase.status !== PURCHASE_STATUSES.PARTIALLY_RECEIVED
      ) {
        throw new AppError(
          "Purchase cannot be received in current status",
          409,
          "INVALID_PURCHASE_STATUS",
        );
      }

      for (const receivedItem of input.receivedItems) {
        const index = purchase.items.findIndex(
          (item) => String(item.materialId) === receivedItem.materialId,
        );

        if (index === -1) {
          throw new AppError(
            `Material ${receivedItem.materialId} not present in purchase`,
            404,
            "PURCHASE_ITEM_NOT_FOUND",
          );
        }

        const item = purchase.items[index];
        if (!item) {
          throw new AppError(
            "Purchase item not found",
            404,
            "PURCHASE_ITEM_NOT_FOUND",
          );
        }

        const pending = Number(
          (item.quantityOrdered - item.quantityReceived).toFixed(4),
        );
        if (receivedItem.quantityReceived > pending) {
          throw new AppError(
            "Received quantity exceeds pending quantity",
            409,
            "RECEIVE_QUANTITY_EXCEEDS_PENDING",
          );
        }

        item.quantityReceived = Number(
          (item.quantityReceived + receivedItem.quantityReceived).toFixed(4),
        );

        const entryTotal = Number(
          (receivedItem.quantityReceived * item.unitCost).toFixed(2),
        );
        totalReceivedDelta = Number(
          (totalReceivedDelta + entryTotal).toFixed(2),
        );

        const movement = new StockMovementModel({
          materialId: item.materialId,
          projectId: purchase.projectId ?? null,
          type: STOCK_MOVEMENT_TYPES.INGRESO,
          quantity: receivedItem.quantityReceived,
          unitCost: item.unitCost,
          note: input.note ?? `Ingreso por compra ${purchase.id}`,
          createdBy: actor.id,
          updatedBy: actor.id,
        });

        await movement.save({ session });
      }

      purchase.receivedTotal = Number(
        (purchase.receivedTotal + totalReceivedDelta).toFixed(2),
      );

      const fullyReceived = purchase.items.every(
        (item) => item.quantityReceived >= item.quantityOrdered,
      );

      purchase.status = fullyReceived
        ? PURCHASE_STATUSES.RECEIVED
        : PURCHASE_STATUSES.PARTIALLY_RECEIVED;
      purchase.receivedAt = fullyReceived
        ? new Date()
        : (purchase.receivedAt ?? null);
      purchase.updatedBy = actor.id;
      await purchase.save({ session });

      eventBus.publish({
        name: DOMAIN_EVENTS.COMPRA_RECIBIDA,
        payload: {
          purchaseId: purchase.id,
          supplierId: String(purchase.supplierId),
          projectId: purchase.projectId ? String(purchase.projectId) : null,
          receivedItems: input.receivedItems,
          receivedAmount: totalReceivedDelta,
        },
        occurredAt: new Date().toISOString(),
        actorId: actor.id,
        correlationId: purchase.id,
      });

      purchaseResult = purchase.toObject();
    });

    if (!purchaseResult) {
      throw new AppError(
        "Unable to receive purchase",
        500,
        "PURCHASE_RECEIVE_FAILED",
      );
    }

    return purchaseResult;
  } finally {
    await session.endSession();
  }
}

export async function softDeletePurchase(
  id: string,
  actor: Actor,
): Promise<void> {
  const purchase = await PurchaseModel.findOne({
    _id: id,
    deletedAt: null,
  });

  if (!purchase) {
    throw new AppError("Purchase not found", 404, "PURCHASE_NOT_FOUND");
  }

  if (
    purchase.status === PURCHASE_STATUSES.RECEIVED ||
    purchase.receivedTotal > 0
  ) {
    throw new AppError(
      "Cannot delete purchase with received items",
      409,
      "PURCHASE_ALREADY_RECEIVED",
    );
  }

  purchase.status = PURCHASE_STATUSES.CANCELED;
  purchase.deletedAt = new Date();
  purchase.deletedBy = actor.id;
  purchase.updatedBy = actor.id;
  await purchase.save();
}
