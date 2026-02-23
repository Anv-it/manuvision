import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";

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

export default function Translate({ onPrediction, latestLandmarksRef, onHandDetected }) {
  const videoRef = useRef(null);

  const [status, setStatus] = useState("Initializing...");
  const [pred, setPred] = useState({ label: "-", confidence: 0 });

  // ✅ ADD THESE INSIDE THE COMPONENT
  const [targetLabel, setTargetLabel] = useState("A");
  const [saving, setSaving] = useState(false);
  const [lastSavedId, setLastSavedId] = useState(null);

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

  useEffect(() => {
    let camera;

    async function init() {
      try {
        const hands = new Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });

        hands.onResults((results) => {
          const lm = results?.multiHandLandmarks?.[0] ?? null;

          if (!lm) {
            latestLandmarksRef.current = null;
            onHandDetected?.(false);
            return;
          }

          latestLandmarksRef.current = lm.map((p) => [p.x, p.y, p.z]);
          onHandDetected?.(true);
        });

        camera = new Camera(videoRef.current, {
          onFrame: async () => {
            await hands.send({ image: videoRef.current });
          },
          width: 640,
          height: 480,
        });

        camera.start();
        setStatus("Running ✅ (show your hand)");
      } catch (e) {
        console.error(e);
        setStatus("Failed to init MediaPipe ❌");
      }
    }

    init();

    return () => {
      try {
        camera?.stop();
      } catch {}
    };
  }, []);

  useEffect(() => {
    const id = setInterval(async () => {
      const landmarks = latestLandmarksRef?.current;
      if (!landmarks) return;

      try {
        const res = await axios.post(`${API_BASE}/v1/predict`, { landmarks });
        setPred(res.data);
        onPrediction?.(res.data);
      } catch (e) {
        setPred({ label: "-", confidence: 0 });
      }
    }, 200);

    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ padding: 16, display: "grid", gap: 12 }}>
      <h2>Translate</h2>
      <div>{status}</div>

      <video
        ref={videoRef}
        style={{ width: 640, borderRadius: 12, border: "1px solid #ddd" }}
        autoPlay
        playsInline
        muted
      />

      <div style={{ fontSize: 22 }}>
        Prediction: <b>{pred.label}</b>{" "}
        <span style={{ opacity: 0.7 }}>
          ({Math.round((pred.confidence ?? 0) * 100)}%)
        </span>
      </div>

      {/* ✅ NEW CAPTURE PANEL */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ opacity: 0.8 }}>Label:</span>

        <select value={targetLabel} onChange={(e) => setTargetLabel(e.target.value)}>
          {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((ch) => (
            <option key={ch} value={ch}>
              {ch}
            </option>
          ))}
        </select>

        <button
          onClick={captureSample}
          disabled={saving || !latestLandmarksRef?.current}
          style={{ padding: "8px 12px" }}
        >
          {saving ? "Saving..." : "Capture Sample"}
        </button>

        {lastSavedId && <span style={{ opacity: 0.8 }}>Saved #{lastSavedId}</span>}
      </div>
    </div>
  );
}