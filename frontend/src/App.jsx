import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Translate from "./pages/Translate";
import Practice from "./pages/Practice";
import Layout from "./components/Layout";
import HandTracker from "./components/HandTracker";

export default function App() {
  const [prediction, setPrediction] = React.useState({ label: "-", confidence: 0 });

  const latestLandmarksRef = React.useRef(null);
  const [handDetected, setHandDetected] = React.useState(false);

  // NEW: shared camera stream + status
  const [stream, setStream] = React.useState(null);
  const [trackerStatus, setTrackerStatus] = React.useState("Initializing...");

  const footer = <span>Model: LR v0.1 • Classes: 3 • Samples: 136</span>;

  return (
    <Layout footer={footer}>
      {/* NEW: run tracker once for the whole app */}
      <HandTracker
        latestLandmarksRef={latestLandmarksRef}
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
              onPrediction={setPrediction}
              latestLandmarksRef={latestLandmarksRef}
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
              handDetected={handDetected}
              stream={stream}                   // NEW
            />
          }
        />
      </Routes>
    </Layout>
  );
}