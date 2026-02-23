import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import "./index.css";

import Translate from "./pages/Translate";
import Practice from "./pages/Practice";

function App() {
  const [prediction, setPrediction] = React.useState({ label: "-", confidence: 0 });

  // ✅ shared ref holding latest 21x3 landmarks
  const latestLandmarksRef = React.useRef(null);
  const [handDetected, setHandDetected] = React.useState(false);

  return (
    <div style={{ padding: 16 }}>
      <nav style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <Link to="/translate">Translate</Link>
        <Link to="/practice">Practice</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Navigate to="/translate" replace />} />

        <Route
          path="/translate"
          element={
            <Translate
              onPrediction={setPrediction}
              latestLandmarksRef={latestLandmarksRef}
              onHandDetected={setHandDetected}
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
            />
          }
        />
      </Routes>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);