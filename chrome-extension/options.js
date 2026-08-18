const ids = ["apiBase", "businessId", "siteDomain", "confirmUrlPattern", "amountSelector"];
const fields = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
const status = document.getElementById("status");

const DEFAULTS = { apiBase: "", businessId: "", siteDomain: "", confirmUrlPattern: "", amountSelector: "" };

chrome.storage.sync.get(DEFAULTS, (stored) => {
  ids.forEach((id) => {
    fields[id].value = stored[id] || "";
  });
});

function originOf(url) {
  try {
    return new URL(url.startsWith("http") ? url : "https://" + url).origin;
  } catch {
    return null;
  }
}

document.getElementById("save").addEventListener("click", async () => {
  const values = {};
  ids.forEach((id) => (values[id] = fields[id].value.trim()));

  const apiOrigin = originOf(values.apiBase);
  const siteOrigin = originOf(values.siteDomain);

  // Request host access for the API (fetch from the service worker) and the
  // tracked site (content-script injection). Skip if already granted.
  const origins = [apiOrigin, siteOrigin].filter(Boolean).map((o) => `${o}/*`);
  const granted = origins.length
    ? await chrome.permissions.request({ origins })
    : true;

  chrome.storage.sync.set(values, () => {
    if (origins.length && !granted) {
      status.textContent = "⚠ Saved, but site access was not granted — the tracker won't run on that domain.";
    } else {
      status.textContent = "✓ Saved";
    }
    setTimeout(() => (status.textContent = ""), 3000);
  });
});
