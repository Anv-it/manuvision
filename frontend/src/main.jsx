import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import "./index.css";

import Translate from "./pages/Translate";
import Practice from "./pages/Practice";

function App() {
  const [prediction, setPrediction] = React.useState({ label: "-", confidence: 0 });

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
          element={<Translate onPrediction={setPrediction} />}
        />
        <Route path="/practice" element={<Practice prediction={prediction} />} />
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