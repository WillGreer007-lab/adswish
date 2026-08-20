"use client";

import { useState } from "react";
import { Clock, ShieldCheck } from "lucide-react";
import {
  readSessionTimeout,
  saveSessionTimeout,
  SESSION_TIMEOUT_OPTIONS,
  type SessionTimeoutMinutes,
} from "@/lib/session-timeout";
import { cn } from "@/lib/utils";

export function SessionTimeoutSettings() {
  const [value, setValue] = useState<SessionTimeoutMinutes>(() => readSessionTimeout());
  const [saved, setSaved] = useState(false);

  function select(next: SessionTimeoutMinutes) {
    setValue(next);
    saveSessionTimeout(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 rounded-lg border border-border bg-background p-4">
        <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
        <p className="text-xs text-muted-foreground">
          For security, we recommend keeping this under 10 minutes. Choosing &quot;Never&quot; keeps you signed in
          until you log out or close the tab.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {SESSION_TIMEOUT_OPTIONS.map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => select(opt.value)}
            className={cn(
              "flex items-center justify-between rounded-lg border-2 px-4 py-3 text-left transition-colors",
              value === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
            )}
          >
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{opt.label}</span>
            </span>
            {opt.hint && <span className="text-xs text-muted-foreground">{opt.hint}</span>}
          </button>
        ))}
      </div>

      {saved && (
        <p className="text-xs font-medium text-success">Saved ✓ Your session will apply the new timeout on next activity.</p>
      )}
    </div>
  );
}
