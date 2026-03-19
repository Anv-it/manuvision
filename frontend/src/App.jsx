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

function hasMotion(sequenceFrames) {
  if (!Array.isArray(sequenceFrames) || sequenceFrames.length < 12) return false;

  let path = 0;
  for (let i = 1; i < sequenceFrames.length; i++) {
    const prev = sequenceFrames[i - 1]?.[8];
    const curr = sequenceFrames[i]?.[8];
    if (!prev || !curr) continue;
    path += Math.hypot(curr[0] - prev[0], curr[1] - prev[1]);
  }

  return path >= 0.06;
}

function smoothStaticPrediction(raw, probsQueueRef, classesRef, smoothN, confThresh) {
  const classes = Array.isArray(raw?.classes) ? raw.classes : [];
  const probs = Array.isArray(raw?.probs) ? raw.probs : [];

  if (classes.length === 0 || probs.length === 0 || classes.length !== probs.length) {
    return {
      label: raw?.label ?? "-",
      confidence: raw?.confidence ?? 0,
      latency_ms: raw?.latency_ms ?? null,
      top_predictions: raw?.top_predictions ?? [],
      source: raw?.source ?? "static",
    };
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
  if (probsQueueRef.current.length > smoothN) probsQueueRef.current.shift();

  const avg = avgVectors(probsQueueRef.current);
  const idx = argmax(avg);
  const smoothedLabel = classesRef.current[idx];
  const smoothedConf = avg[idx] ?? 0;

  return smoothedConf >= confThresh
    ? { ...raw, label: smoothedLabel, confidence: smoothedConf, source: "static" }
    : { ...raw, label: "…", confidence: smoothedConf, source: "static" };
}

export default function App() {
  const [prediction, setPrediction] = React.useState({
    label: "-",
    confidence: 0,
    latency_ms: null,
    source: "static",
  });

  const probsQueueRef = React.useRef([]);
  const classesRef = React.useRef(null);
  const sequenceBufferRef = React.useRef([]);
  const dynamicEnabledRef = React.useRef(true);
  const SMOOTH_N = 7;
  const CONF_THRESH = 0.6;
  const DYNAMIC_CONF_THRESH = 0.72;
    
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
      const sequenceFrames = (sequenceBufferRef.current ?? []).map((item) => item.landmarks);

      if (!landmarks) {
        setPrediction({ label: "-", confidence: 0, latency_ms: null, source: "static" });
        probsQueueRef.current = [];
        classesRef.current = null;
        return;
      }

      try {
        const shouldQueryDynamic =
          dynamicEnabledRef.current && hasMotion(sequenceFrames);

        const [staticRes, dynamicRes] = await Promise.allSettled([
          axios.post(`${API_BASE}/v1/predict`, {
            landmarks,
            handedness,
          }),
          shouldQueryDynamic
            ? axios.post(`${API_BASE}/v1/predict-sequence`, {
                frames: sequenceFrames,
                handedness,
              })
            : Promise.resolve(null),
        ]);

        if (staticRes.status !== "fulfilled") {
          throw staticRes.reason;
        }

        const staticPred = smoothStaticPrediction(
          staticRes.value.data,
          probsQueueRef,
          classesRef,
          SMOOTH_N,
          CONF_THRESH
        );

        let nextPrediction = staticPred;

        if (dynamicRes.status === "fulfilled" && dynamicRes.value?.data) {
          const dynamicPred = dynamicRes.value.data;
          if (
            ["J", "Z"].includes(dynamicPred.label) &&
            (dynamicPred.confidence ?? 0) >= DYNAMIC_CONF_THRESH
          ) {
            nextPrediction = dynamicPred;
          }
        } else if (dynamicRes.status === "rejected") {
          const status = dynamicRes.reason?.response?.status;
          if (status === 404 || status === 503) {
            dynamicEnabledRef.current = false;
          }
        }

        setPrediction(nextPrediction);
      } catch (e) {
        setPrediction({ label: "-", confidence: 0, latency_ms: null, source: "static" });
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
        sequenceBufferRef={sequenceBufferRef}
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
