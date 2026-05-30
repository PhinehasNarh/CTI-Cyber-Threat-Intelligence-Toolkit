// CTI Platform Lookup, MV3 background service worker (#28).

const MENU_ID = "cti-lookup";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: 'Look up "%s" in CTI Platform',
    contexts: ["selection"],
  });
});

async function getConfig() {
  const { baseUrl, apiKey } = await chrome.storage.sync.get(["baseUrl", "apiKey"]);
  return { baseUrl: baseUrl || "http://localhost:8000", apiKey: apiKey || "" };
}

// Shared lookup used by the context menu and the popup.
async function lookup(value) {
  const { baseUrl, apiKey } = await getConfig();
  if (!apiKey) {
    return { ok: false, message: "No API key set. Open the extension options to configure it." };
  }
  try {
    const res = await fetch(`${baseUrl}/api/v1/iocs/${encodeURIComponent(value.trim())}`, {
      headers: { "X-API-Key": apiKey },
    });
    if (res.status === 404) return { ok: true, known: false, value };
    if (!res.ok) return { ok: false, message: `API error ${res.status}` };
    const data = await res.json();
    return { ok: true, known: true, data };
  } catch (e) {
    return { ok: false, message: `Request failed: ${e.message}` };
  }
}

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID || !info.selectionText) return;
  const r = await lookup(info.selectionText);
  let msg;
  if (!r.ok) msg = r.message;
  else if (!r.known) msg = `"${r.value}" is not a known IOC.`;
  else msg = `${r.data.type.toUpperCase()} ${r.data.value}\nScore ${r.data.threat_score} · ${r.data.malware_family || r.data.threat_type || "n/a"}`;

  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon.png",
    title: "CTI Platform",
    message: msg,
  });
});

// Allow the popup to request lookups.
chrome.runtime.onMessage.addListener((req, _sender, sendResponse) => {
  if (req.type === "lookup") {
    lookup(req.value).then(sendResponse);
    return true; // async response
  }
});
