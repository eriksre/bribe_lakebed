import { useEffect, useState } from "preact/hooks";

export type ThemePreference = "system" | "light" | "dark";
export type SetThemePreference = (preference: ThemePreference) => void;

const THEME_STORAGE_KEY = "bribe.themePreference";
const DARK_THEME_CLASS = "bribe-theme-dark";
const THEME_STYLE_ID = "bribe-theme-style";

const GLOBAL_POLISH_CSS = `
:root {
  --bribe-shadow-border:
    0 0 0 1px rgba(0, 0, 0, 0.06),
    0 1px 2px -1px rgba(0, 0, 0, 0.06),
    0 2px 5px 0 rgba(0, 0, 0, 0.04);
  --bribe-shadow-border-hover:
    0 0 0 1px rgba(0, 0, 0, 0.09),
    0 2px 4px -2px rgba(0, 0, 0, 0.12),
    0 8px 18px -14px rgba(0, 0, 0, 0.22);
}

html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.bribe-app-theme {
  font-variant-numeric: proportional-nums;
}

.bribe-app-theme :where(h1, h2, h3) {
  text-wrap: balance;
}

.bribe-app-theme :where(p, li, label) {
  text-wrap: pretty;
}

.bribe-surface {
  border-color: transparent;
  box-shadow: var(--bribe-shadow-border);
  transition-property: box-shadow, transform;
  transition-duration: 160ms;
  transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
}

.bribe-surface-hover:hover {
  box-shadow: var(--bribe-shadow-border-hover);
}

.bribe-button {
  min-height: 40px;
  transition-property: transform, background-color, color, box-shadow, opacity;
  transition-duration: 150ms;
  transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
}

.bribe-button:active:not(:disabled) {
  transform: scale(0.96);
}

.bribe-app-theme button {
  min-height: 40px;
  transition-property: transform, background-color, color, box-shadow, opacity;
  transition-duration: 150ms;
  transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
}

.bribe-app-theme button:active:not(:disabled) {
  transform: scale(0.96);
}

.bribe-button:focus-visible,
.bribe-field:focus-visible,
.bribe-app-theme button:focus-visible {
  outline: 2px solid rgba(23, 23, 23, 0.72);
  outline-offset: 2px;
}

.bribe-field {
  min-height: 40px;
  transition-property: border-color, box-shadow, background-color;
  transition-duration: 150ms;
  transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
}

.bribe-field:focus {
  border-color: rgba(23, 23, 23, 0.72);
  box-shadow: 0 0 0 3px rgba(23, 23, 23, 0.08);
}

.bribe-app-theme :where(input:not([type="checkbox"]):not([type="radio"]):not([type="color"]):not([type="hidden"]), textarea, select) {
  min-height: 40px;
}

.bribe-image {
  outline: 1px solid rgba(0, 0, 0, 0.1);
  outline-offset: -1px;
}

.bribe-tabular {
  font-variant-numeric: tabular-nums;
}
`;

const DARK_THEME_CSS = `
html.${DARK_THEME_CLASS} { color-scheme: dark; }
html.${DARK_THEME_CLASS} {
  --bribe-shadow-border: 0 0 0 1px rgba(255, 255, 255, 0.08);
  --bribe-shadow-border-hover: 0 0 0 1px rgba(255, 255, 255, 0.13);
}
html.${DARK_THEME_CLASS} .bribe-app-theme { background-color: #0a0a0a !important; color: #fafafa !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme .bg-neutral-50,
html.${DARK_THEME_CLASS} .bribe-app-theme .bg-neutral-50\\/95 { background-color: rgba(10, 10, 10, 0.95) !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme .bg-white,
html.${DARK_THEME_CLASS} .bribe-app-theme .bg-neutral-100 { background-color: #171717 !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme .bg-neutral-100\\/70 { background-color: rgba(23, 23, 23, 0.72) !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme .bg-neutral-200 { background-color: #262626 !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme .bg-neutral-950 { background-color: #f5f5f5 !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme .bg-red-50 { background-color: #451a1a !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme .text-neutral-950,
html.${DARK_THEME_CLASS} .bribe-app-theme .text-neutral-900 { color: #fafafa !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme .text-neutral-800,
html.${DARK_THEME_CLASS} .bribe-app-theme .text-neutral-700 { color: #e5e5e5 !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme .text-neutral-600,
html.${DARK_THEME_CLASS} .bribe-app-theme .text-neutral-500 { color: #a3a3a3 !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme .text-white { color: #0a0a0a !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme .text-red-700,
html.${DARK_THEME_CLASS} .bribe-app-theme .text-red-800 { color: #fecaca !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme :where(.border, .border-t, .border-r, .border-b, .border-l) { border-color: #333333 !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme .border-transparent { border-color: transparent !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme .border-neutral-300 { border-color: #404040 !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme .border-neutral-900,
html.${DARK_THEME_CLASS} .bribe-app-theme .border-neutral-950 { border-color: #f5f5f5 !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme .border-red-200 { border-color: #7f1d1d !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme input,
html.${DARK_THEME_CLASS} .bribe-app-theme textarea,
html.${DARK_THEME_CLASS} .bribe-app-theme select { background-color: #171717 !important; border-color: #404040 !important; color: #fafafa !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme input[type="checkbox"] { accent-color: #f5f5f5; }
html.${DARK_THEME_CLASS} .bribe-app-theme input[type="color"] { background-color: transparent !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme input::placeholder,
html.${DARK_THEME_CLASS} .bribe-app-theme textarea::placeholder { color: #737373 !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme .shadow-sm { box-shadow: 0 1px 2px rgb(0 0 0 / 0.5) !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme .bribe-surface,
html.${DARK_THEME_CLASS} .bribe-app-theme .bribe-surface-hover:hover { border-color: transparent !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme .bribe-image { outline-color: rgba(255, 255, 255, 0.1) !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme .bribe-button:focus-visible,
html.${DARK_THEME_CLASS} .bribe-app-theme .bribe-field:focus-visible,
html.${DARK_THEME_CLASS} .bribe-app-theme button:focus-visible { outline-color: rgba(245, 245, 245, 0.72); }
html.${DARK_THEME_CLASS} .bribe-app-theme .bribe-field:focus { border-color: rgba(245, 245, 245, 0.72) !important; box-shadow: 0 0 0 3px rgba(245, 245, 245, 0.1) !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme .hover\\:bg-white:hover,
html.${DARK_THEME_CLASS} .bribe-app-theme .hover\\:bg-neutral-50:hover { background-color: #262626 !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme .hover\\:bg-neutral-800:hover { background-color: #e5e5e5 !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme .hover\\:border-neutral-900:hover { border-color: #d4d4d4 !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme .hover\\:text-neutral-950:hover { color: #fafafa !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme .hover\\:text-neutral-600:hover { color: #d4d4d4 !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme .bribe-reward-card {
  background-color: #0a0a0a !important;
  border-color: rgba(255, 255, 255, 0.15) !important;
  color: #ffffff !important;
}
html.${DARK_THEME_CLASS} .bribe-app-theme .bribe-reward-card .text-white { color: #ffffff !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme .bribe-reward-card .text-white\\/70 { color: rgba(255, 255, 255, 0.7) !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme .bribe-reward-card .text-white\\/65 { color: rgba(255, 255, 255, 0.65) !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme .bribe-reward-card .text-white\\/75 { color: rgba(255, 255, 255, 0.75) !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme .bribe-reward-panel { border-color: rgba(255, 255, 255, 0.12) !important; }
html.${DARK_THEME_CLASS} .bribe-app-theme .bribe-qr-plate {
  background-color: #ffffff !important;
  border-color: #d4d4d4 !important;
  color: #0a0a0a !important;
}
`;

export function useThemePreference(): [ThemePreference, SetThemePreference] {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readThemePreference());

  useEffect(() => {
    ensureThemeStyle();

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const isDark = preference === "dark" || (preference === "system" && media.matches);
      document.documentElement.classList.toggle(DARK_THEME_CLASS, isDark);
    };

    applyTheme();

    if (preference !== "system") {
      return undefined;
    }

    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [preference]);

  function setPreference(nextPreference: ThemePreference) {
    setPreferenceState(nextPreference);
    writeThemePreference(nextPreference);
  }

  return [preference, setPreference];
}

function readThemePreference(): ThemePreference {
  if (typeof localStorage === "undefined") {
    return "system";
  }

  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return isThemePreference(stored) ? stored : "system";
}

function writeThemePreference(preference: ThemePreference) {
  localStorage.setItem(THEME_STORAGE_KEY, preference);
}

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function ensureThemeStyle() {
  if (document.getElementById(THEME_STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = THEME_STYLE_ID;
  style.textContent = `${GLOBAL_POLISH_CSS}\n${DARK_THEME_CSS}`;
  document.head.appendChild(style);
}
