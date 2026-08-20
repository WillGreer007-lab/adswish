import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { CHANGELOG } from "@/lib/changelog";

export const dynamic = "force-static";

/**
 * Render the full changelog as a downloadable PDF at /legal/changelog/pdf.
 * Generated from the same CHANGELOG source as the page so they never drift.
 */
export async function GET() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.1, 0.1, 0.1);
  const muted = rgb(0.4, 0.4, 0.4);
  const blue = rgb(0.23, 0.35, 0.88);
  const green = rgb(0.1, 0.55, 0.25);

  const pageWidth = 595.28;
  const pageHeight = 841.89; // A4 portrait
  const marginX = 50;
  const contentWidth = pageWidth - marginX * 2;

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - 60;

  const ensureSpace = (needed: number) => {
    if (y < needed + 60) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - 60;
    }
  };

  // Header
  page.drawText(toPdfSafe("Adswish — Changelog"), { x: marginX, y, size: 22, font: bold, color: blue });
  y -= 24;
  page.drawText(`Generated ${new Date().toISOString().slice(0, 10)}`, {
    x: marginX,
    y,
    size: 10,
    font,
    color: muted,
  });
  y -= 34;

  for (const entry of CHANGELOG) {
    ensureSpace(140);

    page.drawLine({
      start: { x: marginX, y },
      end: { x: pageWidth - marginX, y },
      thickness: 1,
      color: rgb(0.85, 0.85, 0.85),
    });
    y -= 24;

    page.drawText(toPdfSafe(`${entry.version}  ·  ${entry.date}`), {
      x: marginX,
      y,
      size: 11,
      font: bold,
      color: blue,
    });
    y -= 18;

    page.drawText(toPdfSafe(entry.title), { x: marginX, y, size: 14, font: bold, color: ink });
    y -= 22;

    for (const item of entry.highlights) {
      ensureSpace(18);
      const wrapped = wrapText(`•  ${item}`, font, 10, contentWidth - 14);
      for (const line of wrapped) {
        ensureSpace(16);
        page.drawText(line, { x: marginX + 10, y, size: 10, font, color: ink });
        y -= 14;
      }
      y -= 3;
    }

    for (const fix of entry.fixes ?? []) {
      ensureSpace(18);
      const wrapped = wrapText(`•  ${fix}`, font, 10, contentWidth - 14);
      for (const line of wrapped) {
        ensureSpace(16);
        page.drawText(line, { x: marginX + 10, y, size: 10, font, color: green });
        y -= 14;
      }
      y -= 3;
    }

    y -= 18;
  }

  const bytes = await doc.save();

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="adswish-changelog.pdf"',
      "Cache-Control": "public, max-age=86400",
    },
  });
}

/**
 * Characters pdf-lib's built-in Helvetica (WinAnsi encoding) supports beyond
 * Latin-1. Anything else (arrows, emoji, CJK…) must be replaced or dropped or
 * widthOfTextAtSize/drawText throw at build time.
 */
const WIN_ANSI_EXTRA = new Set([
  0x0152, 0x0153, 0x0160, 0x0161, 0x0178, 0x017d, 0x017e, 0x0192, 0x02c6, 0x02dc,
  0x2013, 0x2014, 0x2018, 0x2019, 0x201a, 0x201c, 0x201d, 0x201e, 0x2020, 0x2021,
  0x2022, 0x2026, 0x2030, 0x2039, 0x203a, 0x20ac, 0x2122,
]);

/** Make arbitrary changelog text safe for the built-in Helvetica font. */
function toPdfSafe(text: string): string {
  return text
    .replace(/→/g, "->")
    .replace(/←/g, "<-")
    .replace(/↔/g, "<->")
    .split("")
    .map((ch) => {
      const code = ch.codePointAt(0)!;
      if (code <= 0xff || WIN_ANSI_EXTRA.has(code)) return ch;
      return "";
    })
    .join("");
}

/** Naive word-wrap for the built-in Helvetica font (no shaping). */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const safeText = toPdfSafe(text);
  const words = safeText.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [text];
}
