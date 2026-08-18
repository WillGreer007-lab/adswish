# Chrome Web Store listing — Adswish Tracker

## Name
Adswish Tracker

## Summary (132 chars max)
Track Adswish affiliate conversions and pixel heartbeats without editing your site's code.

## Detailed description
Adswish Tracker is the no-code alternative to the Adswish tracking pixel. Install
it, point it at your Adswish app and your store, and it captures attribution
tokens from your creator's `/t/{slug}` links, keeps your campaigns' pixel alive,
and reports conversions back to Adswish.

Features
- Drop-in `window.adswish.track({ orderId, amount })` API — the same shape as the
  /pixel.js script, so existing integrations just work.
- Auto-detect conversions: give it your order-confirmation URL pattern and the
  CSS selector for the order total, and it fires conversions automatically.
- Pixel heartbeat every 60s keeps the 12-hour pixel-offline penalty from
  suspending your campaigns.
- One-click test from the popup: send a heartbeat or a test conversion.

Permissions
This extension uses optional host permissions. It requests access only to the
two origins you enter in its settings (your Adswish API URL and your tracked
site domain) — it does not take broad access to all sites at install time.

Privacy
Your configuration (Adswish API URL, business ID, tracked domain, and
auto-detect rules) is stored in Chrome sync and is not transmitted anywhere
except to the Adswish API endpoints you configure. Conversion data (order id and
amount) is sent only to the Adswish API when a conversion fires.

## Category
Productivity

## Language
English
