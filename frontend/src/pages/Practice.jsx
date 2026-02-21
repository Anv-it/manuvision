import React, { useEffect, useState } from "react";
import axios from "axios";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8080";

export default function Practice({ prediction }) {
  const [target, setTarget] = useState(
    LETTERS[Math.floor(Math.random() * 26)]
  );
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!prediction?.label || prediction.label === "-") return;

    const isCorrect = prediction.label === target;

    setResult(isCorrect ? "correct" : "wrong");
  }, [prediction, target]);

  async function next() {
    if (prediction?.label && prediction.label !== "-") {
      await axios.post(`${API_BASE}/v1/attempts`, {
        targetLetter: target,
        predictedLetter: prediction.label,
        confidence: prediction.confidence,
      });
    }

    setTarget(LETTERS[Math.floor(Math.random() * 26)]);
    setResult(null);
  }

  return (
    <div style={{ padding: 16, display: "grid", gap: 12 }}>
      <h2>Practice</h2>

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

      <button onClick={next} style={{ padding: 10, width: 150 }}>
        Next Letter
      </button>
    </div>
  );
}