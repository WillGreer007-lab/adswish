import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatCompactNumber,
  formatDate,
  truncate,
} from "@/lib/utils";

describe("formatCurrency", () => {
  it("formats the platform currency correctly", () => {
    expect(formatCurrency(1234.56)).toBe("£1,234.56");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("£0.00");
  });

  it("handles large numbers", () => {
    expect(formatCurrency(1000000)).toBe("£1,000,000.00");
  });
});

describe("formatCompactNumber", () => {
  it("formats thousands", () => {
    expect(formatCompactNumber(1200)).toBe("1.2K");
  });

  it("formats millions", () => {
    expect(formatCompactNumber(1500000)).toBe("1.5M");
  });
});

describe("formatDate", () => {
  it("formats a date string", () => {
    const result = formatDate("2026-01-15T00:00:00Z");
    expect(result).toContain("2026");
    expect(result).toContain("Jan");
  });
});

describe("truncate", () => {
  it("truncates long strings", () => {
    expect(truncate("Hello World", 5)).toBe("Hell…");
  });

  it("does not truncate short strings", () => {
    expect(truncate("Hi", 10)).toBe("Hi");
  });
});
