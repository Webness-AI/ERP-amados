import { app } from "./app";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { env } from "./config/env";
import { initializeAccountingEventHandlers } from "./modules/accounting/accounting-event-handlers";
import {
  ensureDefaultChartOfAccounts,
  migrateLegacyAccountTaxonomy,
} from "./modules/accounts/account.bootstrap";
import { startDashboardAlertsScheduler } from "./modules/dashboard/dashboard-alerts.scheduler";

async function bootstrap(): Promise<void> {
  await connectDatabase();
  const accountTaxonomyMigration = await migrateLegacyAccountTaxonomy();
  console.log("Legacy account taxonomy migration ready", accountTaxonomyMigration);
  const chartOfAccountsBootstrap = await ensureDefaultChartOfAccounts();
  console.log("Default chart of accounts ready", chartOfAccountsBootstrap);
  initializeAccountingEventHandlers();
  const dashboardAlertsScheduler = startDashboardAlertsScheduler();

  const server = app.listen(env.PORT, () => {
    console.log(`Backend listening on port ${env.PORT}`);
  });

  const shutdown = async (): Promise<void> => {
    dashboardAlertsScheduler.stop();
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => {
    void shutdown();
  });

  process.on("SIGTERM", () => {
    void shutdown();
  });
}

bootstrap().catch((error: unknown) => {
  console.error("Fatal bootstrap error", error);
  process.exit(1);
});
