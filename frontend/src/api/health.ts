const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export type HealthResponse = {
  status: string;
  model_name: string;
  model_version: string;
  classes: string[];
  samples: number;
  latency_ms: number | null;
  dynamic_model_loaded?: boolean;
  dynamic_model_name?: string;
  dynamic_model_version?: string;
  dynamic_classes?: string[];
  dynamic_latency_ms?: number | null;
};

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`);

  if (!res.ok) {
    throw new Error("Failed to fetch health");
  }

  return res.json();
}
