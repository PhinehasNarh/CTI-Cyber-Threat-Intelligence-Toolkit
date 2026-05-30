const valueEl = document.getElementById("value");
const resultEl = document.getElementById("result");

document.getElementById("go").addEventListener("click", run);
valueEl.addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
document.getElementById("opts").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

async function run() {
  const value = valueEl.value.trim();
  if (!value) return;
  resultEl.textContent = "Looking up…";
  const r = await chrome.runtime.sendMessage({ type: "lookup", value });
  if (!r.ok) {
    resultEl.textContent = r.message;
  } else if (!r.known) {
    resultEl.textContent = `"${value}" is not a known IOC.`;
  } else {
    const d = r.data;
    resultEl.textContent =
      `${d.type.toUpperCase()}  ${d.value}\n` +
      `Score: ${d.threat_score}\n` +
      `Family: ${d.malware_family || "n/a"}\n` +
      `Source: ${d.source}`;
  }
}
