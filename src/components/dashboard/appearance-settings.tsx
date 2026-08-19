"use client";

import { useState } from "react";
import { Sun, Moon, Monitor, Type, Palette, Check, LayoutTemplate, Image } from "lucide-react";
import {
  readAppearance,
  saveAppearance,
  type Theme,
  type FontSize,
  type Accent,
  type Background,
  type Layout,
} from "@/lib/appearance";
import { cn } from "@/lib/utils";

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const FONT_SIZES: { value: FontSize; label: string; px: string }[] = [
  { value: "sm", label: "Small", px: "87%" },
  { value: "md", label: "Default", px: "100%" },
  { value: "lg", label: "Large", px: "112%" },
];

const ACCENTS: { value: Accent; label: string; swatch: string }[] = [
  { value: "blue", label: "Blue", swatch: "#3a5ce0" },
  { value: "violet", label: "Violet", swatch: "#7c5ce0" },
  { value: "emerald", label: "Emerald", swatch: "#0e9f6e" },
  { value: "rose", label: "Rose", swatch: "#e11d48" },
  { value: "slate", label: "Slate", swatch: "#475569" },
];

const BACKGROUNDS: { value: Background; label: string }[] = [
  { value: "default", label: "Plain" },
  { value: "gradient", label: "Gradient" },
  { value: "grid", label: "Grid" },
];

const LAYOUTS: { value: Layout; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "wide", label: "Wide" },
];

export function AppearanceSettings() {
  const [appearance, setAppearance] = useState(() => readAppearance());

  function update(patch: Partial<typeof appearance>) {
    const next = { ...appearance, ...patch };
    setAppearance(next);
    saveAppearance(next);
  }

  return (
    <div className="space-y-6">
      {/* Theme */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Sun className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-heading text-sm font-semibold">Theme</h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => update({ theme: t.value })}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-colors",
                appearance.theme === t.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <t.icon className="h-5 w-5" />
              <span className="text-xs font-medium">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Font size */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Type className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-heading text-sm font-semibold">Font size</h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {FONT_SIZES.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => update({ fontSize: f.value })}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border-2 p-3 transition-colors",
                appearance.fontSize === f.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <span className="font-heading text-base font-bold">{f.px}</span>
              <span className="text-xs font-medium">{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Accent colour */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Palette className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-heading text-sm font-semibold">Accent colour</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          {ACCENTS.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => update({ accent: a.value })}
              className="flex flex-col items-center gap-1.5"
              aria-label={`${a.label} accent`}
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-border"
                style={{ backgroundColor: a.swatch }}
              >
                {appearance.accent === a.value && <Check className="h-4 w-4 text-white" />}
              </span>
              <span className="text-xs font-medium">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Background */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Image className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-heading text-sm font-semibold">Background</h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {BACKGROUNDS.map((b) => (
            <button
              key={b.value}
              type="button"
              onClick={() => update({ background: b.value })}
              className={cn(
                "rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors",
                appearance.background === b.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Layout */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-heading text-sm font-semibold">Content layout</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {LAYOUTS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => update({ layout: l.value })}
              className={cn(
                "rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors",
                appearance.layout === l.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
