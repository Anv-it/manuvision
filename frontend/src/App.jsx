import React from "react";
import axios from "axios";
import { Routes, Route, Navigate } from "react-router-dom";

import Translate from "./pages/Translate";
import Practice from "./pages/Practice";
import Layout from "./components/Layout";
import HandTracker from "./components/HandTracker";
import ModelStatus from "./components/ModelStatus";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

function avgVectors(vectors) {
  if (!vectors || vectors.length === 0) return [];
  const dim = vectors[0].length;
  const out = new Array(dim).fill(0);

  for (const v of vectors) {
    for (let i = 0; i < dim; i++) out[i] += v[i];
  }

  for (let i = 0; i < dim; i++) out[i] /= vectors.length;
  return out;
}

function argmax(arr) {
  let bestIdx = 0;
  let bestVal = -Infinity;

  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > bestVal) {
      bestVal = arr[i];
      bestIdx = i;
    }
  }

  return bestIdx;
}

export default function App() {
  const [prediction, setPrediction] = React.useState({
    label: "-",
    confidence: 0,
    latency_ms: null,
  });

  const probsQueueRef = React.useRef([]);
  const classesRef = React.useRef(null);
  const SMOOTH_N = 7;
  const CONF_THRESH = 0.6;
    
  const latestLandmarksRef = React.useRef(null);
  const latestHandednessRef = React.useRef(null);
  const [handDetected, setHandDetected] = React.useState(false);

  // NEW: shared camera stream + status
  const [stream, setStream] = React.useState(null);
  const [trackerStatus, setTrackerStatus] = React.useState("Initializing...");

  const footer = <ModelStatus />

  React.useEffect(() => {
    const id = setInterval(async () => {
      const landmarks = latestLandmarksRef.current;
      const handedness = latestHandednessRef.current ?? null;

      if (!landmarks) {
        setPrediction({ label: "-", confidence: 0, latency_ms: null });
        probsQueueRef.current = [];
        classesRef.current = null;
        return;
      }

      try {
        const res = await axios.post(`${API_BASE}/v1/predict`, {
          landmarks,
          handedness,
        });

        const raw = res.data;
        const classes = Array.isArray(raw.classes) ? raw.classes : [];
        const probs = Array.isArray(raw.probs) ? raw.probs : [];

        if (classes.length === 0 || probs.length === 0 || classes.length !== probs.length) {
          const fallbackPred = {
            label: raw.label ?? "-",
            confidence: raw.confidence ?? 0,
            latency_ms: raw.latency_ms ?? null,
          };
          setPrediction(fallbackPred);
          probsQueueRef.current = [];
          classesRef.current = null;
          return;
        }

        if (
          !classesRef.current ||
          classesRef.current.length !== classes.length ||
          classesRef.current.some((c, i) => c !== classes[i])
        ) {
          classesRef.current = classes;
          probsQueueRef.current = [];
        }

        probsQueueRef.current.push(probs);
        if (probsQueueRef.current.length > SMOOTH_N) probsQueueRef.current.shift();

        const avg = avgVectors(probsQueueRef.current);
        const idx = argmax(avg);

        const smoothedLabel = classesRef.current[idx];
        const smoothedConf = avg[idx] ?? 0;

        const smoothed =
          smoothedConf >= CONF_THRESH
            ? { ...raw, label: smoothedLabel, confidence: smoothedConf }
            : { ...raw, label: "…", confidence: smoothedConf };

        setPrediction(smoothed);
      } catch (e) {
        setPrediction({ label: "-", confidence: 0, latency_ms: null });
        probsQueueRef.current = [];
        classesRef.current = null;
      }
    }, 200);

    return () => clearInterval(id);
  }, []);

  return (
    <Layout footer={footer}>
      {/* NEW: run tracker once for the whole app */}
      <HandTracker
        latestLandmarksRef={latestLandmarksRef}
        latestHandednessRef={latestHandednessRef}
        onHandDetected={setHandDetected}
        onStatus={setTrackerStatus}
        onStream={setStream}
      />

      <Routes>
        <Route path="/" element={<Navigate to="/translate" replace />} />

        <Route
          path="/translate"
          element={
            <Translate
              prediction={prediction}
              latestLandmarksRef={latestLandmarksRef}
              latestHandednessRef={latestHandednessRef}
              stream={stream}
              trackerStatus={trackerStatus}
              handDetected={handDetected}   
            />
          }
        />

        <Route
          path="/practice"
          element={
            <Practice
              prediction={prediction}
              latestLandmarksRef={latestLandmarksRef}
              latestHandednessRef={latestHandednessRef}
              handDetected={handDetected}
              stream={stream}                   
            />
          }
        />
      </Routes>
    </Layout>
  );
}