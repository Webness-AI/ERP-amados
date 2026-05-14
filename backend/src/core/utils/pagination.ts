export type PaginationInput = {
  page: number;
  limit: number;
  skip: number;
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parsePositiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

export function parsePaginationInput(query: {
  page?: unknown;
  limit?: unknown;
}): PaginationInput {
  const page = parsePositiveInteger(query.page, DEFAULT_PAGE);
  const requestedLimit = parsePositiveInteger(query.limit, DEFAULT_LIMIT);
  const limit = Math.min(requestedLimit, MAX_LIMIT);

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

export function buildPaginatedResponse<T>(params: {
  items: T[];
  total: number;
  page: number;
  limit: number;
}): {
  items: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
} {
  const totalPages = Math.max(1, Math.ceil(params.total / params.limit));

  return {
    items: params.items,
    pagination: {
      total: params.total,
      page: params.page,
      limit: params.limit,
      totalPages,
    },
  };
}
