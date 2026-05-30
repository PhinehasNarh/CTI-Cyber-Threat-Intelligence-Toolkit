const baseUrlEl = document.getElementById("baseUrl");
const apiKeyEl = document.getElementById("apiKey");
const savedEl = document.getElementById("saved");

chrome.storage.sync.get(["baseUrl", "apiKey"]).then(({ baseUrl, apiKey }) => {
  baseUrlEl.value = baseUrl || "http://localhost:8000";
  apiKeyEl.value = apiKey || "";
});

document.getElementById("save").addEventListener("click", async () => {
  await chrome.storage.sync.set({
    baseUrl: baseUrlEl.value.trim().replace(/\/$/, ""),
    apiKey: apiKeyEl.value.trim(),
  });
  savedEl.textContent = "Saved";
  setTimeout(() => (savedEl.textContent = ""), 1500);
});
