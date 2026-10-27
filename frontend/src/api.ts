// 백엔드 API — 모든 호출은 이 파일 하나를 거친다 (풀스택 5장의 "모듈 하나" 원칙)
export const API = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ?? "";

export type Layer = { name: string; count: number; lengthM: number; suggestedWall: boolean };
export type Analysis = {
  unit: string;
  unitGuessed: boolean;
  scaleToM: number;
  bbox: [number, number, number, number];
  sizeM: [number, number];
  layers: Layer[];
  preview: { segments: [number, number, number, number, number][]; truncated: boolean; total: number };
};
export type UploadRes = { uploadId: string; kind: "dxf" | "image"; fileName?: string; analysis: Analysis | null; notice?: string };
export type JobOptions = { wallLayers: string[]; heightM: number; thicknessM: number; mode: "auto" | "outline" | "centerline" };
export type Metrics = {
  wallPieces: number; wallAreaM2: number; floorAreaM2: number; widthM: number; depthM: number;
  heightM: number; triangles: number; mode: "outline" | "centerline"; lineLengthM: number; seconds: number;
};
export type Job = {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  step: string;
  progress: number;
  error?: { code: string; message: string } | null;
  metrics?: Metrics;
  files?: Record<"glb" | "obj" | "stl", { url: string; bytes: number }>;
};

export class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit, timeoutMs = 60000): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API + path, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new ApiError("network", "서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body?.error?.message ?? (typeof body?.detail === "string" ? body.detail : null) ?? "요청을 처리하지 못했어요.";
    throw new ApiError(body?.error?.code ?? String(res.status), msg);
  }
  return body as T;
}

export const fileUrl = (url: string, download = false) => API + url + (download ? "?download=true" : "");

export function upload(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  return call<UploadRes>("/api/uploads", { method: "POST", body: fd }, 120000);
}

export function startJob(uploadId: string, opt: JobOptions) {
  return call<{ jobId: string }>("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadId, ...opt }),
  });
}

export const getJob = (id: string) => call<Job>(`/api/jobs/${id}`);

export async function sampleFile(): Promise<File> {
  const res = await fetch(API + "/api/sample.dxf");
  if (!res.ok) throw new ApiError("sample", "샘플 도면을 불러오지 못했어요.");
  return new File([await res.blob()], "sample-plan.dxf", { type: "application/dxf" });
}

export const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))}KB` : `${(n / 1024 / 1024).toFixed(1)}MB`);
