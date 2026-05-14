import { ACCOUNT_TYPES, AccountModel } from "./account.model";

type DefaultAccountSeed = {
  code: string;
  name: string;
  type: (typeof ACCOUNT_TYPES)[keyof typeof ACCOUNT_TYPES];
};

const DEFAULT_ACCOUNTS: DefaultAccountSeed[] = [
  { code: "CAJA", name: "Caja", type: ACCOUNT_TYPES.ASSET },
  { code: "BANCO", name: "Banco", type: ACCOUNT_TYPES.ASSET },
  {
    code: "ANTICIPOS_CLIENTES",
    name: "Anticipos de clientes",
    type: ACCOUNT_TYPES.LIABILITY,
  },
  { code: "VENTAS", name: "Ventas", type: ACCOUNT_TYPES.INCOME },
  { code: "STOCK", name: "Stock", type: ACCOUNT_TYPES.ASSET },
  {
    code: "PROVEEDORES",
    name: "Proveedores",
    type: ACCOUNT_TYPES.LIABILITY,
  },
  {
    code: "CMV",
    name: "Costo de mercaderia vendida",
    type: ACCOUNT_TYPES.EXPENSE,
  },
  {
    code: "GASTOS_FIJOS",
    name: "Gastos fijos",
    type: ACCOUNT_TYPES.EXPENSE,
  },
  {
    code: "MANO_OBRA_PENDIENTE",
    name: "Mano de obra pendiente",
    type: ACCOUNT_TYPES.LIABILITY,
  },
  {
    code: "PUBLICIDAD",
    name: "Publicidad",
    type: ACCOUNT_TYPES.EXPENSE,
  },
];

export async function ensureDefaultChartOfAccounts(): Promise<{
  created: number;
  existing: number;
}> {
  let created = 0;
  let existing = 0;

  for (const account of DEFAULT_ACCOUNTS) {
    const found = await AccountModel.findOne({ code: account.code })
      .select("_id")
      .lean();

    if (found) {
      existing += 1;
      continue;
    }

    await AccountModel.create({
      code: account.code,
      name: account.name,
      type: account.type,
      parentAccountId: null,
      isActive: true,
      createdBy: "system",
      updatedBy: "system",
    });

    created += 1;
  }

  return {
    created,
    existing,
  };
}
