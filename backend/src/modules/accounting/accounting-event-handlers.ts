import {
  DOMAIN_EVENTS,
  type DomainEvent,
} from "../../core/events/domain-events";
import { eventBus } from "../../core/events/event-bus";
import { postEventDrivenJournalEntry } from "./journal-entry.service";

type BudgetApprovedPayload = {
  budgetId?: string;
  clientId?: string;
  total?: number;
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
