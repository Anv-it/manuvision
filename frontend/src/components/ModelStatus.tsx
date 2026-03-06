import { useEffect, useState } from "react";
import { getHealth, type HealthResponse } from "../api/health";

export default function ModelStatus() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadHealth = async () => {
      try {
        const data = await getHealth();
        if (mounted) {
          setHealth(data);
          setError(null);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message || "Failed to fetch health");
        }
      }
    };

    loadHealth();
    const interval = setInterval(loadHealth, 15000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (error) {
    return (
      <div className="text-xs text-red-400">
        Backend unavailable
      </div>
    );
  }

  if (!health) {
    return (
      <div className="text-xs text-zinc-400">
        Loading model...
      </div>
    );
  }

  const statusColor =
    health.status === "ok"
      ? "text-emerald-400"
      : health.status === "no_model"
      ? "text-yellow-400"
      : "text-red-400";

  return (
    <div className="text-xs text-zinc-400 flex flex-wrap items-center gap-2">
      <span className={statusColor}>●</span>
      <span>Status: {health.status}</span>
      <span>•</span>
      <span>
        Model: {health.model_name} v{health.model_version}
      </span>
      <span>•</span>
      <span>Classes: {health.classes.length}</span>
      <span>•</span>
      <span>Samples: {health.samples}</span>
      <span>•</span>
      <span>
        Latency:{" "}
        {health.latency_ms !== null ? `${health.latency_ms} ms` : "—"}
      </span>
    </div>
  );
}