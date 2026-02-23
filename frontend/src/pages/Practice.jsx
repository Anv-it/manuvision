import React, { useEffect, useState } from "react";
import axios from "axios";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

function meanAggregate(frames) {
  const K = frames.length;
  const out = Array.from({ length: 21 }, () => [0, 0, 0]);

  for (const frame of frames) {
    for (let i = 0; i < 21; i++) {
      out[i][0] += frame[i][0];
      out[i][1] += frame[i][1];
      out[i][2] += frame[i][2];
    }
  }
  for (let i = 0; i < 21; i++) {
    out[i][0] /= K; out[i][1] /= K; out[i][2] /= K;
  }
  return out;
}

export default function Practice({ prediction, latestLandmarksRef, handDetected }) {
  const [target, setTarget] = useState(LETTERS[Math.floor(Math.random() * 26)]);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [lastSavedId, setLastSavedId] = useState(null);

  useEffect(() => {
    if (!prediction?.label || prediction.label === "-") return;
    setResult(prediction.label === target ? "correct" : "wrong");
  }, [prediction, target]);

  async function captureSample() {
    if (!latestLandmarksRef?.current) return;

    setSaving(true);
    try {
      // collect 10 frames over 1s
      const frames = [];
      const CAPTURE_FRAMES = 10;

      for (let i = 0; i < CAPTURE_FRAMES; i++) {
        const lm = latestLandmarksRef.current;
        if (lm) frames.push(lm);
        await new Promise((r) => setTimeout(r, 100));
      }

      if (frames.length < 5) throw new Error("Not enough frames captured (hand lost?)");

      const aggregated = meanAggregate(frames);

      const session_id =
        localStorage.getItem("manuvision_session_id") ?? crypto.randomUUID();
      localStorage.setItem("manuvision_session_id", session_id);

      const res = await axios.post(`${API_BASE}/v1/samples`, {
        label: target,
        landmarks: aggregated,
        handedness: null,
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

  function next() {
    setTarget(LETTERS[Math.floor(Math.random() * 26)]);
    setResult(null);
  }

  return (
    <div style={{ padding: 16, display: "grid", gap: 12 }}>
      <h2>Practice</h2>

      <div style={{ opacity: 0.8 }}>
        Hand detected: {handDetected ? "✅" : "❌"}
      </div>

      <div style={{ fontSize: 28 }}>
        Target: <b>{target}</b>
      </div>

      <div style={{ fontSize: 22 }}>
        You: <b>{prediction?.label ?? "-"}</b>
      </div>

      {result && (
        <div style={{ fontSize: 24 }}>
          {result === "correct" ? "✅ Correct!" : "❌ Try Again"}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button
          onClick={captureSample}
          disabled={!handDetected || saving}
          style={{ padding: 10, width: 170 }}
        >
          {saving ? "Saving..." : "Capture Sample"}
        </button>

        {lastSavedId && <span style={{ opacity: 0.8 }}>Saved #{lastSavedId}</span>}
      </div>

      <button onClick={next} style={{ padding: 10, width: 150 }}>
        Next Letter
      </button>
    </div>
  );
}