import cors from "cors";
import express from "express";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const PROJECTS_ROOT = path.join(ROOT, "projects");
const SKILL_ROOT = path.join(ROOT, "ai-assisted-reporting-dashboard");
const EXCEL_PREVIEW_SCRIPT = path.join(ROOT, "scripts", "excel-preview.py");
const PORT = Number(process.env.PORT || 8787);
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
    ["Project ID", "Stable project_id is known and uses lowercase letters, digits, and hyphens."],
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

app.get("/api/health", (req, res) => {
  res.json({ ok: true, serverTime: new Date().toISOString() });
});

app.get("/api/phases", (req, res) => {
  res.json({ phases: PHASES, gates: GATES });
});

app.get("/api/projects", async (req, res, next) => {
  try {
    await ensureDir(PROJECTS_ROOT);
    const entries = await fsp.readdir(PROJECTS_ROOT, { withFileTypes: true });
    const projects = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
      const state = await readProjectState(entry.name);
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
    const projectId = assertProjectId(req.body.projectId || slugify(req.body.projectName || ""));
    const projectName = String(req.body.projectName || projectId).trim();
    const owner = String(req.body.owner || "").trim();
    const targetPlatform = String(req.body.targetPlatform || "").trim();
    const projectRoot = projectPath(projectId);
    if (fs.existsSync(projectRoot)) {
      return res.status(409).json({ error: "Project already exists." });
    }

    await createProjectWorkspace({ projectId, projectName, owner, targetPlatform });
    const state = await readProjectState(projectId);
    res.status(201).json({ project: await buildProjectDetail(state) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/projects/:projectId", async (req, res, next) => {
  try {
    const projectId = assertProjectId(req.params.projectId);
    const state = await readProjectState(projectId);
    const project = await buildProjectDetail(state);
    res.json({ project });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/projects/:projectId", async (req, res, next) => {
  try {
    const projectId = assertProjectId(req.params.projectId);
    const result = await moveProjectToTrash(projectId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/projects/:projectId/phases/:phaseId", async (req, res, next) => {
  try {
    const projectId = assertProjectId(req.params.projectId);
    const phaseId = assertPhaseId(req.params.phaseId);
    const state = await readProjectState(projectId);
    const phase = await buildPhaseDetail(state, phaseId);
    res.json({ phase });
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects/:projectId/phases/:phaseId/uploads", upload.array("files", 10), async (req, res, next) => {
  try {
    const projectId = assertProjectId(req.params.projectId);
    const phaseId = assertPhaseId(req.params.phaseId);
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

app.use((error, req, res, next) => {
  console.error(error);
  const status = error.statusCode || 500;
  res.status(status).json({ error: error.message || "Unexpected server error." });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`DA automation API listening on http://127.0.0.1:${PORT}`);
});

function phasePath(projectId, phaseId, ...parts) {
  return path.join(projectPath(projectId), "phases", phaseId, ...parts);
}

function projectPath(projectId, ...parts) {
  return path.join(PROJECTS_ROOT, projectId, ...parts);
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

function assertProjectId(value) {
  const projectId = String(value || "").trim();
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(projectId)) {
    const error = new Error("Invalid project_id. Use lowercase letters, digits, and hyphens.");
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

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
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

async function moveProjectToTrash(projectId) {
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

async function createProjectWorkspace({ projectId, projectName, owner, targetPlatform }) {
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
    blockerCount
  });

  const outputName = `agent-output-${timestamp()}.md`;
  await writeText(phasePath(projectId, phaseId, outputName), output);
  await writeText(phasePath(projectId, phaseId, phase.artifactName), output);

  state.phases[phaseId] = {
    ...state.phases[phaseId],
    status: "in-progress",
    gateRecommendation: blockerCount === 0 ? "Ready for human review" : "No-go: gate blockers remain",
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
    const { stdout } = await execFileAsync("py", ["-3", EXCEL_PREVIEW_SCRIPT, filePath], {
      timeout: 30000,
      maxBuffer: 1024 * 1024
    });
    return stdout.trim().slice(0, 8000);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Excel artifact uploaded, but preview extraction failed: ${message}`;
  }
}

function buildAgentOutput({ state, phase, notes, uploads, questionAnswers, gate, blockerCount }) {
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
- Gate recommendation: ${blockerCount === 0 ? "Ready for human review" : "No-go: gate blockers remain"}
- Gate blockers remaining: ${blockerCount}
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

${phaseWorkProduct(phase.id, questionAnswers)}

## Gate Status Summary

| Gate area | Complete | Incomplete | Blocked | Not applicable |
| --- | ---: | ---: | ---: | ---: |
${gateSummary}

## Next Required Human Actions

${blockerCount === 0 ? "- Review this draft and mark the phase exit gate complete when evidence is accepted." : "- Resolve incomplete or blocked gate items before completing this phase."}
- Add missing evidence directly in the UI gate table.
- Upload supporting artifacts when a gate item depends on screenshots, schema files, SQL, exports, or approvals.

## Backend Agent Limitation

This local runner structures the phase output and uses uploaded text artifacts when possible. Images, PDFs, and binary documents are recorded as artifacts; provide extracted text or a manual summary when exact content must be analyzed.
`;
}

function phaseWorkProduct(phaseId, questionAnswers = {}) {
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
    return `## Review Log Draft

| Severity | Area | Finding | Evidence | Recommendation | Owner | Blocking? |
| --- | --- | --- | --- | --- | --- | --- |
| High | Coverage | Requirement coverage needs evidence. | TBD | Complete coverage matrix. | Project owner | Yes |
`;
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
