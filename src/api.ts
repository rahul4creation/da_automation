export type GateStatus = "Complete" | "Incomplete" | "Blocked" | "Not applicable";

export type GateRow = {
  item: string;
  requiredCondition: string;
  status: GateStatus;
  evidence: string;
  owner: string;
  notes: string;
};

export type GateState = {
  projectContext: GateRow[];
  entry: GateRow[];
  exit: GateRow[];
  updatedAt?: string;
};

export type UploadArtifact = {
  id: string;
  originalName: string;
  storedName: string;
  size: number;
  mimetype: string;
  uploadedAt: string;
};

export type PhaseState = {
  status: string;
  gateRecommendation: string;
  lastArtifact: string;
  updatedAt: string;
};

export type Phase = {
  id: string;
  number: number;
  title: string;
  artifactName: string;
  outputTitle: string;
  state: PhaseState;
  artifactPath: string;
  outputText: string;
  uploads: UploadArtifact[];
  gate: GateState;
  outputs: Array<{ name: string; path: string }>;
};

export type ProjectSummary = {
  projectId: string;
  projectName: string;
  owner: string;
  status: string;
  currentPhaseId: string;
  targetPlatform: string;
  updatedAt: string;
};

export type ProjectDetail = ProjectSummary & {
  phases: Phase[];
};

export type PhaseDefinition = {
  id: string;
  number: number;
  title: string;
  artifactName: string;
  outputTitle: string;
};

const API_BASE = "";

export async function apiGet<T>(url: string): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`);
  return parseResponse<T>(response);
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    method: "POST",
    headers: body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    body: body instanceof FormData ? body : JSON.stringify(body ?? {})
  });
  return parseResponse<T>(response);
}

export async function apiPut<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {})
  });
  return parseResponse<T>(response);
}

export async function apiDelete<T>(url: string): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    method: "DELETE"
  });
  return parseResponse<T>(response);
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error || `Request failed with ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}
