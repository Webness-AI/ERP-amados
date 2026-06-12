import mongoose from "mongoose";

import { AppError } from "../../core/errors/app-error";
import { eventBus } from "../../core/events/event-bus";
import { DOMAIN_EVENTS } from "../../core/events/domain-events";
import {
  buildPaginatedResponse,
  parsePaginationInput,
} from "../../core/utils/pagination";
import {
  normalizeOptionalString,
  toDateOrNull,
} from "../../core/utils/formatting";
import { BUDGET_STATUSES, BudgetModel } from "../budgets/budget.model";
import { ClientModel } from "../clients/client.model";
import {
  PROJECT_STATUSES,
  type Project,
  type ProjectStatus,
  ProjectModel,
} from "./project.model";
import { assertProjectTransitionAllowed } from "./project.states";
import type {
  CreateProjectFromBudgetInput,
  CreateProjectInput,
  ListProjectsInput,
  UpdateProjectInput,
  UpdateProjectStatusInput,
} from "./project.schemas";

type Actor = {
  id: string;
};

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

async function assertBudgetExistsIfProvided(budgetId?: string): Promise<void> {
  if (!budgetId) {
    return;
  }

  const exists = await BudgetModel.exists({
    _id: budgetId,
    deletedAt: null,
  });

  if (!exists) {
    throw new AppError("Budget not found", 404, "BUDGET_NOT_FOUND");
  }
}

export async function createProject(
  input: CreateProjectInput,
  actor: Actor,
): Promise<Project> {
  await assertClientExists(input.clientId);
  await assertBudgetExistsIfProvided(input.budgetId);

  const project = await ProjectModel.create({
    clientId: input.clientId,
    budgetId: input.budgetId ?? null,
    name: input.name,
    description: normalizeOptionalString(input.description),
    localidad: normalizeOptionalString(input.localidad),
    contacto: normalizeOptionalString(input.contacto),
    direccion: normalizeOptionalString(input.direccion),
    status: input.status ?? PROJECT_STATUSES.CONSULTA,
    deliveryDate: toDateOrNull(input.deliveryDate),
    isActive: true,
    createdBy: actor.id,
    updatedBy: actor.id,
  });

  return project.toObject();
}

export async function listProjects(query: ListProjectsInput): Promise<{
  items: Project[];
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
      { name: regex },
      { description: regex },
      { localidad: regex },
      { contacto: regex },
      { direccion: regex },
    ];
  }

  const [items, total] = await Promise.all([
    ProjectModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ProjectModel.countDocuments(filter),
  ]);

  return buildPaginatedResponse({
    items,
    total,
    page,
    limit,
  });
}

export async function getProjectById(id: string): Promise<Project> {
  const project = await ProjectModel.findOne({
    _id: id,
    deletedAt: null,
  }).lean();

  if (!project) {
    throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");
  }

  return project;
}

export async function updateProject(
  id: string,
  input: UpdateProjectInput,
  actor: Actor,
): Promise<Project> {
  if (input.budgetId !== undefined) {
    await assertBudgetExistsIfProvided(input.budgetId);
  }

  const updatePayload: Partial<Project> = {
    updatedBy: actor.id,
  };

  if (typeof input.name === "string") {
    updatePayload.name = input.name;
  }

  if (input.description !== undefined) {
    updatePayload.description = normalizeOptionalString(input.description);
  }

  if (input.localidad !== undefined) {
    updatePayload.localidad = normalizeOptionalString(input.localidad);
  }

  if (input.contacto !== undefined) {
    updatePayload.contacto = normalizeOptionalString(input.contacto);
  }

  if (input.direccion !== undefined) {
    updatePayload.direccion = normalizeOptionalString(input.direccion);
  }

  if (input.budgetId !== undefined) {
    updatePayload.budgetId = input.budgetId
      ? new mongoose.Types.ObjectId(input.budgetId)
      : null;
  }

  if (input.deliveryDate !== undefined) {
    updatePayload.deliveryDate = toDateOrNull(input.deliveryDate);
  }

  if (input.status !== undefined) {
    const currentProject = await ProjectModel.findOne({
      _id: id,
      deletedAt: null,
    }).lean();

    if (!currentProject) {
      throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");
    }

    assertProjectTransitionAllowed(
      currentProject.status,
      input.status as ProjectStatus,
    );
    updatePayload.status = input.status;
  }

  const project = await ProjectModel.findOneAndUpdate(
    { _id: id, deletedAt: null },
    updatePayload,
    { new: true },
  ).lean();

  if (!project) {
    throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");
  }

  if (project.status === PROJECT_STATUSES.FINALIZADO) {
    eventBus.publish({
      name: DOMAIN_EVENTS.PROYECTO_FINALIZADO,
      payload: {
        projectId: project._id.toString(),
        clientId: project.clientId.toString(),
      },
      occurredAt: new Date().toISOString(),
      actorId: actor.id,
      correlationId: project._id.toString(),
    });
  }

  return project;
}

export async function updateProjectStatus(
  id: string,
  input: UpdateProjectStatusInput,
  actor: Actor,
): Promise<Project> {
  const project = await ProjectModel.findOne({
    _id: id,
    deletedAt: null,
  });

  if (!project) {
    throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");
  }

  assertProjectTransitionAllowed(project.status, input.status);

  project.status = input.status;
  project.updatedBy = actor.id;
  await project.save();

  if (project.status === PROJECT_STATUSES.FINALIZADO) {
    eventBus.publish({
      name: DOMAIN_EVENTS.PROYECTO_FINALIZADO,
      payload: {
        projectId: project.id,
        clientId: String(project.clientId),
      },
      occurredAt: new Date().toISOString(),
      actorId: actor.id,
      correlationId: project.id,
    });
  }

  return project.toObject();
}

export async function createProjectFromApprovedBudget(
  budgetId: string,
  input: CreateProjectFromBudgetInput,
  actor: Actor,
): Promise<Project> {
  const session = await mongoose.startSession();

  try {
    let projectResult: Project | null = null;

    await session.withTransaction(async () => {
      const budget = await BudgetModel.findOne({
        _id: budgetId,
        deletedAt: null,
      }).session(session);

      if (!budget) {
        throw new AppError("Budget not found", 404, "BUDGET_NOT_FOUND");
      }

      if (budget.status !== BUDGET_STATUSES.APPROVED) {
        throw new AppError(
          "Budget must be approved to create a project",
          409,
          "BUDGET_NOT_APPROVED",
        );
      }

      if (budget.projectId) {
        throw new AppError(
          "Budget already linked to a project",
          409,
          "BUDGET_ALREADY_LINKED",
        );
      }

      const linkedBudgetInVersionGroup = await BudgetModel.findOne({
        _id: { $ne: budget._id },
        versionGroupId: budget.versionGroupId,
        projectId: { $ne: null },
        deletedAt: null,
      })
        .select("_id projectId")
        .session(session)
        .lean();

      if (linkedBudgetInVersionGroup?.projectId) {
        throw new AppError(
          "Budget version group already linked to a project",
          409,
          "BUDGET_VERSION_GROUP_ALREADY_LINKED",
        );
      }

      if (!budget.clientId) {
        throw new AppError(
          "Budget without client cannot create project",
          409,
          "BUDGET_CLIENT_REQUIRED",
        );
      }

      const clientId = budget.clientId;

      const project = await ProjectModel.create(
        [
          {
            clientId,
            budgetId: budget._id,
            name: input.name,
            description: normalizeOptionalString(input.description),
            status: PROJECT_STATUSES.APROBADO,
            deliveryDate: toDateOrNull(input.deliveryDate),
            isActive: true,
            createdBy: actor.id,
            updatedBy: actor.id,
          },
        ],
        { session },
      );

      const projectDoc = project[0];
      if (!projectDoc) {
        throw new AppError(
          "Unable to create project",
          500,
          "PROJECT_CREATE_FAILED",
        );
      }

      budget.projectId = projectDoc._id;
      budget.updatedBy = actor.id;
      await budget.save({ session });

      projectResult = projectDoc.toObject();
    });

    if (!projectResult) {
      throw new AppError(
        "Unable to create project",
        500,
        "PROJECT_CREATE_FAILED",
      );
    }

    return projectResult;
  } finally {
    await session.endSession();
  }
}

export async function softDeleteProject(
  id: string,
  actor: Actor,
): Promise<void> {
  const project = await ProjectModel.findOneAndUpdate(
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

  if (!project) {
    throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");
  }
}
