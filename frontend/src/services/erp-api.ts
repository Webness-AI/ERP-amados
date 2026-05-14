import { http } from "./http";

type ApiEnvelope<T> = {
  ok: true;
  data: T;
};

type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type AuthUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "ADMIN_GENERAL" | "ADMIN" | "USER";
};

type AuthData = {
  user: AuthUser;
  accessToken: string;
};

export type DashboardOverview = {
  cash: {
    income: number;
    expense: number;
    net: number;
  };
  projects: {
    totalActive: number;
    byStatus: Array<{ status: string; count: number }>;
  };
  stock: {
    lowStockMaterials: number;
    estimatedPurchaseCost: number;
  };
};

export type DashboardAlerts = {
  projects: {
    deliveryDueSoon: Array<{
      id: string;
      name: string;
      status: string;
      deliveryDate: string;
    }>;
    deliveryOverdue: Array<{
      id: string;
      name: string;
      status: string;
      deliveryDate: string;
    }>;
  };
  collections: {
    dueSoon: Array<{
      id: string;
      dueDate: string;
      pendingAmount: number;
      status: string;
    }>;
    overdue: Array<{
      id: string;
      dueDate: string;
      pendingAmount: number;
      status: string;
    }>;
  };
  fixedExpenses: {
    dueSoon: Array<{
      id: string;
      name: string;
      nextDueDate: string;
      amount: number;
      currency: string;
    }>;
    overdue: Array<{
      id: string;
      name: string;
      nextDueDate: string;
      amount: number;
      currency: string;
    }>;
  };
};

export type ProjectItem = {
  _id: string;
  clientId: string;
  name: string;
  status: string;
  deliveryDate?: string | null;
  createdAt: string;
};

export type MaterialItem = {
  id: string;
  name: string;
  category: "MADERA" | "HERRAJES" | "OTROS";
  minStock: number;
  currentStock: number;
  isLowStock: boolean;
};

export type JournalEntryItem = {
  _id: string;
  entryDate: string;
  originEvent?: string | null;
  totalDebit: number;
  totalCredit: number;
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
}): Promise<PaginatedResult<ProjectItem>> {
  const response = await http.get<ApiEnvelope<PaginatedResult<ProjectItem>>>(
    "/projects",
    {
      params: {
        page: String(params.page),
        limit: String(params.limit),
      },
    },
  );
  return response.data.data;
}

export async function getMaterialsApi(params: {
  page: number;
  limit: number;
}): Promise<PaginatedResult<MaterialItem>> {
  const response = await http.get<ApiEnvelope<PaginatedResult<MaterialItem>>>(
    "/stock/materials",
    {
      params: {
        page: String(params.page),
        limit: String(params.limit),
      },
    },
  );
  return response.data.data;
}

export async function getPurchaseSuggestionsApi(): Promise<PurchaseSuggestions> {
  const response = await http.get<ApiEnvelope<PurchaseSuggestions>>(
    "/stock/purchase-list",
  );
  return response.data.data;
}

export async function getJournalEntriesApi(params: {
  page: number;
  limit: number;
}): Promise<PaginatedResult<JournalEntryItem>> {
  const response = await http.get<
    ApiEnvelope<PaginatedResult<JournalEntryItem>>
  >("/accounting/journal-entries", {
    params: {
      page: String(params.page),
      limit: String(params.limit),
    },
  });
  return response.data.data;
}
