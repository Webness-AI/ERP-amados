/**
 * Asiento de apertura – inicio de saldos
 * Uso:  API_EMAIL=usuario@dominio.com API_PASS=tu_clave node scripts/asiento-apertura.js
 */
require("dotenv/config");
const https = require("https");
const http  = require("http");
const { URL } = require("url");

const API_BASE   = process.env.API_BASE  ?? "http://localhost:4000/api/v1";
const API_EMAIL  = process.env.API_EMAIL ?? "amadosok@gmail.com";
const API_PASS   = process.env.API_PASS;

if (!API_PASS || API_PASS.length < 8) {
  console.error(
    "Falta API_PASS (min 8). Ejecuta con: API_EMAIL=... API_PASS=... node scripts/asiento-apertura.js",
  );
  process.exit(1);
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────
function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url     = new URL(`${API_BASE}${path}`);
    const lib     = url.protocol === "https:" ? https : http;
    const payload = body ? JSON.stringify(body) : undefined;
    const options = {
      hostname: url.hostname,
      port:     url.port || (url.protocol === "https:" ? 443 : 80),
      path:     url.pathname + url.search,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        ...(token   ? { Authorization: `Bearer ${token}` }            : {}),
      },
    };
    const req = lib.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ─── Cuentas a garantizar ─────────────────────────────────────────────────────
const ACCOUNTS_TO_ENSURE = [
  // ACTIVOS
  { code: "CAJA",               name: "Caja",                             naturaleza: "ACTIVO" },
  { code: "BANCO",              name: "Banco Nación C.A",                 naturaleza: "ACTIVO" },
  { code: "MATERIALES",         name: "Materiales",                       naturaleza: "ACTIVO" },
  { code: "BIENES_USO",         name: "Bienes de uso",                    naturaleza: "ACTIVO" },
  { code: "CTA_PART_AMADO",     name: "Cta. particular Soc. L. Amado",    naturaleza: "ACTIVO" },
  { code: "CTA_PART_BARBIERI",  name: "Cta. particular Soc. L. Barbieri", naturaleza: "ACTIVO" },
  { code: "CAMARA_TALLER",      name: "Cámara Taller",                    naturaleza: "ACTIVO" },
  // PASIVOS
  { code: "ANTICIPOS_CLIENTES", name: "Anticipo de Clientes",             naturaleza: "PASIVO" },
  { code: "PROVEEDORES",        name: "Proveedores",                      naturaleza: "PASIVO" },
  // PATRIMONIO NETO
  { code: "CAPITAL",             name: "Capital",                         naturaleza: "PATRIMONIO_NETO" },
  { code: "RESULT_NO_ASIGNADOS", name: "Resultados no asignados",         naturaleza: "PATRIMONIO_NETO" },
  // RESULTADO – ingresos
  { code: "VENTAS",             name: "Ventas",                           naturaleza: "RESULTADO", resultClassification: "GENERAL" },
  // RESULTADO – gastos de producción
  { code: "CMV",                name: "Costo de mercadería vendida",      naturaleza: "RESULTADO", resultClassification: "GASTOS_PRODUCCION" },
  { code: "MTO_TALLER",         name: "Mantenimiento de Taller",          naturaleza: "RESULTADO", resultClassification: "GASTOS_PRODUCCION" },
  { code: "FLETE",              name: "Flete",                            naturaleza: "RESULTADO", resultClassification: "GASTOS_PRODUCCION" },
  { code: "ALQUILER_DEPOSITO",  name: "Alquiler de depósito y taller",    naturaleza: "RESULTADO", resultClassification: "GASTOS_PRODUCCION" },
  { code: "LUZ",                name: "Luz",                              naturaleza: "RESULTADO", resultClassification: "GASTOS_PRODUCCION" },
  { code: "REPARACIONES_RODADO",name: "Reparaciones rodado",              naturaleza: "RESULTADO", resultClassification: "GASTOS_PRODUCCION" },
  { code: "MERMAS",             name: "Mermas normales",                  naturaleza: "RESULTADO", resultClassification: "GASTOS_PRODUCCION" },
  { code: "SERVICIOS_CORTE",    name: "Servicios de corte y canteo",      naturaleza: "RESULTADO", resultClassification: "GASTOS_PRODUCCION" },
  { code: "SEGURO_RODADO",      name: "Seguro Rodado",                    naturaleza: "RESULTADO", resultClassification: "GASTOS_PRODUCCION" },
  // RESULTADO – gastos admin/comerciales
  { code: "SUELDOS_JORNALES",   name: "Sueldos y Jornales",               naturaleza: "RESULTADO", resultClassification: "GASTOS_ADMIN_COMERCIAL" },
  { code: "MONOTRIBUTO",        name: "Monotributo",                      naturaleza: "RESULTADO", resultClassification: "GASTOS_ADMIN_COMERCIAL" },
  { code: "COMBUSTIBLE",        name: "Combustible",                      naturaleza: "RESULTADO", resultClassification: "GASTOS_ADMIN_COMERCIAL" },
  { code: "INTERNET",           name: "Servicios de Internet",            naturaleza: "RESULTADO", resultClassification: "GASTOS_ADMIN_COMERCIAL" },
  { code: "TELEFONIA",          name: "Servicios de telefonía",           naturaleza: "RESULTADO", resultClassification: "GASTOS_ADMIN_COMERCIAL" },
  { code: "PUBLICIDAD",         name: "Gastos de publicidad ventas",      naturaleza: "RESULTADO", resultClassification: "GASTOS_ADMIN_COMERCIAL" },
  { code: "LIBRERIA",           name: "Gastos de librería",               naturaleza: "RESULTADO", resultClassification: "GASTOS_ADMIN_COMERCIAL" },
  { code: "OTROS_GASTOS",       name: "Otros gastos",                     naturaleza: "RESULTADO", resultClassification: "GASTOS_ADMIN_COMERCIAL" },
  { code: "COMISIONES",         name: "Comisiones a vendedores",          naturaleza: "RESULTADO", resultClassification: "GASTOS_ADMIN_COMERCIAL" },
];

// ─── Líneas del asiento ───────────────────────────────────────────────────────
// DEBE  = 62.643.774,43
// HABER = 62.643.774,42  →  diferencia $0,01 por redondeo acumulado
// Ajuste: CAPITAL en HABER  790.416,68 → 790.416,69
// Con ajuste: HABER = 62.643.774,43  →  asiento perfectamente balanceado.
const JOURNAL_LINES = [
  // DEBE – Activos
  { accountCode: "CAJA",               debit: 690000.00,    credit: 0 },
  { accountCode: "BANCO",              debit: 2005355.35,   credit: 0 },
  { accountCode: "MATERIALES",         debit: 8370537.24,   credit: 0 },
  { accountCode: "BIENES_USO",         debit: 1430079.44,   credit: 0 },
  { accountCode: "CTA_PART_AMADO",     debit: 8874006.23,   credit: 0 },
  { accountCode: "CTA_PART_BARBIERI",  debit: 5356744.34,   credit: 0 },
  { accountCode: "CAMARA_TALLER",      debit: 140000.00,    credit: 0 },
  // DEBE – Gastos admin/comerciales
  { accountCode: "SUELDOS_JORNALES",   debit: 6836639.27,   credit: 0 },
  { accountCode: "MONOTRIBUTO",        debit: 25267.99,     credit: 0 },
  { accountCode: "COMBUSTIBLE",        debit: 665066.00,    credit: 0 },
  { accountCode: "INTERNET",           debit: 247967.98,    credit: 0 },
  { accountCode: "TELEFONIA",          debit: 184840.66,    credit: 0 },
  { accountCode: "PUBLICIDAD",         debit: 2221867.16,   credit: 0 },
  { accountCode: "LIBRERIA",           debit: 1000.00,      credit: 0 },
  { accountCode: "OTROS_GASTOS",       debit: 75200.00,     credit: 0 },
  { accountCode: "COMISIONES",         debit: 160800.00,    credit: 0 },
  // DEBE – Gastos de producción
  { accountCode: "MTO_TALLER",         debit: 150666.00,    credit: 0 },
  { accountCode: "FLETE",              debit: 150000.00,    credit: 0 },
  { accountCode: "ALQUILER_DEPOSITO",  debit: 1250000.00,   credit: 0 },
  { accountCode: "LUZ",                debit: 212630.14,    credit: 0 },
  { accountCode: "REPARACIONES_RODADO",debit: 260000.00,    credit: 0 },
  { accountCode: "MERMAS",             debit: 2225098.57,   credit: 0 },
  { accountCode: "SERVICIOS_CORTE",    debit: 90000.00,     credit: 0 },
  { accountCode: "SEGURO_RODADO",      debit: 310082.51,    credit: 0 },
  // DEBE – CMV
  { accountCode: "CMV",                debit: 20709925.55,  credit: 0 },
  // HABER – Pasivos
  { accountCode: "ANTICIPOS_CLIENTES", debit: 0, credit: 7494083.94  },
  { accountCode: "PROVEEDORES",        debit: 0, credit: 1309003.94  },
  // HABER – Patrimonio Neto  (CAPITAL +$0,01 para cerrar redondeo)
  { accountCode: "CAPITAL",            debit: 0, credit: 790416.69   },
  { accountCode: "RESULT_NO_ASIGNADOS",debit: 0, credit: 3156269.86  },
  // HABER – Ingresos
  { accountCode: "VENTAS",             debit: 0, credit: 49894000.00 },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== ASIENTO DE APERTURA – INICIO DE SALDOS ===\n");

  // 1. Autenticar
  console.log("⟶  Autenticando...");
  const loginRes = await request("POST", "/auth/login", { email: API_EMAIL, password: API_PASS });
  if (loginRes.status !== 200 || !loginRes.body?.data?.accessToken) {
    console.error("✗  Login fallido:", JSON.stringify(loginRes.body, null, 2));
    process.exit(1);
  }
  const token = loginRes.body.data.accessToken;
  console.log("✓  Autenticado como", API_EMAIL, "\n");

  // 2. Crear / migrar cuentas
  console.log("⟶  Verificando cuentas...");
  let created = 0, updated = 0, errors = 0;

  for (const account of ACCOUNTS_TO_ENSURE) {
    const res = await request("POST", "/accounts", account, token);

    if (res.status === 201 || res.status === 200) {
      console.log(`  + [NUEVA]    ${account.code}`);
      created++;
      continue;
    }

    if (res.status === 409) {
      // La cuenta ya existe. Intentar actualizar su naturaleza/clasificación
      // en caso de que venga del modelo legacy (migración).
      const listRes = await request(
        "GET",
        `/accounts?search=${encodeURIComponent(account.code)}&limit=100&activeOnly=false`,
        null, token,
      );
      const match = listRes.body?.data?.items?.find((a) => a.code === account.code);
      if (match) {
        // Verificar si ya tiene la naturaleza correcta (bootstrap actualizado)
        const alreadyCorrect =
          match.naturaleza === account.naturaleza &&
          (account.naturaleza !== "RESULTADO" ||
            match.resultClassification === account.resultClassification);

        if (alreadyCorrect) {
          console.log(`  ✓ [YA OK]    ${account.code}`);
          updated++;
        } else {
          // Solo enviar resultClassification cuando aplica (cuentas RESULTADO)
          const patch = {
            naturaleza: account.naturaleza,
            ...(account.resultClassification
              ? { resultClassification: account.resultClassification }
              : {}),
          };
          const patchRes = await request("PATCH", `/accounts/${match._id}`, patch, token);
          if (patchRes.status === 200) {
            console.log(`  ~ [MIGRADA]  ${account.code}`);
            updated++;
          } else {
            // Cuenta existe pero el PATCH falló: tratarlo como advertencia,
            // no como error bloqueante (el asiento puede continuar si el código existe)
            console.warn(`  ! [WARN PATCH] ${account.code} — PATCH falló, puede continuar si el código existe`);
          }
        }
      } else {
        console.warn(`  ! [NO MATCH]  ${account.code} — 409 pero no encontrada en lista`);
        errors++;
      }
      continue;
    }

    console.warn(`  ! [ERR ${res.status}]  ${account.code}:`, JSON.stringify(res.body));
    errors++;
  }

  console.log(`\n  Nuevas: ${created}  /  Migradas: ${updated}  /  Errores: ${errors}`);
  if (errors > 0) {
    console.error("\n✗  Hay errores en cuentas. Revisar antes de continuar.");
    process.exit(1);
  }

  // 3. Verificar balance
  const totalDebe  = JOURNAL_LINES.reduce((s, l) => s + l.debit,  0);
  const totalHaber = JOURNAL_LINES.reduce((s, l) => s + l.credit, 0);
  const diff = Math.abs(parseFloat(totalDebe.toFixed(2)) - parseFloat(totalHaber.toFixed(2)));

  console.log("\n⟶  Balance del asiento:");
  console.log(`   DEBE:  $ ${totalDebe.toFixed(2)}`);
  console.log(`   HABER: $ ${totalHaber.toFixed(2)}`);
  console.log(`   DIFF:  $ ${diff.toFixed(2)}`);

  if (diff > 0.001) {
    console.error("✗  El asiento no balancea. Abortando.");
    process.exit(1);
  }
  console.log("✓  Balanceado\n");

  // 4. Publicar asiento
  console.log("⟶  Publicando asiento de apertura...");

  const lines = JOURNAL_LINES.map((l) => ({
    accountCode: l.accountCode,
    debit:       parseFloat(l.debit.toFixed(2)),
    credit:      parseFloat(l.credit.toFixed(2)),
  })).filter((l) => l.debit > 0 || l.credit > 0);

  const entryRes = await request(
    "POST",
    "/accounting/journal-entries",
    {
      description: "Asiento de apertura – inicio de saldos al 19/05/2026 (CAPITAL ajustado $0,01 por redondeo acumulado)",
      currency:    "ARS",
      entryDate:   new Date().toISOString(),
      lines,
    },
    token,
  );

  if (entryRes.status === 201 || entryRes.status === 200) {
    const id = entryRes.body?.data?.entry?._id ?? "(sin id)";
    console.log(`\n✓  ASIENTO CREADO`);
    console.log(`   ID:     ${id}`);
    console.log(`   Líneas: ${lines.length}`);
    console.log(`   DEBE:   $ ${totalDebe.toFixed(2)}`);
    console.log(`   HABER:  $ ${totalHaber.toFixed(2)}`);
    console.log("\n✓  Proceso completado exitosamente.");
  } else {
    console.error("\n✗  Error al crear asiento:", JSON.stringify(entryRes.body, null, 2));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error fatal:", err.message);
  process.exit(1);
});
