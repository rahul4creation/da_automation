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
  apiGet,
  apiPost,
  apiPut
} from "./api";

const statusOptions = ["Complete", "Incomplete", "Blocked", "Not applicable"] as const;

type Toast = { type: "success" | "error" | "info"; message: string } | null;

export default function App() {
  const [phaseDefs, setPhaseDefs] = useState<PhaseDefinition[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [activePhaseId, setActivePhaseId] = useState("");
  const [notes, setNotes] = useState("");
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

  async function bootstrap() {
    try {
      const [{ phases }, { projects: loadedProjects }] = await Promise.all([
        apiGet<{ phases: PhaseDefinition[] }>("/api/phases"),
        apiGet<{ projects: ProjectSummary[] }>("/api/projects")
      ]);
      setPhaseDefs(phases);
      setProjects(loadedProjects);
      if (loadedProjects[0]) {
        setSelectedProjectId(loadedProjects[0].projectId);
      }
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
        { notes }
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

  async function uploadFiles(files: FileList | null) {
    if (!project || !activePhase || !files?.length) return;
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));
    try {
      setBusy(true);
      await apiPost(`/api/projects/${project.projectId}/phases/${activePhase.id}/uploads`, formData);
      setToast({ type: "success", message: `${files.length} artifact(s) uploaded` });
      await loadProject(project.projectId);
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
            value={createForm.projectId}
            onChange={(event) => setCreateForm((current) => ({ ...current, projectId: slugify(event.target.value) }))}
            placeholder="project-id"
          />
          <input
            value={createForm.owner}
            onChange={(event) => setCreateForm((current) => ({ ...current, owner: event.target.value }))}
            placeholder="Owner"
          />
          <select
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
            <button
              key={item.projectId}
              className={`project-row ${item.projectId === selectedProjectId ? "active" : ""}`}
              onClick={() => {
                setSelectedProjectId(item.projectId);
                setActivePhaseId("");
              }}
            >
              <span>{item.projectName}</span>
              <small>{item.projectId}</small>
            </button>
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

              <div className="workbench-actions">
                <UploadButton onUpload={uploadFiles} disabled={busy} />
                <button className="secondary-btn" onClick={runAgent} disabled={busy}>
                  {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
                  Run Agent
                </button>
                <button className="primary-btn" onClick={completePhase} disabled={busy}>
                  <CheckCircle2 size={16} />
                  Complete Phase
                </button>
              </div>

              <textarea
                className="notes-input"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Add phase notes, stakeholder input, SQL comments, or instructions for this run"
              />

              <ArtifactStrip phase={activePhase} />

              <GateEditor phase={activePhase} onSave={saveGate} disabled={busy} />

              <section className="output-panel" id="agent-output">
                <div className="section-title">
                  <FileText size={16} />
                  <span>Agent Output</span>
                </div>
                <pre>{activePhase.outputText || "No output yet."}</pre>
              </section>
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
    <section className="gate-panel">
      <div className="gate-heading">
        <div className="section-title">
          <CheckCircle2 size={16} />
          <span>Phase Gates</span>
        </div>
        <button className="secondary-btn" onClick={() => onSave(gate)} disabled={disabled}>
          <Save size={16} />
          Save Gate
        </button>
      </div>
      <GateTable title="Project Context" rows={gate.projectContext} onChange={(index, patch) => updateRow("projectContext", index, patch)} />
      <GateTable title="Entry Gate" rows={gate.entry} onChange={(index, patch) => updateRow("entry", index, patch)} />
      <GateTable title="Exit Gate" rows={gate.exit} onChange={(index, patch) => updateRow("exit", index, patch)} />
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
    <div className="gate-table-block">
      <h4>{title}</h4>
      <div className="gate-table">
        <div className="gate-table-head">
          <span>Item</span>
          <span>Status</span>
          <span>Evidence</span>
          <span>Owner</span>
          <span>Notes</span>
        </div>
        {rows.map((row, index) => (
          <div className="gate-table-row" key={`${title}-${row.item}`}>
            <div>
              <strong>{row.item}</strong>
              <small>{row.requiredCondition}</small>
            </div>
            <select value={row.status} onChange={(event) => onChange(index, { status: event.target.value as GateRow["status"] })}>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <input value={row.evidence} onChange={(event) => onChange(index, { evidence: event.target.value })} />
            <input value={row.owner} onChange={(event) => onChange(index, { owner: event.target.value })} />
            <input value={row.notes} onChange={(event) => onChange(index, { notes: event.target.value })} />
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
  const blockers = [
    ...phase.gate.projectContext,
    ...phase.gate.entry,
    ...phase.gate.exit
  ].filter((row) => row.status === "Incomplete" || row.status === "Blocked").length;

  if (phase.state.status === "completed") return <CheckCircle2 className="gate-dot complete" size={18} />;
  if (blockers > 0) return <AlertTriangle className="gate-dot blocked" size={18} />;
  return <Circle className="gate-dot ready" size={18} />;
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
