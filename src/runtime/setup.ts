import { setupFetchHook, setBrakitPort } from "../instrument/hooks/fetch.js";
import { drainPendingCaptures } from "./capture.js";
import { setupConsoleHook } from "../instrument/hooks/console.js";
import { setupErrorHook } from "../instrument/hooks/errors.js";
import { createDefaultRegistry } from "../instrument/adapters/index.js";
import { createDashboardHandler } from "../dashboard/router.js";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { EventBus } from "../core/event-bus.js";
import type { Services } from "../core/services.js";
import { RequestStore } from "../store/request-store.js";
import { TelemetryStore } from "../store/telemetry-store.js";
import { MetricsStore, FileMetricsPersistence } from "../store/index.js";
import { IssueStore } from "../store/issue-store.js";
import { AnalysisEngine } from "../analysis/engine.js";
import { GraphBuilder } from "../graph/graph-builder.js";
import { startTerminalInsights } from "../output/terminal.js";
import { VERSION } from "../index.js";
import {
  DASHBOARD_PREFIX,
  DEFAULT_MAX_BODY_CAPTURE,
  METRICS_DIR,
  PORT_FILE,
  KNOWN_DEPENDENCY_NAMES,
  EXIT_REASON_SIGINT,
  EXIT_REASON_SIGTERM,
  EXIT_REASON_CLEAN,
  TELEMETRY_EVENT_SETUP_COMPLETED,
  TELEMETRY_EVENT_FIRST_REQUEST,
} from "../constants/index.js";
import type {
  TelemetryEvent,
  BrakitConfig,
  Framework,
  TracedFetch,
  TracedLog,
  TracedError,
  TracedQuery,
} from "../types/index.js";
import type { ChannelMap } from "../core/event-bus.js";
import { health } from "./health.js";
import { installInterceptor, uninstallInterceptor } from "./interceptor.js";
import { brakitDebug } from "../utils/log.js";
import { getErrorMessage } from "../utils/type-guards.js";
import { getProjectDataDir } from "../utils/fs.js";
import {
  detectFrameworkFromDeps,
  detectPackageManagerSync,
} from "../detect/project.js";
import {
  initSession,
  trackSession,
  trackEvent,
  recordRequestCount,
  recordInsightTypes,
  recordRulesTriggered,
  recordSetupCompleted,
  recordFirstRequest,
  recordExitReason,
} from "../telemetry/index.js";

let initPromise: Promise<void> | null = null;

export function setup(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = doSetup();
  return initPromise;
}

/*  Phase 1 — Create stores & wire event subscriptions                */

interface Stores {
  requestStore: RequestStore;
  fetchStore: TelemetryStore<TracedFetch>;
  logStore: TelemetryStore<TracedLog>;
  errorStore: TelemetryStore<TracedError>;
  queryStore: TelemetryStore<TracedQuery>;
}

function createStores(bus: EventBus): Stores {
  const requestStore = new RequestStore();
  const fetchStore = new TelemetryStore<TracedFetch>();
  const logStore = new TelemetryStore<TracedLog>();
  const errorStore = new TelemetryStore<TracedError>();
  const queryStore = new TelemetryStore<TracedQuery>();

  bus.on("telemetry:fetch", (data) => fetchStore.add(data));
  bus.on("telemetry:query", (data) => queryStore.add(data));
  bus.on("telemetry:log", (data) => logStore.add(data));
  bus.on("telemetry:error", (data) => errorStore.add(data));

  requestStore.onRequest((req) => bus.emit("request:completed", req));

  return { requestStore, fetchStore, logStore, errorStore, queryStore };
}

/*  Phase 2 — Install instrumentation hooks                           */

function installHooks(bus: EventBus): {
  framework: Framework;
  adapterNames: string[];
  adaptersFailed: string[];
  frameworkCandidates: string[];
} {
  const telemetryEmit = (event: TelemetryEvent): void => {
    const channel = `telemetry:${event.type}` as keyof ChannelMap;
    bus.emit(channel, event.data as ChannelMap[typeof channel]);
  };

  setupFetchHook(telemetryEmit);
  setupConsoleHook(telemetryEmit);
  setupErrorHook(telemetryEmit);

  const adapterRegistry = createDefaultRegistry();
  adapterRegistry.patchAll(telemetryEmit);

  const cwd = process.cwd();

  let framework: Framework = "unknown";
  let frameworkCandidates: string[] = [];
  try {
    const pkg = JSON.parse(
      require("node:fs").readFileSync(resolve(cwd, "package.json"), "utf-8"),
    );
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    framework = detectFrameworkFromDeps(allDeps);
    // Capture which deps were found for telemetry diagnostics (no PII — just package names)
    frameworkCandidates = KNOWN_DEPENDENCY_NAMES.filter((dep) => dep in allDeps);
  } catch {
    /* no package.json */
  }

  return {
    framework,
    adapterNames: adapterRegistry.getActive().map((a) => a.name),
    adaptersFailed: [...adapterRegistry.getFailed()],
    frameworkCandidates,
  };
}

/*  Phase 3 — Start analysis, metrics & issue tracking                */

interface AnalysisServices {
  analysisEngine: AnalysisEngine;
  metricsStore: MetricsStore;
  issueStore: IssueStore;
}

function startAnalysis(
  bus: EventBus,
  stores: Stores,
  dataDir: string,
  services: Services,
): AnalysisServices {
  const metricsStore = new MetricsStore(new FileMetricsPersistence(dataDir));
  metricsStore.start();

  const issueStore = new IssueStore(dataDir);
  issueStore.start();

  // Mutate the services object so AnalysisEngine can read all fields.
  services.metricsStore = metricsStore;
  services.issueStore = issueStore;

  const analysisEngine = new AnalysisEngine(services);
  analysisEngine.start();
  services.analysisEngine = analysisEngine;

  bus.on("request:completed", (req) => {
    const queries = stores.queryStore.getByRequest(req.id);
    const fetches = stores.fetchStore.getByRequest(req.id);
    metricsStore.recordRequest(req, {
      queryCount: queries.length,
      queryTimeMs: queries.reduce((s, q) => s + q.durationMs, 0),
      fetchTimeMs: fetches.reduce((s, f) => s + f.durationMs, 0),
    });
  });

  return { analysisEngine, metricsStore, issueStore };
}

/*  Phase 4 — Register lifecycle (teardown + process handlers)        */

function registerLifecycle(
  allServices: Services,
  stores: Stores,
  services: AnalysisServices,
  cwd: string,
): void {
  let telemetrySent = false;
  const sendTelemetry = (): void => {
    if (telemetrySent) return;
    telemetrySent = true;
    recordRequestCount(stores.requestStore.getAll().length);
    recordInsightTypes(
      services.analysisEngine.getInsights().map((i) => i.type),
    );
    recordRulesTriggered(
      services.analysisEngine.getFindings().map((f) => f.rule),
    );
    trackSession(allServices);
  };

  let teardownCalled = false;
  const runTeardown = (): void => {
    if (teardownCalled) return;
    teardownCalled = true;

    sendTelemetry();
    uninstallInterceptor();
    services.analysisEngine.stop();
    services.issueStore.stop();
    services.metricsStore.stop();

    try {
      const portPath = resolve(cwd, PORT_FILE);
      if (existsSync(portPath)) unlinkSync(portPath);
    } catch (err) {
      brakitDebug(`[setup] port file cleanup failed: ${getErrorMessage(err)}`);
    }
  };

  health.setTeardown(runTeardown);

  process.on("SIGINT", () => { recordExitReason(EXIT_REASON_SIGINT); });
  process.on("SIGTERM", () => { recordExitReason(EXIT_REASON_SIGTERM); });
  process.on("beforeExit", async () => {
    await drainPendingCaptures();
    recordExitReason(EXIT_REASON_CLEAN);
    sendTelemetry();
  });
  process.on("exit", () => {
    runTeardown();
  });
}

/*  Orchestrator                                                       */

async function doSetup(): Promise<void> {
  const setupStart = Date.now();
  brakitDebug(`[setup] doSetup called at ${new Date().toISOString()}`);

  const bus = new EventBus();
  const cwd = process.cwd();

  // Phase 1 — stores & event wiring
  const stores = createStores(bus);

  const services = {
    bus,
    ...stores,
  } as Services;

  // Phase 2 — instrumentation hooks
  const { framework, adapterNames, adaptersFailed, frameworkCandidates } = installHooks(bus);

  initSession(framework, detectPackageManagerSync(cwd), false, adapterNames);

  const setupDurationMs = Date.now() - setupStart;
  recordSetupCompleted({ frameworkCandidates, adaptersFailed, setupDurationMs });

  trackEvent(TELEMETRY_EVENT_SETUP_COMPLETED, {
    framework,
    framework_detection_candidates: frameworkCandidates,
    adapters_detected: adapterNames,
    adapters_failed: adaptersFailed,
    hooks_installed: ["fetch", "console", "error"],
    setup_duration_ms: setupDurationMs,
  });

  // Phase 3 — graph builder
  const graphBuilder = new GraphBuilder(bus, stores.requestStore);
  graphBuilder.start();
  services.graphBuilder = graphBuilder;

  // Phase 3b — analysis, metrics & issues (mutates `services` to fill remaining fields)
  const dataDir = getProjectDataDir(cwd);
  const analysisServices = startAnalysis(bus, stores, dataDir, services);

  // Phase 4 — HTTP interceptor + dashboard
  const config: BrakitConfig = {
    proxyPort: 0,
    targetPort: 0,
    showStatic: false,
    maxBodyCapture: DEFAULT_MAX_BODY_CAPTURE,
  };

  const handleDashboard = createDashboardHandler(services);

  installInterceptor({
    handleDashboard,
    config,
    requestStore: stores.requestStore,
    onFirstRequest(port) {
      setBrakitPort(port);
      brakitDebug(`[setup] onFirstRequest fired, port=${port}`);
      recordFirstRequest();
      trackEvent(TELEMETRY_EVENT_FIRST_REQUEST, {
        port,
        time_to_first_request_ms: Date.now() - setupStart,
      });

      void (async () => {
        try {
          const dir = resolve(cwd, METRICS_DIR);
          await mkdir(dir, { recursive: true });

          const portPath = resolve(cwd, PORT_FILE);
          try {
            const old = await readFile(portPath, "utf-8");
            if (old.trim() === String(port)) {
              brakitDebug(`[setup] port file already correct, skipping write`);
              return;
            }
            if (old.trim()) {
              brakitDebug(
                `Overwriting stale port file (was ${old.trim()}, now ${port})`,
              );
            }
          } catch {
            brakitDebug(`[setup] no existing port file, will create`);
          }
          await writeFile(portPath, String(port));
          brakitDebug(`[setup] wrote port file: ${portPath}`);
        } catch (err) {
          brakitDebug(`port file write failed: ${getErrorMessage(err)}`);
        }
      })();

      startTerminalInsights(services, port);
      process.stdout.write(
        `  brakit v${VERSION} — http://localhost:${port}${DASHBOARD_PREFIX}\n`,
      );
    },
  });

  // Phase 5 — lifecycle (teardown + process handlers)
  registerLifecycle(services, stores, analysisServices, cwd);
}
