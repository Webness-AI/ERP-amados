import { env } from "../../config/env";
import { refreshDashboardAlerts } from "./dashboard.service";

type SchedulerHandle = {
  stop: () => void;
};

type DashboardAlertsSchedulerStatus = {
  enabled: boolean;
  started: boolean;
  isRunning: boolean;
  intervalMinutes: number;
  startedAt: string | null;
  nextRunAt: string | null;
  lastRunStartedAt: string | null;
  lastRunFinishedAt: string | null;
  lastRunDurationMs: number | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  runCount: number;
  skippedTicks: number;
};

let schedulerHandle: SchedulerHandle | null = null;
let isRunning = false;
let startedAt: Date | null = null;
let nextRunAt: Date | null = null;
let lastRunStartedAt: Date | null = null;
let lastRunFinishedAt: Date | null = null;
let lastRunDurationMs: number | null = null;
let lastSuccessAt: Date | null = null;
let lastError: string | null = null;
let runCount = 0;
let skippedTicks = 0;
let intervalMinutes = env.DASHBOARD_ALERTS_REFRESH_EVERY_MINUTES;

function toIsoOrNull(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function getDashboardAlertsSchedulerStatus(): DashboardAlertsSchedulerStatus {
  return {
    enabled: env.DASHBOARD_ALERTS_SCHEDULER_ENABLED,
    started: schedulerHandle !== null,
    isRunning,
    intervalMinutes,
    startedAt: toIsoOrNull(startedAt),
    nextRunAt: toIsoOrNull(nextRunAt),
    lastRunStartedAt: toIsoOrNull(lastRunStartedAt),
    lastRunFinishedAt: toIsoOrNull(lastRunFinishedAt),
    lastRunDurationMs,
    lastSuccessAt: toIsoOrNull(lastSuccessAt),
    lastError,
    runCount,
    skippedTicks,
  };
}

async function runRefreshOnce(): Promise<void> {
  const startedAt = Date.now();

  const result = await refreshDashboardAlerts({ id: "system" });

  const elapsedMs = Date.now() - startedAt;
  console.log(
    `[dashboard-alerts-scheduler] refresh completed in ${elapsedMs}ms`,
    result,
  );
}

export function startDashboardAlertsScheduler(): SchedulerHandle {
  if (!env.DASHBOARD_ALERTS_SCHEDULER_ENABLED) {
    console.log("[dashboard-alerts-scheduler] disabled by env");
    return {
      stop: () => {
        // No-op when scheduler is disabled.
      },
    };
  }

  if (schedulerHandle) {
    return schedulerHandle;
  }

  intervalMinutes = env.DASHBOARD_ALERTS_REFRESH_EVERY_MINUTES;
  const intervalMs = intervalMinutes * 60 * 1000;
  startedAt = new Date();
  nextRunAt = new Date(Date.now() + intervalMs);

  const trigger = (): void => {
    if (isRunning) {
      skippedTicks += 1;
      console.warn(
        "[dashboard-alerts-scheduler] previous run still in progress; skipping tick",
      );
      return;
    }

    isRunning = true;
    runCount += 1;
    lastRunStartedAt = new Date();
    lastError = null;

    void runRefreshOnce()
      .catch((error: unknown) => {
        lastError = error instanceof Error ? error.message : String(error);
        console.error("[dashboard-alerts-scheduler] refresh failed", error);
      })
      .finally(() => {
        lastRunFinishedAt = new Date();
        lastRunDurationMs =
          lastRunStartedAt !== null
            ? lastRunFinishedAt.getTime() - lastRunStartedAt.getTime()
            : null;
        if (!lastError) {
          lastSuccessAt = lastRunFinishedAt;
        }
        isRunning = false;
      });
  };

  if (env.DASHBOARD_ALERTS_RUN_ON_STARTUP) {
    trigger();
  }

  const timer = setInterval(() => {
    nextRunAt = new Date(Date.now() + intervalMs);
    trigger();
  }, intervalMs);

  schedulerHandle = {
    stop: () => {
      clearInterval(timer);
      nextRunAt = null;
      schedulerHandle = null;
      console.log("[dashboard-alerts-scheduler] stopped");
    },
  };

  console.log(
    `[dashboard-alerts-scheduler] started (every ${env.DASHBOARD_ALERTS_REFRESH_EVERY_MINUTES} minutes)`,
  );

  return schedulerHandle;
}
