import {
  AlertTriangle,
  ChevronDown,
  CheckCircle2,
  ClipboardCheck,
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
  displayName?: string;
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
  excelOnly: boolean;
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
    projectOutputFolderAbsolute?: string;
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

type ReviewInputUploadResult = {
  kind: "checklist" | "excel" | "pdf";
  folder: string;
  files: ReviewFile[];
  selectedPaths: string[];
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
  displayName?: string;
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
  userName?: string;
  userFolder?: string;
  projectFolder?: string;
  folder: string;
  folderAbsolute?: string;
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
  individualChecklistVerifications?: ChecklistVerificationGroup[];
  correctionObservations?: CorrectionObservation[];
  evidenceRows: EvidenceRow[];
};

type ChecklistVerificationGroup = {
  id: string;
  title: string;
  area: string;
  ok: number;
  notOk: number;
  na: number;
  rows: ChecklistVerificationRow[];
};

type ChecklistVerificationRow = {
  point: number | string;
  checklistSNo?: string;
  checklistRowNumber?: string;
  report?: string;
  area?: string;
  section?: string;
  state?: string;
  checkPoint?: string;
  evidence?: string;
};

type CorrectionObservation = {
  severity: string;
  area: string;
  report?: string;
  title: string;
  detail?: string;
  recommendation?: string;
  point?: number | string;
  checklistSNo?: string;
  state?: string;
  checkPoint?: string;
  observation?: string;
  correctionRequired?: string;
};

const defaultConfig: AgentConfig = {
  checklistInput: "",
  excelFolder: "",
  pdfFolder: "",
  selectedChecklistPath: "",
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
  { number: 2, title: "Extract Data", detail: "Tables and text blocks", targetId: "correction-observations" },
  { number: 3, title: "Compare Values", detail: "Workbook vs workbook data", targetId: "correction-observations" },
  { number: 4, title: "Log Findings", detail: "Severity and evidence", targetId: "review-findings" },
  { number: 5, title: "Review Packet", detail: "Summary for approval", targetId: "review-repository" }
];

const defaultChecks: CheckOption[] = [
  { id: "schema", label: "Header and schema consistency", area: "Structure", enabled: true },
  { id: "missing-data", label: "Blank, null, and NA values", area: "Completeness", enabled: true },
  { id: "reconciliation", label: "Excel report data validation", area: "Reconciliation", enabled: true },
  { id: "duplicates", label: "Duplicate IDs and repeated rows", area: "Quality", enabled: true },
  { id: "formats", label: "Date, currency, and percent formats", area: "Formatting", enabled: true },
  { id: "outliers", label: "Outliers and unusual movements", area: "Reasonableness", enabled: false }
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
          <strong>Excel Only</strong>
          <span>Data and design review</span>
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
            <small>Excel workbook comparison</small>
          </button>
          <button className="review-queue-row" type="button">
            <span>Invoice packet</span>
            <small>Workbook data and design extract</small>
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
  userType?: string;
  defaultProjectName?: string;
  embedded?: boolean;
  phaseGuide?: ReactNode;
};

export default function ExcelPdfReviewApp({ username, userType = "User", defaultProjectName = "", embedded = false, phaseGuide }: ExcelPdfReviewAppProps) {
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
  const [uploadingInputKind, setUploadingInputKind] = useState<"" | "checklist" | "excel" | "pdf">("");
  const [uploadingEditorChecklist, setUploadingEditorChecklist] = useState(false);
  const [editorChecklists, setEditorChecklists] = useState<ReviewFile[]>([]);
  const [editorChecklistPath, setEditorChecklistPath] = useState("");
  const [editorChecklistInput, setEditorChecklistInput] = useState("");
  const [checklistSheets, setChecklistSheets] = useState<ChecklistSheetInfo[]>([]);
  const [selectedChecklistSheet, setSelectedChecklistSheet] = useState("");
  const [checklistGrid, setChecklistGrid] = useState<ChecklistSheetGridResponse | null>(null);
  const [loadingChecklistGrid, setLoadingChecklistGrid] = useState(false);
  const [savingChecklistRevision, setSavingChecklistRevision] = useState(false);
  const [checklistRevisionStatus, setChecklistRevisionStatus] = useState("");
  const [autoSelectLatestChecklist, setAutoSelectLatestChecklist] = useState(() => {
    return localStorage.getItem(latestChecklistPreferenceKey) === "true";
  });
  const checklistSheetsRequestRef = useRef(0);
  const checklistGridRequestRef = useRef(0);

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
        : [],
    [activeCheckIds, reviewSummary]
  );
  const displayedEvidenceRows = reviewSummary?.evidenceRows?.length ? reviewSummary.evidenceRows : [];
  const individualVerificationGroups = reviewSummary?.individualChecklistVerifications || [];
  const individualVerificationRowCount = individualVerificationGroups.reduce(
    (sum, group) => sum + (group.rows?.length || 0),
    0
  );
  const correctionObservations = reviewSummary?.correctionObservations || [];
  const dataCorrectionObservations = useMemo(
    () => correctionObservations.filter((observation) => !isDesignCorrectionObservation(observation)),
    [correctionObservations]
  );
  const designCorrectionObservations = useMemo(
    () => correctionObservations.filter((observation) => isDesignCorrectionObservation(observation)),
    [correctionObservations]
  );
  const crossPdfSummary = useMemo(
    () => {
      const hierarchySummary = reviewSummary?.qualityChecks?.find((check) => check.id === "hierarchy-validation") || null;
      if (hierarchySummary && (hierarchySummary.ok || hierarchySummary.notOk || hierarchySummary.na)) {
        return hierarchySummary;
      }
      return reviewSummary?.qualityChecks?.find((check) => check.id === "cross-pdf-validation") || null;
    },
    [reviewSummary]
  );
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
        na: designSummary?.na || 0,
        detail: designSummary?.detail || ""
      },
      {
        id: "data-validation-check-matrix",
        label: "Data Validation Check Matrix",
        ok: dataSummary?.ok || 0,
        notOk: dataSummary?.notOk || 0,
        na: dataSummary?.na || 0,
        detail: dataSummary?.detail || ""
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
  const dataFindingCards = useMemo(
    () => prioritizedFindings.filter((item) => item.priority === "critical" || item.priority === "data"),
    [prioritizedFindings]
  );
  const designFindingCards = useMemo(
    () => prioritizedFindings.filter((item) => item.priority === "medium" || item.priority === "low"),
    [prioritizedFindings]
  );
  const designMediumPoints = useMemo(
    () => prioritizedFindings.filter((item) => item.priority === "medium").map((item) => item.finding),
    [prioritizedFindings]
  );
  const designLowPoints = useMemo(
    () => prioritizedFindings.filter((item) => item.priority === "low").map((item) => item.finding),
    [prioritizedFindings]
  );
  const agentFindingCount = dataFindingCards.length + designFindingCards.length;
  const mismatchCount = crossPdfSummary ? crossPdfSummary.notOk : dataCriticalPoints.length;
  const priorityCounts = useMemo(
    () => ({
      critical: mismatchCount,
      medium: prioritizedFindings.filter((item) => item.priority === "medium").length,
      low: prioritizedFindings.filter((item) => item.priority === "low").length
    }),
    [mismatchCount, prioritizedFindings]
  );
  const excelCount = discovery.counts.excelFiles;
  const checklistCount = discovery.counts.checklists;
  const readiness =
    Boolean(config.projectName.trim()) &&
    Boolean(config.selectedChecklistPath) &&
    config.selectedExcelPaths.length > 0;
  const reportText = buildReportText({
    config,
    files,
    runResult,
    runError
  });
  const repositoryFolder =
    repository?.folderAbsolute
    || `D:\\AIReview\\project\\${projectFolderPreview(username || "unknown-user")}\\${projectFolderPreview(config.projectName || "excel-pdf-data-review")}`;
  const showServerInputPaths = isAdminSession(username, userType);
  const generatedFiles = generatedReviewFiles(runResult, repository);
  const checklistGridColumns = checklistGrid?.columns?.length ? checklistGrid.columns : ["S.NO", "Check Points"];
  const checklistGridRows = checklistGrid?.rows || [];
  const checklistSerialColumnIndex =
    typeof checklistGrid?.serialColumn === "number" && checklistGrid.serialColumn > 0 ? checklistGrid.serialColumn - 1 : -1;
  const checklistGridTemplate = {
    "--editor-columns": `54px repeat(${checklistGridColumns.length}, minmax(150px, 1fr)) 38px`
  } as CSSProperties;

  function actorQuery() {
    return `actorUserName=${encodeURIComponent(username)}&actorUserType=${encodeURIComponent(userType)}`;
  }

  function withActorQuery(url: string) {
    return `${url}${url.includes("?") ? "&" : "?"}${actorQuery()}`;
  }

  function withActorBody<T extends Record<string, unknown>>(body: T): T & { actorUserName: string; actorUserType: string } {
    return {
      ...body,
      actorUserName: username,
      actorUserType: userType
    };
  }

  function appendActorFields(formData: FormData) {
    formData.append("actorUserName", username);
    formData.append("actorUserType", userType);
  }

  function repositoryFileUrl(filePath: string, inline = false) {
    const params = new URLSearchParams({
      path: filePath,
      actorUserName: username,
      actorUserType: userType
    });
    if (inline) params.set("inline", "1");
    return `/api/excel-pdf-data/repository/download?${params.toString()}`;
  }

  function reviewInputLocationLabel(pathValue: string, label: string) {
    if (showServerInputPaths) return pathValue || "-";
    return pathValue
      ? `${label} uploaded from this login user's browser.`
      : `Use Browse to select ${label.toLowerCase()} from this login user's system.`;
  }

  function clearReviewOutput() {
    setRunResult(null);
    setRepository(null);
    setReviewSummary(null);
    setPreviewFile(null);
    setSummaryToggles({});
    setRunError("");
    setShowSuccessPopup(false);
    setLastRun("Not run in this session");
  }

  useEffect(() => {
    void loadDefaults();
  }, []);

  useEffect(() => {
    if (!defaultProjectName) return;
    clearReviewOutput();
    setReviewStatus("ready");
    setConfig((current) => ({
      ...current,
      projectName: defaultProjectName
    }));
  }, [defaultProjectName]);

  useEffect(() => {
    if (!autoSelectLatestChecklist || !editorChecklists.length) return;
    if (!editorChecklistPath) return;
    const latestChecklist = latestChecklistForSelection(editorChecklists, editorChecklistPath);
    if (!latestChecklist || latestChecklist.path === editorChecklistPath) return;
    setEditorChecklistPath(latestChecklist.path);
  }, [autoSelectLatestChecklist, editorChecklists, editorChecklistPath]);

  useEffect(() => {
    checklistSheetsRequestRef.current += 1;
    checklistGridRequestRef.current += 1;
    setChecklistSheets([]);
    setSelectedChecklistSheet("");
    setChecklistGrid(null);
    setLoadingChecklistGrid(false);
    if (!editorChecklistPath) return;
    void loadChecklistSheets(editorChecklistPath, checklistSheetsRequestRef.current);
  }, [editorChecklistPath]);

  useEffect(() => {
    const requestId = ++checklistGridRequestRef.current;
    if (!editorChecklistPath || !selectedChecklistSheet) {
      setChecklistGrid(null);
      setLoadingChecklistGrid(false);
      return;
    }
    setChecklistGrid(null);
    void loadChecklistSheetGrid(editorChecklistPath, selectedChecklistSheet, requestId);
  }, [editorChecklistPath, selectedChecklistSheet]);

  async function loadDefaults() {
    try {
      setLoadingInputs(true);
      const result = await apiGet<DefaultsResponse>(withActorQuery("/api/excel-pdf-data/defaults"));
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
      setEditorChecklists(result.files.checklists);
      setEditorChecklistInput(result.config.checklistInput);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Could not load Excel-only review defaults.");
    } finally {
      setLoadingInputs(false);
    }
  }

  async function refreshFiles() {
    try {
      setLoadingInputs(true);
      clearReviewOutput();
      const result = await apiPost<DefaultsResponse>("/api/excel-pdf-data/discover", withActorBody(config));
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
      setEditorChecklists(result.files.checklists);
      setEditorChecklistInput(result.config.checklistInput);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Could not discover source files.");
    } finally {
      setLoadingInputs(false);
    }
  }

  async function loadChecklistSheets(checklistPath: string, requestId = ++checklistSheetsRequestRef.current) {
    if (!checklistPath) {
      setChecklistSheets([]);
      setSelectedChecklistSheet("");
      setChecklistGrid(null);
      return;
    }
    try {
      const result = await apiGet<ChecklistSheetsResponse>(
        withActorQuery(`/api/excel-pdf-data/checklist/sheets?path=${encodeURIComponent(checklistPath)}`)
      );
      if (requestId !== checklistSheetsRequestRef.current) return;
      const sheets = result.sheets || [];
      setChecklistSheets(sheets);
      setSelectedChecklistSheet(sheets[0]?.name || "");
      if (!sheets.length) setChecklistGrid(null);
    } catch (error) {
      if (requestId !== checklistSheetsRequestRef.current) return;
      setChecklistSheets([]);
      setSelectedChecklistSheet("");
      setChecklistRevisionStatus(error instanceof Error ? error.message : "Could not read checklist sheets.");
    }
  }

  async function loadChecklistSheetGrid(checklistPath: string, sheetName: string, requestId = ++checklistGridRequestRef.current) {
    try {
      setLoadingChecklistGrid(true);
      const result = await apiGet<ChecklistSheetGridResponse>(
        withActorQuery(`/api/excel-pdf-data/checklist/sheet?path=${encodeURIComponent(checklistPath)}&sheetName=${encodeURIComponent(sheetName)}`)
      );
      if (requestId !== checklistGridRequestRef.current) return;
      setChecklistGrid({
        ...result,
        rows: result.rows.map((row) => ({
          ...row,
          values: normalizeGridValues(row.values, result.columns.length)
        }))
      });
    } catch (error) {
      if (requestId !== checklistGridRequestRef.current) return;
      setChecklistGrid(null);
      setChecklistRevisionStatus(error instanceof Error ? error.message : "Could not load checklist worksheet.");
    } finally {
      if (requestId === checklistGridRequestRef.current) {
        setLoadingChecklistGrid(false);
      }
    }
  }

  function updateChecklistGridCell(rowIndex: number, columnIndex: number, value: string) {
    if (checklistSerialColumnIndex >= 0 && columnIndex === checklistSerialColumnIndex) return;
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
      if (current.serialColumn > 0) {
        values[Math.max(0, current.serialColumn - 1)] = String(current.rows.length + 1);
      }
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
    const knownSheetNames = new Set(checklistSheets.map((sheet) => sheet.name));
    const validSelectedSheet =
      selectedChecklistSheet && (!knownSheetNames.size || knownSheetNames.has(selectedChecklistSheet)) ? selectedChecklistSheet : "";
    const validGridSheet = checklistGrid?.sheetName && knownSheetNames.has(checklistGrid.sheetName) ? checklistGrid.sheetName : "";
    const sheetName = validSelectedSheet || validGridSheet || checklistSheets[0]?.name || "";
    if (!checklistGrid || !sheetName) {
      setChecklistRevisionStatus("Select a checklist sheet before saving.");
      return;
    }
    if (checklistGrid.sheetName && checklistGrid.sheetName !== sheetName) {
      setChecklistRevisionStatus("Checklist sheet is still loading. Please wait for the selected sheet to finish loading, then save again.");
      return;
    }
    const editableRows = checklistGrid.rows
      .map((row) => normalizeGridValues(row.values, checklistGrid.columns.length))
      .filter((values) =>
        values.some((value, index) => (checklistSerialColumnIndex < 0 || index !== checklistSerialColumnIndex) && value.trim())
      );
    if (!editableRows.length) {
      setChecklistRevisionStatus("At least one checklist row is required before saving.");
      return;
    }

    try {
      setSavingChecklistRevision(true);
      setChecklistRevisionStatus("");
      const result = await apiPost<ChecklistRevisionResponse>("/api/excel-pdf-data/checklist/revision/edit", withActorBody({
        ...config,
        checklistInput: editorChecklistInput || config.checklistInput,
        selectedChecklistPath: editorChecklistPath,
        sheetName,
        rows: editableRows
      }));
      setEditorChecklists(result.files.checklists);
      setEditorChecklistPath(result.createdFile.path);
      setEditorChecklistInput(parentFolderFromPath(result.createdFile.path));
      setChecklistRevisionStatus(
        `Generic Checklist saved as ${result.revisionLabel}; ${result.saved.updatedCount || editableRows.length} row(s) saved.`
      );
      clearReviewOutput();
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
    clearReviewOutput();
  }

  function toggleAutoSelectLatestChecklist(checked: boolean) {
    setAutoSelectLatestChecklist(checked);
    localStorage.setItem(latestChecklistPreferenceKey, checked ? "true" : "false");
    if (!checked) return;
    if (!editorChecklistPath) return;
    const latestChecklist = latestChecklistForSelection(editorChecklists, editorChecklistPath);
    if (latestChecklist) {
      setEditorChecklistPath(latestChecklist.path);
    }
  }

  function toggleExcelSelection(pathValue: string) {
    clearReviewOutput();
    setConfig((current) => {
      const allPaths = discovery.excelFiles.map((file) => file.path);
      const selected = togglePath(current.selectedExcelPaths, pathValue, allPaths);
      return {
        ...current,
        selectedExcelPaths: selected,
        selectedExcelPath: selected[0] || ""
      };
    });
  }

  function togglePdfSelection(pathValue: string) {
    clearReviewOutput();
    setConfig((current) => {
      const allPaths = discovery.pdfFiles.map((file) => file.path);
      const selected = togglePath(current.selectedPdfPaths, pathValue, allPaths);
      return {
        ...current,
        selectedPdfPaths: selected,
        selectedPdfPath: selected[0] || ""
      };
    });
  }

  async function uploadReviewInputFiles(kind: "checklist" | "excel" | "pdf", fileList: FileList | null) {
    const selectedFiles = Array.from(fileList || []);
    if (!selectedFiles.length) return;

    const formData = new FormData();
    appendActorFields(formData);
    formData.append("projectName", config.projectName || "excel-pdf-data-review");
    selectedFiles.forEach((file) => formData.append("files", file));

    setUploadingInputKind(kind);
    clearReviewOutput();
    if (kind === "checklist") {
      checklistSheetsRequestRef.current += 1;
      checklistGridRequestRef.current += 1;
      setChecklistSheets([]);
      setSelectedChecklistSheet("");
      setChecklistGrid(null);
      setLoadingChecklistGrid(false);
      setChecklistRevisionStatus("");
    }

    try {
      const result = await apiPost<ReviewInputUploadResult>(withActorQuery(`/api/excel-pdf-data/upload/${kind}`), formData);
      setDiscovery((current) => {
        if (kind === "checklist") {
          return {
            ...current,
            checklists: result.files,
            selected: {
              ...current.selected,
              checklistPath: result.selectedPaths[0] || ""
            },
            counts: {
              ...current.counts,
              checklists: result.files.length
            }
          };
        }
        if (kind === "excel") {
          return {
            ...current,
            excelFiles: result.files,
            selected: {
              ...current.selected,
              excelPath: result.selectedPaths[0] || "",
              excelPaths: result.selectedPaths
            },
            counts: {
              ...current.counts,
              excelFiles: result.files.length
            }
          };
        }
        return {
          ...current,
          pdfFiles: result.files,
          selected: {
            ...current.selected,
            pdfPath: result.selectedPaths[0] || "",
            pdfPaths: result.selectedPaths
          },
          counts: {
            ...current.counts,
            pdfFiles: result.files.length
          }
        };
      });
      setConfig((current) =>
        kind === "checklist"
          ? {
              ...current,
              checklistInput: result.folder,
              selectedChecklistPath: result.selectedPaths[0] || ""
            }
          : kind === "excel"
          ? {
              ...current,
              excelFolder: result.folder,
              selectedExcelPath: result.selectedPaths[0] || "",
              selectedExcelPaths: result.selectedPaths
            }
          : {
              ...current,
              pdfFolder: result.folder,
              selectedPdfPath: result.selectedPaths[0] || "",
              selectedPdfPaths: result.selectedPaths
            }
      );
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Could not browse selected review files.");
    } finally {
      setUploadingInputKind("");
    }
  }

  async function uploadChecklistEditorFile(fileList: FileList | null) {
    const selectedFiles = Array.from(fileList || []);
    if (!selectedFiles.length) return;

    const formData = new FormData();
    appendActorFields(formData);
    formData.append("projectName", config.projectName || "excel-pdf-data-review");
    formData.append("files", selectedFiles[0]);

    setUploadingEditorChecklist(true);
    checklistSheetsRequestRef.current += 1;
    checklistGridRequestRef.current += 1;
    setEditorChecklistPath("");
    setChecklistSheets([]);
    setSelectedChecklistSheet("");
    setChecklistGrid(null);
    setLoadingChecklistGrid(false);
    setChecklistRevisionStatus("");

    try {
      const result = await apiPost<ReviewInputUploadResult>(withActorQuery("/api/excel-pdf-data/upload/checklist"), formData);
      setEditorChecklists(result.files);
      setEditorChecklistPath(result.selectedPaths[0] || "");
      setEditorChecklistInput(result.folder);
    } catch (error) {
      setChecklistRevisionStatus(error instanceof Error ? error.message : "Could not browse selected checklist workbook.");
    } finally {
      setUploadingEditorChecklist(false);
    }
  }

  async function runReview() {
    if (!readiness || reviewStatus === "running" || uploadingInputKind) return;
    const projectNameForRun = config.projectName.trim();
    setReviewStatus("running");
    setRunError("");
    setRunResult(null);
    setRepository(null);
    setReviewSummary(null);
    setPreviewFile(null);
    setShowSuccessPopup(false);
    try {
      const result = await apiPost<AgentRunResult>("/api/excel-pdf-data/run", withActorBody({ ...config, userName: username }));
      setRunResult(result);
      if (result.files) setDiscovery(result.files);
      setReviewStatus("complete");
      setLastRun(formatTimestamp(new Date(result.completedAt || Date.now())));
      await loadRepository(projectNameForRun);
      setShowSuccessPopup(true);
    } catch (error) {
      setReviewStatus("ready");
      setRunError(error instanceof Error ? error.message : "Excel data and design review failed.");
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
      const result = await apiGet<RepositoryResponse>(
        withActorQuery(`/api/excel-pdf-data/repository?projectName=${encodeURIComponent(name)}&userName=${encodeURIComponent(username)}`)
      );
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
      const result = await apiGet<ReviewSummary>(
        withActorQuery(`/api/excel-pdf-data/repository/summary?projectName=${encodeURIComponent(name)}&userName=${encodeURIComponent(username)}`)
      );
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
      const result = await apiGet<PreviewFile>(withActorQuery(`/api/excel-pdf-data/repository/view?path=${encodeURIComponent(file.path)}`));
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
            <span className="eyebrow">excel_file_data_design review agent</span>
            <h2>Excel Data and Design Review</h2>
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
        {phaseGuide}

        <section className="review-workbench">
          <section className="review-command-panel">
            <div className="review-command-copy">
              <span className="eyebrow">Current packet</span>
              <h3>{config.projectName.trim() || "Project name required"}</h3>
              <p>
                Select one checklist, then browse or select one or more Excel reports for data and design validation. PDF files are not required.
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
              <button className="primary-btn" onClick={runReview} disabled={!readiness || loadingInputs || reviewStatus === "running" || Boolean(uploadingInputKind)}>
                {reviewStatus === "running" ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
                Run Review
              </button>
            </div>
          </section>

          <div className="review-summary-grid">
            <ReviewMetric icon={<FileCheck2 size={18} />} label="Checklists" value={checklistCount} tone="neutral" />
            <ReviewMetric icon={<FileSpreadsheet size={18} />} label="Excel files" value={excelCount} tone="good" />
            <ReviewMetric icon={<FileSpreadsheet size={18} />} label="Selected Excel" value={config.selectedExcelPaths.length} tone="neutral" />
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
                  <p>Files discovered from the checklist and Excel report folders.</p>
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
                      {reviewFileDisplayName(file)}
                      <small>{file.kind} | {file.sourceType} | {formatBytes(file.size)}</small>
                    </span>
                    <strong>{file.status}</strong>
                  </div>
                ))}
                {files.length === 0 && <div className="empty-note">No checklist or Excel files found for the configured paths.</div>}
              </div>
            </section>}

            <div className="matrix-count-grid agent-input-matrix-grid">
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
                  {summary.detail && <small className="matrix-count-detail">{summary.detail}</small>}
                </div>
              ))}
            </div>

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
                <div className="path-field form-field">
                  <span>Checklist Selection</span>
                  <div className="browse-selection-row">
                    <select
                      value={config.selectedChecklistPath}
                      onChange={(event) => updateConfig({ selectedChecklistPath: event.target.value })}
                    >
                      <option value="">No file selected</option>
                      {discovery.checklists.map((file) => (
                        <option key={file.path} value={file.path}>
                          {reviewFileDisplayName(file)}
                        </option>
                      ))}
                    </select>
                    <label className={`browse-input-button ${uploadingInputKind === "checklist" ? "busy" : ""}`}>
                      {uploadingInputKind === "checklist" ? <Loader2 className="spin" size={16} /> : <Upload size={16} />}
                      Browse
                      <input
                        accept=".xlsx,.xls"
                        disabled={reviewStatus === "running" || Boolean(uploadingInputKind)}
                        onChange={(event) => {
                          void uploadReviewInputFiles("checklist", event.target.files);
                          event.target.value = "";
                        }}
                        type="file"
                      />
                    </label>
                  </div>
                  <small>{reviewInputLocationLabel(config.checklistInput, "Checklist")}</small>
                  <small>Browse opens this login user's system and uploads the selected checklist for this review run.</small>
                </div>
                <div className="path-field form-field">
                  <span>Excel Report Selection</span>
                  <div className="browse-selection-row">
                    <MultiFileSelection
                      allLabel="All Excel Reports"
                      files={discovery.excelFiles}
                      selectedPaths={config.selectedExcelPaths}
                      onToggle={toggleExcelSelection}
                    />
                    <label className={`browse-input-button ${uploadingInputKind === "excel" ? "busy" : ""}`}>
                      {uploadingInputKind === "excel" ? <Loader2 className="spin" size={16} /> : <Upload size={16} />}
                      Browse
                      <input
                        accept=".xlsx,.xls,.xlsm,.xlsb"
                        disabled={reviewStatus === "running" || Boolean(uploadingInputKind)}
                        multiple
                        onChange={(event) => {
                          void uploadReviewInputFiles("excel", event.target.files);
                          event.target.value = "";
                        }}
                        type="file"
                      />
                    </label>
                  </div>
                  <small>{reviewInputLocationLabel(config.excelFolder, "Excel reports")}</small>
                  <small>Browse opens this login user's system and uploads the selected Excel file(s) for this review run.</small>
                </div>
                <button className="primary-btn agent-input-run" onClick={runReview} disabled={!readiness || loadingInputs || reviewStatus === "running" || Boolean(uploadingInputKind)}>
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
            <div className="path-field checklist-sheet-picker">
              <span>Checklist Selection</span>
              <div className="browse-selection-row">
                <select
                  value={editorChecklistPath}
                  onChange={(event) => setEditorChecklistPath(event.target.value)}
                  disabled={!editorChecklists.length || savingChecklistRevision || uploadingEditorChecklist}
                >
                  <option value="">No file selected</option>
                  {editorChecklists.map((file) => (
                    <option key={file.path} value={file.path}>
                      {reviewFileDisplayName(file)}
                    </option>
                  ))}
                </select>
                <label className={`browse-input-button ${uploadingEditorChecklist ? "busy" : ""}`}>
                  {uploadingEditorChecklist ? <Loader2 className="spin" size={16} /> : <Upload size={16} />}
                  Browse
                  <input
                    accept=".xlsx,.xls"
                    disabled={reviewStatus === "running" || savingChecklistRevision || uploadingEditorChecklist}
                    onChange={(event) => {
                      void uploadChecklistEditorFile(event.target.files);
                      event.target.value = "";
                    }}
                    type="file"
                  />
                </label>
              </div>
              <small>{reviewInputLocationLabel(editorChecklistInput || config.checklistInput, "Checklist")}</small>
            </div>
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
                onClick={() => selectedChecklistSheet && void loadChecklistSheetGrid(editorChecklistPath, selectedChecklistSheet)}
                disabled={loadingChecklistGrid || !editorChecklistPath || !selectedChecklistSheet}
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
                          className={checklistSerialColumnIndex >= 0 && columnIndex === checklistSerialColumnIndex ? "locked" : ""}
                          key={`${column}-${columnIndex}`}
                          onChange={(event) => updateChecklistGridCell(rowIndex, columnIndex, event.target.value)}
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

          <section className="review-panel individual-verification-panel" id="individual-checklist-verification">
            <div className="review-panel-header">
              <div className="section-title">
                <ClipboardCheck size={16} />
                <span>Individual Checklist Verification</span>
              </div>
              <span className="gate-count-pill">
                {individualVerificationRowCount} report checks
              </span>
            </div>
            <div className="findings-count-note">
              Each row is one selected report verified against one checklist point. Cross-report verification remains available in the matrix and correction sections.
            </div>
            {individualVerificationGroups.length ? (
              <div className="individual-verification-groups">
                {individualVerificationGroups.map((group) => (
                  <IndividualVerificationGroup group={group} key={group.id || group.title} />
                ))}
              </div>
            ) : (
              <div className="empty-note">Run or refresh the review to load individual checklist verification rows.</div>
            )}
          </section>

          <section className="review-panel correction-observations-panel" id="correction-observations">
            <div className="review-panel-header">
              <div className="section-title">
                <AlertTriangle size={16} />
                <span>Correction Observations From Review Files</span>
              </div>
              <span className="gate-count-pill">
                {correctionObservations.length} checklist corrections
              </span>
            </div>
            <div className="findings-count-note">
              This table counts checklist correction items from the Design and Data Validation Check Matrix. Row-level reconciliation mismatch totals are not shown in this checklist correction section.
            </div>
            {correctionObservations.length ? (
              <div className="correction-observation-groups">
                <CorrectionObservationGroup
                  emptyText="No data correction observations found in the latest review files."
                  observations={dataCorrectionObservations}
                  title="Data Correction Observations"
                  tone="data"
                />
                <CorrectionObservationGroup
                  emptyText="No design correction observations found in the latest review files."
                  observations={designCorrectionObservations}
                  title="Design Correction Observations"
                  tone="design"
                />
              </div>
            ) : (
              <div className="empty-note">Run or refresh the review to load correction observations from the latest review files.</div>
            )}
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
                      {file.displayName || file.name}
                      <small>{file.artifactType} | {formatBytes(file.size)} | {formatTimestamp(new Date(file.modifiedAt))}</small>
                    </span>
                    <div className="repository-actions">
                      {file.extension === ".pdf" ? (
                        <a
                          className="icon-action"
                          href={repositoryFileUrl(file.path, true)}
                          target="_blank"
                          rel="noreferrer"
                          title={`Open ${file.displayName || file.name}`}
                        >
                          <Eye size={15} />
                        </a>
                      ) : (
                        <button
                          className="icon-action"
                          disabled={!file.canView || previewLoadingPath === file.path}
                          onClick={() => void viewRepositoryFile(file)}
                          title={file.canView ? `View ${file.displayName || file.name}` : "Preview is available for .txt and .md files"}
                          type="button"
                        >
                          {previewLoadingPath === file.path ? <Loader2 className="spin" size={15} /> : <Eye size={15} />}
                        </button>
                      )}
                      <a
                        className="icon-action"
                        href={repositoryFileUrl(file.path)}
                        title={`Download ${file.displayName || file.name}`}
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
              <a className="secondary-btn" href={repositoryFileUrl(previewFile.path)}>
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
  const triggerLabel = files.length === 0 ? "No files found" : allSelected ? allLabel : selectedCount > 0 ? `${selectedCount} reports selected` : "No file selected";
  const triggerMeta = files.length === 0 ? "0 files" : selectedCount > 0 ? `${selectedCount} of ${files.length} selected` : "";
  const triggerStateClass = selectedCount > 0 ? "has-selection" : "empty-selection";

  function selectPath(pathValue: string) {
    onToggle(pathValue);
    setOpen(false);
  }

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

    document.addEventListener("click", closeWhenOutside);
    document.addEventListener("touchend", closeWhenOutside);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("click", closeWhenOutside);
      document.removeEventListener("touchend", closeWhenOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className={`multi-file-dropdown ${open ? "open" : ""}`} ref={dropdownRef}>
      <button
        aria-expanded={open}
        className={`multi-file-trigger ${triggerStateClass} ${allSelected ? "selected" : ""}`}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span>
          {triggerLabel}
          {triggerMeta && <small>{triggerMeta}</small>}
        </span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="multi-file-menu">
          <label className={`multi-file-option all ${allSelected ? "selected" : ""}`}>
            <input checked={allSelected} disabled={files.length === 0} type="checkbox" onChange={() => selectPath("__all__")} />
            <span>{allLabel}</span>
          </label>
          {files.map((file) => (
            <label className={`multi-file-option ${selectedPaths.includes(file.path) ? "selected" : ""}`} key={file.path}>
              <input checked={selectedPaths.includes(file.path)} type="checkbox" onChange={() => selectPath(file.path)} />
              <span>{file.name}</span>
            </label>
          ))}
          {files.length === 0 && <div className="empty-note">No files found.</div>}
        </div>
      )}
    </div>
  );
}

function IndividualVerificationGroup({ group }: { group: ChecklistVerificationGroup }) {
  const rows = group.rows || [];
  return (
    <div className={`individual-verification-group ${statusClass(group.area || group.title || "review")}`}>
      <div className="correction-observation-group-head">
        <strong>{group.title || `${group.area || "Checklist"} Individual Checklist Verification`}</strong>
        <span>
          OK {group.ok || 0} | Not OK {group.notOk || 0} | NA {group.na || 0}
        </span>
      </div>
      {rows.length ? (
        <div className="correction-observation-table-wrap">
          <table className="correction-observation-table individual-verification-table">
            <thead>
              <tr>
                <th>Point</th>
                <th>Checklist S.NO</th>
                <th>Report</th>
                <th>Area</th>
                <th>State</th>
                <th>Check Point</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${group.id}-${row.checklistSNo || row.point}-${row.report || index}-${index}`}>
                  <td>{row.point || index + 1}</td>
                  <td>{row.checklistSNo || "-"}</td>
                  <td>{row.report || "-"}</td>
                  <td>{row.area || group.area || "-"}</td>
                  <td>
                    <span className={`correction-state ${statusClass(row.state || "")}`}>
                      {row.state || "-"}
                    </span>
                  </td>
                  <td>{row.checkPoint || "-"}</td>
                  <td>{row.evidence || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-note">No individual verification rows found for this checklist group.</div>
      )}
    </div>
  );
}

function CorrectionObservationGroup({
  emptyText,
  observations,
  title,
  tone
}: {
  emptyText: string;
  observations: CorrectionObservation[];
  title: string;
  tone: "data" | "design";
}) {
  return (
    <div className={`correction-observation-group ${tone}`}>
      <div className="correction-observation-group-head">
        <strong>{title}</strong>
        <span>{observations.length} Not OK</span>
      </div>
      {observations.length ? (
        <div className="correction-observation-table-wrap">
          <table className="correction-observation-table">
            <thead>
              <tr>
                <th>Point</th>
                <th>Checklist S.NO</th>
                <th>Report</th>
                <th>State</th>
                <th>Check Point</th>
                <th>Observation</th>
                <th>Correction Required</th>
              </tr>
            </thead>
            <tbody>
              {observations.map((observation, index) => (
                <tr key={`${title}-${observation.checklistSNo || observation.title}-${observation.report || index}-${index}`}>
                  <td>{observation.point || index + 1}</td>
                  <td>{observation.checklistSNo || "-"}</td>
                  <td>{observation.report || "-"}</td>
                  <td>
                    <span className={`correction-state ${statusClass(observation.state || observation.severity)}`}>
                      {observation.state || observation.severity || "-"}
                    </span>
                  </td>
                  <td>{observation.checkPoint || observation.title || "-"}</td>
                  <td>{observation.observation || observation.detail || "-"}</td>
                  <td>{observation.correctionRequired || observation.recommendation || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-note">{emptyText}</div>
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

function buildReportText({
  config,
  files,
  runResult,
  runError
}: {
  config: AgentConfig;
  files: ReviewFile[];
  runResult: AgentRunResult | null;
  runError: string;
}) {
  if (runResult?.stdout) {
    const outputPaths = Object.entries(runResult.parsed || {})
      .filter(([key]) => key.toLowerCase().includes("path") || key.toLowerCase().includes("folder"))
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n");
    return `# ${config.projectName || "Excel Data and Design Review"}

Project Name: ${config.projectName || "-"}
User Name: ${config.userName || "-"}
Selected Checklist: ${selectedFileName(files, config.selectedChecklistPath)}
Selected Excel Report(s): ${selectedFileNames(files, config.selectedExcelPaths)}
PDF Files: Not required

## Agent Output
${runResult.stdout.trim()}

${runResult.stderr ? `\n## stderr\n${runResult.stderr.trim()}\n` : ""}
${outputPaths ? `\n## Parsed Output Paths\n${outputPaths}` : ""}`;
  }

  if (runError) {
    return `# Excel data and design review could not run

${runError}

Check that the backend server is running and that the configured checklist and Excel paths exist.`;
  }

  return "";
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
  const file = files.find((item) => item.path === selectedPath);
  return file ? reviewFileDisplayName(file) : selectedPath || "-";
}

function selectedFileNames(files: ReviewFile[], selectedPaths: string[]) {
  return selectedPaths.map((selectedPath) => selectedFileName(files, selectedPath)).join(", ") || "-";
}

function reviewFileDisplayName(file: ReviewFile) {
  if (file.kind !== "Checklist") {
    return file.displayName || file.name;
  }
  const revision = file.revisionLabel || (typeof file.revisionNumber === "number" ? `Rev ${file.revisionNumber}` : "");
  return revision ? `Generic Checklist (${revision})` : "Generic Checklist";
}

function togglePath(current: string[], pathValue: string, allPaths: string[]) {
  if (pathValue === "__all__") {
    return current.length === allPaths.length ? [] : allPaths;
  }
  return current.includes(pathValue) ? current.filter((item) => item !== pathValue) : [...current, pathValue];
}

function projectFolderPreview(value: string) {
  return value
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
    .slice(0, 120) || "excel-pdf-data-review";
}

function isAdminSession(username: string, userType: string) {
  return username.trim().toLowerCase() === "rahul_raj" || userType.trim().toLowerCase() === "admin";
}

function formatTimestamp(value: Date) {
  const pad = (part: number) => String(part).padStart(2, "0");
  return [
    pad(value.getDate()),
    pad(value.getMonth() + 1),
    value.getFullYear()
  ].join("-") + ` ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
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

function parentFolderFromPath(filePath: string) {
  const index = Math.max(filePath.lastIndexOf("\\"), filePath.lastIndexOf("/"));
  return index > 0 ? filePath.slice(0, index) : "";
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

function isDesignCorrectionObservation(observation: CorrectionObservation) {
  const text = `${observation.area || ""} ${observation.title || ""} ${observation.checkPoint || ""}`.toLowerCase();
  return text.includes("design");
}

function isMismatchStatus(status: string) {
  return /mismatch|not ok|fail/i.test(status);
}

function evidencePointDetail(point: EvidenceRow) {
  const excel = point.excel.includes(":") ? point.excel : `Report 1: ${point.excel}`;
  const pdf = point.pdf.includes(":") ? point.pdf : `Report 2: ${point.pdf}`;
  return `${excel} | ${pdf}`;
}

function ComparisonValueGrid({ point }: { point: EvidenceRow }) {
  const left = comparisonValuePart(point.excel, "Report 1");
  const right = comparisonValuePart(point.pdf, "Report 2");
  return (
    <div className="critical-value-grid" aria-label="Compared report values">
      <div className="critical-value-card">
        <small>{left.label}</small>
        <strong>{left.value || "-"}</strong>
      </div>
      <div className="critical-value-card">
        <small>{right.label}</small>
        <strong>{right.value || "-"}</strong>
      </div>
    </div>
  );
}

function comparisonValuePart(text: string, fallbackLabel: string) {
  const value = String(text || "").trim();
  const separatorIndex = value.indexOf(":");
  if (separatorIndex < 0) {
    return { label: fallbackLabel, value };
  }
  const label = value.slice(0, separatorIndex).trim();
  const comparedValue = value.slice(separatorIndex + 1).trim();
  return {
    label: label || fallbackLabel,
    value: comparedValue
  };
}

function isRowPresenceMismatch(point: EvidenceRow, leftValue: string, rightValue: string) {
  const metric = String(point.metric || "").toLowerCase();
  const values = `${leftValue || ""} ${rightValue || ""}`.toLowerCase();
  return metric.includes("visible row presence")
    || metric.includes("row presence")
    || /\bmissing\b/.test(values) && /\bpresent\b/.test(values);
}

function presenceStatusText(value: string, reportLabel: string) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "missing") return `The row is missing in ${reportLabel}.`;
  if (normalized === "present") return `The row is present in ${reportLabel}.`;
  return "";
}

function dataCriticalExplanation(point: EvidenceRow) {
  const status = point.status || "mismatch";
  const isMismatch = /mismatch|not ok|fail/i.test(status);
  if (isMismatch) {
    return "This is a data validation point. The same metric or visible report row has different compared values for the selected report/date range, so it is classified as Data Critical.";
  }
  return "This point is part of the data validation evidence and should be reviewed against the selected report/date range.";
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
