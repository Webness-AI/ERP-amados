import { AppError } from "../../core/errors/app-error";
import {
  buildPaginatedResponse,
  parsePaginationInput,
} from "../../core/utils/pagination";
import { ProjectModel } from "../projects/project.model";
import {
  PRODUCTION_STATUSES,
  type ProductionOrder,
  ProductionOrderModel,
} from "./production-order.model";
import type {
  CreateProductionOrderInput,
  ListProductionOrdersInput,
  UpdateProductionOrderInput,
  UpdateProductionOrderStatusInput,
} from "./production-order.schemas";

type Actor = {
  id: string;
};

function normalizeOptionalString(value?: string | null): string | null {
  if (value === null) {
    return null;
  }

  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function assertProjectExists(projectId: string): Promise<void> {
  const exists = await ProjectModel.exists({
    _id: projectId,
    deletedAt: null,
    isActive: true,
  });

  if (!exists) {
    throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");
  }
}

export async function createProductionOrder(
  input: CreateProductionOrderInput,
  actor: Actor,
): Promise<ProductionOrder> {
  await assertProjectExists(input.projectId);

  const order = await ProductionOrderModel.create({
    projectId: input.projectId,
    title: input.title,
    status: PRODUCTION_STATUSES.PENDIENTE,
    priority: input.priority,
    assigneeName: normalizeOptionalString(input.assigneeName),
    notes: normalizeOptionalString(input.notes),
    startedAt: null,
    finishedAt: null,
    createdBy: actor.id,
    updatedBy: actor.id,
  });

  return order.toObject();
}

export async function listProductionOrders(
  query: ListProductionOrdersInput,
): Promise<{
  items: ProductionOrder[];
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

  if (query.projectId) {
    filter.projectId = query.projectId;
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.priority) {
    filter.priority = query.priority;
  }

  if (query.search && query.search.trim().length > 0) {
    const regex = new RegExp(query.search.trim(), "i");
    filter.$or = [{ title: regex }, { assigneeName: regex }];
  }

  const [items, total] = await Promise.all([
    ProductionOrderModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ProductionOrderModel.countDocuments(filter),
  ]);

  return buildPaginatedResponse({
    items,
    total,
    page,
    limit,
  });
}

export async function getProductionOrderById(
  id: string,
): Promise<ProductionOrder> {
  const order = await ProductionOrderModel.findOne({
    _id: id,
    deletedAt: null,
  }).lean();

  if (!order) {
    throw new AppError(
      "Production order not found",
      404,
      "PRODUCTION_ORDER_NOT_FOUND",
    );
  }

  return order;
}

export async function updateProductionOrder(
  id: string,
  input: UpdateProductionOrderInput,
  actor: Actor,
): Promise<ProductionOrder> {
  const updatePayload: Partial<ProductionOrder> = {
    updatedBy: actor.id,
  };

  if (input.title !== undefined) {
    updatePayload.title = input.title;
  }

  if (input.priority !== undefined) {
    updatePayload.priority = input.priority;
  }

  if (input.assigneeName !== undefined) {
    updatePayload.assigneeName = normalizeOptionalString(input.assigneeName);
  }

  if (input.notes !== undefined) {
    updatePayload.notes = normalizeOptionalString(input.notes);
  }

  const order = await ProductionOrderModel.findOneAndUpdate(
    { _id: id, deletedAt: null },
    updatePayload,
    { new: true },
  ).lean();

  if (!order) {
    throw new AppError(
      "Production order not found",
      404,
      "PRODUCTION_ORDER_NOT_FOUND",
    );
  }

  return order;
}

export async function updateProductionOrderStatus(
  id: string,
  input: UpdateProductionOrderStatusInput,
  actor: Actor,
): Promise<ProductionOrder> {
  const order = await ProductionOrderModel.findOne({
    _id: id,
    deletedAt: null,
  });

  if (!order) {
    throw new AppError(
      "Production order not found",
      404,
      "PRODUCTION_ORDER_NOT_FOUND",
    );
  }

  order.status = input.status;
  order.updatedBy = actor.id;

  if (input.status !== PRODUCTION_STATUSES.PENDIENTE && !order.startedAt) {
    order.startedAt = new Date();
  }

  if (input.status === PRODUCTION_STATUSES.FINALIZADO) {
    order.finishedAt = new Date();
  } else {
    order.finishedAt = null;
  }

  await order.save();
  return order.toObject();
}

export async function softDeleteProductionOrder(
  id: string,
  actor: Actor,
): Promise<void> {
  const order = await ProductionOrderModel.findOneAndUpdate(
    { _id: id, deletedAt: null },
    {
      deletedAt: new Date(),
      deletedBy: actor.id,
      updatedBy: actor.id,
    },
    { new: true },
  ).lean();

  if (!order) {
    throw new AppError(
      "Production order not found",
      404,
      "PRODUCTION_ORDER_NOT_FOUND",
    );
  }
}
