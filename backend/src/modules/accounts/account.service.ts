import mongoose from "mongoose";

import { AppError } from "../../core/errors/app-error";
import {
  buildPaginatedResponse,
  parsePaginationInput,
} from "../../core/utils/pagination";
import type {
  CreateAccountInput,
  ListAccountsInput,
  UpdateAccountInput,
} from "./account.schemas";
import {
  ACCOUNT_NATURES,
  AccountModel,
  type AccountNature,
  type ResultClassification,
} from "./account.model";

type Actor = {
  id: string;
};

type PublicAccount = {
  id: string;
  code: string;
  name: string;
  naturaleza: AccountNature;
  resultClassification: ResultClassification | null;
  parentAccountId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function toPublicAccount(value: {
  _id: unknown;
  code: string;
  name: string;
  naturaleza: AccountNature;
  resultClassification?: ResultClassification | null;
  parentAccountId?: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): PublicAccount {
  return {
    id: String(value._id),
    code: value.code,
    name: value.name,
    naturaleza: value.naturaleza,
    resultClassification: value.resultClassification ?? null,
    parentAccountId: value.parentAccountId
      ? String(value.parentAccountId)
      : null,
    isActive: value.isActive,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

async function assertUniqueCode(
  code: string,
  currentId?: string,
): Promise<void> {
  const existing = await AccountModel.findOne({ code: code.toUpperCase() })
    .select("_id")
    .lean();

  if (!existing) {
    return;
  }

  if (currentId && String(existing._id) === currentId) {
    return;
  }

  throw new AppError(
    "Account code already exists",
    409,
    "ACCOUNT_CODE_ALREADY_EXISTS",
  );
}

async function assertParentExists(parentAccountId: string): Promise<void> {
  const parent = await AccountModel.findOne({
    _id: parentAccountId,
    deletedAt: null,
  })
    .select("_id")
    .lean();

  if (!parent) {
    throw new AppError(
      "Parent account not found",
      404,
      "PARENT_ACCOUNT_NOT_FOUND",
    );
  }
}

async function ensureAccountExists(id: string): Promise<void> {
  const account = await AccountModel.findOne({ _id: id, deletedAt: null })
    .select("_id")
    .lean();

  if (!account) {
    throw new AppError("Account not found", 404, "ACCOUNT_NOT_FOUND");
  }
}

function normalizeResultClassification(
  naturaleza: AccountNature,
  resultClassification?: ResultClassification | null,
): ResultClassification | null {
  if (naturaleza !== ACCOUNT_NATURES.RESULTADO) {
    return null;
  }

  return resultClassification ?? null;
}

export async function createAccount(
  input: CreateAccountInput,
  actor: Actor,
): Promise<PublicAccount> {
  await assertUniqueCode(input.code);

  if (input.parentAccountId) {
    await assertParentExists(input.parentAccountId);
  }

  const account = new AccountModel({
    code: input.code.toUpperCase(),
    name: input.name,
    naturaleza: input.naturaleza,
    resultClassification: normalizeResultClassification(
      input.naturaleza,
      input.resultClassification,
    ),
    parentAccountId: input.parentAccountId ?? null,
    isActive: input.isActive ?? true,
    createdBy: actor.id,
    updatedBy: actor.id,
  });

  await account.save();

  return toPublicAccount(account.toObject());
}

export async function listAccounts(query: ListAccountsInput): Promise<{
  items: PublicAccount[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}> {
  const { page, limit, skip } = parsePaginationInput(query);
  const filter: Record<string, unknown> = { deletedAt: null };

  if (query.naturaleza) {
    filter.naturaleza = query.naturaleza;
  }

  if (query.resultClassification) {
    filter.resultClassification = query.resultClassification;
  }

  if (query.activeOnly !== "false") {
    filter.isActive = true;
  }

  if (query.parentAccountId) {
    filter.parentAccountId = query.parentAccountId;
  }

  if (query.search && query.search.trim().length > 0) {
    const regex = new RegExp(query.search.trim(), "i");
    filter.$or = [{ name: regex }, { code: regex }];
  }

  const [itemsRaw, total] = await Promise.all([
    AccountModel.find(filter)
      .sort({ code: 1 })
      .skip(skip)
      .limit(limit)
      .select(
        "code name naturaleza resultClassification parentAccountId isActive createdAt updatedAt",
      )
      .lean(),
    AccountModel.countDocuments(filter),
  ]);

  return buildPaginatedResponse({
    items: itemsRaw.map((item) => toPublicAccount(item)),
    total,
    page,
    limit,
  });
}

export async function getAccountById(id: string): Promise<PublicAccount> {
  const account = await AccountModel.findOne({
    _id: id,
    deletedAt: null,
  })
    .select(
      "code name naturaleza resultClassification parentAccountId isActive createdAt updatedAt",
    )
    .lean();

  if (!account) {
    throw new AppError("Account not found", 404, "ACCOUNT_NOT_FOUND");
  }

  return toPublicAccount(account);
}

export async function updateAccount(
  id: string,
  input: UpdateAccountInput,
  actor: Actor,
): Promise<PublicAccount> {
  await ensureAccountExists(id);

  if (input.code !== undefined) {
    await assertUniqueCode(input.code, id);
  }

  if (input.parentAccountId !== undefined && input.parentAccountId !== null) {
    if (input.parentAccountId === id) {
      throw new AppError(
        "An account cannot be parent of itself",
        409,
        "INVALID_PARENT_ACCOUNT",
      );
    }
    await assertParentExists(input.parentAccountId);
  }

  const updatePayload: Record<string, unknown> = {
    updatedBy: actor.id,
  };

  if (input.code !== undefined) {
    updatePayload.code = input.code.toUpperCase();
  }

  if (input.name !== undefined) {
    updatePayload.name = input.name;
  }

  if (input.naturaleza !== undefined) {
    updatePayload.naturaleza = input.naturaleza;
  }

  if (input.resultClassification !== undefined) {
    updatePayload.resultClassification = input.resultClassification;
  }

  if (
    input.naturaleza !== undefined &&
    input.naturaleza !== ACCOUNT_NATURES.RESULTADO
  ) {
    updatePayload.resultClassification = null;
  }

  if (input.parentAccountId !== undefined) {
    updatePayload.parentAccountId = input.parentAccountId;
  }

  if (input.isActive !== undefined) {
    updatePayload.isActive = input.isActive;
  }

  const account = await AccountModel.findOneAndUpdate(
    { _id: id, deletedAt: null },
    updatePayload,
    {
      new: true,
      projection: {
        code: 1,
        name: 1,
        naturaleza: 1,
        resultClassification: 1,
        parentAccountId: 1,
        isActive: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ).lean();

  if (!account) {
    throw new AppError("Account not found", 404, "ACCOUNT_NOT_FOUND");
  }

  return toPublicAccount(account);
}

export async function softDeleteAccount(
  id: string,
  actor: Actor,
): Promise<void> {
  await ensureAccountExists(id);

  const activeChildren = await AccountModel.exists({
    parentAccountId: new mongoose.Types.ObjectId(id),
    deletedAt: null,
  });

  if (activeChildren) {
    throw new AppError(
      "Cannot delete account with active child accounts",
      409,
      "ACCOUNT_HAS_CHILDREN",
    );
  }

  await AccountModel.updateOne(
    { _id: id, deletedAt: null },
    {
      isActive: false,
      deletedAt: new Date(),
      deletedBy: actor.id,
      updatedBy: actor.id,
    },
  );
}
