import {
  ACCOUNT_NATURES,
  RESULT_CLASSIFICATIONS,
  AccountModel,
} from "./account.model";

type DefaultAccountSeed = {
  code: string;
  name: string;
  naturaleza: (typeof ACCOUNT_NATURES)[keyof typeof ACCOUNT_NATURES];
  resultClassification?:
    | (typeof RESULT_CLASSIFICATIONS)[keyof typeof RESULT_CLASSIFICATIONS]
    | null;
};

const DEFAULT_ACCOUNTS: DefaultAccountSeed[] = [
  { code: "CAJA", name: "Caja", naturaleza: ACCOUNT_NATURES.ACTIVO },
  { code: "BANCO", name: "Banco", naturaleza: ACCOUNT_NATURES.ACTIVO },
  {
    code: "ANTICIPOS_CLIENTES",
    name: "Anticipos de clientes",
    naturaleza: ACCOUNT_NATURES.PASIVO,
  },
  {
    code: "VENTAS",
    name: "Ventas",
    naturaleza: ACCOUNT_NATURES.RESULTADO,
    resultClassification: RESULT_CLASSIFICATIONS.GENERAL,
  },
  { code: "STOCK", name: "Stock", naturaleza: ACCOUNT_NATURES.ACTIVO },
  {
    code: "PROVEEDORES",
    name: "Proveedores",
    naturaleza: ACCOUNT_NATURES.PASIVO,
  },
  {
    code: "CMV",
    name: "Costo de mercaderia vendida",
    naturaleza: ACCOUNT_NATURES.RESULTADO,
    resultClassification: RESULT_CLASSIFICATIONS.GASTOS_PRODUCCION,
  },
  {
    code: "GASTOS_FIJOS",
    name: "Gastos fijos",
    naturaleza: ACCOUNT_NATURES.RESULTADO,
    resultClassification: RESULT_CLASSIFICATIONS.GASTOS_ADMIN_COMERCIAL,
  },
  {
    code: "MANO_OBRA_PENDIENTE",
    name: "Mano de obra pendiente",
    naturaleza: ACCOUNT_NATURES.PASIVO,
  },
  {
    code: "PUBLICIDAD",
    name: "Publicidad",
    naturaleza: ACCOUNT_NATURES.RESULTADO,
    resultClassification: RESULT_CLASSIFICATIONS.GASTOS_ADMIN_COMERCIAL,
  },
];

function mapLegacyNature(value?: string | null):
  | (typeof ACCOUNT_NATURES)[keyof typeof ACCOUNT_NATURES]
  | null {
  switch (value) {
    case "ASSET":
      return ACCOUNT_NATURES.ACTIVO;
    case "LIABILITY":
      return ACCOUNT_NATURES.PASIVO;
    case "EQUITY":
      return ACCOUNT_NATURES.PATRIMONIO_NETO;
    case "INCOME":
    case "EXPENSE":
      return ACCOUNT_NATURES.RESULTADO;
    default:
      return null;
  }
}

export async function migrateLegacyAccountTaxonomy(): Promise<{
  migrated: number;
  classifiedAsGeneral: number;
}> {
  const legacyAccounts = await AccountModel.collection
    .find(
      {
        $or: [
          { naturaleza: { $exists: false } },
          { naturaleza: null },
          { naturaleza: "" },
        ],
      },
      { projection: { type: 1, naturaleza: 1, resultClassification: 1 } },
    )
    .toArray();

  type BulkWriteOperation = Parameters<
    typeof AccountModel.collection.bulkWrite
  >[0][number];
  const bulkOps: BulkWriteOperation[] = [];
  let classifiedAsGeneral = 0;

  for (const account of legacyAccounts) {
    const naturaleza = mapLegacyNature(account.type as string | null);

    if (!naturaleza) {
      continue;
    }

    const update: Record<string, unknown> = {
      naturaleza,
    };

    if (naturaleza === ACCOUNT_NATURES.RESULTADO) {
      update.resultClassification =
        account.resultClassification ?? RESULT_CLASSIFICATIONS.GENERAL;
      if (!account.resultClassification) {
        classifiedAsGeneral += 1;
      }
    }

    bulkOps.push({
      updateOne: {
        filter: { _id: account._id },
        update: { $set: update },
      },
    });
  }

  if (bulkOps.length > 0) {
    await AccountModel.collection.bulkWrite(bulkOps, { ordered: false });
  }

  return {
    migrated: bulkOps.length,
    classifiedAsGeneral,
  };
}

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
      naturaleza: account.naturaleza,
      resultClassification: account.resultClassification ?? null,
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
