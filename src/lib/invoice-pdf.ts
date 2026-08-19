import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface InvoicePdfInput {
  creatorName: string;
  monthStart: string; // ISO date
  monthEnd: string; // ISO date
  totalReleased: number;
}

/**
 * Render a one-page payout statement. Returns the PDF bytes so the caller can
 * upload it to Storage and set the invoice's pdf_url.
 */
export async function generateInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595.28, 841.89]); // A4 portrait

  const ink = rgb(0.1, 0.1, 0.1);
  const muted = rgb(0.4, 0.4, 0.4);
  const blue = rgb(0.23, 0.35, 0.88);

  let y = 790;

  page.drawText("Adswish — Payout Statement", { x: 50, y, size: 20, font: bold, color: blue });
  y -= 30;

  page.drawText(`Creator: ${input.creatorName || "Creator"}`, { x: 50, y, size: 12, font, color: ink });
  y -= 18;
  page.drawText(`Period: ${input.monthStart} to ${input.monthEnd}`, { x: 50, y, size: 12, font, color: muted });
  y -= 18;
  page.drawText(`Generated: ${new Date().toISOString().slice(0, 10)}`, { x: 50, y, size: 12, font, color: muted });
  y -= 40;

  // Divider
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
  y -= 30;

  page.drawText("Total released (GBP)", { x: 50, y, size: 12, font: bold, color: muted });
  y -= 22;
  page.drawText(`£${Number(input.totalReleased).toFixed(2)}`, { x: 50, y, size: 26, font: bold, color: ink });
  y -= 50;

  page.drawText(
    "This statement summarizes creator earnings released during the period. " +
      "Payouts are subject to Adswish's 10% platform fee and the £25 minimum payout threshold.",
    { x: 50, y, size: 9, font, color: muted, maxWidth: 495, lineHeight: 13 },
  );

  const bytes = await doc.save();
  return bytes;
}
