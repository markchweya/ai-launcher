const messagesDiv = document.getElementById("messages");
const input = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const closeBtn = document.getElementById("closeBtn");
const themeBtn = document.getElementById("themeBtn");
const toast = document.getElementById("toast");
const statusText = document.getElementById("statusText");
const hint = document.getElementById("hint");

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
      "You are a helpful desktop assistant. Be friendly, modern, and practical. Keep answers tight. If the user uploads files, use them as reference."
  }
];

let busy = false;
let queue = [];

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
  input.style.height = Math.min(input.scrollHeight, 140) + "px";
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// super-light “markdown-ish” renderer: code fences only
function renderMessage(text) {
  const t = String(text || "");
  if (!t.includes("```")) return `<div>${escapeHtml(t).replaceAll("\n", "<br/>")}</div>`;

  // split by fences
  const parts = t.split("```");
  let html = "";
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      html += `<div>${escapeHtml(parts[i]).replaceAll("\n", "<br/>")}</div>`;
    } else {
      const codeBlock = parts[i];
      // allow optional language on first line
      const lines = codeBlock.split("\n");
      const maybeLang = lines[0].trim();
      const code = lines.slice(1).join("\n");
      const hasLang = maybeLang.length < 18 && !maybeLang.includes(" ") && code.length > 0;
      const finalCode = hasLang ? code : codeBlock;
      html += `<pre><code>${escapeHtml(finalCode)}</code></pre>`;
    }
  }
  return html;
}

function addBubble(who, text, cls) {
  const div = document.createElement("div");
  div.className = `msg ${cls}`;
  div.innerHTML = `<div class="meta">${who}</div>${renderMessage(text)}`;
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  return div;
}

function greet() {
  addBubble("AI", greetings[Math.floor(Math.random() * greetings.length)], "ai");
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

  addBubble("You", msg, "you");
  chatHistory.push({ role: "user", content: msg });

  const typing = addBubble("AI", "…", "ai");

  try {
    const reply = await window.api.ask(chatHistory);
    typing.innerHTML = `<div class="meta">AI</div>${renderMessage(reply)}`;
    chatHistory.push({ role: "assistant", content: reply });
  } catch (e) {
    typing.innerHTML = `<div class="meta">AI</div>${renderMessage("Error: " + (e.message || e))}`;
    showToast("AI error (check Ollama)");
  } finally {
    busy = false;
    if (queue.length) setTimeout(() => sendMessage(queue.shift()), 120);
    input.focus();
  }
}

/* File upload (simple: inject into context) */
uploadBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async () => {
  const files = Array.from(fileInput.files || []);
  if (!files.length) return;

  for (const f of files) {
    const text = await readFileAsText(f);
    const clipped = clip(text, 18000); // keep it safe for local model context

    showToast(`Loaded: ${f.name}`);
    addBubble("System", `Loaded file: ${f.name}`, "ai");

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

/* UI wiring */
closeBtn.addEventListener("click", async () => window.api.hide());
themeBtn.addEventListener("click", toggleTheme);

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

/* boot */
setTheme(localStorage.getItem("theme") || "dark");
hint.textContent = "Shortcut: tries A+I first, otherwise Alt+I";
greet();
refreshHealth();
setInterval(refreshHealth, 7000);
autoGrow();
input.focus();
