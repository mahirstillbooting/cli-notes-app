const THEME_STORAGE_KEY = "cli-notes-theme";

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function getActiveTheme() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === "light" || saved === "dark") {
    return saved;
  }
  return getSystemTheme();
}

export function applyTheme(theme) {
  const resolved = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = resolved;

  const toggleButtons = document.querySelectorAll("[data-theme-toggle]");
  toggleButtons.forEach((btn) => {
    const nextLabel = resolved === "dark" ? "Light" : "Dark";
    btn.setAttribute("aria-pressed", String(resolved === "dark"));
    btn.setAttribute("aria-label", `Switch to ${nextLabel.toLowerCase()} theme`);
    btn.setAttribute("title", `Switch to ${nextLabel.toLowerCase()} theme (Alt+T)`);

    const labelEl = btn.querySelector(".theme-btn-label");
    if (labelEl) {
      labelEl.textContent = resolved === "dark" ? "LIGHT" : "DARK";
    }
  });
}

export function toggleTheme() {
  const current = document.documentElement.dataset.theme || getActiveTheme();
  const next = current === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_STORAGE_KEY, next);
  applyTheme(next);
}

/**
 * Delays invoking `fn` until `waitMs` milliseconds have elapsed
 * since the last call (default 250ms).
 */
export function debounce(fn, waitMs = 250) {
  let timerId = null;

  function debounced(...args) {
    if (timerId !== null) {
      clearTimeout(timerId);
    }
    timerId = setTimeout(() => {
      timerId = null;
      fn(...args);
    }, waitMs);
  }

  debounced.cancel = () => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  return debounced;
}

/**
 * Only reveals a loading skeleton/spinner if an async operation
 * takes longer than `delayMs` (~300ms), preventing visual flicker on fast loads.
 */
export function createDelayedLoader(onShow, onHide, delayMs = 300) {
  let timerId = null;
  let visible = false;

  return {
    start() {
      this.stop();
      timerId = setTimeout(() => {
        timerId = null;
        visible = true;
        onShow();
      }, delayMs);
    },
    stop() {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      if (visible) {
        visible = false;
        onHide();
      }
    },
    isVisible() {
      return visible;
    }
  };
}

function initThemeControls() {
  applyTheme(getActiveTheme());

  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    btn.addEventListener("click", toggleTheme);
  });

  window.addEventListener("keydown", (event) => {
    if (event.altKey && event.key.toLowerCase() === "t") {
      event.preventDefault();
      toggleTheme();
    }
  });

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", () => {
    if (!localStorage.getItem(THEME_STORAGE_KEY)) {
      applyTheme(getSystemTheme());
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initThemeControls);
} else {
  initThemeControls();
}
