import {
  DOMAIN_EVENTS,
  type DomainEvent,
} from "../../core/events/domain-events";
import { eventBus } from "../../core/events/event-bus";
import { BudgetModel } from "../budgets/budget.model";
import { postEventDrivenJournalEntry } from "./journal-entry.service";

type BudgetApprovedPayload = {
  budgetId?: string;
  clientId?: string;
  total?: number;
};

type BudgetAcceptedPayload = {
  budgetId?: string;
  clientId?: string;
  total?: number;
  createdClient?: boolean;
};

type BudgetDiscountOfferedPayload = {
  budgetId?: string;
  originalTotal?: number;
  discountedTotal?: number;
  discountPercentage?: number;
};

type BudgetFinalRejectedPayload = {
  budgetId?: string;
  reason?: string;
};

type PurchaseReceivedPayload = {
  purchaseId?: string;
  receivedAmount?: number;
};

type PaymentReceivedPayload = {
  collectionId?: string;
  amount?: number;
};

type FixedExpensePaidPayload = {
  fixedExpenseId?: string;
  amount?: number;
};

type CmvPayload = {
  originId?: string;
  amount?: number;
};

let initialized = false;

function readPositiveAmount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Number(value.toFixed(2));
}

function safeActorId(event: DomainEvent): string {
  return event.actorId ?? "system";
}

async function readApprovedBudgetTotals(
  budgetId: string,
): Promise<{ total: number; discountedTotal: number | null } | null> {
  const budget = await BudgetModel.findOne({
    _id: budgetId,
    deletedAt: null,
  })
    .select("approvedAt total discountedTotal")
    .lean();

  if (!budget || !budget.approvedAt) {
    return null;
  }

  return {
    total: readPositiveAmount(budget.total),
    discountedTotal: budget.discountedTotal
      ? readPositiveAmount(budget.discountedTotal)
      : null,
  };
}

function subscribeSafely<TPayload>(
  eventName: (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS],
  handler: (event: DomainEvent<TPayload>) => Promise<void>,
): void {
  eventBus.subscribe<TPayload>(eventName, (event) => {
    void handler(event).catch((error: unknown) => {
      console.error("Accounting event handler error", {
        eventName,
        error,
      });
    });
  });
}

async function handleBudgetApproved(
  event: DomainEvent<BudgetApprovedPayload>,
): Promise<void> {
  const amount = readPositiveAmount(event.payload.total);
  if (amount <= 0) {
    return;
  }

  const originEntityId = event.payload.budgetId?.trim();
  const correlationId = event.correlationId?.trim();

  await postEventDrivenJournalEntry({
    description: `Aprobacion de presupuesto ${event.payload.budgetId ?? ""}`,
    lines: [
      {
        accountCode: "ANTICIPOS_CLIENTES",
        debit: amount,
        credit: 0,
        description: "Reconocimiento de anticipo por presupuesto aprobado",
      },
      {
        accountCode: "VENTAS",
        debit: 0,
        credit: amount,
        description: "Ingreso por presupuesto aprobado",
      },
    ],
    actorId: safeActorId(event),
    originEvent: DOMAIN_EVENTS.PRESUPUESTO_APROBADO,
    originEntityType: "budget",
    ...(originEntityId ? { originEntityId } : {}),
    ...(correlationId ? { correlationId } : {}),
  });
}

async function handleBudgetAccepted(
  event: DomainEvent<BudgetAcceptedPayload>,
): Promise<void> {
  // PRESUPUESTO_APROBADO already creates the principal accounting entry.
  // This handler is intentionally left without journal posting to avoid duplicates.
  const correlationId = event.correlationId?.trim();
  if (!correlationId) {
    return;
  }
}

async function handleBudgetDiscountOffered(
  event: DomainEvent<BudgetDiscountOfferedPayload>,
): Promise<void> {
  const budgetId = event.payload.budgetId?.trim();
  if (!budgetId) {
    return;
  }

  const totals = await readApprovedBudgetTotals(budgetId);
  if (!totals) {
    return;
  }

  const originalTotal = readPositiveAmount(event.payload.originalTotal);
  const discountedTotal = readPositiveAmount(event.payload.discountedTotal);
  const fallbackDiscounted = totals.discountedTotal ?? totals.total;
  const effectiveOriginal = originalTotal > 0 ? originalTotal : totals.total;
  const effectiveDiscounted =
    discountedTotal > 0 ? discountedTotal : fallbackDiscounted;
  const adjustment = Number((effectiveOriginal - effectiveDiscounted).toFixed(2));

  if (adjustment <= 0) {
    return;
  }

  const correlationId = event.correlationId?.trim();

  await postEventDrivenJournalEntry({
    description: `Oferta de descuento presupuesto ${budgetId}`,
    lines: [
      {
        accountCode: "VENTAS",
        debit: adjustment,
        credit: 0,
        description: "Ajuste por descuento comercial ofrecido",
      },
      {
        accountCode: "ANTICIPOS_CLIENTES",
        debit: 0,
        credit: adjustment,
        description: "Ajuste de anticipo por descuento ofrecido",
      },
    ],
    actorId: safeActorId(event),
    originEvent: DOMAIN_EVENTS.PRESUPUESTO_DESCUENTO_OFRECIDO,
    originEntityType: "budget",
    originEntityId: budgetId,
    ...(correlationId ? { correlationId } : {}),
  });
}

async function handleBudgetFinalRejected(
  event: DomainEvent<BudgetFinalRejectedPayload>,
): Promise<void> {
  const budgetId = event.payload.budgetId?.trim();
  if (!budgetId) {
    return;
  }

  const totals = await readApprovedBudgetTotals(budgetId);
  if (!totals) {
    return;
  }

  const reversalAmount = totals.discountedTotal ?? totals.total;
  if (reversalAmount <= 0) {
    return;
  }

  const correlationId = event.correlationId?.trim();

  await postEventDrivenJournalEntry({
    description: `Rechazo final presupuesto ${budgetId}`,
    lines: [
      {
        accountCode: "VENTAS",
        debit: reversalAmount,
        credit: 0,
        description: "Reversion de ingreso por rechazo final",
      },
      {
        accountCode: "ANTICIPOS_CLIENTES",
        debit: 0,
        credit: reversalAmount,
        description: "Reversion de anticipo por rechazo final",
      },
    ],
    actorId: safeActorId(event),
    originEvent: DOMAIN_EVENTS.PRESUPUESTO_RECHAZADO_FINAL,
    originEntityType: "budget",
    originEntityId: budgetId,
    ...(correlationId ? { correlationId } : {}),
  });
}

async function handlePurchaseReceived(
  event: DomainEvent<PurchaseReceivedPayload>,
): Promise<void> {
  const amount = readPositiveAmount(event.payload.receivedAmount);
  if (amount <= 0) {
    return;
  }

  const originEntityId = event.payload.purchaseId?.trim();
  const correlationId = event.correlationId?.trim();

  await postEventDrivenJournalEntry({
    description: `Recepcion de compra ${event.payload.purchaseId ?? ""}`,
    lines: [
      {
        accountCode: "STOCK",
        debit: amount,
        credit: 0,
        description: "Ingreso de stock por compra",
      },
      {
        accountCode: "PROVEEDORES",
        debit: 0,
        credit: amount,
        description: "Obligacion con proveedor",
      },
    ],
    actorId: safeActorId(event),
    originEvent: DOMAIN_EVENTS.COMPRA_RECIBIDA,
    originEntityType: "purchase",
    ...(originEntityId ? { originEntityId } : {}),
    ...(correlationId ? { correlationId } : {}),
  });
}

async function handlePaymentReceived(
  event: DomainEvent<PaymentReceivedPayload>,
): Promise<void> {
  const amount = readPositiveAmount(event.payload.amount);
  if (amount <= 0) {
    return;
  }

  const originEntityId = event.payload.collectionId?.trim();
  const correlationId = event.correlationId?.trim();

  await postEventDrivenJournalEntry({
    description: `Pago recibido ${event.payload.collectionId ?? ""}`,
    lines: [
      {
        accountCode: "CAJA",
        debit: amount,
        credit: 0,
        description: "Ingreso de dinero",
      },
      {
        accountCode: "ANTICIPOS_CLIENTES",
        debit: 0,
        credit: amount,
        description: "Aplicacion de cobro",
      },
    ],
    actorId: safeActorId(event),
    originEvent: DOMAIN_EVENTS.PAGO_RECIBIDO,
    originEntityType: "collection",
    ...(originEntityId ? { originEntityId } : {}),
    ...(correlationId ? { correlationId } : {}),
  });
}

async function handleFixedExpensePaid(
  event: DomainEvent<FixedExpensePaidPayload>,
): Promise<void> {
  const amount = readPositiveAmount(event.payload.amount);
  if (amount <= 0) {
    return;
  }

  const originEntityId = event.payload.fixedExpenseId?.trim();
  const correlationId = event.correlationId?.trim();

  await postEventDrivenJournalEntry({
    description: `Pago gasto fijo ${event.payload.fixedExpenseId ?? ""}`,
    lines: [
      {
        accountCode: "GASTOS_FIJOS",
        debit: amount,
        credit: 0,
        description: "Registro de gasto fijo",
      },
      {
        accountCode: "CAJA",
        debit: 0,
        credit: amount,
        description: "Salida de dinero",
      },
    ],
    actorId: safeActorId(event),
    originEvent: DOMAIN_EVENTS.GASTO_PAGADO,
    originEntityType: "fixed-expense",
    ...(originEntityId ? { originEntityId } : {}),
    ...(correlationId ? { correlationId } : {}),
  });
}

async function handleCmvRegistered(
  event: DomainEvent<CmvPayload>,
): Promise<void> {
  const amount = readPositiveAmount(event.payload.amount);
  if (amount <= 0) {
    return;
  }

  const originEntityId = event.payload.originId?.trim();
  const correlationId = event.correlationId?.trim();

  await postEventDrivenJournalEntry({
    description: `Registro CMV ${event.payload.originId ?? ""}`,
    lines: [
      {
        accountCode: "CMV",
        debit: amount,
        credit: 0,
        description: "Reconocimiento del costo de mercaderia vendida",
      },
      {
        accountCode: "STOCK",
        debit: 0,
        credit: amount,
        description: "Baja de stock por consumo",
      },
    ],
    actorId: safeActorId(event),
    originEvent: DOMAIN_EVENTS.CMV_REGISTRADO,
    originEntityType: "stock-consumption",
    ...(originEntityId ? { originEntityId } : {}),
    ...(correlationId ? { correlationId } : {}),
  });
}

export function initializeAccountingEventHandlers(): void {
  if (initialized) {
    return;
  }

  subscribeSafely<BudgetApprovedPayload>(
    DOMAIN_EVENTS.PRESUPUESTO_APROBADO,
    handleBudgetApproved,
  );
  subscribeSafely<BudgetAcceptedPayload>(
    DOMAIN_EVENTS.PRESUPUESTO_ACEPTADO,
    handleBudgetAccepted,
  );
  subscribeSafely<BudgetDiscountOfferedPayload>(
    DOMAIN_EVENTS.PRESUPUESTO_DESCUENTO_OFRECIDO,
    handleBudgetDiscountOffered,
  );
  subscribeSafely<BudgetFinalRejectedPayload>(
    DOMAIN_EVENTS.PRESUPUESTO_RECHAZADO_FINAL,
    handleBudgetFinalRejected,
  );
  subscribeSafely<PurchaseReceivedPayload>(
    DOMAIN_EVENTS.COMPRA_RECIBIDA,
    handlePurchaseReceived,
  );
  subscribeSafely<PaymentReceivedPayload>(
    DOMAIN_EVENTS.PAGO_RECIBIDO,
    handlePaymentReceived,
  );
  subscribeSafely<FixedExpensePaidPayload>(
    DOMAIN_EVENTS.GASTO_PAGADO,
    handleFixedExpensePaid,
  );
  subscribeSafely<CmvPayload>(
    DOMAIN_EVENTS.CMV_REGISTRADO,
    handleCmvRegistered,
  );

  initialized = true;
}
