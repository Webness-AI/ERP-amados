import { AppError } from "../../core/errors/app-error";
import { DOMAIN_EVENTS } from "../../core/events/domain-events";
import {
  buildPaginatedResponse,
  parsePaginationInput,
} from "../../core/utils/pagination";
import {
  ACCOUNT_NATURES,
  AccountModel,
  type AccountNature,
  type ResultClassification,
} from "../accounts/account.model";
import {
  type CreateJournalEntryInput,
  type GeneralLedgerQueryInput,
  type ListJournalEntriesInput,
  type ReportRangeInput,
} from "./journal-entry.schemas";
import {
  JournalEntryModel,
  type JournalEntry,
  type JournalEntryLine,
} from "./journal-entry.model";

type Actor = {
  id: string;
};

type JournalEntryInternalInput = {
  entryDate?: Date;
  description: string;
  currency: string;
  lines: Array<{
    accountCode: string;
    debit: number;
    credit: number;
    description?: string | null;
  }>;
  originEvent?: (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS] | null;
  originEntityType?: string | null;
  originEntityId?: string | null;
  correlationId?: string | null;
  isReversal?: boolean;
  reversalOfEntryId?: string | null;
  actorId: string;
  isManualEntry?: boolean;
};

type TrialBalanceRow = {
  accountCode: string;
  accountName: string;
  accountNature: AccountNature | "UNKNOWN";
  resultClassification: ResultClassification | null;
  totalDebit: number;
  totalCredit: number;
  balance: number;
};

type IncomeStatementRow = {
  accountCode: string;
  accountName: string;
  total: number;
};

type GeneralLedgerTransaction = {
  entryId: string;
  entryDate: Date;
  entryDescription: string;
  lineDescription: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
};

function normalizeOptionalString(value?: string | null): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeMoney(value: number): number {
  return Number(value.toFixed(2));
}

function validateBalancedLines(
  lines: JournalEntryInternalInput["lines"],
): void {
  if (lines.length < 2) {
    throw new AppError(
      "Journal entry must have at least two lines",
      400,
      "INVALID_JOURNAL_LINES",
    );
  }

  let totalDebit = 0;
  let totalCredit = 0;

  for (const line of lines) {
    const debit = normalizeMoney(line.debit);
    const credit = normalizeMoney(line.credit);

    if (debit < 0 || credit < 0) {
      throw new AppError(
        "Debit/Credit cannot be negative",
        400,
        "INVALID_JOURNAL_LINES",
      );
    }

    if ((debit === 0 && credit === 0) || (debit > 0 && credit > 0)) {
      throw new AppError(
        "Each line must contain only debit or only credit",
        400,
        "INVALID_JOURNAL_LINES",
      );
    }

    totalDebit = normalizeMoney(totalDebit + debit);
    totalCredit = normalizeMoney(totalCredit + credit);
  }

  if (totalDebit !== totalCredit) {
    throw new AppError(
      "Journal entry is not balanced",
      400,
      "JOURNAL_NOT_BALANCED",
    );
  }
}

async function resolveAccountNamesByCode(
  codes: string[],
): Promise<Map<string, string>> {
  const normalized = [
    ...new Set(codes.map((code) => code.trim().toUpperCase())),
  ];

  const accounts = await AccountModel.find({
    code: { $in: normalized },
    deletedAt: null,
    isActive: true,
  })
    .select("code name")
    .lean();

  const map = new Map<string, string>();
  for (const account of accounts) {
    map.set(account.code, account.name);
  }

  return map;
}

async function validateAndResolveAccountNames(
  codes: string[],
): Promise<Map<string, string>> {
  const normalized = [
    ...new Set(codes.map((code) => code.trim().toUpperCase())),
  ];

  const accounts = await AccountModel.find({
    code: { $in: normalized },
    deletedAt: null,
    isActive: true,
  })
    .select("code name")
    .lean();

  const map = new Map<string, string>();
  for (const account of accounts) {
    map.set(account.code, account.name);
  }

  // Strict validation: check that all provided codes exist and are active
  const missingCodes = normalized.filter((code) => !map.has(code));
  if (missingCodes.length > 0) {
    throw new AppError(
      `Account codes not found or inactive: ${missingCodes.join(", ")}`,
      400,
      "INVALID_ACCOUNT_CODES",
    );
  }

  return map;
}

async function createJournalEntryInternal(
  input: JournalEntryInternalInput,
): Promise<JournalEntry> {
  validateBalancedLines(input.lines);

  const accountCodes = input.lines.map((line) => line.accountCode);

  // Use strict validation for manual entries, permissive for auto-generated
  const accountNames = input.isManualEntry
    ? await validateAndResolveAccountNames(accountCodes)
    : await resolveAccountNamesByCode(accountCodes);

  const lines: JournalEntryLine[] = input.lines.map((line) => {
    const accountCode = line.accountCode.trim().toUpperCase();
    const accountName = accountNames.get(accountCode) ?? accountCode;

    return {
      accountCode,
      accountName,
      debit: normalizeMoney(line.debit),
      credit: normalizeMoney(line.credit),
      description: normalizeOptionalString(line.description),
    };
  });

  const totalDebit = normalizeMoney(
    lines.reduce((acc, line) => acc + line.debit, 0),
  );
  const totalCredit = normalizeMoney(
    lines.reduce((acc, line) => acc + line.credit, 0),
  );

  const entry = await JournalEntryModel.create({
    entryDate: input.entryDate ?? new Date(),
    description: input.description,
    currency: input.currency.toUpperCase(),
    originEvent: input.originEvent ?? null,
    originEntityType: normalizeOptionalString(input.originEntityType),
    originEntityId: normalizeOptionalString(input.originEntityId),
    correlationId: normalizeOptionalString(input.correlationId),
    isReversal: input.isReversal ?? false,
    reversalOfEntryId: normalizeOptionalString(input.reversalOfEntryId),
    lines,
    totalDebit,
    totalCredit,
    createdBy: input.actorId,
    updatedBy: input.actorId,
  });

  return entry.toObject();
}

export async function createManualJournalEntry(
  input: CreateJournalEntryInput,
  actor: Actor,
): Promise<JournalEntry> {
  const lines = input.lines.map((line) => ({
    accountCode: line.accountCode,
    debit: line.debit,
    credit: line.credit,
    description: line.description ?? null,
  }));

  return createJournalEntryInternal({
    ...(input.entryDate ? { entryDate: new Date(input.entryDate) } : {}),
    description: input.description,
    currency: input.currency,
    lines,
    originEvent: input.originEvent ?? null,
    originEntityType: input.originEntityType ?? null,
    originEntityId: input.originEntityId ?? null,
    correlationId: input.correlationId ?? null,
    actorId: actor.id,
    isManualEntry: true,
  });
}

export async function reverseJournalEntry(
  entryId: string,
  reason: string,
  actor: Actor,
): Promise<JournalEntry> {
  const original = await JournalEntryModel.findOne({
    _id: entryId,
    deletedAt: null,
  }).lean();

  if (!original) {
    throw new AppError(
      "Journal entry not found",
      404,
      "JOURNAL_ENTRY_NOT_FOUND",
    );
  }

  const alreadyReversed = await JournalEntryModel.exists({
    reversalOfEntryId: original._id.toString(),
    deletedAt: null,
  });

  if (alreadyReversed) {
    throw new AppError(
      "Journal entry already reversed",
      409,
      "JOURNAL_ALREADY_REVERSED",
    );
  }

  const reversalLines = original.lines.map((line) => ({
    accountCode: line.accountCode,
    debit: line.credit,
    credit: line.debit,
    description: line.description ?? null,
  }));

  return createJournalEntryInternal({
    entryDate: new Date(),
    description: `Reversal: ${reason}`,
    currency: original.currency,
    lines: reversalLines,
    originEvent: original.originEvent ?? null,
    originEntityType: "journal-entry-reversal",
    originEntityId: original._id.toString(),
    correlationId: original.correlationId ?? original._id.toString(),
    isReversal: true,
    reversalOfEntryId: original._id.toString(),
    actorId: actor.id,
  });
}

export async function listJournalEntries(
  query: ListJournalEntriesInput,
): Promise<{
  items: JournalEntry[];
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

  if (query.originEvent) {
    filter.originEvent = query.originEvent;
  }

  if (query.originEntityType) {
    filter.originEntityType = query.originEntityType;
  }

  if (query.originEntityId) {
    filter.originEntityId = query.originEntityId;
  }

  if (query.from || query.to) {
    filter.entryDate = {
      ...(query.from ? { $gte: new Date(query.from) } : {}),
      ...(query.to ? { $lte: new Date(query.to) } : {}),
    };
  }

  if (query.accountCode) {
    filter["lines.accountCode"] = query.accountCode.trim().toUpperCase();
  }

  if (query.search && query.search.trim().length > 0) {
    const regex = new RegExp(query.search.trim(), "i");
    filter.$or = [
      { description: regex },
      { originEntityId: regex },
      { correlationId: regex },
    ];
  }

  const [items, total] = await Promise.all([
    JournalEntryModel.find(filter)
      .sort({ entryDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    JournalEntryModel.countDocuments(filter),
  ]);

  return buildPaginatedResponse({
    items,
    total,
    page,
    limit,
  });
}

export async function getJournalEntryById(id: string): Promise<JournalEntry> {
  const entry = await JournalEntryModel.findOne({
    _id: id,
    deletedAt: null,
  }).lean();

  if (!entry) {
    throw new AppError(
      "Journal entry not found",
      404,
      "JOURNAL_ENTRY_NOT_FOUND",
    );
  }

  return entry;
}

function buildRangeFilter(query: ReportRangeInput): Record<string, unknown> {
  if (!query.from && !query.to) {
    return {};
  }

  return {
    entryDate: {
      ...(query.from ? { $gte: new Date(query.from) } : {}),
      ...(query.to ? { $lte: new Date(query.to) } : {}),
    },
  };
}

export async function getTrialBalanceReport(query: ReportRangeInput): Promise<{
  rows: TrialBalanceRow[];
  totals: {
    debit: number;
    credit: number;
  };
}> {
  const rangeFilter = buildRangeFilter(query);
  const entries = await JournalEntryModel.find({
    deletedAt: null,
    ...rangeFilter,
  })
    .select("lines")
    .lean();

  const acc = new Map<string, TrialBalanceRow>();
  for (const entry of entries) {
    for (const line of entry.lines) {
      const key = line.accountCode;
      const current: TrialBalanceRow = acc.get(key) ?? {
        accountCode: key,
        accountName: line.accountName,
          accountNature: "UNKNOWN",
        resultClassification: null,
        totalDebit: 0,
        totalCredit: 0,
        balance: 0,
      };

      current.totalDebit = normalizeMoney(current.totalDebit + line.debit);
      current.totalCredit = normalizeMoney(current.totalCredit + line.credit);
      current.balance = normalizeMoney(
        current.totalDebit - current.totalCredit,
      );
      acc.set(key, current);
    }
  }

  const accounts = await AccountModel.find({
    code: { $in: [...acc.keys()] },
    deletedAt: null,
  })
    .select("code naturaleza resultClassification")
    .lean();

  const natureByCode = new Map<string, AccountNature>(
    accounts.map((account) => [
      account.code,
      account.naturaleza as AccountNature,
    ]),
  );

  const resultClassificationByCode = new Map<
    string,
    ResultClassification | null
  >(
    accounts.map((account) => [
      account.code,
      (account.resultClassification as ResultClassification | null) ?? null,
    ]),
  );

  const rows = [...acc.values()]
    .map<TrialBalanceRow>((row) => ({
      ...row,
      accountNature: natureByCode.get(row.accountCode) ?? "UNKNOWN",
      resultClassification:
        resultClassificationByCode.get(row.accountCode) ?? null,
    }))
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode));

  return {
    rows,
    totals: {
      debit: normalizeMoney(rows.reduce((sum, row) => sum + row.totalDebit, 0)),
      credit: normalizeMoney(
        rows.reduce((sum, row) => sum + row.totalCredit, 0),
      ),
    },
  };
}

export async function getIncomeStatementReport(
  query: ReportRangeInput,
): Promise<{
  income: IncomeStatementRow[];
  expenses: IncomeStatementRow[];
  totals: {
    income: number;
    expenses: number;
    netResult: number;
  };
}> {
  const trialBalance = await getTrialBalanceReport(query);

  const income = trialBalance.rows
    .filter((row) => row.accountNature === ACCOUNT_NATURES.RESULTADO)
    .filter((row) => row.resultClassification === "GENERAL")
    .map((row) => ({
      accountCode: row.accountCode,
      accountName: row.accountName,
      total: normalizeMoney(row.totalCredit - row.totalDebit),
    }));

  const expenses = trialBalance.rows
    .filter((row) => row.accountNature === ACCOUNT_NATURES.RESULTADO)
    .filter((row) => row.resultClassification !== "GENERAL")
    .map((row) => ({
      accountCode: row.accountCode,
      accountName: row.accountName,
      total: normalizeMoney(row.totalDebit - row.totalCredit),
    }));

  const totalIncome = normalizeMoney(
    income.reduce((sum, row) => sum + row.total, 0),
  );
  const totalExpenses = normalizeMoney(
    expenses.reduce((sum, row) => sum + row.total, 0),
  );

  return {
    income,
    expenses,
    totals: {
      income: totalIncome,
      expenses: totalExpenses,
      netResult: normalizeMoney(totalIncome - totalExpenses),
    },
  };
}

export async function getGeneralLedgerReport(
  query: GeneralLedgerQueryInput,
): Promise<{
  account: {
    code: string;
    name: string;
    naturaleza: AccountNature;
    resultClassification: ResultClassification | null;
  };
  transactions: GeneralLedgerTransaction[];
  totals: {
    debit: number;
    credit: number;
    endingBalance: number;
  };
}> {
  const accountCode = query.accountCode.trim().toUpperCase();

  const account = await AccountModel.findOne({
    code: accountCode,
    deletedAt: null,
  })
    .select("code name naturaleza resultClassification")
    .lean();

  if (!account) {
    throw new AppError("Account not found", 404, "ACCOUNT_NOT_FOUND");
  }

  const rangeFilter = buildRangeFilter(query);
  const entries = await JournalEntryModel.find({
    deletedAt: null,
    "lines.accountCode": accountCode,
    ...rangeFilter,
  })
    .select("_id entryDate description lines")
    .sort({ entryDate: 1, createdAt: 1 })
    .lean();

  const transactions: GeneralLedgerTransaction[] = [];
  let totalDebit = 0;
  let totalCredit = 0;
  let runningBalance = 0;

  for (const entry of entries) {
    for (const line of entry.lines) {
      if (line.accountCode !== accountCode) {
        continue;
      }

      totalDebit = normalizeMoney(totalDebit + line.debit);
      totalCredit = normalizeMoney(totalCredit + line.credit);
      runningBalance = normalizeMoney(runningBalance + line.debit - line.credit);

      transactions.push({
        entryId: entry._id.toString(),
        entryDate: entry.entryDate,
        entryDescription: entry.description,
        lineDescription: line.description ?? null,
        debit: line.debit,
        credit: line.credit,
        runningBalance,
      });
    }
  }

  return {
    account: {
      code: account.code,
      name: account.name,
      naturaleza: account.naturaleza as AccountNature,
      resultClassification:
        (account.resultClassification as ResultClassification | null) ?? null,
    },
    transactions,
    totals: {
      debit: totalDebit,
      credit: totalCredit,
      endingBalance: runningBalance,
    },
  };
}

export async function getFinancialStatementReport(
  query: ReportRangeInput,
): Promise<{
  balanceSheet: {
    assets: TrialBalanceRow[];
    liabilities: TrialBalanceRow[];
    equity: TrialBalanceRow[];
    totals: {
      assets: number;
      liabilities: number;
      equity: number;
    };
  };
  incomeStatement: {
    income: IncomeStatementRow[];
    expenses: IncomeStatementRow[];
    totals: {
      income: number;
      expenses: number;
      netResult: number;
    };
  };
  summary: {
    assets: number;
    liabilities: number;
    equity: number;
    netResult: number;
    liabilitiesPlusEquity: number;
    liabilitiesPlusEquityAndResult: number;
    equationGap: number;
  };
}> {
  const [balanceSheet, incomeStatement] = await Promise.all([
    getBalanceSheetReport(query),
    getIncomeStatementReport(query),
  ]);

  const liabilitiesPlusEquity = normalizeMoney(
    balanceSheet.totals.liabilities + balanceSheet.totals.equity,
  );
  const liabilitiesPlusEquityAndResult = normalizeMoney(
    liabilitiesPlusEquity + incomeStatement.totals.netResult,
  );

  return {
    balanceSheet,
    incomeStatement,
    summary: {
      assets: balanceSheet.totals.assets,
      liabilities: balanceSheet.totals.liabilities,
      equity: balanceSheet.totals.equity,
      netResult: incomeStatement.totals.netResult,
      liabilitiesPlusEquity,
      liabilitiesPlusEquityAndResult,
      equationGap: normalizeMoney(
        balanceSheet.totals.assets - liabilitiesPlusEquityAndResult,
      ),
    },
  };
}

export async function getBalanceSheetReport(query: ReportRangeInput): Promise<{
  assets: TrialBalanceRow[];
  liabilities: TrialBalanceRow[];
  equity: TrialBalanceRow[];
  totals: {
    assets: number;
    liabilities: number;
    equity: number;
  };
}> {
  const trialBalance = await getTrialBalanceReport(query);

  const assets = trialBalance.rows
    .filter((row) => row.accountNature === ACCOUNT_NATURES.ACTIVO)
    .map((row) => ({
      ...row,
      balance: normalizeMoney(row.totalDebit - row.totalCredit),
    }));

  const liabilities = trialBalance.rows
    .filter((row) => row.accountNature === ACCOUNT_NATURES.PASIVO)
    .map((row) => ({
      ...row,
      balance: normalizeMoney(row.totalCredit - row.totalDebit),
    }));

  const equity = trialBalance.rows
    .filter((row) => row.accountNature === ACCOUNT_NATURES.PATRIMONIO_NETO)
    .map((row) => ({
      ...row,
      balance: normalizeMoney(row.totalCredit - row.totalDebit),
    }));

  return {
    assets,
    liabilities,
    equity,
    totals: {
      assets: normalizeMoney(assets.reduce((sum, row) => sum + row.balance, 0)),
      liabilities: normalizeMoney(
        liabilities.reduce((sum, row) => sum + row.balance, 0),
      ),
      equity: normalizeMoney(equity.reduce((sum, row) => sum + row.balance, 0)),
    },
  };
}

export async function postEventDrivenJournalEntry(input: {
  description: string;
  lines: Array<{
    accountCode: string;
    debit: number;
    credit: number;
    description?: string;
  }>;
  actorId: string;
  originEvent: (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];
  originEntityType?: string;
  originEntityId?: string;
  correlationId?: string;
  currency?: string;
}): Promise<void> {
  await createJournalEntryInternal({
    description: input.description,
    currency: input.currency ?? "ARS",
    lines: input.lines,
    actorId: input.actorId,
    originEvent: input.originEvent,
    originEntityType: input.originEntityType ?? null,
    originEntityId: input.originEntityId ?? null,
    correlationId: input.correlationId ?? null,
  });
}
