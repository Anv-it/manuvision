import React, { useEffect, useRef, useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";
const DEFAULT_GUIDED_LETTERS = "GHIJKLMNOPQRSTUVWXYZ".split("");
const GUIDED_PROGRESS_KEY = "manuvision_guided_progress_v1";
const GUIDED_LETTERS_KEY = "manuvision_guided_letters_v1";
const GUIDED_TARGET_KEY = "manuvision_guided_target_v1";

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

function loadProgressMap() {
  try {
    const raw = localStorage.getItem(GUIDED_PROGRESS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeLetters(value) {
  const chars = (value || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .split("");

  return [...new Set(chars)];
}

function nextGuidedLetter(letters, progressMap, targetPerLetter) {
  for (const letter of letters) {
    if ((progressMap[letter] ?? 0) < targetPerLetter) return letter;
  }
  return letters[0] ?? "A";
}

export default function Translate({
  prediction,
  latestLandmarksRef,
  latestHandednessRef,
  handDetected,
  trackerStatus,
  stream,
}) {
  const videoRef = useRef(null);

  const pred = prediction ?? {
    label: "-",
    confidence: 0,
    latency_ms: null,
    top_predictions: [],
  };

  const SMOOTH_N = 7;
  const CONF_THRESH = 0.6;

  const confPct = Math.round((pred.confidence ?? 0) * 100);
  function getConfidenceColor(pct) {
    if (pct >= 90) return "bg-emerald-500";
    if (pct >= 70) return "bg-black";
    return "bg-amber-500";
  }
  const confColor = getConfidenceColor(confPct);
  const isGated = pred.label === "…";
  const latencyText = pred.latency_ms != null ? `${pred.latency_ms} ms` : "—";
  const topPredictions = pred.top_predictions ?? [];

  const [targetLabel, setTargetLabel] = useState("A");
  const [saving, setSaving] = useState(false);
  const [sequenceSaving, setSequenceSaving] = useState(false);
  const [lastSavedId, setLastSavedId] = useState(null);
  const [lastSequenceSaved, setLastSequenceSaved] = useState(null);
  const [guidedEnabled, setGuidedEnabled] = useState(true);
  const [guidedLettersInput, setGuidedLettersInput] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_GUIDED_LETTERS.join("");
    return localStorage.getItem(GUIDED_LETTERS_KEY) ?? DEFAULT_GUIDED_LETTERS.join("");
  });
  const [targetPerLetter, setTargetPerLetter] = useState(() => {
    if (typeof window === "undefined") return 30;
    const raw = Number(localStorage.getItem(GUIDED_TARGET_KEY) ?? 30);
    return Number.isFinite(raw) ? Math.max(1, Math.min(200, raw)) : 30;
  });
  const [guidedProgress, setGuidedProgress] = useState(() => {
    if (typeof window === "undefined") return {};
    return loadProgressMap();
  });

  const guidedLetters = normalizeLetters(guidedLettersInput);
  const guidedActiveLetter = nextGuidedLetter(
    guidedLetters,
    guidedProgress,
    targetPerLetter
  );
  const guidedCompleteCount = guidedLetters.filter(
    (letter) => (guidedProgress[letter] ?? 0) >= targetPerLetter
  ).length;
  const guidedTotalNeeded = guidedLetters.length * targetPerLetter;
  const guidedCollected = guidedLetters.reduce(
    (sum, letter) => sum + Math.min(guidedProgress[letter] ?? 0, targetPerLetter),
    0
  );
  const guidedPercent =
    guidedTotalNeeded > 0 ? Math.round((guidedCollected / guidedTotalNeeded) * 100) : 0;

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (!guidedEnabled || guidedLetters.length === 0) return;
    setTargetLabel(guidedActiveLetter);
  }, [guidedEnabled, guidedActiveLetter, guidedLetters.length]);

  useEffect(() => {
    localStorage.setItem(GUIDED_PROGRESS_KEY, JSON.stringify(guidedProgress));
  }, [guidedProgress]);

  useEffect(() => {
    localStorage.setItem(GUIDED_LETTERS_KEY, guidedLettersInput);
  }, [guidedLettersInput]);

  useEffect(() => {
    localStorage.setItem(GUIDED_TARGET_KEY, String(targetPerLetter));
  }, [targetPerLetter]);

  async function captureSample() {
    const CAPTURE_FRAMES = 10;
    const frames = [];
    const activeLabel = guidedEnabled && guidedLetters.length > 0 ? guidedActiveLetter : targetLabel;

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
        label: activeLabel,
        landmarks: aggregated,
        handedness: latestHandednessRef?.current ?? null,
        session_id,
      });

      setLastSavedId(res.data?.id ?? null);
      setTargetLabel(activeLabel);

      if (guidedEnabled && guidedLetters.length > 0) {
        setGuidedProgress((current) => {
          const next = {
            ...current,
            [activeLabel]: (current[activeLabel] ?? 0) + 1,
          };
          return next;
        });
      }
    } catch (e) {
      console.error(e);
      alert("Failed to save sample. Check console + backend logs.");
    } finally {
      setSaving(false);
    }
  }

  async function captureSequenceSample() {
    const CAPTURE_FRAMES = 24;
    const frames = [];
    const activeLabel = guidedEnabled && guidedLetters.length > 0 ? guidedActiveLetter : targetLabel;

    setSequenceSaving(true);
    try {
      for (let i = 0; i < CAPTURE_FRAMES; i++) {
        const lm = latestLandmarksRef?.current;
        if (lm && lm.length === 21) frames.push(lm);
        await new Promise((r) => setTimeout(r, 50));
      }

      if (frames.length < 12) {
        throw new Error("Not enough motion frames captured (hand lost?)");
      }

      const session_id =
        localStorage.getItem("manuvision_session_id") ?? crypto.randomUUID();
      localStorage.setItem("manuvision_session_id", session_id);

      const res = await axios.post(`${API_BASE}/v1/sequence-samples`, {
        label: activeLabel,
        frames,
        handedness: latestHandednessRef?.current ?? null,
        session_id,
      });

      setLastSequenceSaved(`${res.data?.label ?? activeLabel} (${res.data?.frames ?? frames.length}f)`);
      setTargetLabel(activeLabel);
    } catch (e) {
      console.error(e);
      alert("Failed to save motion sample. Check console + backend logs.");
    } finally {
      setSequenceSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white border rounded-2xl p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Translate</h2>
            <div className="mt-1 text-sm text-zinc-600">{trackerStatus}</div>
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

        <div className="bg-zinc-100 rounded-xl overflow-hidden border">
          <video
            ref={videoRef}
            className="w-full max-w-full h-auto"
            autoPlay
            playsInline
            muted
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="text-sm text-zinc-600">Label</div>

          <select
            className="border rounded-lg px-3 py-2 text-sm bg-white"
            value={targetLabel}
            onChange={(e) => setTargetLabel(e.target.value)}
            disabled={guidedEnabled && guidedLetters.length > 0}
          >
            {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((ch) => (
              <option key={ch} value={ch}>
                {ch}
              </option>
            ))}
          </select>

          <button
            onClick={captureSample}
            disabled={saving || !latestLandmarksRef?.current}
            className={[
              "px-4 py-2 rounded-lg text-sm font-medium transition",
              saving || !latestLandmarksRef?.current
                ? "bg-zinc-200 text-zinc-500 cursor-not-allowed"
                : "bg-black text-white hover:opacity-90",
            ].join(" ")}
          >
            {saving ? "Saving..." : "Capture Sample"}
          </button>

          <button
            onClick={captureSequenceSample}
            disabled={
              sequenceSaving ||
              !latestLandmarksRef?.current ||
              !["J", "Z"].includes(targetLabel)
            }
            className={[
              "px-4 py-2 rounded-lg text-sm font-medium transition border",
              sequenceSaving || !latestLandmarksRef?.current || !["J", "Z"].includes(targetLabel)
                ? "bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed"
                : "bg-white text-zinc-900 border-zinc-300 hover:bg-zinc-50",
            ].join(" ")}
            title={
              ["J", "Z"].includes(targetLabel)
                ? "Capture a motion sequence for the current label"
                : "Motion capture is only used for J and Z"
            }
          >
            {sequenceSaving ? "Saving Motion..." : "Capture Motion"}
          </button>

          {lastSavedId && (
            <span className="text-sm text-zinc-600">Saved #{lastSavedId}</span>
          )}

          {lastSequenceSaved && (
            <span className="text-sm text-zinc-600">Motion {lastSequenceSaved}</span>
          )}
        </div>

        <div className="mt-5 rounded-2xl border bg-zinc-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-zinc-900">Guided Dataset Builder</div>
              <div className="mt-1 text-xs text-zinc-500">
                Collect smaller seed sets for each missing letter, then let training augmentation
                expand weak classes.
              </div>
            </div>

            <button
              type="button"
              onClick={() => setGuidedEnabled((value) => !value)}
              className={[
                "rounded-full px-3 py-1 text-xs font-medium",
                guidedEnabled ? "bg-black text-white" : "bg-white border text-zinc-700",
              ].join(" ")}
            >
              {guidedEnabled ? "Guided On" : "Guided Off"}
            </button>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
            <label className="block">
              <div className="text-xs text-zinc-500">Letters to collect</div>
              <input
                value={guidedLettersInput}
                onChange={(e) => setGuidedLettersInput(e.target.value)}
                className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                placeholder="GHIJKLMNOPQRSTUVWXYZ"
              />
            </label>

            <label className="block">
              <div className="text-xs text-zinc-500">Target per letter</div>
              <input
                type="number"
                min="1"
                max="200"
                value={targetPerLetter}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (!Number.isFinite(value)) return;
                  setTargetPerLetter(Math.max(1, Math.min(200, value)));
                }}
                className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="mt-4 rounded-xl border bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs text-zinc-500">Current guided letter</div>
                <div className="mt-1 text-3xl font-semibold tracking-tight">
                  {guidedLetters.length > 0 ? guidedActiveLetter : "—"}
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs text-zinc-500">Progress</div>
                <div className="mt-1 text-sm font-medium text-zinc-900">
                  {guidedCollected}/{guidedTotalNeeded || 0} samples
                </div>
                <div className="text-xs text-zinc-500">
                  {guidedCompleteCount}/{guidedLetters.length} letters complete
                </div>
              </div>
            </div>

            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full bg-black transition-all"
                style={{ width: `${Math.min(100, Math.max(0, guidedPercent))}%` }}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {guidedLetters.length > 0 ? (
                guidedLetters.map((letter) => {
                  const count = guidedProgress[letter] ?? 0;
                  const done = count >= targetPerLetter;
                  const active = letter === guidedActiveLetter && !done;

                  return (
                    <div
                      key={letter}
                      className={[
                        "rounded-lg border px-3 py-2 text-xs",
                        done
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : active
                          ? "border-black bg-black text-white"
                          : "border-zinc-200 bg-zinc-50 text-zinc-700",
                      ].join(" ")}
                    >
                      {letter} {Math.min(count, targetPerLetter)}/{targetPerLetter}
                    </div>
                  );
                })
              ) : (
                <div className="text-sm text-zinc-500">
                  Enter at least one letter to enable guided capture.
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setGuidedProgress({})}
                className="rounded-lg border bg-white px-3 py-2 text-sm hover:bg-zinc-50"
              >
                Reset Progress
              </button>

              <button
                type="button"
                onClick={() =>
                  setGuidedProgress((current) => ({
                    ...current,
                    [guidedActiveLetter]: targetPerLetter,
                  }))
                }
                disabled={guidedLetters.length === 0}
                className={[
                  "rounded-lg px-3 py-2 text-sm",
                  guidedLetters.length === 0
                    ? "cursor-not-allowed bg-zinc-200 text-zinc-500"
                    : "border bg-white hover:bg-zinc-50",
                ].join(" ")}
              >
                Skip Current Letter
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="bg-white border rounded-2xl p-6 shadow-sm">
          <div className="text-xs text-zinc-500">Prediction</div>
          <div className="mt-2 flex items-end gap-3">
            <div className="text-6xl font-semibold tracking-tight">{pred.label}</div>
            <div className="pb-2 text-sm text-zinc-500">
              {isGated ? "Below threshold" : "Live"}
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-xs text-zinc-500">Confidence</div>
            <div className="text-xs text-zinc-500">
              Smooth {SMOOTH_N} • Gate {Math.round(CONF_THRESH * 100)}%
            </div>
          </div>

          <div
            className={`mt-3 text-2xl font-medium ${
              confPct >= 90
                ? "text-emerald-600"
                : confPct >= 70
                ? "text-zinc-900"
                : "text-amber-600"
            }`}
          >
            {confPct}%
          </div>

          <div className="mt-3 h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
            <div
              className={`h-full ${confColor} transition-all`}
              style={{ width: `${Math.min(100, Math.max(0, confPct))}%` }}
            />
          </div>

          <div className="mt-3 text-xs text-zinc-500">
            {isGated
              ? `Prediction gated: confidence ${confPct}% < ${Math.round(CONF_THRESH * 100)}%`
              : `Prediction unlocked: confidence ${confPct}%`}
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-6 shadow-sm">
          <div className="text-xs text-zinc-500">Top Predictions</div>

          <div className="mt-4 space-y-3">
            {topPredictions.length > 0 ? (
              topPredictions.map((item, i) => {
                const pct = Math.round((item.prob ?? 0) * 100);
                return (
                  <div
                    key={item.label}
                    className={`rounded-xl border px-4 py-2 ${
                      i === 0
                        ? "bg-zinc-100 border-zinc-300"
                        : "bg-zinc-50 border-zinc-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className={`text-base ${i === 0 ? "font-semibold" : "font-medium"}`}>
                        {item.label}
                      </div>
                      <div className="text-sm text-zinc-500">{pct}%</div>
                    </div>

                    <div className="mt-2 h-2 w-full rounded-full bg-zinc-200 overflow-hidden">
                      <div
                        className="h-full bg-black transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-zinc-500">No prediction data yet.</div>
            )}
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-6 shadow-sm">
          <div className="text-xs text-zinc-500">Inference Telemetry</div>

          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-zinc-500">Latency</div>
              <div className="mt-1 text-lg font-medium">{latencyText}</div>
            </div>

            <div>
              <div className="text-xs text-zinc-500">Polling</div>
              <div className="mt-1 text-lg font-medium">200 ms</div>
            </div>
          </div>

          <div className="text-xs text-zinc-500">
            Handedness: {latestHandednessRef?.current ?? "—"}
          </div>

          <div className="mt-4 text-xs text-zinc-500">
            Latest backend inference response time from{" "}
            <code className="px-1 py-0.5 bg-zinc-100 rounded">/v1/predict</code>
          </div>
        </div>
      </div>
    </div>
  );
}
