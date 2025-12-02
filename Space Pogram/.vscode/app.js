// ===== SPACE-OPS CONSOLE v2.0 =====

// Користувачі з доступом (ім'я → пароль 1234)
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

// ====== Шорткати ======
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// ====== "База даних" (локально) ======
let DB = {
  missions: [],
  spacecraft: [],
  telemetry: [],
  logs: []
};

// ====== LocalStorage ======
function saveDB() {
  localStorage.setItem("space_ops_db", JSON.stringify(DB));
}
function loadDB() {
  const raw = localStorage.getItem("space_ops_db");
  if (raw) {
    try {
      DB = JSON.parse(raw);
    } catch (e) {}
  }
}

// ====== BOOT SEQUENCE ======
window.addEventListener("load", () => {
  const bootEl = $("#boot-screen");
  const loginEl = $("#login-screen");

  const bootSound = $("#bootSound");
  const bgNoise = $("#bgNoise");

  // граємо звук boot і вмикаємо фоновий шум
  bootSound && bootSound.play().catch(() => {});
  bgNoise && (bgNoise.volume = 0.05, bgNoise.play().catch(() => {}));

  // показати логін після boot
  setTimeout(() => {
    bootEl.style.transition = "opacity 1s ease";
    bootEl.style.opacity = "0";

    setTimeout(() => {
      bootEl.classList.add("hidden");
      loginEl.classList.remove("hidden");
    }, 1000);
  }, 4000);
});

// ====== LOGIN LOGIC ======
const loginForm = $("#loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const name = $("#username").value.trim();
    const pass = $("#password").value.trim();
    const status = $("#loginStatus");

    // check
    const okName = ALLOWED_USERS.some(
      (u) => u.toLowerCase() === name.toLowerCase()
    );
    const okPass = pass === DEFAULT_PASSWORD;

    if (okName && okPass) {
      // доступ дозволено
      status.textContent = `ACCESS GRANTED. WELCOME, ${name.toUpperCase()}`;
      status.classList.remove("err");
      status.classList.add("ok");

      // клік звук для підтвердження
      const clickSound = $("#clickSound");
      clickSound && (clickSound.currentTime = 0, clickSound.play().catch(()=>{}));

      // зберегти ім'я оператора, показати дашборд
      setTimeout(() => {
        openAppForUser(name);
      }, 800);
    } else {
      // помилка доступу
      status.textContent = "ACCESS DENIED";
      status.classList.remove("ok");
      status.classList.add("err");

      const errorSound = $("#errorSound");
      errorSound && (errorSound.currentTime = 0, errorSound.play().catch(()=>{}));

      // тряска екрана при відмові
      document.body.classList.add("shake");
      setTimeout(() => document.body.classList.remove("shake"), 600);
    }
  });
}

// Після успішного логіну
function openAppForUser(username) {
  $("#login-screen").classList.add("hidden");

  // оновити "WELCOME" текст
  $("#userWelcome").textContent =
    `WELCOME, ${username.toUpperCase()} — ACCESS GRANTED`;

  // показати основну консоль
  $(".app").classList.remove("hidden");

  // ініціалізувати консоль (дані, події)
  initApp();
}

// ====== ІНІЦІАЛІЗАЦІЯ ДОДАТКА ======
function initApp() {
  loadDB();
  renderMissions();
  renderSpacecraft();
  populateTelemetrySelect();
  renderLogs();
  bindEvents();
}

// ====== Прив'язка подій ======
function bindEvents() {
  // перемикання вкладок
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-view]");
    if (btn) {
      switchView(btn.dataset.view);
      playClick();
    }
  });

  // пошук місій
  $("#missionSearch")?.addEventListener("input", (e) => {
    const value = e.target.value.trim().toLowerCase();
    // пасхалка: azov / godmode
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

  $("#modal").addEventListener("click", (e) => {
    if (e.target.id === "modal") closeModal();
  });

  $("#telemetrySelect")?.addEventListener("change", (e) => {
    showTelemetryFor(parseInt(e.target.value));
  });

  // звук кліку при натисканні будь-якої .btn або .nav-btn
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("btn") || e.target.classList.contains("nav-btn")) {
      playClick();
    }
  });
}

// ====== ЗВУКИ ======
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

  errorSound && (errorSound.currentTime = 0, errorSound.play().catch(()=>{}));
  overlay.classList.remove("hidden");
  document.body.classList.add("shake");
  setTimeout(() => {
    overlay.classList.add("hidden");
    document.body.classList.remove("shake");
  }, 2500);
}

// ====== Вкладки ======
function switchView(view) {
  $$(".nav-btn").forEach((b) => b.classList.remove("active"));
  $(`[data-view='${view}']`).classList.add("active");

  $$(".view").forEach((v) => {
    v.style.display = v.id === view ? "block" : "none";
  });
}

// ====== МІСІЇ ======
function renderMissions(filter = "") {
  const host = $("#missionsList");
  if (!host) return;
  host.innerHTML = "";

  const q = filter.trim().toLowerCase();
  const items = DB.missions.filter(
    (m) => !q || (m.name + m.status + m.description).toLowerCase().includes(q)
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

// створення місії
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

  $("#saveMission").onclick = () => {
    const name = $("#newName").value.trim();
    const date = $("#newLaunch").value.trim();
    const status = $("#newStatus").value.trim() || "planned";
    const desc = $("#newDesc").value.trim();

    if (!name || !date) {
      alert("Вкажи назву місії і дату запуску.");
      return;
    }

    const id = DB.missions.length
      ? Math.max(...DB.missions.map((x) => x.id)) + 1
      : 1;

    DB.missions.push({
      id,
      name,
      launch_date: date,
      status,
      description: desc
    });

    saveDB();
    closeModal();
    renderMissions();
    addLog(`Місію "${name}" додано`);
  };
}

// ====== АПАРАТИ ======
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

// ====== ТЕЛЕМЕТРІЯ ======
function populateTelemetrySelect() {
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
    sel.value = DB.spacecraft[0].id;
    showTelemetryFor(DB.spacecraft[0].id);
  } else {
    $("#telemetryTable").innerHTML = "<p class='muted small'>Немає телеметрії</p>";
    drawTelemetryChart([]);
  }
}

// симуляція (додає значення кожну секунду)
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

// простий лінійний графік на <canvas>
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

// ====== LOGS ======
function renderLogs() {
  const box = $("#logsContainer");
  if (!box) return;

  if (!DB.logs.length) {
    box.innerHTML = `<div class="log-entry">[SYSTEM] Логів ще немає</div>`;
    return;
  }

  box.innerHTML = DB.logs
    .map(
      (l) =>
        `<div class="log-entry">[${l.time}] ${escapeHTML(l.text)}</div>`
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

// ====== DEMО-КНОПКА "Завантажити демо-дані" ======
function loadSampleData() {
  // показати помилку з глітчем
  showErrorOverlay();

  // додати трохи демо-даних
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

// ====== ІМПОРТ / ЕКСПОРТ ======
function exportData() {
  const dataStr = "data:text/json;charset=utf-8," +
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

// ====== МОДАЛКА ======
function openModal(html) {
  $("#modalContent").innerHTML = html;
  $("#modal").classList.add("open");
}
function closeModal() {
  $("#modal").classList.remove("open");
}

// ====== УТИЛІТИ ======
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

// ====== ПАСХАЛКА ======
function activateEasterEgg() {
  document.body.style.background = "#300";
  addLog(">>> GODMODE ACTIVATED <<<");
  toast("GODMODE ENABLED: SYSTEM OVERRIDE");

  setTimeout(() => {
    document.body.style.background = "#010d05";
  }, 3000);
}
