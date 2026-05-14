import { AppError } from "../../core/errors/app-error";
import {
  buildPaginatedResponse,
  parsePaginationInput,
} from "../../core/utils/pagination";
import { SupplierModel, type Supplier } from "./supplier.model";
import type {
  CreateSupplierInput,
  ListSuppliersInput,
  UpdateSupplierInput,
} from "./supplier.schemas";

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

export async function createSupplier(
  input: CreateSupplierInput,
  actor: Actor,
): Promise<Supplier> {
  const supplier = await SupplierModel.create({
    name: input.name,
    contactName: normalizeOptionalString(input.contactName),
    email: normalizeOptionalString(input.email)?.toLowerCase() ?? null,
    phone: normalizeOptionalString(input.phone),
    notes: normalizeOptionalString(input.notes),
    isActive: true,
    createdBy: actor.id,
    updatedBy: actor.id,
  });

  return supplier.toObject();
}

export async function listSuppliers(query: ListSuppliersInput): Promise<{
  items: Supplier[];
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

  if (query.activeOnly !== "false") {
    filter.isActive = true;
  }

  if (query.search && query.search.trim().length > 0) {
    const regex = new RegExp(query.search.trim(), "i");
    filter.$or = [{ name: regex }, { email: regex }, { contactName: regex }];
  }

  const [items, total] = await Promise.all([
    SupplierModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    SupplierModel.countDocuments(filter),
  ]);

  return buildPaginatedResponse({
    items,
    total,
    page,
    limit,
  });
}

export async function getSupplierById(id: string): Promise<Supplier> {
  const supplier = await SupplierModel.findOne({
    _id: id,
    deletedAt: null,
  }).lean();

  if (!supplier) {
    throw new AppError("Supplier not found", 404, "SUPPLIER_NOT_FOUND");
  }

  return supplier;
}

export async function updateSupplier(
  id: string,
  input: UpdateSupplierInput,
  actor: Actor,
): Promise<Supplier> {
  const updatePayload: Partial<Supplier> = {
    updatedBy: actor.id,
  };

  if (input.name !== undefined) {
    updatePayload.name = input.name;
  }

  if (input.contactName !== undefined) {
    updatePayload.contactName = normalizeOptionalString(input.contactName);
  }

  if (input.email !== undefined) {
    updatePayload.email =
      normalizeOptionalString(input.email)?.toLowerCase() ?? null;
  }

  if (input.phone !== undefined) {
    updatePayload.phone = normalizeOptionalString(input.phone);
  }

  if (input.notes !== undefined) {
    updatePayload.notes = normalizeOptionalString(input.notes);
  }

  const supplier = await SupplierModel.findOneAndUpdate(
    { _id: id, deletedAt: null },
    updatePayload,
    { new: true },
  ).lean();

  if (!supplier) {
    throw new AppError("Supplier not found", 404, "SUPPLIER_NOT_FOUND");
  }

  return supplier;
}

export async function softDeleteSupplier(
  id: string,
  actor: Actor,
): Promise<void> {
  const supplier = await SupplierModel.findOneAndUpdate(
    { _id: id, deletedAt: null },
    {
      isActive: false,
      deletedAt: new Date(),
      deletedBy: actor.id,
      updatedBy: actor.id,
    },
    { new: true },
  ).lean();

  if (!supplier) {
    throw new AppError("Supplier not found", 404, "SUPPLIER_NOT_FOUND");
  }
}
