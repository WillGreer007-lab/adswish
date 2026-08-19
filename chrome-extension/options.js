const ids = ["apiBase", "businessId", "siteDomain", "confirmUrlPattern", "amountSelector"];
const fields = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
const status = document.getElementById("status");

const DEFAULTS = { apiBase: "", businessId: "", siteDomain: "", confirmUrlPattern: "", amountSelector: "" };

chrome.storage.sync.get(DEFAULTS, (stored) => {
  ids.forEach((id) => {
    fields[id].value = stored[id] || "";
  });
});

document.getElementById("save").addEventListener("click", () => {
  const values = {};
  ids.forEach((id) => (values[id] = fields[id].value.trim()));

  // Host access comes from the manifest's host_permissions (all sites), so no
  // runtime permission request is needed — the tracker works on any domain.
  // apiBase + businessId are the only required fields; siteDomain and the
  // auto-detect fields are optional helpers.
  chrome.storage.sync.set(values, () => {
    if (!values.apiBase || !values.businessId) {
      status.textContent = "⚠ Saved — set the API base URL and Business ID for the tracker to work.";
    } else {
      status.textContent = "✓ Saved — the tracker is active on all sites.";
    }
    setTimeout(() => (status.textContent = ""), 3500);
  });
});
