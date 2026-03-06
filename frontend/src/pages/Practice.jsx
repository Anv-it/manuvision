import React, { useEffect, useRef, useState } from "react";
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
    out[i][0] /= K;
    out[i][1] /= K;
    out[i][2] /= K;
  }
  return out;
}

// REPLACE ONCE TRAINED ON ALL 26 LETTERS!!!!!!!!
const PRACTICE_LETTERS = ["A", "B", "C"];

function randomLetter() {
  return PRACTICE_LETTERS[Math.floor(Math.random() * PRACTICE_LETTERS.length)];
}

// function randomLetter() {
//   return LETTERS[Math.floor(Math.random() * 26)];
// }

export default function Practice({ 
  prediction, 
  latestLandmarksRef, 
  latestHandednessRef,
  handDetected, 
  stream,
}) {
  const videoRef = useRef(null);

    useEffect(() => {
    if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
    }
    }, [stream]);
  
  
  
  const [target, setTarget] = useState(randomLetter());

  // UI/result state
  const [result, setResult] = useState(null); // "correct" | "wrong" | null
  const [lockedLabel, setLockedLabel] = useState(null); // final chosen label for this round

  // session stats
  const [attempts, setAttempts] = useState(0);
  const [correct, setCorrect] = useState(0);

  // capture sample state
  const [saving, setSaving] = useState(false);
  const [lastSavedId, setLastSavedId] = useState(null);

  // lock-in config (tweakable)
  const CONF_THRESH = 0.6;
  const HOLD_FRAMES = 6; // require same label this many consecutive updates

  // internal streak tracker (doesn't cause re-renders)
  const streakRef = useRef({ label: null, count: 0 });

  const liveLabel = prediction?.label ?? "-";
  const liveConf = prediction?.confidence ?? 0;
  const livePct = Math.round(liveConf * 100);

  // logic: only evaluate once per round, using stable predictions
  useEffect(() => {
    if (!handDetected) return;
    if (!prediction?.label || prediction.label === "-" || prediction.label === "…") return;
    if (lockedLabel) return; // already locked this round

    // gate by confidence
    if (liveConf < CONF_THRESH) {
      streakRef.current = { label: null, count: 0 };
      return;
    }

    // update streak
    if (streakRef.current.label === prediction.label) {
      streakRef.current.count += 1;
    } else {
      streakRef.current = { label: prediction.label, count: 1 };
    }

    // lock when stable for HOLD_FRAMES
    if (streakRef.current.count >= HOLD_FRAMES) {
      const finalLabel = streakRef.current.label;
      const finalConfidence = liveConf;

      setLockedLabel(finalLabel);

      const isCorrect = finalLabel === target;
      setResult(isCorrect ? "correct" : "wrong");
      setAttempts((a) => a + 1);
      if (isCorrect) setCorrect((c) => c + 1);

      logAttempt(finalLabel, finalConfidence);
    }
  }, [prediction, target, handDetected, lockedLabel, liveConf]);

  async function logAttempt(finalLabel, finalConfidence) {
  try {
    const session_id =
      localStorage.getItem("manuvision_session_id") ?? crypto.randomUUID();

    localStorage.setItem("manuvision_session_id", session_id);

    await axios.post(`${API_BASE}/v1/attempts`, {
      target_label: target,
      predicted_label: finalLabel,
      confidence: finalConfidence,
      correct: finalLabel === target,
      session_id,
    });
  } catch (e) {
    console.error("Failed to log attempt:", e);
  }
}

  async function captureSample() {
    if (!latestLandmarksRef?.current) return;

    setSaving(true);
    try {
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

  function next() {
    setTarget(randomLetter());
    setResult(null);
    setLockedLabel(null);
    streakRef.current = { label: null, count: 0 };
  }

  const accuracy = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;

  const feedbackPill =
    result === "correct"
      ? "bg-emerald-50 text-emerald-700"
      : result === "wrong"
      ? "bg-red-50 text-red-700"
      : "bg-zinc-100 text-zinc-600";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* LEFT: Practice panel */}
      <div className="bg-white border rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Practice</h2>
            <div className="mt-1 text-sm text-zinc-600">
              Hold a sign steady to lock an answer.
            </div>
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

        <div className="mt-5 bg-zinc-100 rounded-xl overflow-hidden border">
            <video
            ref={videoRef}
            className="w-full max-w-full h-auto"
            autoPlay
            playsInline
            muted
            />
        </div>

        <div className="mt-6 flex items-end gap-4">
          <div>
            <div className="text-xs text-zinc-500">Target</div>
            <div className="mt-2 text-8xl font-semibold tracking-tight">{target}</div>
          </div>

          <div className="pb-2">
            <div className="text-xs text-zinc-500">You</div>
            <div className="mt-2 text-4xl font-semibold">
              {lockedLabel ?? (liveLabel === "-" ? "" : liveLabel)}
            </div>
            {handDetected && (
                <div className="mt-1 text-xs text-zinc-500">
                    Conf {livePct}% • Gate {Math.round(CONF_THRESH * 100)}% • Hold {HOLD_FRAMES}
                </div>
            )}
          </div>
        </div>

        <div className="mt-6">
          <div className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm ${feedbackPill}`}>
            {result === "correct" ? "✅ Correct" : result === "wrong" ? "❌ Incorrect — next letter" : "Waiting for stable prediction…"}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={captureSample}
            disabled={!handDetected || saving}
            className={[
              "px-4 py-2 rounded-lg text-sm font-medium transition",
              !handDetected || saving
                ? "bg-zinc-200 text-zinc-500 cursor-not-allowed"
                : "bg-black text-white hover:opacity-90",
            ].join(" ")}
          >
            {saving ? "Saving..." : "Capture Sample"}
          </button>

          {lastSavedId && (
            <span className="text-sm text-zinc-600">Saved #{lastSavedId}</span>
          )}

          <button
            onClick={next}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-white border hover:bg-zinc-50"
          >
            Next Letter
          </button>
        </div>
      </div>

      {/* RIGHT: Session stats card */}
      <div className="flex flex-col gap-6">
        <div className="bg-white border rounded-2xl p-6 shadow-sm">
          <div className="text-xs text-zinc-500">Session</div>

          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="rounded-xl bg-zinc-50 border p-4">
              <div className="text-xs text-zinc-500">Attempts</div>
              <div className="mt-2 text-2xl font-semibold">{attempts}</div>
            </div>

            <div className="rounded-xl bg-zinc-50 border p-4">
              <div className="text-xs text-zinc-500">Correct</div>
              <div className="mt-2 text-2xl font-semibold">{correct}</div>
            </div>

            <div className="rounded-xl bg-zinc-50 border p-4">
              <div className="text-xs text-zinc-500">Accuracy</div>
              <div className="mt-2 text-2xl font-semibold">{accuracy}%</div>
            </div>
          </div>

            <div className="mt-3 h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
                <div
                    className="h-full bg-black transition-all"
                    style={{ width: `${accuracy}%` }}
                />
            </div>
          

          <div className="mt-4 text-xs text-zinc-500">
            Next upgrades: per-letter breakdown • streaks • confusion visualization.
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-6 shadow-sm">
          <div className="text-xs text-zinc-500">Tip</div>
          <div className="mt-2 text-sm text-zinc-700">
            If predictions flicker, slow your hand motion and hold the sign steady for ~1 second.
          </div>
        </div>
      </div>
    </div>
  );
}