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
  MaterialModel,
  type MaterialCategory,
  type MaterialDocument,
} from "./material.model";
import { ProjectMaterialRequirementModel } from "./project-material-requirement.model";
import {
  STOCK_MOVEMENT_TYPES,
  StockMovementModel,
  type StockMovementType,
} from "./stock-movement.model";
import type {
  CreateMaterialInput,
  ListProjectMaterialRequirementsInput,
  ListPurchaseSuggestionsInput,
  ListMaterialsInput,
  ListStockMovementsInput,
  RegisterStockMovementInput,
  ReserveMaterialForProjectInput,
  UpsertProjectMaterialRequirementInput,
  UpdateMaterialInput,
} from "./stock.schemas";

type Actor = {
  id: string;
};

type PublicMaterial = {
  id: string;
  name: string;
  category: MaterialCategory;
  sku: string | null;
  unit: string;
  minStock: number;
  isActive: boolean;
  currentStock: number;
  isLowStock: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type PublicStockMovement = {
  id: string;
  materialId: string;
  type: StockMovementType;
  quantity: number;
  unitCost: number | null;
  projectId: string | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PublicProjectMaterialRequirement = {
  id: string;
  projectId: string;
  materialId: string;
  requiredQuantity: number;
  reservedQuantity: number;
  consumedQuantity: number;
  pendingToReserve: number;
  createdAt: Date;
  updatedAt: Date;
};

type PublicPurchaseSuggestion = {
  materialId: string;
  materialName: string;
  category: MaterialCategory;
  currentStock: number;
  minStock: number;
  missingQuantity: number;
  estimatedUnitCost: number;
  estimatedCost: number;
};

function normalizeSku(value?: string | null): string | null {
  if (value === null) {
    return null;
  }

  if (!value) {
    return null;
  }

  const trimmed = value.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNote(value?: string): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function assertUniqueSku(
  sku: string | null,
  currentId?: string,
): Promise<void> {
  if (!sku) {
    return;
  }

  const existing = await MaterialModel.findOne({ sku }).select("_id").lean();

  if (!existing) {
    return;
  }

  if (currentId && String(existing._id) === currentId) {
    return;
  }

  throw new AppError("SKU already in use", 409, "SKU_ALREADY_IN_USE");
}

async function ensureMaterialExists(
  materialId: string,
): Promise<MaterialDocument> {
  const material = await MaterialModel.findOne({
    _id: materialId,
    deletedAt: null,
  });

  if (!material) {
    throw new AppError("Material not found", 404, "MATERIAL_NOT_FOUND");
  }

  return material;
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

async function getCurrentStock(materialId: string): Promise<number> {
  const totals = await StockMovementModel.aggregate<{ total: number }>([
    {
      $match: {
        materialId: new mongoose.Types.ObjectId(materialId),
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: null,
        ingreso: {
          $sum: {
            $cond: [
              { $eq: ["$type", STOCK_MOVEMENT_TYPES.INGRESO] },
              "$quantity",
              0,
            ],
          },
        },
        devolucion: {
          $sum: {
            $cond: [
              { $eq: ["$type", STOCK_MOVEMENT_TYPES.DEVOLUCION] },
              "$quantity",
              0,
            ],
          },
        },
        ajuste: {
          $sum: {
            $cond: [
              { $eq: ["$type", STOCK_MOVEMENT_TYPES.AJUSTE] },
              "$quantity",
              0,
            ],
          },
        },
        reserva: {
          $sum: {
            $cond: [
              { $eq: ["$type", STOCK_MOVEMENT_TYPES.RESERVA] },
              "$quantity",
              0,
            ],
          },
        },
        consumo: {
          $sum: {
            $cond: [
              { $eq: ["$type", STOCK_MOVEMENT_TYPES.CONSUMO] },
              "$quantity",
              0,
            ],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        total: {
          $subtract: [
            {
              $add: ["$ingreso", "$devolucion", "$ajuste"],
            },
            {
              $add: ["$reserva", "$consumo"],
            },
          ],
        },
      },
    },
  ]);

  return Number((totals[0]?.total ?? 0).toFixed(4));
}

function toPublicMaterial(
  value: {
    _id: unknown;
    name: string;
    category: MaterialCategory;
    sku?: string | null;
    unit: string;
    minStock: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  },
  stock: number,
): PublicMaterial {
  return {
    id: String(value._id),
    name: value.name,
    category: value.category,
    sku: value.sku ?? null,
    unit: value.unit,
    minStock: value.minStock,
    isActive: value.isActive,
    currentStock: stock,
    isLowStock: stock < value.minStock,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function toPublicMovement(value: {
  _id: unknown;
  materialId: unknown;
  type: StockMovementType;
  quantity: number;
  unitCost?: number | null;
  projectId?: unknown;
  note?: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PublicStockMovement {
  return {
    id: String(value._id),
    materialId: String(value.materialId),
    type: value.type,
    quantity: value.quantity,
    unitCost: value.unitCost ?? null,
    projectId: value.projectId ? String(value.projectId) : null,
    note: value.note ?? null,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function toPublicProjectMaterialRequirement(value: {
  _id: unknown;
  projectId: unknown;
  materialId: unknown;
  requiredQuantity: number;
  reservedQuantity: number;
  consumedQuantity: number;
  createdAt: Date;
  updatedAt: Date;
}): PublicProjectMaterialRequirement {
  const pendingToReserve = Math.max(
    Number((value.requiredQuantity - value.reservedQuantity).toFixed(4)),
    0,
  );

  return {
    id: String(value._id),
    projectId: String(value.projectId),
    materialId: String(value.materialId),
    requiredQuantity: value.requiredQuantity,
    reservedQuantity: value.reservedQuantity,
    consumedQuantity: value.consumedQuantity,
    pendingToReserve,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

async function getLastKnownUnitCost(materialId: string): Promise<number> {
  const movement = await StockMovementModel.findOne({
    materialId,
    deletedAt: null,
    unitCost: { $ne: null },
    type: {
      $in: [
        STOCK_MOVEMENT_TYPES.INGRESO,
        STOCK_MOVEMENT_TYPES.AJUSTE,
        STOCK_MOVEMENT_TYPES.DEVOLUCION,
      ],
    },
  })
    .sort({ createdAt: -1 })
    .select("unitCost")
    .lean();

  return movement?.unitCost ?? 0;
}

async function emitLowStockEventIfNeeded(
  materialId: string,
  actorId: string,
): Promise<void> {
  const material = await MaterialModel.findOne({
    _id: materialId,
    deletedAt: null,
  }).lean();

  if (!material) {
    return;
  }

  const stock = await getCurrentStock(materialId);
  if (stock >= material.minStock) {
    return;
  }

  eventBus.publish({
    name: DOMAIN_EVENTS.STOCK_BAJO_DETECTADO,
    payload: {
      materialId,
      materialName: material.name,
      currentStock: stock,
      minStock: material.minStock,
      estimatedMissing: Number((material.minStock - stock).toFixed(4)),
    },
    occurredAt: new Date().toISOString(),
    actorId,
    correlationId: `${materialId}:low-stock:${Date.now()}`,
  });
}

export async function createMaterial(
  input: CreateMaterialInput,
  actor: Actor,
): Promise<PublicMaterial> {
  const sku = normalizeSku(input.sku);
  await assertUniqueSku(sku);

  const material = new MaterialModel({
    name: input.name,
    category: input.category,
    sku,
    unit: input.unit,
    minStock: input.minStock,
    isActive: true,
    createdBy: actor.id,
    updatedBy: actor.id,
  });

  await material.save();

  return toPublicMaterial(material.toObject(), 0);
}

export async function listMaterials(query: ListMaterialsInput): Promise<{
  items: PublicMaterial[];
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

  if (query.category) {
    filter.category = query.category;
  }

  if (query.activeOnly !== "false") {
    filter.isActive = true;
  }

  if (query.search && query.search.trim().length > 0) {
    const regex = new RegExp(query.search.trim(), "i");
    filter.$or = [{ name: regex }, { sku: regex }];
  }

  const [materialsRaw, total] = await Promise.all([
    MaterialModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("name category sku unit minStock isActive createdAt updatedAt")
      .lean(),
    MaterialModel.countDocuments(filter),
  ]);

  const itemsWithStock = await Promise.all(
    materialsRaw.map(async (item) => {
      const stock = await getCurrentStock(String(item._id));
      return toPublicMaterial(item, stock);
    }),
  );

  const items =
    query.lowStockOnly === "true"
      ? itemsWithStock.filter((item) => item.isLowStock)
      : itemsWithStock;

  return buildPaginatedResponse({
    items,
    total: query.lowStockOnly === "true" ? items.length : total,
    page,
    limit,
  });
}

export async function getMaterialById(id: string): Promise<PublicMaterial> {
  const material = await MaterialModel.findOne({
    _id: id,
    deletedAt: null,
  })
    .select("name category sku unit minStock isActive createdAt updatedAt")
    .lean();

  if (!material) {
    throw new AppError("Material not found", 404, "MATERIAL_NOT_FOUND");
  }

  const stock = await getCurrentStock(id);
  return toPublicMaterial(material, stock);
}

export async function updateMaterial(
  id: string,
  input: UpdateMaterialInput,
  actor: Actor,
): Promise<PublicMaterial> {
  await ensureMaterialExists(id);

  if (input.sku !== undefined) {
    await assertUniqueSku(normalizeSku(input.sku), id);
  }

  const updatePayload: Record<string, unknown> = {
    updatedBy: actor.id,
  };

  if (input.name !== undefined) {
    updatePayload.name = input.name;
  }

  if (input.category !== undefined) {
    updatePayload.category = input.category;
  }

  if (input.sku !== undefined) {
    updatePayload.sku = normalizeSku(input.sku);
  }

  if (input.unit !== undefined) {
    updatePayload.unit = input.unit;
  }

  if (input.minStock !== undefined) {
    updatePayload.minStock = input.minStock;
  }

  if (input.isActive !== undefined) {
    updatePayload.isActive = input.isActive;
  }

  const material = await MaterialModel.findOneAndUpdate(
    { _id: id, deletedAt: null },
    updatePayload,
    {
      new: true,
      projection: {
        name: 1,
        category: 1,
        sku: 1,
        unit: 1,
        minStock: 1,
        isActive: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ).lean();

  if (!material) {
    throw new AppError("Material not found", 404, "MATERIAL_NOT_FOUND");
  }

  const stock = await getCurrentStock(id);
  return toPublicMaterial(material, stock);
}

export async function softDeleteMaterial(
  id: string,
  actor: Actor,
): Promise<void> {
  await ensureMaterialExists(id);

  const result = await MaterialModel.updateOne(
    { _id: id, deletedAt: null },
    {
      isActive: false,
      deletedAt: new Date(),
      deletedBy: actor.id,
      updatedBy: actor.id,
    },
  );

  if (result.matchedCount === 0) {
    throw new AppError("Material not found", 404, "MATERIAL_NOT_FOUND");
  }
}

export async function registerStockMovement(
  input: RegisterStockMovementInput,
  actor: Actor,
): Promise<PublicStockMovement> {
  const material = await ensureMaterialExists(input.materialId);

  if (!material.isActive) {
    throw new AppError("Material is inactive", 409, "MATERIAL_INACTIVE");
  }

  const currentStock = await getCurrentStock(input.materialId);
  const isOutbound =
    input.type === STOCK_MOVEMENT_TYPES.RESERVA ||
    input.type === STOCK_MOVEMENT_TYPES.CONSUMO;

  if (isOutbound && currentStock < input.quantity) {
    throw new AppError("Insufficient stock", 409, "INSUFFICIENT_STOCK");
  }

  const movement = new StockMovementModel({
    materialId: input.materialId,
    type: input.type,
    quantity: input.quantity,
    unitCost: input.unitCost ?? null,
    projectId: input.projectId ?? null,
    note: normalizeNote(input.note),
    createdBy: actor.id,
    updatedBy: actor.id,
  });

  await movement.save();

  if (input.type === STOCK_MOVEMENT_TYPES.RESERVA) {
    eventBus.publish({
      name: DOMAIN_EVENTS.MATERIAL_RESERVADO,
      payload: {
        materialId: input.materialId,
        projectId: input.projectId ?? null,
        quantity: input.quantity,
      },
      occurredAt: new Date().toISOString(),
      actorId: actor.id,
      correlationId: movement.id,
    });
  }

  if (
    input.type === STOCK_MOVEMENT_TYPES.CONSUMO &&
    input.unitCost !== undefined
  ) {
    const amount = Number((input.quantity * input.unitCost).toFixed(2));
    if (amount > 0) {
      eventBus.publish({
        name: DOMAIN_EVENTS.CMV_REGISTRADO,
        payload: {
          originId: movement.id,
          materialId: input.materialId,
          projectId: input.projectId ?? null,
          amount,
        },
        occurredAt: new Date().toISOString(),
        actorId: actor.id,
        correlationId: movement.id,
      });
    }
  }

  await emitLowStockEventIfNeeded(input.materialId, actor.id);

  return toPublicMovement(movement.toObject());
}

export async function listStockMovements(
  query: ListStockMovementsInput,
): Promise<{
  items: PublicStockMovement[];
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

  if (query.materialId) {
    filter.materialId = query.materialId;
  }

  if (query.projectId) {
    filter.projectId = query.projectId;
  }

  if (query.type) {
    filter.type = query.type;
  }

  const [itemsRaw, total] = await Promise.all([
    StockMovementModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        "materialId type quantity unitCost projectId note createdAt updatedAt",
      )
      .lean(),
    StockMovementModel.countDocuments(filter),
  ]);

  return buildPaginatedResponse({
    items: itemsRaw.map((item) => toPublicMovement(item)),
    total,
    page,
    limit,
  });
}

export async function upsertProjectMaterialRequirement(
  input: UpsertProjectMaterialRequirementInput,
  actor: Actor,
): Promise<PublicProjectMaterialRequirement> {
  await assertProjectExists(input.projectId);
  await ensureMaterialExists(input.materialId);

  const existing = await ProjectMaterialRequirementModel.findOne({
    projectId: input.projectId,
    materialId: input.materialId,
    deletedAt: null,
  });

  if (existing) {
    if (input.requiredQuantity < existing.reservedQuantity) {
      throw new AppError(
        "Required quantity cannot be lower than reserved quantity",
        409,
        "INVALID_REQUIRED_QUANTITY",
      );
    }

    existing.requiredQuantity = input.requiredQuantity;
    existing.updatedBy = actor.id;
    await existing.save();
    return toPublicProjectMaterialRequirement(existing.toObject());
  }

  const requirement = new ProjectMaterialRequirementModel({
    projectId: input.projectId,
    materialId: input.materialId,
    requiredQuantity: input.requiredQuantity,
    reservedQuantity: 0,
    consumedQuantity: 0,
    createdBy: actor.id,
    updatedBy: actor.id,
  });

  await requirement.save();
  return toPublicProjectMaterialRequirement(requirement.toObject());
}

export async function listProjectMaterialRequirements(
  query: ListProjectMaterialRequirementsInput,
): Promise<{
  items: PublicProjectMaterialRequirement[];
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

  if (query.materialId) {
    filter.materialId = query.materialId;
  }

  const [itemsRaw, total] = await Promise.all([
    ProjectMaterialRequirementModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        "projectId materialId requiredQuantity reservedQuantity consumedQuantity createdAt updatedAt",
      )
      .lean(),
    ProjectMaterialRequirementModel.countDocuments(filter),
  ]);

  return buildPaginatedResponse({
    items: itemsRaw.map((item) => toPublicProjectMaterialRequirement(item)),
    total,
    page,
    limit,
  });
}

export async function reserveMaterialForProjectRequirement(
  requirementId: string,
  input: ReserveMaterialForProjectInput,
  actor: Actor,
): Promise<PublicProjectMaterialRequirement> {
  const session = await mongoose.startSession();

  try {
    let result: PublicProjectMaterialRequirement | null = null;
    let materialIdForLowStock: string | null = null;

    await session.withTransaction(async () => {
      const requirement = await ProjectMaterialRequirementModel.findOne({
        _id: requirementId,
        deletedAt: null,
      }).session(session);

      if (!requirement) {
        throw new AppError(
          "Project material requirement not found",
          404,
          "PROJECT_MATERIAL_REQUIREMENT_NOT_FOUND",
        );
      }

      const pendingToReserve = Number(
        (requirement.requiredQuantity - requirement.reservedQuantity).toFixed(
          4,
        ),
      );

      if (pendingToReserve <= 0) {
        throw new AppError(
          "Requirement already fully reserved",
          409,
          "REQUIREMENT_ALREADY_RESERVED",
        );
      }

      if (input.quantity > pendingToReserve) {
        throw new AppError(
          "Reserve quantity exceeds pending requirement",
          409,
          "RESERVE_QUANTITY_EXCEEDS_PENDING",
        );
      }

      const currentStock = await getCurrentStock(
        String(requirement.materialId),
      );
      if (currentStock < input.quantity) {
        throw new AppError("Insufficient stock", 409, "INSUFFICIENT_STOCK");
      }

      const movement = new StockMovementModel({
        materialId: requirement.materialId,
        projectId: requirement.projectId,
        type: STOCK_MOVEMENT_TYPES.RESERVA,
        quantity: input.quantity,
        unitCost: null,
        note: `Reserva para requerimiento ${requirement.id}`,
        createdBy: actor.id,
        updatedBy: actor.id,
      });

      await movement.save({ session });

      requirement.reservedQuantity = Number(
        (requirement.reservedQuantity + input.quantity).toFixed(4),
      );
      requirement.updatedBy = actor.id;
      await requirement.save({ session });

      eventBus.publish({
        name: DOMAIN_EVENTS.MATERIAL_RESERVADO,
        payload: {
          materialId: String(requirement.materialId),
          projectId: String(requirement.projectId),
          quantity: input.quantity,
        },
        occurredAt: new Date().toISOString(),
        actorId: actor.id,
        correlationId: movement.id,
      });

      eventBus.publish({
        name: DOMAIN_EVENTS.MATERIAL_ASIGNADO_A_PROYECTO,
        payload: {
          materialId: String(requirement.materialId),
          projectId: String(requirement.projectId),
          requirementId: requirement.id,
          quantity: input.quantity,
        },
        occurredAt: new Date().toISOString(),
        actorId: actor.id,
        correlationId: requirement.id,
      });

      materialIdForLowStock = String(requirement.materialId);
      result = toPublicProjectMaterialRequirement(requirement.toObject());
    });

    if (!result || !materialIdForLowStock) {
      throw new AppError(
        "Unable to reserve material for project",
        500,
        "PROJECT_MATERIAL_RESERVE_FAILED",
      );
    }

    await emitLowStockEventIfNeeded(materialIdForLowStock, actor.id);

    return result;
  } finally {
    await session.endSession();
  }
}

export async function listPurchaseSuggestions(
  query: ListPurchaseSuggestionsInput,
): Promise<{
  items: PublicPurchaseSuggestion[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  totals: {
    estimatedTotalCost: number;
  };
}> {
  const { page, limit, skip } = parsePaginationInput(query);
  const materialFilter: Record<string, unknown> = {
    deletedAt: null,
    isActive: true,
  };

  if (query.category) {
    materialFilter.category = query.category;
  }

  if (query.search && query.search.trim().length > 0) {
    const regex = new RegExp(query.search.trim(), "i");
    materialFilter.$or = [{ name: regex }, { sku: regex }];
  }

  const materials = await MaterialModel.find(materialFilter)
    .sort({ name: 1 })
    .select("name category minStock")
    .lean();

  const suggestionsAll: PublicPurchaseSuggestion[] = [];
  for (const material of materials) {
    const currentStock = await getCurrentStock(String(material._id));
    const missingQuantity = Number(
      (material.minStock - currentStock).toFixed(4),
    );

    if (missingQuantity <= 0) {
      continue;
    }

    const estimatedUnitCost = await getLastKnownUnitCost(String(material._id));
    suggestionsAll.push({
      materialId: String(material._id),
      materialName: material.name,
      category: material.category,
      currentStock,
      minStock: material.minStock,
      missingQuantity,
      estimatedUnitCost,
      estimatedCost: Number((estimatedUnitCost * missingQuantity).toFixed(2)),
    });
  }

  const total = suggestionsAll.length;
  const items = suggestionsAll.slice(skip, skip + limit);
  const estimatedTotalCost = Number(
    suggestionsAll
      .reduce((acc, item) => acc + item.estimatedCost, 0)
      .toFixed(2),
  );

  return {
    ...buildPaginatedResponse({
      items,
      total,
      page,
      limit,
    }),
    totals: {
      estimatedTotalCost,
    },
  };
}

export async function generatePurchaseSuggestionsEvent(actor: Actor): Promise<{
  count: number;
  estimatedTotalCost: number;
}> {
  const result = await listPurchaseSuggestions({});

  eventBus.publish({
    name: DOMAIN_EVENTS.LISTA_COMPRA_GENERADA,
    payload: {
      count: result.pagination.total,
      estimatedTotalCost: result.totals.estimatedTotalCost,
      items: result.items,
    },
    occurredAt: new Date().toISOString(),
    actorId: actor.id,
    correlationId: `purchase-list:${Date.now()}`,
  });

  return {
    count: result.pagination.total,
    estimatedTotalCost: result.totals.estimatedTotalCost,
  };
}
