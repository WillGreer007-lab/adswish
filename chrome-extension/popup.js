const $ = (id) => document.getElementById(id);

function setStatus(ok, text) {
  $("statusDot").className = "dot " + (ok ? "green" : "red");
  $("statusText").textContent = text;
}

function render() {
  chrome.storage.sync.get(["apiBase", "businessId"], (stored) => {
    $("apiBase").textContent = stored.apiBase || "(not set)";
    $("businessId").textContent = stored.businessId || "(not set)";

    if (!stored.apiBase || !stored.businessId) {
      setStatus(false, "Not working — open Settings");
      return;
    }

    // Live check: ping the API through the background worker.
    chrome.runtime.sendMessage({ type: "heartbeat", payload: {} }, (resp) => {
      if (resp && resp.ok) {
        setStatus(true, "Working");
      } else {
        setStatus(false, "Not working — check Settings");
      }
    });
  });
}

function result(msg, ok) {
  $("result").textContent = (ok ? "✓ " : "✘ ") + msg;
}

function activeTabToken(cb) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || !tab.id) return cb("");
    chrome.tabs.sendMessage(tab.id, { type: "getToken" }, (resp) => {
      cb(resp && resp.token ? resp.token : "");
    });
  });
}

function sendToBackground(message) {
  chrome.runtime.sendMessage(message, (resp) => {
    result(resp && resp.ok ? "OK (HTTP " + resp.status + ")" : (resp && resp.error) || "failed", resp && resp.ok);
  });
}

render();
activeTabToken((token) => {
  $("token").textContent = token || "(no attribution token on this tab)";
});

$("heartbeat").addEventListener("click", () => sendToBackground({ type: "heartbeat", payload: {} }));

$("track").addEventListener("click", () => {
  activeTabToken((token) => {
    if (!token) return result("No attribution token on this tab — visit a /t/{slug} link first", false);
    sendToBackground({ type: "track", payload: { token, orderId: "TEST-" + Date.now(), amount: 10 } });
  });
});

$("openOptions").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});
