export type HealthResponse = {
  status: string;
  model_name: string;
  model_version: string;
  classes: string[];
  samples: number;
  latency_ms: number | null;
};

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch("http://localhost:8000/health");

  if (!res.ok) {
    throw new Error("Failed to fetch health");
  }

  return res.json();
}