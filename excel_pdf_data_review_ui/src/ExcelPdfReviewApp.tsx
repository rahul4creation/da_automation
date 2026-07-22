import {
  AlertTriangle,
  ChevronDown,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Download,
  FileCheck2,
  FileSearch,
  FileSpreadsheet,
  FileText,
  Loader2,
  Play,
  RefreshCw,
  SearchCheck,
  Settings2,
  ShieldCheck,
  UserRound,
  Upload
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { apiGet, apiPost } from "./api";

type ReviewFileKind = "Checklist" | "Excel" | "PDF";
type ReviewStatus = "ready" | "running" | "complete";
type Severity = "high" | "medium" | "low" | "info";

type ReviewFile = {
  id: string;
  name: string;
  path: string;
  kind: ReviewFileKind;
  size: number;
  sourceType: string;
  modifiedAt: string;
  status: "Ready";
  revisionNumber?: number;
  revisionLabel?: string;
};

type CheckOption = {
  id: string;
  label: string;
  area: string;
  enabled: boolean;
};

type Finding = {
  severity: Severity;
  area: string;
  finding: string;
  evidence: string;
  recommendation: string;
};

type AgentConfig = {
  checklistInput: string;
  excelFolder: string;
  pdfFolder: string;
  selectedChecklistPath: string;
  selectedExcelPath: string;
  selectedExcelPaths: string[];
  selectedPdfPath: string;
  selectedPdfPaths: string[];
  projectName: string;
  userName: string;
  compareCount: string;
  pdfIndices: string;
  recursive: boolean;
};

type DiscoveryResult = {
  checklists: ReviewFile[];
  excelFiles: ReviewFile[];
  pdfFiles: ReviewFile[];
  selected: {
    checklistPath: string;
    excelPath: string;
    excelPaths: string[];
    pdfPath: string;
    pdfPaths: string[];
  };
  counts: {
    checklists: number;
    excelFiles: number;
    pdfFiles: number;
  };
};

type AgentRunResult = {
  ok: boolean;
  startedAt?: string;
  completedAt?: string;
  stdout: string;
  stderr: string;
  parsed: Record<string, string>;
  files?: DiscoveryResult;
};

type DefaultsResponse = {
  config: AgentConfig;
  files: DiscoveryResult;
};

const defaultConfig: AgentConfig = {
  checklistInput: "D:\\AIReview\\report-review-input\\excel-pdf-data\\checklist",
  excelFolder: "D:\\AIReview\\report-review-input\\excel-pdf-data\\excel-reports",
  pdfFolder: "D:\\AIReview\\report-review-input\\excel-pdf-data\\pdf-reports",
  selectedChecklistPath: "D:\\AIReview\\report-review-input\\excel-pdf-data\\checklist\\COMMON CHECK LIST.xlsx",
  selectedExcelPath: "",
  selectedExcelPaths: [],
  selectedPdfPath: "",
  selectedPdfPaths: [],
  projectName: "",
  userName: "",
  compareCount: "all",
  pdfIndices: "",
  recursive: false
};

const emptyDiscovery: DiscoveryResult = {
  checklists: [],
  excelFiles: [],
  pdfFiles: [],
  selected: {
    checklistPath: "",
    excelPath: "",
    excelPaths: [],
    pdfPath: "",
    pdfPaths: []
  },
  counts: {
    checklists: 0,
    excelFiles: 0,
    pdfFiles: 0
  }
};

const reviewStages = [
  { number: 1, title: "Ingest Sources", detail: "2 source types ready", state: "active" },
  { number: 2, title: "Extract Data", detail: "Tables and text blocks", state: "ready" },
  { number: 3, title: "Compare Values", detail: "Workbook vs PDF totals", state: "ready" },
  { number: 4, title: "Log Findings", detail: "Severity and evidence", state: "ready" },
  { number: 5, title: "Review Packet", detail: "Summary for approval", state: "ready" }
];

const defaultChecks: CheckOption[] = [
  { id: "schema", label: "Header and schema consistency", area: "Structure", enabled: true },
  { id: "missing-data", label: "Blank, null, and NA values", area: "Completeness", enabled: true },
  { id: "reconciliation", label: "Excel totals against PDF totals", area: "Reconciliation", enabled: true },
  { id: "duplicates", label: "Duplicate IDs and repeated rows", area: "Quality", enabled: true },
  { id: "formats", label: "Date, currency, and percent formats", area: "Formatting", enabled: true },
  { id: "outliers", label: "Outliers and unusual movements", area: "Reasonableness", enabled: false }
];

const evidenceRows = [
  { metric: "Total Records", excel: "18,420", pdf: "18,420", status: "Match" },
  { metric: "Open Exceptions", excel: "126", pdf: "129", status: "Mismatch" },
  { metric: "Resolved Exceptions", excel: "8,314", pdf: "8,314", status: "Match" },
  { metric: "Collection Amount", excel: "12.48M", pdf: "12.47M", status: "Near Match" }
];

export function ExcelPdfReviewSidebar() {
  return (
    <>
      <section className="agent-sidebar-panel">
        <div className="section-title">
          <FileSearch size={16} />
          <span>Agent Intake</span>
        </div>
        <div className="agent-mini-metric">
          <strong>Excel + PDF</strong>
          <span>Data evidence review</span>
        </div>
        <div className="agent-mini-metric">
          <strong>Read-only</strong>
          <span>Local source inspection</span>
        </div>
        <div className="agent-mini-metric">
          <strong>Packet output</strong>
          <span>Findings and reconciliation</span>
        </div>
      </section>

      <section className="agent-sidebar-panel">
        <div className="sidebar-heading">
          <span>Review Queues</span>
          <span className="queue-count">3</span>
        </div>
        <div className="review-queue-list">
          <button className="review-queue-row active" type="button">
            <span>Monthly ops review</span>
            <small>Excel and PDF comparison</small>
          </button>
          <button className="review-queue-row" type="button">
            <span>Invoice packet</span>
            <small>PDF tables and workbook extract</small>
          </button>
          <button className="review-queue-row" type="button">
            <span>Data migration sample</span>
            <small>Workbook profiling</small>
          </button>
        </div>
      </section>
    </>
  );
}

export default function ExcelPdfReviewApp({ username }: { username: string }) {
  const [config, setConfig] = useState<AgentConfig>(defaultConfig);
  const [discovery, setDiscovery] = useState<DiscoveryResult>(emptyDiscovery);
  const [checks, setChecks] = useState<CheckOption[]>(defaultChecks);
  const [owner, setOwner] = useState("Data QA");
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>("ready");
  const [lastRun, setLastRun] = useState("Not run in this session");
  const [loadingInputs, setLoadingInputs] = useState(false);
  const [runResult, setRunResult] = useState<AgentRunResult | null>(null);
  const [runError, setRunError] = useState("");

  const files = useMemo(
    () => [...discovery.checklists, ...discovery.excelFiles, ...discovery.pdfFiles],
    [discovery]
  );
  const activeChecks = checks.filter((check) => check.enabled);
  const findings = useMemo(() => buildFindings(checks, files), [checks, files]);
  const highFindings = findings.filter((finding) => finding.severity === "high").length;
  const mismatchCount = evidenceRows.filter((row) => row.status === "Mismatch").length;
  const matchCount = evidenceRows.filter((row) => row.status === "Match").length;
  const excelCount = discovery.counts.excelFiles;
  const pdfCount = discovery.counts.pdfFiles;
  const checklistCount = discovery.counts.checklists;
  const readiness =
    Boolean(config.projectName.trim()) &&
    Boolean(config.selectedChecklistPath) &&
    config.selectedExcelPaths.length > 0 &&
    config.selectedPdfPaths.length > 0;
  const reportText = buildReportText({
    owner,
    config,
    files,
    checks: activeChecks,
    findings,
    lastRun,
    runResult,
    runError
  });

  useEffect(() => {
    void loadDefaults();
  }, []);

  async function loadDefaults() {
    try {
      setLoadingInputs(true);
      const result = await apiGet<DefaultsResponse>("/api/excel-pdf-data/defaults");
      setConfig((current) => ({
        ...current,
        ...result.config,
        selectedChecklistPath: result.files.selected.checklistPath || result.config.selectedChecklistPath,
        selectedExcelPath: result.files.selected.excelPath || result.config.selectedExcelPath,
        selectedExcelPaths: result.files.selected.excelPaths || result.config.selectedExcelPaths,
        selectedPdfPath: result.files.selected.pdfPath || result.config.selectedPdfPath,
        selectedPdfPaths: result.files.selected.pdfPaths || result.config.selectedPdfPaths,
        projectName: current.projectName,
        userName: username
      }));
      setDiscovery(result.files);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Could not load Excel/PDF agent defaults.");
    } finally {
      setLoadingInputs(false);
    }
  }

  async function refreshFiles() {
    try {
      setLoadingInputs(true);
      const result = await apiPost<DefaultsResponse>("/api/excel-pdf-data/discover", config);
      setConfig((current) => ({
        ...current,
        ...result.config,
        selectedChecklistPath: result.files.selected.checklistPath,
        selectedExcelPath: result.files.selected.excelPath,
        selectedExcelPaths: result.files.selected.excelPaths,
        selectedPdfPath: result.files.selected.pdfPath,
        selectedPdfPaths: result.files.selected.pdfPaths,
        projectName: current.projectName,
        userName: username
      }));
      setDiscovery(result.files);
      setRunError("");
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Could not discover source files.");
    } finally {
      setLoadingInputs(false);
    }
  }

  function toggleCheck(checkId: string) {
    setChecks((current) => current.map((check) => (check.id === checkId ? { ...check, enabled: !check.enabled } : check)));
  }

  function updateConfig(patch: Partial<AgentConfig>) {
    setConfig((current) => ({ ...current, ...patch }));
    setRunResult(null);
  }

  function toggleExcelSelection(pathValue: string) {
    setConfig((current) => {
      const allPaths = discovery.excelFiles.map((file) => file.path);
      const selected = togglePath(current.selectedExcelPaths, pathValue, allPaths);
      return {
        ...current,
        selectedExcelPaths: selected,
        selectedExcelPath: selected[0] || ""
      };
    });
    setRunResult(null);
  }

  function togglePdfSelection(pathValue: string) {
    setConfig((current) => {
      const allPaths = discovery.pdfFiles.map((file) => file.path);
      const selected = togglePath(current.selectedPdfPaths, pathValue, allPaths);
      return {
        ...current,
        selectedPdfPaths: selected,
        selectedPdfPath: selected[0] || ""
      };
    });
    setRunResult(null);
  }

  async function runReview() {
    if (!readiness || reviewStatus === "running") return;
    setReviewStatus("running");
    setRunError("");
    setRunResult(null);
    try {
      const result = await apiPost<AgentRunResult>("/api/excel-pdf-data/run", { ...config, userName: username });
      setRunResult(result);
      if (result.files) setDiscovery(result.files);
      setReviewStatus("complete");
      setLastRun(formatTimestamp(new Date(result.completedAt || Date.now())));
    } catch (error) {
      setReviewStatus("ready");
      setRunError(error instanceof Error ? error.message : "Excel/PDF data review failed.");
    }
  }

  return (
    <>
      <header className="topbar">
        <div>
          <span className="eyebrow">excel_pdf_data review agent</span>
          <h2>Excel and PDF Data Review</h2>
        </div>
        <div className="topbar-meta">
          <StatusBadge status={reviewStatus} />
          <span className="signed-in-user">
            <UserRound size={15} />
            {username}
          </span>
          <span>{owner}</span>
        </div>
      </header>

      <div className="review-grid">
        <section className="review-stage-rail">
          <div className="section-title">
            <CircleIcon />
            <span>Review Stages</span>
          </div>
          <div className="review-stage-list">
            {reviewStages.map((stage) => (
              <button className={`review-stage-row ${stage.state}`} key={stage.number} type="button">
                <span className="phase-index">{stage.number}</span>
                <span>
                  {stage.title}
                  <small>{stage.detail}</small>
                </span>
                {stage.state === "active" ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
              </button>
            ))}
          </div>
        </section>

        <section className="review-workbench">
          <section className="review-command-panel">
            <div className="review-command-copy">
              <span className="eyebrow">Current packet</span>
              <h3>{config.projectName.trim() || "Project name required"}</h3>
              <p>
                Select one checklist, one Excel design report, and one exported PDF report for validation.
              </p>
            </div>
            <div className="review-command-actions">
              <div className="step-path">
                <span className="step-chip done">
                  <CheckCircle2 size={14} />
                  Sources
                </span>
                <span className="step-chip active">
                  <SearchCheck size={14} />
                  Review
                </span>
                <span className={reviewStatus === "complete" ? "step-chip done" : "step-chip"}>
                  <ClipboardCheck size={14} />
                  Findings
                </span>
                <span className={reviewStatus === "complete" ? "step-chip done" : "step-chip"}>
                  <FileCheck2 size={14} />
                  Packet
                </span>
              </div>
              <button className="primary-btn" onClick={runReview} disabled={!readiness || loadingInputs || reviewStatus === "running"}>
                {reviewStatus === "running" ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
                Run Review
              </button>
            </div>
          </section>

          <div className="review-summary-grid">
            <ReviewMetric icon={<FileCheck2 size={18} />} label="Checklists" value={checklistCount} tone="neutral" />
            <ReviewMetric icon={<FileSpreadsheet size={18} />} label="Excel files" value={excelCount} tone="good" />
            <ReviewMetric icon={<FileText size={18} />} label="PDF files" value={pdfCount} tone="neutral" />
            <ReviewMetric icon={<AlertTriangle size={18} />} label="High findings" value={highFindings} tone="bad" />
          </div>

          <div className="review-main-grid">
            <section className="review-panel source-panel">
              <div className="input-panel-header">
                <div>
                  <div className="section-title">
                    <Upload size={16} />
                    <span>Source Files</span>
                  </div>
                  <p>Files discovered from the checklist, Excel design, and exported PDF folders.</p>
                </div>
                <div className="workbench-actions">
                  <button className="secondary-btn" onClick={refreshFiles} disabled={loadingInputs || reviewStatus === "running"}>
                    {loadingInputs ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
                    Refresh Files
                  </button>
                </div>
              </div>
              <div className="review-file-list">
                {files.map((file) => (
                  <div className="review-file-row" key={file.path} title={file.path}>
                    {file.kind === "PDF" ? <FileText size={17} /> : file.kind === "Checklist" ? <FileCheck2 size={17} /> : <FileSpreadsheet size={17} />}
                    <span>
                      {file.name}
                      <small>{file.kind} | {file.sourceType} | {formatBytes(file.size)}</small>
                    </span>
                    <strong>{file.status}</strong>
                  </div>
                ))}
                {files.length === 0 && <div className="empty-note">No checklist, Excel, or PDF files found for the configured paths.</div>}
              </div>
            </section>

            <section className="review-panel">
              <div className="section-title">
                <Settings2 size={16} />
                <span>Agent Inputs</span>
              </div>
              <div className="scope-form-grid">
                <label className="path-field">
                  <span>Project Name</span>
                  <input
                    value={config.projectName}
                    onChange={(event) => updateConfig({ projectName: event.target.value })}
                    placeholder="Example: Analog parameter validation"
                  />
                </label>
                <label className="path-field">
                  <span>Checklist Selection</span>
                  <select
                    value={config.selectedChecklistPath}
                    onChange={(event) => updateConfig({ selectedChecklistPath: event.target.value })}
                  >
                    {discovery.checklists.map((file) => (
                      <option key={file.path} value={file.path}>
                        {file.name} ({file.revisionLabel || `Rev ${file.revisionNumber || 1}`})
                      </option>
                    ))}
                  </select>
                  <small>{config.checklistInput}</small>
                </label>
                <div className="path-field form-field">
                  <span>Excel Report Selection</span>
                  <MultiFileSelection
                    allLabel="All Excel Reports"
                    files={discovery.excelFiles}
                    selectedPaths={config.selectedExcelPaths}
                    onToggle={toggleExcelSelection}
                  />
                  <small>{config.excelFolder}</small>
                </div>
                <div className="path-field form-field">
                  <span>PDF Report File Selection</span>
                  <MultiFileSelection
                    allLabel="All PDF Reports"
                    files={discovery.pdfFiles}
                    selectedPaths={config.selectedPdfPaths}
                    onToggle={togglePdfSelection}
                  />
                  <small>{config.pdfFolder}</small>
                </div>
                <button className="primary-btn agent-input-run" onClick={runReview} disabled={!readiness || loadingInputs || reviewStatus === "running"}>
                  {reviewStatus === "running" ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
                  Run Review
                </button>
              </div>
            </section>
          </div>

          <section className="review-panel">
            <div className="section-title">
              <ShieldCheck size={16} />
              <span>Quality Checks</span>
            </div>
            <div className="check-grid">
              {checks.map((check) => (
                <label className={`check-row ${check.enabled ? "enabled" : ""}`} key={check.id}>
                  <input checked={check.enabled} type="checkbox" onChange={() => toggleCheck(check.id)} />
                  <span>
                    {check.label}
                    <small>{check.area}</small>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <div className="review-main-grid">
            <section className="review-panel">
              <div className="review-panel-header">
                <div className="section-title">
                  <AlertTriangle size={16} />
                  <span>Findings</span>
                </div>
                <span className="gate-count-pill">{findings.length} open</span>
              </div>
              <div className="finding-list">
                {findings.map((finding) => (
                  <article className={`finding-row ${finding.severity}`} key={`${finding.area}-${finding.finding}`}>
                    <strong>{finding.area}</strong>
                    <span>{finding.finding}</span>
                    <small>{finding.evidence}</small>
                    <em>{finding.recommendation}</em>
                  </article>
                ))}
              </div>
            </section>

            <section className="review-panel">
              <div className="section-title">
                <Database size={16} />
                <span>Reconciliation Evidence</span>
              </div>
              <div className="evidence-table">
                <div className="evidence-row heading">
                  <span>Metric</span>
                  <span>Excel</span>
                  <span>PDF</span>
                  <span>Status</span>
                </div>
                {evidenceRows.map((row) => (
                  <div className={`evidence-row ${statusClass(row.status)}`} key={row.metric}>
                    <span>{row.metric}</span>
                    <span>{row.excel}</span>
                    <span>{row.pdf}</span>
                    <strong>{row.status}</strong>
                  </div>
                ))}
              </div>
              <div className="reconcile-footer">
                <ReviewMetric icon={<CheckCircle2 size={17} />} label="Matches" value={matchCount} tone="good" />
                <ReviewMetric icon={<AlertTriangle size={17} />} label="Mismatches" value={mismatchCount} tone="warn" />
              </div>
            </section>
          </div>

          <section className="output-panel review-output-panel">
            <div className="review-panel-header">
              <div className="section-title">
                <FileCheck2 size={16} />
                <span>Review Packet</span>
              </div>
              <button className="secondary-btn" type="button">
                <Download size={16} />
                Export
              </button>
            </div>
            <pre>{reportText}</pre>
          </section>
        </section>
      </div>
    </>
  );
}

function MultiFileSelection({
  allLabel,
  files,
  selectedPaths,
  onToggle
}: {
  allLabel: string;
  files: ReviewFile[];
  selectedPaths: string[];
  onToggle: (pathValue: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const allSelected = files.length > 0 && selectedPaths.length === files.length;
  const availablePaths = new Set(files.map((file) => file.path));
  const selectedCount = selectedPaths.filter((pathValue) => availablePaths.has(pathValue)).length;
  const triggerLabel = files.length === 0 ? "No files found" : allSelected ? allLabel : selectedCount > 0 ? `${selectedCount} reports selected` : "Select reports";
  const triggerMeta = files.length === 0 ? "0 files" : `${selectedCount} of ${files.length} selected`;

  useEffect(() => {
    if (!open) return;

    function closeWhenOutside(event: MouseEvent | TouchEvent) {
      if (dropdownRef.current && event.target instanceof Node && !dropdownRef.current.contains(event.target)) {
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
    <div className={`multi-file-dropdown ${open ? "open" : ""}`} ref={dropdownRef}>
      <button
        aria-expanded={open}
        className={`multi-file-trigger ${allSelected ? "selected" : ""}`}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span>
          {triggerLabel}
          <small>{triggerMeta}</small>
        </span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="multi-file-menu">
          <label className={`multi-file-option all ${allSelected ? "selected" : ""}`}>
            <input checked={allSelected} disabled={files.length === 0} type="checkbox" onChange={() => onToggle("__all__")} />
            <span>{allLabel}</span>
          </label>
          {files.map((file) => (
            <label className={`multi-file-option ${selectedPaths.includes(file.path) ? "selected" : ""}`} key={file.path}>
              <input checked={selectedPaths.includes(file.path)} type="checkbox" onChange={() => onToggle(file.path)} />
              <span>{file.name}</span>
            </label>
          ))}
          {files.length === 0 && <div className="empty-note">No files found.</div>}
        </div>
      )}
    </div>
  );
}

function ReviewMetric({
  icon,
  label,
  value,
  tone
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: "good" | "warn" | "bad" | "neutral";
}) {
  return (
    <div className={`review-metric ${tone}`}>
      {icon}
      <span>
        <strong>{value}</strong>
        <small>{label}</small>
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  const label = status === "ready" ? "Ready" : status === "running" ? "Running" : "Complete";
  return <span className={`status-pill ${status}`}>{label}</span>;
}

function CircleIcon() {
  return <span className="circle-icon" aria-hidden="true" />;
}

function buildFindings(checks: CheckOption[], files: ReviewFile[]): Finding[] {
  const enabled = new Set(checks.filter((check) => check.enabled).map((check) => check.id));
  const hasExcel = files.some((file) => file.kind === "Excel");
  const hasPdf = files.some((file) => file.kind === "PDF");
  const findings: Finding[] = [];

  if (!hasExcel || !hasPdf) {
    findings.push({
      severity: "high",
      area: "Source Coverage",
      finding: "Excel or PDF side is missing from the packet.",
      evidence: `${hasExcel ? "Excel present" : "Excel missing"}; ${hasPdf ? "PDF present" : "PDF missing"}.`,
      recommendation: "Add both the structured data file and the rendered report before strict reconciliation."
    });
  }

  if (enabled.has("reconciliation")) {
    findings.push({
      severity: "high",
      area: "Reconciliation",
      finding: "Open exception count differs between workbook and PDF.",
      evidence: "Excel shows 126 open exceptions, PDF shows 129.",
      recommendation: "Confirm extraction date and exception status filter before approval."
    });
  }

  if (enabled.has("missing-data")) {
    findings.push({
      severity: "medium",
      area: "Completeness",
      finding: "Three required cells are blank in the source workbook.",
      evidence: "Region, owner, and close_reason have blank values in sampled rows.",
      recommendation: "Backfill required fields or document accepted blanks."
    });
  }

  if (enabled.has("formats")) {
    findings.push({
      severity: "medium",
      area: "Formatting",
      finding: "Currency formatting is inconsistent across two sheets.",
      evidence: "Summary uses millions, detail uses raw amount values.",
      recommendation: "Normalize display units before comparing PDF totals."
    });
  }

  if (enabled.has("duplicates")) {
    findings.push({
      severity: "low",
      area: "Quality",
      finding: "Two duplicate reference IDs appear in non-critical rows.",
      evidence: "Duplicate IDs repeat with identical values.",
      recommendation: "Deduplicate during extract staging or mark duplicate rows as informational."
    });
  }

  if (enabled.has("schema")) {
    findings.push({
      severity: "info",
      area: "Structure",
      finding: "Workbook headers align with the expected review template.",
      evidence: "All required columns were found in the primary sheet.",
      recommendation: "Keep template version recorded in the review packet."
    });
  }

  return findings;
}

function buildReportText({
  owner,
  config,
  files,
  checks,
  findings,
  lastRun,
  runResult,
  runError
}: {
  owner: string;
  config: AgentConfig;
  files: ReviewFile[];
  checks: CheckOption[];
  findings: Finding[];
  lastRun: string;
  runResult: AgentRunResult | null;
  runError: string;
}) {
  if (runResult?.stdout) {
    const outputPaths = Object.entries(runResult.parsed || {})
      .filter(([key]) => key.toLowerCase().includes("path") || key.toLowerCase().includes("folder"))
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n");
    return `# ${config.projectName || "Excel/PDF data review"}

Project Name: ${config.projectName || "-"}
User Name: ${config.userName || "-"}
Selected Checklist: ${selectedFileName(files, config.selectedChecklistPath)}
Selected Excel Report(s): ${selectedFileNames(files, config.selectedExcelPaths)}
Selected PDF Report(s): ${selectedFileNames(files, config.selectedPdfPaths)}

## Agent Output
${runResult.stdout.trim()}

${runResult.stderr ? `\n## stderr\n${runResult.stderr.trim()}\n` : ""}
${outputPaths ? `\n## Parsed Output Paths\n${outputPaths}` : ""}`;
  }

  if (runError) {
    return `# Excel/PDF data review could not run

${runError}

Check that the backend server is running and that the configured checklist, Excel, and PDF paths exist.`;
  }

  const fileLines = files.map((file) => `- ${file.name} (${file.kind}, ${formatBytes(file.size)})`).join("\n");
  const checkLines = checks.map((check) => `- ${check.label} [${check.area}]`).join("\n");
  const findingLines = findings
    .map((finding) => `- ${finding.severity.toUpperCase()}: ${finding.area} - ${finding.finding}`)
    .join("\n");

  return `# ${config.projectName || "Excel/PDF data review"}

Owner: ${owner}
User: ${config.userName || "-"}
Last run: ${lastRun}

## Agent Inputs
- Checklist workbook/folder: ${config.checklistInput}
- Excel design folder: ${config.excelFolder}
- Exported PDF report folder: ${config.pdfFolder}
- Selected checklist: ${selectedFileName(files, config.selectedChecklistPath)}
- Selected Excel report(s): ${selectedFileNames(files, config.selectedExcelPaths)}
- Selected PDF report(s): ${selectedFileNames(files, config.selectedPdfPaths)}
- Project output folder: report-review-finding/excel-pdf-data/${slugPreview(config.projectName || "excel-pdf-data-review")}

## Sources
${fileLines || "- No source files loaded."}

## Active Checks
${checkLines || "- No checks selected."}

## Findings
${findingLines || "- No findings recorded."}

## Recommendation
Resolve high severity reconciliation differences before sign-off. Medium and low findings can proceed only with owner notes and evidence.`;
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function selectedFileName(files: ReviewFile[], selectedPath: string) {
  return files.find((file) => file.path === selectedPath)?.name || selectedPath || "-";
}

function selectedFileNames(files: ReviewFile[], selectedPaths: string[]) {
  return selectedPaths.map((selectedPath) => selectedFileName(files, selectedPath)).join(", ") || "-";
}

function togglePath(current: string[], pathValue: string, allPaths: string[]) {
  if (pathValue === "__all__") {
    return current.length === allPaths.length ? [] : allPaths;
  }
  return current.includes(pathValue) ? current.filter((item) => item !== pathValue) : [...current, pathValue];
}

function slugPreview(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 63);
}

function formatTimestamp(value: Date) {
  return value.toLocaleString(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function statusClass(status: string) {
  return status.toLowerCase().replace(/\s+/g, "-");
}
