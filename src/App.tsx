import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  FileText,
  FolderPlus,
  Loader2,
  Play,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  GateRow,
  GateState,
  Phase,
  PhaseDefinition,
  ProjectDetail,
  ProjectSummary,
  apiDelete,
  apiGet,
  apiPost,
  apiPut
} from "./api";

const statusOptions = ["Complete", "Incomplete", "Blocked", "Not applicable"] as const;

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
    userAction: "Review requirement coverage, SQL logic, UX/report behavior, governance, and open issues.",
    uploads: "Screenshots, exports, SQL draft, build notes, review comments, or comparison reports.",
    output: "Review summary, coverage matrix, severity-based findings, and correction plan.",
    gateFocus: "Critical and high findings must be fixed or formally accepted before testing."
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
  const [phaseDefs, setPhaseDefs] = useState<PhaseDefinition[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [activePhaseId, setActivePhaseId] = useState("");
  const [notes, setNotes] = useState("");
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [createForm, setCreateForm] = useState({
    projectName: "",
    projectId: "",
    owner: "",
    targetPlatform: ""
  });

  const activePhase = useMemo(
    () => project?.phases.find((phase) => phase.id === activePhaseId) || project?.phases[0] || null,
    [project, activePhaseId]
  );

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    void loadProject(selectedProjectId);
  }, [selectedProjectId]);

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

  async function bootstrap() {
    try {
      const [{ phases }, { projects: loadedProjects }] = await Promise.all([
        apiGet<{ phases: PhaseDefinition[] }>("/api/phases"),
        apiGet<{ projects: ProjectSummary[] }>("/api/projects")
      ]);
      setPhaseDefs(phases);
      setProjects(loadedProjects);
    } catch (error) {
      showError(error);
    }
  }

  async function refreshProjects() {
    const { projects: loadedProjects } = await apiGet<{ projects: ProjectSummary[] }>("/api/projects");
    setProjects(loadedProjects);
  }

  async function loadProject(projectId: string) {
    try {
      const { project: loadedProject } = await apiGet<{ project: ProjectDetail }>(`/api/projects/${projectId}`);
      setProject(loadedProject);
      setActivePhaseId((current) => current || loadedProject.currentPhaseId || loadedProject.phases[0]?.id || "");
    } catch (error) {
      showError(error);
    }
  }

  async function createProject() {
    try {
      setBusy(true);
      const { project: created } = await apiPost<{ project: ProjectDetail }>("/api/projects", createForm);
      setCreateForm({ projectName: "", projectId: "", owner: "", targetPlatform: "" });
      await refreshProjects();
      setProject(created);
      setSelectedProjectId(created.projectId);
      setActivePhaseId(created.currentPhaseId);
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
        { notes, questionAnswers }
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
      await apiPut(`/api/projects/${project.projectId}/phases/${activePhase.id}/gate`, { gate });
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
      await apiPut(`/api/projects/${project.projectId}/phases/${activePhase.id}/questions`, { questionAnswers });
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
      await apiPut(`/api/projects/${project.projectId}/phases/${activePhase.id}/questions`, { questionAnswers });
      await apiPost(`/api/projects/${project.projectId}/phases/${activePhase.id}/run`, {
        notes,
        questionAnswers
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
        `/api/projects/${project.projectId}/phases/${activePhase.id}/complete`
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

  async function moveProjectToTrash(item: ProjectSummary) {
    const confirmed = window.confirm(
      `Move "${item.projectName}" to trash?\n\nThe project will be removed from the active list, but the files will stay under projects/_trash.`
    );
    if (!confirmed) return;

    try {
      setBusy(true);
      const result = await apiDelete<{ trashPath: string }>(`/api/projects/${item.projectId}`);
      if (selectedProjectId === item.projectId) {
        setSelectedProjectId("");
        setProject(null);
        setActivePhaseId("");
        setNotes("");
        setQuestionAnswers({});
      }
      await refreshProjects();
      setToast({ type: "success", message: `${item.projectName} moved to trash: ${result.trashPath}` });
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function uploadFiles(files: FileList | null) {
    if (!project || !activePhase || !files?.length) return;
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));
    try {
      setBusy(true);
      await apiPost(`/api/projects/${project.projectId}/phases/${activePhase.id}/uploads`, formData);
      setToast({ type: "info", message: `${files.length} artifact(s) uploaded. Running agent...` });
      await apiPost(`/api/projects/${project.projectId}/phases/${activePhase.id}/run`, {
        notes: notes || "Analyze newly uploaded artifact(s).",
        questionAnswers
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
            placeholder="project-id"
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
        <div className="project-list">
          {projects.map((item) => (
            <div className="project-row-shell" key={item.projectId}>
              <button
                className={`project-row ${item.projectId === selectedProjectId ? "active" : ""}`}
                onClick={() => {
                  setSelectedProjectId(item.projectId);
                  setActivePhaseId("");
                }}
              >
                <span>{item.projectName}</span>
                <small>{item.projectId}</small>
              </button>
              <button
                className="icon-btn danger-icon"
                onClick={() => void moveProjectToTrash(item)}
                disabled={busy}
                title={`Move ${item.projectName} to trash`}
                aria-label={`Move ${item.projectName} to trash`}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
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
            <section className="phase-rail">
              <div className="section-title">
                <Circle size={16} />
                <span>Phases</span>
              </div>
              <div className="phase-list">
                {project.phases.map((phase) => (
                  <button
                    key={phase.id}
                    className={`phase-row ${phase.id === activePhase.id ? "active" : ""}`}
                    onClick={() => setActivePhaseId(phase.id)}
                  >
                    <span className="phase-index">{phase.number}</span>
                    <span>
                      {phase.title}
                      <small>{phase.state.status}</small>
                    </span>
                    <GateDot phase={phase} />
                  </button>
                ))}
              </div>
            </section>

            <section className="phase-workbench">
              <PhaseHeader phase={activePhase} project={project} />
              <NextStepPanel
                phase={activePhase}
                notes={notes}
                answeredQuestions={countAnsweredQuestions(activePhase.id, questionAnswers)}
                busy={busy}
                onGoToInputs={() => scrollToSection("phase-questions")}
                onRun={runAgent}
                onReviewGates={openGateChecklist}
                onComplete={completePhase}
              />
              <QuestionnairePanel
                phase={activePhase}
                answers={questionAnswers}
                onChange={setQuestionAnswers}
                onSave={saveQuestionAnswers}
                onGenerate={generateArtifactFromQuestions}
                disabled={busy}
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
                <pre>{activePhase.outputText || "No output yet."}</pre>
              </section>

              <GateEditor phase={activePhase} onSave={saveGate} disabled={busy} />
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
      detail: "Answer the guided questions, upload an artifact, or add short notes for the agent.",
      action: "Answer questions",
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
  const answered = countAnsweredQuestions(phase.id, answers);
  const requiredQuestions = questions.filter((question) => question.required);
  const requiredAnswered = requiredQuestions.filter((question) => answers[question.id]?.trim()).length;

  function updateAnswer(questionId: string, value: string) {
    onChange({ ...answers, [questionId]: value });
  }

  return (
    <section className="question-panel" id="phase-questions">
      <div className="question-header">
        <div>
          <div className="section-title">
            <FileText size={16} />
            <span>Guided Questions</span>
          </div>
          <p>
            {answered} of {questions.length} answered
            {requiredQuestions.length > 0 ? `, ${requiredAnswered} of ${requiredQuestions.length} required` : ""}
          </p>
        </div>
        <div className="workbench-actions">
          <button className="secondary-btn" onClick={onSave} disabled={disabled}>
            <Save size={16} />
            Save Answers
          </button>
          <button className="primary-btn" onClick={onGenerate} disabled={disabled || answered === 0}>
            {disabled ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
            Generate Artifact
          </button>
        </div>
      </div>

      <div className="question-grid">
        {questions.map((question) => (
          <label className="question-field" key={question.id}>
            <span>
              {question.label}
              {question.required ? <strong>Required</strong> : null}
            </span>
            <small>{question.help}</small>
            <textarea
              aria-label={question.label}
              value={answers[question.id] || ""}
              onChange={(event) => updateAnswer(question.id, event.target.value)}
              placeholder={question.placeholder}
            />
          </label>
        ))}
      </div>
    </section>
  );
}

function PhaseHeader({ phase, project }: { phase: Phase; project: ProjectDetail }) {
  return (
    <section className="phase-header">
      <div>
        <span className="eyebrow">Phase {phase.number}</span>
        <h3>{phase.title}</h3>
        <p>{phase.artifactPath}</p>
      </div>
      <div className="phase-status-stack">
        <StatusPill status={phase.state.status} />
        <span>{phase.state.gateRecommendation || "Gate TBD"}</span>
        <small>{project.owner || "Owner TBD"}</small>
      </div>
    </section>
  );
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
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
