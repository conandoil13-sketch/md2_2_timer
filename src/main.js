import { activeRepository, repositoryModeLabel } from "./data/service.js";
import {
  averageByPeriod,
  buildSparklinePoints,
  formatDigitalDuration,
  formatMinutes,
  formatShortDate,
  relativeIntensity,
  totalForDate,
} from "./lib/time.js";

const state = {
  catalog: [],
  records: [],
  selection: null,
  search: "",
  step: "select",
  dbOpen: false,
  running: false,
  startedAt: null,
  elapsedSeconds: 0,
  nowTick: Date.now(),
};

const app = document.querySelector("#app");
let tickTimer = null;

function selectedMeta() {
  return state.catalog.find((item) => item.id === state.selection) ?? null;
}

function elapsedSeconds() {
  if (state.running && state.startedAt) {
    return Math.floor((state.nowTick - state.startedAt) / 1000);
  }

  return state.elapsedSeconds;
}

function recordsForAnalysis() {
  if (!state.running || !state.selection || !state.startedAt) {
    return state.records;
  }

  return [
    {
      id: "live-session",
      catalogId: state.selection,
      durationMinutes: Math.max(1 / 60, elapsedSeconds() / 60),
      createdAt: new Date().toISOString(),
      source: "live",
    },
    ...state.records,
  ];
}

function filteredCatalog() {
  const query = state.search.trim().toLowerCase();
  if (!query) {
    return state.catalog;
  }

  return state.catalog.filter((item) =>
    [item.course, item.professor, item.code].some((value) =>
      value.toLowerCase().includes(query),
    ),
  );
}

function enrichRecords(records) {
  return records
    .map((record) => {
      const meta = state.catalog.find((item) => item.id === record.catalogId);
      if (!meta) {
        return null;
      }

      return {
        ...record,
        course: meta.course,
        professor: meta.professor,
        code: meta.code,
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getGroupedRecords(mode) {
  const current = enrichRecords(recordsForAnalysis());
  const active = selectedMeta();

  if (mode === "all") {
    return current;
  }

  if (!active) {
    return [];
  }

  if (mode === "course-professor") {
    return current.filter((record) => record.catalogId === active.id);
  }

  if (mode === "course") {
    return current.filter((record) => record.course === active.course);
  }

  if (mode === "professor") {
    return current.filter((record) => record.professor === active.professor);
  }

  return current;
}

function buildSummary(mode, label) {
  const records = getGroupedRecords(mode);
  const weekly = averageByPeriod(records, 7);
  const monthly = averageByPeriod(records, 30);
  const overallMonthly = averageByPeriod(getGroupedRecords("all"), 30);
  const signal = relativeIntensity(monthly, overallMonthly);

  return {
    label,
    count: records.length,
    weekly,
    monthly,
    signal,
    sparkline: buildSparklinePoints(records, 7),
  };
}

function renderSparkline(points) {
  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");

  return `
    <svg viewBox="0 0 100 100" class="sparkline" preserveAspectRatio="none" aria-hidden="true">
      <polyline points="${polyline}" />
    </svg>
  `;
}

function renderSelectStep(active) {
  const list = filteredCatalog();

  return `
    <section class="device-panel">
      <div class="print-row">
        <span>9V</span>
        <span>source</span>
        <span>arm</span>
      </div>

      <div class="device-head">
        <div>
          <p class="brand-mark">KMU-VD<br />time analyzer</p>
          <p class="descriptor">
            assignment duration device<br />
            procedural selection interface<br />
            built for visual design students
          </p>
        </div>
        <div class="top-action">
          <span class="tiny-light amber"></span>
          <button class="primary-cta" id="advanceStep" ${!active ? "disabled" : ""}>
            Start Measuring
          </button>
        </div>
      </div>

      <div class="workflow-strip">
        <div class="workflow-node is-active">
          <span>01</span>
          <strong>Select Class</strong>
        </div>
        <div class="workflow-line"></div>
        <div class="workflow-node">
          <span>02</span>
          <strong>Measure + Live Data</strong>
        </div>
      </div>

      <div class="select-layout">
        <div class="knob-cluster">
          <div class="knob-grid">
            <div class="main-knob">
              <div class="knob-pointer"></div>
            </div>
          </div>
          <div class="aux-knob">
            <div class="knob-pointer dark"></div>
          </div>
          <div class="tiny-light green"></div>
        </div>

        <div class="selector-module">
          <label class="field-label" for="searchInput">course / professor search</label>
          <input
            id="searchInput"
            class="device-input"
            type="search"
            autocomplete="off"
            placeholder="예: 브랜딩 스튜디오 / 이준호"
            value="${escapeHtml(state.search)}"
          />

          <div class="selected-plate">
            <span>current selection</span>
            <strong>${active ? `${active.course} / ${active.professor}` : "not armed"}</strong>
            <em>${active ? active.code : "choose one class to proceed"}</em>
          </div>

          <div class="catalog-box">
            ${
              list.length
                ? list
                    .map(
                      (item) => `
                        <button class="catalog-chip ${item.id === state.selection ? "is-selected" : ""}" data-select="${item.id}">
                          <span>${item.course}</span>
                          <strong>${item.professor}</strong>
                          <em>${item.code}</em>
                        </button>
                      `,
                    )
                    .join("")
                : `<div class="catalog-empty">검색 결과가 없습니다.</div>`
            }
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderTimerStep(active, elapsed) {
  const summary = buildSummary("course-professor", "Class + Professor");
  const todayTotal = totalForDate(getGroupedRecords("course-professor"));

  return `
    <section class="device-panel timer-mode">
      <div class="print-row">
        <span>record</span>
        <span>${repositoryModeLabel}</span>
        <span>${state.running ? "live" : "armed"}</span>
      </div>

      <div class="device-head">
        <div>
          <p class="brand-mark">KMU-VD<br />time analyzer</p>
          <p class="descriptor">
            selected source<br />
            ${active.course}<br />
            ${active.professor}
          </p>
        </div>
        <div class="top-action">
          <span class="tiny-light ${state.running ? "green pulse" : "amber"}"></span>
          <button class="secondary-cta" id="returnSelect" ${state.running ? "disabled" : ""}>
            Change Class
          </button>
        </div>
      </div>

      <div class="workflow-strip">
        <div class="workflow-node is-complete">
          <span>01</span>
          <strong>Select Class</strong>
        </div>
        <div class="workflow-line"></div>
        <div class="workflow-node is-active">
          <span>02</span>
          <strong>Measure + Live Data</strong>
        </div>
      </div>

      <div class="timer-layout">
        <div class="readout-zone">
          <div class="readout-frame">
            <span class="screen-tag">timer core</span>
            <div class="digital-readout">${formatDigitalDuration(elapsed)}</div>
          </div>

          <div class="micro-grid">
            <div class="micro-card">
              <span>today total</span>
              <strong>${formatMinutes(todayTotal)}</strong>
            </div>
            <div class="micro-card">
              <span>weekly daily avg</span>
              <strong>${formatMinutes(summary.weekly)}</strong>
            </div>
            <div class="micro-card">
              <span>monthly daily avg</span>
              <strong>${formatMinutes(summary.monthly)}</strong>
            </div>
          </div>
        </div>

        <div class="control-zone">
          <div class="toggle-bank">
            <button class="toggle-knob ${state.running ? "is-engaged" : ""}" id="toggleTimer">
              <span>${state.running ? "stop" : "start"}</span>
            </button>
            <button class="toggle-knob pale" id="resetTimer" ${state.running || elapsed === 0 ? "disabled" : ""}>
              <span>reset</span>
            </button>
            <button class="toggle-knob blue-accent" id="openDbSecondary">
              <span>db</span>
            </button>
          </div>

          <div class="selected-plate compact">
            <span>measuring target</span>
            <strong>${active.course}</strong>
            <em>${active.professor} / ${active.code}</em>
          </div>

          <p class="step-copy">
            측정 중에도 오늘 누적 시간과 평균값이 계속 갱신됩니다. DB 패널에서 전체 비교 데이터를 열 수 있습니다.
          </p>
        </div>
      </div>
    </section>
  `;
}

function renderDbModal(summaries, recentRecords) {
  return `
    <div class="db-overlay" id="dbOverlay">
      <div class="db-panel">
        <div class="db-header">
          <div>
            <p class="eyebrow ink">Data Bank</p>
            <h2>Assignment duration averages</h2>
          </div>
          <button class="close-button" id="closeDb">close</button>
        </div>

        <div class="summary-grid">
          ${summaries
            .map(
              (summary) => `
                <article class="summary-card">
                  <div class="summary-head">
                    <span>${summary.label}</span>
                    <strong>${summary.count} samples</strong>
                  </div>
                  ${renderSparkline(summary.sparkline)}
                  <div class="summary-values">
                    <div>
                      <span>Weekly avg</span>
                      <strong>${formatMinutes(summary.weekly)}</strong>
                    </div>
                    <div>
                      <span>Monthly avg</span>
                      <strong>${formatMinutes(summary.monthly)}</strong>
                    </div>
                  </div>
                  <p class="signal ${summary.signal > 0 ? "high" : "low"}">
                    ${summary.signal >= 0 ? "+" : ""}${summary.signal.toFixed(1)}% vs overall baseline
                  </p>
                </article>
              `,
            )
            .join("")}
        </div>

        <div class="ledger-box">
          <div class="db-subhead">
            <span>Recent records</span>
            <strong>${recentRecords.length} visible entries</strong>
          </div>
          <div class="ledger-list">
            ${recentRecords
              .map(
                (record) => `
                  <article class="ledger-item">
                    <div>
                      <strong>${record.course}</strong>
                      <span>${record.professor} · ${record.code}</span>
                    </div>
                    <div>
                      <strong>${formatMinutes(record.durationMinutes)}</strong>
                      <span>${formatShortDate(record.createdAt)}</span>
                    </div>
                  </article>
                `,
              )
              .join("")}
          </div>
        </div>
      </div>
    </div>
  `;
}

function render() {
  const active = selectedMeta();
  const elapsed = elapsedSeconds();
  const recentRecords = enrichRecords(recordsForAnalysis())
    .filter((record) => record.source !== "live")
    .slice(0, 8);
  const summaries = [
    buildSummary("course-professor", "Class + Professor"),
    buildSummary("course", "Class"),
    buildSummary("professor", "Professor"),
    buildSummary("all", "All Participants"),
  ];

  app.innerHTML = `
    <main class="app-shell">
      <section class="stage">
        ${state.step === "select" ? renderSelectStep(active) : renderTimerStep(active, elapsed)}
      </section>
      ${state.dbOpen ? renderDbModal(summaries, recentRecords) : ""}
    </main>
  `;

  bindEvents();
}

function bindEvents() {
  document.querySelector("#searchInput")?.addEventListener("input", (event) => {
    state.search = event.currentTarget.value;
    render();
  });

  document.querySelectorAll("[data-select]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selection = button.dataset.select;
      render();
    });
  });

  document.querySelector("#advanceStep")?.addEventListener("click", () => {
    if (!state.selection) {
      return;
    }

    state.step = "timer";
    render();
  });

  document.querySelector("#returnSelect")?.addEventListener("click", () => {
    if (state.running) {
      return;
    }

    state.step = "select";
    state.dbOpen = false;
    render();
  });

  document.querySelector("#openDbSecondary")?.addEventListener("click", openDb);
  document.querySelector("#closeDb")?.addEventListener("click", closeDb);
  document.querySelector("#dbOverlay")?.addEventListener("click", (event) => {
    if (event.target.id === "dbOverlay") {
      closeDb();
    }
  });

  document.querySelector("#toggleTimer")?.addEventListener("click", async () => {
    if (!state.running) {
      state.running = true;
      state.startedAt = Date.now() - state.elapsedSeconds * 1000;
      ensureTicker();
      render();
      return;
    }

    state.running = false;
    const totalSeconds = Math.floor((Date.now() - state.startedAt) / 1000);
    state.elapsedSeconds = totalSeconds;
    stopTicker();

    if (state.selection && totalSeconds > 0) {
      await activeRepository.createRecord({
        catalogId: state.selection,
        durationMinutes: Math.max(1, totalSeconds / 60),
      });
      state.records = await activeRepository.listRecords();
    }

    state.elapsedSeconds = 0;
    state.startedAt = null;
    state.dbOpen = true;
    render();
  });

  document.querySelector("#resetTimer")?.addEventListener("click", () => {
    state.elapsedSeconds = 0;
    state.startedAt = null;
    render();
  });
}

function openDb() {
  state.dbOpen = true;
  render();
}

function closeDb() {
  state.dbOpen = false;
  render();
}

function ensureTicker() {
  stopTicker();
  tickTimer = window.setInterval(() => {
    state.nowTick = Date.now();
    render();
  }, 1000);
}

function stopTicker() {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function bootstrap() {
  const [catalog, records] = await Promise.all([
    activeRepository.listCatalog(),
    activeRepository.listRecords(),
  ]);

  state.catalog = catalog;
  state.records = records;
  state.selection = catalog[0]?.id ?? null;
  render();
}

bootstrap();
