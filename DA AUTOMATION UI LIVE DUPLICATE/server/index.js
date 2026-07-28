import cors from "cors";
import express from "express";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import multer from "multer";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import XLSX from "xlsx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(process.env.DA_UI_ROOT || path.resolve(__dirname, ".."));
loadEnvFile(path.join(ROOT, ".env"));
const AI_REVIEW_ROOT = path.resolve(process.env.DA_AI_REVIEW_ROOT || process.env.AI_REVIEW_ROOT || path.resolve(ROOT, "..", ".."));
const PROJECTS_ROOT = path.resolve(process.env.DA_PROJECTS_ROOT || path.join(ROOT, "projects"));
const SKILL_ROOT = path.resolve(process.env.DA_SKILL_ROOT || path.join(ROOT, "ai-assisted-reporting-dashboard"));
const DIST_ROOT = path.resolve(process.env.DA_UI_DIST_ROOT || path.join(ROOT, "dist"));
const BROWSER_REVIEW_INPUT_ROOT = path.join(ROOT, "tmp", "excel-pdf-browser-inputs");
const EXCEL_PREVIEW_SCRIPT = path.join(ROOT, "scripts", "excel-preview.py");
const EXCEL_PDF_AGENT_DIR = path.resolve(process.env.DA_EXCEL_PDF_AGENT_DIR || path.join(AI_REVIEW_ROOT, "report-review-agent"));
const EXCEL_PDF_AGENT_SCRIPT = path.join(EXCEL_PDF_AGENT_DIR, "src", "excelPdfDataReviewAgent.mjs");
const EXCEL_PDF_REVIEW_OUTPUT_ROOT = path.resolve(process.env.DA_REVIEW_OUTPUT_ROOT || path.join(AI_REVIEW_ROOT, "project"));
const CHECKLIST_REVISION_SCRIPT = path.join(ROOT, "scripts", "checklist-revision.py");
const USE_PYTHON_CHECKLIST_REVISION = process.env.DA_USE_PYTHON_CHECKLIST_REVISION === "1";
const PYTHON_BIN = process.env.PYTHON || process.env.PYTHON_EXE || "python";
const BUILT_IN_ADMIN = { username: "Rahul_Raj", password: "Alpha1", userType: "Admin" };
const USER_PASSWORD_EXPORT_PATH = path.resolve(
  process.env.DA_USER_PASSWORD_EXPORT_PATH || path.join(ROOT, "docs", "user-password-export", "DA Review UI Users and Passwords.xlsx")
);
const USER_STORE_PATH = path.resolve(process.env.DA_USER_STORE_PATH || path.join(AI_REVIEW_ROOT, "da-review-ui-users.json"));
const EXCEL_PDF_DEFAULTS = {
  checklistInput: path.resolve(process.env.DA_CHECKLIST_INPUT_ROOT || path.join(AI_REVIEW_ROOT, "report-review-input", "excel-pdf-data", "checklist")),
  excelFolder: path.resolve(process.env.DA_EXCEL_REPORT_INPUT_ROOT || path.join(AI_REVIEW_ROOT, "report-review-input", "excel-pdf-data", "excel-reports")),
  pdfFolder: path.resolve(process.env.DA_PDF_REPORT_INPUT_ROOT || path.join(AI_REVIEW_ROOT, "report-review-input", "excel-pdf-data", "pdf-reports")),
  selectedChecklistPath: path.resolve(
    process.env.DA_DEFAULT_CHECKLIST_PATH || path.join(AI_REVIEW_ROOT, "report-review-input", "excel-pdf-data", "checklist", "COMMON CHECK LIST.xlsx")
  ),
  selectedExcelPath: "",
  selectedExcelPaths: [],
  selectedPdfPath: "",
  selectedPdfPaths: [],
  projectName: "",
  userName: "",
  compareCount: "all",
  pdfIndices: "",
  recursive: false,
  excelOnly: true
};
const EXCEL_HIERARCHY_RELATIONS = [
  {
    section: "Feeder Wise vs Zone Wise",
    baseScope: "feeder_wise",
    rollupScope: "zone_wise",
    groupFields: ["zone_name"]
  },
  { section: "Feeder Wise vs Circle Wise", baseScope: "feeder_wise", rollupScope: "circle_wise", groupFields: ["circle_name"] },
  {
    section: "Feeder Wise vs Division Wise",
    baseScope: "feeder_wise",
    rollupScope: "division_wise",
    groupFields: ["circle_name", "division_name"]
  },
  {
    section: "Feeder Wise vs Subdivision Wise",
    baseScope: "feeder_wise",
    rollupScope: "subdivision_wise",
    groupFields: ["circle_name", "division_name", "subdivision_name"]
  },
  {
    section: "Feeder Wise vs Substation Wise",
    baseScope: "feeder_wise",
    rollupScope: "substation_wise",
    groupFields: ["circle_name", "division_name", "subdivision_name", "substation_name"]
  },
  {
    section: "Feeder Wise vs Feeder Category Wise",
    baseScope: "feeder_wise",
    rollupScope: "feeder_category_wise",
    groupFields: ["feeder_category"]
  },
  {
    section: "Substation Wise vs Subdivision Wise",
    baseScope: "substation_wise",
    rollupScope: "subdivision_wise",
    groupFields: ["circle_name", "division_name", "subdivision_name"]
  },
  {
    section: "Subdivision Wise vs Division Wise",
    baseScope: "subdivision_wise",
    rollupScope: "division_wise",
    groupFields: ["circle_name", "division_name"]
  },
  {
    section: "Division Wise vs Circle Wise",
    baseScope: "division_wise",
    rollupScope: "circle_wise",
    groupFields: ["circle_name"]
  },
  {
    section: "Circle Wise vs Zone Wise",
    baseScope: "circle_wise",
    rollupScope: "zone_wise",
    groupFields: ["zone_name"]
  }
];
const EXCEL_HIERARCHY_METRICS = [
  { key: "total_feeders", label: "Total Feeders", type: "integer" },
  { key: "planned_saifi", label: "Planned SAIFI", type: "number" },
  { key: "planned_saidi_seconds", label: "Planned SAIDI", type: "duration_hms" },
  { key: "unplanned_saifi", label: "Unplanned SAIFI", type: "number" },
  { key: "unplanned_saidi_seconds", label: "Unplanned SAIDI", type: "duration_hms" },
  { key: "total_saifi", label: "Total SAIFI", type: "number" },
  { key: "total_saidi_seconds", label: "Total SAIDI", type: "duration_hms" },
  { key: "average_interruptions_per_feeder_per_day", label: "Average Interruption Per Feeder Per Day", type: "number" },
  { key: "average_hours_supply_seconds", label: "Average Hours Of Supply", type: "duration_hm" }
];
const EXCEL_HIERARCHY_SCOPE_LABELS = {
  zone_wise: "Zone Wise",
  circle_wise: "Circle Wise",
  division_wise: "Division Wise",
  subdivision_wise: "Subdivision Wise",
  substation_wise: "Substation Wise",
  feeder_wise: "Feeder Wise",
  feeder_category_wise: "Feeder Category Wise"
};
const EXCEL_HIERARCHY_SCOPE_IDENTITY_FIELDS = {
  zone_wise: ["zone_name"],
  circle_wise: ["zone_name", "circle_name"],
  division_wise: ["zone_name", "circle_name", "division_name"],
  subdivision_wise: ["zone_name", "circle_name", "division_name", "subdivision_name"],
  substation_wise: ["zone_name", "circle_name", "division_name", "subdivision_name", "substation_name"],
  feeder_wise: ["zone_name", "circle_name", "division_name", "subdivision_name", "substation_name", "feeder_code", "feeder_name"],
  feeder_category_wise: ["feeder_category"]
};
const EXCEL_HIERARCHY_ABSOLUTE_TOLERANCE = 0.01;
const EXCEL_HIERARCHY_RELATIVE_TOLERANCE = 0.01;
const API_HOST = process.env.API_HOST || "127.0.0.1";
const PORT = readPort(process.env.API_PORT || process.env.PORT, 8787);
const execFileAsync = promisify(execFile);

const PHASES = [
  {
    id: "01-requirement-intake",
    number: 1,
    title: "Requirement Intake",
    artifactName: "requirement-brief.md",
    outputTitle: "Requirement Brief"
  },
  {
    id: "02-ai-analysis-understanding",
    number: 2,
    title: "AI Analysis and Understanding",
    artifactName: "source-to-report-mapping.md",
    outputTitle: "Source-to-Report Mapping"
  },
  {
    id: "03-sql-draft-logic-preparation",
    number: 3,
    title: "SQL Draft and Logic Preparation",
    artifactName: "sql-logic-notes.md",
    outputTitle: "SQL Logic Notes"
  },
  {
    id: "04-dashboard-report-development",
    number: 4,
    title: "Dashboard or Report Development",
    artifactName: "build-notes.md",
    outputTitle: "Dashboard or Report Build Notes"
  },
  {
    id: "05-ai-review-validation",
    number: 5,
    title: "AI Review and Validation",
    artifactName: "review-log.md",
    outputTitle: "Review Log"
  },
  {
    id: "06-testing-verification",
    number: 6,
    title: "Testing and Verification",
    artifactName: "test-log.md",
    outputTitle: "Test Log"
  },
  {
    id: "07-approval-delivery",
    number: 7,
    title: "Approval and Delivery",
    artifactName: "delivery-summary.md",
    outputTitle: "Delivery Summary"
  }
];

const GATES = {
  projectContext: [
    ["Project ID", "Stable project_id is known and uses lowercase letters, digits, hyphens, and underscores."],
    ["Project workspace", "Project artifact root exists or will be created under projects/<project_id>/."],
    ["Project control file", "PROJECT.md exists or will be created for the project."],
    ["Current phase", "Active phase is known."],
    ["Artifact path", "Output location for the current artifact is known."],
    ["Project owner", "Business owner, requester, or proxy owner is known."],
    ["Cross-project scope", "If multiple projects are affected, each project_id is listed."]
  ],
  "01-requirement-intake": {
    entry: [
      ["Project context ready", "Project Context Gate is complete."],
      ["Request received", "Raw request, ticket, screenshot, email, meeting note, or user prompt exists."],
      ["Request owner known", "Business requester or proxy owner is identified."],
      ["Intake scope known", "New report, dashboard, enhancement, migration, audit, or defect is identified."],
      ["Initial business area known", "Domain, team, process, or subject area is identified."]
    ],
    exit: [
      ["Business objective", "Objective and decision supported by the artifact are documented."],
      ["Stakeholders", "Audience, business owner, technical owner if known, and approver are documented."],
      ["Platform path", "Grafana, FlexReport, Superset, or platform decision criteria are documented."],
      ["KPI catalog", "Each KPI has definition, formula or open question, grain, owner, and status."],
      ["Dimensions and filters", "Required dimensions, filters, defaults, and allowed values are captured or questioned."],
      ["Time logic", "Date basis, time range, timezone, refresh need, and comparison period are captured or questioned."],
      ["Data expectations", "Known source systems, tables, files, reports, or data owners are listed."],
      ["Security and delivery", "Access, export, schedule, environment, and delivery expectations are captured."],
      ["Acceptance criteria", "Testable acceptance criteria exist for business, data, and user experience."],
      ["Open questions", "Open questions have priority, owner, and impact."],
      ["Scope decision", "In-scope and out-of-scope items are separated."]
    ]
  },
  "02-ai-analysis-understanding": {
    entry: [
      ["Project context ready", "Project Context Gate is complete for the same project_id as Phase 1."],
      ["Requirement brief", "Phase 1 requirement brief is available and approved or marked with accepted risks."],
      ["KPI catalog", "KPI definitions or unresolved KPI questions are available."],
      ["Data access path", "Schema, DDL, sample rows, data dictionary, existing SQL, or owner path is available."],
      ["Acceptance criteria", "Testable criteria are available to guide mapping and validation."]
    ],
    exit: [
      ["Source-to-report mapping", "Every KPI, dimension, filter, and output field is mapped, questioned, or rejected as unavailable."],
      ["Grain defined", "Reporting grain and source grain are documented."],
      ["Join model", "Join paths, keys, cardinality, and duplicate risks are documented."],
      ["Date logic", "Source date fields, timezone, and refresh implications are documented."],
      ["Transformations", "Calculations, exclusions, status logic, conversions, and null handling are documented."],
      ["Data quality risks", "Missing data, ambiguity, nulls, duplicates, late data, and performance risks are logged."],
      ["Validation plan", "Validation checks needed for SQL and testing are listed."],
      ["Owner assignments", "Blocking data questions have owners and next actions."]
    ]
  },
  "03-sql-draft-logic-preparation": {
    entry: [
      ["Project context ready", "Project Context Gate is complete for the same project_id as Phase 2."],
      ["Mapping ready", "Phase 2 mapping is complete or unresolved items have accepted risks."],
      ["Schema available", "Required table and column structure is available."],
      ["KPI rules available", "KPI formulas, filters, grain, and date logic are documented."],
      ["SQL target known", "Dashboard query, dataset, view, materialized view, export, or report dataset target is known."]
    ],
    exit: [
      ["Main SQL draft", "PostgreSQL draft exists with named CTEs or a clear equivalent structure."],
      ["Traceability", "Every selected column and KPI traces to a requirement or mapping item."],
      ["Parameters", "Date range, filters, role constraints, and optional parameters are defined."],
      ["Join safety", "Join type, keys, cardinality expectation, and duplicate handling are documented."],
      ["KPI correctness", "Formulas, aggregation grain, null handling, divide-by-zero handling, and units are implemented."],
      ["Validation queries", "Row count, duplicate, null, date, filter, and KPI reconciliation checks are provided."],
      ["Performance notes", "Large table, filter, index/key, caching, and materialization risks are noted where relevant."],
      ["Review notes", "Assumptions, open questions, and review focus areas are documented."]
    ]
  },
  "04-dashboard-report-development": {
    entry: [
      ["Project context ready", "Project Context Gate is complete for the same project_id as Phase 3."],
      ["SQL ready", "SQL draft and validation notes are available."],
      ["Platform chosen", "Grafana, FlexReport, or Superset target is selected."],
      ["Requirements ready", "Requirement brief and acceptance criteria are available."],
      ["Build access path", "Workspace, environment, owner, or implementation path is known."]
    ],
    exit: [
      ["Artifact structure", "Pages, sections, panels, charts, report bands, or exports are defined."],
      ["Visual inventory", "Every required KPI/output maps to a visual, table, report field, export, or documented exclusion."],
      ["Dataset inventory", "Every component has source SQL or dataset reference, grain, and owner."],
      ["Filter behavior", "Filter defaults, scope, interactions, and date controls are documented."],
      ["Naming consistency", "Artifact, sections, fields, filters, metrics, and datasets follow consistent names."],
      ["Platform behavior", "Refresh, alerts, export, print, drill-down, or scheduling details are documented as applicable."],
      ["Access expectations", "Roles, sensitive data, row-level security, and export permissions are documented."],
      ["Build evidence", "Screenshot, configuration note, link, export, or implementation checklist exists."],
      ["Development issues", "Known issues have severity, owner, and next action."]
    ]
  },
  "05-ai-review-validation": {
    entry: [
      ["Project context ready", "Project Context Gate is complete for the same project_id as Phase 4."],
      ["Review artifacts", "Requirement brief, mapping, SQL, build notes, and available screenshots/exports are available."],
      ["Review scope", "SQL, visual/report, filter, access, performance, and governance scope is defined."],
      ["Acceptance criteria", "Criteria from Phase 1 are available for coverage review."]
    ],
    exit: [
      ["Coverage matrix", "Each requirement has SQL, visual/report, and validation coverage status."],
      ["SQL review", "Joins, filters, aggregation, KPI formulas, date logic, null handling, and duplicate risks are reviewed."],
      ["UX/report review", "Layout, naming, units, formatting, filters, exports, and user flow are reviewed."],
      ["Governance review", "Access, ownership, documentation, and consistency across reports are reviewed."],
      ["Findings logged", "Findings have severity, evidence, recommendation, owner, and blocking status."],
      ["Critical/high resolution", "Critical and high findings are fixed or formally accepted with owner and impact."],
      ["Testing focus", "Required test cases and high-risk areas for Phase 6 are identified."]
    ]
  },
  "06-testing-verification": {
    entry: [
      ["Project context ready", "Project Context Gate is complete for the same project_id as Phase 5."],
      ["Review completed", "Phase 5 findings are resolved, assigned, or accepted."],
      ["Testable artifact", "Dashboard/report/query/export is available in a testable environment."],
      ["Expected results", "Trusted source, sample, prior report, or stakeholder expected values are available."],
      ["Test access", "Required roles, credentials, exports, and environment access are available or assigned."]
    ],
    exit: [
      ["Acceptance coverage", "Every acceptance criterion has a test result."],
      ["Data tests", "KPI totals, source reconciliation, joins, filters, nulls, duplicates, and date boundaries are tested."],
      ["UI/report tests", "Visuals, sorting, formatting, drill-downs, exports, print, and empty states are tested as applicable."],
      ["Access tests", "Role visibility, row restrictions, sensitive fields, and export permissions are tested where applicable."],
      ["Performance tests", "Load time, query time, large date ranges, and refresh behavior are tested or marked not applicable."],
      ["Evidence captured", "Query results, screenshots, exports, or notes are captured for each test."],
      ["Defects resolved", "Critical/high defects are fixed or accepted as risks with owner approval."],
      ["Retest done", "Fixed defects have retest status."],
      ["Release recommendation", "Pass, blocked, or pass with accepted risks is documented."]
    ]
  },
  "07-approval-delivery": {
    entry: [
      ["Project context ready", "Project Context Gate is complete for the same project_id as Phase 6."],
      ["Testing complete", "Phase 6 release recommendation is pass or pass with accepted risks."],
      ["Delivery artifact ready", "Final dashboard/report/query/export exists in the target environment or release package."],
      ["Owners known", "Business owner, technical owner, support owner, and approver are identified."],
      ["Deployment path known", "Publish, access, refresh, rollback, and monitoring path is known."]
    ],
    exit: [
      ["Delivery summary", "Final artifact, platform, environment, version, link/location, owners, and scope are documented."],
      ["Deployment record", "Publish steps, refresh schedule, access groups, rollback, and monitoring are documented."],
      ["Review/test summary", "Review status, test status, open defects, and accepted risks are documented."],
      ["Sign-off", "Business and technical sign-off are recorded; client sign-off is recorded when applicable."],
      ["Support handoff", "Support owner, escalation path, known limitations, and post-delivery actions are assigned."],
      ["Governance closure", "Future enhancements, monitoring checks, and change ownership are documented."]
    ]
  }
};

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      try {
        const project = assertProjectId(req.params.projectId);
        const phase = assertPhaseId(req.params.phaseId);
        const actor = await requestActor(req);
        const state = await readProjectState(project);
        assertProjectAccess(state, actor);
        const uploadDir = path.join(PROJECTS_ROOT, project, "phases", phase, "uploads");
        await ensureDir(uploadDir);
        cb(null, uploadDir);
      } catch (error) {
        cb(error);
      }
    },
    filename: (req, file, cb) => {
      const safeName = safeFilename(file.originalname);
      cb(null, `${timestamp()}-${safeName}`);
    }
  }),
  limits: {
    files: 10,
    fileSize: 25 * 1024 * 1024
  }
});

const reviewInputUpload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      try {
        const kind = assertReviewInputUploadKind(req.params.kind);
        const actor = await requestActor(req);
        const projectSlug = slugify(req.body.projectName || "browser-selection") || "browser-selection";
        const uploadId = req.reviewInputUploadId || `${timestamp()}-${Math.random().toString(16).slice(2)}`;
        req.reviewInputUploadId = uploadId;
        const uploadDir = path.join(BROWSER_REVIEW_INPUT_ROOT, userReviewFolderName(actor.username), `${projectSlug}-${uploadId}`, kind);
        req.reviewInputUploadDir = uploadDir;
        await ensureDir(uploadDir);
        cb(null, uploadDir);
      } catch (error) {
        cb(error);
      }
    },
    filename: (req, file, cb) => {
      cb(null, safeFilename(file.originalname));
    }
  }),
  fileFilter: (req, file, cb) => {
    try {
      const kind = assertReviewInputUploadKind(req.params.kind);
      const extension = path.extname(file.originalname || "").toLowerCase();
      if (!reviewInputUploadExtensions(kind).has(extension)) {
        cb(new Error(reviewInputUploadExtensionMessage(kind)));
        return;
      }
      cb(null, true);
    } catch (error) {
      cb(error);
    }
  },
  limits: {
    files: 50,
    fileSize: 100 * 1024 * 1024
  }
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, serverTime: new Date().toISOString() });
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    const user = await findAuthUser(username);
    if (!user || user.password !== password) {
      return res.status(401).json({ ok: false, error: "Invalid username or password." });
    }
    res.json({ ok: true, username: user.username, userType: user.userType || "User" });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/users", async (req, res, next) => {
  try {
    const adminUsername = String(req.body?.adminUsername || "").trim();
    const adminPassword = String(req.body?.adminPassword || "");
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    const admin = await findAuthUser(adminUsername);
    if (!admin || admin.username.toLowerCase() !== BUILT_IN_ADMIN.username.toLowerCase() || admin.password !== adminPassword) {
      return res.status(403).json({ ok: false, error: "Only Rahul_Raj can create users. Enter Rahul_Raj admin credentials." });
    }
    if (!username || !password) {
      return res.status(400).json({ ok: false, error: "New username and password are required." });
    }
    const users = await readAuthUsers();
    if (users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
      return res.status(409).json({ ok: false, error: "This username already exists." });
    }

    const user = {
      username,
      password,
      userType: "Admin Created User",
      createdBy: BUILT_IN_ADMIN.username,
      createdAt: new Date().toISOString(),
      source: "server"
    };
    await writeStoredAuthUsers([...(await readStoredAuthUsers()), user]);
    res.json({ ok: true, username, message: `User ${username} created successfully.` });
  } catch (error) {
    next(error);
  }
});

app.get("/api/phases", (req, res) => {
  res.json({ phases: PHASES, gates: GATES });
});

app.get("/api/excel-pdf-data/defaults", async (req, res, next) => {
  try {
    const actor = await requestActor(req);
    const config = normalizeExcelPdfDataOptions({});
    const visibleConfig = excelPdfConfigForActor(config, actor);
    res.json({
      config: visibleConfig,
      files: await discoverExcelPdfDataInputs(visibleConfig)
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/excel-pdf-data/discover", async (req, res, next) => {
  try {
    const actor = await requestActor(req);
    const config = normalizeExcelPdfDataOptions(req.body || {});
    const visibleConfig = excelPdfConfigForActor(config, actor);
    res.json({
      config: visibleConfig,
      files: await discoverExcelPdfDataInputs(visibleConfig)
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/excel-pdf-data/upload/:kind", reviewInputUpload.array("files", 50), async (req, res, next) => {
  try {
    const kind = assertReviewInputUploadKind(req.params.kind);
    const files = req.files || [];
    if (!files.length) {
      const error = new Error(reviewInputUploadEmptyMessage(kind));
      error.statusCode = 400;
      throw error;
    }
    const reviewKind = kind === "checklist" ? "Checklist" : kind === "excel" ? "Excel" : "PDF";
    const uploadedFiles = [];
    for (const file of files) {
      const stat = await fsp.stat(file.path);
      const reviewFile = toReviewFile(file.path, reviewKind, stat);
      uploadedFiles.push(reviewKind === "Checklist" ? withChecklistRevision(reviewFile) : reviewFile);
    }
    res.json({
      kind,
      folder: req.reviewInputUploadDir || path.dirname(uploadedFiles[0].path),
      files: uploadedFiles,
      selectedPaths: uploadedFiles.map((file) => file.path)
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/excel-pdf-data/checklist/sheets", async (req, res, next) => {
  try {
    const actor = await requestActor(req);
    const workbookPath = await resolveChecklistWorkbook(req.query.path, actor);
    res.json(await runChecklistRevisionCommand("inspect", [workbookPath], () => inspectChecklistWorkbook(workbookPath)));
  } catch (error) {
    next(error);
  }
});

app.get("/api/excel-pdf-data/checklist/sheet", async (req, res, next) => {
  try {
    const actor = await requestActor(req);
    const workbookPath = await resolveChecklistWorkbook(req.query.path, actor);
    const sheetName = String(req.query.sheetName || "").trim();
    if (!sheetName) {
      const error = new Error("Checklist sheet name is required.");
      error.statusCode = 400;
      throw error;
    }
    res.json(await runChecklistRevisionCommand("sheet", [workbookPath, sheetName], () => readChecklistSheet(workbookPath, sheetName)));
  } catch (error) {
    next(error);
  }
});

app.post("/api/excel-pdf-data/checklist/revision", async (req, res, next) => {
  try {
    const actor = await requestActor(req);
    const config = normalizeExcelPdfDataOptions(req.body || {});
    const sourcePath = await resolveChecklistWorkbook(req.body?.selectedChecklistPath || req.body?.checklistPath || config.selectedChecklistPath, actor);
    const sheetName = String(req.body?.sheetName || "").trim();
    const points = normalizeChecklistPoints(req.body?.points || req.body?.pointsText);
    if (!sheetName) {
      const error = new Error("Please select a checklist sheet before saving a revision.");
      error.statusCode = 400;
      throw error;
    }
    if (!points.length) {
      const error = new Error("Please add at least one checklist point before saving a revision.");
      error.statusCode = 400;
      throw error;
    }

    const nextRevision = await nextChecklistRevisionPath(sourcePath);
    const saved = await runChecklistRevisionCommand(
      "append",
      [sourcePath, nextRevision.outputPath, sheetName, JSON.stringify(points)],
      () => appendChecklistPoints(sourcePath, nextRevision.outputPath, sheetName, points),
      60 * 1000
    );
    const stat = await fsp.stat(nextRevision.outputPath);
    const createdFile = withChecklistRevision(toReviewFile(nextRevision.outputPath, "Checklist", stat));
    const checklistInput = isChecklistWorkbook(config.checklistInput) ? path.dirname(sourcePath) : config.checklistInput;
    const files = await discoverExcelPdfDataInputsForActor({
      ...config,
      checklistInput,
      selectedChecklistPath: nextRevision.outputPath
    }, actor);
    res.json({
      ok: true,
      revisionLabel: nextRevision.revisionLabel,
      createdFile,
      saved,
      files
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/excel-pdf-data/checklist/revision/edit", async (req, res, next) => {
  try {
    const actor = await requestActor(req);
    const config = normalizeExcelPdfDataOptions(req.body || {});
    const sourcePath = await resolveChecklistWorkbook(req.body?.selectedChecklistPath || req.body?.checklistPath || config.selectedChecklistPath, actor);
    const sheetName = String(req.body?.sheetName || "").trim();
    const rows = normalizeChecklistGridRows(req.body?.rows || []);
    if (!sheetName) {
      const error = new Error("Please select a checklist sheet before saving a revision.");
      error.statusCode = 400;
      throw error;
    }
    if (!rows.length) {
      const error = new Error("At least one checklist row is required before saving a revision.");
      error.statusCode = 400;
      throw error;
    }

    const nextRevision = await nextChecklistRevisionPath(sourcePath);
    const saved = await runChecklistRevisionCommand(
      "save-sheet",
      [sourcePath, nextRevision.outputPath, sheetName, JSON.stringify(rows)],
      () => saveChecklistSheetRevision(sourcePath, nextRevision.outputPath, sheetName, rows),
      60 * 1000
    );
    const stat = await fsp.stat(nextRevision.outputPath);
    const createdFile = withChecklistRevision(toReviewFile(nextRevision.outputPath, "Checklist", stat));
    const checklistInput = isChecklistWorkbook(config.checklistInput) ? path.dirname(sourcePath) : config.checklistInput;
    const files = await discoverExcelPdfDataInputsForActor({
      ...config,
      checklistInput,
      selectedChecklistPath: nextRevision.outputPath
    }, actor);
    res.json({
      ok: true,
      revisionLabel: nextRevision.revisionLabel,
      createdFile,
      saved,
      files
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/excel-pdf-data/repository", async (req, res, next) => {
  try {
    const actor = await requestActor(req);
    const projectName = String(req.query.projectName || "").trim();
    const userName = String(req.query.userName || "").trim();
    res.json(await listExcelPdfProjectRepository(projectName, userName, actor));
  } catch (error) {
    next(error);
  }
});

app.get("/api/excel-pdf-data/repository/view", async (req, res, next) => {
  try {
    const actor = await requestActor(req);
    const filePath = resolveRepositoryFile(req.query.path, actor);
    const extension = path.extname(filePath).toLowerCase();
    if (![".md", ".txt"].includes(extension)) {
      const error = new Error("Only Markdown and text review files can be previewed in the browser.");
      error.statusCode = 400;
      throw error;
    }
    const content = await fsp.readFile(filePath, "utf8");
    res.json({
      name: path.basename(filePath),
      path: relativePath(AI_REVIEW_ROOT, filePath),
      extension,
      content
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/excel-pdf-data/repository/summary", async (req, res, next) => {
  try {
    const actor = await requestActor(req);
    const requestedPath = String(req.query.path || "").trim();
    let filePath = "";
    if (requestedPath) {
      filePath = resolveRepositoryFile(requestedPath, actor);
    } else {
      const projectName = String(req.query.projectName || "").trim();
      const userName = String(req.query.userName || "").trim();
      filePath = await latestExcelPdfResultJsonPath(projectName, userName, actor);
    }
    const payload = JSON.parse(await fsp.readFile(filePath, "utf8"));
    res.json(buildExcelPdfReviewSummary(payload, relativePath(AI_REVIEW_ROOT, filePath)));
  } catch (error) {
    next(error);
  }
});

app.get("/api/excel-pdf-data/repository/download", async (req, res, next) => {
  try {
    const actor = await requestActor(req);
    const filePath = resolveRepositoryFile(req.query.path, actor);
    const inline = String(req.query.inline || "") === "1";
    if (inline && path.extname(filePath).toLowerCase() === ".pdf") {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${path.basename(filePath).replace(/"/g, "")}"`);
      return res.sendFile(filePath);
    }
    res.download(filePath, path.basename(filePath));
  } catch (error) {
    next(error);
  }
});

app.post("/api/excel-pdf-data/run", async (req, res) => {
  try {
    const actor = await requestActor(req);
    const config = normalizeExcelPdfDataOptions(req.body || {});
    const hasSelectedPdf = Boolean(config.selectedPdfPath) || (config.selectedPdfPaths || []).length > 0;
    if (!hasSelectedPdf) config.excelOnly = true;
    if (!actor.isAdmin) config.userName = actor.username;
    if (actor.isAdmin && !config.userName) config.userName = actor.username;
    const files = await discoverExcelPdfDataInputsForActor(config, actor);
    const startedAt = new Date().toISOString();
    const runPlan = await prepareExcelPdfDataRun(config, files);
    const args = buildExcelPdfDataArgs(runPlan.agentConfig);
    const { stdout, stderr } = await execFileAsync(process.execPath, [EXCEL_PDF_AGENT_SCRIPT, ...args], {
      cwd: EXCEL_PDF_AGENT_DIR,
      env: nodeSubprocessEnv(),
      timeout: 15 * 60 * 1000,
      maxBuffer: 25 * 1024 * 1024,
      windowsHide: true
    });
    const parsed = parseExcelPdfDataStdout(stdout);
    const projectArtifacts = await finalizeExcelPdfProjectArtifacts({
      parsed,
      config,
      runPlan,
      stdout,
      stderr,
      startedAt
    });

    res.json({
      ok: true,
      startedAt,
      completedAt: new Date().toISOString(),
      command: `${process.execPath} ${EXCEL_PDF_AGENT_SCRIPT}`,
      args,
      config,
      files,
      runPlan,
      stdout,
      stderr,
      parsed: {
        ...parsed,
        projectOutputFolder: projectArtifacts.projectOutputFolder,
        projectJsonPath: projectArtifacts.projectJsonPath,
        projectMarkdownPath: projectArtifacts.projectMarkdownPath,
        projectTextPath: projectArtifacts.projectTextPath
      },
      projectArtifacts
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Excel/PDF data review failed.",
      stdout: error?.stdout || "",
      stderr: error?.stderr || "",
      parsed: parseExcelPdfDataStdout(error?.stdout || "")
    });
  }
});

app.get("/api/projects", async (req, res, next) => {
  try {
    const actor = await requestActor(req);
    await ensureDir(PROJECTS_ROOT);
    const entries = await fsp.readdir(PROJECTS_ROOT, { withFileTypes: true });
    const projects = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
      const state = await readProjectState(entry.name);
      if (!canAccessProject(state, actor)) continue;
      projects.push(toProjectSummary(state));
    }
    projects.sort((a, b) => a.projectName.localeCompare(b.projectName));
    res.json({ projects });
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects", async (req, res, next) => {
  try {
    const actor = await requestActor(req);
    const projectId = assertProjectId(req.body.projectId || slugify(req.body.projectName || ""));
    const projectName = String(req.body.projectName || projectId).trim();
    const owner = String(req.body.owner || "").trim() || actor.username;
    const targetPlatform = String(req.body.targetPlatform || "").trim();
    const projectRoot = projectPath(projectId);
    if (fs.existsSync(projectRoot)) {
      return res.status(409).json({ error: "Project already exists." });
    }

    await createProjectWorkspace({ projectId, projectName, owner, targetPlatform, ownerUserName: actor.username, createdByUserName: actor.username });
    const state = await readProjectState(projectId);
    res.status(201).json({ project: await buildProjectDetail(state) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/projects/:projectId", async (req, res, next) => {
  try {
    const projectId = assertProjectId(req.params.projectId);
    const { state } = await readAuthorizedProjectState(projectId, req);
    const project = await buildProjectDetail(state);
    res.json({ project });
  } catch (error) {
    next(error);
  }
});

app.put("/api/projects/:projectId", async (req, res, next) => {
  try {
    const projectId = assertProjectId(req.params.projectId);
    const { state } = await readAuthorizedProjectState(projectId, req);
    const projectName = String(req.body.projectName || "").trim();
    if (!projectName) {
      const error = new Error("Project name is required.");
      error.statusCode = 400;
      throw error;
    }
    state.projectName = projectName;
    state.updatedAt = new Date().toISOString();
    await writeProjectState(state);
    await writeProjectMarkdown(state);
    res.json({ project: await buildProjectDetail(state) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/projects/:projectId", async (req, res, next) => {
  try {
    const projectId = assertProjectId(req.params.projectId);
    const { actor } = await readAuthorizedProjectState(projectId, req);
    const result = await moveProjectToTrash(projectId, actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/projects/:projectId/phases/:phaseId", async (req, res, next) => {
  try {
    const projectId = assertProjectId(req.params.projectId);
    const phaseId = assertPhaseId(req.params.phaseId);
    const { state } = await readAuthorizedProjectState(projectId, req);
    const phase = await buildPhaseDetail(state, phaseId);
    res.json({ phase });
  } catch (error) {
    next(error);
  }
});

app.put("/api/projects/:projectId/phases/:phaseId", async (req, res, next) => {
  try {
    const projectId = assertProjectId(req.params.projectId);
    const phaseId = assertPhaseId(req.params.phaseId);
    const phaseTitle = String(req.body.title || "").trim();
    if (!phaseTitle) {
      const error = new Error("Phase title is required.");
      error.statusCode = 400;
      throw error;
    }
    const { state } = await readAuthorizedProjectState(projectId, req);
    state.phases[phaseId] = {
      ...(state.phases[phaseId] || {}),
      title: phaseTitle,
      updatedAt: new Date().toISOString()
    };
    state.updatedAt = new Date().toISOString();
    await writeProjectState(state);
    await writeProjectMarkdown(state);
    res.json({ project: await buildProjectDetail(state), phase: await buildPhaseDetail(state, phaseId) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects/:projectId/phases/:phaseId/uploads", upload.array("files", 10), async (req, res, next) => {
  try {
    const projectId = assertProjectId(req.params.projectId);
    const phaseId = assertPhaseId(req.params.phaseId);
    await readAuthorizedProjectState(projectId, req);
    const files = req.files || [];
    const manifest = await appendUploadManifest(projectId, phaseId, files);
    res.json({ uploaded: files.length, files: manifest });
  } catch (error) {
    next(error);
  }
});

app.put("/api/projects/:projectId/phases/:phaseId/gate", async (req, res, next) => {
  try {
    const projectId = assertProjectId(req.params.projectId);
    const phaseId = assertPhaseId(req.params.phaseId);
    await readAuthorizedProjectState(projectId, req);
    const gate = normalizeGatePayload(req.body.gate);
    await writeJson(phasePath(projectId, phaseId, "gate-status.json"), gate);
    res.json({ gate });
  } catch (error) {
    next(error);
  }
});

app.put("/api/projects/:projectId/phases/:phaseId/questions", async (req, res, next) => {
  try {
    const projectId = assertProjectId(req.params.projectId);
    const phaseId = assertPhaseId(req.params.phaseId);
    await readAuthorizedProjectState(projectId, req);
    const questionAnswers = normalizeQuestionAnswers(req.body.questionAnswers);
    await writeQuestionAnswers(projectId, phaseId, questionAnswers);
    res.json({ questionAnswers });
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects/:projectId/phases/:phaseId/run", async (req, res, next) => {
  try {
    const projectId = assertProjectId(req.params.projectId);
    const phaseId = assertPhaseId(req.params.phaseId);
    await readAuthorizedProjectState(projectId, req);
    const notes = String(req.body.notes || "").trim();
    const questionAnswers = Object.prototype.hasOwnProperty.call(req.body || {}, "questionAnswers")
      ? normalizeQuestionAnswers(req.body.questionAnswers)
      : null;
    const result = await runLocalPhaseAgent(projectId, phaseId, notes, questionAnswers);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects/:projectId/phases/:phaseId/complete", async (req, res, next) => {
  try {
    const projectId = assertProjectId(req.params.projectId);
    const phaseId = assertPhaseId(req.params.phaseId);
    await readAuthorizedProjectState(projectId, req);
    const gate = await readGateState(projectId, phaseId);
    const blockers = findGateBlockers(gate);
    if (blockers.length > 0) {
      return res.status(409).json({
        error: "Phase cannot be completed until all gate items are Complete or Not applicable with notes.",
        blockers
      });
    }

    const state = await readProjectState(projectId);
    const phaseState = state.phases[phaseId] || {};
    state.phases[phaseId] = {
      ...phaseState,
      status: "completed",
      gateRecommendation: "Pass",
      updatedAt: new Date().toISOString()
    };

    const nextPhase = getNextPhase(phaseId);
    if (nextPhase) {
      state.currentPhaseId = nextPhase.id;
      state.phases[nextPhase.id] = {
        ...state.phases[nextPhase.id],
        status: state.phases[nextPhase.id]?.status === "completed" ? "completed" : "in-progress",
        updatedAt: new Date().toISOString()
      };
    } else {
      state.status = "delivered";
    }
    state.updatedAt = new Date().toISOString();
    await writeProjectState(state);
    await writeProjectMarkdown(state);
    res.json({ project: await buildProjectDetail(state), nextPhaseId: nextPhase?.id || null });
  } catch (error) {
    next(error);
  }
});

if (fs.existsSync(DIST_ROOT)) {
  const sendNoCacheHeaders = (res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  };
  app.use(
    express.static(DIST_ROOT, {
      etag: false,
      lastModified: false,
      setHeaders: sendNoCacheHeaders
    })
  );
  app.get(/^\/assets\//, (req, res) => {
    sendNoCacheHeaders(res);
    res.status(404).send("Asset not found");
  });
  app.get(/^(?!\/api(?:\/|$)).*/, (req, res) => {
    sendNoCacheHeaders(res);
    res.sendFile(path.join(DIST_ROOT, "index.html"));
  });
}

app.use((error, req, res, next) => {
  console.error(error);
  const status = error.statusCode || 500;
  res.status(status).json({ error: error.message || "Unexpected server error." });
});

const server = app.listen(PORT, API_HOST, () => {
  console.log(`DA automation API listening on http://${API_HOST}:${PORT}`);
});

export { app, server };

function phasePath(projectId, phaseId, ...parts) {
  return path.join(projectPath(projectId), "phases", phaseId, ...parts);
}

function projectPath(projectId, ...parts) {
  return path.join(PROJECTS_ROOT, projectId, ...parts);
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function readPort(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : fallback;
}

function nodeSubprocessEnv() {
  const env = {
    ...process.env,
    DA_AI_REVIEW_ROOT: AI_REVIEW_ROOT,
    AI_REVIEW_ROOT,
    REPORT_REVIEW_AGENT_ROOT: EXCEL_PDF_AGENT_DIR,
    REPORT_REVIEW_INPUT_ROOT: path.join(AI_REVIEW_ROOT, "report-review-input"),
    REPORT_REVIEW_OUTPUT_ROOT: path.join(AI_REVIEW_ROOT, "report-review-finding"),
    REPORT_REVIEW_TEMP_ROOT: path.join(AI_REVIEW_ROOT, "report-review-tmp")
  };
  if (process.versions.electron) {
    env.ELECTRON_RUN_AS_NODE = "1";
  }
  return env;
}

async function runChecklistRevisionCommand(command, args, fallback, timeout = 30 * 1000) {
  if (command === "inspect" || command === "sheet") {
    return fallback();
  }
  if (USE_PYTHON_CHECKLIST_REVISION && fs.existsSync(CHECKLIST_REVISION_SCRIPT)) {
    try {
      const { stdout } = await execFileAsync(PYTHON_BIN, [CHECKLIST_REVISION_SCRIPT, command, ...args], {
        cwd: ROOT,
        timeout,
        maxBuffer: 5 * 1024 * 1024,
        windowsHide: true
      });
      return JSON.parse(stdout);
    } catch (error) {
      if (!isMissingPythonError(error)) {
        console.warn(`Checklist revision helper failed for ${command}; using built-in workbook reader.`, error?.message || error);
      }
    }
  }
  return fallback();
}

function isMissingPythonError(error) {
  const message = String(error?.message || error || "");
  return error?.code === "ENOENT" || /not recognized|cannot find|no such file|was not found|unable to create process/i.test(message);
}

const STATUS_MATRIX_FIRST_DATA_ROW = 2;

function isChecklistStatusMatrixSheet(sheet) {
  if (!sheet) return false;
  return cleanWorkbookText(cellValue(sheet, 0, 0)).toLowerCase() === "check points";
}

function isChecklistStatusValue(value) {
  const normalized = cleanWorkbookText(value).toLowerCase();
  return normalized === "ok" || normalized === "not ok" || normalized === "na";
}

function statusMatrixColumnCount(sheet) {
  const range = worksheetBounds(sheet);
  let lastColumn = 0;
  for (let col = 0; col <= range.maxColumn; col += 1) {
    if (cleanWorkbookText(cellValue(sheet, 0, col)) || cleanWorkbookText(cellValue(sheet, 1, col))) {
      lastColumn = col;
    }
  }
  return Math.max(1, lastColumn + 1);
}

function statusMatrixRowHasContent(sheet, row, maxColumn) {
  if (cleanWorkbookText(cellValue(sheet, row, 0))) return true;
  for (let col = 1; col < maxColumn; col += 1) {
    if (cleanWorkbookText(cellValue(sheet, row, col))) return true;
  }
  return false;
}

function statusMatrixRowHasChecklistStatus(sheet, row, maxColumn) {
  for (let col = 1; col < maxColumn; col += 1) {
    if (isChecklistStatusValue(cellValue(sheet, row, col))) return true;
  }
  return false;
}

function lastStatusMatrixDataRow(sheet, maxColumn) {
  const range = worksheetBounds(sheet);
  let lastRow = STATUS_MATRIX_FIRST_DATA_ROW - 1;
  for (let row = STATUS_MATRIX_FIRST_DATA_ROW; row <= range.maxRow; row += 1) {
    if (statusMatrixRowHasContent(sheet, row, maxColumn)) {
      lastRow = row;
    } else if (row > lastRow + 100) {
      break;
    }
  }
  return lastRow;
}

function statusMatrixColumns(sheet, maxColumn) {
  const columns = [];
  let currentGroup = "";
  for (let col = 0; col < maxColumn; col += 1) {
    if (col === 0) {
      columns.push(cleanWorkbookText(cellValue(sheet, 0, col)) || "Check Points");
      continue;
    }
    const group = cleanWorkbookText(cellValue(sheet, 0, col));
    if (group) currentGroup = group;
    const reportName = cleanWorkbookText(cellValue(sheet, 1, col));
    columns.push([currentGroup, reportName].filter(Boolean).join(" - ") || `Column ${col + 1}`);
  }
  return columns;
}

function readStatusMatrixChecklistSheet(sheet, sheetName) {
  const maxColumn = statusMatrixColumnCount(sheet);
  const lastRow = lastStatusMatrixDataRow(sheet, maxColumn);
  const rows = [];
  for (let row = STATUS_MATRIX_FIRST_DATA_ROW; row <= lastRow; row += 1) {
    const values = Array.from({ length: maxColumn }, (_, col) => jsonWorkbookCell(cellValue(sheet, row, col)));
    if (values.some((value) => cleanWorkbookText(value))) rows.push({ rowNumber: row + 1, values });
  }
  return {
    sheetName,
    headerRow: 1,
    firstDataRow: STATUS_MATRIX_FIRST_DATA_ROW + 1,
    maxColumn,
    serialColumn: 0,
    pointColumn: 1,
    columns: statusMatrixColumns(sheet, maxColumn),
    rows,
    layout: "status_matrix"
  };
}

async function appendStatusMatrixChecklistPoints(workbook, sheet, outputPath, sheetName, points) {
  const maxColumn = statusMatrixColumnCount(sheet);
  let appendRow = lastStatusMatrixDataRow(sheet, maxColumn) + 1;
  const styleRow = Math.max(appendRow - 1, STATUS_MATRIX_FIRST_DATA_ROW);
  let addedCount = 0;
  for (const point of points) {
    const text = cleanWorkbookText(point);
    if (!text) continue;
    writeWorkbookCell(sheet, appendRow, 0, text, cellAt(sheet, styleRow, 0));
    for (let col = 1; col < maxColumn; col += 1) {
      writeWorkbookCell(sheet, appendRow, col, "", cellAt(sheet, styleRow, col));
    }
    appendRow += 1;
    addedCount += 1;
  }
  await ensureDir(path.dirname(outputPath));
  XLSX.writeFile(workbook, outputPath, { cellStyles: true });
  return { savedPath: outputPath, sheetName, addedCount };
}

async function saveStatusMatrixSheetRevision(workbook, sheet, outputPath, sheetName, rows) {
  const maxColumn = statusMatrixColumnCount(sheet);
  const firstRow = STATUS_MATRIX_FIRST_DATA_ROW;
  const lastRow = lastStatusMatrixDataRow(sheet, maxColumn);
  const normalizedRows = normalizeChecklistRevisionRows(rows, maxColumn, -1);
  const clearEnd = Math.max(lastRow, firstRow + normalizedRows.length - 1);
  for (let row = firstRow; row <= clearEnd; row += 1) {
    for (let col = 0; col < maxColumn; col += 1) {
      delete sheet[XLSX.utils.encode_cell({ r: row, c: col })];
    }
  }
  const styleRow = firstRow <= lastRow ? firstRow : Math.max(firstRow - 1, 0);
  normalizedRows.forEach((values, rowIndex) => {
    const targetRow = firstRow + rowIndex;
    for (let col = 0; col < maxColumn; col += 1) {
      const sourceRow = firstRow <= lastRow ? Math.min(styleRow + rowIndex, lastRow) : styleRow;
      writeWorkbookCell(sheet, targetRow, col, worksheetTextValue(values[col]), cellAt(sheet, sourceRow, col));
    }
  });
  await ensureDir(path.dirname(outputPath));
  XLSX.writeFile(workbook, outputPath, { cellStyles: true });
  return { savedPath: outputPath, sheetName, updatedCount: normalizedRows.length };
}

function inspectChecklistWorkbook(workbookPath) {
  const workbook = XLSX.readFile(workbookPath, { cellDates: true, cellText: false, cellStyles: true });
  return {
    sheets: workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name];
      if (isChecklistStatusMatrixSheet(sheet)) {
        const maxColumn = statusMatrixColumnCount(sheet);
        const lastRow = lastStatusMatrixDataRow(sheet, maxColumn);
        let pointCount = 0;
        for (let row = STATUS_MATRIX_FIRST_DATA_ROW; row <= lastRow; row += 1) {
          if (cleanWorkbookText(cellValue(sheet, row, 0))) pointCount += 1;
        }
        return {
          name,
          maxRow: lastRow + 1,
          maxColumn,
          headerRow: 1,
          serialColumn: 0,
          pointColumn: 1,
          pointCount,
          layout: "status_matrix"
        };
      }
      const header = findChecklistHeader(sheet);
      let pointCount = 0;
      for (let row = header.headerRow + 1; row <= header.maxRow; row += 1) {
        if (cleanWorkbookText(cellValue(sheet, row, header.pointColumn))) pointCount += 1;
      }
      return {
        name,
        maxRow: header.maxRow,
        maxColumn: header.maxColumn,
        headerRow: header.headerRow + 1,
        serialColumn: header.serialColumn + 1,
        pointColumn: header.pointColumn + 1,
        pointCount,
        layout: "list"
      };
    })
  };
}

function readChecklistSheet(workbookPath, sheetName) {
  const workbook = XLSX.readFile(workbookPath, { cellDates: true, cellText: false, cellStyles: true });
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    const error = new Error(`Sheet "${sheetName}" was not found in the checklist workbook.`);
    error.statusCode = 404;
    throw error;
  }
  if (isChecklistStatusMatrixSheet(sheet)) {
    return readStatusMatrixChecklistSheet(sheet, sheetName);
  }
  const header = findChecklistHeader(sheet);
  const firstRow = firstChecklistDataRow(sheet, header);
  const lastRow = lastChecklistDataRow(sheet, header);
  const maxColumn = Math.max(header.maxColumn, header.serialColumn + 1, header.pointColumn + 1, 2);
  const columns = Array.from({ length: maxColumn }, (_, index) => cleanWorkbookText(cellValue(sheet, header.headerRow, index)) || `Column ${index + 1}`);
  const rows = [];
  for (let row = firstRow; row <= lastRow; row += 1) {
    const values = Array.from({ length: maxColumn }, (_, col) => jsonWorkbookCell(cellValue(sheet, row, col)));
    if (values.some((value) => cleanWorkbookText(value))) rows.push({ rowNumber: row + 1, values });
  }
  return {
    sheetName,
    headerRow: header.headerRow + 1,
    firstDataRow: firstRow + 1,
    maxColumn,
    serialColumn: header.serialColumn + 1,
    pointColumn: header.pointColumn + 1,
    columns,
    rows
  };
}

async function appendChecklistPoints(sourcePath, outputPath, sheetName, points) {
  const workbook = XLSX.readFile(sourcePath, { cellDates: true, cellText: false, cellStyles: true });
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Sheet "${sheetName}" was not found in the checklist workbook.`);
  if (isChecklistStatusMatrixSheet(sheet)) {
    return appendStatusMatrixChecklistPoints(workbook, sheet, outputPath, sheetName, points);
  }
  const header = findChecklistHeader(sheet);
  let appendRow = lastChecklistDataRow(sheet, header) + 1;
  let serial = nextChecklistSerial(sheet, header);
  const styleRow = Math.max(appendRow - 1, header.headerRow);
  let addedCount = 0;
  for (const point of points) {
    const text = cleanWorkbookText(point);
    if (!text) continue;
    writeWorkbookCell(sheet, appendRow, header.serialColumn, serial, cellAt(sheet, styleRow, header.serialColumn));
    writeWorkbookCell(sheet, appendRow, header.pointColumn, text, cellAt(sheet, styleRow, header.pointColumn));
    serial += 1;
    appendRow += 1;
    addedCount += 1;
  }
  await ensureDir(path.dirname(outputPath));
  XLSX.writeFile(workbook, outputPath, { cellStyles: true });
  return { savedPath: outputPath, sheetName, addedCount };
}

async function saveChecklistSheetRevision(sourcePath, outputPath, sheetName, rows) {
  const workbook = XLSX.readFile(sourcePath, { cellDates: true, cellText: false, cellStyles: true });
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Sheet "${sheetName}" was not found in the checklist workbook.`);
  if (isChecklistStatusMatrixSheet(sheet)) {
    return saveStatusMatrixSheetRevision(workbook, sheet, outputPath, sheetName, rows);
  }
  const header = findChecklistHeader(sheet);
  const firstRow = firstChecklistDataRow(sheet, header);
  const lastRow = lastChecklistDataRow(sheet, header);
  const maxColumn = Math.max(header.maxColumn, header.serialColumn + 1, header.pointColumn + 1, 2);
  const normalizedRows = normalizeChecklistRevisionRows(rows, maxColumn, header.serialColumn);
  const clearEnd = Math.max(lastRow, firstRow + normalizedRows.length - 1);
  for (let row = firstRow; row <= clearEnd; row += 1) {
    for (let col = 0; col < maxColumn; col += 1) {
      delete sheet[XLSX.utils.encode_cell({ r: row, c: col })];
    }
  }
  const styleRow = firstRow <= lastRow ? firstRow : header.headerRow;
  normalizedRows.forEach((values, rowIndex) => {
    const targetRow = firstRow + rowIndex;
    for (let col = 0; col < maxColumn; col += 1) {
      const value = col === header.serialColumn ? rowIndex + 1 : worksheetTextValue(values[col]);
      writeWorkbookCell(sheet, targetRow, col, value, cellAt(sheet, Math.min(styleRow + rowIndex, lastRow), col));
    }
  });
  await ensureDir(path.dirname(outputPath));
  XLSX.writeFile(workbook, outputPath, { cellStyles: true });
  return { savedPath: outputPath, sheetName, updatedCount: normalizedRows.length };
}

function findChecklistHeader(sheet) {
  const range = worksheetBounds(sheet);
  for (let row = 0; row <= Math.min(range.maxRow, 11); row += 1) {
    const values = [];
    for (let col = 0; col <= range.maxColumn; col += 1) {
      values.push(cleanWorkbookText(cellValue(sheet, row, col)).toLowerCase());
    }
    const serialIndex = values.findIndex((value) => ["s.no", "s no", "sr no", "serial no"].includes(value));
    const pointIndex = values.findIndex((value) => value.includes("check") && value.includes("point"));
    if (values.some(Boolean)) {
      return {
        headerRow: row,
        serialColumn: serialIndex >= 0 ? serialIndex : 0,
        pointColumn: pointIndex >= 0 ? pointIndex : 1,
        maxRow: range.maxRow,
        maxColumn: range.maxColumn + 1
      };
    }
  }
  return { headerRow: 0, serialColumn: 0, pointColumn: 1, maxRow: range.maxRow, maxColumn: range.maxColumn + 1 };
}

function worksheetBounds(sheet) {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:B1");
  return { minRow: range.s.r, maxRow: range.e.r, minColumn: range.s.c, maxColumn: range.e.c };
}

function firstChecklistDataRow(sheet, header) {
  for (let row = header.headerRow + 1; row <= header.maxRow; row += 1) {
    if (cleanWorkbookText(cellValue(sheet, row, header.serialColumn)) || cleanWorkbookText(cellValue(sheet, row, header.pointColumn))) return row;
  }
  return header.headerRow + 1;
}

function lastChecklistDataRow(sheet, header) {
  let lastRow = header.headerRow;
  for (let row = header.headerRow + 1; row <= header.maxRow; row += 1) {
    if (cleanWorkbookText(cellValue(sheet, row, header.serialColumn)) || cleanWorkbookText(cellValue(sheet, row, header.pointColumn))) lastRow = row;
  }
  return lastRow;
}

function nextChecklistSerial(sheet, header) {
  let serial = 0;
  for (let row = header.headerRow + 1; row <= header.maxRow; row += 1) {
    const value = Number(cellValue(sheet, row, header.serialColumn));
    if (Number.isFinite(value)) serial = Math.max(serial, Math.trunc(value));
  }
  return serial + 1;
}

function normalizeChecklistRevisionRows(rows, maxColumn, serialColumn) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const values = Array.isArray(row?.values) ? row.values : Array.isArray(row) ? row : [];
      return Array.from({ length: maxColumn }, (_, index) => cleanWorkbookText(values[index]));
    })
    .filter((values) => values.some((value, index) => index !== serialColumn && cleanWorkbookText(value)));
}

function worksheetTextValue(value) {
  const text = cleanWorkbookText(value);
  if (!text) return "";
  return text.startsWith("=") ? `'${text}` : text;
}

function jsonWorkbookCell(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return value;
  return cleanWorkbookText(value);
}

function cellAt(sheet, row, col) {
  return sheet[XLSX.utils.encode_cell({ r: row, c: col })];
}

function cellValue(sheet, row, col) {
  const cell = cellAt(sheet, row, col);
  return cell?.w ?? cell?.v ?? "";
}

function writeWorkbookCell(sheet, row, col, value, styleSource) {
  const address = XLSX.utils.encode_cell({ r: row, c: col });
  const nextCell = typeof value === "number" ? { t: "n", v: value } : { t: "s", v: String(value ?? "") };
  if (styleSource?.s) nextCell.s = JSON.parse(JSON.stringify(styleSource.s));
  sheet[address] = nextCell;
  expandWorkbookRange(sheet, row, col);
}

function expandWorkbookRange(sheet, row, col) {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:B1");
  range.s.r = Math.min(range.s.r, row);
  range.s.c = Math.min(range.s.c, col);
  range.e.r = Math.max(range.e.r, row);
  range.e.c = Math.max(range.e.c, col);
  sheet["!ref"] = XLSX.utils.encode_range(range);
}

function cleanWorkbookText(value) {
  return String(value ?? "").replace(/\r/g, " ").replace(/\n/g, " ").trim();
}

async function findAuthUser(username) {
  const requested = String(username || "").trim().toLowerCase();
  if (!requested) return null;
  return (await readAuthUsers()).find((user) => user.username.toLowerCase() === requested) || null;
}

async function requestActor(req) {
  const requested = String(
    req.body?.actorUserName ||
    req.query?.actorUserName ||
    req.body?.userName ||
    req.query?.userName ||
    BUILT_IN_ADMIN.username
  ).trim();
  const user = await findAuthUser(requested);
  if (!user) {
    const error = new Error("Login user context is required. Please sign in again.");
    error.statusCode = 401;
    throw error;
  }
  return {
    username: user.username,
    userType: user.userType || "User",
    isAdmin: isAdminUser(user)
  };
}

function isAdminUser(user) {
  return String(user?.username || "").trim().toLowerCase() === BUILT_IN_ADMIN.username.toLowerCase()
    || String(user?.userType || "").trim().toLowerCase() === "admin";
}

async function readAuthorizedProjectState(projectId, req) {
  const actor = await requestActor(req);
  const state = await readProjectState(projectId);
  assertProjectAccess(state, actor);
  return { state, actor };
}

function assertProjectAccess(state, actor) {
  if (canAccessProject(state, actor)) return;
  const error = new Error("You do not have access to this project.");
  error.statusCode = 403;
  throw error;
}

function canAccessProject(state, actor) {
  if (actor?.isAdmin) return true;
  const owner = projectOwnerUserName(state);
  return owner.toLowerCase() === String(actor?.username || "").trim().toLowerCase();
}

function projectOwnerUserName(state) {
  return String(
    state?.ownerUserName ||
    state?.createdByUserName ||
    state?.createdBy ||
    BUILT_IN_ADMIN.username
  ).trim() || BUILT_IN_ADMIN.username;
}

async function readAuthUsers() {
  const merged = new Map();
  const addUser = (user) => {
    const username = String(user?.username || "").trim();
    const password = String(user?.password || "");
    if (!username || !password) return;
    const key = username.toLowerCase();
    if (key === BUILT_IN_ADMIN.username.toLowerCase() && user.source !== "built-in") return;
    merged.set(key, {
      username,
      password,
      userType: String(user.userType || user.user_type || "User"),
      createdBy: String(user.createdBy || ""),
      createdAt: String(user.createdAt || ""),
      source: String(user.source || "server")
    });
  };

  addUser({ ...BUILT_IN_ADMIN, source: "built-in", createdBy: "system", createdAt: "" });
  for (const user of readWorkbookAuthUsers()) addUser(user);
  for (const user of await readStoredAuthUsers()) addUser(user);
  return [...merged.values()];
}

async function readStoredAuthUsers() {
  const users = await readJson(USER_STORE_PATH, []);
  if (!Array.isArray(users)) return [];
  return users
    .map((user) => ({
      username: String(user?.username || "").trim(),
      password: String(user?.password || ""),
      userType: String(user?.userType || "Admin Created User"),
      createdBy: String(user?.createdBy || BUILT_IN_ADMIN.username),
      createdAt: String(user?.createdAt || ""),
      source: "server"
    }))
    .filter((user) => user.username && user.password && user.username.toLowerCase() !== BUILT_IN_ADMIN.username.toLowerCase());
}

async function writeStoredAuthUsers(users) {
  const normalized = [];
  const seen = new Set();
  for (const user of users || []) {
    const username = String(user?.username || "").trim();
    const password = String(user?.password || "");
    const key = username.toLowerCase();
    if (!username || !password || key === BUILT_IN_ADMIN.username.toLowerCase() || seen.has(key)) continue;
    seen.add(key);
    normalized.push({
      username,
      password,
      userType: String(user?.userType || "Admin Created User"),
      createdBy: String(user?.createdBy || BUILT_IN_ADMIN.username),
      createdAt: String(user?.createdAt || new Date().toISOString()),
      source: "server"
    });
  }
  await writeJson(USER_STORE_PATH, normalized);
}

function readWorkbookAuthUsers() {
  if (!fs.existsSync(USER_PASSWORD_EXPORT_PATH)) return [];
  try {
    const workbook = XLSX.readFile(USER_PASSWORD_EXPORT_PATH, { cellDates: true, cellText: false });
    const sheetName = workbook.SheetNames.find((name) => name.toLowerCase().includes("user")) || workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" });
    const headerIndex = rows.findIndex((row) => row.some((cell) => /^username$/i.test(cleanWorkbookText(cell))));
    if (headerIndex < 0) return [];
    const headers = rows[headerIndex].map((cell) => normalizeAuthHeader(cell));
    const usernameIndex = headers.indexOf("username");
    const passwordIndex = headers.indexOf("password");
    const userTypeIndex = headers.indexOf("usertype");
    const createdByIndex = headers.indexOf("createdby");
    const createdAtIndex = headers.indexOf("createdat");
    if (usernameIndex < 0 || passwordIndex < 0) return [];
    return rows.slice(headerIndex + 1)
      .map((row) => ({
        username: cleanWorkbookText(row[usernameIndex]),
        password: String(row[passwordIndex] ?? ""),
        userType: cleanWorkbookText(row[userTypeIndex]) || "Admin Created User",
        createdBy: cleanWorkbookText(row[createdByIndex]),
        createdAt: cleanWorkbookText(row[createdAtIndex]),
        source: "workbook"
      }))
      .filter((user) => user.username && user.password);
  } catch (error) {
    console.warn(`Could not read UI user password workbook: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

function normalizeAuthHeader(value) {
  return cleanWorkbookText(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeExcelPdfDataOptions(input) {
  const checklistInput = normalizePathInput(input.checklistInput || input.checklist || input.checklistFolder, EXCEL_PDF_DEFAULTS.checklistInput);
  return {
    checklistInput,
    excelFolder: normalizePathInput(input.excelFolder, EXCEL_PDF_DEFAULTS.excelFolder),
    pdfFolder: normalizePathInput(input.pdfFolder, EXCEL_PDF_DEFAULTS.pdfFolder),
    selectedChecklistPath: normalizeOptionalPathInput(input.selectedChecklistPath || input.checklistPath || ""),
    selectedExcelPath: normalizeOptionalPathInput(input.selectedExcelPath || EXCEL_PDF_DEFAULTS.selectedExcelPath),
    selectedExcelPaths: normalizeOptionalPathInputs(input.selectedExcelPaths || []),
    selectedPdfPath: normalizeOptionalPathInput(input.selectedPdfPath || EXCEL_PDF_DEFAULTS.selectedPdfPath),
    selectedPdfPaths: normalizeOptionalPathInputs(input.selectedPdfPaths || []),
    projectName: String(input.projectName || "").trim(),
    userName: String(input.userName || "").trim(),
    compareCount: String(input.compareCount || EXCEL_PDF_DEFAULTS.compareCount).trim() || "all",
    pdfIndices: String(input.pdfIndices || "").trim(),
    recursive: Boolean(input.recursive),
    excelOnly: input.excelOnly !== undefined ? Boolean(input.excelOnly) : Boolean(EXCEL_PDF_DEFAULTS.excelOnly)
  };
}

function normalizePathInput(value, fallback) {
  const text = String(value || "").trim();
  return path.resolve(text || fallback);
}

function normalizeOptionalPathInput(value) {
  const text = String(value || "").trim();
  return text ? path.resolve(text) : "";
}

function normalizeOptionalPathInputs(value) {
  const values = Array.isArray(value) ? value : String(value || "").split("|");
  return values.map((item) => normalizeOptionalPathInput(item)).filter(Boolean);
}

function buildExcelPdfDataArgs(config) {
  const args = [];
  if (isChecklistWorkbook(config.checklistInput)) {
    args.push("--checklist", config.checklistInput);
  } else {
    args.push("--checklist-folder", config.checklistInput);
  }
  args.push("--excel-folder", config.excelFolder);
  args.push("--pdf-folder", config.pdfFolder);
  if (config.recursive) args.push("--recursive");
  if (config.pdfIndices) {
    args.push("--pdf-indices", config.pdfIndices);
  } else {
    args.push("--compare-count", config.compareCount || "all");
  }
  if (config.projectName) args.push("--project-name", config.projectName);
  if (config.userName) args.push("--reviewer-name", config.userName);
  args.push("--no-prompt");
  return args;
}

function isChecklistWorkbook(value) {
  return [".xlsx", ".xls"].includes(path.extname(String(value || "")).toLowerCase());
}

async function discoverExcelPdfDataInputs(config) {
  let [checklists, excelFiles, pdfFiles] = await Promise.all([
    listReviewFiles(config.checklistInput, [".xlsx", ".xls"], "Checklist", config.recursive),
    listReviewFiles(config.excelFolder, [".xlsx", ".xls", ".xlsm", ".xlsb"], "Excel", config.recursive),
    config.excelOnly ? Promise.resolve([]) : listReviewFiles(config.pdfFolder, [".pdf"], "PDF", config.recursive)
  ]);
  checklists = checklists.map(withChecklistRevision).sort(compareChecklistFiles);
  const selectedChecklistPath = selectExistingPath(
    checklists,
    config.selectedChecklistPath,
    ""
  );
  const selectedExcelPaths = selectExistingPaths(excelFiles, config.selectedExcelPaths, config.selectedExcelPath);
  const selectedPdfPaths = selectExistingPaths(pdfFiles, config.selectedPdfPaths, config.selectedPdfPath);
  return {
    checklists,
    excelFiles,
    pdfFiles,
    selected: {
      checklistPath: selectedChecklistPath,
      excelPath: selectedExcelPaths[0] || "",
      excelPaths: selectedExcelPaths,
      pdfPath: selectedPdfPaths[0] || "",
      pdfPaths: selectedPdfPaths
    },
    counts: {
      checklists: checklists.length,
      excelFiles: excelFiles.length,
      pdfFiles: pdfFiles.length
    }
  };
}

async function discoverExcelPdfDataInputsForActor(config, actor) {
  return discoverExcelPdfDataInputs(excelPdfConfigForActor(config, actor));
}

function excelPdfConfigForActor(config, actor) {
  if (actor?.isAdmin) return config;
  const emptyRoot = path.join(BROWSER_REVIEW_INPUT_ROOT, userReviewFolderName(actor?.username), "__empty__");
  const safeConfig = { ...config };
  safeConfig.checklistInput = reviewInputPathAllowedForActor(config.checklistInput, actor) ? config.checklistInput : emptyRoot;
  safeConfig.excelFolder = reviewInputPathAllowedForActor(config.excelFolder, actor) ? config.excelFolder : emptyRoot;
  safeConfig.pdfFolder = reviewInputPathAllowedForActor(config.pdfFolder, actor) ? config.pdfFolder : emptyRoot;
  safeConfig.selectedChecklistPath = reviewInputPathAllowedForActor(config.selectedChecklistPath, actor) ? config.selectedChecklistPath : "";
  safeConfig.selectedExcelPath = reviewInputPathAllowedForActor(config.selectedExcelPath, actor) ? config.selectedExcelPath : "";
  safeConfig.selectedExcelPaths = (config.selectedExcelPaths || []).filter((item) => reviewInputPathAllowedForActor(item, actor));
  safeConfig.selectedPdfPath = reviewInputPathAllowedForActor(config.selectedPdfPath, actor) ? config.selectedPdfPath : "";
  safeConfig.selectedPdfPaths = (config.selectedPdfPaths || []).filter((item) => reviewInputPathAllowedForActor(item, actor));
  return safeConfig;
}

function reviewInputPathAllowedForActor(value, actor) {
  if (!value) return false;
  if (actor?.isAdmin) return true;
  const userRoot = path.join(BROWSER_REVIEW_INPUT_ROOT, userReviewFolderName(actor?.username));
  return isInsidePath(userRoot, value);
}

async function resolveChecklistWorkbook(value, actor = null) {
  const resolved = normalizeOptionalPathInput(value);
  if (!resolved) {
    const error = new Error("Checklist workbook path is required.");
    error.statusCode = 400;
    throw error;
  }
  if (actor && !actor.isAdmin && !reviewInputPathAllowedForActor(resolved, actor)) {
    const error = new Error("You do not have access to this checklist workbook.");
    error.statusCode = 403;
    throw error;
  }
  const extension = path.extname(resolved).toLowerCase();
  if (extension !== ".xlsx") {
    const error = new Error("Checklist editing supports .xlsx checklist workbooks.");
    error.statusCode = 400;
    throw error;
  }
  const stat = await fsp.stat(resolved).catch(() => null);
  if (!stat?.isFile()) {
    const error = new Error("Selected checklist workbook was not found.");
    error.statusCode = 404;
    throw error;
  }
  return resolved;
}

function normalizeChecklistPoints(value) {
  const values = Array.isArray(value) ? value : String(value || "").split(/\r?\n/);
  return values.map((item) => String(item || "").trim()).filter(Boolean);
}

function normalizeChecklistGridRows(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      const values = Array.isArray(row) ? row : Array.isArray(row?.values) ? row.values : [];
      return values.map((cell) => (cell === null || cell === undefined ? "" : String(cell).trim()));
    })
    .filter((values) => values.some(Boolean));
}

function withChecklistRevision(file) {
  const revision = checklistRevisionForFile(file.name);
  const revisionLabel = `Rev ${revision.major}.${revision.minor}`;
  return {
    ...file,
    revisionMajor: revision.major,
    revisionMinor: revision.minor,
    revisionNumber: checklistRevisionSortValue(revision),
    revisionLabel,
    displayName: file.name
  };
}

function compareChecklistFiles(left, right) {
  const rootDiff = checklistBaseRoot(left.name).localeCompare(checklistBaseRoot(right.name));
  if (rootDiff) return rootDiff;
  const revisionDiff = Number(left.revisionNumber || 0) - Number(right.revisionNumber || 0);
  return revisionDiff || left.name.localeCompare(right.name);
}

function checklistRevisionForFile(fileName) {
  return parseChecklistRevision(fileName) || { major: 0, minor: 0 };
}

function parseChecklistRevision(fileName) {
  const match = String(fileName || "").match(/(?:^|[\s([])rev(?:ision)?\s*(\d+)\.(\d+)(?:[\])]|$)?/i);
  if (!match) return null;
  return {
    major: Number(match[1] || 0),
    minor: Number(match[2] || 0)
  };
}

function checklistBaseRoot(fileName) {
  const extension = path.extname(String(fileName || ""));
  const baseName = path.basename(String(fileName || ""), extension);
  return baseName
    .replace(/\s*[\[(]?\s*rev(?:ision)?\s*\d+\.\d+\s*[\])]?\s*$/i, "")
    .trim();
}

function checklistRevisionSortValue(revision) {
  return Number(revision.major || 0) * 11 + Number(revision.minor || 0);
}

function nextChecklistRevisionValue(revision) {
  const major = Number(revision.major || 0);
  const minor = Number(revision.minor || 0);
  if (minor >= 10) return { major: major + 1, minor: 0 };
  return { major, minor: minor + 1 };
}

async function pathExists(filePath) {
  return Boolean(await fsp.stat(filePath).catch(() => null));
}

async function nextChecklistRevisionPath(sourcePath) {
  const folder = path.dirname(sourcePath);
  const extension = path.extname(sourcePath) || ".xlsx";
  const baseRoot = checklistBaseRoot(sourcePath);
  const lowerRoot = baseRoot.toLowerCase();
  const entries = await fsp.readdir(folder, { withFileTypes: true }).catch(() => []);
  const revisions = [];
  for (const entry of entries) {
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== extension.toLowerCase()) continue;
    if (checklistBaseRoot(entry.name).toLowerCase() !== lowerRoot) continue;
    revisions.push(checklistRevisionForFile(entry.name));
  }
  if (!revisions.length) revisions.push(checklistRevisionForFile(path.basename(sourcePath)));
  let next = nextChecklistRevisionValue(
    revisions.reduce((best, current) => (checklistRevisionSortValue(current) > checklistRevisionSortValue(best) ? current : best), { major: 0, minor: 0 })
  );
  let outputPath = path.join(folder, `${baseRoot} (Rev ${next.major}.${next.minor})${extension}`);
  while (await pathExists(outputPath)) {
    next = nextChecklistRevisionValue(next);
    outputPath = path.join(folder, `${baseRoot} (Rev ${next.major}.${next.minor})${extension}`);
  }
  return {
    outputPath,
    revision: next,
    revisionLabel: `Rev ${next.major}.${next.minor}`
  };
}

function selectExistingPath(files, requestedPath, fallbackPath) {
  if (!requestedPath && !fallbackPath) return "";
  const requested = path.resolve(requestedPath || fallbackPath || "");
  return files.some((file) => path.resolve(file.path).toLowerCase() === requested.toLowerCase())
    ? requested
    : fallbackPath || "";
}

function selectExistingPaths(files, requestedPaths = [], requestedPath = "") {
  const requested = requestedPaths.length ? requestedPaths : requestedPath ? [requestedPath] : [];
  const selected = requested
    .map((item) => path.resolve(item))
    .filter((item) => files.some((file) => path.resolve(file.path).toLowerCase() === item.toLowerCase()));
  if (selected.length) return selected;
  return [];
}

async function listReviewFiles(inputPath, extensions, kind, recursive = false) {
  const resolved = path.resolve(inputPath);
  const extensionSet = new Set(extensions.map((extension) => extension.toLowerCase()));
  const results = [];
  const stat = await fsp.stat(resolved).catch(() => null);
  if (!stat) return results;

  if (stat.isFile()) {
    if (extensionSet.has(path.extname(resolved).toLowerCase())) {
      results.push(toReviewFile(resolved, kind, stat));
    }
    return results;
  }

  async function visit(folderPath) {
    const entries = await fsp.readdir(folderPath, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const fullPath = path.join(folderPath, entry.name);
      if (entry.isDirectory() && recursive) {
        await visit(fullPath);
      } else if (entry.isFile() && extensionSet.has(path.extname(entry.name).toLowerCase())) {
        const fileStat = await fsp.stat(fullPath).catch(() => null);
        if (fileStat) results.push(toReviewFile(fullPath, kind, fileStat));
      }
    }
  }

  await visit(resolved);
  return results.sort((left, right) => left.name.localeCompare(right.name));
}

async function listExcelPdfProjectRepository(projectName, userName = "", actor = null) {
  const projectSlug = slugify(projectName || "excel-pdf-data-review") || "excel-pdf-data-review";
  const projectFolder = projectFolderName(projectName || projectSlug);
  const repositoryRoots = await excelPdfRepositoryRootsForActor(projectFolder, userName, actor);
  if (!repositoryRoots.length) {
    const userFolder = actor?.isAdmin ? "" : userReviewFolderName(actor?.username || userName);
    const folderPath = path.join(EXCEL_PDF_REVIEW_OUTPUT_ROOT, userFolder, projectFolder);
    return {
      projectName: projectName || "",
      projectSlug,
      userName: userName || "",
      userFolder,
      projectFolder,
      folder: relativePath(AI_REVIEW_ROOT, folderPath),
      folderAbsolute: folderPath,
      exists: false,
      files: []
    };
  }

  const files = [];
  for (const root of repositoryRoots) {
    await collectProjectRepositoryFiles(root.folderPath, root.folderPath, root.folder, files);
  }

  files.sort((left, right) => {
    const timeDiff = new Date(right.modifiedAt).getTime() - new Date(left.modifiedAt).getTime();
    return timeDiff || left.name.localeCompare(right.name);
  });
  const latestFiles = latestRepositoryRunFiles(files);

  return {
    projectName: projectName || "",
    projectSlug,
    userName: userName || "",
    userFolder: repositoryRoots.length === 1 ? repositoryRoots[0].userFolder : "",
    projectFolder,
    folder: repositoryRoots.length === 1 ? repositoryRoots[0].folder : relativePath(AI_REVIEW_ROOT, EXCEL_PDF_REVIEW_OUTPUT_ROOT),
    folderAbsolute: repositoryRoots.length === 1 ? repositoryRoots[0].folderPath : EXCEL_PDF_REVIEW_OUTPUT_ROOT,
    exists: true,
    files: latestFiles
  };
}

async function excelPdfRepositoryRootsForActor(projectFolder, userName = "", actor = null) {
  if (actor?.isAdmin) {
    const targetUserFolder = userName && userName.toLowerCase() !== actor.username.toLowerCase() ? userReviewFolderName(userName) : "";
    if (targetUserFolder) {
      return repositoryRootIfExists(targetUserFolder, projectFolder);
    }
    return excelPdfResultFolderCandidates(projectFolder);
  }
  const targetUserFolder = userReviewFolderName(actor?.username || userName);
  if (userName && userReviewFolderName(userName).toLowerCase() !== targetUserFolder.toLowerCase()) {
    const error = new Error("You do not have access to this user's review files.");
    error.statusCode = 403;
    throw error;
  }
  return repositoryRootIfExists(targetUserFolder, projectFolder);
}

async function repositoryRootIfExists(userFolder, projectFolder) {
  const folderPath = path.join(EXCEL_PDF_REVIEW_OUTPUT_ROOT, userFolder, projectFolder);
  const stat = await fsp.stat(folderPath).catch(() => null);
  if (!stat?.isDirectory()) return [];
  return [{
    userFolder,
    folderPath,
    folder: relativePath(AI_REVIEW_ROOT, folderPath)
  }];
}

async function collectProjectRepositoryFiles(folderPath, projectRootPath, projectRootRelative, files) {
  const entries = await fsp.readdir(folderPath, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const fullPath = path.join(folderPath, entry.name);
    if (entry.isDirectory()) {
      await collectProjectRepositoryFiles(fullPath, projectRootPath, projectRootRelative, files);
      continue;
    }
    if (!entry.isFile()) continue;
    const fileStat = await fsp.stat(fullPath).catch(() => null);
    if (!fileStat) continue;
    const extension = path.extname(entry.name).toLowerCase();
    files.push({
      name: entry.name,
      displayName: reviewRepositoryDisplayName(entry.name),
      path: relativePath(AI_REVIEW_ROOT, fullPath),
      folder: relativePath(AI_REVIEW_ROOT, path.dirname(fullPath)) || projectRootRelative,
      projectFolder: projectRootRelative,
      categoryFolder: relativePath(projectRootPath, path.dirname(fullPath)),
      extension,
      artifactType: reviewArtifactType(entry.name),
      size: fileStat.size,
      modifiedAt: fileStat.mtime.toISOString(),
      canView: [".md", ".txt", ".pdf"].includes(extension),
      canDownload: true
    });
  }
}

function latestRepositoryRunFiles(files) {
  const visibleFiles = files.filter((file) => !file.name.toLowerCase().includes("ui-run-summary"));
  if (!visibleFiles.length) return [];
  const latestJson = visibleFiles.find((file) => file.extension === ".json");
  const latestWithRunId = latestJson || visibleFiles.find((file) => repositoryRunId(file.name));
  const latestRunId = repositoryRunId(latestWithRunId?.name || "");
  let latestFiles = [];
  if (latestRunId) {
    latestFiles = visibleFiles.filter((file) => repositoryRunId(file.name) === latestRunId);
  } else {
    const latestModifiedAt = new Date(visibleFiles[0].modifiedAt).getTime();
    latestFiles = visibleFiles.filter((file) => Math.abs(new Date(file.modifiedAt).getTime() - latestModifiedAt) < 2000);
  }

  return latestFiles
    .filter(isRepositoryVisibleOutputFile)
    .sort(compareRepositoryVisibleOutputFiles);
}

function isRepositoryVisibleOutputFile(file) {
  return [".pdf", ".txt"].includes(String(file.extension || "").toLowerCase());
}

function compareRepositoryVisibleOutputFiles(left, right) {
  const rank = (file) => {
    const name = String(file.name || "").toLowerCase();
    if (name.includes("excel-data-validation") || name.includes("pdf-data-validation")) return 1;
    if (name.includes("design-review")) return 2;
    if (name.endsWith(".txt")) return 3;
    return 9;
  };
  const rankDiff = rank(left) - rank(right);
  if (rankDiff) return rankDiff;
  return left.name.localeCompare(right.name);
}

function repositoryRunId(fileName) {
  const value = String(fileName || "");
  const localMatch = value.match(/\((\d{2}-\d{2}-\d{4}\s+\d{2}-\d{2}-\d{2})\)(-\d+)?/);
  if (localMatch) return `${localMatch[1]}${localMatch[2] || ""}`;
  return value.match(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z/)?.[0]
    || value.match(/\d{2}-\d{2}-\d{4}\s+\d{2}-\d{2}-\d{2}/)?.[0]
    || "";
}

function reviewRepositoryDisplayName(fileName) {
  const value = String(fileName || "");
  const isoMatch = value.match(/-?(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/);
  if (isoMatch) {
    const stamp = isoMatch[1];
    const date = new Date(stamp.replace(
      /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/,
      "$1T$2:$3:$4.$5Z"
    ));
    return value.replace(isoMatch[0], `(${formatLocalReviewTimestamp(date)})`);
  }
  return value.replace(/\((\d{2}-\d{2}-\d{4})\s+(\d{2})-(\d{2})-(\d{2})\)/, "($1 $2:$3:$4)");
}

function reviewArtifactType(fileName) {
  const lower = String(fileName || "").toLowerCase();
  if (lower.includes("design-check-matrix") && lower.endsWith(".xlsx")) return "Design matrix";
  if (lower.includes("data-validation-check-matrix") && lower.endsWith(".xlsx")) return "Data matrix";
  if (lower.includes("design-review") && lower.endsWith(".pdf")) return "Design review PDF";
  if (lower.includes("excel-data-validation") && lower.endsWith(".pdf")) return "Excel data validation PDF";
  if (lower.includes("pdf-data-validation") && lower.endsWith(".pdf")) return "PDF data validation PDF";
  if (lower.includes("design-review") && lower.endsWith(".md")) return "Design review";
  if (lower.includes("excel-data-validation") && lower.endsWith(".md")) return "Excel data validation";
  if (lower.includes("pdf-data-validation") && lower.endsWith(".md")) return "PDF data validation";
  if (lower.endsWith(".md")) return "Main review";
  if (lower.endsWith(".txt")) return "Text summary";
  if (lower.endsWith(".json") && lower.includes("ui-run-summary")) return "UI run summary";
  if (lower.endsWith(".json")) return "JSON result";
  return "Review file";
}

async function latestExcelPdfResultJsonPath(projectName, userName = "", actor = null) {
  const projectSlug = slugify(projectName || "excel-pdf-data-review") || "excel-pdf-data-review";
  const projectFolder = projectFolderName(projectName || projectSlug);
  const roots = actor
    ? await excelPdfRepositoryRootsForActor(projectFolder, userName, actor)
    : await excelPdfResultFolderCandidates(projectFolder);
  const jsonFiles = [];
  for (const root of roots) {
    await collectLatestReviewJsonFiles(root.folderPath, jsonFiles);
  }
  jsonFiles.sort((left, right) => right.modifiedAt - left.modifiedAt);
  if (!jsonFiles.length) {
    const error = new Error("No generated review JSON file is available for this project.");
    error.statusCode = 404;
    throw error;
  }
  return jsonFiles[0].path;
}

async function excelPdfResultFolderCandidates(projectFolder) {
  const roots = [];
  const rootProjectFolder = path.join(EXCEL_PDF_REVIEW_OUTPUT_ROOT, projectFolder);
  const rootStat = await fsp.stat(rootProjectFolder).catch(() => null);
  if (rootStat?.isDirectory()) {
    roots.push({
      userFolder: "",
      folderPath: rootProjectFolder,
      folder: relativePath(AI_REVIEW_ROOT, rootProjectFolder)
    });
  }
  const entries = await fsp.readdir(EXCEL_PDF_REVIEW_OUTPUT_ROOT, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === projectFolder) continue;
    const folderPath = path.join(EXCEL_PDF_REVIEW_OUTPUT_ROOT, entry.name, projectFolder);
    const stat = await fsp.stat(folderPath).catch(() => null);
    if (!stat?.isDirectory()) continue;
    roots.push({
      userFolder: entry.name,
      folderPath,
      folder: relativePath(AI_REVIEW_ROOT, folderPath)
    });
  }
  return roots;
}

async function collectLatestReviewJsonFiles(folderPath, jsonFiles) {
  const entries = await fsp.readdir(folderPath, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const fullPath = path.join(folderPath, entry.name);
    if (entry.isDirectory()) {
      await collectLatestReviewJsonFiles(fullPath, jsonFiles);
      continue;
    }
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".json") || entry.name.toLowerCase().includes("ui-run-summary")) {
      continue;
    }
    const stat = await fsp.stat(fullPath).catch(() => null);
    if (stat) jsonFiles.push({ path: fullPath, modifiedAt: stat.mtimeMs });
  }
}

function isExcelDataReviewResult(result) {
  const mode = String(result.agent?.mode || "").toLowerCase();
  return result.inputs?.pdf_files_required === false
    || mode.includes("excel_file")
    || mode.includes("excel_data")
    || mode.includes("cross_excel");
}

function buildExcelPdfReviewSummary(result, sourcePath) {
  const isExcelOnly = isExcelDataReviewResult(result);
  const designCounts = okNotOkNaCounts(result.design_summary?.counts || {});
  const dataCounts = matrixCounts(result.data_validation_check_matrix);
  const hierarchy = result.hierarchical_data_validation || {};
  const crossPdf = result.cross_pdf_data_validation || {};
  const crossExcel = result.excel_data_validation || result.cross_excel_data_validation || result.cross_pdf_data_validation || {};
  const crossSummaryCounts = reviewCrossReportSummaryCounts(result, crossExcel, crossPdf, isExcelOnly);
  const findings = reviewSummaryFindings(result);
  const evidenceRows = reviewSummaryEvidenceRows(result);
  const correctionObservations = reviewSummaryCorrectionObservations(result, findings);
  const individualChecklistVerifications = buildIndividualChecklistVerifications(result);
  const dateRange = isExcelOnly ? crossExcel.date_range_summary || reviewDateRangeSummary(result) : reviewDateRangeSummary(result);
  const designChecklistMessage = checklistAnalysisUnavailableMessage(result, "design");
  const dataChecklistMessage = checklistAnalysisUnavailableMessage(result, "data");

  return {
    sourcePath,
    projectName: result.project?.project_name || "",
    reviewerName: result.project?.reviewer_name || "",
    generatedAt: result.agent?.review_timestamp || "",
    dateRange,
    qualityChecks: [
      {
        id: "design-validation",
        label: "Excel design checklist validation",
        area: "Design",
        status: designCounts.notOk ? "Not OK" : designCounts.ok ? "OK" : "NA",
        ok: designCounts.ok,
        notOk: designCounts.notOk,
        na: designCounts.na,
        detail: designChecklistMessage || `${designCounts.ok} OK, ${designCounts.notOk} Not OK, ${designCounts.na} NA`
      },
      {
        id: "pdf-data-validation",
        label: isExcelOnly ? "Excel data validation matrix" : "PDF data validation matrix",
        area: "Data",
        status: dataCounts.notOk ? "Not OK" : dataCounts.ok ? "OK" : "NA",
        ok: dataCounts.ok,
        notOk: dataCounts.notOk,
        na: dataCounts.na,
        detail: dataChecklistMessage || `${dataCounts.ok} OK, ${dataCounts.notOk} Not OK, ${dataCounts.na} NA`
      },
      {
        id: "hierarchy-validation",
        label: "Hierarchy rollup validation",
        area: "Reconciliation",
        status: hierarchy.mismatch_count ? "Not OK" : hierarchy.section_count ? "OK" : "NA",
        ok: Number(hierarchy.match_count || 0),
        notOk: Number(hierarchy.mismatch_count || 0),
        na: Number(hierarchy.insufficient_context_count || 0),
        detail: `${hierarchy.section_count || 0} section(s), ${hierarchy.mismatch_count || 0} mismatch(es)`
      },
      {
        id: "cross-pdf-validation",
        label: isExcelOnly ? "Cross-Excel comparison" : "Cross-PDF comparison",
        area: "Consistency",
        status: crossSummaryCounts.notOk ? "Not OK" : crossSummaryCounts.ok ? "OK" : "NA",
        ok: crossSummaryCounts.ok,
        notOk: crossSummaryCounts.notOk,
        na: crossSummaryCounts.na,
        detail: isExcelOnly
          ? `${crossSummaryCounts.ok} match(es), ${crossSummaryCounts.notOk} mismatch(es), ${crossExcel.skipped_cross_family_pair_count || 0} cross-family pair(s) skipped`
          : `${crossPdf.pair_count || 0} pair(s), ${crossSummaryCounts.notOk} mismatch(es)`
      },
      {
        id: "findings-summary",
        label: "Generated findings",
        area: "Findings",
        status: findings.some((item) => item.severity === "high") ? "Not OK" : findings.length ? "Review" : "OK",
        ok: Math.max(0, findings.length - findings.filter((item) => item.severity === "high").length),
        notOk: findings.filter((item) => item.severity === "high").length,
        na: 0,
        detail: `${findings.length} generated finding(s)`
      },
      {
        id: "review-output",
        label: "Review files generated",
        area: "Output",
        status: result.paths?.json ? "OK" : "NA",
        ok: Object.values(result.paths || {}).filter(Boolean).length,
        notOk: 0,
        na: 0,
        detail: result.paths?.folder || "-"
      }
    ],
    findings,
    individualChecklistVerifications,
    correctionObservations,
    evidenceRows
  };
}

function checklistAnalysisUnavailableMessage(result, purpose) {
  const analysis = result.inputs?.checklist_sheet_analysis?.[purpose];
  if (!analysis || analysis.available !== false) return "";
  const fallback = purpose === "data"
    ? "Data related checklist sheet not available in the selected checklist workbook."
    : "Design related checklist sheet not available in the selected checklist workbook.";
  const analyzedSheets = (analysis.analyzedSheets || [])
    .map((sheet) => `${sheet.sheetName || "-"} (${sheet.pointCount || 0} point(s))`)
    .join(", ");
  return analyzedSheets
    ? `${analysis.message || fallback} Analyzed sheets: ${analyzedSheets}.`
    : analysis.message || fallback;
}

function reviewCrossReportSummaryCounts(result, crossExcel = {}, crossPdf = {}, isExcelOnly = false) {
  if (!isExcelOnly) {
    const pairwise = crossPdf.pairwise || crossPdf.pairs || [];
    if (pairwise.length) return crossReportCountsFromPairwise(pairwise);
    const normalizedRows = normalizeReviewEvidenceRows(result, crossPdf.evidence_rows || []);
    if (normalizedRows.length) return statusCountsFromEvidenceRows(normalizedRows);
    return {
      ok: Number(crossPdf.match_count || 0),
      notOk: Number(crossPdf.mismatch_count || 0),
      na: Number(crossPdf.insufficient_context_pair_count || 0)
    };
  }

  const pairwise = crossExcel.pairwise || crossExcel.pairs || [];
  if (!pairwise.length) {
    const normalizedRows = normalizeReviewEvidenceRows(result, crossExcel.evidence_rows || []);
    if (normalizedRows.length) return statusCountsFromEvidenceRows(normalizedRows);
    return {
      ok: Number(crossExcel.match_count || 0),
      notOk: Number(crossExcel.mismatch_count || 0),
      na: Number(crossExcel.insufficient_context_pair_count || crossExcel.insufficient_context_count || 0)
    };
  }

  return crossReportCountsFromPairwise(pairwise);
}

function statusCountsFromEvidenceRows(rows = []) {
  return {
    ok: rows.filter((row) => /^match$/i.test(String(row.status || ""))).length,
    notOk: rows.filter((row) => isMismatchStatus(row.status)).length,
    na: rows.filter((row) => /^NA$/i.test(String(row.status || ""))).length
  };
}

function crossReportCountsFromPairwise(pairwise = []) {
  const counts = { ok: 0, notOk: 0, na: 0 };
  for (const pair of pairwise) {
    const comparisons = pair.comparisons || [];
    if (!comparisons.length) {
      const state = String(pair.state || "").toLowerCase();
      if (state === "match") counts.ok += 1;
      else if (isMismatchStatus(state)) counts.notOk += 1;
      else counts.na += 1;
      continue;
    }
    for (const comparison of comparisons) {
      const row = {
        metric: pairwiseComparisonMetricLabel(pair, comparison),
        excel: labeledComparisonValue(pair.left_report, "Report 1", comparison.left_display_value ?? comparison.left_value),
        pdf: labeledComparisonValue(pair.right_report, "Report 2", comparison.right_display_value ?? comparison.right_value),
        status: comparison.state || pair.state || "-"
      };
      if (isInvalidSaifiSaidiDirectHierarchyEvidence(row)) counts.na += 1;
      else if (/^match$/i.test(String(row.status || ""))) counts.ok += 1;
      else if (isMismatchStatus(row.status)) counts.notOk += 1;
      else counts.na += 1;
    }
  }
  return counts;
}

async function loadLatestExcelPdfReviewSummaryForProject(state) {
  const candidates = [...new Set([state.projectName, state.projectId].filter(Boolean))];
  for (const candidate of candidates) {
    try {
      const sourcePath = await latestExcelPdfResultJsonPath(candidate);
      const payload = await readJson(sourcePath, null);
      if (payload) return buildExcelPdfReviewSummary(payload, relativePath(AI_REVIEW_ROOT, sourcePath));
    } catch {
      // Review files are optional for the generic phase runner.
    }
  }
  return null;
}

function okNotOkNaCounts(counts = {}) {
  const ok = Number(counts.pass || 0);
  const na = Number(counts.not_applicable || 0);
  const notOk = Number(counts.fail || 0) + Number(counts.manual_review_required || 0) + Number(counts.insufficient_evidence || 0);
  return { ok, notOk, na };
}

function matrixCounts(matrix = {}) {
  const counts = { ok: 0, notOk: 0, na: 0 };
  for (const row of matrix.rows || []) {
    for (const status of Object.values(row.statuses || {})) {
      const display = String(status?.display || "").toUpperCase();
      if (display === "OK") counts.ok += 1;
      else if (display === "NA") counts.na += 1;
      else if (display) counts.notOk += 1;
    }
  }
  return counts;
}

function matrixColumns(matrix = {}) {
  if ((matrix.columns || []).length) return matrix.columns;
  const columns = [];
  const seen = new Set();
  for (const row of matrix.rows || []) {
    for (const key of Object.keys(row.statuses || {})) {
      if (seen.has(key)) continue;
      seen.add(key);
      columns.push({
        key,
        report_name: key,
        detected_report_name: key,
        excel_design_file: "",
        pdf_file: ""
      });
    }
  }
  return columns;
}

function matrixStatusEvidenceText(status = {}, row = {}) {
  const evidence = status.evidence ?? row.remarks ?? "";
  return Array.isArray(evidence) ? evidence.filter(Boolean).join(" ") : String(evidence || "");
}

function matrixVerificationRows(matrix = {}, area = "Review") {
  const columns = matrixColumns(matrix);
  const rows = [];
  for (const row of matrix.rows || []) {
    for (const column of columns) {
      const status = row.statuses?.[column.key];
      if (!status) continue;
      rows.push({
        point: rows.length + 1,
        checklistSNo: row.checklist_s_no || row.s_no || "",
        checklistRowNumber: row.checklist_row_number || "",
        report: column.detected_report_name || column.report_name || column.excel_design_file || column.pdf_file || column.key,
        area,
        section: row.section || "",
        state: status.display || status.raw_status || status.status || "-",
        checkPoint: row.check_point || "",
        evidence: cleanObservationText(matrixStatusEvidenceText(status, row))
      });
    }
  }
  return rows;
}

function verificationCounts(rows = []) {
  const counts = { ok: 0, notOk: 0, na: 0 };
  for (const row of rows) {
    const state = String(row.state || "").replace(/_/g, " ").toUpperCase();
    if (state === "OK" || state === "PASS") counts.ok += 1;
    else if (state === "NA" || state === "NOT APPLICABLE") counts.na += 1;
    else if (state) counts.notOk += 1;
  }
  return counts;
}

function normalizeIndividualVerificationGroup(group = {}) {
  const rows = (group.rows || []).map((row, index) => ({
    point: row.point || index + 1,
    checklistSNo: row.checklistSNo || row.checklist_s_no || row.s_no || "",
    checklistRowNumber: row.checklistRowNumber || row.checklist_row_number || "",
    report: row.report || "",
    area: row.area || group.area || "",
    section: row.section || "",
    state: row.state || row.raw_status || "-",
    checkPoint: row.checkPoint || row.check_point || "",
    evidence: cleanObservationText(row.evidence || row.observation || "")
  }));
  const counts = verificationCounts(rows);
  return {
    id: group.id || slugify(`${group.area || group.title || "checklist"} verification`),
    title: group.title || `${group.area || "Checklist"} Individual Checklist Verification`,
    area: group.area || "",
    ok: Number(group.ok ?? counts.ok),
    notOk: Number(group.notOk ?? group.not_ok ?? counts.notOk),
    na: Number(group.na ?? counts.na),
    rows
  };
}

function buildIndividualChecklistVerifications(result) {
  const savedGroups = result.individual_checklist_verification?.groups;
  if (Array.isArray(savedGroups) && savedGroups.length) {
    return savedGroups.map(normalizeIndividualVerificationGroup).filter((group) => group.rows.length);
  }
  return [
    normalizeIndividualVerificationGroup({
      id: "design-individual-checklist-verification",
      title: "Design Individual Checklist Verification",
      area: "Design",
      rows: matrixVerificationRows(result.design_check_matrix, "Design")
    }),
    normalizeIndividualVerificationGroup({
      id: "data-individual-checklist-verification",
      title: "Data Individual Checklist Verification",
      area: "Data",
      rows: matrixVerificationRows(result.data_validation_check_matrix, "Data")
    })
  ].filter((group) => group.rows.length);
}

function reviewDateRangeSummary(result) {
  const isExcelOnly = isExcelDataReviewResult(result);
  const sourcePlural = isExcelOnly ? "selected Excel reports" : "selected PDFs";
  const reports = [];
  const primaryDates = [];
  for (const observation of result.report_wise_observations || []) {
    const report = observation.report || {};
    const dataProfile = observation.pdf_data_validation?.data_profile || {};
    const period = dataProfile.period || {};
    const bucketProfile = dataProfile.bucket_profile || {};
    const display = periodDisplay(period);
    const dateToken = firstDateToken(period.from, period.display, display, bucketProfile.first_bucket);
    if (dateToken) primaryDates.push(dateToken);
    reports.push({
      report: report.name || dataProfile.report_name || report.excel_design_file || report.pdf_file || (isExcelOnly ? "Excel report" : "PDF report"),
      pdfFile: report.excel_design_file || report.pdf_file || dataProfile.excel_path || dataProfile.pdf_file || "",
      periodType: period.type || "",
      from: period.from || "",
      to: period.to || "",
      display,
      validationDate: dateToken || "",
      bucketStart: bucketProfile.first_bucket || "",
      bucketEnd: bucketProfile.last_bucket || "",
      intervalMinutes: bucketProfile.interval_minutes ?? null,
      missingBucketCount: Number(bucketProfile.missing_bucket_count || 0)
    });
  }

  const uniqueDates = [...new Set(primaryDates)];
  const crossPdf = isExcelOnly
    ? result.excel_data_validation || result.cross_excel_data_validation || {}
    : result.cross_pdf_data_validation || {};
  let status = "not_detected";
  let display = `Date range not detected in the ${sourcePlural}.`;
  if (uniqueDates.length === 1) {
    status = "match";
    display = `Validation date matched across ${sourcePlural}: ${uniqueDates[0]}.`;
  } else if (uniqueDates.length > 1) {
    status = "mismatch";
    display = `${isExcelOnly ? "Excel" : "PDF"} date ranges differ across selected files: ${uniqueDates.join(", ")}.`;
  }

  return {
    status,
    display,
    reports,
    crossPdf: {
      selectedPdfCount: Number(crossPdf.selected_pdf_count || crossPdf.selected_excel_count || result.run?.selected_excel_count || 0),
      pairCount: Number(crossPdf.pair_count || crossPdf.comparison_count || 0),
      matchCount: Number(crossPdf.match_count || 0),
      mismatchCount: Number(crossPdf.mismatch_count || 0),
      insufficientContextPairCount: Number(crossPdf.insufficient_context_pair_count || crossPdf.insufficient_context_count || 0)
    }
  };
}

function periodDisplay(period = {}) {
  if (period.display) return String(period.display);
  if (period.from && period.to) return `${period.from} to ${period.to}`;
  if (period.from) return String(period.from);
  if (period.to) return String(period.to);
  return "Not detected";
}

function firstDateToken(...values) {
  for (const value of values) {
    const match = String(value || "").match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/);
    if (!match) continue;
    const day = match[1].padStart(2, "0");
    const month = match[2].padStart(2, "0");
    return `${day}-${month}-${match[3]}`;
  }
  return "";
}

function reviewSummaryFindings(result) {
  const isExcelOnly = isExcelDataReviewResult(result);
  const findings = [];
  for (const row of result.design_check_matrix?.rows || []) {
    const badStatuses = Object.values(row.statuses || {}).filter((status) => String(status?.display || "").toUpperCase() === "NOT OK");
    if (!badStatuses.length) continue;
    findings.push({
      checkId: "design-validation",
      severity: "high",
      area: row.section || "Design",
      finding: row.check_point || "Design checklist item failed.",
      evidence: row.remarks || badStatuses.map((status) => status.evidence).filter(Boolean).join(" "),
      recommendation: "Review the matching Excel design workbook and update the report design or checklist evidence."
    });
  }
  for (const row of result.data_validation_check_matrix?.rows || []) {
    const badStatuses = Object.values(row.statuses || {}).filter((status) => String(status?.display || "").toUpperCase() === "NOT OK");
    if (!badStatuses.length) continue;
    findings.push({
      checkId: "pdf-data-validation",
      severity: "high",
      area: row.section || (isExcelOnly ? "Excel Data" : "PDF Data"),
      finding: row.check_point || (isExcelOnly ? "Excel data validation item failed." : "PDF data validation item failed."),
      evidence: row.remarks || badStatuses.map((status) => status.evidence).filter(Boolean).join(" "),
      recommendation: isExcelOnly
        ? "Inspect the generated Excel data validation matrix and resolve the mismatched checklist item."
        : "Inspect the generated PDF data validation markdown and resolve the mismatched checklist item."
    });
  }
  for (const section of result.hierarchical_data_validation?.sections || []) {
    if (section.state !== "mismatch") continue;
    findings.push({
      checkId: "hierarchy-validation",
      severity: "high",
      area: section.section || "Hierarchy",
      finding: `${section.mismatch_count || 0} hierarchy mismatch(es) found.`,
      evidence: `${section.base_report || section.child_report || "Source report"} vs ${section.rollup_report || section.parent_report || "rollup report"}.`,
      recommendation: "Review rollup grouping and source totals for the mismatched hierarchy section."
    });
  }
  for (const finding of result.cross_pdf_data_validation?.findings || []) {
    findings.push({
      checkId: "cross-pdf-validation",
      severity: finding.severity || "high",
      area: finding.source || (isExcelOnly ? "Cross-Excel Data" : "Cross-PDF"),
      finding: finding.message || (isExcelOnly ? "Cross-Excel mismatch found." : "Cross-PDF mismatch found."),
      evidence: finding.evidence || "",
      recommendation: "Review the pairwise comparison details in the generated review files."
    });
  }
  if (!findings.length) {
    findings.push({
      checkId: "findings-summary",
      severity: "info",
      area: "Review",
      finding: "No Not OK findings were produced in the latest review output.",
      evidence: `Review timestamp: ${result.agent?.review_timestamp || "-"}.`,
      recommendation: "Use the review file repository for the complete generated packet."
    });
  }
  return findings.slice(0, 60);
}

function reviewSummaryCorrectionObservations(result, findings = []) {
  const isExcelOnly = isExcelDataReviewResult(result);
  const observations = [];
  const seen = new Set();
  const addObservation = ({
    severity = "medium",
    area = "Review",
    report = "",
    title = "",
    detail = "",
    recommendation = "",
    point = "",
    checklistSNo = "",
    state = "",
    checkPoint = "",
    observation = "",
    correctionRequired = ""
  }) => {
    const cleanTitle = cleanObservationText(title);
    const cleanDetail = cleanObservationText(detail);
    const cleanObservation = cleanObservationText(observation);
    const cleanCorrectionRequired = cleanObservationText(correctionRequired || recommendation);
    if (!cleanTitle && !cleanDetail && !cleanObservation) return;
    const duplicateReportScope = /\bvs\b/i.test(cleanTitle) ? "" : report;
    const key = `${area}|${duplicateReportScope}|${checklistSNo}|${cleanTitle}|${cleanDetail}|${cleanObservation}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    observations.push({
      severity: String(severity || "medium").toLowerCase(),
      area,
      report,
      title: cleanTitle || "Correction observation found in review output.",
      detail: cleanDetail,
      recommendation: cleanCorrectionRequired || defaultCorrectionRecommendation(area),
      point: point || observations.length + 1,
      checklistSNo: cleanObservationText(checklistSNo),
      state: cleanObservationText(state),
      checkPoint: cleanObservationText(checkPoint || cleanTitle),
      observation: cleanObservation || cleanDetail,
      correctionRequired: cleanCorrectionRequired || defaultCorrectionRecommendation(area)
    });
  };

  const dataColumns = result.data_validation_check_matrix?.columns || [];
  const reportNameByKey = new Map(dataColumns.map((column) => [
    column.key,
    column.detected_report_name || column.report_name || column.pdf_file || column.key
  ]));
  for (const row of result.data_validation_check_matrix?.rows || []) {
    for (const [statusKey, status] of Object.entries(row.statuses || {})) {
      if (!isMismatchStatus(status?.display || status?.raw_status)) continue;
      const reportName = reportNameByKey.get(statusKey) || statusKey;
      const evidence = dataChecklistObservationText(status?.evidence || row.remarks || "");
      addObservation({
        severity: "high",
        area: "Data",
        report: reportName,
        title: row.check_point || "Data validation checklist point requires correction.",
        detail: evidence,
        recommendation: dataChecklistCorrectionRequired(row.check_point, evidence),
        checklistSNo: row.checklist_s_no || row.s_no || "",
        state: status?.display || status?.raw_status || "Not OK",
        checkPoint: row.check_point || "",
        observation: evidence,
        correctionRequired: dataChecklistCorrectionRequired(row.check_point, evidence)
      });
    }
  }

  const designColumns = result.design_check_matrix?.columns || [];
  const designReportNameByKey = new Map(designColumns.map((column) => [
    column.key,
    column.detected_report_name || column.report_name || column.excel_design_file || column.pdf_file || column.key
  ]));
  for (const row of result.design_check_matrix?.rows || []) {
    for (const [statusKey, status] of Object.entries(row.statuses || {})) {
      if (!isMismatchStatus(status?.display || status?.raw_status)) continue;
      const reportName = designReportNameByKey.get(statusKey) || statusKey;
      const evidence = dataChecklistObservationText(status?.evidence || row.remarks || "");
      addObservation({
        severity: status?.severity || "medium",
        area: "Design",
        report: reportName,
        title: row.check_point || "Design checklist point requires correction.",
        detail: evidence,
        recommendation: "Correct the Excel report design issue or document accepted design evidence before sign-off.",
        checklistSNo: row.checklist_s_no || row.s_no || "",
        state: status?.display || status?.raw_status || "Not OK",
        checkPoint: row.check_point || "",
        observation: evidence,
        correctionRequired: "Correct the Excel report design issue or document accepted design evidence before sign-off."
      });
    }
  }

  if (observations.length) return observations;

  for (const observation of result.report_wise_observations || []) {
    const reportName = observation.report?.name || observation.report?.excel_design_file || observation.report?.pdf_file || "";
    for (const finding of observation.design_validation?.findings || []) {
      addObservation({
        severity: finding.severity || "medium",
        area: "Design",
        report: reportName,
        title: finding.message || "Design correction observation.",
        detail: [finding.section && `Section: ${finding.section}`, finding.checklist_s_no && `Checklist S.No: ${finding.checklist_s_no}`].filter(Boolean).join("; "),
        recommendation: "Correct the Excel report design or document accepted design evidence before sign-off."
      });
    }

    for (const finding of observation.pdf_data_validation?.findings || []) {
      addObservation({
        severity: finding.severity || "high",
        area: "Data",
        report: reportName,
        title: finding.message || "Data correction observation.",
        detail: finding.evidence || finding.source || "",
        recommendation: "Correct the mismatched data point or document approved exception evidence."
      });
    }

    for (const pair of observation.pdf_data_validation?.cross_pdf_validation?.pairs || []) {
      if (String(pair.state || "").toLowerCase() !== "mismatch") continue;
      addObservation({
        severity: "high",
        area: "Consistency",
        report: reportName,
        title: `${pair.pair || "Cross-report comparison"} has mismatched values.`,
        detail: pair.evidence || "",
        recommendation: "Review the row-level comparison evidence and correct the source report values."
      });
    }
  }

  for (const report of result.pdf_excel_data_validation?.reports || []) {
    if (!isMismatchStatus(report.state) && !Number(report.mismatch_count || report.value_mismatch_count || report.row_mismatch_count || 0)) continue;
    addObservation({
      severity: "high",
      area: "Data",
      report: report.report || report.excel_file || report.pdf_file || "",
      title: `${report.report || "Report"} has data validation mismatch observations.`,
      detail: [
        report.evidence,
        Number(report.value_mismatch_count || 0) ? `Value mismatches: ${report.value_mismatch_count}` : "",
        Number(report.row_mismatch_count || 0) ? `Row mismatches: ${report.row_mismatch_count}` : ""
      ].filter(Boolean).join(" "),
      recommendation: "Correct the mismatched report data or document approved exception evidence."
    });
  }

  for (const finding of result.pdf_excel_data_validation?.findings || []) {
    addObservation({
      severity: finding.severity || "high",
      area: "Data",
      report: finding.report || "",
      title: finding.message || "Excel data correction observation.",
      detail: finding.evidence || "",
      recommendation: "Review the Excel data validation review file and correct the source report values."
    });
  }

  for (const pair of result.cross_pdf_data_validation?.pairwise || []) {
    for (const comparison of pair.comparisons || []) {
      if (!isMismatchStatus(comparison.state)) continue;
      addObservation({
        severity: "high",
        area: "Data",
        report: [pair.left_report, pair.right_report].filter(Boolean).join(" vs "),
        title: pairwiseComparisonMetricLabel(pair, comparison),
        detail: [
          labeledComparisonValue(pair.left_report, "Report 1", comparison.left_display_value ?? comparison.left_value),
          labeledComparisonValue(pair.right_report, "Report 2", comparison.right_display_value ?? comparison.right_value),
          comparison.row_label ? `Row/date: ${comparison.row_label}` : "",
          comparison.metric ? `Metric: ${humanizeMetricName(comparison.metric)}` : ""
        ].filter(Boolean).join(" | "),
        recommendation: "Correct the mismatched data value in the source report or attach accepted exception evidence."
      });
    }
  }

  for (const finding of result.cross_pdf_data_validation?.findings || []) {
    addObservation({
      severity: finding.severity || "high",
      area: finding.source || (isExcelOnly ? "Cross-Excel Data" : "Consistency"),
      title: finding.message || "Cross-report correction observation.",
      detail: finding.evidence || "",
      recommendation: "Review the pairwise comparison details in the generated review files."
    });
  }

  for (const finding of findings || []) {
    if (String(finding.severity || "").toLowerCase() === "info") continue;
    addObservation({
      severity: finding.severity || "medium",
      area: finding.area || "Review",
      title: finding.finding || "Correction observation.",
      detail: finding.evidence || "",
      recommendation: finding.recommendation || ""
    });
  }

  if (!observations.length) {
    addObservation({
      severity: "info",
      area: "Review",
      title: "No correction observations were produced in the latest review files.",
      detail: `Review timestamp: ${result.agent?.review_timestamp || "-"}.`,
      recommendation: "Keep the generated review packet as approval evidence."
    });
  }

  return balancedCorrectionObservations(observations, 80);
}

function balancedCorrectionObservations(observations = [], limit = 80) {
  const design = observations.filter((observation) => isDesignCorrectionObservation(observation));
  const data = observations.filter((observation) => !isDesignCorrectionObservation(observation));
  if (!design.length || !data.length) return observations.slice(0, limit);

  const designLimit = Math.min(design.length, Math.max(16, Math.floor(limit * 0.35)));
  const dataLimit = Math.max(0, Math.min(data.length, limit - designLimit));
  const remainingLimit = Math.max(0, limit - dataLimit - designLimit);
  return [
    ...data.slice(0, dataLimit),
    ...design.slice(0, designLimit),
    ...observations
      .filter((observation) => !data.includes(observation) && !design.includes(observation))
      .slice(0, remainingLimit)
  ];
}

function isDesignCorrectionObservation(observation = {}) {
  const text = `${observation.area || ""} ${observation.title || ""} ${observation.checkPoint || ""}`.toLowerCase();
  return text.includes("design");
}

function dataChecklistObservationText(value) {
  let text = cleanObservationText(value).replace(/\bAmbiguity:\s*/gi, "");
  if (/Mismatch detail:/i.test(text)) {
    text = text.replace(/\s*Mismatch detail:.*$/i, " Full mismatch values are listed in Pair Mismatch Detail.");
  }
  return text;
}

function dataChecklistCorrectionRequired(checkPoint, observation) {
  const text = `${checkPoint || ""} ${observation || ""}`.toLowerCase();
  if (text.includes("dash") || text.includes("blank")) {
    return "Replace incorrect blank/dash values or align missing rows so comparable reports show the same visible value.";
  }
  if (text.includes("power factor") || text.includes("outside normal range") || text.includes("configured normal range")) {
    return "Review the out-of-range value or supply the correct configured range/rating for this metric.";
  }
  if (text.includes("cumulative") || text.includes("decrease")) {
    return "Correct the cumulative meter-reading sequence so values do not decrease across increasing date-time buckets.";
  }
  if (text.includes("numeric values should match") || text.includes("cross-excel") || text.includes("mismatch")) {
    return "Correct the mismatched numeric values and add or align missing date-time rows so comparable reports show the same visible value.";
  }
  if (text.includes("date-time") || text.includes("bucket") || text.includes("missing timestamp")) {
    return "Correct the source report so all expected date-time rows/buckets are present for the selected period.";
  }
  return "Correct the source report value or document approved exception evidence before sign-off.";
}

function cleanObservationText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function defaultCorrectionRecommendation(area) {
  const normalized = String(area || "").toLowerCase();
  if (normalized.includes("data") || normalized.includes("consistency")) return "Correct the source values or document accepted mismatch evidence.";
  if (normalized.includes("design")) return "Correct the report design or document accepted design evidence.";
  return "Review the generated packet and close the observation with evidence.";
}

function reviewSummaryEvidenceRows(result) {
  const hierarchyRows = hierarchyEvidenceRowsFromValidation(result.hierarchical_data_validation);
  if (hierarchyRows.length) {
    return hierarchyRows;
  }

  if (Array.isArray(result.excel_data_validation?.evidence_rows) && result.excel_data_validation.evidence_rows.length) {
    return prioritizedEvidenceRows(normalizeReviewEvidenceRows(result, result.excel_data_validation.evidence_rows), 200);
  }

  const pairRows = [];
  for (const pair of result.cross_pdf_data_validation?.pairwise || []) {
    for (const comparison of pair.comparisons || []) {
      pairRows.push({
        metric: pairwiseComparisonMetricLabel(pair, comparison),
        excel: labeledComparisonValue(pair.left_report, "Left report", comparison.left_display_value ?? comparison.left_value),
        pdf: labeledComparisonValue(pair.right_report, "Right report", comparison.right_display_value ?? comparison.right_value),
        status: comparison.state || pair.state || "-"
      });
    }
  }
  if (pairRows.length) return prioritizedEvidenceRows(normalizeReviewEvidenceRows(result, pairRows), 200);

  const rows = [];
  for (const section of result.hierarchical_data_validation?.sections || []) {
    for (const group of section.groups || []) {
      for (const comparison of group.comparisons || []) {
        rows.push({
          metric: comparison.metric || group.group_display || section.section || "Hierarchy",
          excel: comparison.source_value === null || comparison.source_value === undefined ? "-" : String(comparison.source_value),
          pdf: comparison.rollup_value === null || comparison.rollup_value === undefined ? "-" : String(comparison.rollup_value),
          status: comparison.state || group.state || section.state || "-"
        });
        if (rows.length >= 20) return rows;
      }
    }
  }
  for (const row of result.data_validation_check_matrix?.rows || []) {
    const statuses = Object.values(row.statuses || {});
    const firstStatus = statuses[0];
    if (!firstStatus) continue;
    rows.push({
      metric: `${row.s_no}. ${row.check_point || "Checklist row"}`,
      excel: row.section || "Data validation",
      pdf: firstStatus.display || "-",
      status: firstStatus.display || "-"
    });
    if (rows.length >= 12) break;
  }
  return rows;
}

function prioritizedEvidenceRows(rows, limit) {
  const mismatches = rows.filter((row) => isMismatchStatus(row.status));
  const others = rows.filter((row) => !isMismatchStatus(row.status));
  return [...mismatches, ...others].slice(0, limit);
}

function normalizeReviewEvidenceRows(result, rows = []) {
  return rows.map((row) => {
    if (!isInvalidSaifiSaidiDirectHierarchyEvidence(row)) return row;
    return {
      ...row,
      status: "NA"
    };
  });
}

function isInvalidSaifiSaidiDirectHierarchyEvidence(row = {}) {
  const metric = String(row.metric || "").toLowerCase();
  if (!metric.includes("saifi") || !metric.includes("saidi") || !metric.includes(" vs ")) {
    return false;
  }
  if (isDifferentSaifiSaidiHierarchyPairMetric(metric)) {
    return true;
  }
  if (!/(explicit total row|displayed summary metric|computed visible metric sum|summary metric|total row)/i.test(metric)) {
    return false;
  }
  return true;
}

function isDifferentSaifiSaidiHierarchyPairMetric(metric) {
  if (!metric.includes(" - ")) return false;
  const pairPrefix = metric.split(" - ")[0] || "";
  const scopes = ["feeder wise", "circle wise", "division wise", "subdivision wise", "zone wise"];
  const matchedScopes = scopes.filter((scope) => pairPrefix.includes(scope));
  return matchedScopes.length >= 2;
}

function isMismatchStatus(status) {
  return /\b(mismatch|not ok|fail|failed|error|missing)\b/i.test(String(status || "").replace(/_/g, " "));
}

function pairwiseComparisonMetricLabel(pair = {}, comparison = {}) {
  const reportPair = [pair.left_report, pair.right_report].filter(Boolean).join(" vs ");
  const rowLabel = comparison.row_label ? `${comparison.row_label} / ` : "";
  const sourceLabel = comparison.source ? `${humanizeMetricName(comparison.source)}: ` : "";
  const metricLabel = humanizeMetricName(comparison.metric || comparison.source || "Comparison");
  const detail = `${rowLabel}${sourceLabel}${metricLabel}`.trim();
  return reportPair ? `${reportPair} - ${detail}` : detail || "Comparison";
}

function labeledComparisonValue(label, fallback, value) {
  const displayValue = value === null || value === undefined ? "-" : String(value);
  return `${label || fallback}: ${displayValue}`;
}

function humanizeMetricName(value) {
  const text = String(value || "")
    .replace(/^metric_(\d+)$/i, "Metric $1")
    .replace(/_/g, " ")
    .trim();
  return text.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function assertReviewInputUploadKind(value) {
  const kind = String(value || "").toLowerCase();
  if (kind === "checklist" || kind === "excel" || kind === "pdf") return kind;
  const error = new Error("Review input upload kind must be checklist, excel, or pdf.");
  error.statusCode = 400;
  throw error;
}

function reviewInputUploadExtensions(kind) {
  if (kind === "checklist") return new Set([".xlsx", ".xls"]);
  return kind === "excel" ? new Set([".xlsx", ".xls", ".xlsm", ".xlsb"]) : new Set([".pdf"]);
}

function reviewInputUploadEmptyMessage(kind) {
  if (kind === "checklist") return "Select one checklist workbook.";
  if (kind === "excel") return "Select at least one Excel workbook.";
  return "Select at least one PDF report.";
}

function reviewInputUploadExtensionMessage(kind) {
  if (kind === "checklist") return "Only checklist workbook files can be selected here.";
  if (kind === "excel") return "Only Excel workbook files can be selected here.";
  return "Only PDF report files can be selected here.";
}

function toReviewFile(filePath, kind, stat) {
  return {
    id: `${kind}-${filePath}`,
    name: path.basename(filePath),
    path: filePath,
    kind,
    size: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    sourceType: kind === "PDF" ? "Exported report" : kind === "Excel" ? "Design workbook" : "Checklist workbook",
    status: "Ready"
  };
}

function parseExcelPdfDataStdout(stdout) {
  const parsed = {};
  const mappings = {
    "Excel/PDF data review completed": "completed",
    "Agent name": "agentName",
    "Agent mode": "agentMode",
    "Checklist folder": "checklistFolder",
    "Checklist path": "checklistPath",
    "Design checklist sheet": "designChecklistSheet",
    "Data validation checklist sheet": "dataValidationChecklistSheet",
    "Data validation mode": "dataValidationMode",
    "Excel report folder": "excelFolder",
    "Excel design folder": "excelFolder",
    "PDF report folder": "pdfFolder",
    "Discovered Excel reports": "discoveredExcelCount",
    "Discovered Excel design files": "discoveredExcelCount",
    "Selected Excel reports for validation": "selectedExcelCount",
    "Discovered PDF reports": "discoveredPdfCount",
    "Selected PDF reports for data validation": "selectedPdfCount",
    "Design status counts": "designStatusCounts",
    "Hierarchy validation state": "hierarchyValidationState",
    "Hierarchy validation mismatches": "hierarchyValidationMismatches",
    "Cross validation state": "crossValidationState",
    "Cross-Excel report-to-report matches": "crossPdfMatches",
    "Cross-Excel report-to-report mismatches": "crossPdfMismatches",
    "Cross-PDF report-to-report matches": "crossPdfMatches",
    "Cross-PDF report-to-report mismatches": "crossPdfMismatches",
    "Output folder": "outputFolder",
    "JSON": "jsonPath",
    "Markdown": "markdownPath",
    "Design Markdown": "designMarkdownPath",
    "Excel data validation Markdown": "excelDataValidationMarkdownPath",
    "PDF data validation Markdown": "pdfDataValidationMarkdownPath",
    "Design PDF": "designPdfPath",
    "Excel data validation PDF": "excelDataValidationPdfPath",
    "PDF data validation PDF": "pdfDataValidationPdfPath",
    "Text": "textPath",
    "Design check matrix Excel": "designCheckMatrixExcelPath",
    "Data validation check matrix Excel": "dataValidationCheckMatrixExcelPath",
    "Temp artifacts": "tempArtifactsFolder"
  };

  for (const line of String(stdout || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    for (const [label, key] of Object.entries(mappings)) {
      if (trimmed.startsWith(`${label}:`)) {
        parsed[key] = trimmed.slice(label.length + 1).trim();
      }
    }
  }
  return parsed;
}

async function runExcelOnlyDataDesignReview(config, files, startedAt) {
  const projectSlug = slugify(config.projectName || "excel-data-design-review") || "excel-data-design-review";
  const startedDate = startedAt ? new Date(startedAt) : new Date();
  const runId = formatLocalFileTimestamp(startedDate);
  const selectedChecklist = findSelectedFile(files.checklists, files.selected.checklistPath, "checklist");
  const selectedExcels = findSelectedFiles(files.excelFiles, files.selected.excelPaths, "Excel report");
  const userFolder = userReviewFolderName(config.userName);
  const projectFolder = projectFolderName(config.projectName || projectSlug);
  const reportCategoryFolder = reviewReportCategoryFolderFromExcelFiles(selectedExcels);
  const runDateTimeFolder = runDateTimeFolderName(startedDate);
  const projectOutputFolderAbs = path.join(EXCEL_PDF_REVIEW_OUTPUT_ROOT, userFolder, projectFolder, reportCategoryFolder, runDateTimeFolder);
  await ensureDir(projectOutputFolderAbs);

  const checklistWorkbook = readWorkbook(selectedChecklist.path);
  const designChecklist = extractChecklistPoints(checklistWorkbook, "design");
  const dataChecklist = extractChecklistPoints(checklistWorkbook, "data");
  const excelProfiles = selectedExcels.map((file) => readExcelWorkbookProfile(file));
  const hierarchyValidation = buildExcelOnlyHierarchyValidation(excelProfiles);
  const hierarchyEvidenceRows = hierarchyEvidenceRowsFromValidation(hierarchyValidation);
  const comparison = buildExcelOnlyComparison(excelProfiles, hierarchyValidation);
  const pairwiseComparisonDetails = buildExcelOnlyPairwiseDetails(comparison);
  const designRows = buildExcelOnlyDesignRows(designChecklist, excelProfiles);
  const dataRows = buildExcelOnlyDataRows(dataChecklist, excelProfiles, comparison, hierarchyValidation);
  const designCounts = statusCountsFromMatrixRows(designRows);
  const dataCounts = statusCountsFromMatrixRows(dataRows);
  const reviewTimestamp = formatLocalReviewTimestamp(startedDate);
  const reportColumns = excelProfiles.map((profile) => ({
    key: profile.file.name,
    report_name: profile.reportName || profile.file.name,
    detected_report_name: profile.reportName || profile.file.name,
    excel_design_file: profile.file.name,
    pdf_file: ""
  }));

  const result = {
    agent: {
      name: "excel_file_data_design_review_agent",
      mode: selectedExcels.length > 1 ? "excel_file_cross_report_data_design_validation" : "excel_file_single_report_data_design_validation",
      review_timestamp: reviewTimestamp,
      data_validation_source: "Selected Excel workbook(s) only; PDF files are not required or used.",
      features: [
        "Excel-only design and data validation",
        "Selected Excel workbook input only; PDF files not required",
        "Checklist-driven design review",
        "Checklist-driven Excel data validation",
        "Cross-Excel report comparison within matching validation groups",
        "SAIFI/SAIDI hierarchy rollup validation where matching levels are selected",
        "Report-wise observations with evidence",
        "Timestamped Markdown, PDF, JSON, text, and Excel matrix artifacts"
      ]
    },
    project: {
      project_name: config.projectName || projectSlug,
      reviewer_name: config.userName || "",
      user_folder: userFolder,
      report_category_folder: reportCategoryFolder,
      run_datetime_folder: runDateTimeFolder
    },
    inputs: {
      checklist_folder: path.dirname(selectedChecklist.path),
      checklist_path: selectedChecklist.path,
      design_checklist_sheet: designChecklist.sheetName || "-",
      data_validation_checklist_sheet: dataChecklist.sheetName || "-",
      checklist_sheet_analysis: {
        design: designChecklist,
        data: dataChecklist
      },
      data_validation_mode: selectedExcels.length > 1 ? "cross_excel_report_data_validation" : "single_excel_report_data_validation",
      excel_folder: config.excelFolder,
      pdf_folder: "",
      pdf_files_required: false
    },
    run: {
      discovered_excel_count: files.excelFiles.length,
      selected_excel_count: selectedExcels.length,
      discovered_pdf_count: 0,
      selected_pdf_count: 0,
      data_validation_mode: selectedExcels.length > 1 ? "cross_excel_report_data_validation" : "single_excel_report_data_validation",
      selected_excel_reports: selectedExcels.map((file) => ({ name: file.name, path: file.path })),
      pdf_files_required: false
    },
    selected_excel_reports: selectedExcels,
    excel_profile_summary: excelProfiles.map((profile) => ({
      file_name: profile.file.name,
      report_name: profile.reportName,
      validation_group: profile.validationGroup,
      hierarchy_scope: profile.hierarchyScope || "unknown",
      hierarchy_row_count: profile.hierarchyRows?.length || 0,
      sheet_count: profile.sheetCount,
      used_sheet_count: profile.usedSheetCount,
      row_count: profile.totalRows,
      column_count: profile.maxColumns,
      formula_error_count: profile.errorCount,
      date_token_count: profile.dateTokens.length,
      duplicate_label_count: profile.duplicateLabelCount
    })),
    design_summary: {
      counts: {
        pass: designCounts.ok,
        fail: designCounts.notOk,
        manual_review_required: 0,
        insufficient_evidence: designCounts.review,
        not_applicable: designCounts.na
      }
    },
    design_check_matrix: {
      columns: reportColumns,
      rows: designRows
    },
    data_validation_check_matrix: {
      columns: reportColumns,
      rows: dataRows
    },
    individual_checklist_verification: {
      note: "This section expands checklist validation to one row per selected report and checklist point. Cross-report verification remains in the design/data matrices and comparison sections.",
      groups: buildIndividualChecklistVerifications({
        design_check_matrix: { columns: reportColumns, rows: designRows },
        data_validation_check_matrix: { columns: reportColumns, rows: dataRows }
      })
    },
    excel_data_validation: {
      state: comparison.mismatchRows.length ? "mismatch" : comparison.matchRows.length ? "match" : "insufficient_context",
      pair_count: pairwiseComparisonDetails.length,
      match_count: comparison.matchRows.length + Number(hierarchyValidation.match_count || 0),
      mismatch_count: comparison.mismatchRows.length + Number(hierarchyValidation.mismatch_count || 0),
      insufficient_context_pair_count: pairwiseComparisonDetails.filter((pair) => !(pair.comparisons || []).length).length,
      evidence_rows: [...hierarchyEvidenceRows, ...comparison.mismatchRows, ...comparison.matchRows].slice(0, 200),
      pairwise: pairwiseComparisonDetails,
      validation_groups: comparison.groups,
      skipped_groups: comparison.skippedGroups,
      skipped_cross_family_pair_count: comparison.skippedCrossFamilyPairCount,
      date_range_summary: excelDateRangeSummary(excelProfiles, comparison, hierarchyValidation)
    },
    hierarchical_data_validation: hierarchyValidation,
    cross_pdf_data_validation: {
      state: "not_applicable",
      selected_pdf_count: 0,
      pair_count: 0,
      match_count: 0,
      mismatch_count: 0,
      insufficient_context_pair_count: 0,
      findings: [],
      pairwise: []
    },
    report_wise_observations: [],
    paths: {}
  };

  const baseName = await uniqueExcelOnlyReviewBaseName(projectOutputFolderAbs, `${projectFolder}(${runId})`);
  const jsonPath = path.join(projectOutputFolderAbs, `${baseName}.json`);
  const markdownPath = path.join(projectOutputFolderAbs, `${baseName}.md`);
  const designMarkdownPath = path.join(projectOutputFolderAbs, `${baseName}-design-review.md`);
  const excelDataValidationMarkdownPath = path.join(projectOutputFolderAbs, `${baseName}-excel-data-validation.md`);
  const designReviewPdfPath = path.join(projectOutputFolderAbs, `${baseName}-design-review.pdf`);
  const excelDataValidationPdfPath = path.join(projectOutputFolderAbs, `${baseName}-excel-data-validation.pdf`);
  const textPath = path.join(projectOutputFolderAbs, `${baseName}.txt`);
  const designMatrixPath = path.join(projectOutputFolderAbs, `${baseName}-design-check-matrix.xlsx`);
  const dataMatrixPath = path.join(projectOutputFolderAbs, `${baseName}-data-validation-check-matrix.xlsx`);
  result.paths = {
    folder: relativePath(AI_REVIEW_ROOT, projectOutputFolderAbs),
    json: relativePath(AI_REVIEW_ROOT, jsonPath),
    markdown: relativePath(AI_REVIEW_ROOT, markdownPath),
    design_markdown: relativePath(AI_REVIEW_ROOT, designMarkdownPath),
    excel_data_validation_markdown: relativePath(AI_REVIEW_ROOT, excelDataValidationMarkdownPath),
    design_review_pdf: relativePath(AI_REVIEW_ROOT, designReviewPdfPath),
    excel_data_validation_pdf: relativePath(AI_REVIEW_ROOT, excelDataValidationPdfPath),
    pdf_data_validation_markdown: "",
    text: relativePath(AI_REVIEW_ROOT, textPath),
    design_check_matrix_excel: relativePath(AI_REVIEW_ROOT, designMatrixPath),
    data_validation_check_matrix_excel: relativePath(AI_REVIEW_ROOT, dataMatrixPath)
  };

  await writeJson(jsonPath, result);
  const markdown = excelOnlyReviewMarkdown(result);
  const designMarkdown = excelOnlyDesignReviewMarkdown(result);
  const excelDataValidationMarkdown = excelOnlyDataValidationMarkdown(result);
  await writeText(markdownPath, markdown);
  await writeText(designMarkdownPath, designMarkdown);
  await writeText(excelDataValidationMarkdownPath, excelDataValidationMarkdown);
  await writeMarkdownPdf(designReviewPdfPath, designMarkdown, `${result.project.project_name || "Excel Review"} - Design Review`);
  await writeMarkdownPdf(excelDataValidationPdfPath, excelDataValidationMarkdown, `${result.project.project_name || "Excel Review"} - Excel Data Validation`);
  await writeText(textPath, markdown.replace(/^#/gm, "").trim() + "\n");
  writeMatrixWorkbook(designMatrixPath, designRows, selectedExcels);
  writeMatrixWorkbook(dataMatrixPath, dataRows, selectedExcels);

  const summaryPath = path.join(projectOutputFolderAbs, `${baseName}-ui-run-summary.json`);
  const projectArtifacts = {
    projectOutputFolder: relativePath(AI_REVIEW_ROOT, projectOutputFolderAbs),
    projectOutputFolderAbsolute: projectOutputFolderAbs,
    reportCategoryFolder,
    runDateTimeFolder,
    projectJsonPath: relativePath(AI_REVIEW_ROOT, jsonPath),
    projectMarkdownPath: relativePath(AI_REVIEW_ROOT, markdownPath),
    projectTextPath: relativePath(AI_REVIEW_ROOT, textPath),
    copiedArtifacts: {
      json: relativePath(AI_REVIEW_ROOT, jsonPath),
      markdown: relativePath(AI_REVIEW_ROOT, markdownPath),
      design_markdown: relativePath(AI_REVIEW_ROOT, designMarkdownPath),
      excel_data_validation_markdown: relativePath(AI_REVIEW_ROOT, excelDataValidationMarkdownPath),
      design_review_pdf: relativePath(AI_REVIEW_ROOT, designReviewPdfPath),
      excel_data_validation_pdf: relativePath(AI_REVIEW_ROOT, excelDataValidationPdfPath),
      text: relativePath(AI_REVIEW_ROOT, textPath),
      design_check_matrix_excel: relativePath(AI_REVIEW_ROOT, designMatrixPath),
      data_validation_check_matrix_excel: relativePath(AI_REVIEW_ROOT, dataMatrixPath)
    },
    summaryPath: relativePath(AI_REVIEW_ROOT, summaryPath)
  };
  await writeJson(summaryPath, {
    project_name: config.projectName || projectSlug,
    user_folder: userFolder,
    report_category_folder: reportCategoryFolder,
    run_datetime_folder: runDateTimeFolder,
    user_name: config.userName || "",
    review_started_at: startedAt,
    review_completed_at: new Date().toISOString(),
    selected_checklist: selectedChecklist,
    selected_excel_reports: selectedExcels,
    selected_pdf_reports: [],
    pdf_files_required: false,
    project_paths: projectArtifacts.copiedArtifacts
  });

  const stdout = [
    `Excel data and design review completed: ${selectedExcels.length} Excel report(s) validated`,
    `Agent name: ${result.agent.name}`,
    `Agent mode: ${result.agent.mode}`,
    `Project name: ${result.project.project_name}`,
    `Reviewer name: ${result.project.reviewer_name || "-"}`,
    `Checklist path: ${selectedChecklist.path}`,
    `Design checklist sheet: ${result.inputs.design_checklist_sheet}`,
    `Data validation checklist sheet: ${result.inputs.data_validation_checklist_sheet}`,
    `Data validation mode: ${result.inputs.data_validation_mode}`,
    `Excel design folder: ${config.excelFolder}`,
    "PDF report folder: Not required",
    `Discovered Excel design files: ${files.excelFiles.length}`,
    "Discovered PDF reports: 0",
    "Selected PDF reports for data validation: 0",
    `Design status counts: pass=${designCounts.ok}, fail=${designCounts.notOk}, insufficient_evidence=${designCounts.review}, not_applicable=${designCounts.na}`,
    `Hierarchy validation state: ${hierarchyValidation.state || "not_applicable"}`,
    `Hierarchy validation sections: ${hierarchyValidation.section_count || 0}`,
    `Hierarchy validation mismatches: ${hierarchyValidation.mismatch_count || 0}`,
    `Cross validation state: ${comparison.mismatchRows.length ? "mismatch" : comparison.matchRows.length ? "match" : "insufficient_context"}`,
    `Cross-Excel report-to-report matches: ${comparison.matchRows.length}`,
    `Cross-Excel report-to-report mismatches: ${comparison.mismatchRows.length}`,
    `Output folder: ${result.paths.folder}`,
    `JSON: ${result.paths.json}`,
    `Markdown: ${result.paths.markdown}`,
    `Design Markdown: ${result.paths.design_markdown}`,
    `Excel data validation Markdown: ${result.paths.excel_data_validation_markdown}`,
    `Design review PDF: ${result.paths.design_review_pdf}`,
    `Excel data validation PDF: ${result.paths.excel_data_validation_pdf}`,
    `Text: ${result.paths.text}`,
    `Design check matrix Excel: ${result.paths.design_check_matrix_excel}`,
    `Data validation check matrix Excel: ${result.paths.data_validation_check_matrix_excel}`
  ].join("\n");

  return {
    runPlan: {
      projectSlug,
      runId,
      selected: {
        checklist: selectedChecklist,
        excel: selectedExcels[0],
        excels: selectedExcels,
        pdf: null,
        pdfs: []
      }
    },
    stdout,
    parsed: {
      agentName: result.agent.name,
      agentMode: result.agent.mode,
      checklistPath: selectedChecklist.path,
      designChecklistSheet: result.inputs.design_checklist_sheet,
      dataValidationChecklistSheet: result.inputs.data_validation_checklist_sheet,
      dataValidationMode: result.inputs.data_validation_mode,
      excelFolder: config.excelFolder,
      pdfFolder: "Not required",
      discoveredExcelCount: String(files.excelFiles.length),
      selectedExcelCount: String(selectedExcels.length),
      discoveredPdfCount: "0",
      selectedPdfCount: "0",
      hierarchyValidationState: hierarchyValidation.state || "not_applicable",
      hierarchyValidationMismatches: String(hierarchyValidation.mismatch_count || 0),
      crossValidationState: comparison.mismatchRows.length ? "mismatch" : comparison.matchRows.length ? "match" : "insufficient_context",
      crossPdfMatches: String(comparison.matchRows.length),
      crossPdfMismatches: String(comparison.mismatchRows.length),
      outputFolder: result.paths.folder,
      jsonPath: result.paths.json,
      markdownPath: result.paths.markdown,
      designMarkdownPath: result.paths.design_markdown,
      excelDataValidationMarkdownPath: result.paths.excel_data_validation_markdown,
      designPdfPath: result.paths.design_review_pdf,
      excelDataValidationPdfPath: result.paths.excel_data_validation_pdf,
      textPath: result.paths.text,
      designCheckMatrixExcelPath: result.paths.design_check_matrix_excel,
      dataValidationCheckMatrixExcelPath: result.paths.data_validation_check_matrix_excel,
      projectOutputFolder: projectArtifacts.projectOutputFolder,
      projectJsonPath: projectArtifacts.projectJsonPath,
      projectMarkdownPath: projectArtifacts.projectMarkdownPath,
      projectTextPath: projectArtifacts.projectTextPath
    },
    projectArtifacts
  };
}

function readWorkbook(filePath) {
  return XLSX.readFile(filePath, { cellDates: true, cellNF: false, cellStyles: false });
}

function extractChecklistPoints(workbook, purpose) {
  const analyses = (workbook.SheetNames || []).map((sheetName) =>
    analyzeChecklistSheet(sheetName, workbook.Sheets[sheetName], purpose)
  );
  const best = analyses
    .filter((analysis) => analysis.availableCandidate)
    .sort((left, right) =>
      right.score - left.score
      || right.matchedPurposePointCount - left.matchedPurposePointCount
      || right.points.length - left.points.length
    )[0];
  const selected = best || null;
  if (!selected) {
    const message = purpose === "data"
      ? "Data related checklist sheet not available in the selected checklist workbook."
      : "Design related checklist sheet not available in the selected checklist workbook.";
    return {
      purpose,
      sheetName: "",
      points: [],
      available: false,
      message,
      analyzedSheets: analyses.map((analysis) => ({
        sheetName: analysis.sheetName,
        score: analysis.score,
        pointCount: analysis.allPointCount,
        matchedPointCount: analysis.matchedPurposePointCount
      }))
    };
  }
  return {
    purpose,
    sheetName: selected.sheetName,
    points: selected.points,
    available: true,
    message: "",
    analyzedSheets: analyses.map((analysis) => ({
      sheetName: analysis.sheetName,
      score: analysis.score,
      pointCount: analysis.allPointCount,
      matchedPointCount: analysis.matchedPurposePointCount
    }))
  };
}

function analyzeChecklistSheet(sheetName, sheet, purpose) {
  const rows = sheetRows(sheet);
  const headerIndex = findChecklistPointHeaderIndex(rows);
  const header = rows[headerIndex] || [];
  const pointColumn = checklistPointColumn(header);
  const sectionColumn = header.findIndex((cell) => /section|category|area|type/i.test(String(cell || "")));
  const sourceRows = rows.slice(headerIndex >= 0 ? headerIndex + 1 : 0);
  const allPoints = [];
  let currentSection = "";
  for (const row of sourceRows) {
    const sectionText = cleanCellText(row[sectionColumn]);
    const text = cleanCellText(row[pointColumn] || row[1] || row[0]);
    if (sectionText) currentSection = sectionText;
    if (!text || /^s\.?no$/i.test(text) || /^check\s*points?$/i.test(text)) continue;
    if (isChecklistSectionHeading(text, row)) {
      currentSection = text;
      continue;
    }
    allPoints.push({
      section: sectionText || currentSection || "",
      text
    });
    if (allPoints.length >= 200) break;
  }
  const purposePoints = allPoints.filter((point) => checklistPointMatchesPurpose(point, purpose));
  const explicitPurposeSheetName = checklistSheetNameMatchesPurpose(sheetName, purpose);
  const textCorpus = [
    sheetName,
    ...rows.slice(0, 12).flatMap((row) => row.map((cell) => cleanCellText(cell))),
    ...allPoints.flatMap((point) => [point.section, point.text])
  ].join(" ");
  const sheetScore = checklistSheetPurposeScore(textCorpus, purpose);
  const pointScore = allPoints.reduce((sum, point) => sum + checklistPointSignalScore(`${point.section} ${point.text}`, purpose), 0);
  const score = sheetScore + pointScore;
  const availableCandidate = allPoints.length > 0
    && score > 0
    && (purposePoints.length > 0 || explicitPurposeSheetName);
  return {
    sheetName,
    points: purposePoints.length ? purposePoints : (availableCandidate ? allPoints : []),
    score,
    allPointCount: allPoints.length,
    matchedPurposePointCount: purposePoints.length,
    explicitPurposeSheetName,
    availableCandidate
  };
}

function checklistSheetNameMatchesPurpose(sheetName, purpose) {
  const text = cleanCellText(sheetName).toLowerCase();
  if (purpose === "data") return /\b(data|validation|reconciliation|matrix)\b/.test(text);
  return /\b(design|dashboard|layout|ui|visual)\b/.test(text);
}

function findChecklistPointHeaderIndex(rows) {
  const directIndex = rows.findIndex((row) => row.some((cell) => {
    const text = String(cell || "");
    return /check\s*points?|criteria|requirement|description|report\s+check|what\s+it\s+counts|validation\s+point/i.test(text)
      || (/\brule\b/i.test(text) && !/\brule\s*id\b/i.test(text));
  }));
  if (directIndex >= 0) return directIndex;
  return rows.findIndex((row) => row.filter((cell) => cleanCellText(cell)).length >= 2);
}

function checklistPointColumn(header) {
  const preferredHeaderPatterns = [
    /check\s*points?/i,
    /check\s*point/i,
    /report\s+check/i,
    /description/i,
    /what\s+it\s+counts/i,
    /criteria/i,
    /requirement/i,
    /validation\s+point/i,
    /remarks?/i,
    /\brule\b/i
  ];
  for (const pattern of preferredHeaderPatterns) {
    const matchIndex = header.findIndex((cell) => {
      const text = String(cell || "");
      return pattern.test(text) && !/\b(?:sno|s\.?\s*no|sr\.?\s*no|serial|id|key)\b/i.test(text);
    });
    if (matchIndex >= 0) return matchIndex;
  }
  const matchIndex = header.findIndex((cell) => {
    const text = String(cell || "");
    return /criteria|validation|requirement/i.test(text) && !/\b(?:id|key)\b/i.test(text);
  });
  if (matchIndex >= 0) return matchIndex;
  const serialIndex = header.findIndex((cell) => /^s\.?\s*no$|serial|sr\.?\s*no/i.test(String(cell || "")));
  if (serialIndex >= 0) {
    for (let index = serialIndex + 1; index < header.length; index += 1) {
      const text = cleanCellText(header[index]);
      if (text && !/\b(?:id|key|sno|s\.?\s*no|sr\.?\s*no|serial)\b/i.test(text)) return index;
    }
  }
  return header.findIndex(Boolean) >= 0 ? header.findIndex(Boolean) : 0;
}

function isChecklistSectionHeading(text, row) {
  const populated = row.filter((cell) => cleanCellText(cell)).length;
  return populated <= 2
    && /\b(design|data|validation|header|footer|parameter|column|export|loading|general|summary|report)\b/i.test(text)
    && !/[.?]$/.test(text)
    && String(text).length <= 80;
}

function checklistSheetPurposeScore(value, purpose) {
  const text = cleanCellText(value).toLowerCase();
  const patterns = purpose === "data"
    ? [
        /\bdata\b/g,
        /\bvalidation\b/g,
        /\breconciliation\b/g,
        /\bmatch(?:es|ed|ing)?\b/g,
        /\bmismatch(?:es|ed|ing)?\b/g,
        /\bcompare|comparison|cross\b/g,
        /\bvalue|metric|total|count|record|date|period\b/g,
        /\bsaifi|saidi|analog\b/g
      ]
    : [
        /\bdesign\b/g,
        /\b(?:layout|header|footer|logo|font|colour|color|bold|alignment|align|style)\b/g,
        /\b(?:page setup|ddl|filter|border|overlap|overflow|width)\b/g,
        /\b(?:report|excel|pdf)\s+export\b|\bexport\s+(?:button|option|file|report)\b|\bloading\s+(?:time|indicator|message|screen)\b/g,
        /\bcolumn\s+(?:header|width)|\bpage\s+\d+\s+of\s+\d+\b/g
      ];
  const negativePatterns = purpose === "data"
    ? [/\bdesign\b/g, /\bfont|colour|color|logo|alignment|bold\b/g]
    : [/\bdata validation\b/g, /\breconciliation\b/g, /\bmismatch|match\b/g];
  const positive = patterns.reduce((sum, pattern) => sum + regexMatchCount(text, pattern), 0);
  const negative = negativePatterns.reduce((sum, pattern) => sum + regexMatchCount(text, pattern), 0);
  return Math.max(0, positive - Math.floor(negative / 2));
}

function checklistPointMatchesPurpose(point, purpose) {
  const text = `${point?.section || ""} ${point?.text || ""}`;
  const dataScore = checklistPointSignalScore(text, "data");
  const designScore = checklistPointSignalScore(text, "design");
  if (purpose === "data") return dataScore > 0 && dataScore >= designScore;
  return designScore > 0 && designScore >= dataScore;
}

function checklistPointSignalScore(value, purpose) {
  const text = cleanCellText(value).toLowerCase();
  const weightedPatterns = purpose === "data"
    ? [
        [/\bdata\s+validation\b/g, 5],
        [/\breconciliation\b/g, 4],
        [/\bsame\s+(?:value|across\s+reports?)\b/g, 4],
        [/\bmatch(?:es|ed|ing)?\b|\bmismatch(?:es|ed|ing)?\b|\bcompare|comparison|cross\b/g, 3],
        [/\bvalue|metric|total|count|record|date|period|average|avg|min|max\b/g, 1],
        [/\bsaifi|saidi|analog\b/g, 2]
      ]
    : [
        [/\bdesign\b/g, 3],
        [/\b(?:layout|header|footer|logo|font|colour|color|bold|alignment|align|style)\b/g, 3],
        [/\b(?:page setup|ddl|filter|border|overlap|overflow|width)\b/g, 2],
        [/\b(?:report|excel|pdf)\s+export\b|\bexport\s+(?:button|option|file|report)\b|\bloading\s+(?:time|indicator|message|screen)\b/g, 2],
        [/\bcolumn\s+(?:header|width)|\bvisual\b/g, 1]
      ];
  return weightedPatterns.reduce((sum, [pattern, weight]) => sum + (regexMatchCount(text, pattern) * weight), 0);
}

function regexMatchCount(value, pattern) {
  return (String(value || "").match(pattern) || []).length;
}

function readExcelWorkbookProfile(file) {
  const workbook = readWorkbook(file.path);
  const reportName = excelWorkbookReportTitleFromWorkbook(workbook) || path.basename(file.name, path.extname(file.name));
  const reportHeaderText = excelWorkbookReportHeaderTextFromWorkbook(workbook);
  const reportIdentityText = [file.name, reportName, reportHeaderText].filter(Boolean).join(" ");
  const hierarchyScope = inferExcelHierarchyScope(reportIdentityText);
  const sheetProfiles = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = sheetRows(sheet);
    const usedRows = rows.filter((row) => row.some((cell) => cleanCellText(cell)));
    const textValues = [];
    let errorCount = 0;
    let blankCount = 0;
    let populatedCount = 0;
    const maxColumn = rows.reduce((max, row) => Math.max(max, row.length), 0);
    for (const row of usedRows) {
      for (const cell of row) {
        const text = cleanCellText(cell);
        if (text) {
          populatedCount += 1;
          textValues.push(text);
          if (/^#(N\/A|DIV\/0|VALUE|REF|NAME|NUM|NULL)!?$/i.test(text)) errorCount += 1;
        }
      }
      blankCount += Math.max(0, maxColumn - row.filter((cell) => cleanCellText(cell)).length);
    }
    const metricValues = extractMetricValuesFromSheet(rows, sheetName);
    const summaryValues = extractSummaryValuesFromSheet(rows, sheetName);
    const columnBounds = populatedColumnBounds(rows);
    const labels = new Map();
    for (const metric of metricValues) {
      labels.set(metric.key, (labels.get(metric.key) || 0) + 1);
    }
    const duplicateLabelCount = [...labels.values()].filter((count) => count > 1).length;
    return {
      sheetName,
      rowCount: usedRows.length,
      columnCount: maxColumn,
      textValues,
      metricValues,
      summaryValues,
      errorCount,
      blankCount,
      populatedCount,
      duplicateLabelCount,
      ...columnBounds
    };
  });
  const allText = sheetProfiles.flatMap((sheet) => sheet.textValues);
  const hierarchyRows = hierarchyScope ? extractSaifiSaidiHierarchyRows(workbook, file.name, hierarchyScope) : [];
  return {
    file,
    reportName,
    validationGroup: inferExcelReportValidationGroup(reportIdentityText),
    hierarchyScope,
    hierarchyRows,
    sheetCount: workbook.SheetNames.length,
    usedSheetCount: sheetProfiles.filter((sheet) => sheet.rowCount > 0).length,
    totalRows: sheetProfiles.reduce((sum, sheet) => sum + sheet.rowCount, 0),
    maxColumns: sheetProfiles.reduce((max, sheet) => Math.max(max, sheet.columnCount), 0),
    errorCount: sheetProfiles.reduce((sum, sheet) => sum + sheet.errorCount, 0),
    blankCount: sheetProfiles.reduce((sum, sheet) => sum + sheet.blankCount, 0),
    populatedCount: sheetProfiles.reduce((sum, sheet) => sum + sheet.populatedCount, 0),
    duplicateLabelCount: sheetProfiles.reduce((sum, sheet) => sum + sheet.duplicateLabelCount, 0),
    dateTokens: [...new Set(allText.flatMap((text) => Array.from(String(text).matchAll(/\b\d{1,2}[-/]\d{1,2}[-/]\d{4}\b/g), (match) => match[0])))],
    summaryValues: sheetProfiles.flatMap((sheet) => sheet.summaryValues || []),
    sheetProfiles
  };
}

function reviewReportCategoryFolderFromExcelFiles(files = []) {
  const families = new Set(
    files
      .map((file) => inferReviewReportFamilyFromExcelFile(file))
      .filter(Boolean)
  );
  if (families.size === 1 && families.has("analog")) return "Analog Reports";
  if (families.size === 1 && families.has("saifi-saidi")) return "Saifi Saidi Reports";
  return "Misslaneous";
}

function inferReviewReportFamilyFromExcelFile(file = {}) {
  const headerText = excelWorkbookReportHeaderText(file.path);
  return reviewReportFamilyFromText(headerText) || reviewReportFamilyFromText(file.name) || "miscellaneous";
}

function excelWorkbookReportHeaderTextFromWorkbook(workbook) {
  const candidates = [];
  for (const sheetName of (workbook.SheetNames || []).slice(0, 3)) {
    const rows = sheetRows(workbook.Sheets[sheetName]).slice(0, 14);
    for (const row of rows) {
      const text = row.map((cell) => cleanCellText(cell)).filter(Boolean).join(" ");
      if (!text || !looksLikeReportHeaderText(text)) continue;
      candidates.push(text);
      if (candidates.length >= 8) break;
    }
    if (candidates.length >= 8) break;
  }
  return candidates.join(" ");
}

function excelWorkbookReportHeaderText(filePath) {
  if (!filePath) return "";
  try {
    return excelWorkbookReportHeaderTextFromWorkbook(readWorkbook(filePath));
  } catch {
    return "";
  }
}

function excelWorkbookReportTitleFromWorkbook(workbook) {
  try {
    const candidates = [];
    for (const sheetName of (workbook.SheetNames || []).slice(0, 3)) {
      const rows = sheetRows(workbook.Sheets[sheetName]).slice(0, 12);
      rows.forEach((row, index) => {
        const cells = row.map((cell) => cleanCellText(cell)).filter(Boolean);
        const text = cells.join(" ");
        if (!text || !/[A-Za-z]/.test(text)) return;
        if (isWorkbookParameterLikeRow(text) || isWorkbookColumnHeaderRow(cells)) return;
        candidates.push({
          text,
          rowNumber: index + 1,
          cellCount: cells.length
        });
      });
    }
    if (!candidates.length) return "";
    return candidates
      .map((candidate) => ({
        ...candidate,
        score:
          (candidate.rowNumber <= 2 ? 70 : 0) +
          (candidate.cellCount === 1 ? 24 : 0) +
          (candidate.text.length >= 12 ? 20 : 0) +
          (candidate.text === candidate.text.toUpperCase() ? 20 : 0) -
          candidate.rowNumber * 4
      }))
      .sort((left, right) => right.score - left.score)[0].text;
  } catch {
    return "";
  }
}

function excelWorkbookReportTitle(filePath) {
  if (!filePath) return "";
  try {
    return excelWorkbookReportTitleFromWorkbook(readWorkbook(filePath));
  } catch {
    return "";
  }
}

function isWorkbookParameterLikeRow(text) {
  const clean = cleanCellText(text);
  return /^(name\s+of|from\s*:|to\s*:|print\s+date\s*:|total\s+\w+\s*:|transit\s*%|feeder\s+category\s*:|state\s*:|discom\s*:)/i.test(clean)
    || /\b(name\s+of\s+state|name\s+of\s+discom|name\s+of\s+tss|feeder\s+category|print\s+date)\b/i.test(clean);
}

function isWorkbookColumnHeaderRow(cells = []) {
  if (cells.length < 2) return false;
  const text = cells.join(" ").toUpperCase();
  const metricTokens = cells.filter((cell) =>
    /^(S\.?\s*NO|DATE|TIME|ZONE(?:\s+NAME)?|CIRCLE(?:\s+NAME)?|DIVISION(?:\s+NAME)?|SUB\s*DIVISION(?:\s+NAME)?|SUBDIVISION(?:\s+NAME)?|SUBSTATION(?:\s+NAME)?|FEEDER(?:\s+NAME|\s+CODE)?|PLANNED|UNPLANNED|TOTAL|SAIFI|SAIDI(?:\s+DD:HH:MM)?|AVAILABILITY\s*%|VALUE|UNIT|PARAMETER)$/i.test(cell)
  ).length;
  return metricTokens >= Math.max(2, Math.ceil(cells.length * 0.6)) || /\bPLANNED\b.*\bUNPLANNED\b.*\bTOTAL\b/.test(text);
}

function looksLikeReportHeaderText(value) {
  const text = cleanCellText(value);
  if (!text) return false;
  if (/^s\.?\s*no\b/i.test(text)) return false;
  if (/^date\s+time\b/i.test(text)) return false;
  if (/^#?\s*\d+$/.test(text)) return false;
  return /\b(report|analog|parameters?|saifi|saidi|feeder|circle|division|subdivision|substation|zone|maximum|minimum|voltage|mva|pf|md)\b/i.test(text);
}

function reviewReportFamilyFromText(value) {
  const text = cleanCellText(value).toLowerCase().replace(/[_.,()[\]-]+/g, " ").replace(/\s+/g, " ");
  if (/\b(saifi|saidi)\b/i.test(text)) return "saifi-saidi";
  if (/\banalog\b/i.test(text)) return "analog";
  return "";
}

function sheetRows(sheet) {
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false, blankrows: false });
}

function populatedColumnBounds(rows = []) {
  let first = Infinity;
  let last = -1;
  let maxColumn = 0;
  for (const row of rows) {
    maxColumn = Math.max(maxColumn, row.length);
    row.forEach((cell, index) => {
      if (!cleanCellText(cell)) return;
      first = Math.min(first, index);
      last = Math.max(last, index);
    });
  }
  if (!Number.isFinite(first)) {
    return { firstPopulatedColumn: -1, lastPopulatedColumn: -1, leadingBlankColumns: 0, trailingBlankColumns: 0 };
  }
  return {
    firstPopulatedColumn: first,
    lastPopulatedColumn: last,
    leadingBlankColumns: first,
    trailingBlankColumns: Math.max(0, maxColumn - last - 1)
  };
}

function inferExcelHierarchyScope(fileName) {
  const normalized = path.basename(String(fileName || ""), path.extname(String(fileName || "")))
    .toLowerCase()
    .replace(/[_.,()[\]-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!/\b(saifi|saidi)\b/i.test(normalized)) return "";
  if (/\bfeeder\s+category\b/.test(normalized)) return "feeder_category_wise";
  if (/\bsub\s*station\b|\bsubstation\b/.test(normalized)) return "substation_wise";
  if (/\bsub\s*division\b|\bsubdivision\b/.test(normalized)) return "subdivision_wise";
  if (/\bdivision\b/.test(normalized)) return "division_wise";
  if (/\bcircle\b/.test(normalized)) return "circle_wise";
  if (/\bzone\b/.test(normalized)) return "zone_wise";
  if (/\bfeeder\b/.test(normalized)) return "feeder_wise";
  return "";
}

function extractSaifiSaidiHierarchyRows(workbook, fileName, hierarchyScope) {
  const rows = [];
  for (const sheetName of workbook.SheetNames || []) {
    const sheetRowsValue = sheetRows(workbook.Sheets[sheetName]);
    const headerIndex = findSaifiSaidiHeaderRow(sheetRowsValue);
    if (headerIndex < 0) continue;
    const headers = combinedHierarchyHeaders(sheetRowsValue[headerIndex] || [], sheetRowsValue[headerIndex + 1] || []);
    const columns = hierarchyColumnMap(headers);
    const serialColumn = columns.serial ?? 0;
    for (let rowIndex = headerIndex + 2; rowIndex < sheetRowsValue.length; rowIndex += 1) {
      const row = sheetRowsValue[rowIndex] || [];
      const serial = cleanCellText(row[serialColumn]);
      if (!/^\d+$/.test(serial)) continue;
      const parsed = parseSaifiSaidiHierarchyRow({
        row,
        rowNumber: rowIndex + 1,
        sheetName,
        fileName,
        hierarchyScope,
        columns
      });
      if (parsed) rows.push(parsed);
    }
  }
  return rows;
}

function findSaifiSaidiHeaderRow(rows) {
  return rows.findIndex((row, index) => {
    const current = row.map((cell) => cleanCellText(cell)).join(" ");
    const next = (rows[index + 1] || []).map((cell) => cleanCellText(cell)).join(" ");
    return /\bS\.?\s*NO\b/i.test(current)
      && /\b(SAIFI|SAIDI|PLANNED|UNPLANNED|TOTAL)\b/i.test(`${current} ${next}`)
      && /\b(NAME|FEEDER|CIRCLE|DIVISION|SUBSTATION|ZONE|CATEGORY)\b/i.test(current);
  });
}

function combinedHierarchyHeaders(primaryRow, secondaryRow) {
  const maxColumns = Math.max(primaryRow.length, secondaryRow.length);
  const headers = [];
  let currentParent = "";
  for (let columnIndex = 0; columnIndex < maxColumns; columnIndex += 1) {
    const parent = cleanCellText(primaryRow[columnIndex]).replace(/\s+/g, " ");
    const child = cleanCellText(secondaryRow[columnIndex]).replace(/\s+/g, " ");
    if (parent) currentParent = parent;
    headers.push(child ? `${currentParent} ${child}`.trim() : parent || currentParent);
  }
  return headers;
}

function hierarchyColumnMap(headers) {
  return {
    serial: findHierarchyColumn(headers, [/\bS\.?\s*NO\b/]),
    zone_name: findHierarchyColumn(headers, [/\bZONE\b/, /\bNAME\b/]),
    circle_name: findHierarchyColumn(headers, [/\bCIRCLE\b/, /\bNAME\b/]),
    division_name: findHierarchyColumn(headers, [/\bDIVISION\b/, /\bNAME\b/], [/\bSUB\s*DIVISION\b/, /\bSUBDIVISION\b/]),
    subdivision_name: findHierarchyColumn(headers, [/\bSUB\s*DIVISION\b|\bSUBDIVISION\b/, /\bNAME\b/]),
    substation_name: findHierarchyColumn(headers, [/\bSUBSTATION\b/, /\bNAME\b/]),
    feeder_name: findHierarchyColumn(headers, [/\bFEEDER\b/, /\bNAME\b/], [/\bCATEGORY\b/, /\bCODE\b/]),
    feeder_code: findHierarchyColumn(headers, [/\bFEEDER\b/, /\bCODE\b/]),
    feeder_category: findHierarchyColumn(headers, [/\bFEEDER\b/, /\bCATEGORY\b/]),
    total_feeders: findHierarchyColumn(headers, [/\bTOTAL\b/, /\bFEEDERS?\b/]),
    running_hours: findHierarchyColumn(headers, [/\bRUNNING\b/, /\bHOURS?\b/]),
    planned_saifi: findHierarchyColumn(headers, [/\bPLANNED\b/, /\bSAIFI\b/]),
    planned_saidi_seconds: findHierarchyColumn(headers, [/\bPLANNED\b/, /\bSAIDI\b/]),
    unplanned_saifi: findHierarchyColumn(headers, [/\bUNPLANNED\b/, /\bSAIFI\b/]),
    unplanned_saidi_seconds: findHierarchyColumn(headers, [/\bUNPLANNED\b/, /\bSAIDI\b/]),
    total_saifi: findHierarchyColumn(headers, [/\bTOTAL\b/, /\bSAIFI\b/], [/\bFEEDERS?\b/]),
    total_saidi_seconds: findHierarchyColumn(headers, [/\bTOTAL\b/, /\bSAIDI\b/], [/\bFEEDERS?\b/]),
    average_interruptions_per_feeder_per_day: findHierarchyColumn(headers, [/\bAVERAGE\b/, /\bINTERRUPTION\b/, /\bFEEDER\b/]),
    average_hours_supply_seconds: findHierarchyColumn(headers, [/\bAVERAGE\b/, /\bHOURS?\b/, /\bSUPPLY\b/])
  };
}

function findHierarchyColumn(headers, requiredPatterns, excludedPatterns = []) {
  return headers.findIndex((header) => {
    const normalized = cleanCellText(header).toUpperCase().replace(/\s+/g, " ");
    return requiredPatterns.every((pattern) => pattern.test(normalized))
      && !excludedPatterns.some((pattern) => pattern.test(normalized));
  });
}

function parseSaifiSaidiHierarchyRow({ row, rowNumber, sheetName, fileName, hierarchyScope, columns }) {
  const valueAt = (key) => cleanCellText(row[columns[key]]);
  const parsed = {
    source_row_number: rowNumber,
    sheet_name: sheetName,
    file_name: fileName,
    source_text: row.map((cell) => cleanCellText(cell)).filter(Boolean).join(" "),
    hierarchy_scope: hierarchyScope,
    zone_name: valueAt("zone_name"),
    circle_name: valueAt("circle_name"),
    division_name: valueAt("division_name"),
    subdivision_name: valueAt("subdivision_name"),
    substation_name: valueAt("substation_name"),
    feeder_name: valueAt("feeder_name"),
    feeder_code: valueAt("feeder_code"),
    feeder_category: valueAt("feeder_category"),
    running_hours: parseHierarchyNumber(valueAt("running_hours")),
    total_feeders: hierarchyScope === "feeder_wise" ? 1 : parseHierarchyNumber(valueAt("total_feeders")),
    planned_saifi: parseHierarchyNumber(valueAt("planned_saifi")),
    planned_saidi_seconds: parseHierarchyDurationSeconds(valueAt("planned_saidi_seconds")),
    planned_saidi_display: valueAt("planned_saidi_seconds"),
    unplanned_saifi: parseHierarchyNumber(valueAt("unplanned_saifi")),
    unplanned_saidi_seconds: parseHierarchyDurationSeconds(valueAt("unplanned_saidi_seconds")),
    unplanned_saidi_display: valueAt("unplanned_saidi_seconds"),
    total_saifi: parseHierarchyNumber(valueAt("total_saifi")),
    total_saidi_seconds: parseHierarchyDurationSeconds(valueAt("total_saidi_seconds")),
    total_saidi_display: valueAt("total_saidi_seconds"),
    average_interruptions_per_feeder_per_day: parseHierarchyNumber(valueAt("average_interruptions_per_feeder_per_day")),
    average_hours_supply_seconds: parseHierarchyDurationSeconds(valueAt("average_hours_supply_seconds")),
    average_hours_supply_display: valueAt("average_hours_supply_seconds")
  };
  parsed.weight = hierarchyScope === "feeder_wise" ? 1 : Number(parsed.total_feeders || 0);
  if (hierarchyScope !== "feeder_wise" && !Number.isFinite(parsed.total_feeders)) {
    parsed.total_feeders = null;
    parsed.weight = 0;
  }
  const hasGroupValue = EXCEL_HIERARCHY_RELATIONS
    .flatMap((relation) => relation.groupFields)
    .some((field) => cleanCellText(parsed[field]));
  const hasMetricValue = EXCEL_HIERARCHY_METRICS.some((metric) => parsed[metric.key] !== null && parsed[metric.key] !== undefined);
  return hasGroupValue && hasMetricValue ? parsed : null;
}

function buildExcelOnlyHierarchyValidation(profiles) {
  const saifiReports = profiles.filter((profile) => profile.hierarchyScope && profile.validationGroup === "SAIFI SAIDI");
  if (!saifiReports.length) {
    return {
      state: "not_applicable",
      section_count: 0,
      match_count: 0,
      mismatch_count: 0,
      insufficient_context_count: 0,
      sections: []
    };
  }

  const reportsByScope = new Map();
  for (const report of saifiReports) {
    if (!reportsByScope.has(report.hierarchyScope)) reportsByScope.set(report.hierarchyScope, []);
    reportsByScope.get(report.hierarchyScope).push(report);
  }
  const sections = [];
  for (const relation of EXCEL_HIERARCHY_RELATIONS) {
    const baseReports = reportsByScope.get(relation.baseScope) || [];
    const rollupReports = reportsByScope.get(relation.rollupScope) || [];
    for (const baseReport of baseReports) {
      for (const rollupReport of rollupReports) {
        sections.push(buildExcelHierarchySection(relation, baseReport, rollupReport));
      }
    }
  }

  if (!sections.length) {
    return {
      state: "insufficient_context",
      section_count: 0,
      match_count: 0,
      mismatch_count: 0,
      insufficient_context_count: 0,
      sections: [],
      evidence: "No lower-to-higher SAIFI/SAIDI hierarchy pair was selected. Same-level SAIFI/SAIDI reports are compared directly when they share row labels and metric columns."
    };
  }

  const matchCount = sections.reduce((sum, section) => sum + Number(section.match_count || 0), 0);
  const mismatchCount = sections.reduce((sum, section) => sum + Number(section.mismatch_count || 0), 0);
  const insufficientContextCount = sections.reduce((sum, section) => sum + Number(section.insufficient_context_count || 0), 0);
  return {
    state: mismatchCount ? "mismatch" : matchCount ? "match" : "insufficient_context",
    section_count: sections.length,
    match_count: matchCount,
    mismatch_count: mismatchCount,
    insufficient_context_count: insufficientContextCount,
    sections
  };
}

function buildExcelHierarchySection(relation, baseReport, rollupReport) {
  const feederRows = baseReport.hierarchyRows || [];
  const rollupRows = rollupReport.hierarchyRows || [];
  const groupFieldLabel = hierarchyFieldList(relation.groupFields);
  const missingBaseFields = relation.groupFields.filter((field) => !feederRows.some((row) => cleanCellText(row[field])));
  const baseScopeLabel = excelHierarchyScopeLabel(relation.baseScope);
  const rollupScopeLabel = excelHierarchyScopeLabel(relation.rollupScope);
  if (!feederRows.length || !rollupRows.length || missingBaseFields.length) {
    const reason = !feederRows.length
      ? `No ${baseScopeLabel} detail rows were parsed from the selected Excel workbook.`
      : !rollupRows.length
        ? `No ${rollupScopeLabel} rollup rows were parsed from the selected Excel workbook.`
        : `${baseScopeLabel} source does not expose ${missingBaseFields.map(hierarchyFieldLabel).join(", ")} for grouping.`;
    return {
      section: relation.section,
      base_report: baseReport.file.name,
      rollup_report: rollupReport.file.name,
      source_parent_report: baseReport.file.name,
      child_report: baseReport.file.name,
      parent_report: rollupReport.file.name,
      base_scope: relation.baseScope,
      rollup_scope: relation.rollupScope,
      group_fields: relation.groupFields,
      state: "insufficient_context",
      group_count: 0,
      match_count: 0,
      mismatch_count: 0,
      insufficient_context_count: 1,
      groups: [],
      evidence: reason
    };
  }

  const feederGroups = new Map();
  for (const row of feederRows) {
    const key = hierarchyGroupKey(row, relation.groupFields);
    if (!key) continue;
    if (!feederGroups.has(key)) feederGroups.set(key, []);
    feederGroups.get(key).push(row);
  }

  const rollupKeys = new Set();
  const groups = rollupRows.map((rollupRow) => {
    const key = hierarchyGroupKey(rollupRow, relation.groupFields);
    rollupKeys.add(key);
    const sourceRows = feederGroups.get(key) || [];
    if (!sourceRows.length) {
      return {
        group_key: key,
        group_display: hierarchyDisplayKey(rollupRow, relation.groupFields),
        rollup_row_number: rollupRow.source_row_number,
        base_row_count: 0,
        child_row_count: 0,
        state: "insufficient_context",
        match_count: 0,
        mismatch_count: 0,
        insufficient_context_count: EXCEL_HIERARCHY_METRICS.length,
        comparisons: [],
        metrics: [],
        evidence: `No ${baseScopeLabel} source rows were found for ${groupFieldLabel}: ${hierarchyDisplayKey(rollupRow, relation.groupFields) || "-"}.`
      };
    }
    return compareExcelHierarchyGroup({ relation, feederReport: baseReport, rollupReport, rollupRow, sourceRows });
  });

  const missingRollupGroups = [...feederGroups.entries()]
    .filter(([key]) => !rollupKeys.has(key))
    .map(([key, rows]) => ({
      group_key: key,
      group_display: hierarchyDisplayKey(rows[0], relation.groupFields),
      base_row_count: rows.length,
      child_row_count: rows.length,
      state: "mismatch",
      evidence: `${baseScopeLabel} source rows exist for ${groupFieldLabel}: ${hierarchyDisplayKey(rows[0], relation.groupFields) || "-"}, but no ${rollupScopeLabel} rollup row was found.`
    }));

  const matchCount = groups.reduce((sum, group) => sum + Number(group.match_count || 0), 0);
  const mismatchCount =
    groups.reduce((sum, group) => sum + Number(group.mismatch_count || 0), 0) + missingRollupGroups.length;
  const insufficientContextCount = groups.reduce((sum, group) => sum + Number(group.insufficient_context_count || 0), 0);

  return {
    section: relation.section,
    base_report: baseReport.file.name,
    rollup_report: rollupReport.file.name,
    source_parent_report: baseReport.file.name,
    child_report: baseReport.file.name,
    parent_report: rollupReport.file.name,
    base_scope: relation.baseScope,
    rollup_scope: relation.rollupScope,
    group_fields: relation.groupFields,
    state: mismatchCount ? "mismatch" : matchCount ? "match" : "insufficient_context",
    group_count: groups.length,
    rollup_group_count: rollupRows.length,
    base_row_count: feederRows.length,
    match_count: matchCount,
    mismatch_count: mismatchCount,
    insufficient_context_count: insufficientContextCount,
    groups,
    missing_parent_groups: missingRollupGroups
  };
}

function compareExcelHierarchyGroup({ relation, feederReport, rollupReport, rollupRow, sourceRows }) {
  const aggregate = aggregateExcelHierarchyRows(sourceRows);
  const comparisons = EXCEL_HIERARCHY_METRICS.filter(
    (metric) => hasExcelHierarchyMetricValue(aggregate, metric.key) && hasExcelHierarchyMetricValue(rollupRow, metric.key)
  ).map((metric) => {
    const sourceValue = aggregate[metric.key];
    const rollupValue = rollupRow[metric.key];
    const state = compareExcelHierarchyValue(sourceValue, rollupValue, metric);
    return {
      metric: metric.key,
      label: metric.label,
      state,
      source_value: sourceValue,
      source_display: formatExcelHierarchyValue(sourceValue, metric.type),
      rollup_value: rollupValue,
      rollup_display: formatExcelHierarchyValue(rollupValue, metric.type),
      base_aggregated_value: sourceValue,
      base_aggregated_display: formatExcelHierarchyValue(sourceValue, metric.type),
      parent_value: rollupValue,
      parent_display: formatExcelHierarchyValue(rollupValue, metric.type)
    };
  });
  const mismatchCount = comparisons.filter((comparison) => comparison.state === "mismatch").length;
  const matchCount = comparisons.filter((comparison) => comparison.state === "match").length;
  const insufficientContextCount = comparisons.filter((comparison) => comparison.state === "insufficient_context").length;
  return {
    group_key: hierarchyGroupKey(rollupRow, relation.groupFields),
    group_display: hierarchyDisplayKey(rollupRow, relation.groupFields),
    rollup_row_number: rollupRow.source_row_number,
    base_row_count: sourceRows.length,
    child_row_count: sourceRows.length,
    base_weight: aggregate.weight,
    child_weight: aggregate.weight,
    state: mismatchCount ? "mismatch" : matchCount ? "match" : "insufficient_context",
    match_count: matchCount,
    mismatch_count: mismatchCount,
    insufficient_context_count: insufficientContextCount,
    comparisons,
    metrics: comparisons,
    evidence: `${feederReport.file.name} grouped by ${hierarchyFieldList(relation.groupFields)} compared with ${rollupReport.file.name}.`
  };
}

function hasExcelHierarchyMetricValue(row, key) {
  const value = row?.[key];
  return value !== null && value !== undefined && Number.isFinite(Number(value));
}

function aggregateExcelHierarchyRows(rows) {
  const totalWeight = rows.reduce((sum, row) => sum + (Number(row.weight) || 0), 0);
  const useEqualWeights = !totalWeight && rows.length > 0;
  const totalFeederValues = rows.map((row) => Number(row.total_feeders)).filter(Number.isFinite);
  const aggregate = {
    total_feeders: totalFeederValues.length ? totalFeederValues.reduce((sum, value) => sum + value, 0) : null,
    source_row_count: rows.length,
    weight: totalWeight || rows.length,
    weight_basis: totalWeight ? "total_feeders" : "visible_row_count"
  };
  for (const metric of EXCEL_HIERARCHY_METRICS.filter((item) => item.key !== "total_feeders")) {
    const comparableRows = rows.filter((row) => hasExcelHierarchyMetricValue(row, metric.key));
    if (!comparableRows.length) {
      aggregate[metric.key] = null;
      continue;
    }
    const weightSum = comparableRows.reduce((sum, row) => sum + (useEqualWeights ? 1 : (Number(row.weight) || 0)), 0);
    if (!weightSum) {
      aggregate[metric.key] = null;
      continue;
    }
    const weightedTotal = comparableRows.reduce((sum, row) => {
      const value = row[metric.key];
      return Number.isFinite(value) ? sum + (Number(value) * (useEqualWeights ? 1 : (Number(row.weight) || 0))) : sum;
    }, 0);
    aggregate[metric.key] = metric.type === "duration_hms" || metric.type === "duration_hm"
      ? Math.round(weightedTotal / weightSum)
      : roundNumber(weightedTotal / weightSum, 2);
  }
  return aggregate;
}

function hierarchyEvidenceRowsFromValidation(hierarchyValidation) {
  const rows = [];
  for (const section of hierarchyValidation?.sections || []) {
    const fieldLabel = hierarchyFieldList(section.group_fields || []);
    for (const group of section.groups || []) {
      for (const comparison of group.comparisons || group.metrics || []) {
        rows.push({
          metric: `${section.section} | ${group.group_display || group.group_key || "-"} | ${comparison.label || comparison.metric}`,
          excel: `${section.base_report || "Feeder Wise"} grouped by ${fieldLabel}: ${comparison.source_display || comparison.base_aggregated_display || "-"}`,
          pdf: `${section.rollup_report || "Rollup report"}: ${comparison.rollup_display || comparison.parent_display || "-"}`,
          status: comparison.state || group.state || section.state || "-"
        });
      }
    }
    for (const missingGroup of section.missing_parent_groups || []) {
      rows.push({
        metric: `${section.section} | ${missingGroup.group_display || missingGroup.group_key || "-"} | Rollup row presence`,
        excel: `${section.base_report || "Feeder Wise"} grouped by ${fieldLabel}: present`,
        pdf: `${section.rollup_report || "Rollup report"}: missing`,
        status: "mismatch"
      });
    }
  }
  return prioritizedEvidenceRows(rows, 200);
}

function hierarchyGroupKey(row, fields) {
  const values = fields.map((field) => normalizeHierarchyKey(row[field]));
  return values.every(Boolean) ? values.join("|") : "";
}

function hierarchyDisplayKey(row, fields) {
  return fields.map((field) => cleanCellText(row[field])).filter(Boolean).join(" / ");
}

function hierarchyFieldList(fields = []) {
  return fields.map(hierarchyFieldLabel).join(" + ") || "selected hierarchy fields";
}

function hierarchyFieldLabel(field) {
  return titleCase(String(field || "").replace(/_/g, " "));
}

function normalizeHierarchyKey(value) {
  return cleanCellText(value).toUpperCase().replace(/[^A-Z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function parseHierarchyNumber(value) {
  const text = cleanCellText(value).replace(/,/g, "");
  if (!text || text === "-") return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function parseHierarchyDurationSeconds(value) {
  const text = cleanCellText(value);
  const match = text.match(/^(\d{1,5}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] || 0);
}

function compareExcelHierarchyValue(sourceValue, rollupValue, metric) {
  if (sourceValue === null || sourceValue === undefined || rollupValue === null || rollupValue === undefined) {
    return "insufficient_context";
  }
  if (metric.type === "integer") {
    return Math.round(Number(sourceValue)) === Math.round(Number(rollupValue)) ? "match" : "mismatch";
  }
  if (metric.type === "duration_hms") {
    return Math.abs(Number(sourceValue) - Number(rollupValue)) <= 1 ? "match" : "mismatch";
  }
  if (metric.type === "duration_hm") {
    return Math.abs(Number(sourceValue) - Number(rollupValue)) <= 60 ? "match" : "mismatch";
  }
  return excelHierarchyValuesMatch(Number(sourceValue), Number(rollupValue)) ? "match" : "mismatch";
}

function excelHierarchyValuesMatch(left, right) {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  const diff = Math.abs(left - right);
  const relative = diff / Math.max(Math.abs(left), Math.abs(right), 1);
  return diff <= EXCEL_HIERARCHY_ABSOLUTE_TOLERANCE || relative <= EXCEL_HIERARCHY_RELATIVE_TOLERANCE;
}

function formatExcelHierarchyValue(value, type) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  if (type === "duration_hms") return secondsToHms(value);
  if (type === "duration_hm") return secondsToHm(value);
  if (type === "integer") return String(Math.round(Number(value)));
  return roundNumber(Number(value), 2).toFixed(2);
}

function secondsToHms(value) {
  const total = Math.max(0, Math.round(Number(value) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function secondsToHm(value) {
  const total = Math.max(0, Math.round(Number(value) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.round((total % 3600) / 60);
  const adjustedHours = hours + Math.floor(minutes / 60);
  const adjustedMinutes = minutes % 60;
  return `${String(adjustedHours).padStart(2, "0")}:${String(adjustedMinutes).padStart(2, "0")}`;
}

function roundNumber(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function extractMetricValuesFromSheet(rows, sheetName) {
  const headerIndex = findTabularHeaderRow(rows);
  if (headerIndex < 0) return extractFallbackMetricValuesFromSheet(rows, sheetName);

  const headers = rows[headerIndex].map((cell) => cleanCellText(cell));
  const labelColumnIndex = findRowLabelColumn(headers);
  const metricValues = [];

  for (const row of rows.slice(headerIndex + 1)) {
    const rowLabel = cleanCellText(row[labelColumnIndex]);
    if (!rowLabel || isHeaderLikeLabel(rowLabel)) continue;

    for (let columnIndex = 0; columnIndex < headers.length; columnIndex += 1) {
      if (columnIndex === labelColumnIndex) continue;
      const header = cleanCellText(headers[columnIndex]);
      if (!header) continue;
      if (isNonComparableExcelMetricHeader(header)) continue;
      const value = cleanCellText(row[columnIndex]);
      if (!value) continue;
      const normalizedHeader = normalizeExcelMetricHeader(header);
      const label = `${rowLabel} / ${normalizedHeader}`;
      metricValues.push({
        key: normalizeMetricKey(`${sheetName} ${rowLabel} ${normalizedHeader}`),
        sheetName,
        label,
        value,
        rowLabel,
        columnHeader: normalizedHeader,
        sourceColumnHeader: header
      });
    }
  }

  return metricValues.length ? metricValues : extractFallbackMetricValuesFromSheet(rows, sheetName);
}

function extractSummaryValuesFromSheet(rows, sheetName) {
  const headerIndex = findTabularHeaderRow(rows);
  const summaryRows = rows.slice(0, headerIndex >= 0 ? headerIndex : Math.min(rows.length, 16));
  const summaryValues = [];
  for (const row of summaryRows) {
    const cells = row.map((cell) => cleanCellText(cell));
    for (const cell of cells) {
      const match = cell.match(/^(.{2,80}?)\s*:\s*(.{1,120})$/);
      if (!match) continue;
      const label = cleanCellText(match[1]);
      const value = cleanCellText(match[2]);
      if (!isComparableSummaryLabel(label) || !isComparableSummaryValue(value)) continue;
      summaryValues.push({
        key: normalizeMetricKey(`summary ${label}`),
        sheetName,
        label,
        value,
        source: "summary_abstract"
      });
    }
    for (let index = 0; index < cells.length - 1; index += 1) {
      const label = cells[index];
      const value = cells[index + 1];
      if (!isComparableSummaryLabel(label) || !isComparableSummaryValue(value)) continue;
      summaryValues.push({
        key: normalizeMetricKey(`summary ${label}`),
        sheetName,
        label,
        value,
        source: "summary_abstract"
      });
    }
  }
  const unique = new Map();
  for (const value of summaryValues) {
    const key = `${value.key}\u0000${value.value}`;
    if (!unique.has(key)) unique.set(key, value);
  }
  return [...unique.values()];
}

function isComparableSummaryLabel(label) {
  const text = cleanCellText(label);
  if (!text || text.length > 80) return false;
  if (isNonComparableExcelMetricHeader(text)) return false;
  return /\b(report\s+date|date|from|to|duration|period|total|count|records?|feeders?|average|avg|saifi|saidi|planned|unplanned|availability|abstract|summary|percentage|percent|%)\b/i.test(text);
}

function isComparableSummaryValue(value) {
  const text = cleanCellText(value);
  if (!text || text === "-") return false;
  return isExcelNumericText(text) || /\b\d{1,2}[-/]\d{1,2}[-/]\d{4}\b/.test(text) || /^\d{1,5}:\d{2}(?::\d{2})?$/.test(text);
}

function findTabularHeaderRow(rows) {
  const directIndex = rows.findIndex((row) => {
    const cells = row.map((cell) => cleanCellText(cell));
    return cells.filter(Boolean).length >= 3 && cells.some((cell) => /\b(date|time)\b/i.test(cell));
  });
  if (directIndex >= 0) return directIndex;
  return rows.findIndex((row, index) => {
    const cells = row.map((cell) => cleanCellText(cell));
    const next = rows[index + 1] || [];
    return cells.filter(Boolean).length >= 3 && next.filter((cell) => cleanCellText(cell)).length >= 3;
  });
}

function findRowLabelColumn(headers) {
  const dateIndex = headers.findIndex((header) => /\b(date|time)\b/i.test(header));
  if (dateIndex >= 0) return dateIndex;
  return headers.findIndex(Boolean) >= 0 ? headers.findIndex(Boolean) : 0;
}

function isHeaderLikeLabel(value) {
  return /^(date|time|date time|s\.?no|serial|name)$/i.test(String(value || "").replace(/\s+/g, " ").trim());
}

function extractFallbackMetricValuesFromSheet(rows, sheetName) {
  const metricValues = [];
  for (const row of rows) {
    let label = "";
    let value = "";
    for (const cell of row) {
      const text = cleanCellText(cell);
      if (!text) continue;
      if (!label && Number.isNaN(Number(text.replace(/,/g, "")))) label = text;
      if (value === "" && !Number.isNaN(Number(text.replace(/,/g, "")))) value = text;
    }
    if (label && value !== "") {
      if (isNonComparableExcelMetricHeader(label)) continue;
      metricValues.push({
        key: normalizeMetricKey(`${sheetName} ${label}`),
        sheetName,
        label,
        value
      });
    }
  }
  return metricValues;
}

function isNonComparableExcelMetricHeader(header) {
  const text = cleanCellText(header).replace(/\s+/g, " ");
  return /^(s\.?\s*no\.?|sr\.?\s*no\.?|serial(?:\s+no\.?)?|index|#|no\.?|id|code|name|date|time|date\s*time)$/i.test(text)
    || /\b(?:name|code|id)\b$/i.test(text);
}

function normalizeExcelMetricHeader(header) {
  const original = cleanCellText(header).replace(/\s+/g, " ");
  const compact = original.toUpperCase().replace(/[^A-Z0-9]+/g, "");
  const normalized = original.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();

  if (compact === "VRY" || compact === "VOLTAGERYPHASE") return "Voltage RY";
  if (compact === "VYB" || compact === "VOLTAGEYBPHASE") return "Voltage YB";
  if (compact === "VBR" || compact === "VOLTAGEBRPHASE") return "Voltage BR";
  if (compact === "IR" || compact === "CURRENTRPHASE") return "Current R";
  if (compact === "IY" || compact === "CURRENTYPHASE") return "Current Y";
  if (compact === "IB" || compact === "CURRENTBPHASE") return "Current B";
  if (compact === "PF" || compact === "POWERFACTOR") return "Power Factor";
  if (compact === "HZ" || compact === "FREQUENCY") return "Frequency";
  if (compact === "MW" || compact === "ACTIVEPOWER") return "Active Power";
  if (compact === "MVAR" || compact === "REACTIVEPOWER") return "Reactive Power";
  if (compact === "MVA" || compact === "APPARENTPOWER") return "Apparent Power";
  if (compact === "MWHI" || compact === "ACTIVEENERGYIMPORT") return "Active Energy Import";
  if (compact === "MWHE" || compact === "ACTIVEENERGYEXPORT") return "Active Energy Export";
  if (compact === "MVARHI" || compact === "REACTIVEENERGYIMPORT") return "Reactive Energy Import";
  if (compact === "MVARHE" || compact === "REACTIVEENERGYEXPORT") return "Reactive Energy Export";

  return titleCase(normalized.toLowerCase()) || original;
}

function cleanCellText(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\r?\n/g, " ").trim();
}

function buildExcelOnlyComparison(profiles, hierarchyValidation = null) {
  const groupedProfiles = groupExcelProfilesByValidationFamily(profiles);
  const matchRows = [];
  const mismatchRows = [];
  const skippedGroups = [];
  const groups = [];
  const hasHierarchySections = Number(hierarchyValidation?.section_count || 0) > 0;

  for (const [groupName, groupProfiles] of groupedProfiles.entries()) {
    groups.push({
      name: groupName,
      report_count: groupProfiles.length,
      reports: groupProfiles.map((profile) => profile.reportName || profile.file.name)
    });
    if (groupName === "SAIFI SAIDI") {
      const groupComparison = compareSaifiSaidiProfilesWithinGroup(groupName, groupProfiles);
      matchRows.push(...groupComparison.matchRows);
      mismatchRows.push(...groupComparison.mismatchRows);
      if (!groupComparison.matchRows.length && !groupComparison.mismatchRows.length) {
        skippedGroups.push({
          group: groupName,
          reason: hasHierarchySections
            ? "SAIFI/SAIDI reports are validated through selected lower-to-higher hierarchy rollup comparison."
            : "No same-level SAIFI/SAIDI reports shared both row labels and metric columns. Select matching report levels, or select a lower-level report with its parent rollup report.",
          reports: groupProfiles.map((profile) => profile.reportName || profile.file.name)
        });
      }
      continue;
    }
    if (groupProfiles.length < 2) {
      skippedGroups.push({
        group: groupName,
        reason: "Only one selected report exists in this family, so cross-report comparison was not run.",
        reports: groupProfiles.map((profile) => profile.reportName || profile.file.name)
      });
      continue;
    }

    const groupComparison = compareExcelProfilesWithinGroup(groupName, groupProfiles);
    matchRows.push(...groupComparison.matchRows);
    mismatchRows.push(...groupComparison.mismatchRows);
  }

  return {
    matchRows,
    mismatchRows,
    groups,
    skippedGroups,
    skippedCrossFamilyPairCount: countSkippedCrossFamilyPairs(groupedProfiles)
  };
}

function buildExcelOnlyPairwiseDetails(comparison = {}) {
  const pairMap = new Map();
  const comparisonRows = [...(comparison.mismatchRows || []), ...(comparison.matchRows || [])];

  for (const row of comparisonRows) {
    const leftReport = excelOnlyComparisonReportName(row.left_report, row.excel, "Report 1");
    const rightReport = excelOnlyComparisonReportName(row.right_report, row.pdf, "Report 2");
    const groupName = row.validation_group || row.groupName || "Cross-Excel";
    const key = `${groupName}\u0000${leftReport}\u0000${rightReport}`;
    if (!pairMap.has(key)) {
      pairMap.set(key, {
        group: groupName,
        left_report: leftReport,
        right_report: rightReport,
        state: "match",
        evidence: "",
        comparisons: []
      });
    }
    const pair = pairMap.get(key);
    const state = String(row.status || "").toLowerCase();
    if (state.includes("mismatch") || state.includes("not ok")) pair.state = "mismatch";
    pair.comparisons.push({
      source: row.source || row.validation_group || "cross_excel_comparison",
      row_label: row.row_label || row.sheet_name || "-",
      metric: row.metric || row.metric_key || "-",
      left_display_value: row.left_value ?? excelOnlyComparisonValue(row.excel),
      right_display_value: row.right_value ?? excelOnlyComparisonValue(row.pdf),
      state: row.status || "-"
    });
  }

  for (const skippedGroup of comparison.skippedGroups || []) {
    const reports = Array.isArray(skippedGroup.reports) ? skippedGroup.reports.filter(Boolean) : [];
    for (let leftIndex = 0; leftIndex < reports.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < reports.length; rightIndex += 1) {
        const leftReport = reports[leftIndex];
        const rightReport = reports[rightIndex];
        const groupName = skippedGroup.group || "Cross-Excel";
        const key = `${groupName}\u0000${leftReport}\u0000${rightReport}`;
        if (pairMap.has(key)) continue;
        pairMap.set(key, {
          group: groupName,
          left_report: leftReport,
          right_report: rightReport,
          state: "insufficient_context",
          evidence: skippedGroup.reason || "No detailed comparisons were available.",
          comparisons: []
        });
      }
    }
  }

  return [...pairMap.values()];
}

function excelOnlyComparisonReportName(explicitName, valueWithName, fallback) {
  const explicit = String(explicitName || "").trim();
  if (explicit) return explicit;
  const parsed = String(valueWithName || "").split(":")[0]?.trim();
  return parsed || fallback;
}

function excelOnlyComparisonValue(valueWithName) {
  const text = String(valueWithName || "");
  const separatorIndex = text.indexOf(":");
  return separatorIndex >= 0 ? text.slice(separatorIndex + 1).trim() : text || "-";
}

function compareExcelProfilesWithinGroup(groupName, profiles) {
  const byMetric = new Map();
  for (const profile of profiles) {
    for (const metric of excelComparableValuesForProfile(profile)) {
      if (!byMetric.has(metric.key)) byMetric.set(metric.key, []);
      byMetric.get(metric.key).push({
        groupName,
        fileName: profile.file.name,
        sheetName: metric.sheetName,
        label: metric.label,
        value: metric.value,
        source: metric.source || "row_level"
      });
    }
  }

  const matchRows = [];
  const mismatchRows = [];
  for (const entries of byMetric.values()) {
    const uniqueFiles = [...new Map(entries.map((entry) => [entry.fileName, entry])).values()];
    if (uniqueFiles.length < 2) continue;
    const first = uniqueFiles[0];
    for (const other of uniqueFiles.slice(1)) {
      const state = equivalentExcelValue(first.value, other.value) ? "match" : "mismatch";
      const isSummary = first.source === "summary_abstract";
      const row = {
        metric: isSummary ? `${groupName} | Summary/Abstract: ${first.label}` : `${groupName} | ${first.sheetName}: ${first.label}`,
        excel: `${first.fileName}: ${first.value}`,
        pdf: `${other.fileName}: ${other.value}`,
        status: state,
        validation_group: groupName,
        source: first.source || "row_level",
        left_report: first.fileName,
        right_report: other.fileName,
        left_value: first.value,
        right_value: other.value,
        row_label: first.label,
        sheet_name: first.sheetName
      };
      if (state === "match") matchRows.push(row);
      else mismatchRows.push(row);
      if (mismatchRows.length >= 200) break;
    }
    if (mismatchRows.length >= 200) break;
  }
  return { matchRows, mismatchRows };
}

function excelComparableValuesForProfile(profile = {}) {
  const rows = [];
  for (const sheet of profile.sheetProfiles || []) {
    rows.push(...(sheet.metricValues || []).map((metric) => ({ ...metric, source: metric.source || "row_level" })));
    rows.push(...(sheet.summaryValues || []).map((metric) => ({ ...metric, source: "summary_abstract" })));
  }
  return rows;
}

function crossExcelMismatchValueDetail(comparison, profile = null, limit = 6) {
  const profileNames = new Set(
    [
      profile?.file?.name,
      profile?.reportName
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  );
  const rows = (comparison?.mismatchRows || []).filter((row) => {
    if (!profileNames.size) return true;
    return [row.left_report, row.right_report, row.excel, row.pdf]
      .some((value) => [...profileNames].some((name) => String(value || "").includes(name)));
  });
  if (!rows.length) return "";
  const samples = rows.slice(0, limit).map((row) => {
    const leftReport = row.left_report || String(row.excel || "").split(":")[0] || "Report 1";
    const rightReport = row.right_report || String(row.pdf || "").split(":")[0] || "Report 2";
    const leftValue = row.left_value ?? String(row.excel || "").replace(/^[^:]+:\s*/, "");
    const rightValue = row.right_value ?? String(row.pdf || "").replace(/^[^:]+:\s*/, "");
    return `${row.metric || row.row_label || "Metric"} -> ${leftReport}: ${leftValue}, ${rightReport}: ${rightValue}`;
  });
  const extraCount = Math.max(0, rows.length - samples.length);
  return `Mismatch value detail: ${samples.join("; ")}${extraCount ? `; ${extraCount} more mismatch(es)` : ""}.`;
}

function hierarchyMismatchValueDetail(section, limit = 6) {
  const rows = [];
  const fieldLabel = hierarchyFieldList(section?.group_fields || []);
  for (const group of section?.groups || []) {
    for (const comparison of group.comparisons || group.metrics || []) {
      if (comparison.state !== "mismatch") continue;
      rows.push(
        `${group.group_display || group.group_key || "-"} / ${comparison.label || comparison.metric || "Metric"} -> `
        + `${section.base_report || "Source report"} grouped by ${fieldLabel}: ${comparison.source_display || comparison.base_aggregated_display || "-"}, `
        + `${section.rollup_report || "Rollup report"}: ${comparison.rollup_display || comparison.parent_display || "-"}`
      );
    }
  }
  for (const missingGroup of section?.missing_parent_groups || []) {
    rows.push(
      `${missingGroup.group_display || missingGroup.group_key || "-"} / Rollup row presence -> `
      + `${section.base_report || "Source report"} grouped by ${fieldLabel}: present, `
      + `${section.rollup_report || "Rollup report"}: missing`
    );
  }
  if (!rows.length) return "";
  const samples = rows.slice(0, limit);
  const extraCount = Math.max(0, rows.length - samples.length);
  return `Mismatch value detail: ${samples.join("; ")}${extraCount ? `; ${extraCount} more mismatch(es)` : ""}.`;
}

function compareSaifiSaidiProfilesWithinGroup(groupName, profiles) {
  const matchRows = [];
  const mismatchRows = [];
  const comparableProfiles = profiles.filter((profile) => profile.hierarchyScope && (profile.hierarchyRows || []).length);

  for (let leftIndex = 0; leftIndex < comparableProfiles.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < comparableProfiles.length; rightIndex += 1) {
      const leftProfile = comparableProfiles[leftIndex];
      const rightProfile = comparableProfiles[rightIndex];
      if (leftProfile.hierarchyScope !== rightProfile.hierarchyScope) continue;
      const comparison = compareSaifiSaidiSameScopePair(groupName, leftProfile, rightProfile);
      matchRows.push(...comparison.matchRows);
      mismatchRows.push(...comparison.mismatchRows);
    }
  }

  return { matchRows, mismatchRows };
}

function compareSaifiSaidiSameScopePair(groupName, leftProfile, rightProfile) {
  const leftRows = leftProfile.hierarchyRows || [];
  const rightRows = rightProfile.hierarchyRows || [];
  const keyFields = sameScopeSaifiSaidiKeyFields(leftProfile.hierarchyScope, leftRows, rightRows);
  if (!keyFields.length) return { matchRows: [], mismatchRows: [] };

  const rightRowsByKey = new Map();
  for (const row of rightRows) {
    const key = hierarchyGroupKey(row, keyFields);
    if (key && !rightRowsByKey.has(key)) rightRowsByKey.set(key, row);
  }

  const matchRows = [];
  const mismatchRows = [];
  for (const leftRow of leftRows) {
    const key = hierarchyGroupKey(leftRow, keyFields);
    if (!key) continue;
    const rightRow = rightRowsByKey.get(key);
    if (!rightRow) continue;
    const displayKey = hierarchyDisplayKey(leftRow, keyFields) || hierarchyDisplayKey(rightRow, keyFields);
    const commonMetrics = commonSaifiSaidiMetrics(leftRow, rightRow);
    for (const metric of commonMetrics) {
      const leftValue = leftRow[metric.key];
      const rightValue = rightRow[metric.key];
      const state = compareExcelHierarchyValue(leftValue, rightValue, metric);
      if (state === "insufficient_context") continue;
      const row = {
        metric: `${groupName} | ${excelHierarchyScopeLabel(leftProfile.hierarchyScope)} | ${displayKey || "-"} | ${metric.label}`,
        excel: `${leftProfile.file.name}: ${formatExcelHierarchyValue(leftValue, metric.type)}`,
        pdf: `${rightProfile.file.name}: ${formatExcelHierarchyValue(rightValue, metric.type)}`,
        status: state,
        validation_group: groupName,
        source: "saifi_saidi_same_scope_comparison",
        hierarchy_scope: leftProfile.hierarchyScope,
        row_label: displayKey || "",
        metric_key: metric.key,
        left_report: leftProfile.file.name,
        right_report: rightProfile.file.name,
        left_value: formatExcelHierarchyValue(leftValue, metric.type),
        right_value: formatExcelHierarchyValue(rightValue, metric.type)
      };
      if (state === "match") matchRows.push(row);
      else mismatchRows.push(row);
      if (mismatchRows.length >= 200) return { matchRows, mismatchRows };
    }
  }
  return { matchRows, mismatchRows };
}

function sameScopeSaifiSaidiKeyFields(scope, leftRows, rightRows) {
  const preferred = EXCEL_HIERARCHY_SCOPE_IDENTITY_FIELDS[scope] || [];
  const fields = preferred.filter((field) => hierarchyFieldExists(leftRows, field) && hierarchyFieldExists(rightRows, field));
  if (!fields.length) return [];
  const terminalField = [...preferred].reverse().find((field) => hierarchyFieldExists(leftRows, field) && hierarchyFieldExists(rightRows, field));
  if (terminalField && !fields.includes(terminalField)) fields.push(terminalField);
  return fields;
}

function hierarchyFieldExists(rows, field) {
  return rows.some((row) => cleanCellText(row[field]));
}

function commonSaifiSaidiMetrics(leftRow, rightRow) {
  return EXCEL_HIERARCHY_METRICS.filter((metric) => {
    if (metric.key === "total_feeders") return false;
    return leftRow[metric.key] !== null
      && leftRow[metric.key] !== undefined
      && rightRow[metric.key] !== null
      && rightRow[metric.key] !== undefined;
  });
}

function excelHierarchyScopeLabel(scope) {
  return EXCEL_HIERARCHY_SCOPE_LABELS[scope] || titleCase(String(scope || "SAIFI/SAIDI").replace(/_/g, " "));
}

function groupExcelProfilesByValidationFamily(profiles) {
  const grouped = new Map();
  for (const profile of profiles) {
    const groupName = profile.validationGroup || inferExcelReportValidationGroup(profile.file.name);
    if (!grouped.has(groupName)) grouped.set(groupName, []);
    grouped.get(groupName).push(profile);
  }
  return grouped;
}

function countSkippedCrossFamilyPairs(groupedProfiles) {
  const counts = [...groupedProfiles.values()].map((items) => items.length);
  let skipped = 0;
  for (let leftIndex = 0; leftIndex < counts.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < counts.length; rightIndex += 1) {
      skipped += counts[leftIndex] * counts[rightIndex];
    }
  }
  return skipped;
}

function inferExcelReportValidationGroup(fileName) {
  const base = path.basename(String(fileName || ""), path.extname(String(fileName || "")));
  const normalized = base
    .toLowerCase()
    .replace(/\b\d{1,2}[_-]\d{1,2}[_-]\d{4}(?:[_-]\d{1,2}){0,3}\b/g, " ")
    .replace(/\b\d{4}[-_]\d{2}[-_]\d{2}\b/g, " ")
    .replace(/[_.,()[\]-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (/\b(saifi|saidi)\b/i.test(normalized)) return "SAIFI SAIDI";
  if (/\banalog\b/i.test(normalized)) return "Analog Parameters";
  if (/\b(maximum|minimum|max|min|mva|md|pf)\b/i.test(normalized)) return "Maximum Minimum / VI PF MVA MD";

  const genericTokens = normalized
    .split(" ")
    .filter((token) => token && !/^(report|data|sheet|wise|file|excel|workbook|daily|monthly|summary)$/.test(token) && !/^\d+$/.test(token));
  return titleCase(genericTokens.slice(0, 3).join(" ") || "General Excel Report");
}

function titleCase(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function equivalentExcelValue(left, right) {
  const leftText = cleanCellText(left);
  const rightText = cleanCellText(right);
  const leftNumber = Number(leftText.replace(/,/g, ""));
  const rightNumber = Number(rightText.replace(/,/g, ""));
  if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) {
    return Math.abs(leftNumber - rightNumber) <= 0.01;
  }
  return leftText.toLowerCase() === rightText.toLowerCase();
}

function buildExcelOnlyDesignRows(checklist, profiles) {
  if (!checklist?.available) return missingChecklistSectionRows(checklist, profiles, "Excel Design");
  const checklistPoints = checklist.points.length ? checklist.points : [
    { section: "Excel Design", text: "Workbook opens and contains readable report sheets." },
    { section: "Excel Design", text: "Report header or title is present in the workbook." },
    { section: "Excel Design", text: "Workbook layout has populated rows and columns." }
  ];
  return checklistPoints.slice(0, 120).map((point, index) => {
    const statuses = {};
    for (const profile of profiles) {
      statuses[profile.file.name] = enrichExcelMatrixStatus({
        area: "Design",
        checkPoint: point.text,
        profile,
        status: evaluateExcelDesignPoint(point.text, profile)
      });
    }
    return {
      s_no: index + 1,
      section: point.section || "Excel Design",
      check_point: point.text,
      remarks: excelMatrixRowRemarks(statuses),
      statuses
    };
  });
}

function buildExcelOnlyDataRows(checklist, profiles, comparison, hierarchyValidation = null) {
  if (!checklist?.available) return missingChecklistSectionRows(checklist, profiles, "Excel Data");
  const checklistPoints = filterDataChecklistPointsForSelectedReports(
    checklist.points.length ? checklist.points : [
    { section: "Excel Data", text: "Workbook has readable data rows." },
    { section: "Excel Data", text: "No formula error values are present." },
    { section: "Excel Data", text: "Common metrics match across selected Excel reports." },
    { section: "Excel Data", text: "Date or period value is detectable in selected Excel report." }
    ],
    profiles
  );
  return checklistPoints.slice(0, 120).map((point, index) => {
    const statuses = {};
    for (const profile of profiles) {
      statuses[profile.file.name] = enrichExcelMatrixStatus({
        area: "Data",
        checkPoint: point.text,
        profile,
        status: evaluateExcelDataPoint(point.text, profile, comparison, profiles.length, profiles, hierarchyValidation)
      });
    }
    return {
      s_no: index + 1,
      section: point.section || "Excel Data",
      check_point: point.text,
      remarks: excelMatrixRowRemarks(statuses),
      statuses
    };
  });
}

function filterDataChecklistPointsForSelectedReports(points, profiles = []) {
  const selectedFamilies = new Set(
    profiles
      .map((profile) => dataValidationFamilyKey(profile.validationGroup || inferExcelReportValidationGroup(profile.file?.name || "")))
      .filter(Boolean)
  );
  if (!selectedFamilies.size || selectedFamilies.has("mixed")) return points;

  return points.filter((point) => {
    const pointFamily = dataChecklistPointFamily(point);
    return pointFamily === "generic" || selectedFamilies.has(pointFamily);
  });
}

function dataValidationFamilyKey(value) {
  const text = cleanCellText(value).toLowerCase();
  if (/\bsaifi\b|\bsaidi\b/.test(text)) return "saifi_saidi";
  if (/\banalog\b/.test(text)) return "analog";
  if (!text || text === "generic") return "";
  return "mixed";
}

function dataChecklistPointFamily(point) {
  const text = cleanCellText(`${point?.section || ""} ${point?.text || ""}`).toLowerCase();
  if (/\bsaifi\b|\bsaidi\b/.test(text)) return "saifi_saidi";
  if (isAnalogDataChecklistPoint(text)) return "analog";
  return "generic";
}

function isAnalogDataChecklistPoint(text) {
  return /\b(?:analog|vry|vyb|vbr|ir|iy|ib|voltage|current|power\s*factor|pf|mva|mvar|mw|md|mwh|energy\s+import|energy\s+export|frequency|transformer|capacitor|cap\s*bank|apparent\s+power|active\s+power|reactive\s+power)\b/i.test(text);
}

function missingChecklistSectionRows(checklist, profiles, section) {
  const message = checklist?.message || `${section} related checklist sheet not available in the selected checklist workbook.`;
  const analyzedSheetText = (checklist?.analyzedSheets || [])
    .map((sheet) => `${sheet.sheetName || "-"} (${sheet.pointCount || 0} point(s))`)
    .join(", ");
  const evidence = analyzedSheetText
    ? `${message} Analyzed checklist sheets: ${analyzedSheetText}.`
    : message;
  const statuses = {};
  for (const profile of profiles) {
    statuses[profile.file.name] = enrichExcelMatrixStatus({
      area: section,
      checkPoint: message,
      profile,
      status: matrixStatus("NA", evidence)
    });
  }
  return [{
    s_no: 1,
    section,
    check_point: message,
    remarks: excelMatrixRowRemarks(statuses),
    statuses
  }];
}

function excelProfileVisibleText(profile) {
  return (profile.sheetProfiles || [])
    .flatMap((sheet) => sheet.textValues || [])
    .map((value) => String(value || ""))
    .join(" ");
}

function uniqueRegexMatches(text, pattern) {
  return [...new Set(Array.from(String(text || "").matchAll(pattern), (match) => match[0]))];
}

function dateTimeFormatTokens(profile) {
  const text = excelProfileVisibleText(profile);
  return {
    dateOnly: uniqueRegexMatches(text, /\b\d{1,2}[-/]\d{1,2}[-/]\d{4}\b(?!\s*\d{1,2}:\d{2})/g),
    minute: uniqueRegexMatches(text, /\b\d{1,2}[-/]\d{1,2}[-/]\d{4}\s*\d{1,2}:\d{2}\b(?!:\d{2})/g),
    second: uniqueRegexMatches(text, /\b\d{1,2}[-/]\d{1,2}[-/]\d{4}\s*\d{1,2}:\d{2}:\d{2}\b(?!\.\d)/g),
    millisecond: uniqueRegexMatches(text, /\b\d{1,2}[-/]\d{1,2}[-/]\d{4}\s*\d{1,2}:\d{2}:\d{2}\.\d{1,3}\b/g),
    month: uniqueRegexMatches(text, /\b[A-Z]{3}[-/]\d{4}\b/gi)
  };
}

function detectedDateTimeFormatSummary(tokens) {
  const detected = [];
  if (tokens.dateOnly.length) detected.push(`DD-MM-YYYY (${tokens.dateOnly.slice(0, 2).join(", ")})`);
  if (tokens.minute.length) detected.push(`DD-MM-YYYY HH:MM (${tokens.minute.slice(0, 2).join(", ")})`);
  if (tokens.second.length) detected.push(`DD-MM-YYYY HH:MM:SS (${tokens.second.slice(0, 2).join(", ")})`);
  if (tokens.millisecond.length) detected.push(`DD-MM-YYYY HH:MM:SS.sss (${tokens.millisecond.slice(0, 2).join(", ")})`);
  if (tokens.month.length) detected.push(`MMM-YYYY (${tokens.month.slice(0, 2).join(", ")})`);
  return detected.length ? `Detected format(s): ${detected.join("; ")}.` : "No date or date-time token was detected in workbook text.";
}

function isExcelNumericText(value) {
  return parseExcelNumericValue(value) !== null;
}

function parseExcelNumericValue(value) {
  const text = cleanCellText(value).replace(/,/g, "").replace(/%$/, "");
  if (!text || text === "-") return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function excelDecimalDigitCount(value) {
  const text = cleanCellText(value).replace(/,/g, "");
  const match = text.match(/^-?\d+\.(\d+)%?$/);
  return match ? match[1].length : 0;
}

function excelNumericMetricValues(profile = {}) {
  return excelComparableValuesForProfile(profile)
    .filter((metric) => metric.source !== "summary_abstract")
    .filter((metric) => parseExcelNumericValue(metric.value) !== null)
    .filter((metric) => !isNonComparableExcelMetricHeader(metric.sourceColumnHeader || metric.columnHeader || metric.label));
}

function excelDecimalPrecisionStatus(profile = {}) {
  const metrics = excelNumericMetricValues(profile);
  if (!metrics.length) return matrixStatus("NA", "No comparable float/real numeric data column was detected after excluding S.No, serial, name, code, date, and time fields.");
  const violations = metrics.filter((metric) => excelDecimalDigitCount(metric.value) > 2);
  if (!violations.length) {
    return matrixStatus("OK", `${metrics.length} numeric data value(s) were checked after excluding S.No/serial fields; no value used more than two decimal digits.`);
  }
  return matrixStatus(
    "NOT OK",
    `${violations.length} numeric data value(s) use more than two decimal digits after excluding S.No/serial fields. Examples: ${violations.slice(0, 6).map((metric) => `${metric.label}=${metric.value}`).join("; ")}.`
  );
}

function excelPercentRangeStatus(profile = {}) {
  const percentMetrics = excelComparableValuesForProfile(profile)
    .filter((metric) => /%|percent|percentage/i.test(`${metric.sourceColumnHeader || ""} ${metric.columnHeader || ""} ${metric.label || ""}`))
    .filter((metric) => parseExcelNumericValue(metric.value) !== null);
  if (!percentMetrics.length) return matrixStatus("NA", "No percentage column was detected in this Excel report.");
  const violations = percentMetrics.filter((metric) => {
    const number = parseExcelNumericValue(metric.value);
    return number < 0 || number > 100;
  });
  if (!violations.length) return matrixStatus("OK", `${percentMetrics.length} percentage value(s) were checked and all are between 0 and 100.`);
  return matrixStatus(
    "NOT OK",
    `${violations.length} percentage value(s) are outside 0 to 100. Examples: ${violations.slice(0, 6).map((metric) => `${metric.label}=${metric.value}`).join("; ")}.`
  );
}

function excelSummaryAbstractStatus(profile = {}, comparison = null, selectedExcelCount = 1) {
  const summaryValues = profile.summaryValues || [];
  if (!summaryValues.length) return matrixStatus("NA", "No comparable summary/abstract value was detected in the header/summary area of this Excel report.");
  if (selectedExcelCount < 2 || !comparison) {
    return matrixStatus("OK", `${summaryValues.length} summary/abstract value(s) were detected for single-report validation.`);
  }
  const counts = summaryAbstractComparisonCounts(comparison, profile);
  if (counts.mismatch) {
    return matrixStatus("NOT OK", `${counts.mismatch} summary/abstract mismatch(es) found. ${crossExcelMismatchValueDetail({ mismatchRows: counts.mismatchRows }, profile)}`);
  }
  if (counts.match) return matrixStatus("OK", `${counts.match} summary/abstract value comparison(s) matched across selected Excel reports.`);
  return matrixStatus("NA", "Summary/abstract values were detected, but no common summary/abstract label was available across the selected comparable reports.");
}

function summaryAbstractComparisonCounts(comparison = {}, profile = null) {
  const profileNames = new Set([profile?.file?.name, profile?.reportName].map((value) => cleanCellText(value)).filter(Boolean));
  const inProfile = (row) => !profileNames.size || [row.left_report, row.right_report, row.excel, row.pdf].some((value) => [...profileNames].some((name) => String(value || "").includes(name)));
  const isSummary = (row) => row?.source === "summary_abstract" || /\bsummary\/abstract\b/i.test(String(row?.metric || ""));
  const matchRows = (comparison.matchRows || []).filter((row) => isSummary(row) && inProfile(row));
  const mismatchRows = (comparison.mismatchRows || []).filter((row) => isSummary(row) && inProfile(row));
  return { match: matchRows.length, mismatch: mismatchRows.length, matchRows, mismatchRows };
}

function rowLevelComparisonCounts(comparison = {}, profile = null) {
  const profileNames = new Set([profile?.file?.name, profile?.reportName].map((value) => cleanCellText(value)).filter(Boolean));
  const inProfile = (row) => !profileNames.size || [row.left_report, row.right_report, row.excel, row.pdf].some((value) => [...profileNames].some((name) => String(value || "").includes(name)));
  const isRowLevel = (row) => row?.source !== "summary_abstract";
  const matchRows = (comparison.matchRows || []).filter((row) => isRowLevel(row) && inProfile(row));
  const mismatchRows = (comparison.mismatchRows || []).filter((row) => isRowLevel(row) && inProfile(row));
  return { match: matchRows.length, mismatch: mismatchRows.length, matchRows, mismatchRows };
}

function excelHeaderSummaryLines(profile = {}) {
  return (profile.sheetProfiles || [])
    .flatMap((sheet) => (sheet.textValues || []).slice(0, 60))
    .filter((value) => /^(name\s+of|from\s*:|to\s*:|date\s*:|report\s+date|duration|period|total\s+\w+\s*:|state\s*:|discom\s*:|zone\s*:|circle\s*:|division\s*:|subdivision\s*:|substation\s*:|feeder\s+category\s*:)/i.test(cleanCellText(value)));
}

function excelReportNameLengthStatus(profile = {}) {
  const name = cleanCellText(profile.reportName || profile.file?.name);
  if (!name) return matrixStatus("NA", "No report name was detected for individual report-name length review.");
  return matrixStatus(
    "OK",
    `Individual report name detected with ${name.length} character(s). Different report-name lengths across comparison reports are not treated as a design mismatch.`
  );
}

function excelReportNamingConventionStatus(profile = {}) {
  const name = cleanCellText(profile.reportName || profile.file?.name);
  if (!name) return matrixStatus("NA", "No report name was detected for naming-convention validation.");
  const letters = name.replace(/[^A-Za-z]/g, "");
  if (!letters) return matrixStatus("NA", `Report name "${name}" does not contain alphabetic characters to validate case convention.`);
  const isUpper = letters === letters.toUpperCase();
  return isUpper
    ? matrixStatus("OK", `Report name "${name}" follows the required UPPER CASE convention.`)
    : matrixStatus("NOT OK", `Report name "${name}" is not fully UPPER CASE. Report names should be UPPER CASE only.`);
}

function excelPageSetupWhitespaceStatus(profile = {}) {
  const badSheets = (profile.sheetProfiles || []).filter((sheet) => Number(sheet.leadingBlankColumns || 0) > 2 || Number(sheet.trailingBlankColumns || 0) > 5);
  if (!profile.usedSheetCount) return matrixStatus("NOT OK", "No populated sheet was available for page setup whitespace review.");
  if (!badSheets.length) {
    return matrixStatus("OK", "No large leading/trailing blank column space was detected around the populated Excel report area. Page size itself can vary by report length.");
  }
  return matrixStatus(
    "NOT OK",
    `Large blank column space was detected around populated report data. Examples: ${badSheets.slice(0, 4).map((sheet) => `${sheet.sheetName}: leading=${sheet.leadingBlankColumns}, trailing=${sheet.trailingBlankColumns}`).join("; ")}.`
  );
}

function excelBlankPageStatus(profile = {}) {
  const blankSheetCount = Math.max(0, Number(profile.sheetCount || 0) - Number(profile.usedSheetCount || 0));
  return blankSheetCount
    ? matrixStatus("NOT OK", `${blankSheetCount} blank worksheet(s) were found in the workbook.`)
    : matrixStatus("OK", "No blank worksheet was found. Static Excel validation does not infer additional printed blank pages.");
}

function evaluateExcelDesignDateTimePoint(pointText, profile) {
  const text = String(pointText || "").toLowerCase();
  const tokens = dateTimeFormatTokens(profile);
  const summary = detectedDateTimeFormatSummary(tokens);

  if (text.includes("date time with millisecond") || text.includes("hh:mm:ss.sss")) {
    return tokens.millisecond.length
      ? matrixStatus("OK", `Detected DD-MM-YYYY HH:MM:SS.sss date-time token(s): ${tokens.millisecond.slice(0, 3).join(", ")}.`)
      : matrixStatus("NA", `DD-MM-YYYY HH:MM:SS.sss was not detected in this Excel report. ${summary}`);
  }

  if (text.includes("date time with second") || (text.includes("hh:mm:ss") && !text.includes("sss"))) {
    return tokens.second.length
      ? matrixStatus("OK", `Detected DD-MM-YYYY HH:MM:SS date-time token(s): ${tokens.second.slice(0, 3).join(", ")}.`)
      : (tokens.minute.length || tokens.dateOnly.length || tokens.month.length)
        ? matrixStatus("NOT OK", `Expected DD-MM-YYYY HH:MM:SS date-time format with seconds, but it was not detected. ${summary}`)
        : matrixStatus("NA", `DD-MM-YYYY HH:MM:SS was not detected because no comparable date-time token was visible in this Excel report. ${summary}`);
  }

  if (text.includes("date time format") || text.includes("hh:mm")) {
    return tokens.minute.length
      ? matrixStatus("OK", `Detected DD-MM-YYYY HH:MM date-time token(s): ${tokens.minute.slice(0, 3).join(", ")}.`)
      : matrixStatus("NA", `DD-MM-YYYY HH:MM was not detected in this Excel report. ${summary}`);
  }

  if (text.includes("month") || text.includes("mmm-yyyy")) {
    return tokens.month.length
      ? matrixStatus("OK", `Detected MMM-YYYY month token(s): ${tokens.month.slice(0, 3).join(", ")}.`)
      : matrixStatus("NA", `MMM-YYYY was not detected in this Excel report. ${summary}`);
  }

  return tokens.dateOnly.length
    ? matrixStatus("OK", `Detected DD-MM-YYYY date token(s): ${tokens.dateOnly.slice(0, 3).join(", ")}.`)
    : matrixStatus("NA", `DD-MM-YYYY was not detected as a date-only value in this Excel report. ${summary}`);
}

function evaluateExcelDesignPoint(pointText, profile) {
  const text = pointText.toLowerCase();
  if (!profile.usedSheetCount || !profile.populatedCount) return matrixStatus("NOT OK", "Workbook has no readable populated report sheet.");
  if (/\breport\s+name\s+length\b/.test(text)) {
    return excelReportNameLengthStatus(profile);
  }
  if (/\breport\s+names?\b.*\b(?:naming\s+convention|upper\s*case|pascalcase|camelcase)\b/.test(text) || /\bnaming\s+convention\b/.test(text)) {
    return excelReportNamingConventionStatus(profile);
  }
  if (/\bblank\s+pages?\b/.test(text)) {
    return excelBlankPageStatus(profile);
  }
  if (/\bpage\s+(?:number|details?)\b|\bpage\s+\d+\s+of\s+n\b|\bright\s+bottom\b/.test(text)) {
    return matrixStatus("NA", "Printed page-number footer details are not reliably available from static Excel workbook data; Excel pagination can vary by print/export settings.");
  }
  if (/\bpage\s+setup\b|\bA4\b|\bA3\b|\bA2\b|\bA1\b/i.test(pointText)) {
    return excelPageSetupWhitespaceStatus(profile);
  }
  if (/\bcharts?\b|\bgraphs?\b/.test(text)) {
    return matrixStatus("NA", "No chart/graph object is validated from workbook cell data. This checkpoint is applicable only when a visible chart/graph is present and can be inspected visually.");
  }
  if (/\bs\.?\s*no\.?\b.*\bleft\s+align/.test(text)) {
    return matrixStatus("NA", "S.No column presence can be detected, but left alignment is a visual/style check and is not failed from workbook data-only extraction.");
  }
  if (/\bborder\b/.test(text)) {
    return matrixStatus("NA", "Column/header border separation is a visual/style check; workbook data-only extraction does not prove border alignment.");
  }
  if (/\breport\s+header\s+summary\b/.test(text)) {
    const summaryLines = excelHeaderSummaryLines(profile);
    if (!summaryLines.length) return matrixStatus("NOT OK", "Report header summary was not detected in the top workbook rows.");
    if (/\bbold\b|\bleft\s+align/.test(text)) {
      return matrixStatus("NA", `Report header summary text was detected (${summaryLines.slice(0, 4).join("; ")}), but bold/left alignment requires style or visual inspection.`);
    }
    return matrixStatus("OK", `Report header summary text was detected: ${summaryLines.slice(0, 4).join("; ")}.`);
  }
  if (/\bdate\b|\bmonth\b|dd-mm-yyyy|hh:mm|mmm-yyyy/i.test(pointText)) {
    return evaluateExcelDesignDateTimePoint(pointText, profile);
  }
  if (/\b(header|title|report name)\b/.test(text)) {
    const hasHeader = profile.sheetProfiles.some((sheet) => sheet.textValues.slice(0, 40).some((value) => /report|parameter|summary|daily|maximum|minimum|analog|feeder|division|zone/i.test(value)));
    return hasHeader ? matrixStatus("OK", "Header/title-like text was found in the workbook.") : matrixStatus("NOT OK", "No header/title-like text was found in the first workbook rows.");
  }
  if (/\b(font|colour|color|bold|logo|alignment|align|style)\b/.test(text)) {
    return matrixStatus("NA", "Cell style/visual formatting cannot be fully verified from workbook data only.");
  }
  if (/\b(column|summary|layout|table)\b/.test(text)) {
    return profile.maxColumns > 1 && profile.totalRows > 1
      ? matrixStatus("OK", "Workbook has populated tabular layout.")
      : matrixStatus("NOT OK", "Workbook does not expose enough rows/columns for this layout check.");
  }
  return matrixStatus("OK", "Workbook structure is readable for this design checklist point.");
}

function evaluateExcelDataPoint(pointText, profile, comparison, selectedExcelCount, profiles = [], hierarchyValidation = null) {
  const text = pointText.toLowerCase();
  if (!profile.usedSheetCount || !profile.populatedCount) return matrixStatus("NOT OK", "Workbook has no readable data rows.");
  const saifiSelected = profiles.some((item) => item.validationGroup === "SAIFI SAIDI");
  if (saifiSelected && /\b(saifi|saidi)\b/i.test(pointText)) {
    const feederSelected = profiles.some((item) => item.hierarchyScope === "feeder_wise");
    const saifiCounts = saifiSaidiComparisonCounts(comparison);
    if (/\b(source|feeder\s+wise)\b/i.test(pointText)) {
      return feederSelected
        ? matrixStatus("OK", "Feeder Wise SAIFI/SAIDI source report is selected for hierarchy validation.")
        : matrixStatus("NA", "Feeder Wise report is not selected, so this Feeder-specific checklist point is not applicable. The selected SAIFI/SAIDI reports are validated by report title, row label, and common visible metric columns.");
    }
    const section = hierarchySectionForChecklistPoint(pointText, hierarchyValidation);
    if (section) {
      if (section.state === "mismatch") {
        return matrixStatus(
          "NOT OK",
          `${section.mismatch_count || 0} hierarchy mismatch(es) found in ${section.section}. ${section.base_report || "Source report"} was grouped by ${hierarchyFieldList(section.group_fields || [])} and compared with ${section.rollup_report}. ${hierarchyMismatchValueDetail(section)}`
        );
      }
      if (section.state === "match") {
        return matrixStatus("OK", `${section.section} reconciles from grouped source data.`);
      }
      return matrixStatus("NA", section.evidence || `${section.section} does not have enough comparable hierarchy evidence.`);
    }
    if (saifiCounts.match + saifiCounts.mismatch > 0) {
      return saifiCounts.mismatch
        ? matrixStatus("NOT OK", `${saifiCounts.mismatch} same-level SAIFI/SAIDI row-level mismatch(es) found. Only common row labels and common metrics such as Unplanned SAIFI/SAIDI were compared. ${crossExcelMismatchValueDetail(comparison, profile)}`)
        : matrixStatus("OK", `${saifiCounts.match} same-level SAIFI/SAIDI row value(s) matched using common report level, row labels, and metric columns.`);
    }
    if (selectedExcelCount > 1 && hierarchyValidation?.section_count) {
      return hierarchyValidation.mismatch_count
        ? matrixStatus("NOT OK", `${hierarchyValidation.mismatch_count} hierarchy mismatch(es) found across selected SAIFI/SAIDI child reports.`)
        : matrixStatus("OK", `${hierarchyValidation.match_count} hierarchy value(s) matched across selected SAIFI/SAIDI child reports.`);
    }
    return matrixStatus(
      "NA",
      feederSelected
        ? "Select at least one SAIFI/SAIDI parent or child rollup report to run hierarchy validation."
        : "No common SAIFI/SAIDI row labels and metric columns were found. Select matching report levels, or select a lower-level report with its parent rollup report."
    );
  }
  if (/%|percent|percentage/.test(text)) {
    return excelPercentRangeStatus(profile);
  }
  if (/\bfloat\b|\breal\b|\btwo\s+decimal\b|\bdecimal\s+part\b/.test(text)) {
    return excelDecimalPrecisionStatus(profile);
  }
  if (/\b(summary|abstract)\b/.test(text)) {
    return excelSummaryAbstractStatus(profile, comparison, selectedExcelCount);
  }
  if (/\b(error|formula)\b/.test(text)) {
    return profile.errorCount ? matrixStatus("NOT OK", `${profile.errorCount} formula/error value(s) found.`) : matrixStatus("OK", "No formula error values found.");
  }
  if (/\b(duplicate|repeated)\b/.test(text)) {
    return profile.duplicateLabelCount ? matrixStatus("NOT OK", `${profile.duplicateLabelCount} repeated row label(s) found.`) : matrixStatus("OK", "No repeated row labels found in the inspected sheets.");
  }
  if (/\b(date|period|range)\b/.test(text)) {
    return profile.dateTokens.length ? matrixStatus("OK", `Detected date value(s): ${profile.dateTokens.slice(0, 3).join(", ")}.`) : matrixStatus("NA", "No date token was detected in workbook text.");
  }
  if (/\b(match|mismatch|compare|comparison|total|count|value|metric|reconciliation)\b/.test(text)) {
    if (selectedExcelCount < 2) return matrixStatus("NA", "Select multiple Excel reports to perform cross-report value comparison.");
    const comparableGroupCount = (comparison.groups || []).filter((group) => Number(group.report_count || 0) > 1).length;
    if (!comparableGroupCount) {
      return matrixStatus(
        "NA",
        "Selected Excel reports belong to different report families. Cross-family comparison is skipped; select at least two reports from the same family."
      );
    }
    if (!comparison.mismatchRows.length && !comparison.matchRows.length) {
      return matrixStatus("NA", "No common comparable metrics were found within the selected report family groups.");
    }
    const rowLevelCounts = rowLevelComparisonCounts(comparison, profile);
    if (!rowLevelCounts.mismatch && !rowLevelCounts.match) {
      return matrixStatus("NA", "No common row-level data metrics were found after excluding design-only fields, S.No/serial fields, names, codes, dates, and summary-only values.");
    }
    return rowLevelCounts.mismatch
      ? matrixStatus("NOT OK", `${rowLevelCounts.mismatch} row-level mismatch(es) found across selected Excel reports. ${crossExcelMismatchValueDetail({ mismatchRows: rowLevelCounts.mismatchRows }, profile)}`)
      : matrixStatus("OK", `${rowLevelCounts.match} row-level comparable value(s) matched across selected Excel reports.`);
  }
  if (/\b(font|colour|color|bold|logo|alignment|align|style|border|page\s+setup|chart|graph|header\s+summary|page\s+number)\b/.test(text)) {
    return matrixStatus("NA", "This is a design/visual checklist point, so it is not used as an Excel data-validation rule.");
  }
  return matrixStatus("OK", "Workbook data is readable for this validation point.");
}

function hierarchySectionForChecklistPoint(pointText, hierarchyValidation) {
  const text = String(pointText || "").toLowerCase();
  const sections = hierarchyValidation?.sections || [];
  const findByScope = (scope) => sections.find((section) => section.rollup_scope === scope || section.section?.toLowerCase().includes(scope.replace(/_/g, " ")));
  if (/\bzone\b/.test(text)) return findByScope("zone_wise");
  if (/\bfeeder\s+category\b/.test(text)) return findByScope("feeder_category_wise");
  if (/\bsub\s*division\b|\bsubdivision\b/.test(text)) return findByScope("subdivision_wise");
  if (/\bdivision\b/.test(text)) return findByScope("division_wise");
  if (/\bcircle\b/.test(text)) return findByScope("circle_wise");
  return null;
}

function saifiSaidiComparisonCounts(comparison = {}) {
  const isSaifiRow = (row) => row?.validation_group === "SAIFI SAIDI"
    || row?.source === "saifi_saidi_same_scope_comparison"
    || /\bSAIFI\b|\bSAIDI\b/i.test(String(row?.metric || ""));
  return {
    match: (comparison.matchRows || []).filter(isSaifiRow).length,
    mismatch: (comparison.mismatchRows || []).filter(isSaifiRow).length
  };
}

function matrixStatus(display, evidence) {
  return { display, evidence };
}

function cleanMatrixEvidenceText(value) {
  const text = String(Array.isArray(value) ? value.filter(Boolean).join(" ") : value || "").trim();
  if (!text || /^[DNY]$/i.test(text)) return "";
  return text.replace(/\s+/g, " ");
}

function excelProfileAnalysisScope(profile = {}) {
  const reportName = profile.reportName || profile.file?.name || "selected report";
  const sheetNames = (profile.sheetProfiles || [])
    .filter((sheet) => Number(sheet.rowCount || 0) > 0)
    .map((sheet) => sheet.sheetName)
    .filter(Boolean);
  const sheetText = sheetNames.length
    ? `populated sheet(s): ${sheetNames.slice(0, 4).join(", ")}${sheetNames.length > 4 ? ` and ${sheetNames.length - 4} more` : ""}`
    : "no populated sheet name detected";
  return `Analyzed workbook ${profile.file?.name || "-"} for report "${reportName}" across ${profile.usedSheetCount || 0}/${profile.sheetCount || 0} populated sheet(s), ${profile.totalRows || 0} populated row(s), and up to ${profile.maxColumns || 0} column(s); ${sheetText}. Report family: ${profile.validationGroup || "Generic"}${profile.hierarchyScope ? `; hierarchy scope: ${profile.hierarchyScope}` : ""}.`;
}

function fallbackMatrixEvidence(area, display, checkPoint, profile = {}) {
  const subject = area === "Data" ? "data validation" : "design validation";
  const reportName = profile.reportName || profile.file?.name || "this report";
  if (display === "OK") {
    return `${reportName} satisfies this ${subject} checklist point based on the analyzed Excel workbook content.`;
  }
  if (display === "NA") {
    return `${reportName} does not expose the exact field, metric, format, or report context required by this checklist point, so the point is not applicable for this selected file.`;
  }
  return `${reportName} does not satisfy the expected ${subject} condition for this checklist point.`;
}

function enrichExcelMatrixStatus({ area, checkPoint, profile, status }) {
  const display = String(status?.display || "NA").trim() || "NA";
  const rawEvidence = cleanMatrixEvidenceText(status?.evidence);
  const reportName = profile?.reportName || profile?.file?.name || "selected report";
  const reason = rawEvidence || fallbackMatrixEvidence(area, display, checkPoint, profile);
  const scope = excelProfileAnalysisScope(profile);
  const resultMeaning =
    display === "OK"
      ? "Result OK means the required evidence or matching condition was found."
      : display === "NA"
      ? "Result NA means this checklist point is not applicable to the selected report/context, or the exact requested metric/format was not present."
      : "Result Not OK means the expected condition failed and needs correction or accepted exception evidence.";
  const evidence = `${display}: Checked "${checkPoint}" for "${reportName}". ${reason} ${resultMeaning} ${scope}`;
  return {
    ...(status || {}),
    display,
    raw_evidence: status?.evidence || "",
    evidence,
    explanation: evidence
  };
}

function excelMatrixRowRemarks(statuses = {}) {
  const rows = Object.entries(statuses)
    .map(([reportName, status], index) => {
      const display = status.display || "-";
      const evidence = String(status.evidence || "-");
      const displayPrefix = `${String(display).toLowerCase()}:`;
      const detail = evidence.trim().toLowerCase().startsWith(displayPrefix) ? evidence : `${display} - ${evidence}`;
      return `${index + 1}. ${reportName}: ${detail}`;
    });
  return rows.join("\n");
}

function firstNotOkEvidence(statuses) {
  const firstBad = Object.values(statuses).find((status) => String(status.display).toUpperCase() === "NOT OK");
  return firstBad?.evidence || "";
}

function statusCountsFromMatrixRows(rows) {
  const counts = { ok: 0, notOk: 0, na: 0, review: 0 };
  for (const row of rows) {
    for (const status of Object.values(row.statuses || {})) {
      const display = String(status.display || "").toUpperCase();
      if (display === "OK") counts.ok += 1;
      else if (display === "NA") counts.na += 1;
      else if (display === "NOT OK") counts.notOk += 1;
      else if (display) counts.review += 1;
    }
  }
  return counts;
}

function excelDateRangeSummary(profiles, comparison, hierarchyValidation = null) {
  const allDates = [...new Set(profiles.flatMap((profile) => profile.dateTokens))];
  const comparablePairCount = (comparison.groups || []).reduce((sum, group) => {
    const count = Number(group.report_count || 0);
    return count > 1 ? sum + (count * (count - 1)) / 2 : sum;
  }, 0);
  const hierarchySectionCount = Number(hierarchyValidation?.section_count || 0);
  return {
    status: allDates.length ? "detected" : "not_detected",
    display: allDates.length
      ? `Excel date values detected: ${allDates.slice(0, 6).join(", ")}.`
      : "Date range not detected in selected Excel reports.",
    reports: profiles.map((profile) => ({
      report: profile.reportName || profile.file.name,
      pdfFile: "",
      periodType: "excel_workbook",
      from: profile.dateTokens[0] || "",
      to: profile.dateTokens[profile.dateTokens.length - 1] || profile.dateTokens[0] || "",
      display: profile.dateTokens.length ? profile.dateTokens.join(", ") : "Not detected",
      validationDate: profile.dateTokens[0] || "",
      bucketStart: "",
      bucketEnd: "",
      intervalMinutes: null,
      missingBucketCount: 0
    })),
    crossPdf: {
      selectedPdfCount: 0,
      pairCount: comparablePairCount + hierarchySectionCount,
      matchCount: comparison.matchRows.length + Number(hierarchyValidation?.match_count || 0),
      mismatchCount: comparison.mismatchRows.length + Number(hierarchyValidation?.mismatch_count || 0),
      insufficientContextPairCount: comparison.skippedCrossFamilyPairCount || 0
    }
  };
}

function writeMatrixWorkbook(filePath, rows, selectedExcels) {
  const workbook = XLSX.utils.book_new();
  const flatRows = rows.map((row) => {
    const output = {
      "S.NO": row.s_no,
      Section: row.section,
      "Check Point": row.check_point,
      Remarks: row.remarks
    };
    for (const file of selectedExcels) {
      output[`${file.name} Status`] = row.statuses?.[file.name]?.display || "";
      output[`${file.name} Evidence`] = row.statuses?.[file.name]?.evidence || "";
    }
    return output;
  });
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(flatRows), "Matrix");
  XLSX.writeFile(workbook, filePath);
}

const EXCEL_ONLY_AGENT_FEATURES = [
  "Excel-only design and data validation",
  "Selected Excel workbook input only; PDF files not required",
  "Checklist-driven design review",
  "Checklist-driven Excel data validation",
  "Cross-Excel report comparison within matching validation groups",
  "SAIFI/SAIDI hierarchy rollup validation where matching levels are selected",
  "Report-wise observations with evidence",
  "Timestamped Markdown, PDF, JSON, text, and Excel matrix artifacts"
];

function excelOnlyAgentFeaturesText(result) {
  const features = Array.isArray(result?.agent?.features) && result.agent.features.length
    ? result.agent.features
    : EXCEL_ONLY_AGENT_FEATURES;
  return features.join(", ");
}

function excelOnlyReviewMarkdown(result) {
  const designCounts = okNotOkNaCounts(result.design_summary.counts);
  const dataCounts = matrixCounts(result.data_validation_check_matrix);
  const evidenceRows = result.excel_data_validation.evidence_rows || [];
  const validationGroups = result.excel_data_validation.validation_groups || [];
  const skippedCrossFamilyPairCount = Number(result.excel_data_validation.skipped_cross_family_pair_count || 0);
  const lines = [
    `# ${result.project.project_name || "Excel Data and Design Review"}`,
    "",
    "## Agent Details",
    `Agent Name: ${result.agent.name}`,
    `Agent Mode: ${result.agent.mode}`,
    `Agent Features: ${excelOnlyAgentFeaturesText(result)}`,
    `Reviewer Name: ${result.project.reviewer_name || "-"}`,
    `Review Timestamp: ${result.agent.review_timestamp}`,
    "",
    "## Project",
    `Project Name: ${result.project.project_name || "-"}`,
    "Validation Source: Selected Excel workbook(s) only. PDF files were not required or used.",
    "",
    "## Selected Excel Reports",
    ...result.selected_excel_reports.map((file, index) => `${index + 1}. ${file.name}`),
    "",
    "## Validation Groups",
    ...validationGroups.map((group) => `- ${group.name}: ${group.reports.join(", ")}`),
    skippedCrossFamilyPairCount
      ? `Skipped cross-family comparisons: ${skippedCrossFamilyPairCount}. Reports are only compared inside the same validation group.`
      : "No cross-family comparisons were skipped.",
    "",
    "## Summary",
    `Design checks: ${designCounts.ok} OK, ${designCounts.notOk} Not OK, ${designCounts.na} NA.`,
    `Data checks: ${dataCounts.ok} OK, ${dataCounts.notOk} Not OK, ${dataCounts.na} NA.`,
    `Hierarchy data validation: ${result.hierarchical_data_validation?.state || "not_applicable"} with ${result.hierarchical_data_validation?.section_count || 0} section(s), ${result.hierarchical_data_validation?.match_count || 0} matched value(s), and ${result.hierarchical_data_validation?.mismatch_count || 0} mismatched value(s).`,
    `Row-level Excel comparison mismatches: ${result.excel_data_validation.mismatch_count}.`,
    "",
    "## Individual Checklist Verification",
    "Each row below is one selected report verified against one checklist point. Cross-report comparisons remain in the dedicated validation sections.",
    "",
    ...individualVerificationMarkdownBlocks(result),
    "",
    "## SAIFI/SAIDI Hierarchy Rollup Validation",
    ...hierarchyMarkdownRows(result.hierarchical_data_validation),
    "",
    "## Row-Level Comparison Evidence",
    evidenceRows.length ? "| Metric | Report 1 | Report 2 | Status |" : "No row-level comparison evidence was produced.",
    evidenceRows.length ? "| --- | --- | --- | --- |" : "",
    ...evidenceRows.slice(0, 80).map((row) => `| ${escapePipes(row.metric)} | ${escapePipes(row.excel)} | ${escapePipes(row.pdf)} | ${escapePipes(row.status)} |`)
  ].filter((line) => line !== "");
  return `${lines.join("\n")}\n`;
}

function excelOnlyDesignReviewMarkdown(result) {
  const counts = okNotOkNaCounts(result.design_summary.counts);
  const rows = result.design_check_matrix?.rows || [];
  const reviewRows = rows.filter((row) => matrixRowHasStatus(row, ["NOT OK", "REVIEW", "MANUAL REVIEW REQUIRED", "INSUFFICIENT EVIDENCE"]));
  const lines = [
    `# ${result.project.project_name || "Excel Data and Design Review"} - Design Review`,
    "",
    "## Agent Details",
    `Agent Name: ${result.agent.name}`,
    `Agent Mode: ${result.agent.mode}`,
    `Agent Features: ${excelOnlyAgentFeaturesText(result)}`,
    `Reviewer Name: ${result.project.reviewer_name || "-"}`,
    `Review Timestamp: ${result.agent.review_timestamp}`,
    "",
    "## Project",
    `Project Name: ${result.project.project_name || "-"}`,
    "Validation Source: Selected Excel workbook(s) only.",
    "",
    "## Selected Excel Reports",
    ...result.selected_excel_reports.map((file, index) => `${index + 1}. ${file.name}`),
    "",
    "## Design Check Matrix Summary",
    `OK: ${counts.ok}`,
    `Not OK: ${counts.notOk}`,
    `NA: ${counts.na}`,
    "",
    "## Individual Design Checklist Verification",
    "Each row below is one selected report verified against one design checklist point. This block is separate from cross-report checks.",
    "",
    ...individualVerificationMarkdownBlocks(result, ["Design"]),
    "",
    "## Design Findings",
    reviewRows.length
      ? "The following checklist points need correction, evidence, or reviewer attention."
      : "No design checklist points are currently marked Not OK.",
    "",
    ...(reviewRows.length
      ? [
          "| S.No | Section | Check Point | Status | Evidence |",
          "| --- | --- | --- | --- | --- |",
          ...reviewRows.slice(0, 120).map((row) =>
            `| ${escapePipes(row.s_no)} | ${escapePipes(row.section)} | ${escapePipes(row.check_point)} | ${escapePipes(matrixRowStatusSummary(row))} | ${escapePipes(matrixRowEvidenceSummary(row))} |`
          )
        ]
      : [])
  ];
  return `${lines.join("\n")}\n`;
}

function excelOnlyDataValidationMarkdown(result) {
  const counts = matrixCounts(result.data_validation_check_matrix);
  const rows = result.data_validation_check_matrix?.rows || [];
  const dataFindingRows = rows.filter((row) => matrixRowHasStatus(row, ["NOT OK", "REVIEW", "MANUAL REVIEW REQUIRED", "INSUFFICIENT EVIDENCE"]));
  const evidenceRows = result.excel_data_validation?.evidence_rows || [];
  const mismatchRows = evidenceRows.filter((row) => String(row.status || "").toLowerCase().includes("mismatch"));
  const validationGroups = result.excel_data_validation?.validation_groups || [];
  const dateRange = result.excel_data_validation?.date_range_summary;
  const skippedCrossFamilyPairCount = Number(result.excel_data_validation?.skipped_cross_family_pair_count || 0);
  const lines = [
    `# ${result.project.project_name || "Excel Data and Design Review"} - Excel Data Validation`,
    "",
    "## Agent Details",
    `Agent Name: ${result.agent.name}`,
    `Agent Mode: ${result.agent.mode}`,
    `Agent Features: ${excelOnlyAgentFeaturesText(result)}`,
    `Reviewer Name: ${result.project.reviewer_name || "-"}`,
    `Review Timestamp: ${result.agent.review_timestamp}`,
    "",
    "## Project",
    `Project Name: ${result.project.project_name || "-"}`,
    "Validation Source: Selected Excel workbook(s) only. PDF files were not required or used.",
    "",
    "## Selected Excel Reports",
    ...result.selected_excel_reports.map((file, index) => `${index + 1}. ${file.name}`),
    "",
    "## Date Range Used For Validation",
    dateRange?.display || "Date range was not detected in the selected Excel reports.",
    "",
    "## Validation Groups",
    ...validationGroups.map((group) => `- ${group.name}: ${group.reports.join(", ")}`),
    skippedCrossFamilyPairCount
      ? `Skipped cross-family comparisons: ${skippedCrossFamilyPairCount}. Reports are only compared inside the same validation group.`
      : "No cross-family comparisons were skipped.",
    "",
    "## Data Validation Check Matrix Summary",
    `OK: ${counts.ok}`,
    `Not OK: ${counts.notOk}`,
    `NA: ${counts.na}`,
    "",
    "## Individual Data Checklist Verification",
    "Each row below is one selected report verified against one data checklist point. Cross-report comparisons remain in the dedicated validation and row-level evidence sections.",
    "",
    ...individualVerificationMarkdownBlocks(result, ["Data"]),
    "",
    "## SAIFI/SAIDI Hierarchy Rollup Validation",
    ...hierarchyMarkdownRows(result.hierarchical_data_validation),
    "",
    "## Row-Level Data Critical Mismatches",
    mismatchRows.length
      ? "Each item below is one metric or visible report row where the compared Excel values are different."
      : "No row-level data mismatches were found.",
    "",
    ...(mismatchRows.length
      ? [
          "| Metric | Report 1 | Report 2 | Status |",
          "| --- | --- | --- | --- |",
          ...mismatchRows.slice(0, 160).map((row) => `| ${escapePipes(row.metric)} | ${escapePipes(row.excel)} | ${escapePipes(row.pdf)} | ${escapePipes(row.status)} |`)
        ]
      : []),
    "",
    "## Cross-Excel Pair Detail",
    "This section lists every generated cross-Excel comparison for each pair, including matching and mismatching bucket/metric checks.",
    "",
    ...excelOnlyPairDetailMarkdownBlocks(result),
    "",
    "## Data Checklist Findings",
    dataFindingRows.length
      ? "The following data checklist points need correction, evidence, or reviewer attention."
      : "No data checklist points are currently marked Not OK.",
    "",
    ...(dataFindingRows.length
      ? [
          "| S.No | Section | Check Point | Status | Evidence |",
          "| --- | --- | --- | --- | --- |",
          ...dataFindingRows.slice(0, 120).map((row) =>
            `| ${escapePipes(row.s_no)} | ${escapePipes(row.section)} | ${escapePipes(row.check_point)} | ${escapePipes(matrixRowStatusSummary(row))} | ${escapePipes(matrixRowEvidenceSummary(row))} |`
          )
        ]
      : [])
  ];
  return `${lines.join("\n")}\n`;
}

function excelOnlyPairDetailMarkdownBlocks(result) {
  const pairwise = result.excel_data_validation?.pairwise || [];
  if (!pairwise.length) {
    return ["No cross-Excel pair detail was produced for the selected reports."];
  }
  return pairwise.flatMap((pair) => {
    const comparisons = pair.comparisons || [];
    return [
      `### ${pair.left_report || "Report 1"} vs ${pair.right_report || "Report 2"}`,
      "",
      ...(comparisons.length
        ? [
            `| Source | Row Label | Metric | ${escapePipes(pair.left_report || "Report 1")} Value | ${escapePipes(pair.right_report || "Report 2")} Value | State |`,
            "| --- | --- | --- | --- | --- | --- |",
            ...comparisons.slice(0, 500).map((comparison) =>
              `| ${escapePipes(comparison.source || "-")} | ${escapePipes(comparison.row_label || "-")} | ${escapePipes(comparison.metric || "-")} | ${escapePipes(comparison.left_display_value ?? "-")} | ${escapePipes(comparison.right_display_value ?? "-")} | ${escapePipes(comparison.state || pair.state || "-")} |`
            )
          ]
        : [pair.evidence || "No detailed comparisons were available."]),
      ""
    ];
  });
}

function hierarchyMarkdownRows(hierarchyValidation) {
  const sections = hierarchyValidation?.sections || [];
  if (!sections.length) {
    return [hierarchyValidation?.evidence || "No SAIFI/SAIDI hierarchy sections were created. Select Feeder Wise and at least one child rollup report such as Circle Wise, Division Wise, Subdivision Wise, or Feeder Category Wise."];
  }
  const lines = [
    `State: ${hierarchyValidation.state || "insufficient_context"}. Sections: ${hierarchyValidation.section_count || 0}. Matches: ${hierarchyValidation.match_count || 0}. Mismatches: ${hierarchyValidation.mismatch_count || 0}.`,
    ""
  ];
  for (const section of sections) {
    lines.push(`### ${section.section}`);
    lines.push(`Source: ${section.base_report || "Feeder Wise"}; Rollup: ${section.rollup_report || "-"}; Group By: ${hierarchyFieldList(section.group_fields || [])}; State: ${section.state || "-"}.`);
    if (section.evidence) lines.push(section.evidence);
    const mismatchComparisons = [];
    for (const group of section.groups || []) {
      for (const comparison of group.comparisons || group.metrics || []) {
        if (comparison.state !== "mismatch") continue;
        mismatchComparisons.push({
          group: group.group_display || group.group_key || "-",
          metric: comparison.label || comparison.metric,
          source: comparison.source_display || comparison.base_aggregated_display || "-",
          rollup: comparison.rollup_display || comparison.parent_display || "-",
          status: comparison.state || "-"
        });
      }
    }
    if (mismatchComparisons.length) {
      lines.push("| Group | Metric | Feeder Wise Calculated Value | Child Rollup Value | Status |");
      lines.push("| --- | --- | --- | --- | --- |");
      for (const row of mismatchComparisons.slice(0, 80)) {
        lines.push(`| ${escapePipes(row.group)} | ${escapePipes(row.metric)} | ${escapePipes(row.source)} | ${escapePipes(row.rollup)} | ${escapePipes(row.status)} |`);
      }
    } else if (section.state === "match") {
      lines.push("All comparable hierarchy values matched for this section.");
    } else {
      lines.push("No comparable mismatch rows were available for this section.");
    }
    for (const missingGroup of (section.missing_parent_groups || []).slice(0, 20)) {
      lines.push(`- Missing child rollup row: ${missingGroup.group_display || missingGroup.group_key || "-"}; ${missingGroup.evidence || ""}`);
    }
    lines.push("");
  }
  return lines;
}

function matrixRowHasStatus(row, statusNames) {
  const wanted = new Set(statusNames.map((status) => String(status).toUpperCase()));
  return Object.values(row.statuses || {}).some((status) => wanted.has(String(status.display || "").toUpperCase()));
}

function matrixRowStatusSummary(row) {
  return Object.entries(row.statuses || {})
    .map(([fileName, status]) => `${fileName}: ${status.display || "-"}`)
    .join("; ");
}

function matrixRowEvidenceSummary(row) {
  const statuses = Object.values(row.statuses || {});
  const notOkEvidence = statuses.find((status) => String(status.display || "").toUpperCase() === "NOT OK")?.evidence;
  const anyEvidence = statuses.find((status) => status.evidence)?.evidence;
  return notOkEvidence || anyEvidence || row.remarks || "-";
}

function individualVerificationMarkdownBlocks(result, areas = []) {
  const wanted = new Set(areas.map((area) => String(area).toLowerCase()));
  const groups = buildIndividualChecklistVerifications(result)
    .filter((group) => !wanted.size || wanted.has(String(group.area || group.title || "").toLowerCase()));
  if (!groups.length) {
    return ["No individual checklist verification rows were available.", ""];
  }
  return groups.flatMap((group) => [
    `### ${group.title || `${group.area || "Checklist"} Individual Checklist Verification`}`,
    "",
    `OK: ${group.ok}; Not OK: ${group.notOk}; NA: ${group.na}.`,
    "",
    "| Point | Checklist S.NO | Report | Area | State | Check Point | Evidence |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...group.rows.map((row, index) =>
      `| ${escapePipes(row.point || index + 1)} | ${escapePipes(row.checklistSNo || "-")} | ${escapePipes(row.report || "-")} | ${escapePipes(row.area || group.area || "-")} | ${escapePipes(row.state || "-")} | ${escapePipes(row.checkPoint || "-")} | ${escapePipes(row.evidence || "-")} |`
    ),
    ""
  ]);
}

async function writeMarkdownPdf(pdfPath, markdown, title) {
  try {
    const chromePath = await resolveChromeExecutable();
    const htmlPath = `${pdfPath}.html`;
    await writeText(htmlPath, markdownDocumentHtml(markdown, title));
    try {
      await execFileAsync(chromePath, [
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--disable-extensions",
        "--no-pdf-header-footer",
        "--print-to-pdf-no-header",
        `--print-to-pdf=${pdfPath}`,
        pathToFileURL(htmlPath).href
      ], { windowsHide: true, timeout: 120000 });
      return;
    } finally {
      await fsp.rm(htmlPath, { force: true }).catch(() => {});
    }
  } catch {
    await writeMarkdownPdfWithPdfLib(pdfPath, markdown, title);
  }
}

async function writeMarkdownPdfWithPdfLib(pdfPath, markdown, title) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Courier);
  const margin = 42;
  const fontSize = 8;
  const lineHeight = 11;
  let page = pdfDoc.addPage([595.28, 841.89]);
  let y = page.getHeight() - margin;

  const addPage = () => {
    page = pdfDoc.addPage([595.28, 841.89]);
    y = page.getHeight() - margin;
  };
  const drawLine = (text, options = {}) => {
    if (y < margin) addPage();
    page.drawText(text, {
      x: margin,
      y,
      size: options.size || fontSize,
      font: regular,
      color: options.color || rgb(0.08, 0.12, 0.2)
    });
    y -= options.lineHeight || lineHeight;
  };

  for (const sourceLine of markdownToVerbatimPdfLines(markdown, 95)) {
    if (sourceLine === "") {
      y -= lineHeight;
      continue;
    }
    drawLine(sourceLine);
  }
  await ensureDir(path.dirname(pdfPath));
  await fsp.writeFile(pdfPath, await pdfDoc.save());
}

function markdownToVerbatimPdfLines(markdown, width) {
  const lines = [];
  for (const rawLine of String(markdown || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n")) {
    if (!rawLine) {
      lines.push("");
      continue;
    }
    lines.push(...wrapPdfLineVerbatim(rawLine, width));
  }
  return lines;
}

function wrapPdfLineVerbatim(line, width) {
  const value = String(line || "");
  if (value.length <= width) return [value];
  const lines = [];
  for (let index = 0; index < value.length; index += width) {
    lines.push(value.slice(index, index + width));
  }
  return lines;
}

function markdownToPdfLines(markdown, width) {
  const lines = [];
  for (const rawLine of String(markdown || "").split(/\r?\n/)) {
    const line = rawLine.replace(/<[^>]+>/g, "").replace(/\t/g, "  ");
    if (!line.trim()) {
      lines.push("");
      continue;
    }
    if (/^\s*\|/.test(line)) {
      lines.push(...wrapPdfLine(line.replace(/\s*\|\s*/g, " | "), width));
      continue;
    }
    lines.push(...wrapPdfLine(line, width));
  }
  return lines;
}

function wrapPdfLine(line, width) {
  const words = String(line || "").split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function resolveChromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.GOOGLE_CHROME_SHIM,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate;
  }
  const error = new Error("PDF export needs Chrome or Edge. Set CHROME_PATH to the browser executable and run review again.");
  error.statusCode = 500;
  throw error;
}

function markdownDocumentHtml(markdown, title) {
  const bodyHtml = markdownToHtml(String(markdown || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n"));
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4 landscape; margin: 11mm 9mm; }
    body {
      color: #0f172a;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 8.5px;
      line-height: 1.28;
    }
    h1 {
      font-size: 17px;
      margin: 0 0 8px;
      color: #0b3558;
    }
    h2 {
      border-bottom: 1px solid #b6c2cf;
      color: #0b3558;
      font-size: 13px;
      margin: 13px 0 7px;
      padding-bottom: 3px;
    }
    h3 {
      color: #0b3558;
      font-size: 10.5px;
      margin: 10px 0 5px;
    }
    h4,
    h5,
    h6 {
      color: #164e63;
      font-size: 9px;
      margin: 8px 0 4px;
    }
    p {
      margin: 4px 0 6px;
    }
    ul {
      margin: 4px 0 7px 18px;
      padding: 0;
    }
    table {
      border-collapse: collapse;
      margin: 6px 0 11px;
      table-layout: fixed;
      width: 100%;
      page-break-inside: auto;
    }
    thead {
      display: table-header-group;
    }
    tr {
      page-break-inside: auto;
      page-break-after: auto;
    }
    th,
    td {
      border: 1px solid #b8c2cc;
      overflow-wrap: anywhere;
      padding: 4px 5px;
      text-align: left;
      vertical-align: top;
      white-space: normal;
    }
    th {
      background: #e8f0f7;
      color: #082f49;
      font-weight: 700;
    }
    tbody tr:nth-child(even) td {
      background: #f8fafc;
    }
    code {
      font-family: Consolas, "Courier New", monospace;
      font-size: 0.94em;
    }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function markdownToHtml(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  const output = [];
  let listOpen = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) {
      if (listOpen) {
        output.push("</ul>");
        listOpen = false;
      }
      continue;
    }

    if (trimmed.startsWith("|") && lines[index + 1]?.trim().match(/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/)) {
      if (listOpen) {
        output.push("</ul>");
        listOpen = false;
      }
      const headerCells = splitMarkdownTableRow(trimmed);
      index += 1;
      const bodyRows = [];
      while (lines[index + 1]?.trim().startsWith("|")) {
        index += 1;
        bodyRows.push(splitMarkdownTableRow(lines[index].trim()));
      }
      output.push("<table><thead><tr>");
      output.push(headerCells.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join(""));
      output.push("</tr></thead><tbody>");
      for (const row of bodyRows) {
        output.push("<tr>");
        output.push(row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join(""));
        output.push("</tr>");
      }
      output.push("</tbody></table>");
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      if (listOpen) {
        output.push("</ul>");
        listOpen = false;
      }
      output.push(`<h${heading[1].length}>${inlineMarkdown(heading[2])}</h${heading[1].length}>`);
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      if (!listOpen) {
        output.push("<ul>");
        listOpen = true;
      }
      output.push(`<li>${inlineMarkdown(bullet[1])}</li>`);
      continue;
    }

    if (listOpen) {
      output.push("</ul>");
      listOpen = false;
    }
    output.push(`<p>${inlineMarkdown(trimmed)}</p>`);
  }
  if (listOpen) output.push("</ul>");
  return output.join("\n");
}

function splitMarkdownTableRow(row) {
  return row
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((cell) => cell.replace(/\\\|/g, "|").trim());
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/&lt;br\s*\/?&gt;/gi, "<br>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeMetricKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 .:_-]/g, "")
    .trim();
}

function formatLocalReviewTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatLocalFileTimestamp(date) {
  return formatLocalReviewTimestamp(date).replace(/:/g, "-");
}

function runDateTimeFolderName(date) {
  return safeFileName(formatLocalFileTimestamp(date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date()), "review-run");
}

async function uniqueExcelOnlyReviewBaseName(folderPath, preferredBaseName) {
  let baseName = preferredBaseName;
  let suffix = 2;
  while (await pathExists(path.join(folderPath, `${baseName}.json`))) {
    baseName = `${preferredBaseName}-${suffix}`;
    suffix += 1;
  }
  return baseName;
}

async function prepareExcelPdfDataRun(config, files) {
  const projectSlug = slugify(config.projectName || "excel-pdf-data-review");
  const runId = timestamp();
  const stagingRoot = path.join(ROOT, "tmp", "excel-pdf-data-runs", `${projectSlug}-${runId}`);
  const checklistFolder = path.join(stagingRoot, "checklist");
  const excelFolder = path.join(stagingRoot, "excel");
  const pdfFolder = path.join(stagingRoot, "pdf");
  await Promise.all([ensureDir(checklistFolder), ensureDir(excelFolder), ensureDir(pdfFolder)]);

  const selectedChecklist = findSelectedFile(files.checklists, files.selected.checklistPath, "checklist");
  const selectedExcels = findSelectedFiles(files.excelFiles, files.selected.excelPaths, "Excel design report");
  const selectedPdfs = config.excelOnly ? [] : findSelectedFiles(files.pdfFiles, files.selected.pdfPaths, "PDF report");

  const stagedChecklistPath = path.join(checklistFolder, path.basename(selectedChecklist.path));
  const stagedFiles = [];
  stagedFiles.push(await stageReviewInputFile(selectedChecklist.path, stagedChecklistPath));
  const stagedExcelFiles = await Promise.all(
    selectedExcels.map((selectedExcel) => stageReviewInputFile(selectedExcel.path, path.join(excelFolder, path.basename(selectedExcel.path))))
  );
  const stagedPdfFiles = await Promise.all(
    selectedPdfs.map((selectedPdf) => stageReviewInputFile(selectedPdf.path, path.join(pdfFolder, path.basename(selectedPdf.path))))
  );
  stagedFiles.push(...stagedExcelFiles, ...stagedPdfFiles);
  const stagedExcelPaths = stagedExcelFiles.map((file) => file.targetPath);
  const stagedPdfPaths = stagedPdfFiles.map((file) => file.targetPath);

  return {
    projectSlug,
    runId,
    reportCategoryFolder: reviewReportCategoryFolderFromExcelFiles(selectedExcels),
    stagingRoot,
    stagingMode: stagedFiles.every((file) => file.mode === "hardlink") ? "hardlink" : "mixed",
    stagedFiles,
    selected: {
      checklist: selectedChecklist,
      excel: selectedExcels[0],
      excels: selectedExcels,
      pdf: selectedPdfs[0],
      pdfs: selectedPdfs
    },
    staged: {
      checklistPath: stagedChecklistPath,
      excelFolder,
      pdfFolder,
      excelPath: stagedExcelPaths[0],
      excelPaths: stagedExcelPaths,
      pdfPath: stagedPdfPaths[0],
      pdfPaths: stagedPdfPaths
    },
    agentConfig: {
      ...config,
      checklistInput: stagedChecklistPath,
      selectedChecklistPath: stagedChecklistPath,
      excelFolder,
      selectedExcelPath: stagedExcelPaths[0],
      selectedExcelPaths: stagedExcelPaths,
      pdfFolder,
      selectedPdfPath: stagedPdfPaths[0],
      selectedPdfPaths: stagedPdfPaths,
      compareCount: "all",
      pdfIndices: "",
      recursive: false
    }
  };
}

async function stageReviewInputFile(sourcePath, targetPath) {
  await fsp.rm(targetPath, { force: true }).catch(() => {});
  try {
    await fsp.link(sourcePath, targetPath);
    return { sourcePath, targetPath, mode: "hardlink" };
  } catch {
    await fsp.copyFile(sourcePath, targetPath);
    return { sourcePath, targetPath, mode: "copy" };
  }
}

function findSelectedFile(files, selectedPath, label) {
  const resolved = path.resolve(selectedPath || "");
  const selected = files.find((file) => path.resolve(file.path).toLowerCase() === resolved.toLowerCase()) || files[0];
  if (!selected) {
    const error = new Error(`No ${label} file is available for review.`);
    error.statusCode = 400;
    throw error;
  }
  return selected;
}

function findSelectedFiles(files, selectedPaths = [], label) {
  const selected = selectedPaths
    .map((selectedPath) => {
      const resolved = path.resolve(selectedPath || "");
      return files.find((file) => path.resolve(file.path).toLowerCase() === resolved.toLowerCase());
    })
    .filter(Boolean);
  if (selected.length) return selected;
  if (files.length) return files;
  const error = new Error(`No ${label} file is available for review.`);
  error.statusCode = 400;
  throw error;
}

async function finalizeExcelPdfProjectArtifacts({ parsed, config, runPlan, stdout, stderr, startedAt }) {
  const projectSlug = runPlan.projectSlug;
  const userFolder = userReviewFolderName(config.userName);
  const projectFolder = projectFolderName(config.projectName || projectSlug);
  const reportCategoryFolder = runPlan.reportCategoryFolder || reviewReportCategoryFolderFromExcelFiles(runPlan.selected?.excels || []);
  const runDateTimeFolder = runDateTimeFolderName(startedAt ? new Date(startedAt) : new Date());
  const projectOutputFolderAbs = path.join(EXCEL_PDF_REVIEW_OUTPUT_ROOT, userFolder, projectFolder, reportCategoryFolder, runDateTimeFolder);
  await ensureDir(projectOutputFolderAbs);

  const metadata = {
    project_name: config.projectName || projectSlug,
    project_slug: projectSlug,
    user_folder: userFolder,
    project_folder: projectFolder,
    report_category_folder: reportCategoryFolder,
    run_datetime_folder: runDateTimeFolder,
    user_name: config.userName || "",
    review_started_at: startedAt,
    review_completed_at: new Date().toISOString(),
    selected_checklist: runPlan.selected.checklist,
    selected_excel_report: runPlan.selected.excel,
    selected_excel_reports: runPlan.selected.excels,
    selected_pdf_report: runPlan.selected.pdf,
    selected_pdf_reports: runPlan.selected.pdfs,
    staging_root: runPlan.stagingRoot,
    staging_mode: runPlan.stagingMode || "copy"
  };

  const copied = {};
  const artifactKeys = [
    ["jsonPath", "json"],
    ["markdownPath", "markdown"],
    ["designMarkdownPath", "design_markdown"],
    ["excelDataValidationMarkdownPath", "excel_data_validation_markdown"],
    ["pdfDataValidationMarkdownPath", "pdf_data_validation_markdown"],
    ["designPdfPath", "design_pdf"],
    ["excelDataValidationPdfPath", "excel_data_validation_pdf"],
    ["pdfDataValidationPdfPath", "pdf_data_validation_pdf"],
    ["textPath", "text"],
    ["designCheckMatrixExcelPath", "design_check_matrix_excel"],
    ["dataValidationCheckMatrixExcelPath", "data_validation_check_matrix_excel"]
  ];

  for (const [parsedKey, outputKey] of artifactKeys) {
    const relativeArtifactPath = parsed[parsedKey];
    if (!relativeArtifactPath) continue;
    const sourcePath = path.resolve(AI_REVIEW_ROOT, relativeArtifactPath);
    if (!fs.existsSync(sourcePath)) continue;
    const targetPath = await uniqueCopiedReviewArtifactPath(projectOutputFolderAbs, sourcePath);
    if (path.resolve(sourcePath).toLowerCase() === path.resolve(targetPath).toLowerCase()) {
      copied[outputKey] = relativePath(AI_REVIEW_ROOT, targetPath);
      continue;
    }
    await fsp.copyFile(sourcePath, targetPath);
    copied[outputKey] = relativePath(AI_REVIEW_ROOT, targetPath);
  }

  await ensureExcelPdfReviewPdfCompanions({
    copied,
    projectOutputFolderAbs,
    projectName: config.projectName || projectSlug
  });

  const summaryPath = await uniqueReviewArtifactPath(projectOutputFolderAbs, `${projectFolder}-ui-run-summary.json`, runPlan.runId);
  await writeJson(summaryPath, {
    ...metadata,
    original_paths: parsed,
    project_paths: copied,
    stdout,
    stderr
  });

  return {
    projectOutputFolder: relativePath(AI_REVIEW_ROOT, projectOutputFolderAbs),
    projectOutputFolderAbsolute: projectOutputFolderAbs,
    reportCategoryFolder,
    runDateTimeFolder,
    projectJsonPath: copied.json || "",
    projectMarkdownPath: copied.markdown || "",
    projectTextPath: copied.text || "",
    copiedArtifacts: copied,
    summaryPath: relativePath(AI_REVIEW_ROOT, summaryPath)
  };
}

async function ensureExcelPdfReviewPdfCompanions({ copied, projectOutputFolderAbs, projectName }) {
  const companions = [
    {
      markdownKey: "design_markdown",
      pdfKey: "design_pdf",
      title: `${projectName || "DA Review"} - Design Review`
    },
    {
      markdownKey: "excel_data_validation_markdown",
      pdfKey: "excel_data_validation_pdf",
      title: `${projectName || "DA Review"} - Excel Data Validation`
    },
    {
      markdownKey: "pdf_data_validation_markdown",
      pdfKey: "pdf_data_validation_pdf",
      title: `${projectName || "DA Review"} - PDF Data Validation`
    }
  ];

  for (const companion of companions) {
    if (copied[companion.pdfKey] || !copied[companion.markdownKey]) continue;
    const markdownPath = path.resolve(AI_REVIEW_ROOT, copied[companion.markdownKey]);
    if (path.extname(markdownPath).toLowerCase() !== ".md" || !fs.existsSync(markdownPath)) continue;
    const pdfPath = await reviewPdfCompanionPath(projectOutputFolderAbs, markdownPath);
    const markdown = await readText(markdownPath);
    await writeMarkdownPdf(pdfPath, markdown, companion.title);
    copied[companion.pdfKey] = relativePath(AI_REVIEW_ROOT, pdfPath);
  }
}

async function reviewPdfCompanionPath(folderPath, markdownPath) {
  const parsed = path.parse(path.basename(markdownPath));
  const safeName = safeFileName(parsed.name || "review-file");
  let candidate = path.join(folderPath, `${safeName}.pdf`);
  let suffix = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(folderPath, `${safeName}-${suffix}.pdf`);
    suffix += 1;
  }
  return candidate;
}

async function uniqueReviewArtifactPath(folderPath, sourcePathOrName, runId) {
  const parsed = path.parse(path.basename(sourcePathOrName));
  const safeName = safeFileName(parsed.name || "review-file");
  const safeExt = safeFileName(parsed.ext || "");
  const basePath = path.join(folderPath, `${safeName}-${runId}${safeExt}`);
  let candidate = basePath;
  let suffix = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(folderPath, `${safeName}-${runId}-${suffix}${safeExt}`);
    suffix += 1;
  }
  return candidate;
}

async function uniqueCopiedReviewArtifactPath(folderPath, sourcePathOrName) {
  const parsed = path.parse(path.basename(sourcePathOrName));
  const safeName = safeFileName(parsed.name || "review-file");
  const safeExt = safeFileName(parsed.ext || "");
  let candidate = path.join(folderPath, `${safeName}${safeExt}`);
  let suffix = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(folderPath, `${safeName}-${suffix}${safeExt}`);
    suffix += 1;
  }
  return candidate;
}

async function copyJsonWithMetadata(sourcePath, targetPath, metadata) {
  const content = JSON.parse(await fsp.readFile(sourcePath, "utf8"));
  content.ui_review_context = metadata;
  await writeJson(targetPath, content);
}

async function copyTextWithMetadata(sourcePath, targetPath, metadata) {
  const original = await fsp.readFile(sourcePath, "utf8");
  const header = [
    `Project Name: ${metadata.project_name}`,
    `User Name: ${metadata.user_name || "-"}`,
    `Selected Checklist: ${metadata.selected_checklist.displayName || metadata.selected_checklist.name}`,
    `Selected Excel Report(s): ${metadata.selected_excel_reports.map((file) => file.name).join(", ")}`,
    `Selected PDF Report(s): ${metadata.selected_pdf_reports.map((file) => file.name).join(", ")}`,
    `Review Completed At: ${metadata.review_completed_at}`,
    "",
    "---",
    ""
  ].join("\n");
  await writeText(targetPath, `${header}${original}`);
}

function assertInside(baseDir, targetPath) {
  const base = path.resolve(baseDir);
  const target = path.resolve(targetPath);
  const baseWithSeparator = base.endsWith(path.sep) ? base : `${base}${path.sep}`;
  if (!target.toLowerCase().startsWith(baseWithSeparator.toLowerCase())) {
    const error = new Error("Refusing to operate outside the project workspace.");
    error.statusCode = 400;
    throw error;
  }
  return target;
}

function isInsidePath(baseDir, targetPath) {
  const base = path.resolve(baseDir);
  const target = path.resolve(targetPath);
  const baseWithSeparator = base.endsWith(path.sep) ? base : `${base}${path.sep}`;
  return target.toLowerCase() === base.toLowerCase() || target.toLowerCase().startsWith(baseWithSeparator.toLowerCase());
}

function resolveRepositoryFile(value, actor = null) {
  const text = String(value || "").trim();
  if (!text) {
    const error = new Error("Review file path is required.");
    error.statusCode = 400;
    throw error;
  }

  const targetPath = path.isAbsolute(text) ? text : path.resolve(AI_REVIEW_ROOT, text);
  const safePath = assertInside(EXCEL_PDF_REVIEW_OUTPUT_ROOT, targetPath);
  if (actor && !actor.isAdmin && !isInsidePath(path.join(EXCEL_PDF_REVIEW_OUTPUT_ROOT, userReviewFolderName(actor.username)), safePath)) {
    const error = new Error("You do not have access to this review file.");
    error.statusCode = 403;
    throw error;
  }
  if (!fs.existsSync(safePath) || !fs.statSync(safePath).isFile()) {
    const error = new Error("Review file was not found.");
    error.statusCode = 404;
    throw error;
  }
  return safePath;
}

function assertProjectId(value) {
  const projectId = String(value || "").trim();
  if (!/^[a-z0-9][a-z0-9_-]{0,62}$/.test(projectId)) {
    const error = new Error("Invalid project_id. Use lowercase letters, digits, hyphens, and underscores.");
    error.statusCode = 400;
    throw error;
  }
  return projectId;
}

function assertPhaseId(value) {
  const phaseId = String(value || "");
  if (!PHASES.some((phase) => phase.id === phaseId)) {
    const error = new Error("Invalid phase id.");
    error.statusCode = 400;
    throw error;
  }
  return phaseId;
}

function safeFilename(filename) {
  return path.basename(String(filename || "artifact")).replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 160);
}

function relativePath(baseDir, targetPath) {
  return path.relative(baseDir, targetPath).replace(/\\/g, "/");
}

function projectFolderName(value) {
  return safeFileName(value || "excel-pdf-data-review", "excel-pdf-data-review");
}

function userReviewFolderName(value) {
  return safeFileName(value || "unknown-user", "unknown-user");
}

function safeFileName(value, fallback = "review-file") {
  const safe = String(value || "")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
    .slice(0, 120);
  return safe || fallback;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 63);
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function readText(filePath, fallback = "") {
  try {
    return await fsp.readFile(filePath, "utf8");
  } catch {
    return fallback;
  }
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fsp.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await fsp.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeText(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await fsp.writeFile(filePath, value, "utf8");
}

async function moveProjectToTrash(projectId, actor = null) {
  const source = assertInside(PROJECTS_ROOT, projectPath(projectId));
  const trashRoot = assertInside(PROJECTS_ROOT, path.join(PROJECTS_ROOT, "_trash"));
  const state = await readProjectState(projectId);
  await ensureDir(trashRoot);

  let target = "";
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${attempt}`;
    target = assertInside(trashRoot, path.join(trashRoot, `${projectId}-${timestamp()}${suffix}`));
    if (!fs.existsSync(target)) break;
  }
  if (!target || fs.existsSync(target)) {
    const error = new Error("Could not create a unique trash location for this project.");
    error.statusCode = 500;
    throw error;
  }

  await fsp.rename(source, target);
  await writeJson(path.join(target, "trash-metadata.json"), {
    projectId,
    projectName: state.projectName,
    movedByUserName: actor?.username || "",
    movedToTrashAt: new Date().toISOString(),
    originalPath: `projects/${projectId}`,
    trashPath: path.relative(ROOT, target).replace(/\\/g, "/")
  });

  return {
    projectId,
    trashed: true,
    trashPath: path.relative(ROOT, target).replace(/\\/g, "/")
  };
}

async function createProjectWorkspace({ projectId, projectName, owner, targetPlatform, ownerUserName, createdByUserName }) {
  const projectRoot = projectPath(projectId);
  const directories = [
    "",
    ...PHASES.map((phase) => `phases/${phase.id}`),
    "inputs",
    "data-dictionary",
    "sql",
    "dashboards",
    "review",
    "tests",
    "delivery",
    "evidence"
  ];

  for (const directory of directories) {
    await ensureDir(path.join(projectRoot, directory));
  }

  const now = new Date().toISOString();
  const state = {
    projectId,
    projectName,
    owner,
    ownerUserName: ownerUserName || createdByUserName || BUILT_IN_ADMIN.username,
    createdByUserName: createdByUserName || ownerUserName || BUILT_IN_ADMIN.username,
    targetPlatform,
    status: "active",
    currentPhaseId: PHASES[0].id,
    createdAt: now,
    updatedAt: now,
    phases: Object.fromEntries(
      PHASES.map((phase, index) => [
        phase.id,
        {
          status: index === 0 ? "in-progress" : "not-started",
          gateRecommendation: "TBD",
          lastArtifact: "",
          updatedAt: now
        }
      ])
    )
  };

  await writeProjectState(state);
  await writeProjectMarkdown(state);
  for (const phase of PHASES) {
    await writeText(phasePath(projectId, phase.id, phase.artifactName), starterArtifact(state, phase));
    await writeJson(phasePath(projectId, phase.id, "gate-status.json"), buildDefaultGate(state, phase.id));
  }
}

async function readProjectState(projectId) {
  const statePath = projectPath(projectId, "workflow-state.json");
  const state = await readJson(statePath, null);
  if (state) return state;

  const projectMarkdown = await readText(projectPath(projectId, "PROJECT.md"));
  if (!projectMarkdown) {
    const error = new Error("Project not found.");
    error.statusCode = 404;
    throw error;
  }
  const projectName = matchLine(projectMarkdown, /^# Project:\s*(.+)$/m) || projectId;
  const owner = matchLine(projectMarkdown, /^- Business owner:\s*(.*)$/m) || "";
  const currentPhaseId = matchLine(projectMarkdown, /^- Current phase:\s*(.*)$/m) || PHASES[0].id;
  return {
    projectId,
    projectName,
    owner,
    ownerUserName: BUILT_IN_ADMIN.username,
    createdByUserName: BUILT_IN_ADMIN.username,
    targetPlatform: matchLine(projectMarkdown, /^- Target platform:\s*(.*)$/m) || "",
    status: matchLine(projectMarkdown, /^- Status:\s*(.*)$/m) || "active",
    currentPhaseId,
    createdAt: "",
    updatedAt: "",
    phases: Object.fromEntries(
      PHASES.map((phase) => [
        phase.id,
        {
          status: phase.id === currentPhaseId ? "in-progress" : "not-started",
          gateRecommendation: "TBD",
          lastArtifact: "",
          updatedAt: ""
        }
      ])
    )
  };
}

function matchLine(text, regex) {
  const match = text.match(regex);
  return match ? match[1].trim() : "";
}

async function writeProjectState(state) {
  await writeJson(projectPath(state.projectId, "workflow-state.json"), state);
}

async function writeProjectMarkdown(state) {
  const rows = PHASES.map((phase) => {
    const phaseState = state.phases[phase.id] || {};
    return `| ${phase.id} | ${phaseState.status || "not-started"} | ${phaseState.gateRecommendation || "TBD"} | ${phaseState.lastArtifact || "TBD"} | ${state.owner || "TBD"} |`;
  }).join("\n");

  const markdown = `# Project: ${state.projectName}

- Project ID: ${state.projectId}
- Status: ${state.status}
- Current phase: ${state.currentPhaseId}
- Business owner: ${state.owner || ""}
- Login owner: ${projectOwnerUserName(state)}
- Technical owner:
- Support owner:
- Target platform: ${state.targetPlatform || ""}
- Created date: ${state.createdAt || ""}
- Last updated: ${state.updatedAt || ""}

## Scope

- In scope:
- Out of scope:

## Phase Status

| Phase | Status | Gate recommendation | Last artifact | Owner |
| --- | --- | --- | --- | --- |
${rows}

## Key Decisions

| Date | Decision | Owner | Evidence |
| --- | --- | --- | --- |

## Open Blockers

| Blocker | Phase | Owner | Next action | Target date |
| --- | --- | --- | --- | --- |
`;
  await writeText(projectPath(state.projectId, "PROJECT.md"), markdown);
}

function starterArtifact(state, phase) {
  return `# ${phase.outputTitle}

- Project ID: ${state.projectId}
- Project name: ${state.projectName}
- Phase: ${phase.id}
- Artifact type: ${phase.outputTitle}
- Artifact path: projects/${state.projectId}/phases/${phase.id}/${phase.artifactName}
- Version: v1
- Owner: ${state.owner || ""}
- Status: Draft
- Last updated: ${new Date().toISOString()}
`;
}

function toProjectSummary(state) {
  return {
    projectId: state.projectId,
    projectName: state.projectName,
    owner: state.owner,
    ownerUserName: projectOwnerUserName(state),
    createdByUserName: state.createdByUserName || projectOwnerUserName(state),
    status: state.status,
    currentPhaseId: state.currentPhaseId,
    targetPlatform: state.targetPlatform,
    updatedAt: state.updatedAt
  };
}

async function buildProjectDetail(state) {
  return {
    ...toProjectSummary(state),
    phases: await Promise.all(PHASES.map((phase) => buildPhaseDetail(state, phase.id)))
  };
}

async function buildPhaseDetail(state, phaseId) {
  const phase = PHASES.find((item) => item.id === phaseId);
  const phaseState = state.phases[phaseId] || {};
  const phaseDir = phasePath(state.projectId, phaseId);
  const artifactPath = path.join(phaseDir, phase.artifactName);
  const outputText = await readText(artifactPath);
  const uploads = await readUploadManifest(state.projectId, phaseId);
  const gate = await readGateState(state.projectId, phaseId);
  const outputs = await listGeneratedOutputs(state.projectId, phaseId);
  const questionAnswers = await readQuestionAnswers(state.projectId, phaseId);

  return {
    ...phase,
    title: phaseState.title || phase.title,
    state: phaseState,
    artifactPath: `projects/${state.projectId}/phases/${phaseId}/${phase.artifactName}`,
    outputText,
    uploads,
    gate,
    outputs,
    questionAnswers
  };
}

async function appendUploadManifest(projectId, phaseId, files) {
  const manifestPath = phasePath(projectId, phaseId, "uploads", "manifest.json");
  const current = await readJson(manifestPath, []);
  const additions = files.map((file) => ({
    id: `${timestamp()}-${Math.random().toString(16).slice(2)}`,
    originalName: file.originalname,
    storedName: path.basename(file.path),
    size: file.size,
    mimetype: file.mimetype,
    uploadedAt: new Date().toISOString()
  }));
  const manifest = [...current, ...additions];
  await writeJson(manifestPath, manifest);
  return manifest;
}

async function readUploadManifest(projectId, phaseId) {
  return readJson(phasePath(projectId, phaseId, "uploads", "manifest.json"), []);
}

async function readQuestionAnswers(projectId, phaseId) {
  return readJson(phasePath(projectId, phaseId, "question-answers.json"), {});
}

async function writeQuestionAnswers(projectId, phaseId, questionAnswers) {
  await writeJson(phasePath(projectId, phaseId, "question-answers.json"), questionAnswers);
}

function normalizeQuestionAnswers(questionAnswers) {
  if (!questionAnswers || typeof questionAnswers !== "object" || Array.isArray(questionAnswers)) return {};
  return Object.fromEntries(
    Object.entries(questionAnswers)
      .map(([key, value]) => [slugify(key).replace(/-/g, "_"), String(value || "").trim().slice(0, 5000)])
      .filter(([key]) => key)
  );
}

function normalizeGatePayload(gate) {
  if (!gate || typeof gate !== "object") {
    const error = new Error("Invalid gate payload.");
    error.statusCode = 400;
    throw error;
  }
  const normalizeRows = (rows) =>
    Array.isArray(rows)
      ? rows.map((row) => ({
          item: String(row.item || ""),
          requiredCondition: String(row.requiredCondition || ""),
          status: normalizeGateStatus(row.status),
          evidence: String(row.evidence || ""),
          owner: String(row.owner || ""),
          notes: String(row.notes || "")
        }))
      : [];
  return {
    projectContext: normalizeRows(gate.projectContext),
    entry: normalizeRows(gate.entry),
    exit: normalizeRows(gate.exit),
    updatedAt: new Date().toISOString()
  };
}

function normalizeGateStatus(status) {
  const value = String(status || "Incomplete");
  return ["Complete", "Incomplete", "Blocked", "Not applicable"].includes(value) ? value : "Incomplete";
}

async function readGateState(projectId, phaseId) {
  const state = await readProjectState(projectId);
  const gatePath = phasePath(projectId, phaseId, "gate-status.json");
  const gate = await readJson(gatePath, null);
  if (gate) return gate;
  const defaultGate = buildDefaultGate(state, phaseId);
  await writeJson(gatePath, defaultGate);
  return defaultGate;
}

function buildDefaultGate(state, phaseId) {
  const phase = PHASES.find((item) => item.id === phaseId);
  const projectRoot = `projects/${state.projectId}`;
  const artifactPath = `${projectRoot}/phases/${phaseId}/${phase.artifactName}`;
  const projectContext = GATES.projectContext.map(([item, requiredCondition]) => {
    if (item === "Project owner" && !state.owner) {
      return gateRow(item, requiredCondition, "Incomplete", "", "", "Add owner before phase completion.");
    }
    if (item === "Cross-project scope") {
      return gateRow(item, requiredCondition, "Not applicable", "Single project workspace.", state.owner, "No cross-project scope declared.");
    }
    const evidenceMap = {
      "Project ID": state.projectId,
      "Project workspace": projectRoot,
      "Project control file": `${projectRoot}/PROJECT.md`,
      "Current phase": state.currentPhaseId,
      "Artifact path": artifactPath
    };
    return gateRow(item, requiredCondition, "Complete", evidenceMap[item] || state.owner || "Project context exists.", state.owner, "");
  });

  const gates = GATES[phaseId];
  return {
    projectContext,
    entry: gates.entry.map(([item, requiredCondition]) => gateRow(item, requiredCondition)),
    exit: gates.exit.map(([item, requiredCondition]) => gateRow(item, requiredCondition)),
    updatedAt: new Date().toISOString()
  };
}

function gateRow(item, requiredCondition, status = "Incomplete", evidence = "", owner = "", notes = "") {
  return { item, requiredCondition, status, evidence, owner, notes };
}

function findGateBlockers(gate) {
  const rows = [...(gate.projectContext || []), ...(gate.entry || []), ...(gate.exit || [])];
  return rows.filter((row) => {
    if (row.status === "Complete") return false;
    if (row.status === "Not applicable") return !String(row.notes || row.evidence || "").trim();
    return true;
  });
}

async function listGeneratedOutputs(projectId, phaseId) {
  const dir = phasePath(projectId, phaseId);
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.startsWith("agent-output-") && entry.name.endsWith(".md"))
      .map((entry) => ({
        name: entry.name,
        path: `projects/${projectId}/phases/${phaseId}/${entry.name}`
      }))
      .sort((a, b) => b.name.localeCompare(a.name));
  } catch {
    return [];
  }
}

async function runLocalPhaseAgent(projectId, phaseId, notes, incomingQuestionAnswers = null) {
  const state = await readProjectState(projectId);
  const phase = PHASES.find((item) => item.id === phaseId);
  const phaseDoc = await readText(path.join(SKILL_ROOT, "phases", phaseId, "PHASE.md"));
  const artifactTemplate = await readText(path.join(SKILL_ROOT, "references", "artifacts.md"));
  const gate = await readGateState(projectId, phaseId);
  const uploads = await summarizeUploads(projectId, phaseId);
  const savedQuestionAnswers = await readQuestionAnswers(projectId, phaseId);
  const questionAnswers = incomingQuestionAnswers ? { ...savedQuestionAnswers, ...incomingQuestionAnswers } : savedQuestionAnswers;
  if (incomingQuestionAnswers) await writeQuestionAnswers(projectId, phaseId, questionAnswers);
  const existingArtifact = await readText(phasePath(projectId, phaseId, phase.artifactName));
  const blockerCount = findGateBlockers(gate).length;
  const reviewSummary = phaseId === "05-ai-review-validation" ? await loadLatestExcelPdfReviewSummaryForProject(state) : null;
  const reviewHighFindingCount = countHighReviewFindings(reviewSummary);
  const effectiveBlockerCount = blockerCount + reviewHighFindingCount;
  const output = buildAgentOutput({
    state,
    phase,
    notes,
    phaseDoc,
    artifactTemplate,
    uploads,
    questionAnswers,
    gate,
    existingArtifact,
    blockerCount,
    effectiveBlockerCount,
    reviewSummary
  });

  const outputName = `agent-output-${timestamp()}.md`;
  await writeText(phasePath(projectId, phaseId, outputName), output);
  await writeText(phasePath(projectId, phaseId, phase.artifactName), output);

  state.phases[phaseId] = {
    ...state.phases[phaseId],
    status: "in-progress",
    gateRecommendation: effectiveBlockerCount === 0 ? "Ready for human review" : "No-go: gate blockers remain",
    lastArtifact: `projects/${projectId}/phases/${phaseId}/${phase.artifactName}`,
    updatedAt: new Date().toISOString()
  };
  state.currentPhaseId = phaseId;
  state.updatedAt = new Date().toISOString();
  await writeProjectState(state);
  await writeProjectMarkdown(state);

  return {
    output,
    outputPath: `projects/${projectId}/phases/${phaseId}/${outputName}`,
    artifactPath: `projects/${projectId}/phases/${phaseId}/${phase.artifactName}`,
    gateRecommendation: state.phases[phaseId].gateRecommendation
  };
}

async function summarizeUploads(projectId, phaseId) {
  const manifest = await readUploadManifest(projectId, phaseId);
  const summaries = [];
  for (const file of manifest) {
    const filePath = phasePath(projectId, phaseId, "uploads", file.storedName);
    const ext = path.extname(file.originalName).toLowerCase();
    const textExts = new Set([".txt", ".md", ".csv", ".sql", ".json", ".yaml", ".yml", ".log"]);
    const excelExts = new Set([".xlsx", ".xlsm", ".xltx", ".xltm"]);
    let preview = "";
    if (excelExts.has(ext)) {
      preview = await previewExcelWorkbook(filePath);
    } else if (textExts.has(ext)) {
      preview = (await readText(filePath)).slice(0, 5000);
    } else {
      preview = `Binary artifact recorded (${file.mimetype || "unknown type"}). Review content manually or provide extracted text.`;
    }
    summaries.push({ ...file, preview });
  }
  return summaries;
}

async function previewExcelWorkbook(filePath) {
  try {
    return previewExcelWorkbookWithXlsx(filePath).slice(0, 8000);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Excel artifact uploaded, but preview extraction failed: ${message}`;
  }
}

function previewExcelWorkbookWithXlsx(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true, cellText: false });
  const lines = [`Excel workbook: ${path.basename(filePath)}`, `Sheets: ${workbook.SheetNames.join(", ")}`];
  for (const sheetName of workbook.SheetNames.slice(0, 8)) {
    const sheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
    lines.push("", `Sheet: ${sheetName}`, `Used range estimate: ${range.e.r + 1} rows x ${range.e.c + 1} columns`);
    let rowCount = 0;
    for (let row = range.s.r; row <= Math.min(range.e.r, range.s.r + 11); row += 1) {
      const values = [];
      for (let col = range.s.c; col <= Math.min(range.e.c, range.s.c + 11); col += 1) {
        values.push(cleanWorkbookText(cellValue(sheet, row, col)).slice(0, 160));
      }
      if (values.some(Boolean)) {
        lines.push(values.join(" | "));
        rowCount += 1;
      }
    }
    if (rowCount === 0) lines.push("(No non-empty preview rows found.)");
  }
  return lines.join("\n");
}

function buildAgentOutput({ state, phase, notes, uploads, questionAnswers, gate, blockerCount, effectiveBlockerCount, reviewSummary }) {
  const now = new Date().toISOString();
  const answeredQuestions = Object.entries(questionAnswers || {}).filter(([, value]) => String(value || "").trim());
  const uploadRows =
    uploads.length === 0
      ? "| None | No uploaded artifacts for this run. | |\n"
      : uploads
          .map((file) => `| ${escapePipes(file.originalName)} | ${file.size} bytes | ${escapePipes(file.preview.split("\n").slice(0, 3).join(" "))} |`)
          .join("\n");
  const questionRows =
    answeredQuestions.length === 0
      ? "| None | No guided answers supplied. |\n"
      : answeredQuestions.map(([key, value]) => `| ${humanizeQuestionKey(key)} | ${escapePipes(value)} |`).join("\n");
  const uploadDetails =
    uploads.length === 0
      ? "No uploaded artifacts."
      : uploads
          .map(
            (file) => `### ${file.originalName}

\`\`\`text
${file.preview}
\`\`\``
          )
          .join("\n\n");
  const gateSummary = summarizeGate(gate);
  const reviewHighFindingCount = countHighReviewFindings(reviewSummary);

  return `# ${phase.outputTitle}

- Project ID: ${state.projectId}
- Project name: ${state.projectName}
- Phase: ${phase.id}
- Artifact type: ${phase.outputTitle}
- Artifact path: projects/${state.projectId}/phases/${phase.id}/${phase.artifactName}
- Version: ${now}
- Owner: ${state.owner || "TBD"}
- Status: Draft
- Last updated: ${now}

## Agent Run Summary

- Backend agent: Local file-based phase runner
- Gate recommendation: ${effectiveBlockerCount === 0 ? "Ready for human review" : "No-go: gate blockers remain"}
- Gate blockers remaining: ${effectiveBlockerCount}
- Manual gate blockers: ${blockerCount}
- High review findings: ${reviewHighFindingCount}
- Review finding file loaded: ${reviewSummary ? "Yes" : "No"}
- Notes supplied: ${notes ? "Yes" : "No"}
- Guided questions answered: ${answeredQuestions.length}
- Uploaded artifacts reviewed: ${uploads.length}

## Guided Answers

| Question | Answer |
| --- | --- |
${questionRows}

## User Notes

${notes || "TBD"}

## Uploaded Artifacts

| Artifact | Size | Agent-readable preview |
| --- | ---: | --- |
${uploadRows}

## Artifact Details

${uploadDetails}

${phaseWorkProduct(phase.id, questionAnswers, reviewSummary)}

## Gate Status Summary

| Gate area | Complete | Incomplete | Blocked | Not applicable |
| --- | ---: | ---: | ---: | ---: |
${gateSummary}

## Next Required Human Actions

${effectiveBlockerCount === 0 ? "- Review this draft and mark the phase exit gate complete when evidence is accepted." : "- Resolve incomplete or blocked gate items and high review findings before completing this phase."}
- Add missing evidence directly in the UI gate table.
- Upload supporting artifacts when a gate item depends on screenshots, schema files, SQL, exports, or approvals.

## Backend Agent Limitation

This local runner structures the phase output and uses uploaded text artifacts when possible. Images, PDFs, and binary documents are recorded as artifacts; provide extracted text or a manual summary when exact content must be analyzed.
`;
}

function phaseWorkProduct(phaseId, questionAnswers = {}, reviewSummary = null) {
  if (phaseId === "01-requirement-intake") {
    return `## Requirement Brief Draft

- Business objective: ${answerValue(questionAnswers, "business_objective")}
- Business decision supported: ${answerValue(questionAnswers, "business_decision")}
- Audience: ${answerValue(questionAnswers, "stakeholders", "audience")}
- Platform path: ${answerValue(questionAnswers, "target_platform")}
- Known data expectations: ${answerValue(questionAnswers, "data_expectations")}
- Security and delivery expectations: ${answerValue(questionAnswers, "security_delivery")}

## KPI Catalog

| KPI | Definition | Formula | Grain | Filters | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- |
| ${escapePipes(answerValue(questionAnswers, "kpis"))} | ${escapePipes(answerValue(questionAnswers, "kpi_definitions"))} | TBD | TBD | ${escapePipes(answerValue(questionAnswers, "filters_time"))} | ${escapePipes(answerValue(questionAnswers, "stakeholders", "owner"))} | Draft |

## Open Questions

| Priority | Question | Why it matters | Suggested owner |
| --- | --- | --- | --- |
| High | ${escapePipes(answerValue(questionAnswers, "open_questions"))} | Blocks reliable SQL and testing. | Business owner |
`;
  }
  if (phaseId === "02-ai-analysis-understanding") {
    return `## Source-to-Report Mapping Draft

| Requirement | Type | Source table.column | Transformation | Grain | Join path | Confidence | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ${escapePipes(answerValue(questionAnswers, "source_systems", "requirements"))} | KPI/data field | ${escapePipes(answerValue(questionAnswers, "schema_path", "source_fields"))} | ${escapePipes(answerValue(questionAnswers, "transformations"))} | ${escapePipes(answerValue(questionAnswers, "grain"))} | ${escapePipes(answerValue(questionAnswers, "joins"))} | Draft | Data owner |

## Data Quality Checks Needed

- Data access path: ${answerValue(questionAnswers, "schema_path")}
- Data quality risks: ${answerValue(questionAnswers, "quality_risks")}
- Validation plan: ${answerValue(questionAnswers, "validation_plan")}
`;
  }
  if (phaseId === "03-sql-draft-logic-preparation") {
    return `## SQL Draft Placeholder

\`\`\`sql
-- Add PostgreSQL draft here after source mapping and KPI logic are confirmed.
with params as (
    select
        cast(:start_date as date) as start_date,
        cast(:end_date as date) as end_date
)
select *
from params;
\`\`\`

## Validation Queries Needed

- Row counts by source stage
- Duplicate checks for join keys
- Null checks for required fields
- KPI reconciliation checks
`;
  }
  if (phaseId === "04-dashboard-report-development") {
    return `## Build Plan Draft

| Section | Purpose | Components |
| --- | --- | --- |
| Summary | Show primary KPIs and status | KPI cards, trend, filters |

## Visual Inventory

| Visual | Type | KPI/field | Dataset/query | Filters | Interaction |
| --- | --- | --- | --- | --- | --- |
| TBD | TBD | TBD | TBD | TBD | TBD |
`;
  }
  if (phaseId === "05-ai-review-validation") {
    return buildPhaseFiveReviewWorkProduct(questionAnswers, reviewSummary);
  }
  if (phaseId === "06-testing-verification") {
    return `## Test Log Draft

| ID | Category | Test case | Expected result | Actual result | Status | Evidence | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T-001 | Acceptance | Verify each acceptance criterion. | Criteria met | TBD | Blocked | TBD | QA owner |
`;
  }
  return `## Delivery Summary Draft

- Delivered artifact: TBD
- Platform: TBD
- Environment: TBD
- Business sign-off: TBD
- Technical sign-off: TBD
- Support owner: TBD

## Post-Delivery Actions

| Action | Owner | Due date | Priority |
| --- | --- | --- | --- |
| Confirm monitoring and support handoff. | Support owner | TBD | High |
`;
}

function buildPhaseFiveReviewWorkProduct(questionAnswers = {}, reviewSummary = null) {
  if (!reviewSummary) {
    return `## Review Finding File Summary

No generated Excel/PDF review finding JSON is available yet for this project. Run the Excel/PDF data review first, then generate this phase artifact again.

## Review Scope From Guided Answers

- Review scope: ${answerValue(questionAnswers, "review_scope")}
- Review evidence: ${answerValue(questionAnswers, "review_evidence")}
- Known findings: ${answerValue(questionAnswers, "known_findings")}

## Review Log Draft

| Severity | Area | Finding | Evidence | Recommendation | Owner | Blocking? |
| --- | --- | --- | --- | --- | --- | --- |
| High | Review files | Generated review finding file is not available. | No latest review JSON found for this project. | Run the Excel/PDF review and regenerate the phase artifact. | Project owner | Yes |
`;
  }

  const checks = reviewSummary.qualityChecks || [];
  const findings = reviewSummary.findings || [];
  const evidenceRows = reviewSummary.evidenceRows || [];
  const totalOk = checks.reduce((sum, check) => sum + Number(check.ok || 0), 0);
  const totalNotOk = checks.reduce((sum, check) => sum + Number(check.notOk || 0), 0);
  const totalNa = checks.reduce((sum, check) => sum + Number(check.na || 0), 0);
  const highFindings = findings.filter((finding) => String(finding.severity || "").toLowerCase() === "high").length;
  const checkRows =
    checks.length === 0
      ? "| - | - | - | - |\n"
      : checks
          .map(
            (check) =>
              `| ${escapePipes(check.area)} | ${escapePipes(check.label)} | ${escapePipes(check.status)} | ${escapePipes(check.detail)} |`
          )
          .join("\n");
  const findingRows =
    findings.length === 0
      ? "| Info | Review | No generated findings were available. | - | Review the repository files manually. |\n"
      : findings
          .slice(0, 25)
          .map(
            (finding) =>
              `| ${escapePipes(finding.severity)} | ${escapePipes(finding.area)} | ${escapePipes(finding.finding)} | ${escapePipes(finding.evidence)} | ${escapePipes(finding.recommendation)} |`
          )
          .join("\n");
  const evidenceTableRows =
    evidenceRows.length === 0
      ? "| - | - | - | - |\n"
      : evidenceRows
          .slice(0, 25)
          .map(
            (row) =>
              `| ${escapePipes(row.metric)} | ${escapePipes(row.excel)} | ${escapePipes(row.pdf)} | ${escapePipes(row.status)} |`
          )
          .join("\n");

  return `## Review Finding File Summary

- Source review file: ${reviewSummary.sourcePath || "-"}
- Project name: ${reviewSummary.projectName || "-"}
- Reviewer name: ${reviewSummary.reviewerName || "-"}
- Generated at: ${reviewSummary.generatedAt || "-"}
- Quality check cells: ${totalOk} OK, ${totalNotOk} Not OK, ${totalNa} NA
- Generated findings: ${findings.length}
- High findings: ${highFindings}

## Review Scope From Guided Answers

- Review scope: ${answerValue(questionAnswers, "review_scope")}
- Review evidence: ${answerValue(questionAnswers, "review_evidence")}
- Known findings: ${answerValue(questionAnswers, "known_findings")}

## Quality Checks From Review Files

| Area | Check | Status | Detail |
| --- | --- | --- | --- |
${checkRows}

## Findings From Review Files

| Severity | Area | Finding | Evidence | Recommendation |
| --- | --- | --- | --- | --- |
${findingRows}

## Reconciliation Evidence From Review Files

| Metric | Excel | PDF | Status |
| --- | --- | --- | --- |
${evidenceTableRows}
`;
}

function countHighReviewFindings(reviewSummary) {
  if (!reviewSummary) return 0;
  return (reviewSummary.findings || []).filter((finding) => String(finding.severity || "").toLowerCase() === "high").length;
}

function summarizeGate(gate) {
  return [
    ["Project Context", gate.projectContext || []],
    ["Entry", gate.entry || []],
    ["Exit", gate.exit || []]
  ]
    .map(([label, rows]) => {
      const counts = countStatuses(rows);
      return `| ${label} | ${counts.Complete} | ${counts.Incomplete} | ${counts.Blocked} | ${counts["Not applicable"]} |`;
    })
    .join("\n");
}

function countStatuses(rows) {
  return rows.reduce(
    (acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    },
    { Complete: 0, Incomplete: 0, Blocked: 0, "Not applicable": 0 }
  );
}

function escapePipes(value) {
  return String(value || "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").slice(0, 500);
}

function answerValue(questionAnswers, ...keys) {
  for (const key of keys) {
    const value = String(questionAnswers?.[key] || "").trim();
    if (value) return value;
  }
  return "TBD";
}

function humanizeQuestionKey(key) {
  return String(key || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getNextPhase(phaseId) {
  const index = PHASES.findIndex((phase) => phase.id === phaseId);
  return index >= 0 ? PHASES[index + 1] : null;
}
