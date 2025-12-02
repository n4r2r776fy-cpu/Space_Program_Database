// -------------------------------
// SPACE-OPS CONSOLE FRONTEND v2
// -------------------------------

// Адреса бекенда
const API = "http://localhost:4000";

// Користувачі з доступом (офлайн-фолбек, пароль 1234)
const ALLOWED_USERS = [
  "Данило Лагоднюк",
  "Павло Вакулюк",
  "Гупалюк Роман",
  "Дарина Жабчик",
  "Євген Ковальчук",
  "Артем Коцюба",
  "Іван Крупка",
  "Евеліна Малецька",
  "Роман Матвійчук",
  "Андрій Молчанович",
  "Аліна Мороз",
  "Нікіта Нефьодов",
  "Ксенія Ольховська",
  "Андрій Опанасюк",
  "Олександра Рогалінська",
  "Анастасія Середа",
  "Дарина Стернійчук",
  "Арсен Стребчук",
  "Катерина Фоменко",
  "Тарас Шило"
];

const DEFAULT_PASSWORD = "1234";

// ===== ШОРТКАТИ =====
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// ===== ЛОКАЛЬНА "БАЗА ДАНИХ" =====
let DB = {
  missions: [],
  spacecraft: [],
  telemetry: [],
  logs: []
};

// ===== LocalStorage =====
function saveDB() {
  localStorage.setItem("space_ops_db", JSON.stringify(DB));
}
function loadDB() {
  const raw = localStorage.getItem("space_ops_db");
  if (!raw) return;
  try {
    DB = JSON.parse(raw);
  } catch (e) {
    console.warn("Failed to parse local DB", e);
  }
}

// ================= BOOT SEQUENCE =================
window.addEventListener("load", () => {
  const bootEl = $("#boot-screen");
  const loginEl = $("#login-screen");
  const appEl = document.querySelector(".app");
  const bootSound = $("#bootSound");
  const bgNoise = $("#bgNoise");

  if (!bootEl) {
    if (appEl) {
      appEl.classList.remove("hidden");
      initApp();
    }
    return;
  }

  if (bootSound) {
    bootSound.play().catch(() => {});
  }
  if (bgNoise) {
    bgNoise.volume = 0.05;
    bgNoise.loop = true;
    bgNoise.play().catch(() => {});
  }

  setTimeout(() => {
    bootEl.style.transition = "opacity 1s ease";
    bootEl.style.opacity = "0";

    setTimeout(() => {
      bootEl.classList.add("hidden");

      if (loginEl) {
        loginEl.classList.remove("hidden");
      } else if (appEl) {
        appEl.classList.remove("hidden");
        initApp();
      }
    }, 1000);
  }, 4000);
});

// =============== LOGIN LOGIC ===================
const loginForm = $("#loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = $("#username").value.trim();
    const pass = $("#password").value.trim();
    const status = $("#loginStatus");

    if (!status) return;

    if (!name || !pass) {
      status.textContent = "ВВЕДИ ІМ'Я ТА ПАРОЛЬ";
      status.classList.remove("ok");
      status.classList.add("err");
      return;
    }

    status.textContent = "CHECKING ACCESS...";
    status.classList.remove("ok", "err");

    const localOkName = ALLOWED_USERS.some(
      (u) => u.toLowerCase() === name.toLowerCase()
    );
    const localOkPass = pass === DEFAULT_PASSWORD;

    const fallbackLocalLogin = () => {
      if (localOkName && localOkPass) {
        status.textContent = `LOCAL ACCESS GRANTED, ${name.toUpperCase()}`;
        status.classList.remove("err");
        status.classList.add("ok");

        const clickSound = $("#clickSound");
        clickSound &&
          ((clickSound.currentTime = 0), clickSound.play().catch(() => {}));

        setTimeout(() => {
          openAppForUser(name);
        }, 800);
      } else {
        status.textContent = "ACCESS DENIED";
        status.classList.remove("ok");
        status.classList.add("err");

        const errorSound = $("#errorSound");
        errorSound &&
          ((errorSound.currentTime = 0), errorSound.play().catch(() => {}));

        document.body.classList.add("shake");
        setTimeout(() => document.body.classList.remove("shake"), 600);
      }
    };

    try {
      const res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name, password: pass })
      });

      if (!res.ok) throw new Error("HTTP " + res.status);

      const data = await res.json();
      console.log("LOGIN RESPONSE:", data);

      if (data.ok) {
        status.textContent = `ACCESS GRANTED. WELCOME, ${name.toUpperCase()}`;
        status.classList.remove("err");
        status.classList.add("ok");

        const clickSound = $("#clickSound");
        clickSound &&
          ((clickSound.currentTime = 0), clickSound.play().catch(() => {}));

        setTimeout(() => {
          openAppForUser(name);
        }, 800);
      } else {
        fallbackLocalLogin();
      }
    } catch (err) {
      console.error("LOGIN FETCH ERROR:", err);
      fallbackLocalLogin();
    }
  });
}

// ============ ВХІД У СИСТЕМУ ТА INIT =============
let appInitialized = false;

function openAppForUser(username) {
  const loginEl = $("#login-screen");
  const appEl = document.querySelector(".app");

  if (loginEl) loginEl.classList.add("hidden");
  if (appEl) appEl.classList.remove("hidden");

  const userWelcome = $("#userWelcome");
  if (userWelcome) {
    userWelcome.textContent = `WELCOME, ${username.toUpperCase()} — ACCESS GRANTED`;
  }

  initApp();
}

async function initApp() {
  if (appInitialized) return;
  appInitialized = true;

  loadDB();
  await syncFromBackend().catch(() => {});
  renderMissions();
  renderSpacecraft();
  await populateTelemetrySelect();
  renderLogs();
  bindEvents();

  checkBackendHealth();
  updateSystemStatus();
  setInterval(() => {
    checkBackendHealth();
    updateSystemStatus();
  }, 10000);
}

// ===== СИНХРОНІЗАЦІЯ З БЕКЕНДОМ =====
async function syncFromBackend() {
  try {
    const resp = await fetch(`${API}/missions`);
    if (!resp.ok) throw new Error("HTTP " + resp.status);

    const missions = await resp.json();
    if (Array.isArray(missions)) {
      DB.missions = missions.map((m) => ({
        id: m.id,
        name: m.name,
        launch_date: m.launch_date,
        status: m.status,
        description: m.description || ""
      }));
      saveDB();
      addLog("Дані місій синхронізовано з сервером");
    }
  } catch (err) {
    console.warn(
      "Не вдалося завантажити місії з бекенда, використовую локальні",
      err
    );
    addLog("Не вдалося отримати місії з сервера, використано локальний кеш");
  }
}

// ===== ПЕРЕВІРКА ПІДКЛЮЧЕННЯ ДО БЕКЕНДА / БД =====
async function checkBackendHealth() {
  const dbStatus = $("#dbStatus");
  if (!dbStatus) return;

  try {
    const res = await fetch(`${API}/health`);
    if (!res.ok) throw new Error("HTTP " + res.status);

    const data = await res.json();

    if (data.ok && data.db === "online") {
      dbStatus.textContent = "Підключення до зовнішньої БД: ПРИСУТНЄ (ONLINE)";
      dbStatus.classList.remove("err");
      dbStatus.classList.add("ok");
    } else {
      dbStatus.textContent =
        "Підключення до зовнішньої БД: ПРОБЛЕМИ (див. лог)";
      dbStatus.classList.add("err");
    }
  } catch (err) {
    console.warn("HEALTH ERROR:", err);
    dbStatus.textContent =
      "Підключення до зовнішньої БД: НЕДОСТУПНЕ (офлайн-режим)";
    dbStatus.classList.add("err");
  }
}

// ===== СТАН СИСТЕМИ З БЕКЕНДА =====
async function updateSystemStatus() {
  const textEl = $("#systemStatusText");
  const listEl = $("#systemStatusList");
  if (!textEl || !listEl) return;

  try {
    const res = await fetch(`${API}/system-status`);
    if (!res.ok) throw new Error("HTTP " + res.status);

    const data = await res.json();
    if (!data.ok) throw new Error("Backend returned not ok");

    textEl.textContent = `Глобальний статус: ${data.global_status}`;
    listEl.innerHTML = "";

    data.systems.forEach((s) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${escapeHTML(s.mission_name)}</strong> — 
        статус місії: ${escapeHTML(s.mission_status)}, 
        система: ${escapeHTML(s.system_status)}
      `;
      listEl.appendChild(li);
    });
  } catch (err) {
    console.warn("SYSTEM STATUS ERROR:", err);
    textEl.textContent =
      "Не вдається отримати стан системи (офлайн або помилка сервера).";
    listEl.innerHTML = "";
  }
}

// ===== ТЕЛЕМЕТРІЯ З БЕКЕНДА =====
async function updateTelemetryFromBackend(spacecraftId) {
  if (!spacecraftId) return;
  try {
    const res = await fetch(`${API}/telemetry?spacecraft_id=${spacecraftId}`);
    if (!res.ok) throw new Error("HTTP " + res.status);

    const data = await res.json();
    if (!data.ok || !Array.isArray(data.rows)) return;

    DB.telemetry = DB.telemetry.filter(
      (t) => t.spacecraft_id !== spacecraftId
    );

    const mapped = data.rows.map((r) => ({
      id: r.id,
      spacecraft_id: r.spacecraft_id,
      timestamp: r.timestamp,
      parameter: r.parameter,
      value: r.value
    }));

    DB.telemetry.push(...mapped);
    saveDB();
  } catch (err) {
    console.warn("Не вдалося завантажити телеметрію з бекенда", err);
  }
}

async function sendTelemetryToBackend(data) {
  try {
    await fetch(`${API}/telemetry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spacecraft_id: data.spacecraft_id,
        parameter: data.parameter,
        value: data.value,
        timestamp: data.timestamp
      })
    });
  } catch (err) {
    console.warn("Не вдалося відправити телеметрію на бекенд", err);
  }
}

// ============ ПОДІЇ (кнопки, вкладки і т.д.) ============
function bindEvents() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-view]");
    if (btn) {
      switchView(btn.dataset.view);
      playClick();
    }
  });

  $("#missionSearch")?.addEventListener("input", (e) => {
    const value = e.target.value.trim().toLowerCase();
    if (value === "azov" || value === "godmode") activateEasterEgg();
    renderMissions(value);
  });

  document.addEventListener("click", (e) => {
    if (e.target.id === "addMissionBtn") showAddMission();
    if (e.target.id === "addSpacecraftBtn") showAddSpacecraft();
    if (e.target.id === "loadSample") loadSampleData();
    if (e.target.id === "clearData") clearData();
    if (e.target.id === "closeModal") closeModal();
    if (e.target.id === "exportBtn") exportData();
    if (e.target.id === "simulateBtn") startTelemetrySimulation();
    if (e.target.id === "addLogBtn") addLogEntry();
  });

  $("#importFile")?.addEventListener("change", importData);

  $("#modal")?.addEventListener("click", (e) => {
    if (e.target.id === "modal") closeModal();
  });

  $("#telemetrySelect")?.addEventListener("change", async (e) => {
    const id = parseInt(e.target.value);
    await updateTelemetryFromBackend(id);
    showTelemetryFor(id);
  });

  document.addEventListener("click", (e) => {
    if (
      e.target.classList.contains("btn") ||
      e.target.classList.contains("nav-btn")
    ) {
      playClick();
    }
  });
}

// ===== ЗВУКИ =====
function playClick() {
  const clickSound = $("#clickSound");
  if (clickSound) {
    clickSound.currentTime = 0;
    clickSound.play().catch(() => {});
  }
}

function showErrorOverlay() {
  const overlay = $("#errorOverlay");
  const errorSound = $("#errorSound");
  if (!overlay) return;

  errorSound && (errorSound.currentTime = 0, errorSound.play().catch(() => {}));
  overlay.classList.remove("hidden");
  document.body.classList.add("shake");

  setTimeout(() => {
    overlay.classList.add("hidden");
    document.body.classList.remove("shake");
  }, 2500);
}

// ===== ВКЛАДКИ =====
function switchView(view) {
  $$(".nav-btn").forEach((b) => b.classList.remove("active"));
  const currentBtn = document.querySelector(`[data-view='${view}']`);
  currentBtn && currentBtn.classList.add("active");

  $$(".view").forEach((v) => {
    v.style.display = v.id === view ? "block" : "none";
  });
}

// ===== МІСІЇ =====
function renderMissions(filter = "") {
  const host = $("#missionsList");
  if (!host) return;
  host.innerHTML = "";

  const q = filter.trim().toLowerCase();
  const items = DB.missions.filter(
    (m) =>
      !q ||
      (m.name + m.status + (m.description || "")).toLowerCase().includes(q)
  );

  if (!items.length) {
    host.innerHTML = `<p class="muted small">Немає місій</p>`;
    return;
  }

  items.forEach((m) => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div>
        <strong>${escapeHTML(m.name)}</strong><br>
        <span class="muted small">
          Запуск: ${m.launch_date} • Статус: ${m.status}
        </span>
      </div>
      <div>
        <button class="btn small" onclick="viewMission(${m.id})">Деталі</button>
      </div>`;
    host.appendChild(div);
  });
}

function viewMission(id) {
  const m = DB.missions.find((x) => x.id === id);
  if (!m) return;
  openModal(`
    <h3>${escapeHTML(m.name)}</h3>
    <p class="muted small">Дата запуску: ${m.launch_date}</p>
    <p>${escapeHTML(m.description || "—")}</p>
    <p><strong>Статус:</strong> ${escapeHTML(m.status)}</p>
  `);
}

function showAddMission() {
  openModal(`
    <h3>Додати місію</h3>
    <div class="form">
      <input id="newName" placeholder="Назва місії" />
      <input id="newLaunch" placeholder="Дата запуску (РРРР-ММ-ДД)" />
      <input id="newStatus" placeholder="Статус (active/planned/completed)" />
      <textarea id="newDesc" rows="3" placeholder="Опис місії"></textarea>
      <div style="text-align:right;margin-top:10px;">
        <button class="btn" id="saveMission">Зберегти</button>
      </div>
    </div>
  `);

  $("#saveMission").onclick = async () => {
    const name = $("#newName").value.trim();
    const date = $("#newLaunch").value.trim();
    const status = $("#newStatus").value.trim() || "planned";
    const desc = $("#newDesc").value.trim();

    if (!name || !date) {
      alert("Вкажи назву місії і дату запуску.");
      return;
    }

    const tempMission = {
      id: Date.now(),
      name,
      launch_date: date,
      status,
      description: desc
    };

    DB.missions.push(tempMission);
    saveDB();
    renderMissions();
    addLog(`Місію "${name}" додано (локально)`);

    try {
      const resp = await fetch(`${API}/missions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          launch_date: date,
          duration_days: 0,
          status,
          description: desc
        })
      });

      const data = await resp.json();
      if (data && data.ok && data.mission) {
        const idx = DB.missions.findIndex((m) => m.id === tempMission.id);
        if (idx !== -1) {
          DB.missions[idx] = {
            id: data.mission.id,
            name: data.mission.name,
            launch_date: data.mission.launch_date,
            status: data.mission.status,
            description: data.mission.description || ""
          };
        }
        saveDB();
        renderMissions();
        addLog(`Місію "${name}" синхронізовано з БД`);
      }
    } catch (err) {
      console.warn("Не вдалося записати місію в БД", err);
      addLog(`Місію "${name}" НЕ вдалося записати на сервер (офлайн-режим)`);
    }

    closeModal();
    toast("Місію додано");
  };
}

// ===== АПАРАТИ =====
function renderSpacecraft() {
  const host = $("#spacecraftList");
  if (!host) return;

  host.innerHTML = "";

  if (!DB.spacecraft.length) {
    host.innerHTML = `<p class="muted small">Немає апаратів</p>`;
    return;
  }

  DB.spacecraft.forEach((s) => {
    const mission = DB.missions.find((m) => m.id === s.mission_id);
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div>
        <strong>${escapeHTML(s.name)}</strong><br>
        <span class="muted small">
          ${escapeHTML(s.manufacturer)} • Місія: ${mission ? mission.name : "—"}
        </span>
      </div>`;
    host.appendChild(div);
  });
}

function showAddSpacecraft() {
  openModal(`
    <h3>Додати апарат</h3>
    <div class="form">
      <input id="scName" placeholder="Назва апарата" />
      <input id="scManufacturer" placeholder="Виробник" />
      <input id="scMission" placeholder="ID місії" type="number" />
      <input id="scStatus" placeholder="Статус" />
      <div style="text-align:right;margin-top:10px;">
        <button class="btn" id="saveSC">Зберегти</button>
      </div>
    </div>
  `);

  $("#saveSC").onclick = () => {
    const id = DB.spacecraft.length
      ? Math.max(...DB.spacecraft.map((x) => x.id)) + 1
      : 1;

    const sc = {
      id,
      name: $("#scName").value.trim(),
      manufacturer: $("#scManufacturer").value.trim(),
      mission_id: parseInt($("#scMission").value) || null,
      status: $("#scStatus").value.trim() || "active"
    };

    if (!sc.name) {
      alert("Вкажи назву апарата.");
      return;
    }

    DB.spacecraft.push(sc);
    saveDB();

    closeModal();
    renderSpacecraft();
    populateTelemetrySelect();
    addLog(`Апарат "${sc.name}" додано`);
  };
}

// ===== ТЕЛЕМЕТРІЯ =====
async function populateTelemetrySelect() {
  const sel = $("#telemetrySelect");
  if (!sel) return;

  sel.innerHTML = "";
  DB.spacecraft.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = `${s.name} (id:${s.id})`;
    sel.appendChild(opt);
  });

  if (DB.spacecraft.length) {
    const firstId = DB.spacecraft[0].id;
    sel.value = firstId;

    await updateTelemetryFromBackend(firstId);
    showTelemetryFor(firstId);
  } else {
    $("#telemetryTable").innerHTML =
      "<p class='muted small'>Немає телеметрії</p>";
    drawTelemetryChart([]);
  }
}

function startTelemetrySimulation() {
  const sel = $("#telemetrySelect");
  if (!sel.value) return;
  const id = parseInt(sel.value);

  addLog(`Симуляція телеметрії запущена для апарата ID ${id}`);

  let count = 0;
  const interval = setInterval(() => {
    if (count >= 10) {
      clearInterval(interval);
      return;
    }

    const newData = {
      id: Date.now(),
      spacecraft_id: id,
      timestamp: new Date().toISOString(),
      parameter: "temp",
      value: 30 + Math.random() * 10
    };

    DB.telemetry.push(newData);
    showTelemetryFor(id);
    sendTelemetryToBackend(newData);
    count++;
  }, 1000);
}

function showTelemetryFor(id) {
  const host = $("#telemetryTable");
  if (!host) return;

  host.innerHTML = "";

  const rows = DB.telemetry
    .filter((t) => t.spacecraft_id === id)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  if (!rows.length) {
    host.innerHTML = `<p class="muted small">Немає даних телеметрії</p>`;
    drawTelemetryChart([]);
    return;
  }

  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr><th>Час</th><th>Параметр</th><th>Значення</th></tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (r) =>
            `<tr><td>${r.timestamp}</td><td>${r.parameter}</td><td>${r.value.toFixed(
              2
            )}</td></tr>`
        )
        .join("")}
    </tbody>`;
  host.appendChild(table);

  drawTelemetryChart(rows);
}

function drawTelemetryChart(data) {
  const canvas = $("#telemetryChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!data.length) return;

  const values = data.map((r) => r.value);
  const max = Math.max(...values);
  const min = Math.min(...values);

  ctx.strokeStyle = "#00ff66";
  ctx.beginPath();

  data.forEach((r, i) => {
    const x = (i / (data.length - 1 || 1)) * canvas.width;
    const y =
      canvas.height -
      ((r.value - min) / (max - min || 1)) * canvas.height;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();
}

// ===== LOGS =====
function renderLogs() {
  const box = $("#logsContainer");
  if (!box) return;

  if (!DB.logs.length) {
    box.innerHTML = `<div class="log-entry">[SYSTEM] Логів ще немає</div>`;
    return;
  }

  box.innerHTML = DB.logs
    .map(
      (l) => `<div class="log-entry">[${l.time}] ${escapeHTML(l.text)}</div>`
    )
    .join("");
}

function addLogEntry() {
  const inp = $("#logText");
  const text = inp.value.trim();
  if (!text) return;
  addLog(text);
  inp.value = "";
}

function addLog(text) {
  const entry = {
    time: new Date().toLocaleTimeString(),
    text
  };
  DB.logs.push(entry);
  saveDB();
  renderLogs();
}

// ===== ДЕМО "Завантажити демо-дані" =====
function loadSampleData() {
  showErrorOverlay();

  DB.missions = [
    {
      id: 1,
      name: "Лайка-1",
      launch_date: "2023-03-12",
      status: "active",
      description: "Наукова орбітальна місія зі збирання телеметрії"
    },
    {
      id: 2,
      name: "Orbiter-X",
      launch_date: "2024-07-02",
      status: "completed",
      description: "Експериментальний орбітальний модуль"
    }
  ];

  DB.spacecraft = [
    {
      id: 1,
      name: "LK-1",
      manufacturer: "UA Aerospace",
      mission_id: 1,
      status: "operational"
    },
    {
      id: 2,
      name: "ORB-X",
      manufacturer: "SpaceLab",
      mission_id: 2,
      status: "retired"
    }
  ];

  DB.telemetry = [
    {
      id: 1,
      spacecraft_id: 1,
      timestamp: "2025-11-01T12:11",
      parameter: "temp",
      value: 45.3
    },
    {
      id: 2,
      spacecraft_id: 1,
      timestamp: "2025-11-01T12:12",
      parameter: "voltage",
      value: 28.4
    },
    {
      id: 3,
      spacecraft_id: 2,
      timestamp: "2024-09-01T06:00",
      parameter: "voltage",
      value: 0
    }
  ];

  saveDB();
  renderMissions();
  renderSpacecraft();
  populateTelemetrySelect();
  renderLogs();
  toast("Демо-дані завантажені");
}

// ===== ІМПОРТ / ЕКСПОРТ =====
function exportData() {
  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(DB, null, 2));
  const link = document.createElement("a");
  link.href = dataStr;
  link.download = "space_ops_console_data.json";
  link.click();
  toast("Дані експортовано");
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      DB = JSON.parse(ev.target.result);
      saveDB();
      renderMissions();
      renderSpacecraft();
      populateTelemetrySelect();
      renderLogs();
      toast("Дані імпортовано");
    } catch (err) {
      alert("Помилка: це не валідний .json");
    }
  };
  reader.readAsText(file);
}

function clearData() {
  if (!confirm("Очистити всі локальні дані?")) return;
  DB = { missions: [], spacecraft: [], telemetry: [], logs: [] };
  localStorage.removeItem("space_ops_db");
  renderMissions();
  renderSpacecraft();
  populateTelemetrySelect();
  renderLogs();
  toast("Дані очищено");
}

// ===== МОДАЛКА =====
function openModal(html) {
  $("#modalContent").innerHTML = html;
  $("#modal").classList.add("open");
}
function closeModal() {
  $("#modal").classList.remove("open");
}

// ===== УТИЛІТИ =====
function escapeHTML(str) {
  return String(str).replace(/[&<>\"']/g, (c) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c];
  });
}

function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

// ===== ПАСХАЛКА GODMODE =====
function activateEasterEgg() {
  document.body.style.background = "#300";
  addLog(">>> GODMODE ACTIVATED <<<");
  toast("GODMODE ENABLED: SYSTEM OVERRIDE");

  setTimeout(() => {
    document.body.style.background = "#010d05";
  }, 3000);
}
