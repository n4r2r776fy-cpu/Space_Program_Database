// =========================
// SPACE OPS BACKEND SERVER
// =========================

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const { Pool } = require("pg");

const app = express();
app.use(express.json());
app.use(cors());

// ---------- ПІДКЛЮЧЕННЯ ДО POSTGRES ----------
const pool = new Pool({
  host: "localhost",            // як у pgAdmin
  port: 5432,                   // стандартний порт
  user: "postgres",             // твій юзер
  password: "1234",             // твій пароль
  database: "space_ops_console" // твоя БД
});

// тест підключення
pool.connect()
  .then((client) => {
    console.log("✅ Connected to PostgreSQL as", "postgres");
    client.release();
  })
  .catch((err) => {
    console.error("❌ PostgreSQL connection error:", err.message);
  });

// ---------- ROOT ----------
app.get("/", (req, res) => {
  res.send("API бекенду Space Ops доступний онлайн");
});

// ---------- HEALTH (перевіряємо ще й БД) ----------
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      ok: true,
      status: "OK",
      db: "online",
      message: "Space Ops Backend is running, DB connected."
    });
  } catch (err) {
    console.error("HEALTH DB ERROR:", err.message);
    res.status(500).json({
      ok: false,
      status: "ERROR",
      db: "error",
      message: "Backend живий, але БД не відповідає",
      error: err.message
    });
  }
});

// ---------- LOGIN ----------
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const q = `SELECT * FROM space_ops.operators WHERE username = $1`;
    const dbRes = await pool.query(q, [username]);

    if (dbRes.rows.length === 0) {
      return res.json({ ok: false, msg: "Користувача не знайдено" });
    }

    const user = dbRes.rows[0];
    const match = await bcrypt.compare(password, user.pass_hash);

    if (!match) {
      return res.json({ ok: false, msg: "Невірний пароль" });
    }

    res.json({ ok: true, msg: "Успішний вхід", user });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------- REGISTER USER ----------
app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      ok: false,
      msg: "username і password обов'язкові",
    });
  }

  if (username.length < 3) {
    return res.status(400).json({
      ok: false,
      msg: "Ім'я користувача має бути не коротше 3 символів",
    });
  }

  if (password.length < 4) {
    return res.status(400).json({
      ok: false,
      msg: "Пароль має бути не коротше 4 символів",
    });
  }

  try {
    const checkQ = `SELECT id FROM space_ops.operators WHERE username = $1`;
    const checkRes = await pool.query(checkQ, [username]);

    if (checkRes.rows.length > 0) {
      return res.status(409).json({
        ok: false,
        msg: "Такий користувач вже існує",
      });
    }

    const hash = await bcrypt.hash(password, 10);

    const q = `
      INSERT INTO space_ops.operators (username, pass_hash, is_active)
      VALUES ($1, $2, true)
      RETURNING id, username, created_at
    `;

    const dbRes = await pool.query(q, [username, hash]);

    res.json({
      ok: true,
      msg: "Оператор зареєстрований",
      user: dbRes.rows[0]
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------- GET MISSIONS ----------
app.get("/missions", async (req, res) => {
  try {
    const dbRes = await pool.query(
      `SELECT * FROM space_ops.missions ORDER BY id ASC`
    );
    res.json(dbRes.rows);
  } catch (err) {
    console.error("MISSIONS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- ADD MISSION ----------
app.post("/missions", async (req, res) => {
  const { name, launch_date, duration_days, status, description } = req.body;

  try {
    const q = `
      INSERT INTO space_ops.missions (name, launch_date, duration_days, status, description)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const dbRes = await pool.query(q, [
      name,
      launch_date,
      duration_days || 0,
      status || "planned",
      description || null,
    ]);

    res.json({ ok: true, mission: dbRes.rows[0] });
  } catch (err) {
    console.error("ADD MISSION ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- GET TELEMETRY FOR SPACECRAFT ----------
app.get("/telemetry", async (req, res) => {
  const spacecraftId = parseInt(req.query.spacecraft_id, 10);

  if (!spacecraftId) {
    return res.status(400).json({
      ok: false,
      msg: "Потрібний параметр spacecraft_id у query"
    });
  }

  try {
    const q = `
      SELECT 
        id,
        spacecraft_id,
        ts AS "timestamp",
        parameter,
        value,
        unit
      FROM space_ops.telemetry
      WHERE spacecraft_id = $1
      ORDER BY ts ASC
    `;
    const dbRes = await pool.query(q, [spacecraftId]);
    res.json({ ok: true, rows: dbRes.rows });
  } catch (err) {
    console.error("GET TELEMETRY ERROR:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------- ADD TELEMETRY ROW ----------
app.post("/telemetry", async (req, res) => {
  const { spacecraft_id, parameter, value, timestamp, unit } = req.body;

  if (!spacecraft_id || !parameter || value === undefined) {
    return res.status(400).json({
      ok: false,
      msg: "spacecraft_id, parameter і value є обовʼязковими"
    });
  }

  try {
    const q = `
      INSERT INTO space_ops.telemetry (spacecraft_id, ts, parameter, value, unit)
      VALUES ($1, COALESCE($4::timestamptz, now()), $2, $3, $5)
      RETURNING 
        id,
        spacecraft_id,
        ts AS "timestamp",
        parameter,
        value,
        unit
    `;
    const dbRes = await pool.query(q, [
      spacecraft_id,
      parameter,
      value,
      timestamp || null,
      unit || null
    ]);

    res.json({ ok: true, row: dbRes.rows[0] });
  } catch (err) {
    console.error("ADD TELEMETRY ERROR:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------- GET LATEST TELEMETRY (по кожному параметру) ----------
app.get("/telemetry/latest", async (req, res) => {
  const spacecraftId = parseInt(req.query.spacecraft_id, 10);

  if (!spacecraftId) {
    return res.status(400).json({
      ok: false,
      msg: "Потрібний параметр spacecraft_id у query"
    });
  }

  try {
    const q = `
      SELECT DISTINCT ON (parameter)
        id,
        spacecraft_id,
        ts AS "timestamp",
        parameter,
        value,
        unit
      FROM space_ops.telemetry
      WHERE spacecraft_id = $1
      ORDER BY parameter, ts DESC
    `;
    const dbRes = await pool.query(q, [spacecraftId]);

    res.json({ ok: true, rows: dbRes.rows });
  } catch (err) {
    console.error("GET LATEST TELEMETRY ERROR:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------- GET TELEMETRY HISTORY (для графіків) ----------
app.get("/telemetry/history", async (req, res) => {
  const spacecraftId = parseInt(req.query.spacecraft_id, 10);
  const limit = parseInt(req.query.limit, 10) || 100;
  const parameter = req.query.parameter || null;

  if (!spacecraftId) {
    return res.status(400).json({
      ok: false,
      msg: "Потрібний параметр spacecraft_id у query"
    });
  }

  try {
    let q, params;

    if (parameter) {
      q = `
        SELECT 
          id,
          spacecraft_id,
          ts AS "timestamp",
          parameter,
          value,
          unit
        FROM space_ops.telemetry
        WHERE spacecraft_id = $1 AND parameter = $2
        ORDER BY ts DESC
        LIMIT $3
      `;
      params = [spacecraftId, parameter, limit];
    } else {
      q = `
        SELECT 
          id,
          spacecraft_id,
          ts AS "timestamp",
          parameter,
          value,
          unit
        FROM space_ops.telemetry
        WHERE spacecraft_id = $1
        ORDER BY ts DESC
        LIMIT $2
      `;
      params = [spacecraftId, limit];
    }

    const dbRes = await pool.query(q, params);

    res.json({ ok: true, rows: dbRes.rows });
  } catch (err) {
    console.error("GET TELEMETRY HISTORY ERROR:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------- SYSTEM STATUS (по місіях) ----------
app.get("/system-status", async (req, res) => {
  try {
    const q = `
      SELECT 
        id,
        name,
        status,
        launch_date,
        spacecraft_cnt,
        last_telemetry_ts
      FROM space_ops.v_mission_summary
      ORDER BY launch_date DESC
    `;
    const dbRes = await pool.query(q);

    const now = new Date();
    const systems = dbRes.rows.map((row) => {
      let systemStatus = "NO_DATA";

      if (row.last_telemetry_ts) {
        const last = new Date(row.last_telemetry_ts);
        const diffMin = (now - last) / 1000 / 60;
        if (diffMin > 10) {
          systemStatus = "OFFLINE";
        } else {
          systemStatus = "OK";
        }
      }

      if (row.status === "aborted") systemStatus = "ABORTED";
      if (row.status === "completed") systemStatus = "COMPLETED";

      return {
        mission_id: row.id,
        mission_name: row.name,
        mission_status: row.status,
        launch_date: row.launch_date,
        spacecraft_cnt: row.spacecraft_cnt,
        last_telemetry_ts: row.last_telemetry_ts,
        system_status: systemStatus
      };
    });

    let globalStatus = "OK";
    for (const s of systems) {
      if (s.system_status === "OFFLINE" || s.system_status === "ABORTED") {
        globalStatus = "ALERT";
        break;
      } else if (s.system_status === "NO_DATA" && globalStatus !== "ALERT") {
        globalStatus = "WARN";
      }
    }

    res.json({
      ok: true,
      global_status: globalStatus,
      systems
    });
  } catch (err) {
    console.error("SYSTEM STATUS ERROR:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ===== START SERVER =====
const PORT = 4000;
app.listen(PORT, () => {
  console.log(` Space Ops Backend running on http://localhost:${PORT}`);
});
