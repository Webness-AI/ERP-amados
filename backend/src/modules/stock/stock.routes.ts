import { Router } from "express";

import { authMiddleware } from "../../core/auth/auth.middleware";
import { authorizeMiddleware } from "../../core/auth/authorize.middleware";
import { AppError } from "../../core/errors/app-error";
import { ROLES } from "../auth/roles";
import {
  createMaterial,
  generatePurchaseSuggestionsEvent,
  getMaterialById,
  listMaterials,
  listProjectMaterialRequirements,
  listPurchaseRecommendations,
  listPurchaseSuggestions,
  listStockMovements,
  registerStockMovement,
  reserveMaterialForProjectRequirement,
  softDeleteMaterial,
  upsertProjectMaterialRequirement,
  updateMaterial,
} from "./stock.service";
import {
  createMaterialSchema,
  listMaterialsSchema,
  listProjectMaterialRequirementsSchema,
  listPurchaseRecommendationsSchema,
  listPurchaseSuggestionsSchema,
  listStockMovementsSchema,
  registerStockMovementSchema,
  reserveMaterialForProjectSchema,
  upsertProjectMaterialRequirementSchema,
  updateMaterialSchema,
} from "./stock.schemas";

const stockRouter = Router();
const READ_ROLES = [ROLES.ADMIN_GENERAL, ROLES.ADMIN, ROLES.USER];
const WRITE_ROLES = [ROLES.ADMIN_GENERAL, ROLES.ADMIN];

function requireRouteParam(value: unknown, paramName: string): string {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  throw new AppError(
    `Missing route param: ${paramName}`,
    400,
    "INVALID_ROUTE_PARAM",
  );
}

stockRouter.get(
  "/materials",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const query = listMaterialsSchema.parse(req.query);
      const result = await listMaterials(query);

      res.status(200).json({
        ok: true,
        data: result,
      });
    })().catch(next);
  },
);

stockRouter.get(
  "/materials/:id",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const materialId = requireRouteParam(req.params.id, "id");
      const material = await getMaterialById(materialId);

      res.status(200).json({
        ok: true,
        data: { material },
      });
    })().catch(next);
  },
);

stockRouter.post(
  "/materials",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const payload = createMaterialSchema.parse(req.body);
      const material = await createMaterial(payload, { id: req.user!.id });

      res.status(201).json({
        ok: true,
        data: { material },
      });
    })().catch(next);
  },
);

stockRouter.patch(
  "/materials/:id",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const materialId = requireRouteParam(req.params.id, "id");
      const payload = updateMaterialSchema.parse(req.body);
      const material = await updateMaterial(materialId, payload, {
        id: req.user!.id,
      });

      res.status(200).json({
        ok: true,
        data: { material },
      });
    })().catch(next);
  },
);

stockRouter.delete(
  "/materials/:id",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const materialId = requireRouteParam(req.params.id, "id");
      await softDeleteMaterial(materialId, { id: req.user!.id });

      res.status(200).json({
        ok: true,
        data: { message: "Material deleted" },
      });
    })().catch(next);
  },
);

stockRouter.get(
  "/movements",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const query = listStockMovementsSchema.parse(req.query);
      const result = await listStockMovements(query);

      res.status(200).json({
        ok: true,
        data: result,
      });
    })().catch(next);
  },
);

stockRouter.post(
  "/movements",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const payload = registerStockMovementSchema.parse(req.body);
      const movement = await registerStockMovement(payload, {
        id: req.user!.id,
      });

      res.status(201).json({
        ok: true,
        data: { movement },
      });
    })().catch(next);
  },
);

stockRouter.get(
  "/project-requirements",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const query = listProjectMaterialRequirementsSchema.parse(req.query);
      const result = await listProjectMaterialRequirements(query);

      res.status(200).json({
        ok: true,
        data: result,
      });
    })().catch(next);
  },
);

stockRouter.post(
  "/project-requirements",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const payload = upsertProjectMaterialRequirementSchema.parse(req.body);
      const requirement = await upsertProjectMaterialRequirement(payload, {
        id: req.user!.id,
      });

      res.status(201).json({
        ok: true,
        data: { requirement },
      });
    })().catch(next);
  },
);

stockRouter.post(
  "/project-requirements/:id/reserve",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const requirementId = requireRouteParam(req.params.id, "id");
      const payload = reserveMaterialForProjectSchema.parse(req.body);
      const requirement = await reserveMaterialForProjectRequirement(
        requirementId,
        payload,
        { id: req.user!.id },
      );

      res.status(200).json({
        ok: true,
        data: { requirement },
      });
    })().catch(next);
  },
);

stockRouter.get(
  "/purchase-recommendations",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const query = listPurchaseRecommendationsSchema.parse(req.query);
      const result = await listPurchaseRecommendations(query);

      res.status(200).json({
        ok: true,
        data: result,
      });
    })().catch(next);
  },
);

stockRouter.get(
  "/purchase-list",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const query = listPurchaseSuggestionsSchema.parse(req.query);
      const result = await listPurchaseSuggestions(query);

      res.status(200).json({
        ok: true,
        data: result,
      });
    })().catch(next);
  },
);

stockRouter.post(
  "/purchase-list/generate",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const result = await generatePurchaseSuggestionsEvent({
        id: req.user!.id,
      });

      res.status(200).json({
        ok: true,
        data: result,
      });
    })().catch(next);
  },
);

export { stockRouter };
