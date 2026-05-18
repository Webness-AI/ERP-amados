import { http } from "./http";

type ApiEnvelope<T> = {
  ok: true;
  data: T;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type AuthUser = {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
};

export type AuthData = {
  accessToken: string;
  user: AuthUser;
};

export type BudgetStatus =
  | "DRAFT"
  | "SENT"
  | "APPROVED"
  | "REJECTED"
  | "CANCELED";

export type BudgetItemInput = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export type BudgetItem = BudgetItemInput & {
  total: number;
};

export type BudgetRecord = {
  _id: string;
  clientId: string;
  title: string;
  description?: string | null;
  currency: string;
  items: BudgetItem[];
  subtotal: number;
  total: number;
  status: BudgetStatus;
  versionGroupId: string;
  version: number;
  parentBudgetId?: string | null;
  projectId?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PurchaseStatus =
  | "DRAFT"
  | "ORDERED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CANCELED";

export type PurchaseItemInput = {
  materialId: string;
  quantityOrdered: number;
  unitCost: number;
};

export type PurchaseReceivedItemInput = {
  materialId: string;
  quantityReceived: number;
};

export type PurchaseItemRecord = {
  materialId: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  totalCost: number;
};

export type PurchaseRecord = {
  _id: string;
  supplierId: string;
  projectId?: string | null;
  status: PurchaseStatus;
  currency: string;
  items: PurchaseItemRecord[];
  estimatedTotal: number;
  receivedTotal: number;
  notes?: string | null;
  orderedAt?: string | null;
  receivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProductionStatus =
  | "PENDIENTE"
  | "CORTE"
  | "ARMADO"
  | "INSTALACION"
  | "FINALIZADO";

export type ProductionPriority = "LOW" | "MEDIUM" | "HIGH";

export type ProductionOrderRecord = {
  _id: string;
  projectId: string;
  title: string;
  status: ProductionStatus;
  priority: ProductionPriority;
  assigneeName?: string | null;
  notes?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CashSource = "CASH" | "BANK";

export type CashDirection = "INCOME" | "EXPENSE";

export type CashPaymentMethod =
  | "EFECTIVO"
  | "TRANSFERENCIA"
  | "TARJETA"
  | "CHEQUE"
  | "OTRO";

export type CashMovementRecord = {
  _id: string;
  source: CashSource;
  direction: CashDirection;
  paymentMethod: CashPaymentMethod;
  amount: number;
  currency: string;
  concept: string;
  clientId?: string | null;
  projectId?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
};

export type FixedExpenseFrequency =
  | "MENSUAL"
  | "BIMESTRAL"
  | "TRIMESTRAL"
  | "ANUAL";

export type FixedExpenseStatus = "ACTIVO" | "PAUSADO";

export type FixedExpensePaymentRecord = {
  amount: number;
  paidAt: string;
  note?: string | null;
  createdBy: string;
};

export type FixedExpenseRecord = {
  _id: string;
  name: string;
  amount: number;
  currency: string;
  frequency: FixedExpenseFrequency;
  status: FixedExpenseStatus;
  nextDueDate: string;
  lastPaidAt?: string | null;
  notes?: string | null;
  payments: FixedExpensePaymentRecord[];
  createdAt: string;
  updatedAt: string;
};

export type AppRole = "ADMIN_GENERAL" | "ADMIN" | "USER";

export type UserRecord = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: AppRole;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AccountType =
  | "ASSET"
  | "LIABILITY"
  | "EQUITY"
  | "INCOME"
  | "EXPENSE";

export type AccountRecord = {
  _id: string;
  code: string;
  name: string;
  type: AccountType;
  parentAccountId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DashboardOverview = {
  cash: {
    income: number;
    expense: number;
  };
  projects: {
    totalActive: number;
    byStatus: Array<{ status: string; count: number }>;
  };
  stock: {
    lowStockMaterials: number;
  };
};

export type DashboardAlerts = {
  projects: {
    deliveryDueSoon: Array<{ name: string; deliveryDate: string }>;
  };
  collections: {
    dueSoon: Array<{ id: string; dueDate: string }>;
  };
  fixedExpenses: {
    dueSoon: Array<{ name: string; nextDueDate: string }>;
  };
};

export type ProjectItem = {
  _id: string;
  name: string;
  clientId: string;
  budgetId?: string | null;
  description?: string | null;
  status: ProjectStatus;
  deliveryDate?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProjectStatus =
  | "CONSULTA"
  | "PRESUPUESTADO"
  | "APROBADO"
  | "COMPRADO"
  | "PRODUCCION"
  | "INSTALACION"
  | "PAUSADO"
  | "FINALIZADO"
  | "CANCELADO";

export type MaterialCategory = "MADERA" | "HERRAJES" | "OTROS";

export type MaterialItem = {
  id: string;
  name: string;
  category: MaterialCategory;
  currentStock: number;
  minStock: number;
  isLowStock: boolean;
};

export type DomainEventName =
  | "presupuesto_aprobado"
  | "material_reservado"
  | "material_asignado_a_proyecto"
  | "stock_bajo_detectado"
  | "lista_compra_generada"
  | "compra_recibida"
  | "venta_confirmada"
  | "cmv_registrado"
  | "pago_recibido"
  | "gasto_fijo_programado"
  | "gasto_pagado"
  | "vencimiento_proximo_detectado"
  | "vencimiento_vencido_detectado"
  | "proyecto_finalizado";

export type JournalEntryLine = {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description?: string | null;
};

export type JournalEntryRecord = {
  _id: string;
  entryDate: string;
  description: string;
  currency: string;
  originEvent?: DomainEventName | null;
  originEntityType?: string | null;
  originEntityId?: string | null;
  correlationId?: string | null;
  isReversal: boolean;
  reversalOfEntryId?: string | null;
  lines: JournalEntryLine[];
  totalDebit: number;
  totalCredit: number;
  createdAt: string;
  updatedAt: string;
};

export type JournalEntryItem = JournalEntryRecord;

export type ClientInput = {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  notes?: string;
};

export type ClientItem = ClientInput & {
  _id: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type SupplierInput = {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  notes?: string;
};

export type SupplierItem = SupplierInput & {
  _id: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CollectionStatus =
  | "PENDIENTE"
  | "SENADO"
  | "PARCIAL"
  | "COBRADO"
  | "VENCIDO";

export type CollectionPaymentMethod =
  | "EFECTIVO"
  | "TRANSFERENCIA"
  | "TARJETA"
  | "CHEQUE"
  | "OTRO";

export type CollectionPaymentRecord = {
  amount: number;
  paymentMethod: CollectionPaymentMethod;
  paidAt: string;
  note?: string | null;
  createdBy: string;
};

export type CollectionItem = {
  _id: string;
  clientId: string;
  projectId?: string | null;
  status: CollectionStatus;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  laborAmountPending: number;
  currency: string;
  dueDate?: string | null;
  notes?: string | null;
  payments: CollectionPaymentRecord[];
  createdAt: string;
  updatedAt: string;
};

export type PaginatedBudgetsResult = PaginatedResult<BudgetRecord>;
export type PaginatedPurchasesResult = PaginatedResult<PurchaseRecord>;
export type PaginatedProductionOrdersResult =
  PaginatedResult<ProductionOrderRecord>;
export type PaginatedCashMovementsResult = PaginatedResult<CashMovementRecord>;
export type PaginatedFixedExpensesResult = PaginatedResult<FixedExpenseRecord>;
export type PaginatedUsersResult = PaginatedResult<UserRecord>;
export type PaginatedAccountsResult = PaginatedResult<AccountRecord>;
export type PaginatedSuppliersResult = PaginatedResult<SupplierItem>;
export type PaginatedCollectionsResult = PaginatedResult<CollectionItem>;

export async function getBudgetsApi(params: {
  page: number;
  limit: number;
  search?: string;
  clientId?: string;
  status?: BudgetStatus;
}): Promise<PaginatedBudgetsResult> {
  const response = await http.get<ApiEnvelope<PaginatedBudgetsResult>>(
    "/budgets",
    {
      params: {
        page: String(params.page),
        limit: String(params.limit),
        ...(params.search ? { search: params.search } : {}),
        ...(params.clientId ? { clientId: params.clientId } : {}),
        ...(params.status ? { status: params.status } : {}),
      },
    },
  );

  return response.data.data;
}

export async function createBudgetApi(input: {
  clientId: string;
  title: string;
  description?: string;
  currency?: string;
  items: BudgetItemInput[];
  status?: BudgetStatus;
}): Promise<BudgetRecord> {
  const response = await http.post<ApiEnvelope<{ budget: BudgetRecord }>>(
    "/budgets",
    input,
  );
  return response.data.data.budget;
}

export async function reviseBudgetApi(
  id: string,
  input: {
    title?: string;
    description?: string;
    currency?: string;
    items?: BudgetItemInput[];
    status?: BudgetStatus;
  },
): Promise<BudgetRecord> {
  const response = await http.post<ApiEnvelope<{ budget: BudgetRecord }>>(
    `/budgets/${id}/revisions`,
    input,
  );
  return response.data.data.budget;
}

export async function updateBudgetStatusApi(
  id: string,
  status: BudgetStatus,
): Promise<BudgetRecord> {
  const response = await http.patch<ApiEnvelope<{ budget: BudgetRecord }>>(
    `/budgets/${id}/status`,
    { status },
  );
  return response.data.data.budget;
}

export async function deleteBudgetApi(id: string): Promise<void> {
  await http.delete(`/budgets/${id}`);
}

export async function getPurchasesApi(params: {
  page: number;
  limit: number;
  search?: string;
  supplierId?: string;
  projectId?: string;
  status?: PurchaseStatus;
}): Promise<PaginatedPurchasesResult> {
  const response = await http.get<ApiEnvelope<PaginatedPurchasesResult>>(
    "/purchases",
    {
      params: {
        page: String(params.page),
        limit: String(params.limit),
        ...(params.search ? { search: params.search } : {}),
        ...(params.supplierId ? { supplierId: params.supplierId } : {}),
        ...(params.projectId ? { projectId: params.projectId } : {}),
        ...(params.status ? { status: params.status } : {}),
      },
    },
  );

  return response.data.data;
}

export async function createPurchaseApi(input: {
  supplierId: string;
  projectId?: string;
  currency?: string;
  notes?: string;
  items: PurchaseItemInput[];
  status?: "DRAFT" | "ORDERED";
}): Promise<PurchaseRecord> {
  const response = await http.post<ApiEnvelope<{ purchase: PurchaseRecord }>>(
    "/purchases",
    input,
  );
  return response.data.data.purchase;
}

export async function updatePurchaseStatusApi(
  id: string,
  status: PurchaseStatus,
): Promise<PurchaseRecord> {
  const response = await http.patch<ApiEnvelope<{ purchase: PurchaseRecord }>>(
    `/purchases/${id}/status`,
    { status },
  );
  return response.data.data.purchase;
}

export async function receivePurchaseApi(
  id: string,
  input: {
    receivedItems: PurchaseReceivedItemInput[];
    note?: string;
  },
): Promise<PurchaseRecord> {
  const response = await http.post<ApiEnvelope<{ purchase: PurchaseRecord }>>(
    `/purchases/${id}/receive`,
    input,
  );
  return response.data.data.purchase;
}

export async function deletePurchaseApi(id: string): Promise<void> {
  await http.delete(`/purchases/${id}`);
}

export async function getProductionOrdersApi(params: {
  page: number;
  limit: number;
  projectId?: string;
  status?: ProductionStatus;
  priority?: ProductionPriority;
  search?: string;
}): Promise<PaginatedProductionOrdersResult> {
  const response = await http.get<ApiEnvelope<PaginatedProductionOrdersResult>>(
    "/production-orders",
    {
      params: {
        page: String(params.page),
        limit: String(params.limit),
        ...(params.projectId ? { projectId: params.projectId } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.priority ? { priority: params.priority } : {}),
        ...(params.search ? { search: params.search } : {}),
      },
    },
  );

  return response.data.data;
}

export async function createProductionOrderApi(input: {
  projectId: string;
  title: string;
  priority?: ProductionPriority;
  assigneeName?: string;
  notes?: string;
}): Promise<ProductionOrderRecord> {
  const response = await http.post<
    ApiEnvelope<{ order: ProductionOrderRecord }>
  >("/production-orders", input);
  return response.data.data.order;
}

export async function updateProductionOrderApi(
  id: string,
  input: {
    title?: string;
    priority?: ProductionPriority;
    assigneeName?: string | null;
    notes?: string | null;
  },
): Promise<ProductionOrderRecord> {
  const response = await http.patch<
    ApiEnvelope<{ order: ProductionOrderRecord }>
  >(`/production-orders/${id}`, input);
  return response.data.data.order;
}

export async function updateProductionOrderStatusApi(
  id: string,
  status: ProductionStatus,
): Promise<ProductionOrderRecord> {
  const response = await http.patch<
    ApiEnvelope<{ order: ProductionOrderRecord }>
  >(`/production-orders/${id}/status`, { status });
  return response.data.data.order;
}

export async function deleteProductionOrderApi(id: string): Promise<void> {
  await http.delete(`/production-orders/${id}`);
}

export async function getCashMovementsApi(params: {
  page: number;
  limit: number;
  source?: CashSource;
  direction?: CashDirection;
  paymentMethod?: CashPaymentMethod;
  referenceType?: string;
  referenceId?: string;
  search?: string;
}): Promise<PaginatedCashMovementsResult> {
  const response = await http.get<ApiEnvelope<PaginatedCashMovementsResult>>(
    "/cash/movements",
    {
      params: {
        page: String(params.page),
        limit: String(params.limit),
        ...(params.source ? { source: params.source } : {}),
        ...(params.direction ? { direction: params.direction } : {}),
        ...(params.paymentMethod
          ? { paymentMethod: params.paymentMethod }
          : {}),
        ...(params.referenceType
          ? { referenceType: params.referenceType }
          : {}),
        ...(params.referenceId ? { referenceId: params.referenceId } : {}),
        ...(params.search ? { search: params.search } : {}),
      },
    },
  );

  return response.data.data;
}

export async function createCashMovementApi(input: {
  source: CashSource;
  direction: CashDirection;
  paymentMethod: CashPaymentMethod;
  amount: number;
  currency?: string;
  concept: string;
  clientId?: string;
  projectId?: string;
  referenceType?: string;
  referenceId?: string;
  occurredAt?: string;
}): Promise<CashMovementRecord> {
  const response = await http.post<
    ApiEnvelope<{ movement: CashMovementRecord }>
  >("/cash/movements", input);
  return response.data.data.movement;
}

export async function getFixedExpensesApi(params: {
  page: number;
  limit: number;
  status?: FixedExpenseStatus;
  dueOnly?: boolean;
  overdueOnly?: boolean;
  search?: string;
}): Promise<PaginatedFixedExpensesResult> {
  const response = await http.get<ApiEnvelope<PaginatedFixedExpensesResult>>(
    "/fixed-expenses",
    {
      params: {
        page: String(params.page),
        limit: String(params.limit),
        ...(params.status ? { status: params.status } : {}),
        ...(params.dueOnly ? { dueOnly: "true" } : {}),
        ...(params.overdueOnly ? { overdueOnly: "true" } : {}),
        ...(params.search ? { search: params.search } : {}),
      },
    },
  );

  return response.data.data;
}

export async function createFixedExpenseApi(input: {
  name: string;
  amount: number;
  currency?: string;
  frequency?: FixedExpenseFrequency;
  nextDueDate: string;
  notes?: string;
}): Promise<FixedExpenseRecord> {
  const response = await http.post<
    ApiEnvelope<{ expense: FixedExpenseRecord }>
  >("/fixed-expenses", input);
  return response.data.data.expense;
}

export async function updateFixedExpenseApi(
  id: string,
  input: {
    name?: string;
    amount?: number;
    currency?: string;
    frequency?: FixedExpenseFrequency;
    status?: FixedExpenseStatus;
    nextDueDate?: string;
    notes?: string | null;
  },
): Promise<FixedExpenseRecord> {
  const response = await http.patch<
    ApiEnvelope<{ expense: FixedExpenseRecord }>
  >(`/fixed-expenses/${id}`, input);
  return response.data.data.expense;
}

export async function payFixedExpenseApi(
  id: string,
  input?: {
    amount?: number;
    paidAt?: string;
    note?: string;
  },
): Promise<FixedExpenseRecord> {
  const response = await http.post<
    ApiEnvelope<{ expense: FixedExpenseRecord }>
  >(`/fixed-expenses/${id}/pay`, input ?? {});
  return response.data.data.expense;
}

export async function refreshFixedExpenseAlertsApi(): Promise<{
  overdue: number;
  dueSoon: number;
}> {
  const response = await http.post<
    ApiEnvelope<{ overdue: number; dueSoon: number }>
  >("/fixed-expenses/refresh-alerts", {});
  return response.data.data;
}

export async function deleteFixedExpenseApi(id: string): Promise<void> {
  await http.delete(`/fixed-expenses/${id}`);
}

export async function getUsersApi(params: {
  page: number;
  limit: number;
  search?: string;
  role?: AppRole;
  activeOnly?: boolean;
}): Promise<PaginatedUsersResult> {
  const response = await http.get<ApiEnvelope<PaginatedUsersResult>>("/users", {
    params: {
      page: String(params.page),
      limit: String(params.limit),
      ...(params.search ? { search: params.search } : {}),
      ...(params.role ? { role: params.role } : {}),
      ...(params.activeOnly !== undefined
        ? { activeOnly: params.activeOnly ? "true" : "false" }
        : {}),
    },
  });
  return response.data.data;
}

export async function createUserApi(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role?: AppRole;
}): Promise<UserRecord> {
  const response = await http.post<ApiEnvelope<{ user: UserRecord }>>(
    "/users",
    input,
  );
  return response.data.data.user;
}

export async function updateUserApi(
  id: string,
  input: {
    firstName?: string;
    lastName?: string;
    email?: string;
  },
): Promise<UserRecord> {
  const response = await http.patch<ApiEnvelope<{ user: UserRecord }>>(
    `/users/${id}`,
    input,
  );
  return response.data.data.user;
}

export async function updateUserRoleApi(
  id: string,
  role: AppRole,
): Promise<UserRecord> {
  const response = await http.patch<ApiEnvelope<{ user: UserRecord }>>(
    `/users/${id}/role`,
    { role },
  );
  return response.data.data.user;
}

export async function updateUserStatusApi(
  id: string,
  isActive: boolean,
): Promise<UserRecord> {
  const response = await http.patch<ApiEnvelope<{ user: UserRecord }>>(
    `/users/${id}/status`,
    { isActive },
  );
  return response.data.data.user;
}

export async function resetUserPasswordApi(
  id: string,
  newPassword: string,
): Promise<void> {
  await http.patch(`/users/${id}/password`, { newPassword });
}

export async function deleteUserApi(id: string): Promise<void> {
  await http.delete(`/users/${id}`);
}

export async function getAccountsApi(params: {
  page: number;
  limit: number;
  search?: string;
  type?: AccountType;
  activeOnly?: boolean;
  parentAccountId?: string;
}): Promise<PaginatedAccountsResult> {
  const response = await http.get<ApiEnvelope<PaginatedAccountsResult>>(
    "/accounts",
    {
      params: {
        page: String(params.page),
        limit: String(params.limit),
        ...(params.search ? { search: params.search } : {}),
        ...(params.type ? { type: params.type } : {}),
        ...(params.activeOnly !== undefined
          ? { activeOnly: params.activeOnly ? "true" : "false" }
          : {}),
        ...(params.parentAccountId
          ? { parentAccountId: params.parentAccountId }
          : {}),
      },
    },
  );
  return response.data.data;
}

export async function createAccountApi(input: {
  code: string;
  name: string;
  type: AccountType;
  parentAccountId?: string;
  isActive?: boolean;
}): Promise<AccountRecord> {
  const response = await http.post<ApiEnvelope<{ account: AccountRecord }>>(
    "/accounts",
    input,
  );
  return response.data.data.account;
}

export async function updateAccountApi(
  id: string,
  input: {
    code?: string;
    name?: string;
    type?: AccountType;
    parentAccountId?: string | null;
    isActive?: boolean;
  },
): Promise<AccountRecord> {
  const response = await http.patch<ApiEnvelope<{ account: AccountRecord }>>(
    `/accounts/${id}`,
    input,
  );
  return response.data.data.account;
}

export async function deleteAccountApi(id: string): Promise<void> {
  await http.delete(`/accounts/${id}`);
}

export type TrialBalanceRow = {
  accountCode: string;
  accountName: string;
  accountType:
    | "ASSET"
    | "LIABILITY"
    | "EQUITY"
    | "INCOME"
    | "EXPENSE"
    | "UNKNOWN";
  totalDebit: number;
  totalCredit: number;
  balance: number;
};

export type TrialBalanceReport = {
  rows: TrialBalanceRow[];
  totals: {
    debit: number;
    credit: number;
  };
};

export type IncomeStatementReport = {
  income: Array<{
    accountCode: string;
    accountName: string;
    total: number;
  }>;
  expenses: Array<{
    accountCode: string;
    accountName: string;
    total: number;
  }>;
  totals: {
    income: number;
    expenses: number;
    netResult: number;
  };
};

export type BalanceSheetReport = {
  assets: TrialBalanceRow[];
  liabilities: TrialBalanceRow[];
  equity: TrialBalanceRow[];
  totals: {
    assets: number;
    liabilities: number;
    equity: number;
  };
};

export type PurchaseSuggestions = {
  pagination: PaginationMeta;
  totals: {
    estimatedTotalCost: number;
  };
};

type PaginatedResult<T> = {
  items: T[];
  pagination: PaginationMeta;
};

export type PaginatedClientsResult = PaginatedResult<ClientItem>;

export async function loginApi(input: {
  email: string;
  password: string;
}): Promise<AuthData> {
  const response = await http.post<ApiEnvelope<AuthData>>("/auth/login", input);
  return response.data.data;
}

export async function bootstrapAdminApi(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}): Promise<AuthData> {
  const response = await http.post<ApiEnvelope<AuthData>>(
    "/auth/bootstrap-admin",
    {
      ...input,
      role: "ADMIN_GENERAL",
    },
  );
  return response.data.data;
}

export async function refreshSessionApi(): Promise<AuthData> {
  const response = await http.post<ApiEnvelope<AuthData>>("/auth/refresh", {});
  return response.data.data;
}

export async function logoutApi(): Promise<void> {
  await http.post("/auth/logout", {});
}

export async function getDashboardOverviewApi(): Promise<DashboardOverview> {
  const response = await http.get<ApiEnvelope<DashboardOverview>>(
    "/dashboard/overview",
  );
  return response.data.data;
}

export async function getDashboardAlertsApi(
  limit = 6,
): Promise<DashboardAlerts> {
  const response = await http.get<ApiEnvelope<DashboardAlerts>>(
    "/dashboard/alerts",
    {
      params: { limit: String(limit) },
    },
  );
  return response.data.data;
}

export async function getProjectsApi(params: {
  page: number;
  limit: number;
  search?: string;
  clientId?: string;
  status?: ProjectStatus;
}): Promise<PaginatedResult<ProjectItem>> {
  const response = await http.get<ApiEnvelope<PaginatedResult<ProjectItem>>>(
    "/projects",
    {
      params: {
        page: String(params.page),
        limit: String(params.limit),
        ...(params.search ? { search: params.search } : {}),
        ...(params.clientId ? { clientId: params.clientId } : {}),
        ...(params.status ? { status: params.status } : {}),
      },
    },
  );
  return response.data.data;
}

export async function getProjectByIdApi(id: string): Promise<ProjectItem> {
  const response = await http.get<ApiEnvelope<{ project: ProjectItem }>>(
    `/projects/${id}`,
  );
  return response.data.data.project;
}

export async function updateProjectStatusApi(
  id: string,
  status: ProjectStatus,
): Promise<ProjectItem> {
  const response = await http.patch<ApiEnvelope<{ project: ProjectItem }>>(
    `/projects/${id}/status`,
    { status },
  );
  return response.data.data.project;
}

export async function getMaterialsApi(params: {
  page: number;
  limit: number;
  category?: MaterialCategory;
}): Promise<PaginatedResult<MaterialItem>> {
  const response = await http.get<ApiEnvelope<PaginatedResult<MaterialItem>>>(
    "/stock/materials",
    {
      params: {
        page: String(params.page),
        limit: String(params.limit),
        ...(params.category ? { category: params.category } : {}),
      },
    },
  );
  return response.data.data;
}

export async function getPurchaseSuggestionsApi(params?: {
  category?: MaterialCategory;
}): Promise<PurchaseSuggestions> {
  const response = await http.get<ApiEnvelope<PurchaseSuggestions>>(
    "/stock/purchase-list",
    {
      params: params?.category ? { category: params.category } : undefined,
    },
  );
  return response.data.data;
}

export async function getJournalEntriesApi(params: {
  page: number;
  limit: number;
  from?: string;
  to?: string;
  originEvent?: DomainEventName;
  originEntityType?: string;
  originEntityId?: string;
  accountCode?: string;
  search?: string;
}): Promise<PaginatedResult<JournalEntryRecord>> {
  const response = await http.get<
    ApiEnvelope<PaginatedResult<JournalEntryRecord>>
  >("/accounting/journal-entries", {
    params: {
      page: String(params.page),
      limit: String(params.limit),
      ...(params.from ? { from: params.from } : {}),
      ...(params.to ? { to: params.to } : {}),
      ...(params.originEvent ? { originEvent: params.originEvent } : {}),
      ...(params.originEntityType
        ? { originEntityType: params.originEntityType }
        : {}),
      ...(params.originEntityId
        ? { originEntityId: params.originEntityId }
        : {}),
      ...(params.accountCode ? { accountCode: params.accountCode } : {}),
      ...(params.search ? { search: params.search } : {}),
    },
  });
  return response.data.data;
}

export async function getJournalEntryByIdApi(
  id: string,
): Promise<JournalEntryRecord> {
  const response = await http.get<ApiEnvelope<{ entry: JournalEntryRecord }>>(
    `/accounting/journal-entries/${id}`,
  );
  return response.data.data.entry;
}

export async function createJournalEntryApi(input: {
  entryDate?: string;
  description: string;
  currency?: string;
  lines: Array<{
    accountCode: string;
    debit: number;
    credit: number;
    description?: string;
  }>;
  originEvent?: DomainEventName;
  originEntityType?: string;
  originEntityId?: string;
  correlationId?: string;
}): Promise<JournalEntryRecord> {
  const response = await http.post<ApiEnvelope<{ entry: JournalEntryRecord }>>(
    "/accounting/journal-entries",
    input,
  );
  return response.data.data.entry;
}

export async function reverseJournalEntryApi(
  id: string,
  reason: string,
): Promise<JournalEntryRecord> {
  const response = await http.post<ApiEnvelope<{ entry: JournalEntryRecord }>>(
    `/accounting/journal-entries/${id}/reverse`,
    { reason },
  );
  return response.data.data.entry;
}

export async function getClientsApi(params: {
  page: number;
  limit: number;
  search?: string;
  activeOnly?: boolean;
}): Promise<PaginatedClientsResult> {
  const response = await http.get<ApiEnvelope<PaginatedClientsResult>>(
    "/clients",
    {
      params: {
        page: String(params.page),
        limit: String(params.limit),
        ...(params.search ? { search: params.search } : {}),
        ...(params.activeOnly === false ? { activeOnly: "false" } : {}),
      },
    },
  );
  return response.data.data;
}

export async function createClientApi(input: ClientInput): Promise<ClientItem> {
  const response = await http.post<ApiEnvelope<{ client: ClientItem }>>(
    "/clients",
    input,
  );
  return response.data.data.client;
}

export async function updateClientApi(
  id: string,
  input: Partial<ClientInput>,
): Promise<ClientItem> {
  const response = await http.patch<ApiEnvelope<{ client: ClientItem }>>(
    `/clients/${id}`,
    input,
  );
  return response.data.data.client;
}

export async function deleteClientApi(id: string): Promise<void> {
  await http.delete(`/clients/${id}`);
}

export async function getSuppliersApi(params: {
  page: number;
  limit: number;
  search?: string;
  activeOnly?: boolean;
}): Promise<PaginatedSuppliersResult> {
  const response = await http.get<ApiEnvelope<PaginatedSuppliersResult>>(
    "/suppliers",
    {
      params: {
        page: String(params.page),
        limit: String(params.limit),
        ...(params.search ? { search: params.search } : {}),
        ...(params.activeOnly !== undefined
          ? { activeOnly: params.activeOnly ? "true" : "false" }
          : {}),
      },
    },
  );
  return response.data.data;
}

export async function createSupplierApi(
  input: SupplierInput,
): Promise<SupplierItem> {
  const response = await http.post<ApiEnvelope<{ supplier: SupplierItem }>>(
    "/suppliers",
    input,
  );
  return response.data.data.supplier;
}

export async function updateSupplierApi(
  id: string,
  input: Partial<SupplierInput>,
): Promise<SupplierItem> {
  const response = await http.patch<ApiEnvelope<{ supplier: SupplierItem }>>(
    `/suppliers/${id}`,
    input,
  );
  return response.data.data.supplier;
}

export async function deleteSupplierApi(id: string): Promise<void> {
  await http.delete(`/suppliers/${id}`);
}

export async function getCollectionsApi(params: {
  page: number;
  limit: number;
  clientId?: string;
  projectId?: string;
  status?: CollectionStatus;
  dueOnly?: boolean;
  overdueOnly?: boolean;
}): Promise<PaginatedCollectionsResult> {
  const response = await http.get<ApiEnvelope<PaginatedCollectionsResult>>(
    "/collections",
    {
      params: {
        page: String(params.page),
        limit: String(params.limit),
        ...(params.clientId ? { clientId: params.clientId } : {}),
        ...(params.projectId ? { projectId: params.projectId } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.dueOnly ? { dueOnly: "true" } : {}),
        ...(params.overdueOnly ? { overdueOnly: "true" } : {}),
      },
    },
  );
  return response.data.data;
}

export async function createCollectionApi(input: {
  clientId: string;
  projectId?: string;
  totalAmount: number;
  laborAmountPending?: number;
  currency?: string;
  dueDate?: string;
  notes?: string;
}): Promise<CollectionItem> {
  const response = await http.post<ApiEnvelope<{ collection: CollectionItem }>>(
    "/collections",
    input,
  );
  return response.data.data.collection;
}

export async function registerCollectionPaymentApi(
  id: string,
  input: {
    amount: number;
    paymentMethod: CollectionPaymentMethod;
    paidAt?: string;
    note?: string;
  },
): Promise<CollectionItem> {
  const response = await http.post<ApiEnvelope<{ collection: CollectionItem }>>(
    `/collections/${id}/payments`,
    input,
  );
  return response.data.data.collection;
}

export async function refreshCollectionDueStatusApi(): Promise<{
  overdue: number;
  dueSoon: number;
}> {
  const response = await http.post<
    ApiEnvelope<{ overdue: number; dueSoon: number }>
  >("/collections/refresh-due-status", {});
  return response.data.data;
}

export async function getTrialBalanceReportApi(params: {
  from?: string;
  to?: string;
}): Promise<TrialBalanceReport> {
  const response = await http.get<ApiEnvelope<TrialBalanceReport>>(
    "/accounting/reports/trial-balance",
    {
      params: {
        ...(params.from ? { from: params.from } : {}),
        ...(params.to ? { to: params.to } : {}),
      },
    },
  );
  return response.data.data;
}

export async function getIncomeStatementReportApi(params: {
  from?: string;
  to?: string;
}): Promise<IncomeStatementReport> {
  const response = await http.get<ApiEnvelope<IncomeStatementReport>>(
    "/accounting/reports/income-statement",
    {
      params: {
        ...(params.from ? { from: params.from } : {}),
        ...(params.to ? { to: params.to } : {}),
      },
    },
  );
  return response.data.data;
}

export async function getBalanceSheetReportApi(params: {
  from?: string;
  to?: string;
}): Promise<BalanceSheetReport> {
  const response = await http.get<ApiEnvelope<BalanceSheetReport>>(
    "/accounting/reports/balance-sheet",
    {
      params: {
        ...(params.from ? { from: params.from } : {}),
        ...(params.to ? { to: params.to } : {}),
      },
    },
  );
  return response.data.data;
}
