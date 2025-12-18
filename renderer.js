const appEl = document.getElementById("app");
const messagesDiv = document.getElementById("messages");
const input = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const toast = document.getElementById("toast");
const statusText = document.getElementById("statusText");

const closeBtn = document.getElementById("closeBtn");
const minBtn = document.getElementById("minBtn");
const maxBtn = document.getElementById("maxBtn");

const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");
const settingsCloseBtn = document.getElementById("settingsCloseBtn");
const providerSelect = document.getElementById("providerSelect");
const apiKeyInput = document.getElementById("apiKeyInput");
const saveKeyBtn = document.getElementById("saveKeyBtn");
const keyStatus = document.getElementById("keyStatus");

const themeBtn = document.getElementById("themeBtn");
const themeIconMoon = document.getElementById("themeIconMoon");
const themeIconSun = document.getElementById("themeIconSun");

const uploadBtn = document.getElementById("uploadBtn");
const fileInput = document.getElementById("fileInput");

let chatHistory = [
  {
    role: "system",
    content: "You are a helpful desktop assistant. Be friendly, modern, and practical. Keep answers tight."
  }
];

let busy = false;
let queue = [];

/* ---------- UI helpers ---------- */
function showToast(msg, ms = 1400) {
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), ms);
}

function applyThemeIcon(theme) {
  const isDark = theme === "dark";
  themeIconMoon.style.display = isDark ? "block" : "none";
  themeIconSun.style.display = isDark ? "none" : "block";
}

function setTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  applyThemeIcon(theme);
}

function toggleTheme() {
  const current = document.body.getAttribute("data-theme") || "dark";
  setTheme(current === "dark" ? "light" : "dark");
}

function autoGrow() {
  input.style.height = "0px";
  input.style.height = Math.min(input.scrollHeight, 180) + "px";
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderMessage(text) {
  const t = String(text || "");
  if (!t.includes("```")) return `<div>${escapeHtml(t).replaceAll("\n", "<br/>")}</div>`;
  const parts = t.split("```");
  let html = "";
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) html += `<div>${escapeHtml(parts[i]).replaceAll("\n", "<br/>")}</div>`;
    else html += `<pre><code>${escapeHtml(parts[i])}</code></pre>`;
  }
  return html;
}

function addBubble(text, cls) {
  const div = document.createElement("div");
  div.className = `msg ${cls}`;
  div.innerHTML = renderMessage(text);
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  return div;
}

function greet() {
  addBubble("Hey, how are you doing?", "ai");
}

/* ---------- Settings panel ---------- */
function openSettings() {
  settingsPanel.classList.add("open");
  settingsPanel.setAttribute("aria-hidden", "false");
}
function closeSettings() {
  settingsPanel.classList.remove("open");
  settingsPanel.setAttribute("aria-hidden", "true");
}

settingsBtn.addEventListener("click", () => {
  if (settingsPanel.classList.contains("open")) closeSettings();
  else openSettings();
});
settingsCloseBtn.addEventListener("click", closeSettings);

document.addEventListener("mousedown", (e) => {
  if (!settingsPanel.classList.contains("open")) return;
  const inside = settingsPanel.contains(e.target) || settingsBtn.contains(e.target);
  if (!inside) closeSettings();
});

async function loadSettingsUI() {
  const s = await window.api.settingsGet();
  providerSelect.value = s.provider || "ollama";
  keyStatus.textContent = s.openaiKeySet ? "Key: set" : "Key: not set";
}

providerSelect.addEventListener("change", async () => {
  const p = providerSelect.value;
  await window.api.settingsSetProvider(p);
  showToast("Provider updated");
  await refreshHealth();
});

saveKeyBtn.addEventListener("click", async () => {
  const k = apiKeyInput.value.trim();
  if (!k) {
    showToast("Paste your key first");
    return;
  }
  const r = await window.api.settingsSetOpenAIKey(k);
  if (!r.ok) {
    showToast(r.error || "Could not save key");
    return;
  }
  apiKeyInput.value = "";
  showToast("Key saved");
  await loadSettingsUI();
  await refreshHealth();
});

/* ---------- Health / status ---------- */
async function refreshHealth() {
  const h = await window.api.health();

  if (h.provider === "openai") {
    statusText.textContent = h.ok
      ? `Provider: OpenAI • Model: ${h.model}`
      : `Provider: OpenAI • Key missing`;
    return;
  }

  if (h.ok) {
    statusText.textContent = h.hasModel
      ? `Provider: Local (Ollama) • Connected • ${h.model}`
      : `Provider: Local (Ollama) • Connected • Model not found`;
  } else {
    statusText.textContent = `Provider: Local (Ollama) • Not reachable`;
  }
}

/* ---------- Chat send ---------- */
async function sendMessage(text) {
  const msg = text.trim();
  if (!msg) return;

  if (busy) {
    queue.push(msg);
    showToast(`Queued (${queue.length})`);
    return;
  }

  busy = true;
  addBubble(msg, "you");
  chatHistory.push({ role: "user", content: msg });

  const typing = addBubble("...", "ai");

  try {
    const reply = await window.api.ask(chatHistory);
    typing.innerHTML = renderMessage(reply);
    chatHistory.push({ role: "assistant", content: reply });
  } catch (e) {
    typing.innerHTML = renderMessage("Error: " + (e.message || e));
    showToast("AI error");
  } finally {
    busy = false;
    if (queue.length) setTimeout(() => sendMessage(queue.shift()), 120);
    input.focus();
  }
}

/* ---------- Window controls ---------- */
closeBtn.addEventListener("click", async () => window.api.hide());
minBtn.addEventListener("click", async () => window.api.minimize());
maxBtn.addEventListener("click", async () => window.api.toggleMaximize());
themeBtn.addEventListener("click", toggleTheme);

async function syncMaxState() {
  const isMax = await window.api.isMaximized();
  appEl.classList.toggle("maxed", !!isMax);
}
window.api.onState(({ maximized }) => {
  appEl.classList.toggle("maxed", !!maximized);
});

/* ---------- Composer ---------- */
sendBtn.addEventListener("click", () => {
  const t = input.value;
  input.value = "";
  autoGrow();
  sendMessage(t);
});

input.addEventListener("input", autoGrow);

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    const t = input.value;
    input.value = "";
    autoGrow();
    sendMessage(t);
  }
});

/* ---------- Upload ---------- */
uploadBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async () => {
  const files = Array.from(fileInput.files || []);
  if (!files.length) return;

  for (const f of files) {
    const text = await readFileAsText(f);
    const clipped = clip(text, 18000);

    addBubble(`Loaded file: ${f.name}`, "ai");

    chatHistory.push({
      role: "system",
      content:
        `User uploaded file "${f.name}". Content (may be truncated):\n` +
        `---BEGIN FILE---\n${clipped}\n---END FILE---`
    });
  }

  fileInput.value = "";
});

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("Failed to read file."));
    r.onload = () => resolve(String(r.result || ""));
    r.readAsText(file);
  });
}
function clip(s, max) {
  const str = String(s || "");
  return str.length > max ? str.slice(0, max) + "\n\n[TRUNCATED]" : str;
}

/* ---------- Entrance animation ---------- */
function playEntrance() {
  appEl.classList.remove("enter");
  void appEl.offsetWidth;
  appEl.classList.add("enter");
}
window.api.onShown(() => playEntrance());

/* ---------- Boot ---------- */
setTheme(localStorage.getItem("theme") || "dark");
greet();
loadSettingsUI();
refreshHealth();
setInterval(refreshHealth, 8000);
autoGrow();
input.focus();
playEntrance();
syncMaxState();
