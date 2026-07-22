import {
  AlertTriangle,
  ChevronDown,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Download,
  Eye,
  FileCheck2,
  FolderOpen,
  FileSearch,
  FileSpreadsheet,
  FileText,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  SearchCheck,
  Settings2,
  ShieldCheck,
  UserRound,
  Upload,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { apiGet, apiPost } from "./api";

type ReviewFileKind = "Checklist" | "Excel" | "PDF";
type ReviewStatus = "ready" | "running" | "complete";
type Severity = "high" | "medium" | "low" | "info";
type ReviewPriority = "critical" | "data" | "medium" | "low";

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
  revisionMajor?: number;
  revisionMinor?: number;
};

type CheckOption = {
  id: string;
  label: string;
  area: string;
  enabled: boolean;
};

type Finding = {
  checkId?: string;
  severity: Severity;
  area: string;
  finding: string;
  evidence: string;
  recommendation: string;
};

type EvidenceRow = {
  metric: string;
  excel: string;
  pdf: string;
  status: string;
};

type ReviewDateRange = {
  status: string;
  display: string;
  reports: Array<{
    report: string;
    pdfFile: string;
    periodType: string;
    from: string;
    to: string;
    display: string;
    validationDate: string;
    bucketStart: string;
    bucketEnd: string;
    intervalMinutes: number | null;
    missingBucketCount: number;
  }>;
  crossPdf: {
    selectedPdfCount: number;
    pairCount: number;
    matchCount: number;
    mismatchCount: number;
    insufficientContextPairCount: number;
  };
};

type ReviewQualityCheck = {
  id: string;
  label: string;
  area: string;
  status: string;
  ok: number;
  notOk: number;
  na: number;
  detail: string;
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
  projectArtifacts?: {
    projectOutputFolder: string;
    projectJsonPath: string;
    projectMarkdownPath: string;
    projectTextPath: string;
    copiedArtifacts: Record<string, string>;
    summaryPath: string;
  };
};

type DefaultsResponse = {
  config: AgentConfig;
  files: DiscoveryResult;
};

type ChecklistSheetInfo = {
  name: string;
  maxRow: number;
  maxColumn: number;
  headerRow: number;
  serialColumn: number;
  pointColumn: number;
  pointCount: number;
};

type ChecklistSheetsResponse = {
  sheets: ChecklistSheetInfo[];
};

type ChecklistGridRow = {
  rowNumber: number;
  values: string[];
};

type ChecklistSheetGridResponse = {
  sheetName: string;
  headerRow: number;
  firstDataRow: number;
  maxColumn: number;
  serialColumn: number;
  pointColumn: number;
  columns: string[];
  rows: ChecklistGridRow[];
};

type ChecklistRevisionResponse = {
  ok: boolean;
  revisionLabel: string;
  createdFile: ReviewFile;
  saved: {
    savedPath: string;
    sheetName: string;
    addedCount?: number;
    updatedCount?: number;
  };
  files: DiscoveryResult;
};

type RepositoryFile = {
  name: string;
  path: string;
  folder: string;
  extension: string;
  artifactType: string;
  size: number;
  modifiedAt: string;
  canView: boolean;
  canDownload: boolean;
};

type RepositoryResponse = {
  projectName: string;
  projectSlug: string;
  folder: string;
  exists: boolean;
  files: RepositoryFile[];
};

type PreviewFile = {
  name: string;
  path: string;
  extension: string;
  content: string;
};

type ReviewSummary = {
  sourcePath: string;
  projectName: string;
  reviewerName: string;
  generatedAt: string;
  dateRange?: ReviewDateRange;
  qualityChecks: ReviewQualityCheck[];
  findings: Finding[];
  evidenceRows: EvidenceRow[];
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
  { number: 1, title: "Ingest Sources", detail: "2 source types ready", targetId: "agent-inputs" },
  { number: 2, title: "Extract Data", detail: "Tables and text blocks", targetId: "quality-checks" },
  { number: 3, title: "Compare Values", detail: "Workbook vs PDF totals", targetId: "reconciliation-evidence" },
  { number: 4, title: "Log Findings", detail: "Severity and evidence", targetId: "review-findings" },
  { number: 5, title: "Review Packet", detail: "Summary for approval", targetId: "review-repository" }
];

const defaultChecks: CheckOption[] = [
  { id: "schema", label: "Header and schema consistency", area: "Structure", enabled: true },
  { id: "missing-data", label: "Blank, null, and NA values", area: "Completeness", enabled: true },
  { id: "reconciliation", label: "Excel totals against PDF totals", area: "Reconciliation", enabled: true },
  { id: "duplicates", label: "Duplicate IDs and repeated rows", area: "Quality", enabled: true },
  { id: "formats", label: "Date, currency, and percent formats", area: "Formatting", enabled: true },
  { id: "outliers", label: "Outliers and unusual movements", area: "Reasonableness", enabled: false }
];

const defaultEvidenceRows: EvidenceRow[] = [
  { metric: "Total Records", excel: "18,420", pdf: "18,420", status: "Match" },
  { metric: "Open Exceptions", excel: "126", pdf: "129", status: "Mismatch" },
  { metric: "Resolved Exceptions", excel: "8,314", pdf: "8,314", status: "Match" },
  { metric: "Collection Amount", excel: "12.48M", pdf: "12.47M", status: "Near Match" }
];

const latestChecklistPreferenceKey = "da-review-ai-ui-auto-latest-checklist";

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

type ExcelPdfReviewAppProps = {
  username: string;
  defaultProjectName?: string;
  embedded?: boolean;
};

export default function ExcelPdfReviewApp({ username, defaultProjectName = "", embedded = false }: ExcelPdfReviewAppProps) {
  const [config, setConfig] = useState<AgentConfig>(() => ({
    ...defaultConfig,
    projectName: defaultProjectName,
    userName: username
  }));
  const [discovery, setDiscovery] = useState<DiscoveryResult>(emptyDiscovery);
  const [checks, setChecks] = useState<CheckOption[]>(defaultChecks);
  const [owner, setOwner] = useState("Data QA");
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>("ready");
  const [lastRun, setLastRun] = useState("Not run in this session");
  const [loadingInputs, setLoadingInputs] = useState(false);
  const [runResult, setRunResult] = useState<AgentRunResult | null>(null);
  const [runError, setRunError] = useState("");
  const [repository, setRepository] = useState<RepositoryResponse | null>(null);
  const [repositoryLoading, setRepositoryLoading] = useState(false);
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null);
  const [summaryToggles, setSummaryToggles] = useState<Record<string, boolean>>({});
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);
  const [previewLoadingPath, setPreviewLoadingPath] = useState("");
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [activeReviewStage, setActiveReviewStage] = useState(reviewStages[0].number);
  const [openEvidenceRows, setOpenEvidenceRows] = useState<Record<string, boolean>>({});
  const [checklistSheets, setChecklistSheets] = useState<ChecklistSheetInfo[]>([]);
  const [selectedChecklistSheet, setSelectedChecklistSheet] = useState("");
  const [checklistGrid, setChecklistGrid] = useState<ChecklistSheetGridResponse | null>(null);
  const [loadingChecklistGrid, setLoadingChecklistGrid] = useState(false);
  const [savingChecklistRevision, setSavingChecklistRevision] = useState(false);
  const [checklistRevisionStatus, setChecklistRevisionStatus] = useState("");
  const [autoSelectLatestChecklist, setAutoSelectLatestChecklist] = useState(() => {
    return localStorage.getItem(latestChecklistPreferenceKey) !== "false";
  });

  const files = useMemo(
    () => [...discovery.checklists, ...discovery.excelFiles, ...discovery.pdfFiles],
    [discovery]
  );
  const displayedChecks = useMemo<CheckOption[]>(() => {
    if (!reviewSummary?.qualityChecks?.length) return checks;
    return reviewSummary.qualityChecks.map((check) => ({
      id: check.id,
      label: check.label,
      area: `${check.area} | ${check.detail}`,
      enabled: summaryToggles[check.id] ?? true
    }));
  }, [checks, reviewSummary, summaryToggles]);
  const activeChecks = displayedChecks.filter((check) => check.enabled);
  const activeCheckIds = useMemo(() => new Set(activeChecks.map((check) => check.id)), [activeChecks]);
  const findings = useMemo(
    () =>
      reviewSummary?.findings?.length
        ? reviewSummary.findings.filter((finding) => !finding.checkId || activeCheckIds.has(finding.checkId))
        : buildFindings(checks, files),
    [activeCheckIds, checks, files, reviewSummary]
  );
  const displayedEvidenceRows = reviewSummary?.evidenceRows?.length ? reviewSummary.evidenceRows : defaultEvidenceRows;
  const crossPdfSummary = useMemo(
    () => reviewSummary?.qualityChecks?.find((check) => check.id === "cross-pdf-validation") || null,
    [reviewSummary]
  );
  const dateRange = reviewSummary?.dateRange || null;
  const matrixCountSummaries = useMemo(() => {
    const summaryById = new Map((reviewSummary?.qualityChecks || []).map((check) => [check.id, check]));
    const designSummary = summaryById.get("design-validation");
    const dataSummary = summaryById.get("pdf-data-validation");
    return [
      {
        id: "design-check-matrix",
        label: "Design Check Matrix",
        ok: designSummary?.ok || 0,
        notOk: designSummary?.notOk || 0,
        na: designSummary?.na || 0
      },
      {
        id: "data-validation-check-matrix",
        label: "Data Validation Check Matrix",
        ok: dataSummary?.ok || 0,
        notOk: dataSummary?.notOk || 0,
        na: dataSummary?.na || 0
      }
    ];
  }, [reviewSummary]);
  const prioritizedFindings = useMemo(
    () => findings.map((finding) => ({ finding, priority: classifyFindingPriority(finding) })),
    [findings]
  );
  const dataCriticalPoints = useMemo(
    () => displayedEvidenceRows.filter((row) => /mismatch|not ok|fail/i.test(row.status)),
    [displayedEvidenceRows]
  );
  const designMediumPoints = useMemo(
    () => prioritizedFindings.filter((item) => item.priority === "medium").map((item) => item.finding),
    [prioritizedFindings]
  );
  const designLowPoints = useMemo(
    () => prioritizedFindings.filter((item) => item.priority === "low").map((item) => item.finding),
    [prioritizedFindings]
  );
  const mismatchCount = crossPdfSummary ? crossPdfSummary.notOk : dataCriticalPoints.length;
  const matchCount = crossPdfSummary
    ? crossPdfSummary.ok
    : displayedEvidenceRows.filter((row) => /match|ok|pass/i.test(row.status) && !/mismatch|not ok|fail/i.test(row.status)).length;
  const priorityCounts = useMemo(
    () => ({
      critical: mismatchCount,
      medium: prioritizedFindings.filter((item) => item.priority === "medium").length,
      low: prioritizedFindings.filter((item) => item.priority === "low").length
    }),
    [mismatchCount, prioritizedFindings]
  );
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
  const repositoryFolder = repository?.folder || `report-review-finding/excel-pdf-data/${slugPreview(config.projectName || "excel-pdf-data-review")}`;
  const generatedFiles = generatedReviewFiles(runResult, repository);
  const checklistGridColumns = checklistGrid?.columns?.length ? checklistGrid.columns : ["S.NO", "Check Points"];
  const checklistGridRows = checklistGrid?.rows || [];
  const checklistSerialColumnIndex = Math.max(0, (checklistGrid?.serialColumn || 1) - 1);
  const checklistGridTemplate = {
    "--editor-columns": `54px repeat(${checklistGridColumns.length}, minmax(150px, 1fr)) 38px`
  } as CSSProperties;

  useEffect(() => {
    void loadDefaults();
  }, []);

  useEffect(() => {
    if (!defaultProjectName) return;
    setConfig((current) => ({
      ...current,
      projectName: current.projectName || defaultProjectName
    }));
  }, [defaultProjectName]);

  useEffect(() => {
    if (!autoSelectLatestChecklist || !discovery.checklists.length) return;
    const latestChecklist = latestChecklistForSelection(discovery.checklists, config.selectedChecklistPath);
    if (!latestChecklist || latestChecklist.path === config.selectedChecklistPath) return;
    setConfig((current) => ({
      ...current,
      selectedChecklistPath: latestChecklist.path
    }));
  }, [autoSelectLatestChecklist, discovery.checklists, config.selectedChecklistPath]);

  useEffect(() => {
    void loadChecklistSheets(config.selectedChecklistPath);
  }, [config.selectedChecklistPath]);

  useEffect(() => {
    if (!config.selectedChecklistPath || !selectedChecklistSheet) {
      setChecklistGrid(null);
      return;
    }
    void loadChecklistSheetGrid(config.selectedChecklistPath, selectedChecklistSheet);
  }, [config.selectedChecklistPath, selectedChecklistSheet]);

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
        projectName: current.projectName || defaultProjectName,
        userName: username
      }));
      setDiscovery(result.files);
      if (defaultProjectName) {
        void loadRepository(defaultProjectName);
      }
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
        projectName: current.projectName || defaultProjectName,
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

  async function loadChecklistSheets(checklistPath: string) {
    if (!checklistPath) {
      setChecklistSheets([]);
      setSelectedChecklistSheet("");
      setChecklistGrid(null);
      return;
    }
    try {
      const result = await apiGet<ChecklistSheetsResponse>(`/api/excel-pdf-data/checklist/sheets?path=${encodeURIComponent(checklistPath)}`);
      setChecklistSheets(result.sheets || []);
      setSelectedChecklistSheet((current) => {
        if (current && result.sheets.some((sheet) => sheet.name === current)) return current;
        return result.sheets[0]?.name || "";
      });
    } catch (error) {
      setChecklistSheets([]);
      setSelectedChecklistSheet("");
      setChecklistRevisionStatus(error instanceof Error ? error.message : "Could not read checklist sheets.");
    }
  }

  async function loadChecklistSheetGrid(checklistPath: string, sheetName: string) {
    try {
      setLoadingChecklistGrid(true);
      const result = await apiGet<ChecklistSheetGridResponse>(
        `/api/excel-pdf-data/checklist/sheet?path=${encodeURIComponent(checklistPath)}&sheetName=${encodeURIComponent(sheetName)}`
      );
      setChecklistGrid({
        ...result,
        rows: result.rows.map((row) => ({
          ...row,
          values: normalizeGridValues(row.values, result.columns.length)
        }))
      });
    } catch (error) {
      setChecklistGrid(null);
      setChecklistRevisionStatus(error instanceof Error ? error.message : "Could not load checklist worksheet.");
    } finally {
      setLoadingChecklistGrid(false);
    }
  }

  function updateChecklistGridCell(rowIndex: number, columnIndex: number, value: string) {
    if (columnIndex === checklistSerialColumnIndex) return;
    setChecklistGrid((current) => {
      if (!current) return current;
      const rows = current.rows.map((row, index) => {
        if (index !== rowIndex) return row;
        const values = normalizeGridValues(row.values, current.columns.length);
        values[columnIndex] = value;
        return { ...row, values };
      });
      return { ...current, rows };
    });
  }

  function addChecklistGridRow() {
    setChecklistGrid((current) => {
      if (!current) return current;
      const values = Array.from({ length: current.columns.length }, () => "");
      values[Math.max(0, current.serialColumn - 1)] = String(current.rows.length + 1);
      return {
        ...current,
        rows: [...current.rows, { rowNumber: 0, values }]
      };
    });
  }

  function removeChecklistGridRow(rowIndex: number) {
    setChecklistGrid((current) => {
      if (!current) return current;
      return {
        ...current,
        rows: current.rows.filter((_, index) => index !== rowIndex)
      };
    });
  }

  async function saveChecklistWorkbookRevision() {
    if (!checklistGrid || !selectedChecklistSheet) {
      setChecklistRevisionStatus("Select a checklist sheet before saving.");
      return;
    }
    const editableRows = checklistGrid.rows
      .map((row) => normalizeGridValues(row.values, checklistGrid.columns.length))
      .filter((values) => values.some((value, index) => index !== checklistSerialColumnIndex && value.trim()));
    if (!editableRows.length) {
      setChecklistRevisionStatus("At least one checklist row is required before saving.");
      return;
    }

    try {
      setSavingChecklistRevision(true);
      setChecklistRevisionStatus("");
      const result = await apiPost<ChecklistRevisionResponse>("/api/excel-pdf-data/checklist/revision/edit", {
        ...config,
        selectedChecklistPath: config.selectedChecklistPath,
        sheetName: selectedChecklistSheet,
        rows: editableRows
      });
      setDiscovery(result.files);
      setConfig((current) => ({
        ...current,
        selectedChecklistPath: result.createdFile.path
      }));
      setChecklistRevisionStatus(
        `${result.createdFile.name} saved as ${result.revisionLabel}; ${result.saved.updatedCount || editableRows.length} row(s) saved.`
      );
      setRunResult(null);
      await loadChecklistSheets(result.createdFile.path);
      await loadChecklistSheetGrid(result.createdFile.path, selectedChecklistSheet);
    } catch (error) {
      setChecklistRevisionStatus(error instanceof Error ? error.message : "Could not save checklist revision.");
    } finally {
      setSavingChecklistRevision(false);
    }
  }

  function toggleCheck(checkId: string) {
    if (reviewSummary?.qualityChecks?.length) {
      setSummaryToggles((current) => ({
        ...current,
        [checkId]: !(current[checkId] ?? true)
      }));
      return;
    }
    setChecks((current) => current.map((check) => (check.id === checkId ? { ...check, enabled: !check.enabled } : check)));
  }

  function updateConfig(patch: Partial<AgentConfig>) {
    setConfig((current) => ({ ...current, ...patch }));
    setRunResult(null);
    if (patch.projectName !== undefined) {
      setRepository(null);
      setReviewSummary(null);
      setSummaryToggles({});
    }
  }

  function toggleAutoSelectLatestChecklist(checked: boolean) {
    setAutoSelectLatestChecklist(checked);
    localStorage.setItem(latestChecklistPreferenceKey, checked ? "true" : "false");
    if (!checked) return;
    const latestChecklist = latestChecklistForSelection(discovery.checklists, config.selectedChecklistPath);
    if (latestChecklist) {
      updateConfig({ selectedChecklistPath: latestChecklist.path });
    }
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
      await loadRepository(config.projectName);
      setShowSuccessPopup(true);
    } catch (error) {
      setReviewStatus("ready");
      setRunError(error instanceof Error ? error.message : "Excel/PDF data review failed.");
    }
  }

  async function loadRepository(projectName = config.projectName) {
    const name = projectName.trim();
    if (!name) {
      setRepository(null);
      return null;
    }
    try {
      setRepositoryLoading(true);
      const result = await apiGet<RepositoryResponse>(`/api/excel-pdf-data/repository?projectName=${encodeURIComponent(name)}`);
      setRepository(result);
      await loadReviewSummary(name);
      return result;
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Could not load review file repository.");
      return null;
    } finally {
      setRepositoryLoading(false);
    }
  }

  async function loadReviewSummary(projectName = config.projectName) {
    const name = projectName.trim();
    if (!name) {
      setReviewSummary(null);
      return null;
    }
    try {
      const result = await apiGet<ReviewSummary>(`/api/excel-pdf-data/repository/summary?projectName=${encodeURIComponent(name)}`);
      setReviewSummary(result);
      setSummaryToggles((current) => {
        const next = { ...current };
        for (const check of result.qualityChecks || []) {
          if (next[check.id] === undefined) next[check.id] = true;
        }
        return next;
      });
      return result;
    } catch {
      setReviewSummary(null);
      return null;
    }
  }

  async function viewRepositoryFile(file: RepositoryFile) {
    if (!file.canView) return;
    try {
      setPreviewLoadingPath(file.path);
      const result = await apiGet<PreviewFile>(`/api/excel-pdf-data/repository/view?path=${encodeURIComponent(file.path)}`);
      setPreviewFile(result);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Could not open review file.");
    } finally {
      setPreviewLoadingPath("");
    }
  }

  function selectReviewStage(stage: (typeof reviewStages)[number]) {
    setActiveReviewStage(stage.number);
    window.requestAnimationFrame(() => {
      document.getElementById(stage.targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <>
      {!embedded && (
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
      )}

      <div className={`review-grid ${embedded ? "embedded-review-grid" : ""}`}>
        <section className="review-stage-rail">
          <div className="section-title">
            <CircleIcon />
            <span>Review Stages</span>
          </div>
          <div className="review-stage-list">
            {reviewStages.map((stage) => (
              <button
                aria-pressed={activeReviewStage === stage.number}
                className={`review-stage-row ${activeReviewStage === stage.number ? "active" : "ready"}`}
                key={stage.number}
                onClick={() => selectReviewStage(stage)}
                type="button"
              >
                <span className="phase-index">{stage.number}</span>
                <span>
                  {stage.title}
                  <small>{stage.detail}</small>
                </span>
                {activeReviewStage === stage.number ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
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
            <ReviewMetric icon={<AlertTriangle size={18} />} label="Data Critical" value={priorityCounts.critical} tone="bad" />
          </div>

          <div className="review-main-grid inputs-only-grid">
            {false && <section className="review-panel source-panel">
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
            </section>}

            <section className="review-panel" id="agent-inputs">
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

          <section className="review-panel checklist-editor-panel" id="checklist-excel-editor">
            <div className="checklist-editor-head">
              <div>
                <span className="eyebrow">Checklist Excel Editor</span>
                <strong>Checklist Workbook Editor</strong>
                <small>Edit the selected checklist sheet in the browser. Save creates a new checklist file revision.</small>
              </div>
              <span>Rev 0.0 to 0.10, then 1.0 to 1.10</span>
            </div>
            <label className="path-field checklist-sheet-picker">
              <span>Checklist Selection</span>
              <select
                value={config.selectedChecklistPath}
                onChange={(event) => updateConfig({ selectedChecklistPath: event.target.value })}
                disabled={!discovery.checklists.length || savingChecklistRevision}
              >
                {discovery.checklists.map((file) => (
                  <option key={file.path} value={file.path}>
                    {file.name} ({file.revisionLabel || `Rev ${file.revisionNumber || 1}`})
                  </option>
                ))}
              </select>
              <small>{config.checklistInput}</small>
            </label>
            <label className="latest-checklist-option">
              <input
                checked={autoSelectLatestChecklist}
                onChange={(event) => toggleAutoSelectLatestChecklist(event.target.checked)}
                type="checkbox"
              />
              <span>
                <strong>Always select latest checklist revision</strong>
                <small>When the page opens, refreshes, or a revision is saved, the newest revision for this checklist will be selected.</small>
              </span>
            </label>
            <label className="path-field checklist-sheet-picker">
              <span>Checklist Sheet</span>
              <select
                value={selectedChecklistSheet}
                onChange={(event) => setSelectedChecklistSheet(event.target.value)}
                disabled={!checklistSheets.length || savingChecklistRevision}
              >
                {checklistSheets.map((sheet) => (
                  <option key={sheet.name} value={sheet.name}>
                    {sheet.name} ({sheet.pointCount} point{sheet.pointCount === 1 ? "" : "s"})
                  </option>
                ))}
              </select>
            </label>
            <div className="excel-editor-toolbar">
              <button
                className="secondary-btn"
                onClick={() => selectedChecklistSheet && void loadChecklistSheetGrid(config.selectedChecklistPath, selectedChecklistSheet)}
                disabled={loadingChecklistGrid || !selectedChecklistSheet}
                type="button"
              >
                {loadingChecklistGrid ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
                Refresh Sheet
              </button>
              <button className="secondary-btn" onClick={addChecklistGridRow} disabled={!checklistGrid || savingChecklistRevision} type="button">
                <Plus size={16} />
                Add Row
              </button>
            </div>
            <div className="excel-editor-grid" style={checklistGridTemplate}>
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
                  const values = normalizeGridValues(row.values, checklistGridColumns.length);
                  return (
                    <div className="excel-editor-row" key={`${row.rowNumber}-${rowIndex}`}>
                      <strong>{rowIndex + 1}</strong>
                      {checklistGridColumns.map((column, columnIndex) => (
                        <input
                          aria-label={`${column} row ${rowIndex + 1}`}
                          className={columnIndex === checklistSerialColumnIndex ? "locked" : ""}
                          key={`${column}-${columnIndex}`}
                          onChange={(event) => updateChecklistGridCell(rowIndex, columnIndex, event.target.value)}
                          readOnly={columnIndex === checklistSerialColumnIndex}
                          title={columnIndex === checklistSerialColumnIndex ? "Serial number is generated on save." : column}
                          value={columnIndex === checklistSerialColumnIndex ? String(rowIndex + 1) : values[columnIndex] || ""}
                        />
                      ))}
                      <button
                        aria-label={`Remove row ${rowIndex + 1}`}
                        className="icon-btn danger-icon"
                        disabled={savingChecklistRevision}
                        onClick={() => removeChecklistGridRow(rowIndex)}
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
              <small>{checklistRevisionStatus || "Existing checklist files are kept; the edited checklist is saved as a new revision."}</small>
              <button
                className="secondary-btn"
                onClick={saveChecklistWorkbookRevision}
                disabled={savingChecklistRevision || !selectedChecklistSheet || !checklistGridRows.length}
                type="button"
              >
                {savingChecklistRevision ? <Loader2 className="spin" size={16} /> : <FileCheck2 size={16} />}
                Save Edited Revision
              </button>
            </div>
          </section>

          <section className="review-panel" id="quality-checks">
            <div className="section-title">
              <ShieldCheck size={16} />
              <span>Quality Checks</span>
            </div>
            <div className="check-grid">
              {displayedChecks.map((check) => (
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
            <section className="review-panel" id="review-findings">
              <div className="review-panel-header">
                <div className="section-title">
                  <AlertTriangle size={16} />
                  <span>Findings</span>
                </div>
                <span className="gate-count-pill">{findings.length} open</span>
              </div>
              {dataCriticalPoints.length > 0 && (
                <div className="critical-finding-box">
                  <div className="critical-finding-head">
                    <strong>Data Critical Points</strong>
                    <span>{dataCriticalPoints.length}</span>
                  </div>
                  <ol>
                    {dataCriticalPoints.map((point, index) => (
                      <li key={`${point.metric}-${point.excel}-${point.pdf}-${index}`}>
                        <span>{point.metric}</span>
                        <small>{evidencePointDetail(point)}</small>
                        <em>{point.status}</em>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <div className="finding-list">
                {prioritizedFindings.map(({ finding, priority }, index) => (
                  <article className={`finding-row ${priority}`} key={`${finding.area}-${finding.finding}-${index}`}>
                    <div className="finding-row-top">
                      <strong>{finding.area}</strong>
                      <span className={`priority-badge ${priority}`}>{priorityLabel(priority)}</span>
                    </div>
                    <span>{finding.finding}</span>
                    <details className="finding-drilldown">
                      <summary>
                        <SearchCheck size={14} />
                        <span>Drill down</span>
                        <ChevronDown size={14} />
                      </summary>
                      <div className="finding-drilldown-body">
                        <div>
                          <strong>Evidence</strong>
                          <p>{finding.evidence}</p>
                        </div>
                        <div>
                          <strong>Recommendation</strong>
                          <p>{finding.recommendation}</p>
                        </div>
                      </div>
                    </details>
                  </article>
                ))}
              </div>
            </section>

            <section className="review-panel" id="reconciliation-evidence">
              <div className="section-title">
                <Database size={16} />
                <span>Reconciliation Evidence</span>
              </div>
              {dateRange && (
                <div className={`date-range-card ${dateRange.status}`}>
                  <div className="date-range-head">
                    <strong>PDF Date Range Used For Validation</strong>
                    <span>{dateRange.status === "match" ? "Matched" : dateRange.status === "mismatch" ? "Mismatch" : "Review"}</span>
                  </div>
                  <p>{dateRange.display}</p>
                  {dateRange.reports.length > 0 && (
                    <div className="date-range-report-list">
                      {dateRange.reports.map((report, index) => (
                        <div className="date-range-report-row" key={`${report.report}-${report.pdfFile}-${index}`}>
                          <strong>{report.report}</strong>
                          <span>{report.display}</span>
                          <small>
                            {report.bucketStart && report.bucketEnd
                              ? `PDF rows: ${report.bucketStart} to ${report.bucketEnd}`
                              : report.pdfFile || "PDF period detected from selected report"}
                            {report.intervalMinutes ? ` | Interval: ${report.intervalMinutes} min` : ""}
                            {report.missingBucketCount ? ` | Missing buckets: ${report.missingBucketCount}` : ""}
                          </small>
                        </div>
                      ))}
                    </div>
                  )}
                  <small>
                    Cross PDF selection: {dateRange.crossPdf.selectedPdfCount} PDF(s), {dateRange.crossPdf.pairCount} pair(s),{" "}
                    {dateRange.crossPdf.matchCount} match(es), {dateRange.crossPdf.mismatchCount} mismatch(es).
                  </small>
                </div>
              )}
              <div className="matrix-count-grid">
                {matrixCountSummaries.map((summary) => (
                  <div className="matrix-count-card" key={summary.id}>
                    <strong>{summary.label}</strong>
                    <div className="matrix-status-counts">
                      <span className="ok">
                        OK <b>{summary.ok}</b>
                      </span>
                      <span className="not-ok">
                        Not OK <b>{summary.notOk}</b>
                      </span>
                      <span className="na">
                        NA <b>{summary.na}</b>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="evidence-table">
                <div className="evidence-row heading">
                  <span>Metric</span>
                  <span>Excel</span>
                  <span>PDF</span>
                  <span>Status</span>
                  <span>Drill Down</span>
                </div>
                {displayedEvidenceRows.map((row, index) => {
                  const rowKey = `${row.metric}-${row.excel}-${row.pdf}-${row.status}-${index}`;
                  const isOpen = Boolean(openEvidenceRows[rowKey]);
                  return (
                    <div className={`evidence-row ${statusClass(row.status)}`} key={rowKey}>
                      <div className="evidence-row-main">
                        <span title={row.metric}>{row.metric}</span>
                        <span title={row.excel}>{row.excel}</span>
                        <span title={row.pdf}>{row.pdf}</span>
                        <strong title={row.status}>{row.status}</strong>
                        <button
                          aria-expanded={isOpen}
                          className="evidence-drilldown-trigger"
                          onClick={() => setOpenEvidenceRows((current) => ({ ...current, [rowKey]: !isOpen }))}
                          type="button"
                        >
                          <SearchCheck size={14} />
                          <span>{isOpen ? "Close" : "Open"}</span>
                          <ChevronDown size={14} />
                        </button>
                      </div>
                      {isOpen && (
                      <div className="evidence-drilldown-body">
                        <dl>
                          <div>
                            <dt>Metric</dt>
                            <dd>{row.metric}</dd>
                          </div>
                          <div>
                            <dt>Excel value</dt>
                            <dd>{row.excel}</dd>
                          </div>
                          <div>
                            <dt>PDF value</dt>
                            <dd>{row.pdf}</dd>
                          </div>
                          <div>
                            <dt>Status</dt>
                            <dd>{row.status}</dd>
                          </div>
                        </dl>
                      </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="reconcile-footer">
                <ReviewMetric icon={<CheckCircle2 size={17} />} label="Matches" value={matchCount} tone="good" />
                <ReviewMetric icon={<AlertTriangle size={17} />} label="Mismatches" value={mismatchCount} tone="warn" />
                <ReviewMetric icon={<AlertTriangle size={17} />} label="Data Critical" value={priorityCounts.critical} tone="bad" />
                <ReviewMetric icon={<SearchCheck size={17} />} label="Design Medium" value={priorityCounts.medium} tone="warn" />
                <ReviewMetric icon={<ShieldCheck size={17} />} label="Design Low" value={priorityCounts.low} tone="neutral" />
              </div>
            </section>
          </div>

          <section className="review-panel priority-points-panel">
            <div className="section-title">
              <AlertTriangle size={16} />
              <span>Priority Point Details</span>
            </div>
            <div className="priority-point-grid">
              <PriorityPointGroup
                count={mismatchCount}
                emptyText="No data mismatches found."
                items={dataCriticalPoints.map((point) => ({
                  title: point.metric,
                  detail: evidencePointDetail(point),
                  meta: point.status
                }))}
                tone="critical"
                title="Data Critical"
              />
              <PriorityPointGroup
                count={designMediumPoints.length}
                emptyText="No medium design points found."
                items={designMediumPoints.map((point) => ({
                  title: point.finding,
                  detail: point.evidence,
                  meta: point.area
                }))}
                tone="medium"
                title="Design Medium"
              />
              <PriorityPointGroup
                count={designLowPoints.length}
                emptyText="No low design points found."
                items={designLowPoints.map((point) => ({
                  title: point.finding,
                  detail: point.evidence,
                  meta: point.area
                }))}
                tone="low"
                title="Design Low"
              />
            </div>
          </section>

          <section className="review-panel repository-panel" id="review-repository">
            <div className="review-panel-header">
              <div className="section-title">
                <FolderOpen size={16} />
                <span>Review File Repository</span>
              </div>
              <button className="secondary-btn" onClick={() => void loadRepository()} disabled={!config.projectName.trim() || repositoryLoading} type="button">
                {repositoryLoading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
                Refresh
              </button>
            </div>
            <div className="repository-folder">
              <span>Folder</span>
              <strong>{repositoryFolder}</strong>
            </div>
            {repository?.files.length ? (
              <div className="repository-file-list">
                {repository.files.map((file) => (
                  <div className="repository-file-row" key={file.path}>
                    <FileText size={17} />
                    <span>
                      {file.name}
                      <small>{file.artifactType} | {formatBytes(file.size)} | {formatTimestamp(new Date(file.modifiedAt))}</small>
                    </span>
                    <div className="repository-actions">
                      <button
                        className="icon-action"
                        disabled={!file.canView || previewLoadingPath === file.path}
                        onClick={() => void viewRepositoryFile(file)}
                        title={file.canView ? `View ${file.name}` : "Preview is available for .txt and .md files"}
                        type="button"
                      >
                        {previewLoadingPath === file.path ? <Loader2 className="spin" size={15} /> : <Eye size={15} />}
                      </button>
                      <a
                        className="icon-action"
                        href={`/api/excel-pdf-data/repository/download?path=${encodeURIComponent(file.path)}`}
                        title={`Download ${file.name}`}
                      >
                        <Download size={15} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-note">
                {config.projectName.trim()
                  ? repository?.exists === false
                    ? "No review files have been generated for this project yet."
                    : "Run the review or refresh the repository to show generated files."
                  : "Enter a project name to resolve the review file repository."}
              </div>
            )}
          </section>

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
      {showSuccessPopup && (
        <div className="review-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="review-success-title">
          <section className="review-modal">
            <div className="review-panel-header">
              <div className="section-title">
                <CheckCircle2 size={18} />
                <span id="review-success-title">Review files generated successfully</span>
              </div>
              <button className="icon-action" onClick={() => setShowSuccessPopup(false)} title="Close" type="button">
                <X size={16} />
              </button>
            </div>
            <p>All review files were saved in the project repository folder.</p>
            <div className="repository-folder compact">
              <span>Folder</span>
              <strong>{repositoryFolder}</strong>
            </div>
            <div className="success-file-list">
              {generatedFiles.map((file) => (
                <span key={file.path}>{file.name}</span>
              ))}
              {!generatedFiles.length && <span>Repository files are ready to refresh.</span>}
            </div>
            <button className="primary-btn" onClick={() => setShowSuccessPopup(false)} type="button">
              Close
            </button>
          </section>
        </div>
      )}
      {previewFile && (
        <div className="review-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="review-preview-title">
          <section className="review-modal preview-modal">
            <div className="review-panel-header">
              <div className="section-title">
                <FileText size={18} />
                <span id="review-preview-title">{previewFile.name}</span>
              </div>
              <button className="icon-action" onClick={() => setPreviewFile(null)} title="Close preview" type="button">
                <X size={16} />
              </button>
            </div>
            <pre>{previewFile.content}</pre>
            <div className="preview-actions">
              <a className="secondary-btn" href={`/api/excel-pdf-data/repository/download?path=${encodeURIComponent(previewFile.path)}`}>
                <Download size={16} />
                Download
              </a>
              <button className="primary-btn" onClick={() => setPreviewFile(null)} type="button">
                Close
              </button>
            </div>
          </section>
        </div>
      )}
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

function PriorityPointGroup({
  count,
  emptyText,
  items,
  title,
  tone
}: {
  count: number;
  emptyText: string;
  items: Array<{ title: string; detail: string; meta: string }>;
  title: string;
  tone: ReviewPriority;
}) {
  return (
    <div className={`priority-point-group ${tone}`}>
      <div className="priority-point-head">
        <strong>{title}</strong>
        <span>{count}</span>
      </div>
      {items.length ? (
        <ol className="priority-point-list">
          {items.map((item, index) => (
            <li key={`${title}-${item.title}-${index}`}>
              <span>{item.title}</span>
              <small>{item.detail}</small>
              <em>{item.meta}</em>
            </li>
          ))}
        </ol>
      ) : (
        <p>{emptyText}</p>
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

function generatedReviewFiles(runResult: AgentRunResult | null, repository: RepositoryResponse | null) {
  const paths = [
    ...Object.values(runResult?.projectArtifacts?.copiedArtifacts || {}),
    runResult?.projectArtifacts?.summaryPath || ""
  ].filter(Boolean);

  if (paths.length) {
    return [...new Set(paths)].map((filePath) => ({
      path: filePath,
      name: filePath.split(/[\\/]/).pop() || filePath
    }));
  }

  return (repository?.files || []).slice(0, 8).map((file) => ({
    path: file.path,
    name: file.name
  }));
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

function normalizeGridValues(values: unknown[], columnCount: number) {
  return Array.from({ length: columnCount }, (_, index) => {
    const value = values[index];
    if (value === null || value === undefined) return "";
    return String(value);
  });
}

function latestChecklistForSelection(checklists: ReviewFile[], selectedPath: string) {
  if (!checklists.length) return null;
  const selectedFile = checklists.find((file) => samePath(file.path, selectedPath));
  const selectedFamily = checklistFamilyName(selectedFile?.name || selectedPath);
  const candidates = selectedFamily
    ? checklists.filter((file) => checklistFamilyName(file.name) === selectedFamily)
    : checklists;
  return candidates.reduce<ReviewFile | null>((latest, file) => {
    if (!latest) return file;
    const revisionDiff = checklistRevisionValue(file) - checklistRevisionValue(latest);
    if (revisionDiff > 0) return file;
    if (revisionDiff < 0) return latest;
    const timeDiff = Date.parse(file.modifiedAt || "") - Date.parse(latest.modifiedAt || "");
    if (timeDiff > 0) return file;
    if (timeDiff < 0) return latest;
    return file.name.localeCompare(latest.name) > 0 ? file : latest;
  }, null);
}

function samePath(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}

function checklistRevisionValue(file: ReviewFile) {
  if (typeof file.revisionMajor === "number" || typeof file.revisionMinor === "number") {
    return Number(file.revisionMajor || 0) * 11 + Number(file.revisionMinor || 0);
  }
  if (typeof file.revisionNumber === "number") return file.revisionNumber;
  const match = file.name.match(/(?:^|[\s([])rev(?:ision)?\s*(\d+)\.(\d+)(?:[\])]|$)?/i);
  if (!match) return 0;
  return Number(match[1] || 0) * 11 + Number(match[2] || 0);
}

function checklistFamilyName(value: string) {
  const fileName = value.split(/[\\/]/).pop() || value;
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/\s*[\[(]?\s*rev(?:ision)?\s*\d+\.\d+\s*[\])]?\s*$/i, "")
    .trim()
    .toLowerCase();
}

function statusClass(status: string) {
  return status.toLowerCase().replace(/\s+/g, "-");
}

function evidencePointDetail(point: EvidenceRow) {
  const excel = point.excel.includes(":") ? point.excel : `Excel: ${point.excel}`;
  const pdf = point.pdf.includes(":") ? point.pdf : `PDF: ${point.pdf}`;
  return `${excel} | ${pdf}`;
}

function classifyFindingPriority(finding: Finding): ReviewPriority {
  const checkId = String(finding.checkId || "").toLowerCase();
  const area = String(finding.area || "").toLowerCase();
  const text = [finding.area, finding.finding, finding.evidence, finding.recommendation].join(" ").toLowerCase();
  const isDesignFinding =
    checkId.includes("design-validation") ||
    /\b(design|layout|header|font|colour|color|border|align|format|column|title|summary)\b/.test(`${area} ${text}`);

  if (isDesignFinding) {
    const lowImpactPattern = /\b(font|colour|color|bold|align|alignment|spacing|case|decimal|formatting|style|width|typo|spelling)\b/;
    return lowImpactPattern.test(text) ? "low" : "medium";
  }

  const isDataCheckFinding =
    checkId.includes("pdf-data-validation") ||
    checkId.includes("hierarchy-validation") ||
    checkId.includes("cross-pdf-validation");
  const isDataFinding =
    isDataCheckFinding ||
    /\b(pdf data|data validation|reconciliation|hierarchy|cross-pdf|mismatch|total|subtotal|count|value|metric)\b/.test(`${area} ${text}`);

  if (isDataFinding) {
    const hasMismatchEvidence = /\b(mismatch|not ok|fail|failed|missing|dash\/blank|outside normal range|numeric values should match)\b/.test(text);
    return isDataCheckFinding || finding.severity === "high" || hasMismatchEvidence ? "critical" : "data";
  }

  if (finding.severity === "high") return "critical";
  if (finding.severity === "medium") return "medium";
  return "low";
}

function priorityLabel(priority: ReviewPriority) {
  if (priority === "critical") return "Data Critical";
  if (priority === "data") return "Data Finding";
  if (priority === "medium") return "Design Medium";
  return "Design Low";
}
