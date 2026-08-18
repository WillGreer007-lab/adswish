import { ImageResponse } from "next/og";

export const alt = "Adswish — Creator Marketplace";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "72px",
          background: "linear-gradient(135deg, #0b1220 0%, #10233f 100%)",
          color: "#f8fafc",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 40, fontWeight: 700 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: "#3b82f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
            }}
          >
            ✓
          </div>
          <span>adswish</span>
        </div>
        <div style={{ marginTop: 40, fontSize: 64, fontWeight: 800, lineHeight: 1.1, maxWidth: 900 }}>
          The creator marketplace where businesses win.
        </div>
        <div style={{ marginTop: 24, fontSize: 32, color: "#94a3b8" }}>
          Affiliate, fixed-fee &amp; hybrid campaigns — creators keep 90%.
        </div>
      </div>
    ),
    size,
  );
}
