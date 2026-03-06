import React, { useEffect, useRef, useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

function meanAggregate(frames) {
  const out = Array.from({ length: 21 }, () => [0, 0, 0]);
  for (const frame of frames) {
    for (let i = 0; i < 21; i++) {
      out[i][0] += frame[i][0];
      out[i][1] += frame[i][1];
      out[i][2] += frame[i][2];
    }
  }
  for (let i = 0; i < 21; i++) {
    out[i][0] /= frames.length;
    out[i][1] /= frames.length;
    out[i][2] /= frames.length;
  }
  return out;
}

export default function Translate({
  prediction,
  latestLandmarksRef,
  latestHandednessRef,
  handDetected,
  trackerStatus,
  stream,
}) {
  const videoRef = useRef(null);

  const pred = prediction ?? { label: "-", confidence: 0, latency_ms: null };
  const SMOOTH_N = 7;
  const CONF_THRESH = 0.6;

  const confPct = Math.round((pred.confidence ?? 0) * 100);
  const isGated = pred.label === "…";
  const latencyText = pred.latency_ms != null ? `${pred.latency_ms} ms` : "—";

  const [targetLabel, setTargetLabel] = useState("A");
  const [saving, setSaving] = useState(false);
  const [lastSavedId, setLastSavedId] = useState(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  async function captureSample() {
    const CAPTURE_FRAMES = 10;
    const frames = [];

    setSaving(true);
    try {
      for (let i = 0; i < CAPTURE_FRAMES; i++) {
        const lm = latestLandmarksRef?.current;
        if (lm && lm.length === 21) frames.push(lm);
        await new Promise((r) => setTimeout(r, 100));
      }

      if (frames.length < 5) throw new Error("Not enough frames captured (hand lost?)");

      const aggregated = meanAggregate(frames);

      const session_id =
        localStorage.getItem("manuvision_session_id") ?? crypto.randomUUID();
      localStorage.setItem("manuvision_session_id", session_id);

      const res = await axios.post(`${API_BASE}/v1/samples`, {
        label: targetLabel,
        landmarks: aggregated,
        handedness: latestHandednessRef?.current ?? null,
        session_id,
      });

      setLastSavedId(res.data?.id ?? null);
    } catch (e) {
      console.error(e);
      alert("Failed to save sample. Check console + backend logs.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white border rounded-2xl p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Translate</h2>
            <div className="mt-1 text-sm text-zinc-600">{trackerStatus}</div>
          </div>

          <span
            className={[
              "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs",
              handDetected ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600",
            ].join(" ")}
          >
            <span
              className={[
                "h-2 w-2 rounded-full",
                handDetected ? "bg-emerald-500" : "bg-zinc-400",
              ].join(" ")}
            />
            {handDetected ? "Hand detected" : "No hand"}
          </span>
        </div>

        <div className="bg-zinc-100 rounded-xl overflow-hidden border">
          <video
            ref={videoRef}
            className="w-full max-w-full h-auto"
            autoPlay
            playsInline
            muted
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="text-sm text-zinc-600">Label</div>

          <select
            className="border rounded-lg px-3 py-2 text-sm bg-white"
            value={targetLabel}
            onChange={(e) => setTargetLabel(e.target.value)}
          >
            {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((ch) => (
              <option key={ch} value={ch}>
                {ch}
              </option>
            ))}
          </select>

          <button
            onClick={captureSample}
            disabled={saving || !latestLandmarksRef?.current}
            className={[
              "px-4 py-2 rounded-lg text-sm font-medium transition",
              saving || !latestLandmarksRef?.current
                ? "bg-zinc-200 text-zinc-500 cursor-not-allowed"
                : "bg-black text-white hover:opacity-90",
            ].join(" ")}
          >
            {saving ? "Saving..." : "Capture Sample"}
          </button>

          {lastSavedId && (
            <span className="text-sm text-zinc-600">Saved #{lastSavedId}</span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="bg-white border rounded-2xl p-6 shadow-sm">
          <div className="text-xs text-zinc-500">Prediction</div>
          <div className="mt-2 flex items-end gap-3">
            <div className="text-6xl font-semibold tracking-tight">{pred.label}</div>
            <div className="pb-2 text-sm text-zinc-500">
              {isGated ? "Below threshold" : "Live"}
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-xs text-zinc-500">Confidence</div>
            <div className="text-xs text-zinc-500">
              Smooth {SMOOTH_N} • Gate {Math.round(CONF_THRESH * 100)}%
            </div>
          </div>

          <div className="mt-3 text-2xl font-medium">{confPct}%</div>

          <div className="mt-3 h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
            <div
              className="h-full bg-black"
              style={{ width: `${Math.min(100, Math.max(0, confPct))}%` }}
            />
          </div>

          <div className="mt-3 text-xs text-zinc-500">
            {isGated
              ? `Prediction gated: confidence ${confPct}% < ${Math.round(CONF_THRESH * 100)}%`
              : `Prediction unlocked: confidence ${confPct}%`}
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-6 shadow-sm">
          <div className="text-xs text-zinc-500">Inference Telemetry</div>

          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-zinc-500">Latency</div>
              <div className="mt-1 text-lg font-medium">{latencyText}</div>
            </div>

            <div>
              <div className="text-xs text-zinc-500">Polling</div>
              <div className="mt-1 text-lg font-medium">200 ms</div>
            </div>
          </div>

          <div className="text-xs text-zinc-500">
            Handedness: {latestHandednessRef?.current ?? "—"}
          </div>

          <div className="mt-4 text-xs text-zinc-500">
            Latest backend inference response time from{" "}
            <code className="px-1 py-0.5 bg-zinc-100 rounded">/v1/predict</code>
          </div>
        </div>
      </div>
    </div>
  );
}