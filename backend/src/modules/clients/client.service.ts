import {
  buildPaginatedResponse,
  parsePaginationInput,
} from "../../core/utils/pagination";
import { AppError } from "../../core/errors/app-error";
import type { Client } from "./client.model";
import { ClientModel } from "./client.model";
import type {
  CreateClientInput,
  ListClientsInput,
  UpdateClientInput,
} from "./client.schemas";

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

export async function createClient(
  input: CreateClientInput,
  actor: Actor,
): Promise<Client> {
  const client = await ClientModel.create({
    name: input.name,
    contactName: normalizeOptionalString(input.contactName),
    email: normalizeOptionalString(input.email)?.toLowerCase() ?? null,
    phone: normalizeOptionalString(input.phone),
    notes: normalizeOptionalString(input.notes),
    isActive: true,
    createdBy: actor.id,
    updatedBy: actor.id,
  });

  return client.toObject();
}

export async function listClients(query: ListClientsInput): Promise<{
  items: Client[];
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
    ClientModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ClientModel.countDocuments(filter),
  ]);

  return buildPaginatedResponse({
    items,
    total,
    page,
    limit,
  });
}

export async function getClientById(id: string): Promise<Client> {
  const client = await ClientModel.findOne({
    _id: id,
    deletedAt: null,
  }).lean();

  if (!client) {
    throw new AppError("Client not found", 404, "CLIENT_NOT_FOUND");
  }

  return client;
}

export async function updateClient(
  id: string,
  input: UpdateClientInput,
  actor: Actor,
): Promise<Client> {
  const updatePayload: Partial<Client> = {
    updatedBy: actor.id,
  };

  if (typeof input.name === "string") {
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

  const client = await ClientModel.findOneAndUpdate(
    { _id: id, deletedAt: null },
    updatePayload,
    { new: true },
  ).lean();

  if (!client) {
    throw new AppError("Client not found", 404, "CLIENT_NOT_FOUND");
  }

  return client;
}

export async function softDeleteClient(
  id: string,
  actor: Actor,
): Promise<void> {
  const client = await ClientModel.findOneAndUpdate(
    {
      _id: id,
      deletedAt: null,
    },
    {
      isActive: false,
      deletedAt: new Date(),
      deletedBy: actor.id,
      updatedBy: actor.id,
    },
    { new: true },
  ).lean();

  if (!client) {
    throw new AppError("Client not found", 404, "CLIENT_NOT_FOUND");
  }
}
