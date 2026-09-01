import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  CheckCircle2,
  Circle,
  Clock,
  Download,
  Eye,
  FileCheck2,
  FileText,
  FolderPlus,
  LogOut,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Upload,
  UserPlus,
  UserRound,
  X,
  XCircle
} from "lucide-react";
import { ChangeEvent, CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import ExcelPdfReviewApp from "./ExcelPdfReviewApp";
import {
  GateRow,
  GateState,
  Phase,
  PhaseDefinition,
  ProjectDetail,
  ProjectSummary,
  apiGet,
  apiPost,
  apiPut
} from "./api";

const statusOptions = ["Complete", "Incomplete", "Blocked", "Not applicable"] as const;
const validLogin = { username: "Rahul_Raj", password: "Alpha1" };
const authKey = "da-review-ai-ui-authenticated";
const authUsernameKey = "da-review-ai-ui-username";
const authUserTypeKey = "da-review-ai-ui-user-type";
const lastUsernameKey = "da-review-ai-ui-last-username";
const defaultReviewPhaseId = "05-ai-review-validation";
const dashboardReviewClientTimeoutMs = 10 * 60 * 1000;
const dashboardReviewApiPort = "8006";
const defaultDashboardChecklistPath = "C:\\Users\\Dell_PC\\Downloads\\COMMON CHECK LIST (1).xlsx";
const dashboardLatestChecklistPreferenceKey = "da-review-dashboard-latest-checklist";

type CreateUserInput = {
  adminUsername: string;
  adminPassword: string;
  username: string;
  password: string;
};

type CreateUserResult = {
  ok: boolean;
  message: string;
  username?: string;
};

type LoginResult = {
  ok: boolean;
  username: string;
  userType?: string;
};

type DashboardRunMode = "linked" | "fixed" | "single";
type DashboardAuthMode = "anonymous" | "bearer" | "basic";

type DashboardArtifact = {
  path: string;
  name: string;
  displayName?: string;
  extension?: string;
  artifactType?: string;
  size?: number;
  modifiedAt?: string;
  canView?: boolean;
};

type DashboardChecklistOption = {
  label: string;
  path: string;
  exists?: boolean;
  isDefault?: boolean;
  revisionMajor?: number;
  revisionMinor?: number;
  revisionNumber?: number;
  revisionLabel?: string;
  modifiedAt?: string;
  uploaded?: boolean;
};

type DashboardChecklistSheetInfo = {
  name: string;
  maxRow?: number;
  maxColumn?: number;
  headerRow?: number;
  serialColumn?: number;
  pointColumn?: number;
  pointCount?: number;
};

type DashboardChecklistGridRow = {
  rowNumber: number;
  values: string[];
};

type DashboardChecklistGridResponse = {
  sheetName: string;
  headerRow: number;
  firstDataRow: number;
  maxColumn: number;
  serialColumn: number;
  pointColumn: number;
  columns: string[];
  rows: DashboardChecklistGridRow[];
};

type DashboardChecklistRevisionResponse = {
  ok: boolean;
  revisionLabel?: string;
  createdFile?: DashboardChecklistOption;
  saved?: {
    savedPath?: string;
    sheetName?: string;
    updatedCount?: number;
  };
  checklists?: DashboardChecklistOption[];
};

const fallbackDashboardChecklistOptions: DashboardChecklistOption[] = [
  {
    label: "COMMON CHECK LIST (1).xlsx",
    path: defaultDashboardChecklistPath,
    exists: true,
    isDefault: true
  },
  {
    label: "Project COMMON CHECK LIST.xlsx",
    path: "D:\\AIReview\\report-review-input\\excel-pdf-data\\checklist\\COMMON CHECK LIST.xlsx",
    exists: true
  },
  {
    label: "Embedded dashboard checklist fallback",
    path: "",
    exists: true
  }
];

type Toast = { type: "success" | "error" | "info"; message: string } | null;
type PhaseQuestion = {
  id: string;
  label: string;
  help: string;
  placeholder: string;
  required?: boolean;
};

const phaseQuestions: Record<string, PhaseQuestion[]> = {
  "01-requirement-intake": [
    {
      id: "business_objective",
      label: "Business objective",
      help: "What decision or operational problem should this dashboard/report support?",
      placeholder: "Example: Monitor daily station availability and highlight SCADA issues.",
      required: true
    },
    {
      id: "stakeholders",
      label: "Stakeholders and audience",
      help: "Who requests, uses, validates, and approves the output?",
      placeholder: "Business owner, operations team, approver, technical owner",
      required: true
    },
    {
      id: "kpis",
      label: "KPIs and measures",
      help: "List the metrics, formulas if known, and any open KPI questions.",
      placeholder: "Availability %, downtime minutes, active alarms, response SLA",
      required: true
    },
    {
      id: "filters_time",
      label: "Filters and time logic",
      help: "Capture date range, timezone, dimensions, default filters, and comparisons.",
      placeholder: "Date range, line, station, equipment type, shift, timezone"
    },
    {
      id: "data_expectations",
      label: "Known data expectations",
      help: "Mention known source systems, files, existing reports, or data owners.",
      placeholder: "SCADA tables, current Excel, existing SQL, data owner"
    },
    {
      id: "security_delivery",
      label: "Security and delivery",
      help: "Who can view/export it, how often it refreshes, and how it will be delivered.",
      placeholder: "Viewer roles, export rules, refresh schedule, environment"
    },
    {
      id: "acceptance_criteria",
      label: "Acceptance criteria",
      help: "What must be true before this phase can close?",
      placeholder: "KPIs match source, filters work, owner approves requirement brief",
      required: true
    },
    {
      id: "open_questions",
      label: "Open questions",
      help: "Anything missing, unclear, or dependent on another owner.",
      placeholder: "Exact formula for availability, source table owner, refresh SLA"
    }
  ],
  "02-ai-analysis-understanding": [
    {
      id: "source_systems",
      label: "Source systems",
      help: "Which databases, files, schemas, or existing reports are relevant?",
      placeholder: "PostgreSQL schema, SCADA source, existing dashboard query",
      required: true
    },
    {
      id: "schema_path",
      label: "Database structure path",
      help: "Where is schema, DDL, sample data, data dictionary, or owner path available?",
      placeholder: "Upload path, schema name, data dictionary link, data owner",
      required: true
    },
    {
      id: "grain",
      label: "Data grain",
      help: "What is one row in each important source and in the final report?",
      placeholder: "Per station per minute, per alarm event, per equipment per day"
    },
    {
      id: "joins",
      label: "Join keys and risks",
      help: "Known joins, cardinality, duplicates, and missing key risks.",
      placeholder: "station_id, device_id, event_time; one-to-many risk"
    },
    {
      id: "transformations",
      label: "Transformations",
      help: "Calculations, exclusions, statuses, null handling, and conversions.",
      placeholder: "Exclude maintenance windows, convert seconds to minutes"
    },
    {
      id: "quality_risks",
      label: "Data quality risks",
      help: "Known nulls, late data, duplicate events, mismatch risks, or volume concerns.",
      placeholder: "Late events, null station mapping, duplicate alarms"
    },
    {
      id: "validation_plan",
      label: "Validation plan",
      help: "How should SQL and output be reconciled?",
      placeholder: "Compare totals with current Excel, row counts, duplicate checks"
    }
  ],
  "03-sql-draft-logic-preparation": [
    {
      id: "sql_target",
      label: "SQL target",
      help: "What should be produced: dashboard query, dataset, view, export, or report dataset?",
      placeholder: "Grafana panel query, Superset dataset, materialized view",
      required: true
    },
    {
      id: "kpi_rules",
      label: "KPI rules",
      help: "Confirmed formulas, filters, date logic, and units.",
      placeholder: "Availability = uptime / planned time, exclude maintenance"
    },
    {
      id: "parameters",
      label: "Parameters",
      help: "Date ranges, filters, role constraints, and optional parameters.",
      placeholder: ":start_date, :end_date, station, line, equipment_type"
    },
    {
      id: "performance_notes",
      label: "Performance notes",
      help: "Large tables, indexes, caching, materialization, or known query limits.",
      placeholder: "Partition by event_date, index station_id, cache daily summary"
    }
  ],
  "04-dashboard-report-development": [
    {
      id: "layout",
      label: "Layout and sections",
      help: "Pages, sections, panels, report bands, or exports needed.",
      placeholder: "Summary, station detail, trend, exception list",
      required: true
    },
    {
      id: "visuals",
      label: "Visual inventory",
      help: "Charts, tables, KPI cards, drilldowns, and field-level output.",
      placeholder: "KPI cards, availability trend, station table, alarm bar chart"
    },
    {
      id: "filter_behavior",
      label: "Filter behavior",
      help: "Defaults, interactions, date controls, and scope.",
      placeholder: "Default current day, station filter affects all panels"
    },
    {
      id: "access_expectations",
      label: "Access expectations",
      help: "Roles, sensitive fields, export permission, and row restrictions.",
      placeholder: "Ops viewers, managers can export, no row-level restriction"
    }
  ],
  "05-ai-review-validation": [
    {
      id: "review_scope",
      label: "Review scope",
      help: "What should be reviewed across requirement, SQL, UX, access, and governance?",
      placeholder: "Requirement coverage, SQL joins, filter UX, export behavior",
      required: true
    },
    {
      id: "review_evidence",
      label: "Review evidence",
      help: "Artifacts available for review.",
      placeholder: "Screenshots, SQL file, dashboard export, comparison report"
    },
    {
      id: "known_findings",
      label: "Known findings",
      help: "Known issues, severity, owner, and blocking status.",
      placeholder: "High: missing station filter owner Rahul, blocking"
    }
  ],
  "06-testing-verification": [
    {
      id: "test_scope",
      label: "Test scope",
      help: "Acceptance, data, UI/report, access, and performance tests to run.",
      placeholder: "KPI reconciliation, filter tests, export test, role test",
      required: true
    },
    {
      id: "expected_results",
      label: "Expected results",
      help: "Trusted source, sample, previous report, or stakeholder values.",
      placeholder: "Current Excel totals, agreed sample date, source query output"
    },
    {
      id: "defects",
      label: "Defects and retest",
      help: "Defects, severity, owner, fix status, and retest status.",
      placeholder: "D-001 High filter mismatch fixed, retest pending"
    }
  ],
  "07-approval-delivery": [
    {
      id: "delivery_artifact",
      label: "Final artifact",
      help: "Final link, environment, version, and release package.",
      placeholder: "Grafana URL, production workspace, v1.0 release",
      required: true
    },
    {
      id: "signoff",
      label: "Sign-off",
      help: "Business and technical approval evidence.",
      placeholder: "Email from owner, UAT approval, release approval"
    },
    {
      id: "support_handoff",
      label: "Support handoff",
      help: "Support owner, escalation path, limitations, rollback, and monitoring.",
      placeholder: "Support team, rollback steps, known limitations, monitoring checks"
    }
  ]
};

const phaseGuidance: Record<string, { userAction: string; uploads: string; output: string; gateFocus: string }> = {
  "01-requirement-intake": {
    userAction: "Capture the business request, KPI expectations, audience, platform path, and acceptance criteria.",
    uploads: "Tickets, emails, screenshots, sample Excel files, current report exports, or meeting notes.",
    output: "Requirement brief, KPI catalog, assumptions, open questions, and Phase 2 handoff.",
    gateFocus: "Business objective, stakeholders, KPI definitions, scope, security, and testable acceptance criteria."
  },
  "02-ai-analysis-understanding": {
    userAction: "Map the approved requirement to data sources, tables, columns, grains, joins, and risks.",
    uploads: "Database schema, DDL, sample rows, data dictionary, existing SQL, current report logic, or owner notes.",
    output: "Source-to-report mapping, join model, data quality risks, and validation plan.",
    gateFocus: "Every KPI/filter/output field is mapped or explicitly questioned before SQL starts."
  },
  "03-sql-draft-logic-preparation": {
    userAction: "Draft PostgreSQL logic and validation queries from the approved mapping.",
    uploads: "Approved mapping, SQL snippets, schema updates, sample expected outputs, or reconciliation files.",
    output: "Main SQL draft, SQL logic notes, validation query set, assumptions, and review focus.",
    gateFocus: "Traceability, parameters, join safety, KPI correctness, validation queries, and performance notes."
  },
  "04-dashboard-report-development": {
    userAction: "Plan or document the dashboard/report build in Grafana, FlexReport, or Superset.",
    uploads: "SQL outputs, wireframes, screenshots, dashboard exports, branding rules, or platform notes.",
    output: "Page/section plan, visual inventory, dataset inventory, filter inventory, and build issues.",
    gateFocus: "Each required KPI/output has a component, dataset, filters, access expectations, and build evidence."
  },
  "05-ai-review-validation": {
    userAction: "Review the generated Excel finding files, quality checks, reconciliation evidence, and open issues.",
    uploads: "Generated review JSON, Markdown summaries, design matrix, data validation matrix, selected checklist, or Excel report.",
    output: "Review-file summary, quality-check matrix, severity-based findings, reconciliation evidence, and correction plan.",
    gateFocus: "High review findings must be fixed or formally accepted before testing."
  },
  "06-testing-verification": {
    userAction: "Execute test cases and record evidence against acceptance criteria.",
    uploads: "Query results, screenshots, exports, test evidence, expected values, or stakeholder samples.",
    output: "Test log, defect log, known limitations, retest status, and release recommendation.",
    gateFocus: "Every acceptance criterion has evidence, and critical/high defects are resolved or accepted."
  },
  "07-approval-delivery": {
    userAction: "Package final delivery, sign-off, deployment notes, rollback path, and support handoff.",
    uploads: "Final links, release notes, sign-off emails, deployment evidence, or support documents.",
    output: "Delivery summary, deployment record, sign-off record, support handoff, and post-delivery actions.",
    gateFocus: "No delivery closure without sign-off, ownership, known limitations, rollback notes, and monitoring."
  }
};

export default function App() {
  const [authenticated, setAuthenticated] = useState(() => sessionStorage.getItem(authKey) === "true");
  const [lastUsername, setLastUsername] = useState(
    () => sessionStorage.getItem(authUsernameKey) || localStorage.getItem(lastUsernameKey) || validLogin.username
  );
  const [currentUsername, setCurrentUsername] = useState(() => sessionStorage.getItem(authUsernameKey) || lastUsername);
  const [currentUserType, setCurrentUserType] = useState(
    () => sessionStorage.getItem(authUserTypeKey) || (currentUsername.toLowerCase() === validLogin.username.toLowerCase() ? "Admin" : "User")
  );
  const [loginError, setLoginError] = useState("");
  const [phaseDefs, setPhaseDefs] = useState<PhaseDefinition[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [activePhaseId, setActivePhaseId] = useState("");
  const [notes, setNotes] = useState("");
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [phaseRenameDrafts, setPhaseRenameDrafts] = useState<Record<string, string>>({});
  const [createForm, setCreateForm] = useState({
    projectName: "",
    projectId: "",
    owner: "",
    targetPlatform: ""
  });

  const activePhase = useMemo(
    () =>
      project?.phases.find((phase) => phase.id === activePhaseId) ||
      project?.phases.find((phase) => phase.id === defaultReviewPhaseId) ||
      project?.phases[0] ||
      null,
    [project, activePhaseId]
  );

  useEffect(() => {
    if (!authenticated) {
      setProjects([]);
      setSelectedProjectId("");
      setProject(null);
      return;
    }
    void bootstrap();
  }, [authenticated, currentUsername, currentUserType]);

  useEffect(() => {
    if (!selectedProjectId) return;
    void loadProject(selectedProjectId);
  }, [selectedProjectId]);

  useEffect(() => {
    if (selectedProjectId && projects.length > 0 && !projects.some((item) => item.projectId === selectedProjectId)) {
      setSelectedProjectId("");
      setProject(null);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    setQuestionAnswers(activePhase?.questionAnswers || {});
  }, [activePhase?.id, activePhase?.questionAnswers]);

  function scrollToSection(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openGateChecklist() {
    const gateDetails = document.getElementById("gate-details") as HTMLDetailsElement | null;
    if (gateDetails) gateDetails.open = true;
    scrollToSection("gate-checklist");
  }

  function actorQuery() {
    return `actorUserName=${encodeURIComponent(currentUsername)}&actorUserType=${encodeURIComponent(currentUserType)}`;
  }

  function withActorQuery(url: string) {
    return `${url}${url.includes("?") ? "&" : "?"}${actorQuery()}`;
  }

  function withActorBody<T extends Record<string, unknown>>(body: T): T & { actorUserName: string; actorUserType: string } {
    return {
      ...body,
      actorUserName: currentUsername,
      actorUserType: currentUserType
    };
  }

  function appendActorFields(formData: FormData) {
    formData.append("actorUserName", currentUsername);
    formData.append("actorUserType", currentUserType);
  }

  async function bootstrap() {
    try {
      const [{ phases }, { projects: loadedProjects }] = await Promise.all([
        apiGet<{ phases: PhaseDefinition[] }>("/api/phases"),
        apiGet<{ projects: ProjectSummary[] }>(withActorQuery("/api/projects"))
      ]);
      setPhaseDefs(phases);
      setProjects(loadedProjects);
    } catch (error) {
      showError(error);
    }
  }

  async function refreshProjects() {
    const { projects: loadedProjects } = await apiGet<{ projects: ProjectSummary[] }>(withActorQuery("/api/projects"));
    setProjects(loadedProjects);
  }

  async function loadProject(projectId: string) {
    try {
      const { project: loadedProject } = await apiGet<{ project: ProjectDetail }>(withActorQuery(`/api/projects/${projectId}`));
      setProject(loadedProject);
      setActivePhaseId(loadedProject.phases.find((phase) => phase.id === defaultReviewPhaseId)?.id || loadedProject.currentPhaseId || loadedProject.phases[0]?.id || "");
    } catch (error) {
      showError(error);
    }
  }

  async function createProject() {
    try {
      setBusy(true);
      const { project: created } = await apiPost<{ project: ProjectDetail }>("/api/projects", withActorBody(createForm));
      setCreateForm({ projectName: "", projectId: "", owner: "", targetPlatform: "" });
      await refreshProjects();
      setProject(created);
      setSelectedProjectId(created.projectId);
      setActivePhaseId(created.phases.find((phase) => phase.id === defaultReviewPhaseId)?.id || created.currentPhaseId);
      setToast({ type: "success", message: `Created ${created.projectId}` });
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function runAgent() {
    if (!project || !activePhase) return;
    try {
      setBusy(true);
      const result = await apiPost<{ output: string }>(
        `/api/projects/${project.projectId}/phases/${activePhase.id}/run`,
        withActorBody({ notes, questionAnswers })
      );
      setToast({ type: "success", message: "Agent output generated" });
      setNotes("");
      await loadProject(project.projectId);
      window.requestAnimationFrame(() => {
        document.getElementById("agent-output")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      if (!result.output) setToast({ type: "info", message: "Agent run completed" });
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function saveGate(gate: GateState) {
    if (!project || !activePhase) return;
    try {
      setBusy(true);
      await apiPut(`/api/projects/${project.projectId}/phases/${activePhase.id}/gate`, withActorBody({ gate }));
      setToast({ type: "success", message: "Gate saved" });
      await loadProject(project.projectId);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function saveQuestionAnswers() {
    if (!project || !activePhase) return;
    try {
      setBusy(true);
      await apiPut(`/api/projects/${project.projectId}/phases/${activePhase.id}/questions`, withActorBody({ questionAnswers }));
      setToast({ type: "success", message: "Guided answers saved" });
      await loadProject(project.projectId);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function generateArtifactFromQuestions() {
    if (!project || !activePhase) return;
    try {
      setBusy(true);
      await apiPut(`/api/projects/${project.projectId}/phases/${activePhase.id}/questions`, withActorBody({ questionAnswers }));
      await apiPost(`/api/projects/${project.projectId}/phases/${activePhase.id}/run`, {
        notes,
        questionAnswers,
        actorUserName: currentUsername,
        actorUserType: currentUserType
      });
      setToast({ type: "success", message: "Artifact generated from guided answers" });
      setNotes("");
      await loadProject(project.projectId);
      window.requestAnimationFrame(() => {
        document.getElementById("agent-output")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function completePhase() {
    if (!project || !activePhase) return;
    try {
      setBusy(true);
      const { project: updated, nextPhaseId } = await apiPost<{ project: ProjectDetail; nextPhaseId: string | null }>(
        `/api/projects/${project.projectId}/phases/${activePhase.id}/complete`,
        withActorBody({})
      );
      setProject(updated);
      setActivePhaseId(nextPhaseId || activePhase.id);
      await refreshProjects();
      setToast({ type: "success", message: `${activePhase.title} completed` });
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function savePhaseRename(phase: Phase) {
    if (!project) return;
    const title = (phaseRenameDrafts[phase.id] ?? phase.title).trim();
    if (!title || title === phase.title) return;
    try {
      setBusy(true);
      const { project: updated } = await apiPut<{ project: ProjectDetail }>(
        `/api/projects/${project.projectId}/phases/${phase.id}`,
        withActorBody({ title })
      );
      setProject(updated);
      setPhaseRenameDrafts((current) => ({ ...current, [phase.id]: title }));
      await refreshProjects();
      setToast({ type: "success", message: `Phase renamed to ${title}` });
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function uploadFiles(files: FileList | null) {
    if (!project || !activePhase || !files?.length) return;
    const formData = new FormData();
    appendActorFields(formData);
    Array.from(files).forEach((file) => formData.append("files", file));
    try {
      setBusy(true);
      await apiPost(withActorQuery(`/api/projects/${project.projectId}/phases/${activePhase.id}/uploads`), formData);
      setToast({ type: "info", message: `${files.length} artifact(s) uploaded. Running agent...` });
      await apiPost(`/api/projects/${project.projectId}/phases/${activePhase.id}/run`, {
        notes: notes || "Analyze newly uploaded artifact(s).",
        questionAnswers,
        actorUserName: currentUsername,
        actorUserType: currentUserType
      });
      setToast({ type: "success", message: `${files.length} artifact(s) uploaded and analyzed` });
      await loadProject(project.projectId);
      window.requestAnimationFrame(() => {
        document.getElementById("agent-output")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  function showError(error: unknown) {
    setToast({ type: "error", message: error instanceof Error ? error.message : "Unexpected error" });
  }

  async function handleLogin(username: string, password: string) {
    try {
      const result = await apiPost<LoginResult>("/api/auth/login", { username, password });
      const signedInUsername = result.username || username;
      const signedInUserType = result.userType || (signedInUsername.toLowerCase() === validLogin.username.toLowerCase() ? "Admin" : "User");
      sessionStorage.setItem(authKey, "true");
      sessionStorage.setItem(authUsernameKey, signedInUsername);
      sessionStorage.setItem(authUserTypeKey, signedInUserType);
      localStorage.setItem(lastUsernameKey, signedInUsername);
      setLastUsername(signedInUsername);
      setCurrentUsername(signedInUsername);
      setCurrentUserType(signedInUserType);
      setAuthenticated(true);
      setLoginError("");
      return;
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Invalid username or password.");
    }
  }

  async function handleCreateUser(input: CreateUserInput): Promise<CreateUserResult> {
    try {
      const result = await apiPost<CreateUserResult>("/api/auth/users", input);
      if (result.username) {
        localStorage.setItem(lastUsernameKey, result.username);
        setLastUsername(result.username);
      }
      return {
        ok: true,
        message: result.message || `User ${result.username || input.username.trim()} created successfully.`,
        username: result.username || input.username.trim()
      };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Could not create user." };
    }
  }

  function logout() {
    sessionStorage.removeItem(authKey);
    sessionStorage.removeItem(authUsernameKey);
    sessionStorage.removeItem(authUserTypeKey);
    setAuthenticated(false);
    setCurrentUsername(lastUsername);
    setCurrentUserType(lastUsername.toLowerCase() === validLogin.username.toLowerCase() ? "Admin" : "User");
    setLoginError("");
  }

  if (!authenticated) {
    return <LoginScreen error={loginError} initialUsername={lastUsername} onCreateUser={handleCreateUser} onLogin={handleLogin} />;
  }

  return (
    <div className="app-shell">
      <aside className="project-sidebar">
        <div className="brand-block">
          <FileText size={22} />
          <div>
            <h1>DA Workflow</h1>
            <span>Reporting factory</span>
          </div>
        </div>

        <div className="create-panel">
          <div className="section-title">
            <FolderPlus size={16} />
            <span>New Project</span>
          </div>
          <input
            aria-label="Project name"
            value={createForm.projectName}
            onChange={(event) =>
              setCreateForm((current) => ({
                ...current,
                projectName: event.target.value,
                projectId: current.projectId || slugify(event.target.value)
              }))
            }
            placeholder="Project name"
          />
          <input
            aria-label="Project ID"
            value={createForm.projectId}
            onChange={(event) => setCreateForm((current) => ({ ...current, projectId: slugify(event.target.value) }))}
            placeholder="project-id or project_id"
          />
          <input
            aria-label="Owner"
            value={createForm.owner}
            onChange={(event) => setCreateForm((current) => ({ ...current, owner: event.target.value }))}
            placeholder="Owner"
          />
          <select
            aria-label="Target platform"
            value={createForm.targetPlatform}
            onChange={(event) => setCreateForm((current) => ({ ...current, targetPlatform: event.target.value }))}
          >
            <option value="">Platform</option>
            <option value="Grafana">Grafana</option>
            <option value="FlexReport">FlexReport</option>
            <option value="Apache Superset">Apache Superset</option>
            <option value="Undecided">Undecided</option>
          </select>
          <button className="primary-btn" onClick={createProject} disabled={busy || !createForm.projectName}>
            <FolderPlus size={16} />
            Create
          </button>
        </div>

        <div className="sidebar-heading">
          <span>Projects</span>
          <button className="icon-btn" onClick={() => void refreshProjects()} title="Refresh projects">
            <RefreshCw size={15} />
          </button>
        </div>
        <div className="project-picker-panel">
          <select
            aria-label="Select project"
            value={selectedProjectId}
            onChange={(event) => {
              const nextProjectId = event.target.value;
              setSelectedProjectId(nextProjectId);
              setActivePhaseId("");
              if (!nextProjectId) setProject(null);
            }}
            disabled={busy || projects.length === 0}
          >
            <option value="">{projects.length ? "Select project" : "No projects created"}</option>
            {projects.map((item) => (
              <option key={item.projectId} value={item.projectId}>
                {item.projectName} ({item.projectId})
              </option>
            ))}
          </select>
          {projects.length === 0 && <div className="empty-note">No projects yet</div>}
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">{project?.projectId || "No project selected"}</span>
            <h2>{project?.projectName || "Create a project to start"}</h2>
          </div>
          <div className="topbar-meta">
            <StatusPill status={project?.status || "idle"} />
            <span>{project?.targetPlatform || "Platform TBD"}</span>
            <UserMenu username={currentUsername} onLogout={logout} />
          </div>
        </header>

        {toast && (
          <div className={`toast ${toast.type}`}>
            {toast.type === "error" ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} title="Dismiss">
              <XCircle size={15} />
            </button>
          </div>
        )}

        {project && activePhase ? (
          <div className="workflow-grid">
            <section className="phase-workbench">
              <PhaseHeader phase={activePhase} project={project} />
              {activePhase.id === defaultReviewPhaseId ? (
                isGrafanaPlatform(project.targetPlatform) ? (
                  <DashboardReviewPlaceholder project={project} username={currentUsername} />
                ) : (
                  <ExcelPdfReviewApp
                    embedded
                    defaultProjectName={project.projectName || project.projectId}
                    phaseGuide={<PhaseGuide phase={activePhase} />}
                    username={currentUsername}
                    userType={currentUserType}
                  />
                )
              ) : (
                <>
                  <NextStepPanel
                    phase={activePhase}
                    notes={notes}
                    answeredQuestions={countAnsweredQuestions(activePhase.id, questionAnswers)}
                    busy={busy}
                    onGoToInputs={() => scrollToSection("phase-inputs")}
                    onRun={runAgent}
                    onReviewGates={openGateChecklist}
                    onComplete={completePhase}
                  />
                  <PhaseGuide phase={activePhase} />
                  <GateSummary phase={activePhase} />

                  <section className="input-panel" id="phase-inputs">
                    <div className="input-panel-header">
                      <div>
                        <div className="section-title">
                          <Upload size={16} />
                          <span>Phase Input</span>
                        </div>
                        <p>Add the artifact or short instruction the agent should use for this phase.</p>
                      </div>
                      <div className="workbench-actions">
                        <UploadButton onUpload={uploadFiles} disabled={busy} />
                        <button className="secondary-btn" onClick={runAgent} disabled={busy}>
                          {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
                          Run Agent
                        </button>
                        <button
                          className="primary-btn"
                          onClick={completePhase}
                          disabled={busy || countGateBlockers(activePhase) > 0}
                          title={
                            countGateBlockers(activePhase) > 0
                              ? "Resolve all incomplete or blocked gate items first"
                              : "Complete this phase"
                          }
                        >
                          <CheckCircle2 size={16} />
                          Complete Phase
                        </button>
                      </div>
                    </div>

                    <textarea
                      className="notes-input"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Add notes, SQL comments, stakeholder input, or instructions for this run"
                    />
                  </section>

                  <ArtifactStrip phase={activePhase} />

                  <section className="output-panel" id="agent-output">
                    <div className="section-title">
                      <FileText size={16} />
                      <span>Agent Output</span>
                    </div>
                    <pre>{visibleAgentOutput(activePhase.outputText)}</pre>
                  </section>

                  <GateEditor phase={activePhase} onSave={saveGate} disabled={busy} />
                </>
              )}
            </section>
          </div>
        ) : (
          <div className="empty-state">
            <FileText size={34} />
            <h3>No active project</h3>
            <p>Create a project from the sidebar.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function LoginScreen({
  error,
  initialUsername,
  onCreateUser,
  onLogin
}: {
  error: string;
  initialUsername: string;
  onCreateUser: (input: CreateUserInput) => Promise<CreateUserResult>;
  onLogin: (username: string, password: string) => Promise<void>;
}) {
  const usernameRef = useRef<HTMLInputElement | null>(null);
  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState("");
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({
    adminUsername: validLogin.username,
    adminPassword: "",
    username: "",
    password: ""
  });
  const [createUserStatus, setCreateUserStatus] = useState<CreateUserResult | null>(null);

  useEffect(() => {
    usernameRef.current?.focus();
    usernameRef.current?.select();
  }, []);

  async function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSigningIn(true);
    try {
      await onLogin(username.trim(), password);
    } finally {
      setSigningIn(false);
    }
  }

  async function submitCreateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingUser(true);
    try {
      const result = await onCreateUser(createUserForm);
      setCreateUserStatus(result);
      if (!result.ok) return;
      setUsername(result.username || createUserForm.username.trim());
      setPassword("");
      setCreateUserForm({
        adminUsername: validLogin.username,
        adminPassword: "",
        username: "",
        password: ""
      });
    } finally {
      setCreatingUser(false);
    }
  }

  return (
    <main className="login-screen">
      <div className="login-card">
        <form autoComplete="off" className="login-form" onSubmit={submitLogin}>
          <span className="login-kicker">REPORT & DASHBOARD REVIEW</span>
          <h1>Sign In</h1>
          <p>Use your dashboard username and password.</p>
          <label className="login-field">
            <span>Username</span>
            <input
              autoComplete="off"
              onChange={(event) => setUsername(event.target.value)}
              placeholder={initialUsername || "Username"}
              ref={usernameRef}
              value={username}
            />
          </label>
          <label className="login-field">
            <span>Password</span>
            <input autoComplete="new-password" onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
          </label>
          {error && <div className="login-error">{error}</div>}
          <button className="login-submit" disabled={signingIn} type="submit">
            {signingIn ? "Signing In" : "Sign In"}
          </button>
        </form>

        <button
          className="login-create-toggle"
          onClick={() => {
            setShowCreateUser((current) => !current);
            setCreateUserStatus(null);
          }}
          type="button"
        >
          <UserPlus size={16} />
          Create User
        </button>

        {showCreateUser && (
          <form autoComplete="off" className="create-user-form" onSubmit={submitCreateUser}>
            <div className="create-user-heading">
              <strong>Create User</strong>
              <small>Only Rahul_Raj can create users. Created users cannot create other users.</small>
            </div>
            <label className="login-field">
              <span>Admin Username</span>
              <input
                autoComplete="off"
                onChange={(event) => setCreateUserForm((current) => ({ ...current, adminUsername: event.target.value }))}
                value={createUserForm.adminUsername}
              />
            </label>
            <label className="login-field">
              <span>Admin Password</span>
              <input
                autoComplete="new-password"
                onChange={(event) => setCreateUserForm((current) => ({ ...current, adminPassword: event.target.value }))}
                type="password"
                value={createUserForm.adminPassword}
              />
            </label>
            <label className="login-field">
              <span>New Username</span>
              <input
                autoComplete="off"
                onChange={(event) => setCreateUserForm((current) => ({ ...current, username: event.target.value }))}
                value={createUserForm.username}
              />
            </label>
            <label className="login-field">
              <span>New Password</span>
              <input
                autoComplete="new-password"
                onChange={(event) => setCreateUserForm((current) => ({ ...current, password: event.target.value }))}
                type="password"
                value={createUserForm.password}
              />
            </label>
            {createUserStatus && <div className={`login-message ${createUserStatus.ok ? "success" : "error"}`}>{createUserStatus.message}</div>}
            <button className="login-submit" disabled={creatingUser} type="submit">
              {creatingUser ? "Creating User" : "Create User"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

function UserMenu({ username, onLogout }: { username: string; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function closeWhenOutside(event: MouseEvent | TouchEvent) {
      if (menuRef.current && event.target instanceof Node && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", closeWhenOutside);
    document.addEventListener("touchstart", closeWhenOutside);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeWhenOutside);
      document.removeEventListener("touchstart", closeWhenOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="user-menu" ref={menuRef}>
      <button className="signed-in-user" onClick={() => setOpen((current) => !current)} type="button">
        <UserRound size={15} />
        <span>{username}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="user-menu-panel">
          <button onClick={onLogout} type="button">
            <LogOut size={15} />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

function NextStepPanel({
  phase,
  notes,
  answeredQuestions,
  busy,
  onGoToInputs,
  onRun,
  onReviewGates,
  onComplete
}: {
  phase: Phase;
  notes: string;
  answeredQuestions: number;
  busy: boolean;
  onGoToInputs: () => void;
  onRun: () => void;
  onReviewGates: () => void;
  onComplete: () => void;
}) {
  const hasAgentOutput = phase.outputs.length > 0;
  const hasInput = notes.trim().length > 0 || phase.uploads.length > 0 || answeredQuestions > 0 || hasAgentOutput;
  const blockers = countGateBlockers(phase);
  const isCompleted = phase.state.status === "completed";

  const nextStep = getNextStep({ hasInput, hasAgentOutput, blockers, isCompleted });
  const steps = [
    { key: "input", label: "Add input", done: hasInput, active: nextStep.key === "input" },
    { key: "agent", label: "Run agent", done: hasAgentOutput, active: nextStep.key === "agent" },
    { key: "review", label: "Review", done: hasAgentOutput && blockers === 0, active: nextStep.key === "review" },
    { key: "complete", label: "Complete", done: blockers === 0 || isCompleted, active: nextStep.key === "complete" }
  ];

  const actions = {
    input: onGoToInputs,
    agent: onRun,
    review: onReviewGates,
    complete: onComplete,
    done: () => document.getElementById("agent-output")?.scrollIntoView({ behavior: "smooth", block: "start" })
  };

  return (
    <section className="next-step-panel" aria-label="What to do next">
      <div className="next-step-copy">
        <span className="eyebrow">What to do next</span>
        <h4>{nextStep.title}</h4>
        <p>{nextStep.detail}</p>
      </div>
      <div className="next-step-side">
        <div className="step-path" aria-label="Phase progress">
          {steps.map((step) => (
            <span className={`step-chip ${step.done ? "done" : ""} ${step.active ? "active" : ""}`} key={step.key}>
              {step.done ? <CheckCircle2 size={14} /> : <Circle size={14} />}
              {step.label}
            </span>
          ))}
        </div>
        <button
          className={nextStep.key === "complete" ? "primary-btn" : "secondary-btn"}
          onClick={actions[nextStep.key]}
          disabled={busy || (nextStep.key === "complete" && blockers > 0)}
        >
          {busy ? <Loader2 className="spin" size={16} /> : nextStep.icon}
          {nextStep.action}
        </button>
      </div>
    </section>
  );
}

function getNextStep({
  hasInput,
  hasAgentOutput,
  blockers,
  isCompleted
}: {
  hasInput: boolean;
  hasAgentOutput: boolean;
  blockers: number;
  isCompleted: boolean;
}) {
  if (isCompleted) {
    return {
      key: "done" as const,
      title: "This phase is complete.",
      detail: "Use the phase list to continue with the next open phase or review the saved output.",
      action: "View output",
      icon: <FileText size={16} />
    };
  }
  if (!hasInput) {
    return {
      key: "input" as const,
      title: "Start by adding phase input.",
      detail: "Upload an artifact or add short notes for the agent.",
      action: "Add input",
      icon: <Upload size={16} />
    };
  }
  if (!hasAgentOutput) {
    return {
      key: "agent" as const,
      title: "Run the phase agent.",
      detail: "The agent will read the notes and uploads, then create the phase output below.",
      action: "Run agent",
      icon: <Play size={16} />
    };
  }
  if (blockers > 0) {
    return {
      key: "review" as const,
      title: "Review the gate checklist.",
      detail: `${blockers} gate item(s) still need evidence, owner updates, or resolution before this phase can close.`,
      action: "Open gates",
      icon: <ShieldCheck size={16} />
    };
  }
  return {
    key: "complete" as const,
    title: "Complete this phase.",
    detail: "All gate items are clear. Mark the phase complete to move to the next phase.",
    action: "Complete phase",
    icon: <CheckCircle2 size={16} />
  };
}

function QuestionnairePanel({
  phase,
  answers,
  onChange,
  onSave,
  onGenerate,
  disabled
}: {
  phase: Phase;
  answers: Record<string, string>;
  onChange: (answers: Record<string, string>) => void;
  onSave: () => void;
  onGenerate: () => void;
  disabled: boolean;
}) {
  const questions = phaseQuestions[phase.id] || [];
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const answered = countAnsweredQuestions(phase.id, answers);
  const requiredQuestions = questions.filter((question) => question.required);
  const requiredAnswered = requiredQuestions.filter((question) => answers[question.id]?.trim()).length;
  const missingRequired = requiredQuestions.filter((question) => !answers[question.id]?.trim());
  const completionPercent = questions.length === 0 ? 100 : Math.round((answered / questions.length) * 100);
  const isReviewStep = activeQuestionIndex >= questions.length;
  const activeQuestion = questions[Math.min(activeQuestionIndex, Math.max(questions.length - 1, 0))];
  const activeAnswer = activeQuestion ? answers[activeQuestion.id] || "" : "";
  const currentQuestionComplete = !activeQuestion?.required || activeAnswer.trim().length > 0;
  const canGenerate = phase.uploads.length > 0 || missingRequired.length === 0;

  useEffect(() => {
    setActiveQuestionIndex(0);
  }, [phase.id]);

  function updateAnswer(questionId: string, value: string) {
    onChange({ ...answers, [questionId]: value });
  }

  function goNext() {
    if (!currentQuestionComplete) return;
    setActiveQuestionIndex((current) => Math.min(current + 1, questions.length));
  }

  function goBack() {
    setActiveQuestionIndex((current) => Math.max(current - 1, 0));
  }

  if (!activeQuestion) {
    return (
      <section className="question-panel" id="phase-questions">
        <div className="section-title">
          <FileText size={16} />
          <span>Step-by-step Questions</span>
        </div>
        <p className="empty-note">No guided questions configured for this phase.</p>
      </section>
    );
  }

  return (
    <section className="question-panel" id="phase-questions">
      <div className="question-header">
        <div>
          <div className="section-title">
            <FileText size={16} />
            <span>Step-by-step Questions</span>
          </div>
          <p>
            {completionPercent}% complete, {answered} of {questions.length} answered
            {requiredQuestions.length > 0 ? `, ${requiredAnswered} of ${requiredQuestions.length} required` : ""}
          </p>
        </div>
        <div className="workbench-actions">
          <button className="secondary-btn" onClick={onSave} disabled={disabled}>
            <Save size={16} />
            Save Progress
          </button>
        </div>
      </div>

      <div className="question-progress-row">
        <div className="progress-track" aria-label="Question completion progress">
          <span className="progress-fill" style={{ width: `${completionPercent}%` }} />
        </div>
        <strong>{completionPercent}%</strong>
      </div>

      <div className="question-wizard">
        <div className="question-step-list" aria-label="Question steps">
          {questions.map((question, index) => {
            const isAnswered = Boolean(answers[question.id]?.trim());
            const isActive = !isReviewStep && index === activeQuestionIndex;
            return (
              <button
                className={`question-step-button ${isActive ? "active" : ""} ${isAnswered ? "done" : ""}`}
                key={question.id}
                onClick={() => setActiveQuestionIndex(index)}
                type="button"
              >
                {isAnswered ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                <span>{index + 1}</span>
                <small>{question.label}</small>
              </button>
            );
          })}
          <button
            className={`question-step-button review ${isReviewStep ? "active" : ""}`}
            onClick={() => setActiveQuestionIndex(questions.length)}
            type="button"
          >
            <FileText size={15} />
            <span>{questions.length + 1}</span>
            <small>Review & generate</small>
          </button>
        </div>

        {isReviewStep ? (
          <div className="question-review">
            <span className="eyebrow">Final Step</span>
            <h4>Review answers and generate the phase artifact</h4>
            <p>
              The artifact will be generated from your saved answers, uploaded files, and optional notes. Missing optional answers will stay open;
              missing required answers are shown below.
            </p>
            <div className="review-metrics">
              <Metric label="Answered" value={answered} tone="good" />
              <Metric label="Required" value={requiredAnswered} tone={missingRequired.length === 0 ? "good" : "warn"} />
              <Metric label="Uploads" value={phase.uploads.length} tone="neutral" />
            </div>
            {missingRequired.length > 0 ? (
              <div className="missing-list">
                <strong>Required answers still missing</strong>
                {missingRequired.map((question) => (
                  <button key={question.id} onClick={() => setActiveQuestionIndex(questions.indexOf(question))} type="button">
                    {question.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="ready-note">
                <CheckCircle2 size={17} />
                Required questions are complete.
              </div>
            )}
            <div className="question-footer">
              <button className="secondary-btn" onClick={goBack} disabled={disabled || questions.length === 0}>
                <ArrowLeft size={16} />
                Back
              </button>
              <button className="primary-btn" onClick={onGenerate} disabled={disabled || !canGenerate}>
                {disabled ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
                Generate Artifact
              </button>
            </div>
          </div>
        ) : (
          <label className="question-card">
            <span className="eyebrow">
              Question {activeQuestionIndex + 1} of {questions.length}
            </span>
            <div className="question-card-title">
              <h4>{activeQuestion.label}</h4>
              <strong>{activeQuestion.required ? "Required" : "Optional"}</strong>
            </div>
            <p>{activeQuestion.help}</p>
            <textarea
              aria-label={activeQuestion.label}
              value={activeAnswer}
              onChange={(event) => updateAnswer(activeQuestion.id, event.target.value)}
              placeholder={activeQuestion.placeholder}
            />
            {!currentQuestionComplete && <small className="question-warning">Answer this required question before continuing.</small>}
            <div className="question-footer">
              <button className="secondary-btn" onClick={goBack} disabled={disabled || activeQuestionIndex === 0}>
                <ArrowLeft size={16} />
                Back
              </button>
              <button className="secondary-btn" onClick={onSave} disabled={disabled}>
                <Save size={16} />
                Save Answer
              </button>
              <button className="primary-btn" onClick={goNext} disabled={disabled || !currentQuestionComplete}>
                {activeQuestionIndex === questions.length - 1 ? "Review Answers" : "Next Question"}
                <ArrowRight size={16} />
              </button>
            </div>
          </label>
        )}
      </div>
    </section>
  );
}

function PhaseHeader({ phase, project }: { phase: Phase; project: ProjectDetail }) {
  const title = reviewPhaseTitle(phase, project.targetPlatform);
  return (
    <>
      <section className="phase-header">
        <div>
          <span className="eyebrow">Phase {phase.number}</span>
          <h3>{title}</h3>
          <p>{phase.artifactPath}</p>
        </div>
        <div className="phase-status-stack">
          <StatusPill status={phase.state.status} />
          <span>{phase.state.gateRecommendation || "Gate TBD"}</span>
          <small>{project.owner || "Owner TBD"}</small>
        </div>
      </section>
      {phase.id === defaultReviewPhaseId && !isGrafanaPlatform(project.targetPlatform) && <ReviewAgentInfo project={project} />}
    </>
  );
}

function ReviewAgentInfo({ project }: { project: ProjectDetail }) {
  const features = [
    "Checklist-driven Excel design review",
    "Selected Excel report data validation",
    "Cross-Excel date range and value comparison",
    "Data Critical, Design Medium, and Design Low prioritization",
    "Generated review file repository with view and download"
  ];

  return (
    <section className="review-agent-info">
      <div className="review-agent-info-main">
        <span className="eyebrow">Agent Name</span>
        <strong>{isFlexReportPlatform(project.targetPlatform) ? "AI Report Review and Validation" : "Excel Data and Design Review Agent"}</strong>
      </div>
      <div className="review-agent-feature-list">
        {features.map((feature) => (
          <span key={feature}>{feature}</span>
        ))}
      </div>
    </section>
  );
}

function DashboardReviewPlaceholder({ project, username }: { project: ProjectDetail; username: string }) {
  const [runMode, setRunMode] = useState<DashboardRunMode>("linked");
  const [form, setForm] = useState(() => ({
    projectName: project.projectName || project.projectId || "",
    baseUrl: "https://msedclgrafana.amnex.co.in:3000",
    mainUrl:
      "https://msedclgrafana.amnex.co.in:3000/d/ad7931a0-0649-456f-9601-b5f7a14491b8/substation-health-monitor?orgId=1&refresh=5m",
    validationUrl: "",
    navigationUrl: "",
    grafanaAuthMode: "anonymous" as DashboardAuthMode,
    grafanaToken: "",
    grafanaUsername: "",
    grafanaPassword: "",
    checklistPath: defaultDashboardChecklistPath,
    timeFrom: "now-1h",
    timeTo: "now",
    reviewTimestamp: formatDateTime(new Date())
  }));
  const [autoTimestamp, setAutoTimestamp] = useState(true);
  const [runStatus, setRunStatus] = useState("Sample loaded for flow preview. Run a live review to query Grafana and create fresh saved artifacts.");
  const [dashboardArtifacts, setDashboardArtifacts] = useState<DashboardArtifact[]>([]);
  const [artifactFolder, setArtifactFolder] = useState("");
  const [artifactStatus, setArtifactStatus] = useState("Run a live review to generate dashboard review PDF files.");
  const [artifactLoading, setArtifactLoading] = useState(false);
  const [checklistOptions, setChecklistOptions] = useState<DashboardChecklistOption[]>(fallbackDashboardChecklistOptions);
  const [checklistStatus, setChecklistStatus] = useState("Using the shared dashboard checklist by default.");
  const [checklistUploading, setChecklistUploading] = useState(false);
  const [autoSelectLatestChecklist, setAutoSelectLatestChecklist] = useState(() => localStorage.getItem(dashboardLatestChecklistPreferenceKey) === "true");
  const [checklistSheets, setChecklistSheets] = useState<DashboardChecklistSheetInfo[]>([]);
  const [selectedChecklistSheet, setSelectedChecklistSheet] = useState("");
  const [checklistGrid, setChecklistGrid] = useState<DashboardChecklistGridResponse | null>(null);
  const [loadingChecklistGrid, setLoadingChecklistGrid] = useState(false);
  const [savingChecklistRevision, setSavingChecklistRevision] = useState(false);
  const [checklistRevisionStatus, setChecklistRevisionStatus] = useState("Select a checklist sheet to edit it here.");
  const [running, setRunning] = useState(false);
  const checklistFileInputRef = useRef<HTMLInputElement | null>(null);
  const checklistSheetsRequestRef = useRef(0);
  const checklistGridRequestRef = useRef(0);

  const reviewApiBase = useMemo(() => `${window.location.protocol}//${window.location.hostname}:${dashboardReviewApiPort}`, []);
  const parsedMain = useMemo(() => parseDashboardSetupUrl(form.mainUrl, form.baseUrl), [form.mainUrl, form.baseUrl]);
  const effectiveBaseUrl = chooseEffectiveDashboardBase(form.baseUrl, parsedMain?.baseUrl || "");
  const readyMessage = dashboardRunReadiness(runMode, form, effectiveBaseUrl);
  const selectedChecklistOption = checklistOptions.find((option) => sameDashboardChecklistPath(option.path, form.checklistPath));
  const checklistGridColumns = checklistGrid?.columns?.length ? checklistGrid.columns : ["S.No", "Check Point"];
  const checklistGridRows = checklistGrid?.rows || [];
  const checklistSerialColumnIndex =
    typeof checklistGrid?.serialColumn === "number" && checklistGrid.serialColumn > 0 ? checklistGrid.serialColumn - 1 : -1;
  const checklistGridTemplate = {
    "--editor-columns": `54px repeat(${checklistGridColumns.length}, minmax(150px, 1fr)) 38px`
  } as CSSProperties;

  useEffect(() => {
    if (!autoTimestamp || running) return;
    const syncTimestamp = () => updateForm("reviewTimestamp", formatDateTime(new Date()));
    syncTimestamp();
    const timer = window.setInterval(syncTimestamp, 1000);
    return () => window.clearInterval(timer);
  }, [autoTimestamp, running]);

  useEffect(() => {
    void loadDashboardChecklists();
    void loadDashboardArtifacts("");
  }, []);

  useEffect(() => {
    updateForm("projectName", project.projectName || project.projectId || "");
  }, [project.projectId, project.projectName]);

  useEffect(() => {
    if (!autoSelectLatestChecklist || !checklistOptions.length || !form.checklistPath) return;
    const latestChecklist = latestDashboardChecklistForSelection(checklistOptions, form.checklistPath);
    if (!latestChecklist || sameDashboardChecklistPath(latestChecklist.path, form.checklistPath)) return;
    updateForm("checklistPath", latestChecklist.path);
    setChecklistStatus(`Latest checklist revision selected: ${latestChecklist.label}.`);
  }, [autoSelectLatestChecklist, checklistOptions, form.checklistPath]);

  useEffect(() => {
    const requestId = ++checklistSheetsRequestRef.current;
    checklistGridRequestRef.current += 1;
    setChecklistSheets([]);
    setSelectedChecklistSheet("");
    setChecklistGrid(null);
    setLoadingChecklistGrid(false);
    if (!form.checklistPath) {
      setChecklistRevisionStatus("Embedded fallback is available for review runs, but checklist editing needs a selected .xlsx file.");
      return;
    }
    void loadDashboardChecklistSheets(form.checklistPath, requestId);
  }, [form.checklistPath]);

  useEffect(() => {
    const requestId = ++checklistGridRequestRef.current;
    if (!form.checklistPath || !selectedChecklistSheet) {
      setChecklistGrid(null);
      setLoadingChecklistGrid(false);
      return;
    }
    setChecklistGrid(null);
    void loadDashboardChecklistSheetGrid(form.checklistPath, selectedChecklistSheet, requestId);
  }, [form.checklistPath, selectedChecklistSheet]);

  function updateForm(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function analyzeDashboardSetup() {
    const latestTimestamp = formatDateTime(new Date());
    setAutoTimestamp(true);
    updateForm("reviewTimestamp", latestTimestamp);
    setRunStatus(readyMessage);
  }

  async function loadDashboardChecklists() {
    try {
      const endpoint = new URL(`${reviewApiBase}/api/dashboard-checklists`);
      endpoint.searchParams.set("selected", form.checklistPath);
      const response = await fetch(endpoint.toString());
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok || !Array.isArray(payload.checklists)) {
        throw new Error(payload.error || `Checklist refresh failed with HTTP ${response.status}.`);
      }
      const options = payload.checklists as DashboardChecklistOption[];
      setChecklistOptions(options);
      const activeOption = options.find((option) => sameDashboardChecklistPath(option.path, form.checklistPath));
      const defaultOption = options.find((option) => option.isDefault && option.exists !== false);
      if (!activeOption && defaultOption) {
        updateForm("checklistPath", defaultOption.path);
      }
      const selected = activeOption || defaultOption || options[0];
      setChecklistStatus(
        selected
          ? `Checklist selected: ${selected.label}${selected.exists === false ? " (file not found, fallback will be used)" : ""}.`
          : "Embedded dashboard checklist fallback will be used."
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setChecklistOptions(fallbackDashboardChecklistOptions);
      setChecklistStatus(`Checklist selector fallback loaded: ${message}`);
    }
  }

  async function uploadDashboardChecklist(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setChecklistStatus("Please select an .xlsx checklist file.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setChecklistUploading(true);
    setChecklistStatus(`Uploading ${file.name}.`);
    try {
      const response = await fetch(`${reviewApiBase}/api/dashboard-checklists/upload`, {
        method: "POST",
        body: formData
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok || !payload.checklist?.path) {
        throw new Error(payload.error || `Checklist upload failed with HTTP ${response.status}.`);
      }
      const options = Array.isArray(payload.checklists) ? (payload.checklists as DashboardChecklistOption[]) : [payload.checklist];
      setChecklistOptions(options);
      updateForm("checklistPath", payload.checklist.path);
      setChecklistStatus(`Checklist uploaded and selected: ${payload.checklist.label}${payload.pointCount ? ` (${payload.pointCount} points)` : ""}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setChecklistStatus(`Checklist upload failed: ${message}`);
    } finally {
      setChecklistUploading(false);
    }
  }

  function selectDashboardChecklist(selectedPath: string) {
    const selected = checklistOptions.find((option) => sameDashboardChecklistPath(option.path, selectedPath));
    updateForm("checklistPath", selectedPath);
    setChecklistStatus(
      selected
        ? `Checklist selected: ${selected.label}${selected.exists === false ? " (file not found, fallback will be used)" : ""}.`
        : "Embedded dashboard checklist fallback will be used."
    );
  }

  function toggleAutoSelectLatestDashboardChecklist(checked: boolean) {
    setAutoSelectLatestChecklist(checked);
    localStorage.setItem(dashboardLatestChecklistPreferenceKey, checked ? "true" : "false");
    if (!checked || !form.checklistPath) return;
    const latestChecklist = latestDashboardChecklistForSelection(checklistOptions, form.checklistPath);
    if (latestChecklist) {
      updateForm("checklistPath", latestChecklist.path);
      setChecklistStatus(`Latest checklist revision selected: ${latestChecklist.label}.`);
    }
  }

  async function loadDashboardChecklistSheets(checklistPath: string, requestId = ++checklistSheetsRequestRef.current) {
    try {
      setChecklistRevisionStatus("Reading checklist workbook sheets.");
      const endpoint = new URL(`${reviewApiBase}/api/dashboard-checklists/inspect`);
      endpoint.searchParams.set("path", checklistPath);
      const response = await fetch(endpoint.toString());
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok || !Array.isArray(payload.sheets)) {
        throw new Error(payload.error || `Checklist inspect failed with HTTP ${response.status}.`);
      }
      if (requestId !== checklistSheetsRequestRef.current) return;
      const sheets = payload.sheets as DashboardChecklistSheetInfo[];
      setChecklistSheets(sheets);
      setSelectedChecklistSheet(sheets[0]?.name || "");
      if (Array.isArray(payload.checklists)) {
        setChecklistOptions(payload.checklists as DashboardChecklistOption[]);
      }
      setChecklistRevisionStatus(
        sheets.length ? `${sheets.length} checklist sheet(s) ready. Select a sheet to edit.` : "No sheets were found in the selected checklist."
      );
    } catch (error) {
      if (requestId !== checklistSheetsRequestRef.current) return;
      const message = error instanceof Error ? error.message : String(error);
      setChecklistSheets([]);
      setSelectedChecklistSheet("");
      setChecklistGrid(null);
      setChecklistRevisionStatus(`Checklist workbook could not be read: ${message}`);
    }
  }

  async function loadDashboardChecklistSheetGrid(checklistPath: string, sheetName: string, requestId = ++checklistGridRequestRef.current) {
    try {
      setLoadingChecklistGrid(true);
      const endpoint = new URL(`${reviewApiBase}/api/dashboard-checklists/sheet`);
      endpoint.searchParams.set("path", checklistPath);
      endpoint.searchParams.set("sheetName", sheetName);
      const response = await fetch(endpoint.toString());
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok || !Array.isArray(payload.rows) || !Array.isArray(payload.columns)) {
        throw new Error(payload.error || `Checklist sheet refresh failed with HTTP ${response.status}.`);
      }
      if (requestId !== checklistGridRequestRef.current) return;
      const result = payload as DashboardChecklistGridResponse;
      setChecklistGrid({
        ...result,
        rows: result.rows.map((row) => ({
          ...row,
          values: normalizeDashboardChecklistGridValues(row.values, result.columns.length)
        }))
      });
      setChecklistRevisionStatus(`${result.rows.length} checklist row(s) loaded from ${result.sheetName}.`);
    } catch (error) {
      if (requestId !== checklistGridRequestRef.current) return;
      const message = error instanceof Error ? error.message : String(error);
      setChecklistGrid(null);
      setChecklistRevisionStatus(`Checklist sheet could not be loaded: ${message}`);
    } finally {
      if (requestId === checklistGridRequestRef.current) {
        setLoadingChecklistGrid(false);
      }
    }
  }

  function updateDashboardChecklistGridCell(rowIndex: number, columnIndex: number, value: string) {
    if (checklistSerialColumnIndex >= 0 && columnIndex === checklistSerialColumnIndex) return;
    setChecklistGrid((current) => {
      if (!current) return current;
      const rows = current.rows.map((row, index) => {
        if (index !== rowIndex) return row;
        const values = normalizeDashboardChecklistGridValues(row.values, current.columns.length);
        values[columnIndex] = value;
        return { ...row, values };
      });
      return { ...current, rows };
    });
  }

  function addDashboardChecklistGridRow() {
    setChecklistGrid((current) => {
      if (!current) return current;
      const values = Array.from({ length: current.columns.length }, () => "");
      if (current.serialColumn > 0) {
        values[Math.max(0, current.serialColumn - 1)] = String(current.rows.length + 1);
      }
      return {
        ...current,
        rows: [...current.rows, { rowNumber: 0, values }]
      };
    });
  }

  function removeDashboardChecklistGridRow(rowIndex: number) {
    setChecklistGrid((current) => {
      if (!current) return current;
      return {
        ...current,
        rows: current.rows.filter((_, index) => index !== rowIndex)
      };
    });
  }

  async function saveDashboardChecklistWorkbookRevision() {
    if (!checklistGrid || !selectedChecklistSheet || !form.checklistPath) {
      setChecklistRevisionStatus("Select a checklist sheet before saving.");
      return;
    }
    const editableRows = checklistGrid.rows
      .map((row) => normalizeDashboardChecklistGridValues(row.values, checklistGrid.columns.length))
      .filter((values) =>
        values.some((value, index) => (checklistSerialColumnIndex < 0 || index !== checklistSerialColumnIndex) && value.trim())
      );
    if (!editableRows.length) {
      setChecklistRevisionStatus("At least one checklist row is required before saving.");
      return;
    }

    try {
      setSavingChecklistRevision(true);
      setChecklistRevisionStatus("Saving edited checklist as a new revision.");
      const response = await fetch(`${reviewApiBase}/api/dashboard-checklists/revision/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: form.checklistPath,
          sheetName: selectedChecklistSheet,
          rows: editableRows
        })
      });
      const payload = (await response.json().catch(() => ({}))) as DashboardChecklistRevisionResponse & { error?: string };
      if (!response.ok || !payload.ok || !payload.createdFile?.path) {
        throw new Error(payload.error || `Checklist revision save failed with HTTP ${response.status}.`);
      }
      if (Array.isArray(payload.checklists)) {
        setChecklistOptions(payload.checklists);
      }
      updateForm("checklistPath", payload.createdFile.path);
      setChecklistStatus(`Checklist saved and selected: ${payload.createdFile.label}.`);
      setChecklistRevisionStatus(
        `Checklist saved as ${payload.createdFile.label}${payload.revisionLabel ? ` (${payload.revisionLabel})` : ""}; ${payload.saved?.updatedCount || editableRows.length} row(s) saved.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setChecklistRevisionStatus(`Checklist revision save failed: ${message}`);
    } finally {
      setSavingChecklistRevision(false);
    }
  }

  function dashboardChecklistDownloadUrl(pathValue: string) {
    const endpoint = new URL(`${reviewApiBase}/api/dashboard-checklists/download`);
    endpoint.searchParams.set("path", pathValue);
    return endpoint.toString();
  }

  async function loadDashboardArtifacts(folder = artifactFolder) {
    setArtifactLoading(true);
    setArtifactStatus("Refreshing dashboard review PDF files.");
    try {
      const endpoint = new URL(`${reviewApiBase}/api/review-artifacts`);
      if (folder) endpoint.searchParams.set("folder", folder);
      endpoint.searchParams.set("actorUserName", username);
      const response = await fetch(endpoint.toString());
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `Artifact refresh failed with HTTP ${response.status}.`);
      }
      const files = Array.isArray(payload.files) ? payload.files.filter((file: DashboardArtifact) => file.extension === ".pdf") : [];
      setDashboardArtifacts(files);
      setArtifactFolder(payload.folder || folder || "");
      setArtifactStatus(files.length ? `${files.length} dashboard review PDF file(s) ready.` : "No dashboard review PDF files found.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setArtifactStatus(`PDF refresh failed: ${message}`);
    } finally {
      setArtifactLoading(false);
    }
  }

  async function runDashboardReview() {
    if (!form.mainUrl.trim()) {
      setRunStatus("Main dashboard URL is required before the live review can run.");
      return;
    }
    if (runMode === "fixed" && !form.validationUrl.trim()) {
      setRunStatus("Validation dashboard URL is required for fixed comparison mode.");
      return;
    }

    const latestTimestamp = formatDateTime(new Date());
    setAutoTimestamp(true);
    updateForm("reviewTimestamp", latestTimestamp);
    setRunning(true);
    setRunStatus(`Running ${dashboardModeLabel(runMode).toLowerCase()} through the local dashboard review backend.`);
    const controller = new AbortController();
    const slowStatusTimer = window.setTimeout(() => {
      setRunStatus(dashboardSlowStatusMessage(runMode));
    }, 60000);
    const verySlowStatusTimer = window.setTimeout(() => {
      setRunStatus("Still running. Keep this page open; fresh PDF artifacts will appear when the backend finishes.");
      void loadDashboardArtifacts(artifactFolder);
    }, 180000);
    const timeoutTimer = window.setTimeout(() => controller.abort(), dashboardReviewClientTimeoutMs);
    try {
      const response = await fetch(`${reviewApiBase}/api/run-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          mode: runMode,
          baseUrl: effectiveBaseUrl,
          mainUrl: form.mainUrl.trim(),
          validationUrl: form.validationUrl.trim(),
          navigationUrl: form.navigationUrl.trim(),
          grafanaAuthMode: form.grafanaAuthMode,
          grafanaToken: form.grafanaToken.trim(),
          grafanaUsername: form.grafanaUsername.trim(),
          grafanaPassword: form.grafanaPassword,
          checklistPath: form.checklistPath.trim(),
          projectName: form.projectName.trim() || project.projectName || project.projectId,
          actorUserName: username,
          reviewerName: username,
          timeFrom: form.timeFrom.trim() || "now-1h",
          timeTo: form.timeTo.trim() || "now",
          reviewTimestamp: latestTimestamp
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `Dashboard review failed with HTTP ${response.status}.`);
      }
      const savedFolder = payload.paths?.folder ? ` Fresh artifacts were saved under ${payload.paths.folder}.` : "";
      const generatedPdfs = dashboardArtifactsFromPaths(payload.paths);
      if (generatedPdfs.length) {
        setDashboardArtifacts(generatedPdfs);
        setArtifactFolder(payload.paths?.folder || "");
        setArtifactStatus(`${generatedPdfs.length} dashboard review PDF file(s) ready.`);
      }
      void loadDashboardArtifacts(payload.paths?.folder || "");
      setRunStatus(`Live dashboard review completed.${savedFolder}`);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setRunStatus("Live review is taking longer than 10 minutes, so the browser stopped waiting. The backend may still finish; use Refresh PDFs to check for completed artifacts.");
        void loadDashboardArtifacts(artifactFolder);
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      setRunStatus(`Live review failed: ${message || "Start the dashboard reviewer with python review_server.py, then try again."}`);
    } finally {
      window.clearTimeout(slowStatusTimer);
      window.clearTimeout(verySlowStatusTimer);
      window.clearTimeout(timeoutTimer);
      setRunning(false);
    }
  }

  return (
    <section className="dashboard-review-placeholder">
      <div className="dashboard-review-blueprint">
        <div className="dashboard-blueprint-head">
          <div>
            <span className="eyebrow">Current Packet</span>
            <h3>AI Dashboard Review and Validation</h3>
            <p>{project.projectName || project.projectId}</p>
          </div>
          <span className="dashboard-prototype-pill">Dashboard</span>
        </div>

        <div className="dashboard-mode-switch" role="tablist" aria-label="Dashboard review mode">
          {(["linked", "fixed", "single"] as DashboardRunMode[]).map((mode) => (
            <button
              className={`dashboard-mode-option ${runMode === mode ? "active" : ""}`}
              key={mode}
              onClick={() => {
                setRunMode(mode);
                setRunStatus(`Mode changed to ${dashboardModeLabel(mode)}. Analyze setup before running live review.`);
              }}
              type="button"
            >
              {dashboardModeLabel(mode)}
            </button>
          ))}
        </div>

        <div className="dashboard-setup-grid">
          <label className="dashboard-field">
            <span>Review timestamp</span>
            <div className="dashboard-inline-field">
              <input
                onChange={(event) => {
                  setAutoTimestamp(false);
                  updateForm("reviewTimestamp", event.target.value);
                }}
                placeholder="DD-MM-YYYY HH:MM:SS"
                type="text"
                value={form.reviewTimestamp}
              />
              <button
                className="secondary-btn dashboard-now-btn"
                onClick={() => {
                  setAutoTimestamp(true);
                  updateForm("reviewTimestamp", formatDateTime(new Date()));
                }}
                type="button"
              >
                <RefreshCw size={15} />
                Now
              </button>
            </div>
          </label>
          <label className="dashboard-field">
            <span>Project name</span>
            <input
              onChange={(event) => updateForm("projectName", event.target.value)}
              placeholder="Project name for review file"
              type="text"
              value={form.projectName}
            />
          </label>
          <label className="dashboard-field">
            <span>Grafana base URL</span>
            <input
              onChange={(event) => updateForm("baseUrl", event.target.value)}
              placeholder="https://grafana.example.com or https://host/grafana"
              type="url"
              value={form.baseUrl}
            />
          </label>
          <label className="dashboard-field dashboard-field-wide">
            <span>Main dashboard URL</span>
            <input
              onChange={(event) => updateForm("mainUrl", event.target.value)}
              placeholder="https://host/grafana/d/uid/slug?var-region=All"
              type="url"
              value={form.mainUrl}
            />
          </label>
          {runMode === "fixed" && (
            <label className="dashboard-field dashboard-field-wide">
              <span>Validation dashboard URL</span>
              <input
                onChange={(event) => updateForm("validationUrl", event.target.value)}
                placeholder="Required for fixed comparison mode"
                type="url"
                value={form.validationUrl}
              />
            </label>
          )}
          {runMode === "linked" && (
            <label className="dashboard-field dashboard-field-wide">
              <span>Navigation dashboard URL</span>
              <input
                onChange={(event) => updateForm("navigationUrl", event.target.value)}
                placeholder="Optional route map for ambiguous or partial links"
                type="url"
                value={form.navigationUrl}
              />
            </label>
          )}
          <div className="dashboard-field dashboard-field-wide">
            <span>Grafana access</span>
            <div className={`dashboard-auth-grid auth-${form.grafanaAuthMode}`}>
              <select
                aria-label="Grafana authentication mode"
                onChange={(event) => updateForm("grafanaAuthMode", event.target.value as DashboardAuthMode)}
                value={form.grafanaAuthMode}
              >
                <option value="anonymous">Anonymous viewer</option>
                <option value="bearer">Bearer / API token</option>
                <option value="basic">Basic login</option>
              </select>
              {form.grafanaAuthMode === "bearer" && (
                <input
                  aria-label="Grafana bearer token"
                  autoComplete="off"
                  onChange={(event) => updateForm("grafanaToken", event.target.value)}
                  placeholder="Paste Grafana service account token"
                  type="password"
                  value={form.grafanaToken}
                />
              )}
              {form.grafanaAuthMode === "basic" && (
                <>
                  <input
                    aria-label="Grafana username"
                    autoComplete="username"
                    onChange={(event) => updateForm("grafanaUsername", event.target.value)}
                    placeholder="Grafana username"
                    type="text"
                    value={form.grafanaUsername}
                  />
                  <input
                    aria-label="Grafana password"
                    autoComplete="current-password"
                    onChange={(event) => updateForm("grafanaPassword", event.target.value)}
                    placeholder="Grafana password"
                    type="password"
                    value={form.grafanaPassword}
                  />
                </>
              )}
            </div>
            <small>Use token or login only when Grafana API returns 401 Unauthorized.</small>
          </div>
          <section className="dashboard-checklist-editor dashboard-field-wide">
            <div className="checklist-editor-head">
              <div>
                <span className="eyebrow">Checklist Excel Editor</span>
                <strong>Checklist Workbook Editor</strong>
                <small>Edit the selected checklist sheet in the browser. Save creates a new checklist file revision.</small>
              </div>
              <span>{selectedChecklistOption?.revisionLabel || "Rev 0.0 to 0.10, then 1.0 to 1.10"}</span>
            </div>
            <label className="dashboard-field dashboard-field-wide">
              <span>Checklist selection</span>
              <div className="dashboard-checklist-picker">
                <select
                  disabled={checklistUploading || savingChecklistRevision}
                  onChange={(event) => selectDashboardChecklist(event.target.value)}
                  value={form.checklistPath}
                >
                  {checklistOptions.map((option) => (
                    <option key={`${option.path || "embedded"}-${option.label}`} value={option.path}>
                      {option.label}
                      {option.isDefault ? " (default)" : ""}
                      {option.exists === false ? " (missing)" : ""}
                    </option>
                  ))}
                </select>
                <input
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden-input"
                  onChange={(event) => {
                    void uploadDashboardChecklist(event.target.files);
                    event.target.value = "";
                  }}
                  ref={checklistFileInputRef}
                  type="file"
                />
                <button
                  className="secondary-btn dashboard-browse-btn"
                  disabled={checklistUploading || running || savingChecklistRevision}
                  onClick={() => checklistFileInputRef.current?.click()}
                  type="button"
                >
                  {checklistUploading ? <Loader2 className="spin" size={16} /> : <Upload size={16} />}
                  Browse
                </button>
                <a
                  className={`secondary-btn dashboard-browse-btn dashboard-checklist-download ${form.checklistPath ? "" : "disabled"}`}
                  href={form.checklistPath ? dashboardChecklistDownloadUrl(form.checklistPath) : "#"}
                  onClick={(event) => {
                    if (!form.checklistPath) {
                      event.preventDefault();
                      setChecklistRevisionStatus("Select a checklist .xlsx file before downloading.");
                    }
                  }}
                >
                  <Download size={16} />
                  Download
                </a>
              </div>
              <small>{checklistStatus}</small>
            </label>
            <label className="latest-checklist-option">
              <input
                checked={autoSelectLatestChecklist}
                onChange={(event) => toggleAutoSelectLatestDashboardChecklist(event.target.checked)}
                type="checkbox"
              />
              <span>
                <strong>Always select latest checklist revision</strong>
                <small>When the page opens, refreshes, or a revision is saved, the newest revision for this checklist will be selected.</small>
              </span>
            </label>
            <label className="dashboard-field dashboard-field-wide">
              <span>Checklist sheet</span>
              <select
                disabled={!checklistSheets.length || savingChecklistRevision}
                onChange={(event) => setSelectedChecklistSheet(event.target.value)}
                value={selectedChecklistSheet}
              >
                {!checklistSheets.length && <option value="">No sheet loaded</option>}
                {checklistSheets.map((sheet) => (
                  <option key={sheet.name} value={sheet.name}>
                    {sheet.name} ({sheet.pointCount || 0} point{sheet.pointCount === 1 ? "" : "s"})
                  </option>
                ))}
              </select>
            </label>
            <div className="excel-editor-toolbar">
              <button
                className="secondary-btn"
                disabled={loadingChecklistGrid || !form.checklistPath || !selectedChecklistSheet || savingChecklistRevision}
                onClick={() => selectedChecklistSheet && void loadDashboardChecklistSheetGrid(form.checklistPath, selectedChecklistSheet)}
                type="button"
              >
                {loadingChecklistGrid ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
                Refresh Sheet
              </button>
              <button className="secondary-btn" disabled={!checklistGrid || savingChecklistRevision} onClick={addDashboardChecklistGridRow} type="button">
                <Plus size={16} />
                Add Row
              </button>
            </div>
            <div className="excel-editor-grid dashboard-checklist-grid" style={checklistGridTemplate}>
              <div className="excel-editor-row heading">
                <span>#</span>
                {checklistGridColumns.map((column, index) => (
                  <span key={`${column}-${index}`}>{column}</span>
                ))}
                <span />
              </div>
              {loadingChecklistGrid && <div className="excel-editor-empty">Loading checklist sheet...</div>}
              {!loadingChecklistGrid &&
                checklistGridRows.map((row, rowIndex) => {
                  const values = normalizeDashboardChecklistGridValues(row.values, checklistGridColumns.length);
                  return (
                    <div className="excel-editor-row" key={`${row.rowNumber}-${rowIndex}`}>
                      <strong>{rowIndex + 1}</strong>
                      {checklistGridColumns.map((column, columnIndex) => (
                        <input
                          aria-label={`${column} row ${rowIndex + 1}`}
                          className={checklistSerialColumnIndex >= 0 && columnIndex === checklistSerialColumnIndex ? "locked" : ""}
                          key={`${column}-${columnIndex}`}
                          onChange={(event) => updateDashboardChecklistGridCell(rowIndex, columnIndex, event.target.value)}
                          readOnly={checklistSerialColumnIndex >= 0 && columnIndex === checklistSerialColumnIndex}
                          title={
                            checklistSerialColumnIndex >= 0 && columnIndex === checklistSerialColumnIndex
                              ? "Serial number is generated on save."
                              : column
                          }
                          value={
                            checklistSerialColumnIndex >= 0 && columnIndex === checklistSerialColumnIndex
                              ? String(rowIndex + 1)
                              : values[columnIndex] || ""
                          }
                        />
                      ))}
                      <button
                        aria-label={`Remove row ${rowIndex + 1}`}
                        className="icon-btn danger-icon"
                        disabled={savingChecklistRevision}
                        onClick={() => removeDashboardChecklistGridRow(rowIndex)}
                        title="Remove row"
                        type="button"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  );
                })}
              {!loadingChecklistGrid && !checklistGridRows.length && (
                <div className="excel-editor-empty">No editable rows found in the selected sheet.</div>
              )}
            </div>
            <div className="checklist-editor-actions">
              <small>{checklistRevisionStatus}</small>
              <button
                className="secondary-btn"
                disabled={savingChecklistRevision || !selectedChecklistSheet || !checklistGridRows.length}
                onClick={saveDashboardChecklistWorkbookRevision}
                type="button"
              >
                {savingChecklistRevision ? <Loader2 className="spin" size={16} /> : <FileCheck2 size={16} />}
                Save Edited Revision
              </button>
            </div>
          </section>
          <DashboardTimeRangePicker
            onTimeFromChange={(value) => updateForm("timeFrom", value)}
            onTimeToChange={(value) => updateForm("timeTo", value)}
            timeFrom={form.timeFrom}
            timeTo={form.timeTo}
          />
        </div>

        <div className="dashboard-context-strip">
          <div>
            <span>Effective base</span>
            <strong>{effectiveBaseUrl || "Waiting for Grafana URL"}</strong>
          </div>
          <div>
            <span>Main dashboard UID</span>
            <strong>{parsedMain?.uid || "Not parsed yet"}</strong>
          </div>
          <div>
            <span>URL variables</span>
            <strong>{parsedMain?.variableCount ?? 0}</strong>
          </div>
        </div>

        <div className="dashboard-setup-actions">
          <div className="dashboard-button-row">
            <button className="primary-btn" onClick={analyzeDashboardSetup} type="button">
              <FileText size={16} />
              Analyze setup
            </button>
            <button className="secondary-btn" disabled={running} onClick={runDashboardReview} type="button">
              {running ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
              {running ? "Running review..." : "Run live review"}
            </button>
            <button className="secondary-btn" onClick={() => window.open(`${window.location.protocol}//${window.location.hostname}:${dashboardReviewApiPort}/index.html`, "_blank", "noopener")} type="button">
              <ArrowRight size={16} />
              Open reviewer
            </button>
          </div>
          <span className="dashboard-run-status">{runStatus}</span>
        </div>

        <div className="dashboard-artifact-panel">
          <div className="dashboard-artifact-head">
            <div>
              <span className="eyebrow">Review PDFs</span>
              <strong>{artifactFolder || "Dashboard review output"}</strong>
            </div>
            <button className="secondary-btn" disabled={artifactLoading} onClick={() => void loadDashboardArtifacts()} type="button">
              {artifactLoading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
              Refresh PDFs
            </button>
          </div>
          {dashboardArtifacts.length ? (
            <div className="repository-file-list dashboard-artifact-list">
              {dashboardArtifacts.map((file) => (
                <div className="repository-file-row" key={file.path}>
                  <FileText size={17} />
                  <span>
                    {file.displayName || file.name}
                    <small>
                      {file.artifactType || "Dashboard review PDF"} | {formatBytes(file.size || 0)}
                      {file.modifiedAt ? ` | ${formatOptionalDateTime(file.modifiedAt)}` : ""}
                    </small>
                  </span>
                  <div className="repository-actions">
                    <a
                      className="icon-action"
                      href={dashboardReviewArtifactUrl(file.path, false, username)}
                      target="_blank"
                      rel="noreferrer"
                      title={`View ${file.displayName || file.name}`}
                    >
                      <Eye size={15} />
                    </a>
                    <a className="icon-action" href={dashboardReviewArtifactUrl(file.path, true, username)} title={`Download ${file.displayName || file.name}`}>
                      <Download size={15} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-note">{artifactStatus}</div>
          )}
        </div>
      </div>
    </section>
  );
}

function dashboardArtifactsFromPaths(paths: unknown): DashboardArtifact[] {
  if (!paths || typeof paths !== "object") return [];
  const seen = new Set<string>();
  return Object.values(paths as Record<string, unknown>)
    .filter((value): value is string => typeof value === "string" && value.toLowerCase().endsWith(".pdf"))
    .filter((pathValue) => {
      if (seen.has(pathValue)) return false;
      seen.add(pathValue);
      return true;
    })
    .map((pathValue) => ({
      path: pathValue,
      name: fileNameFromPath(pathValue),
      displayName: fileNameFromPath(pathValue),
      extension: ".pdf",
      artifactType: "Dashboard review PDF",
      size: 0,
      canView: true
    }));
}

function dashboardReviewArtifactUrl(pathValue: string, download = false, username = "") {
  const endpoint = new URL(`${window.location.protocol}//${window.location.hostname}:${dashboardReviewApiPort}/api/review-artifact`);
  endpoint.searchParams.set("path", pathValue);
  if (username) endpoint.searchParams.set("actorUserName", username);
  if (download) endpoint.searchParams.set("download", "1");
  return endpoint.toString();
}

function fileNameFromPath(pathValue: string) {
  return pathValue.split(/[\\/]/).pop() || pathValue || "dashboard-review.pdf";
}

function normalizeDashboardChecklistGridValues(values: unknown[], columnCount: number) {
  return Array.from({ length: columnCount }, (_, index) => {
    const value = values[index];
    if (value === null || value === undefined) return "";
    return String(value);
  });
}

function sameDashboardChecklistPath(left: string, right: string) {
  return normalizeDashboardChecklistPath(left) === normalizeDashboardChecklistPath(right);
}

function normalizeDashboardChecklistPath(value: string) {
  return value.replace(/\//g, "\\").trim().toLowerCase();
}

function latestDashboardChecklistForSelection(checklists: DashboardChecklistOption[], selectedPath: string) {
  if (!checklists.length) return null;
  const selectedFile = checklists.find((file) => sameDashboardChecklistPath(file.path, selectedPath));
  const selectedFamily = dashboardChecklistFamilyName(selectedFile?.label || selectedPath);
  const candidates = selectedFamily
    ? checklists.filter((file) => file.path && file.exists !== false && dashboardChecklistFamilyName(file.label || file.path) === selectedFamily)
    : checklists.filter((file) => file.path && file.exists !== false);
  return candidates.reduce<DashboardChecklistOption | null>((latest, file) => {
    if (!latest) return file;
    const revisionDiff = dashboardChecklistRevisionValue(file) - dashboardChecklistRevisionValue(latest);
    if (revisionDiff > 0) return file;
    if (revisionDiff < 0) return latest;
    const timeDiff = Date.parse(file.modifiedAt || "") - Date.parse(latest.modifiedAt || "");
    if (timeDiff > 0) return file;
    if (timeDiff < 0) return latest;
    return (file.label || file.path).localeCompare(latest.label || latest.path) > 0 ? file : latest;
  }, null);
}

function dashboardChecklistRevisionValue(file: DashboardChecklistOption) {
  if (typeof file.revisionNumber === "number") return file.revisionNumber;
  if (typeof file.revisionMajor === "number" || typeof file.revisionMinor === "number") {
    return Number(file.revisionMajor || 0) * 11 + Number(file.revisionMinor || 0);
  }
  const match = (file.label || file.path || "").match(/rev(?:ision)?\s*(\d+)\.(\d+)/i);
  if (!match) return 0;
  return Number(match[1] || 0) * 11 + Number(match[2] || 0);
}

function dashboardChecklistFamilyName(value: string) {
  const fileName = fileNameFromPath(value);
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/\s*[\[(]?\s*rev(?:ision)?\s*\d+\.\d+\s*[\])]?\s*$/i, "")
    .trim()
    .toLowerCase();
}

function dashboardModeLabel(mode: DashboardRunMode) {
  if (mode === "fixed") return "Fixed comparison";
  if (mode === "single") return "Single dashboard";
  return "Linked validation";
}

function dashboardSlowStatusMessage(mode: DashboardRunMode) {
  if (mode === "fixed") {
    return "Still running fixed comparison. It is comparing only the two supplied dashboards; slow Grafana datasource queries will be marked in the review output when they fail.";
  }
  if (mode === "single") {
    return "Still running single dashboard review. The backend is querying the supplied dashboard panels and preparing fresh artifacts.";
  }
  return "Still running linked validation. This can take around 5 minutes because it follows linked dashboard routes and queries the target panels.";
}

function dashboardRunReadiness(
  mode: DashboardRunMode,
  form: { baseUrl: string; mainUrl: string; validationUrl: string; timeFrom: string; timeTo: string },
  effectiveBaseUrl: string
) {
  if (!form.mainUrl.trim()) return "Add the main dashboard URL to prepare the live review.";
  if (mode === "fixed" && !form.validationUrl.trim()) return "Add the validation dashboard URL to run fixed comparison mode.";
  const timeRange = `${form.timeFrom.trim() || "now-1h"} to ${form.timeTo.trim() || "now"}`;
  return `Setup analyzed. Ready for ${dashboardModeLabel(mode).toLowerCase()} against ${effectiveBaseUrl || "the supplied Grafana host"} for ${timeRange}.`;
}

function parseDashboardSetupUrl(input: string, fallbackBase?: string) {
  const raw = input.trim();
  if (!raw) return null;
  try {
    const url = /^https?:\/\//i.test(raw) ? new URL(raw) : new URL(raw.replace(/^\//, ""), ensureTrailingSlash(fallbackBase || ""));
    const segments = url.pathname.split("/").filter(Boolean);
    const dIndex = segments.indexOf("d");
    const uid = dIndex >= 0 ? segments[dIndex + 1] || "" : "";
    const prefix = dIndex >= 0 ? segments.slice(0, dIndex).join("/") : "";
    let variableCount = 0;
    url.searchParams.forEach((_, key) => {
      if (key.startsWith("var-")) variableCount += 1;
    });
    return {
      uid,
      baseUrl: normalizeBaseUrl(`${url.origin}${prefix ? `/${prefix}` : ""}`),
      variableCount
    };
  } catch {
    return null;
  }
}

function PhaseGuide({ phase }: { phase: Phase }) {
  const guidance = phaseGuidance[phase.id];
  return (
    <section className="phase-guide-simple">
      <div className="section-title">
        <ShieldCheck size={16} />
        <span>Phase Guide</span>
      </div>
      <div className="guide-lines">
        <div className="guide-line">
          <strong>Work to do</strong>
          <span>{guidance.userAction}</span>
        </div>
        <div className="guide-line">
          <strong>Useful uploads</strong>
          <span>{guidance.uploads}</span>
        </div>
        <div className="guide-line">
          <strong>Expected output</strong>
          <span>{guidance.output}</span>
        </div>
        <div className="guide-line">
          <strong>Gate focus</strong>
          <span>{guidance.gateFocus}</span>
        </div>
      </div>
    </section>
  );
}

function GateSummary({ phase }: { phase: Phase }) {
  const allRows = [...phase.gate.projectContext, ...phase.gate.entry, ...phase.gate.exit];
  const counts = allRows.reduce(
    (acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    },
    { Complete: 0, Incomplete: 0, Blocked: 0, "Not applicable": 0 } as Record<string, number>
  );
  const blockers = countGateBlockers(phase);
  const groups = [
    { label: "Project Context", rows: phase.gate.projectContext },
    { label: "Entry Gate", rows: phase.gate.entry },
    { label: "Exit Gate", rows: phase.gate.exit }
  ];
  return (
    <section className="gate-summary">
      <div className="gate-summary-top">
        <div>
          <span className="eyebrow">Gate readiness</span>
          <h4>{blockers === 0 ? "Ready for phase completion review" : `${blockers} gate item(s) still blocking`}</h4>
        </div>
        <div className="gate-metrics">
          <Metric label="Complete" value={counts.Complete} tone="good" />
          <Metric label="Incomplete" value={counts.Incomplete} tone="warn" />
          <Metric label="Blocked" value={counts.Blocked} tone="bad" />
          <Metric label="N/A" value={counts["Not applicable"]} tone="neutral" />
        </div>
      </div>
      <div className="gate-progress-grid">
        {groups.map((group) => (
          <GateProgressCard key={group.label} label={group.label} rows={group.rows} />
        ))}
      </div>
    </section>
  );
}

function GateProgressCard({ label, rows }: { label: string; rows: GateRow[] }) {
  const total = rows.length;
  const clear = rows.filter((row) => !isGateBlocking(row)).length;
  const blockers = rows.filter((row) => isGateBlocking(row)).length;
  const percent = total === 0 ? 0 : Math.round((clear / total) * 100);
  return (
    <div className="gate-progress-card">
      <div className="gate-progress-head">
        <strong>{label}</strong>
        <span>{percent}%</span>
      </div>
      <div className="progress-track" aria-label={`${label} progress`}>
        <span className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="progress-meta">
        <span>
          {clear}/{total} clear
        </span>
        <span>{blockers} blocking</span>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "good" | "warn" | "bad" | "neutral" }) {
  return (
    <div className={`metric ${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function ArtifactStrip({ phase }: { phase: Phase }) {
  return (
    <section className="artifact-strip">
      <div className="section-title">
        <Upload size={16} />
        <span>Artifacts</span>
      </div>
      <div className="artifact-list">
        {phase.uploads.map((artifact) => (
          <div className="artifact-item" key={artifact.id}>
            <FileText size={15} />
            <span>{artifact.originalName}</span>
            <small>{formatBytes(artifact.size)}</small>
          </div>
        ))}
        {phase.uploads.length === 0 && <div className="empty-note">No uploads for this phase</div>}
      </div>
    </section>
  );
}

function GateEditor({ phase, onSave, disabled }: { phase: Phase; onSave: (gate: GateState) => void; disabled: boolean }) {
  const [gate, setGate] = useState<GateState>(phase.gate);
  const blockers = countGateBlockers(phase);

  useEffect(() => {
    setGate(phase.gate);
  }, [phase.id, phase.gate]);

  function updateRow(area: keyof GateState, index: number, patch: Partial<GateRow>) {
    setGate((current) => ({
      ...current,
      [area]: (current[area] as GateRow[]).map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
    }));
  }

  return (
    <section className="gate-panel" id="gate-checklist">
      <details className="gate-details" id="gate-details">
        <summary>
          <div className="gate-summary-row">
            <CheckCircle2 size={16} />
            <div>
              <strong>Phase Gates</strong>
              <span>{blockers === 0 ? "All gate items are clear" : `${blockers} item(s) need attention`}</span>
            </div>
          </div>
          <span className="gate-count-pill">Show checklist</span>
        </summary>
        <div className="gate-details-body">
          <div className="gate-heading">
            <div className="section-title">
              <CheckCircle2 size={16} />
              <span>Gate Checklist</span>
            </div>
            <button className="secondary-btn" onClick={() => onSave(gate)} disabled={disabled}>
              <Save size={16} />
              Save Gate
            </button>
          </div>
          <GateTable title="Project Context" rows={gate.projectContext} onChange={(index, patch) => updateRow("projectContext", index, patch)} />
          <GateTable title="Entry Gate" rows={gate.entry} onChange={(index, patch) => updateRow("entry", index, patch)} />
          <GateTable title="Exit Gate" rows={gate.exit} onChange={(index, patch) => updateRow("exit", index, patch)} />
        </div>
      </details>
    </section>
  );
}

function GateTable({
  title,
  rows,
  onChange
}: {
  title: string;
  rows: GateRow[];
  onChange: (index: number, patch: Partial<GateRow>) => void;
}) {
  return (
    <div className="gate-section">
      <h4>{title}</h4>
      <div className="gate-card-list">
        {rows.map((row, index) => (
          <div className={`gate-card ${statusClass(row.status)}`} key={`${title}-${row.item}`}>
            <div className="gate-card-main">
              <strong>{row.item}</strong>
              <small>{row.requiredCondition}</small>
            </div>
            <label>
              <span>Status</span>
              <select value={row.status} onChange={(event) => onChange(index, { status: event.target.value as GateRow["status"] })}>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Evidence</span>
              <input value={row.evidence} onChange={(event) => onChange(index, { evidence: event.target.value })} />
            </label>
            <label>
              <span>Owner</span>
              <input value={row.owner} onChange={(event) => onChange(index, { owner: event.target.value })} />
            </label>
            <label>
              <span>Notes</span>
              <input value={row.notes} onChange={(event) => onChange(index, { notes: event.target.value })} />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

function UploadButton({ onUpload, disabled }: { onUpload: (files: FileList | null) => void; disabled: boolean }) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onUpload(event.target.files);
    event.target.value = "";
  }

  return (
    <>
      <input ref={inputRef} className="hidden-input" multiple type="file" onChange={handleChange} />
      <button className="secondary-btn" onClick={() => inputRef.current?.click()} disabled={disabled}>
        <Upload size={16} />
        Upload
      </button>
    </>
  );
}

function GateDot({ phase }: { phase: Phase }) {
  const blockers = countGateBlockers(phase);

  if (phase.state.status === "completed") return <CheckCircle2 className="gate-dot complete" size={18} />;
  if (blockers > 0) return <AlertTriangle className="gate-dot blocked" size={18} />;
  return <Circle className="gate-dot ready" size={18} />;
}

function countAnsweredQuestions(phaseId: string, answers: Record<string, string>) {
  const questions = phaseQuestions[phaseId] || [];
  return questions.filter((question) => answers[question.id]?.trim()).length;
}

function countGateBlockers(phase: Phase) {
  return [...phase.gate.projectContext, ...phase.gate.entry, ...phase.gate.exit].filter(
    (row) => isGateBlocking(row)
  ).length;
}

function isGateBlocking(row: GateRow) {
  return row.status === "Incomplete" || row.status === "Blocked" || (row.status === "Not applicable" && !row.notes && !row.evidence);
}

function visibleAgentOutput(value?: string) {
  const text = String(value || "").trim();
  if (!text) return "No output yet.";
  return text
    .replace(/^- Quality check cells:.*(?:\r?\n)?/gim, "")
    .replace(/## Quality Checks From Review Files[\s\S]*?(?=\r?\n## |\s*$)/gi, "")
    .replace(/## Data Quality Checks Needed[\s\S]*?(?=\r?\n## |\s*$)/gi, "")
    .trim() || "No output yet.";
}

function reviewPhaseTitle(phase: Phase, targetPlatform: string) {
  if (phase.id !== defaultReviewPhaseId) return phase.title;
  if (isGrafanaPlatform(targetPlatform)) return "AI Dashboard Review and Validation";
  if (isFlexReportPlatform(targetPlatform)) return "AI Report Review and Validation";
  return phase.title;
}

function isGrafanaPlatform(value: string) {
  return normalizePlatform(value) === "grafana";
}

function isFlexReportPlatform(value: string) {
  return normalizePlatform(value) === "flexreport";
}

function normalizePlatform(value: string) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function statusClass(status: GateRow["status"]) {
  return status.toLowerCase().replace(/\s+/g, "-");
}

function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase().replace(/\s+/g, "-");
  return <span className={`status-pill ${normalized}`}>{status}</span>;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 63);
}

function normalizeBaseUrl(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  try {
    const url = /^https?:\/\//i.test(raw) ? new URL(raw) : new URL(`https://${raw}`);
    const normalizedPath = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");
    return `${url.origin}${normalizedPath}`;
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

function chooseEffectiveDashboardBase(submittedBase: string, detectedBase: string) {
  const submitted = normalizeBaseUrl(submittedBase);
  const detected = normalizeBaseUrl(detectedBase);
  if (!submitted) return detected;
  if (!detected) return submitted;

  try {
    const submittedUrl = new URL(submitted);
    const detectedUrl = new URL(detected);
    const sameOrigin =
      submittedUrl.protocol.toLowerCase() === detectedUrl.protocol.toLowerCase() &&
      submittedUrl.host.toLowerCase() === detectedUrl.host.toLowerCase();
    const submittedPath = submittedUrl.pathname.replace(/\/+$/, "");
    const detectedPath = detectedUrl.pathname.replace(/\/+$/, "");
    if (sameOrigin && detectedPath && (!submittedPath || detectedPath === submittedPath || detectedPath.startsWith(`${submittedPath}/`))) {
      return detected;
    }
  } catch {
    return submitted;
  }

  return submitted;
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

const dashboardQuickRanges = [
  { label: "Last 5 minutes", from: "now-5m", to: "now" },
  { label: "Last 15 minutes", from: "now-15m", to: "now" },
  { label: "Last 30 minutes", from: "now-30m", to: "now" },
  { label: "Last 1 hour", from: "now-1h", to: "now" },
  { label: "Last 3 hours", from: "now-3h", to: "now" },
  { label: "Last 6 hours", from: "now-6h", to: "now" },
  { label: "Last 12 hours", from: "now-12h", to: "now" },
  { label: "Last 24 hours", from: "now-24h", to: "now" },
  { label: "Last 2 days", from: "now-2d", to: "now" }
];

const dashboardRecentRanges = [
  { label: "2026-07-26 00:00:00 to 2026-07-27 23:59:59", from: "26-07-2026 00:00:00", to: "27-07-2026 23:59:59" },
  { label: "2026-07-27 00:00:00 to 2026-07-27 23:59:59", from: "27-07-2026 00:00:00", to: "27-07-2026 23:59:59" },
  { label: "2026-07-26 00:00:00 to 2026-07-26 23:59:59", from: "26-07-2026 00:00:00", to: "26-07-2026 23:59:59" }
];

function DashboardTimeRangePicker({
  onTimeFromChange,
  onTimeToChange,
  timeFrom,
  timeTo
}: {
  onTimeFromChange: (value: string) => void;
  onTimeToChange: (value: string) => void;
  timeFrom: string;
  timeTo: string;
}) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(timeFrom);
  const [draftTo, setDraftTo] = useState(timeTo);
  const [quickSearch, setQuickSearch] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);
  const filteredQuickRanges = dashboardQuickRanges.filter((range) => range.label.toLowerCase().includes(quickSearch.trim().toLowerCase()));
  const appliedQuickRange = dashboardQuickRanges.find(
    (range) => cleanRangeToken(range.from) === cleanRangeToken(timeFrom) && cleanRangeToken(range.to) === cleanRangeToken(timeTo)
  );
  const selectedQuickRange = dashboardQuickRanges.find(
    (range) => cleanRangeToken(range.from) === cleanRangeToken(draftFrom) && cleanRangeToken(range.to) === cleanRangeToken(draftTo)
  );
  const timeSelectionLabel = appliedQuickRange?.label || `${timeFrom || "now-1h"} to ${timeTo || "now"}`;
  const pickerFromValue = toDateTimeLocalInputValue(resolveDashboardTimePickerDate(draftFrom, "from"));
  const pickerToValue = toDateTimeLocalInputValue(resolveDashboardTimePickerDate(draftTo, "to"));
  const timeFromValue = toTimeInputValue(resolveDashboardTimePickerDate(draftFrom, "from"));
  const timeToValue = toTimeInputValue(resolveDashboardTimePickerDate(draftTo, "to"));

  useEffect(() => {
    if (open) return;
    setDraftFrom(timeFrom);
    setDraftTo(timeTo);
  }, [open, timeFrom, timeTo]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (pickerRef.current && event.target instanceof Node && !pickerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function openPicker() {
    setDraftFrom(timeFrom);
    setDraftTo(timeTo);
    setOpen(true);
  }

  function applyRange(nextFrom = draftFrom, nextTo = draftTo) {
    onTimeFromChange(nextFrom.trim() || "now-1h");
    onTimeToChange(nextTo.trim() || "now");
    setOpen(false);
  }

  return (
    <div className="dashboard-time-range-control" ref={pickerRef}>
      <div className="dashboard-time-range-row">
        <label className="dashboard-field dashboard-time-selection-field">
          <span>Time selection</span>
          <button
            aria-expanded={open}
            aria-haspopup="dialog"
            className="dashboard-time-selection-button"
            onClick={openPicker}
            title="Open time range picker"
            type="button"
          >
            <span>{timeSelectionLabel}</span>
            <CalendarDays size={16} />
          </button>
        </label>
      </div>
      {open && (
        <div className="dashboard-grafana-time-popover">
          <div className="grafana-time-absolute">
            <strong>Absolute time range</strong>
            <label>
              <span>From</span>
              <div className="grafana-absolute-field">
                <input onChange={(event) => setDraftFrom(event.target.value)} value={draftFrom} />
                <div className="grafana-absolute-actions">
                  <div className="grafana-native-picker">
                    <button aria-hidden="true" className="icon-btn" tabIndex={-1} type="button">
                      <CalendarDays size={14} />
                    </button>
                    <input
                      aria-label="Pick from date and time"
                      onChange={(event) => {
                        const selectedValue = formatDateTimeFromPicker(event.target.value);
                        if (selectedValue) setDraftFrom(selectedValue);
                      }}
                      step="1"
                      type="datetime-local"
                      value={pickerFromValue}
                    />
                  </div>
                  <div className="grafana-native-picker">
                    <button aria-hidden="true" className="icon-btn" tabIndex={-1} type="button">
                      <Clock size={14} />
                    </button>
                    <input
                      aria-label="Pick from time"
                      onChange={(event) => {
                        const selectedValue = formatDateTimeWithPickedTime(draftFrom, event.target.value, "from");
                        if (selectedValue) setDraftFrom(selectedValue);
                      }}
                      step="1"
                      type="time"
                      value={timeFromValue}
                    />
                  </div>
                </div>
              </div>
            </label>
            <label>
              <span>To</span>
              <div className="grafana-absolute-field">
                <input onChange={(event) => setDraftTo(event.target.value)} value={draftTo} />
                <div className="grafana-absolute-actions">
                  <div className="grafana-native-picker">
                    <button aria-hidden="true" className="icon-btn" tabIndex={-1} type="button">
                      <CalendarDays size={14} />
                    </button>
                    <input
                      aria-label="Pick to date and time"
                      onChange={(event) => {
                        const selectedValue = formatDateTimeFromPicker(event.target.value);
                        if (selectedValue) setDraftTo(selectedValue);
                      }}
                      step="1"
                      type="datetime-local"
                      value={pickerToValue}
                    />
                  </div>
                  <div className="grafana-native-picker">
                    <button aria-hidden="true" className="icon-btn" tabIndex={-1} type="button">
                      <Clock size={14} />
                    </button>
                    <input
                      aria-label="Pick to time"
                      onChange={(event) => {
                        const selectedValue = formatDateTimeWithPickedTime(draftTo, event.target.value, "to");
                        if (selectedValue) setDraftTo(selectedValue);
                      }}
                      step="1"
                      type="time"
                      value={timeToValue}
                    />
                  </div>
                </div>
              </div>
            </label>
            <button className="grafana-apply-button" onClick={() => applyRange()} type="button">
              Apply time range
            </button>
            <strong className="grafana-section-title">Recently used absolute ranges</strong>
            <div className="grafana-recent-ranges">
              {dashboardRecentRanges.map((range) => (
                <button
                  key={range.label}
                  onClick={() => {
                    setDraftFrom(range.from);
                    setDraftTo(range.to);
                  }}
                  type="button"
                >
                  {range.label}
                </button>
              ))}
            </div>
            <div className="grafana-time-footer">
              <span>Browser Time IST</span>
              <span>UTC+05:30</span>
              <button type="button">Change time settings</button>
            </div>
          </div>
          <div className="grafana-quick-ranges">
            <label className="grafana-quick-search">
              <Search size={14} />
              <input onChange={(event) => setQuickSearch(event.target.value)} placeholder="Search quick ranges" value={quickSearch} />
            </label>
            <div className="grafana-quick-list">
              {filteredQuickRanges.map((range) => (
                <button
                  className={selectedQuickRange?.label === range.label ? "active" : ""}
                  key={range.label}
                  onClick={() => {
                    setDraftFrom(range.from);
                    setDraftTo(range.to);
                  }}
                  type="button"
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function cleanRangeToken(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function resolveDashboardTimePickerDate(value: string, variant: "from" | "to") {
  const parsed = parseDashboardDateTime(value);
  if (parsed) return parsed;

  const now = new Date();
  const normalized = value.trim().toLowerCase();
  if (normalized === "now") return now;

  const relative = normalized.match(/^now\s*([+-])\s*(\d+)\s*([smhdw])$/);
  if (relative) {
    const sign = relative[1] === "-" ? -1 : 1;
    const amount = Number(relative[2]);
    const unit = relative[3];
    const unitMs: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
      w: 7 * 24 * 60 * 60 * 1000
    };
    return new Date(now.getTime() + sign * amount * unitMs[unit]);
  }

  return variant === "from" ? new Date(now.getTime() - 60 * 60 * 1000) : now;
}

function parseDashboardDateTime(value: string) {
  const text = value.trim();
  const localMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (localMatch) {
    return buildLocalDate(
      Number(localMatch[1]),
      Number(localMatch[2]),
      Number(localMatch[3]),
      Number(localMatch[4]),
      Number(localMatch[5]),
      Number(localMatch[6] || 0)
    );
  }

  const displayMatch = text.match(/^(\d{2})[-/](\d{2})[-/](\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!displayMatch) return null;
  return buildLocalDate(
    Number(displayMatch[3]),
    Number(displayMatch[2]),
    Number(displayMatch[1]),
    Number(displayMatch[4]),
    Number(displayMatch[5]),
    Number(displayMatch[6] || 0)
  );
}

function buildLocalDate(year: number, month: number, day: number, hour: number, minute: number, second: number) {
  const date = new Date(year, month - 1, day, hour, minute, second);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second
  ) {
    return null;
  }
  return date;
}

function toDateTimeLocalInputValue(date: Date | null) {
  if (!date) return "";
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds()
  )}`;
}

function toTimeInputValue(date: Date | null) {
  if (!date) return "";
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatDateTimeFromPicker(value: string) {
  const parsed = parseDashboardDateTime(value);
  return parsed ? formatDateTime(parsed) : "";
}

function formatDateTimeWithPickedTime(currentValue: string, timeValue: string, variant: "from" | "to") {
  const match = timeValue.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return "";
  const date = resolveDashboardTimePickerDate(currentValue, variant);
  date.setHours(Number(match[1]), Number(match[2]), Number(match[3] || 0), 0);
  return formatDateTime(date);
}

function formatDateTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds()
  )}`;
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatOptionalDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return formatDateTime(date);
}
