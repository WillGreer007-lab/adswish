export type Theme = "light" | "dark" | "system";
export type FontSize = "sm" | "md" | "lg";
export type Accent = "blue" | "violet" | "emerald" | "rose" | "slate";
export type Background = "default" | "gradient" | "grid";
export type Layout = "standard" | "wide";

const KEYS = {
  theme: "adswish-theme",
  fontSize: "adswish-font-size",
  accent: "adswish-accent",
  background: "adswish-background",
  layout: "adswish-layout",
} as const;

export type Appearance = {
  theme: Theme;
  fontSize: FontSize;
  accent: Accent;
  background: Background;
  layout: Layout;
};

export const DEFAULTS: Appearance = {
  theme: "light",
  fontSize: "md",
  accent: "blue",
  background: "default",
  layout: "standard",
};

export function applyAppearance(a: Appearance) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const resolved =
    a.theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : a.theme;
  if (resolved === "dark") root.setAttribute("data-theme", "dark");
  else root.removeAttribute("data-theme");
  root.setAttribute("data-font-size", a.fontSize);
  root.setAttribute("data-accent", a.accent);
  if (a.background === "default") root.removeAttribute("data-background");
  else root.setAttribute("data-background", a.background);
  root.setAttribute("data-layout", a.layout);
}

export function readAppearance(): Appearance {
  if (typeof window === "undefined") return DEFAULTS;
  return {
    theme: (localStorage.getItem(KEYS.theme) as Theme) || DEFAULTS.theme,
    fontSize: (localStorage.getItem(KEYS.fontSize) as FontSize) || DEFAULTS.fontSize,
    accent: (localStorage.getItem(KEYS.accent) as Accent) || DEFAULTS.accent,
    background: (localStorage.getItem(KEYS.background) as Background) || DEFAULTS.background,
    layout: (localStorage.getItem(KEYS.layout) as Layout) || DEFAULTS.layout,
  };
}

export function saveAppearance(a: Appearance) {
  localStorage.setItem(KEYS.theme, a.theme);
  localStorage.setItem(KEYS.fontSize, a.fontSize);
  localStorage.setItem(KEYS.accent, a.accent);
  localStorage.setItem(KEYS.background, a.background);
  localStorage.setItem(KEYS.layout, a.layout);
  applyAppearance(a);
}

/** Clear all saved appearance settings and reset the DOM to defaults.
 *  Called on logout so the landing/login pages always show the default theme. */
export function resetAppearance() {
  if (typeof window === "undefined") return;
  for (const key of Object.values(KEYS)) {
    localStorage.removeItem(key);
  }
  applyAppearance(DEFAULTS);
}
