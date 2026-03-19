import ReactGA from "https://cdn.skypack.dev/react-ga4";

const MEASUREMENT_ID = "G-XXXXXXXXXX";
const SNAPSHOT_INTERVAL_MS = 60000;
const ACTIVE_WINDOW_MS = 5000;
const UNIQUE_BUTTONS_STORAGE_KEY = "kmu-vd.analytics.unique-buttons";

let initialized = false;
let sessionStartedAt = 0;
let lastTickAt = 0;
let lastActivityAt = 0;
let activeTimeMs = 0;
let uniqueButtons = new Set();

function currentTime() {
  return Date.now();
}

function buttonText(button) {
  return (button.innerText || button.textContent || button.getAttribute("aria-label") || "unknown")
    .replace(/\s+/g, " ")
    .trim();
}

function buttonIdentifier(button) {
  return `${button.id || "no-id"}::${buttonText(button)}`;
}

function totalButtonsOnPage() {
  return document.querySelectorAll("button").length;
}

function restoreUniqueButtons() {
  try {
    const raw = sessionStorage.getItem(UNIQUE_BUTTONS_STORAGE_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      uniqueButtons = new Set(parsed);
    }
  } catch {
    uniqueButtons = new Set();
  }
}

function persistUniqueButtons() {
  sessionStorage.setItem(UNIQUE_BUTTONS_STORAGE_KEY, JSON.stringify([...uniqueButtons]));
}

function markActivity() {
  lastActivityAt = currentTime();
}

function flushActiveTime() {
  const now = currentTime();
  const delta = now - lastTickAt;

  if (delta > 0 && now - lastActivityAt <= ACTIVE_WINDOW_MS) {
    activeTimeMs += delta;
  }

  lastTickAt = now;
}

function buildEngagementPayload() {
  flushActiveTime();

  const totalTimeMs = Math.max(currentTime() - sessionStartedAt, 1);
  const totalButtonCount = Math.max(totalButtonsOnPage(), 1);
  const uniqueClickCount = uniqueButtons.size;
  const activeRatio = activeTimeMs / totalTimeMs;
  const uniqueRatio = uniqueClickCount / totalButtonCount;

  return {
    active_time_ms: Math.round(activeTimeMs),
    total_time_ms: Math.round(totalTimeMs),
    unique_click_count: uniqueClickCount,
    total_button_count: totalButtonCount,
    engagement_formula_score: Number((activeRatio + uniqueRatio).toFixed(4)),
  };
}

function sendSnapshot(trigger) {
  ReactGA.event("engagement_snapshot", {
    trigger,
    ...buildEngagementPayload(),
  });
}

function setupButtonTracking() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) {
      return;
    }

    const identifier = buttonIdentifier(button);
    const isUnique = !uniqueButtons.has(identifier);

    if (isUnique) {
      uniqueButtons.add(identifier);
      persistUniqueButtons();
    }

    ReactGA.event("button_click", {
      page_total_buttons: totalButtonsOnPage(),
      button_text: buttonText(button),
      is_unique: isUnique,
    });
  });
}

function setupActivityTracking() {
  const activityHandler = () => {
    markActivity();
  };

  window.addEventListener("mousemove", activityHandler, { passive: true });
  window.addEventListener("scroll", activityHandler, { passive: true });
  window.addEventListener("touchmove", activityHandler, { passive: true });

  window.setInterval(() => {
    sendSnapshot("interval");
  }, SNAPSHOT_INTERVAL_MS);

  window.addEventListener("pagehide", () => {
    sendSnapshot("pagehide");
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      sendSnapshot("hidden");
    }
  });
}

export function initializeAnalytics() {
  if (initialized) {
    return;
  }

  initialized = true;
  restoreUniqueButtons();

  ReactGA.initialize(MEASUREMENT_ID);
  ReactGA.send({
    hitType: "pageview",
    page: `${window.location.pathname}${window.location.search}`,
  });

  sessionStartedAt = currentTime();
  lastTickAt = sessionStartedAt;
  lastActivityAt = sessionStartedAt;

  setupButtonTracking();
  setupActivityTracking();
}
