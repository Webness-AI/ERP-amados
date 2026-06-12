import PDFDocument from "pdfkit";

import { AppError } from "../../core/errors/app-error";
import { getBudgetById } from "../budgets/budget.service";
import { ClientModel } from "../clients/client.model";
import { CollectionModel } from "../collections/collection.model";
import { ProductionOrderModel } from "../production/production-order.model";
import { PurchaseModel } from "../purchases/purchase.model";
import { MaterialModel } from "../stock/material.model";
import { ProjectMaterialRequirementModel } from "../stock/project-material-requirement.model";
import { StockMovementModel } from "../stock/stock-movement.model";
import { SupplierModel } from "../suppliers/supplier.model";
import { PROJECT_STATUSES, ProjectModel } from "./project.model";

type PlainObject = Record<string, unknown>;

type ProjectPdfDetail = {
  project: PlainObject;
  client: PlainObject | null;
  budget: PlainObject | null;
  collection: PlainObject | null;
  purchasesWithSupplier: Array<{
    purchase: PlainObject;
    supplier: PlainObject | null;
  }>;
  productionOrders: PlainObject[];
  stockRequirementsWithMaterial: Array<{
    requirement: PlainObject;
    material: PlainObject | null;
  }>;
  stockMovementsWithMaterial: Array<{
    movement: PlainObject;
    material: PlainObject | null;
  }>;
  summary: {
    purchases: {
      count: number;
      estimatedTotal: number;
      receivedTotal: number;
    };
    stock: {
      requirementsCount: number;
      movementsCount: number;
      requiredQuantity: number;
      reservedQuantity: number;
      consumedQuantity: number;
    };
    production: {
      count: number;
      openCount: number;
    };
  };
};

function toPlainObject(value: unknown): PlainObject {
  if (!value || typeof value !== "object") {
    return {};
  }
  return value as PlainObject;
}

function toStringId(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object" && "toString" in value) {
    return String(value);
  }

  return null;
}

function formatDate(value: unknown): string {
  if (!value) {
    return "-";
  }

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toISOString();
}

function formatMoney(value: unknown, currency = "ARS"): string {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return `${currency} ${safeAmount.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function streamPdfToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

function ensurePageSpace(doc: PDFKit.PDFDocument, extra = 36): void {
  if (doc.y > doc.page.height - doc.page.margins.bottom - extra) {
    doc.addPage();
  }
}

function writeSectionTitle(doc: PDFKit.PDFDocument, title: string): void {
  ensurePageSpace(doc, 48);
  doc.moveDown(0.5);
  doc.fontSize(13).font("Helvetica-Bold").text(title);
  doc.moveDown(0.2);
  doc.font("Helvetica").fontSize(10);
}

function writeKv(doc: PDFKit.PDFDocument, label: string, value: unknown): void {
  ensurePageSpace(doc, 22);
  const textValue =
    value === null || value === undefined || value === "" ? "-" : String(value);
  doc.font("Helvetica-Bold").text(`${label}: `, { continued: true });
  doc.font("Helvetica").text(textValue);
}

function writeJsonBlock(
  doc: PDFKit.PDFDocument,
  title: string,
  payload: unknown,
): void {
  writeSectionTitle(doc, title);
  const serialized = JSON.stringify(payload, null, 2) ?? "{}";
  const lines = serialized.split("\n");

  for (const line of lines) {
    ensurePageSpace(doc, 18);
    doc.font("Courier").fontSize(8).text(line);
  }

  doc.font("Helvetica").fontSize(10);
}

async function buildProjectPdfDetail(projectId: string): Promise<ProjectPdfDetail> {
  const projectRaw = await ProjectModel.findOne({
    _id: projectId,
    deletedAt: null,
  }).lean();

  if (!projectRaw) {
    throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");
  }

  const project = toPlainObject(projectRaw);
  const clientId = toStringId(project.clientId);
  const budgetId = toStringId(project.budgetId);

  const [clientRaw, purchasesRaw, productionOrdersRaw, requirementsRaw, stockMovementsRaw] =
    await Promise.all([
      clientId
        ? ClientModel.findOne({ _id: clientId, deletedAt: null }).lean()
        : Promise.resolve(null),
      PurchaseModel.find({ projectId, deletedAt: null }).sort({ createdAt: -1 }).lean(),
      ProductionOrderModel.find({ projectId, deletedAt: null })
        .sort({ createdAt: -1 })
        .lean(),
      ProjectMaterialRequirementModel.find({ projectId, deletedAt: null })
        .sort({ createdAt: -1 })
        .lean(),
      StockMovementModel.find({ projectId, deletedAt: null })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

  let budgetRaw: PlainObject | null = null;
  if (budgetId) {
    try {
      budgetRaw = toPlainObject(await getBudgetById(budgetId));
    } catch {
      budgetRaw = null;
    }
  }

  const collectionId = toStringId(budgetRaw?.collectionId);
  const collectionRaw = collectionId
    ? await CollectionModel.findOne({ _id: collectionId, deletedAt: null }).lean()
    : await CollectionModel.findOne({ projectId, deletedAt: null })
        .sort({ createdAt: -1 })
        .lean();

  const supplierIds = Array.from(
    new Set(
      purchasesRaw
        .map((purchase) => toStringId(toPlainObject(purchase).supplierId))
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const materialIds = new Set<string>();
  for (const requirement of requirementsRaw) {
    const id = toStringId(toPlainObject(requirement).materialId);
    if (id) {
      materialIds.add(id);
    }
  }
  for (const movement of stockMovementsRaw) {
    const id = toStringId(toPlainObject(movement).materialId);
    if (id) {
      materialIds.add(id);
    }
  }
  for (const purchase of purchasesRaw) {
    const purchaseObj = toPlainObject(purchase);
    const items = Array.isArray(purchaseObj.items) ? purchaseObj.items : [];
    for (const item of items) {
      const itemId = toStringId(toPlainObject(item).materialId);
      if (itemId) {
        materialIds.add(itemId);
      }
    }
  }

  const budgetMaterials = Array.isArray(budgetRaw?.materials)
    ? (budgetRaw?.materials as unknown[])
    : [];
  for (const material of budgetMaterials) {
    const id = toStringId(toPlainObject(material).materialId);
    if (id) {
      materialIds.add(id);
    }
  }

  const [suppliersRaw, materialsRaw] = await Promise.all([
    supplierIds.length > 0
      ? SupplierModel.find({ _id: { $in: supplierIds }, deletedAt: null }).lean()
      : Promise.resolve([]),
    materialIds.size > 0
      ? MaterialModel.find({ _id: { $in: Array.from(materialIds) }, deletedAt: null }).lean()
      : Promise.resolve([]),
  ]);

  const suppliersById = new Map<string, PlainObject>();
  for (const supplier of suppliersRaw) {
    const obj = toPlainObject(supplier);
    const id = toStringId(obj._id);
    if (id) {
      suppliersById.set(id, obj);
    }
  }

  const materialsById = new Map<string, PlainObject>();
  for (const material of materialsRaw) {
    const obj = toPlainObject(material);
    const id = toStringId(obj._id);
    if (id) {
      materialsById.set(id, obj);
    }
  }

  const purchasesWithSupplier = purchasesRaw.map((purchaseRaw) => {
    const purchase = toPlainObject(purchaseRaw);
    const supplierId = toStringId(purchase.supplierId);

    return {
      purchase,
      supplier: supplierId ? suppliersById.get(supplierId) ?? null : null,
    };
  });

  const stockRequirementsWithMaterial = requirementsRaw.map((requirementRaw) => {
    const requirement = toPlainObject(requirementRaw);
    const materialId = toStringId(requirement.materialId);

    return {
      requirement,
      material: materialId ? materialsById.get(materialId) ?? null : null,
    };
  });

  const stockMovementsWithMaterial = stockMovementsRaw.map((movementRaw) => {
    const movement = toPlainObject(movementRaw);
    const materialId = toStringId(movement.materialId);

    return {
      movement,
      material: materialId ? materialsById.get(materialId) ?? null : null,
    };
  });

  const purchasesSummary = purchasesWithSupplier.reduce(
    (acc, item) => {
      const purchase = item.purchase;
      const estimatedTotal = Number(purchase.estimatedTotal ?? 0);
      const receivedTotal = Number(purchase.receivedTotal ?? 0);

      return {
        count: acc.count + 1,
        estimatedTotal: acc.estimatedTotal + (Number.isFinite(estimatedTotal) ? estimatedTotal : 0),
        receivedTotal: acc.receivedTotal + (Number.isFinite(receivedTotal) ? receivedTotal : 0),
      };
    },
    {
      count: 0,
      estimatedTotal: 0,
      receivedTotal: 0,
    },
  );

  const stockSummary = stockRequirementsWithMaterial.reduce(
    (acc, item) => {
      const requirement = item.requirement;
      const requiredQuantity = Number(requirement.requiredQuantity ?? 0);
      const reservedQuantity = Number(requirement.reservedQuantity ?? 0);
      const consumedQuantity = Number(requirement.consumedQuantity ?? 0);

      return {
        requirementsCount: acc.requirementsCount + 1,
        movementsCount: acc.movementsCount,
        requiredQuantity:
          acc.requiredQuantity + (Number.isFinite(requiredQuantity) ? requiredQuantity : 0),
        reservedQuantity:
          acc.reservedQuantity + (Number.isFinite(reservedQuantity) ? reservedQuantity : 0),
        consumedQuantity:
          acc.consumedQuantity + (Number.isFinite(consumedQuantity) ? consumedQuantity : 0),
      };
    },
    {
      requirementsCount: 0,
      movementsCount: stockMovementsWithMaterial.length,
      requiredQuantity: 0,
      reservedQuantity: 0,
      consumedQuantity: 0,
    },
  );

  const productionSummary = {
    count: productionOrdersRaw.length,
    openCount: productionOrdersRaw.filter(
      (order) => toPlainObject(order).status !== "FINALIZADO",
    ).length,
  };

  return {
    project,
    client: clientRaw ? toPlainObject(clientRaw) : null,
    budget: budgetRaw,
    collection: collectionRaw ? toPlainObject(collectionRaw) : null,
    purchasesWithSupplier,
    productionOrders: productionOrdersRaw.map((order) => toPlainObject(order)),
    stockRequirementsWithMaterial,
    stockMovementsWithMaterial,
    summary: {
      purchases: purchasesSummary,
      stock: stockSummary,
      production: productionSummary,
    },
  };
}

function writeOverviewSection(
  doc: PDFKit.PDFDocument,
  detail: ProjectPdfDetail,
): void {
  const project = detail.project;
  const budget = detail.budget;
  const collection = detail.collection;

  writeSectionTitle(doc, "Resumen del proyecto");
  writeKv(doc, "Proyecto", project.name);
  writeKv(doc, "ID proyecto", project._id);
  writeKv(doc, "Estado", project.status);
  writeKv(doc, "Cliente ID", project.clientId);
  writeKv(doc, "Presupuesto ID", project.budgetId);
  writeKv(doc, "Entrega", formatDate(project.deliveryDate));
  writeKv(doc, "Localidad", project.localidad);
  writeKv(doc, "Contacto", project.contacto);
  writeKv(doc, "Dirección", project.direccion);
  writeKv(doc, "Descripción", project.description);
  writeKv(doc, "Creado", formatDate(project.createdAt));
  writeKv(doc, "Actualizado", formatDate(project.updatedAt));

  if (budget) {
    writeSectionTitle(doc, "Resumen comercial (presupuesto)");
    writeKv(doc, "Título", budget.title);
    writeKv(doc, "Estado presupuesto", budget.status);
    writeKv(doc, "Moneda", budget.currency ?? "ARS");
    writeKv(doc, "Subtotal", formatMoney(budget.subtotal, String(budget.currency ?? "ARS")));
    writeKv(doc, "Total", formatMoney(budget.total, String(budget.currency ?? "ARS")));
    writeKv(
      doc,
      "Precio final",
      formatMoney(budget.finalPrice ?? budget.total, String(budget.currency ?? "ARS")),
    );
  }

  if (collection) {
    writeSectionTitle(doc, "Resumen de cobros");
    writeKv(doc, "Estado cobro", collection.status);
    writeKv(doc, "Total cobro", formatMoney(collection.totalAmount, String(collection.currency ?? "ARS")));
    writeKv(doc, "Pagado", formatMoney(collection.paidAmount, String(collection.currency ?? "ARS")));
    writeKv(doc, "Pendiente", formatMoney(collection.pendingAmount, String(collection.currency ?? "ARS")));
    writeKv(doc, "Vencimiento", formatDate(collection.dueDate));
  }

  writeSectionTitle(doc, "Resumen operativo");
  writeKv(doc, "Compras", detail.summary.purchases.count);
  writeKv(doc, "Total compras estimado", formatMoney(detail.summary.purchases.estimatedTotal));
  writeKv(doc, "Total compras recibido", formatMoney(detail.summary.purchases.receivedTotal));
  writeKv(doc, "Órdenes de producción", detail.summary.production.count);
  writeKv(doc, "Órdenes abiertas", detail.summary.production.openCount);
  writeKv(doc, "Requerimientos de stock", detail.summary.stock.requirementsCount);
  writeKv(doc, "Movimientos de stock", detail.summary.stock.movementsCount);
  writeKv(doc, "Cantidad requerida", detail.summary.stock.requiredQuantity);
  writeKv(doc, "Cantidad reservada", detail.summary.stock.reservedQuantity);
  writeKv(doc, "Cantidad consumida", detail.summary.stock.consumedQuantity);
}

function writeArrayAsJson(
  doc: PDFKit.PDFDocument,
  title: string,
  payload: unknown,
): void {
  writeJsonBlock(doc, title, payload);
}

function renderProjectDetail(
  doc: PDFKit.PDFDocument,
  detail: ProjectPdfDetail,
  sectionIndex: number,
): void {
  if (sectionIndex > 0) {
    doc.addPage();
  }

  doc.fontSize(17).font("Helvetica-Bold").text("Reporte integral de proyecto");
  doc.fontSize(10).font("Helvetica").text(`Emitido: ${new Date().toISOString()}`);
  doc.moveDown(0.4);

  writeOverviewSection(doc, detail);

  writeJsonBlock(doc, "Cliente (detalle completo)", detail.client);
  writeJsonBlock(doc, "Presupuesto (detalle completo)", detail.budget);
  writeJsonBlock(doc, "Cobros (detalle completo)", detail.collection);

  writeArrayAsJson(
    doc,
    "Compras + Proveedores (detalle completo)",
    detail.purchasesWithSupplier,
  );

  writeArrayAsJson(
    doc,
    "Producción (detalle completo)",
    detail.productionOrders,
  );

  writeArrayAsJson(
    doc,
    "Stock - Requerimientos + Materiales (detalle completo)",
    detail.stockRequirementsWithMaterial,
  );

  writeArrayAsJson(
    doc,
    "Stock - Movimientos + Materiales (detalle completo)",
    detail.stockMovementsWithMaterial,
  );
}

async function renderProjectsPdf(details: ProjectPdfDetail[]): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margin: 36,
    info: {
      Title: "Reporte de proyectos",
      Author: "ERP Amados",
      Subject: "Detalle integral de proyectos",
    },
  });

  const bufferPromise = streamPdfToBuffer(doc);

  details.forEach((detail, index) => {
    renderProjectDetail(doc, detail, index);
  });

  doc.end();
  return bufferPromise;
}

export async function generateProjectPdfBuffer(projectId: string): Promise<Buffer> {
  const detail = await buildProjectPdfDetail(projectId);
  return renderProjectsPdf([detail]);
}

export async function generateNonFinalizedProjectsPdfBuffer(): Promise<Buffer> {
  const projects = await ProjectModel.find({
    deletedAt: null,
    status: {
      $nin: [PROJECT_STATUSES.FINALIZADO, PROJECT_STATUSES.CANCELADO],
    },
  })
    .sort({ createdAt: -1 })
    .lean();

  if (projects.length === 0) {
    const emptyDoc = new PDFDocument({ size: "A4", margin: 36 });
    const bufferPromise = streamPdfToBuffer(emptyDoc);
    emptyDoc.fontSize(16).font("Helvetica-Bold").text("Reporte de proyectos no finalizados");
    emptyDoc.moveDown();
    emptyDoc.fontSize(11).font("Helvetica").text("No hay proyectos activos para reportar.");
    emptyDoc.end();
    return bufferPromise;
  }

  const details = await Promise.all(
    projects.map((project) => buildProjectPdfDetail(String(project._id))),
  );

  return renderProjectsPdf(details);
}
