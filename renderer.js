const appEl = document.getElementById("app");
const messagesDiv = document.getElementById("messages");
const input = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const toast = document.getElementById("toast");
const statusText = document.getElementById("statusText");

const themeBtn = document.getElementById("themeBtn");
const closeBtn = document.getElementById("closeBtn");
const minBtn = document.getElementById("minBtn");
const maxBtn = document.getElementById("maxBtn");

const uploadBtn = document.getElementById("uploadBtn");
const fileInput = document.getElementById("fileInput");

const greetings = [
  "👋 Hey. Drop a task — I’ll help you ship it.",
  "⚡ Local AI is ready. What are we building today?",
  "🔥 What’s the move? Code, writing, planning — I’m on it.",
  "🧠 I’m awake. Give me a mission."
];

let chatHistory = [
  {
    role: "system",
    content:
      "You are a helpful desktop assistant. Be friendly, modern, and practical. Keep answers tight. Use uploaded files as reference when relevant."
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

function setTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  themeBtn.textContent = theme === "dark" ? "☾" : "☀";
}

function toggleTheme() {
  const current = document.body.getAttribute("data-theme") || "dark";
  setTheme(current === "dark" ? "light" : "dark");
}

function autoGrow() {
  input.style.height = "0px";
  input.style.height = Math.min(input.scrollHeight, 160) + "px";
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
  addBubble(greetings[Math.floor(Math.random() * greetings.length)], "ai");
}

async function refreshHealth() {
  const h = await window.api.health();
  if (h.ok) {
    statusText.textContent = h.hasModel
      ? `Local model • Connected • ${h.model}`
      : `Local model • Connected • ${h.model} (not found)`;
  } else {
    statusText.textContent = `Local model • Not reachable • ${h.model}`;
  }
}

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

  const typing = addBubble("…", "ai");

  try {
    const reply = await window.api.ask(chatHistory);
    typing.innerHTML = renderMessage(reply);
    chatHistory.push({ role: "assistant", content: reply });
  } catch (e) {
    typing.innerHTML = renderMessage("Error: " + (e.message || e));
    showToast("AI error (check Ollama)");
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

/* ---------- Upload files (simple inject) ---------- */
uploadBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async () => {
  const files = Array.from(fileInput.files || []);
  if (!files.length) return;

  for (const f of files) {
    const text = await readFileAsText(f);
    const clipped = clip(text, 18000);
    showToast(`Loaded: ${f.name}`);

    chatHistory.push({
      role: "system",
      content:
        `User uploaded file "${f.name}". Content (may be truncated):\n` +
        `---BEGIN FILE---\n${clipped}\n---END FILE---`
    });

    addBubble(`✅ Loaded file: ${f.name}`, "ai");
  }

  fileInput.value = "";
});

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsText(file);
  });
}

function clip(s, max) {
  const str = String(s || "");
  return str.length > max ? str.slice(0, max) + "\n\n[TRUNCATED]" : str;
}

/* ---------- Alt-drag anywhere to move ---------- */
let moveMode = null;

window.addEventListener("mousedown", async (e) => {
  // hold ALT and drag anywhere (except textarea / buttons)
  const t = e.target;
  const isInteractive =
    t.closest("textarea") || t.closest("button") || t.closest("input") || t.closest("a");

  if (!e.altKey || isInteractive) return;

  const b = await window.api.getBounds();
  if (!b) return;

  moveMode = {
    startX: e.screenX,
    startY: e.screenY,
    startBounds: b
  };
});

window.addEventListener("mousemove", async (e) => {
  if (!moveMode) return;
  const dx = e.screenX - moveMode.startX;
  const dy = e.screenY - moveMode.startY;

  await window.api.setBounds({
    x: moveMode.startBounds.x + dx,
    y: moveMode.startBounds.y + dy,
    width: moveMode.startBounds.width,
    height: moveMode.startBounds.height
  });
});

window.addEventListener("mouseup", () => {
  moveMode = null;
});

/* ---------- Custom resize handles ---------- */
let resizeMode = null;

function startResize(dir, e) {
  e.preventDefault();
  e.stopPropagation();
  window.api.getBounds().then((b) => {
    if (!b) return;
    resizeMode = {
      dir,
      startX: e.screenX,
      startY: e.screenY,
      startBounds: b
    };
  });
}

function doResize(e) {
  if (!resizeMode) return;
  const { dir, startX, startY, startBounds } = resizeMode;
  const dx = e.screenX - startX;
  const dy = e.screenY - startY;

  let { x, y, width, height } = startBounds;

  const minW = 360;
  const minH = 420;

  if (dir.includes("e")) width = Math.max(minW, width + dx);
  if (dir.includes("s")) height = Math.max(minH, height + dy);

  if (dir.includes("w")) {
    const newW = Math.max(minW, width - dx);
    x = x + (width - newW);
    width = newW;
  }

  if (dir.includes("n")) {
    const newH = Math.max(minH, height - dy);
    y = y + (height - newH);
    height = newH;
  }

  window.api.setBounds({ x, y, width, height });
}

function endResize() { resizeMode = null; }

document.querySelector(".r-n").addEventListener("mousedown", (e) => startResize("n", e));
document.querySelector(".r-s").addEventListener("mousedown", (e) => star
