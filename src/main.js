import { activeRepository, repositoryModeLabel } from "./data/service.js?v=mobile-reset-4";
import {
  averageByPeriod,
  aggregateDailyTotals,
  buildDistributionPlot,
  buildSparklinePoints,
  formatDigitalDuration,
  formatMinutes,
  formatShortDate,
  relativeIntensity,
  totalByPeriod,
  totalForDate,
} from "./lib/time.js?v=mobile-reset-4";

const state = {
  catalog: [],
  records: [],
  selection: null,
  screen: "select",
  search: "",
  dbOpen: false,
  dbPeriod: "weekly",
  running: false,
  startedAt: null,
  elapsedSeconds: 0,
  nowTick: Date.now(),
};

const app = document.querySelector("#app");
let tickTimer = null;
const dbSummaryConfigs = [
  { mode: "course-professor", label: "Class + Professor" },
  { mode: "course", label: "Class" },
  { mode: "professor", label: "Professor" },
  { mode: "all", label: "All Participants" },
];

function selectedMeta() {
  return state.catalog.find((item) => item.id === state.selection) ?? null;
}

function currentElapsedSeconds() {
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
      durationMinutes: Math.max(1 / 60, currentElapsedSeconds() / 60),
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

function getMyGroupedRecords(mode) {
  const mine = enrichRecords(recordsForAnalysis()).filter(
    (record) => record.source === "local" || record.source === "live",
  );
  const active = selectedMeta();

  if (mode === "all") {
    return mine;
  }

  if (!active) {
    return [];
  }

  if (mode === "course-professor") {
    return mine.filter((record) => record.catalogId === active.id);
  }

  if (mode === "course") {
    return mine.filter((record) => record.course === active.course);
  }

  if (mode === "professor") {
    return mine.filter((record) => record.professor === active.professor);
  }

  return mine;
}

function buildSummary(mode, label) {
  const records = getGroupedRecords(mode);
  const weekly = totalByPeriod(records, 7);
  const monthly = totalByPeriod(records, 30);
  const overallMonthly = totalByPeriod(getGroupedRecords("all"), 30);
  const samples = aggregateDailyTotals(records);

  return {
    label,
    count: samples.length,
    weekly,
    monthly,
    signal: relativeIntensity(monthly, overallMonthly),
    sparkline: buildSparklinePoints(records, 7),
    distribution: buildDistributionPlot(records, 30),
  };
}

function buildDbSummary(mode, label) {
  const records = getGroupedRecords(mode);
  const days = state.dbPeriod === "weekly" ? 7 : 30;
  const distribution = buildDistributionPlot(records, days);

  return {
    mode,
    label,
    count: distribution.points.length,
    average: averageByPeriod(records, days),
    distribution,
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

function renderDistributionPlot(distribution) {
  const meanX = distribution.max ? (distribution.mean / distribution.max) * 100 : 0;

  return `
    <div class="distribution-chart" aria-hidden="true">
      <div class="distribution-track"></div>
      <div class="distribution-mean" style="left:${meanX}%"></div>
      ${distribution.points
        .map(
          (point) => `
            <span
              class="distribution-dot"
              style="left:${point.x}%; top:${point.y}%"
              title="${point.label} · ${formatMinutes(point.value)}"
            ></span>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderCatalogList() {
  const results = filteredCatalog();

  if (!results.length) {
    return `<div class="result-empty">검색 결과가 없습니다.</div>`;
  }

  return results
    .map(
      (item) => `
        <button class="result-item ${item.id === state.selection ? "is-selected" : ""}" data-select="${item.id}">
          <span>${item.course}</span>
          <strong>${item.professor}</strong>
          <em>${item.code}</em>
        </button>
      `,
    )
    .join("");
}

function renderSelectScreen() {
  const active = selectedMeta();

  return `
    <section class="phone-shell">
      <header class="app-header">
        <div>
          <p class="micro-label">KMU-VD</p>
          <h1>Time Analyzer</h1>
        </div>
        <div class="status-chip">
          <span class="lamp amber"></span>
          ${repositoryModeLabel}
        </div>
      </header>

      <section class="hero-card">
        <p class="hero-kicker">Single-purpose assignment timer</p>
        <h2>수업을 선택하고 바로 측정을 시작하세요.</h2>
      </section>

      <section class="search-card">
        <label class="input-label" for="searchInput">course / professor search</label>
        <input
          id="searchInput"
          class="search-input"
          type="text"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          placeholder="예: 브랜딩 스튜디오 / 이준호"
          value="${escapeHtml(state.search)}"
        />
        <div class="selection-preview">
          <span>current selection</span>
          <strong>${active ? `${active.course} / ${active.professor}` : "수업을 선택하세요"}</strong>
          <em>${active ? active.code : "selection required"}</em>
        </div>
      </section>

      <section class="results-card">
        <div class="section-head">
          <span>Class List</span>
          <strong>${filteredCatalog().length}</strong>
        </div>
        <div class="results-scroll" id="catalogBox">
          ${renderCatalogList()}
        </div>
      </section>

      <footer class="bottom-bar">
        <button class="primary-button" id="advanceStep" ${!active ? "disabled" : ""}>
          Start Measuring
        </button>
      </footer>
    </section>
  `;
}

function renderTimerScreen() {
  const active = selectedMeta();
  const elapsed = currentElapsedSeconds();
  const myClassRecords = getMyGroupedRecords("course-professor");
  const todayTotal = totalForDate(myClassRecords);
  const myWeeklyTotal = totalByPeriod(myClassRecords, 7);
  const myMonthlyTotal = totalByPeriod(myClassRecords, 30);
  const classSummary = buildSummary("course-professor", "Class + Professor");

  return `
    <section class="phone-shell timer-shell">
      <header class="app-header">
        <div>
          <p class="micro-label">MEASUREMENT</p>
          <h1>${active.course}</h1>
          <p class="sub-copy">${active.professor} / ${active.code}</p>
        </div>
        <button class="ghost-button knob-button" id="returnSelect" ${state.running ? "disabled" : ""} aria-label="Change">
          <span class="knob-text">Change</span>
        </button>
      </header>

      <section class="timer-card">
        <p class="micro-label">timer core</p>
        <div class="timer-screen">${formatDigitalDuration(elapsed)}</div>
        <div class="live-indicator">
          <span class="lamp ${state.running ? "green" : "amber"} ${state.running ? "pulse" : ""}"></span>
          ${state.running ? "Recording" : "Armed"}
        </div>
      </section>

      <section class="stats-grid">
        <article class="stat-card">
          <span>today total</span>
          <strong>${formatMinutes(todayTotal)}</strong>
        </article>
        <article class="stat-card">
          <span>weekly total</span>
          <strong>${formatMinutes(myWeeklyTotal)}</strong>
        </article>
        <article class="stat-card">
          <span>monthly total</span>
          <strong>${formatMinutes(myMonthlyTotal)}</strong>
        </article>
      </section>

      <section class="controls-card">
        <div class="control-row">
          <button class="control-button is-dark knob-button ${state.running ? "is-live" : ""}" id="toggleTimer" aria-label="${state.running ? "Stop" : "Start"}">
            <span class="knob-text">${state.running ? "Stop" : "Start"}</span>
          </button>
          <button class="control-button is-light knob-button" id="resetTimer" ${state.running || elapsed === 0 ? "disabled" : ""} aria-label="Reset">
            <span class="knob-text">Reset</span>
          </button>
          <button class="control-button is-blue knob-button" id="openDbSecondary" aria-label="DB">
            <span class="knob-text">DB</span>
          </button>
        </div>
      </section>

      <section class="analysis-card">
        <div class="section-head">
          <span>Live Compare</span>
          <strong>${classSummary.count} samples</strong>
        </div>
        ${renderSparkline(classSummary.sparkline)}
        <p class="analysis-copy">
          전체 월간 총합 대비 ${classSummary.signal >= 0 ? "+" : ""}${classSummary.signal.toFixed(1)}%
        </p>
      </section>
    </section>
  `;
}

function renderDbModal() {
  const summaries = dbSummaryConfigs.map((config) => buildDbSummary(config.mode, config.label));
  const recentRecords = enrichRecords(recordsForAnalysis())
    .filter((record) => record.source !== "live")
    .slice(0, 8);

  return `
    <div class="db-overlay" id="dbOverlay">
      <div class="db-sheet">
        <div class="db-top">
          <div>
            <p class="micro-label">Data Bank</p>
            <h2>Work Time Distribution</h2>
          </div>
          <button class="ghost-button" id="closeDb">Close</button>
        </div>

        <div class="period-toggle" role="tablist" aria-label="DB period toggle">
          <button class="period-button ${state.dbPeriod === "weekly" ? "is-active" : ""}" id="setWeeklyView">
            Weekly
          </button>
          <button class="period-button ${state.dbPeriod === "monthly" ? "is-active" : ""}" id="setMonthlyView">
            Monthly
          </button>
        </div>

        <div class="db-summary-list">
          ${summaries
            .map(
              (summary) => `
                <article class="db-summary-item">
                  <div class="section-head">
                    <span>${summary.label}</span>
                    <strong>${summary.count}</strong>
                  </div>
                  ${renderDistributionPlot(summary.distribution)}
                  <div class="db-summary-meta">
                    <span>${state.dbPeriod === "weekly" ? "weekly average" : "monthly average"}</span>
                    <span>${formatMinutes(summary.average)}</span>
                  </div>
                </article>
              `,
            )
            .join("")}
        </div>

        <div class="db-records">
          <div class="section-head">
            <span>Recent Records</span>
            <strong>${recentRecords.length}</strong>
          </div>
          <div class="db-record-list">
            ${recentRecords
              .map(
                (record) => `
                  <article class="db-record-item">
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
  app.innerHTML = `
    <main class="mobile-app">
      ${state.screen === "select" ? renderSelectScreen() : renderTimerScreen()}
      ${state.dbOpen ? renderDbModal() : ""}
    </main>
  `;

  bindEvents();
}

function updateSearchResultsOnly() {
  const catalogBox = document.querySelector("#catalogBox");
  const count = document.querySelector(".results-card .section-head strong");

  if (catalogBox) {
    catalogBox.innerHTML = renderCatalogList();
  }

  if (count) {
    count.textContent = String(filteredCatalog().length);
  }

  bindCatalogSelection();
}

function bindCatalogSelection() {
  document.querySelectorAll("[data-select]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selection = button.dataset.select;
      render();
    });
  });
}

function bindEvents() {
  document.querySelector("#searchInput")?.addEventListener("input", (event) => {
    state.search = event.currentTarget.value;
    updateSearchResultsOnly();
  });

  bindCatalogSelection();

  document.querySelector("#advanceStep")?.addEventListener("click", () => {
    if (!state.selection) {
      return;
    }

    state.screen = "timer";
    render();
  });

  document.querySelector("#returnSelect")?.addEventListener("click", () => {
    if (state.running) {
      return;
    }

    state.screen = "select";
    state.dbOpen = false;
    render();
  });

  document.querySelector("#openDbSecondary")?.addEventListener("click", () => {
    state.dbOpen = true;
    render();
  });

  document.querySelector("#setWeeklyView")?.addEventListener("click", () => {
    state.dbPeriod = "weekly";
    render();
  });

  document.querySelector("#setMonthlyView")?.addEventListener("click", () => {
    state.dbPeriod = "monthly";
    render();
  });

  document.querySelector("#closeDb")?.addEventListener("click", () => {
    state.dbOpen = false;
    render();
  });

  document.querySelector("#dbOverlay")?.addEventListener("click", (event) => {
    if (event.target.id === "dbOverlay") {
      state.dbOpen = false;
      render();
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
