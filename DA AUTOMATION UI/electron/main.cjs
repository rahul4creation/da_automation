const { app, BrowserWindow, dialog, shell } = require("electron");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

let mainWindow = null;
let startupLogPath = "";

app.setName("DA Review UI");

app.whenReady().then(start).catch((error) => {
  logStartup("fatal startup error", error?.stack || error?.message || String(error));
  dialog.showErrorBox("DA Review UI failed to start", error?.stack || error?.message || String(error));
  app.quit();
});

process.on("uncaughtException", (error) => {
  logStartup("uncaught exception", error?.stack || error?.message || String(error));
});

process.on("unhandledRejection", (error) => {
  logStartup("unhandled rejection", error?.stack || error?.message || String(error));
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    start().catch((error) => {
      dialog.showErrorBox("DA Review UI failed to start", error?.stack || error?.message || String(error));
    });
  }
});

async function start() {
  if (mainWindow) return;
  startupLogPath = path.join(app.getPath("userData"), "startup.log");
  logStartup("starting");

  const uiRoot = app.getAppPath();
  const resourceRoot = app.isPackaged ? process.resourcesPath : path.resolve(uiRoot, "..", "..");
  const workspaceRoot = path.join(app.getPath("userData"), "workspace");
  const projectsRoot = path.join(workspaceRoot, "da-ui-projects");
  const reviewOutputRoot = path.join(workspaceRoot, "project");
  const reportInputRoot = path.join(workspaceRoot, "report-review-input");
  const reportAgentRoot = app.isPackaged ? path.join(resourceRoot, "report-review-agent") : path.resolve(uiRoot, "..", "..", "report-review-agent");
  const seedRoot = app.isPackaged ? path.join(resourceRoot, "workspace-seed") : "";
  logStartup("paths", { uiRoot, resourceRoot, workspaceRoot, projectsRoot, reviewOutputRoot, reportInputRoot, reportAgentRoot, seedRoot });

  await ensureWorkspace({
    workspaceRoot,
    projectsRoot,
    reviewOutputRoot,
    reportInputRoot,
    seedRoot,
    devProjectSeed: path.join(uiRoot, "projects"),
    devReportInputSeed: path.resolve(uiRoot, "..", "..", "report-review-input")
  });
  logStartup("workspace ready");

  const port = await findFreePort(Number(process.env.APP_PORT || process.env.API_PORT || 5190));
  Object.assign(process.env, {
    APP_HOST: "127.0.0.1",
    APP_PORT: String(port),
    API_HOST: "127.0.0.1",
    API_PORT: String(port),
    PORT: String(port),
    DA_UI_ROOT: uiRoot,
    DA_UI_DIST_ROOT: path.join(uiRoot, "dist"),
    DA_AI_REVIEW_ROOT: workspaceRoot,
    AI_REVIEW_ROOT: workspaceRoot,
    DA_PROJECTS_ROOT: projectsRoot,
    DA_SKILL_ROOT: path.join(uiRoot, "ai-assisted-reporting-dashboard"),
    DA_EXCEL_PDF_AGENT_DIR: reportAgentRoot,
    DA_REVIEW_OUTPUT_ROOT: reviewOutputRoot,
    DA_CHECKLIST_INPUT_ROOT: path.join(reportInputRoot, "excel-pdf-data", "checklist"),
    DA_EXCEL_REPORT_INPUT_ROOT: path.join(reportInputRoot, "excel-pdf-data", "excel-reports"),
    DA_PDF_REPORT_INPUT_ROOT: path.join(reportInputRoot, "excel-pdf-data", "pdf-reports"),
    DA_DEFAULT_CHECKLIST_PATH: path.join(reportInputRoot, "excel-pdf-data", "checklist", "COMMON CHECK LIST.xlsx")
  });
  logStartup("environment ready", { port });

  await import(pathToFileURL(path.join(uiRoot, "server", "index.js")).href);
  const url = `http://127.0.0.1:${port}/`;
  await waitForServer(`${url}api/health`, 15000);
  logStartup("server ready", { url });

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 720,
    title: "DA Review UI",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    shell.openExternal(targetUrl);
    return { action: "deny" };
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  await mainWindow.loadURL(url);
  logStartup("window loaded");
}

function logStartup(message, detail = "") {
  try {
    const target = startupLogPath || path.join(app.getPath("userData"), "startup.log");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const payload = typeof detail === "string" ? detail : JSON.stringify(detail);
    fs.appendFileSync(target, `[${new Date().toISOString()}] ${message}${payload ? ` ${payload}` : ""}\n`);
  } catch {}
}

async function ensureWorkspace(paths) {
  await Promise.all([
    fsp.mkdir(paths.workspaceRoot, { recursive: true }),
    fsp.mkdir(paths.projectsRoot, { recursive: true }),
    fsp.mkdir(paths.reviewOutputRoot, { recursive: true }),
    fsp.mkdir(path.join(paths.workspaceRoot, "report-review-finding"), { recursive: true }),
    fsp.mkdir(path.join(paths.workspaceRoot, "report-review-tmp"), { recursive: true })
  ]);

  const reportInputSeed = paths.seedRoot ? path.join(paths.seedRoot, "report-review-input") : paths.devReportInputSeed;
  const projectSeed = paths.seedRoot ? path.join(paths.seedRoot, "da-ui-projects") : paths.devProjectSeed;
  await copyDirIfEmpty(reportInputSeed, paths.reportInputRoot);
  await copyDirIfEmpty(projectSeed, paths.projectsRoot);
}

async function copyDirIfEmpty(source, target) {
  if (!source || !fs.existsSync(source)) return;
  await fsp.mkdir(target, { recursive: true });
  const existing = await fsp.readdir(target).catch(() => []);
  if (existing.length > 0) return;
  await fsp.cp(source, target, { recursive: true, force: false });
}

async function findFreePort(preferredPort) {
  const start = Number.isInteger(preferredPort) && preferredPort > 0 ? preferredPort : 5190;
  for (let port = start; port < start + 100; port += 1) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No free local port was found between ${start} and ${start + 99}.`);
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolve(true));
    });
  });
}

function waitForServer(url, timeoutMs) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 500) {
          resolve();
          return;
        }
        retry();
      });
      request.on("error", retry);
      request.setTimeout(1000, () => {
        request.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(poll, 250);
    };
    poll();
  });
}
