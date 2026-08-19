"use client";

import { useEffect } from "react";
import { applyAppearance, readAppearance } from "@/lib/appearance";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyAppearance(readAppearance());
  }, []);

  return <>{children}</>;
}
