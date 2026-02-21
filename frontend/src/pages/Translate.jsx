import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8080";

export default function Translate({ onPrediction }) {
  const videoRef = useRef(null);
  const latestLandmarksRef = useRef(null);

  const [status, setStatus] = useState("Initializing...");
  const [pred, setPred] = useState({ label: "-", confidence: 0 });

  useEffect(() => {
    let camera;

    async function init() {
      try {
        const hands = new Hands({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });

        hands.onResults((results) => {
          const lm = results?.multiHandLandmarks?.[0] ?? null;
          latestLandmarksRef.current = lm;
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
      const lm = latestLandmarksRef.current;
      if (!lm) return;

      const landmarks = lm.map((p) => [p.x, p.y, p.z]);

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
    </div>
  );
}