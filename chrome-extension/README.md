# Adswish Tracker (Chrome extension)

A drop-in **alternative to the `/pixel.js` script**. Instead of pasting a
`<script>` tag into your store, install this extension and it captures the
`adswish_ref` attribution token, keeps your campaigns' pixel alive, reports
conversions, and can even auto-detect orders on your confirmation page — no site
code required.

## Install (load unpacked, for development)

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select this `chrome-extension/` folder.
4. Pin the extension, then open its **Options** (right-click the icon → Options).

## Configure (required)

In the extension Options, only two fields matter:

- **Adswish API base URL** — the origin that serves `/pixel.js`:
  - Local dev: `http://localhost:3000`
  - Production: your deployed URL, e.g. `https://adswish-lake.vercel.app`
- **Business ID** — your Adswish business account UUID (shown on the in-app
  **Settings → Tracking** page).

`Tracked site domain` is optional (informational only) — the extension works on
**any** domain out of the box because its host permissions are declared in the
manifest, not requested per-domain at runtime.

## Auto-detect conversions (optional, no code)

Instead of calling `adswish.track()` yourself, you can let the extension watch
your checkout confirmation page:

- **Order-confirmation URL pattern** — a substring of the post-checkout URL
  (e.g. `/thank-you` or `order/confirmed`).
- **Order amount selector** — a CSS selector for the element holding the total
  (e.g. `.order-total` or `[data-total]`).

When the page URL matches, the extension polls for that element, parses the
amount, and fires a conversion. The `orderId` is derived from the URL, so
refreshing the page is idempotent (the server dedupes on `order_id`).

## Manual use

- **Conversions:** your site calls `window.adswish.track({ orderId, amount })`
  exactly as it would with the `/pixel.js` script — or use the popup's
  **Test conversion** button to fire one manually. The extension auto-captures
  the token when someone lands via a `/t/{slug}` tracking link.
- **Pixel heartbeat:** while a tracked page is open, the extension pings
  `/api/v1/pixel/ping` every 60s, marking your Affiliate/Hybrid campaigns
  `pixel_status = active` and keeping the 12-hour pixel-offline penalty from
  firing.

## ⚠️ Honest limitation (vs. the script)

The script tracks **every visitor** to your site, because it runs in their
browser. This extension only tracks **whoever installed it** (its own browsing).
It is ideal for small/early sites, funnel testing, and verifying a link +
conversion end-to-end. For production sites where you need **all visitors**
attributed, keep using the `/pixel.js` script (or GTM template).

## Permissions (Web Store)

- `storage` — saves your config (API URL, business ID, auto-detect rules).
- `activeTab` — lets the popup read the current tab's token when you click it.
- `host_permissions: http://*/* + https://*/*` — **required** for the tracker to
  work: the content scripts must inject into the business's site to capture the
  `adswish_ref` token, and the background service worker fetches the Adswish API
  cross-origin (MV3 service-worker fetches are not subject to the page's CORS,
  but they do require host permissions). Expect the Web Store to show the
  "Read and change all your data on all websites" warning.

## Packaging for the Chrome Web Store

1. Bump `version` in `manifest.json`.
2. Zip the folder (exclude `README.md`/`STORE_LISTING.md` if you like):
   `zip -r adswish-tracker.zip . -x "*.md"`
3. Upload to the Chrome Web Store Developer Dashboard; use `STORE_LISTING.md`
   for the listing copy. The store listing must disclose the broad host
   permission ("reads data on all sites") — it is required for the extension's
   function, so justify it in the "Justification" field during review.
