import express from "express";
import cors from "cors";
import pkg from "pg";
const { Pool } = pkg;

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

// --- DB (lazy / resilient) ---
const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || "manuv",
  password: process.env.PGPASSWORD || "manuvpass",
  database: process.env.PGDATABASE || "manuvdb",
  // prevents hanging forever if DB is unreachable
  connectionTimeoutMillis: 2000,
});

pool.on("error", (err) => {
  console.error("Unexpected PG pool error:", err?.message || err);
});

// Optional: test DB connectivity on demand (not at startup)
async function dbPing() {
  const r = await pool.query("SELECT 1 as ok;");
  return r?.rows?.[0]?.ok === 1;
}

app.get("/health", async (_, res) => {
  let dbOk = false;
  try {
    dbOk = await dbPing();
  } catch {
    dbOk = false;
  }
  res.json({ ok: true, dbOk });
});

app.post("/v1/predict", (req, res) => {
  res.json({ label: "A", confidence: 0.85 });
});

app.post("/v1/attempts", async (req, res) => {
  try {
    const { targetLetter, predictedLetter, confidence } = req.body;

    if (!targetLetter || !predictedLetter || confidence == null) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const conf = Number(confidence);
    if (!Number.isFinite(conf)) {
      return res.status(400).json({ error: "confidence must be a number" });
    }

    const isCorrect = targetLetter === predictedLetter;

    await pool.query(
      `INSERT INTO attempts (target_letter, predicted_letter, confidence, is_correct)
       VALUES ($1,$2,$3,$4)`,
      [targetLetter, predictedLetter, conf, isCorrect]
    );

    res.json({ ok: true, isCorrect });
  } catch (err) {
    // DB down / refused / etc.
    console.error("DB error in /v1/attempts:", err?.message || err);
    return res.status(503).json({
      error: "Database unavailable",
      hint: "Is Postgres running and accessible?",
    });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`API running on :${PORT}`));