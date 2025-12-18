const messagesDiv = document.getElementById("messages");
const input = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const closeBtn = document.getElementById("closeBtn");
const themeBtn = document.getElementById("themeBtn");
const toast = document.getElementById("toast");

const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");

const greetings = [
  "Sup 🔥 I’m floating and focused. What’s the move?",
  "⚡ Offline-ready assistant online. What should we tackle?",
  "👋 Hey! Drop a task — I’ll help you ship it.",
  "🧠 Ready. Ask anything — quick and practical."
];

let chatHistory = [
  {
    role: "system",
    content:
      "You are a helpful, concise desktop assistant. Be friendly, practical, and quick. If user asks for code, provide copy-paste-ready code."
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

function addBubble(who, text, cls) {
  const div = document.createElement("div");
  div.className = `msg ${cls}`;
  div.innerHTML = `<div class="meta">${who}</div>${escapeHtml(text)}`;
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  return div;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
    .replaceAll("\n", "<br/>");
}

function greet() {
  const g = greetings[Math.floor(Math.random() * greetings.length)];
  addBubble("AI", g, "ai");
}

async function refreshHealth() {
  const h = await window.api.health();
  if (h.ok) {
    statusDot.className = "dot ok";
    statusText.textContent = `Offline • ${h.model}${h.hasModel ? "" : " (not found in Ollama)"}`;
  } else {
    statusDot.className = "dot bad";
    statusText.textContent = `Ollama offline • ${h.model}`;
  }
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

function autoGrowTextarea() {
  input.style.height = "0px";
  input.style.height = Math.min(input.scrollHeight, 120) + "px";
}

async function sendMessage(text) {
  if (!text.trim()) return;

  if (busy) {
    queue.push(text);
    showToast(`Queued (${queue.length}) — I’m still replying…`);
    return;
  }

  busy = true;
  addBubble("You", text, "you");
  chatHistory.push({ role: "user", content: text });

  const typing = addBubble("AI", "…", "ai");

  try {
    const reply = await window.api.ask(chatHistory);
    typing.innerHTML = `<div class="meta">AI</div>${escapeHtml(reply)}`;
    chatHistory.push({ role: "assistant", content: reply });
  } catch (err) {
    typing.innerHTML = `<div class="meta">AI</div>${escapeHtml("Error: " + (err.message || err))}`;
    showToast("AI error — check Ollama/model.");
  } finally {
    busy = false;

    if (queue.length > 0) {
      const next = queue.shift();
      // slight delay so UI feels smooth
      setTimeout(() => sendMessage(next), 120);
    }

    input.focus();
  }
}

closeBtn.addEventListener("click", async () => {
  await window.api.hide();
});

themeBtn.addEventListener("click", toggleTheme);

sendBtn.addEventListener("click", () => {
  const text = input.value;
  input.value = "";
  autoGrowTextarea();
  sendMessage(text);
});

input.addEventListener("input", autoGrowTextarea);

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    const text = input.value;
    input.value = "";
    autoGrowTextarea();
    sendMessage(text);
  }
});

// Boot
setTheme(localStorage.getItem("theme") || "dark");
greet();
refreshHealth();
setInterval(refreshHealth, 8000);
autoGrowTextarea();
input.focus();
