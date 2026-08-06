const appEl = document.getElementById("app");
const messagesDiv = document.getElementById("messages");
const input = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const toast = document.getElementById("toast");
const statusText = document.getElementById("statusText");

const closeBtn = document.getElementById("closeBtn");
const minBtn = document.getElementById("minBtn");
const maxBtn = document.getElementById("maxBtn");

const historyBtn = document.getElementById("historyBtn");
const historyPanel = document.getElementById("historyPanel");
const historyCloseBtn = document.getElementById("historyCloseBtn");
const historyList = document.getElementById("historyList");
const newChatBtn = document.getElementById("newChatBtn");

const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");
const settingsCloseBtn = document.getElementById("settingsCloseBtn");
const providerSelect = document.getElementById("providerSelect");
const speedModeSelect = document.getElementById("speedModeSelect");
const displayNameInput = document.getElementById("displayNameInput");
const apiKeyInput = document.getElementById("apiKeyInput");
const saveKeyBtn = document.getElementById("saveKeyBtn");
const keyStatus = document.getElementById("keyStatus");
const settingsHint = document.getElementById("settingsHint");
const appearModeSelect = document.getElementById("appearModeSelect");
const shortcutInput = document.getElementById("shortcutInput");
const shortcutResetBtn = document.getElementById("shortcutResetBtn");
const breatheVisibleInput = document.getElementById("breatheVisibleInput");
const breatheHiddenInput = document.getElementById("breatheHiddenInput");
const appearHint = document.getElementById("appearHint");
const libraryUploadBtn = document.getElementById("libraryUploadBtn");
const libraryDropZone = document.getElementById("libraryDropZone");
const libraryList = document.getElementById("libraryList");

const themeBtn = document.getElementById("themeBtn");
const themeIconMoon = document.getElementById("themeIconMoon");
const themeIconSun = document.getElementById("themeIconSun");

const uploadBtn = document.getElementById("uploadBtn");
const fileMemory = document.getElementById("fileMemory");

document.body.dataset.platform = window.api?.platform || "unknown";

// Tell the main process the user is actually using the window, so Breathe stops
// fading it out mid-sentence.
let lastEngageAt = 0;
function reportEngagement() {
  if (!window.api?.engage) return;

  const now = Date.now();
  if (now - lastEngageAt < 1000) return;

  lastEngageAt = now;
  window.api.engage();
}

document.addEventListener("mousedown", reportEngagement, true);
document.addEventListener("keydown", reportEngagement, true);
document.addEventListener("wheel", reportEngagement, { capture: true, passive: true });

const DEFAULT_SYSTEM_PROMPT = "You are a helpful desktop assistant. Be friendly, practical, and concise.";
const SPEED_PROFILES = {
  fast: {
    contextChars: 3800,
    messageChars: 700,
    keepLastMessages: 6,
    excerptChars: 850,
    uploadedMatchLimit: 2,
    libraryMatchLimit: 3
  },
  balanced: {
    contextChars: 7200,
    messageChars: 1200,
    keepLastMessages: 10,
    excerptChars: 1500,
    uploadedMatchLimit: 4,
    libraryMatchLimit: 6
  },
  deep: {
    contextChars: 9800,
    messageChars: 1600,
    keepLastMessages: 12,
    excerptChars: 1900,
    uploadedMatchLimit: 6,
    libraryMatchLimit: 8
  }
};

const PROVIDER_LABELS = {
  "local-auto": "Local (Auto)",
  ollama: "Local (Ollama)",
  foundry: "Local (Foundry Local)",
  "auto-api": "API Key (Auto Detect)",
  openai: "OpenAI",
  anthropic: "Claude (Anthropic)",
  xai: "Grok (xAI)",
  deepseek: "DeepSeek"
};

let chatHistory = createInitialChatHistory();
let busy = false;
let queue = [];
let uploadedFiles = [];
let lastAssistantReply = "";
let currentConversationId = "";
let currentConversationCreatedAt = "";
let historySummaries = [];
let historyScrollTop = 0;
let libraryDocs = [];
let currentHealth = null;
let persistTimer = null;
let libraryDragDepth = 0;
let currentLocalSpeedMode = "fast";
let displayName = "";
let storedShortcut = "";
let defaultShortcut = "";
let capturingShortcut = false;
const isMacPlatform = (window.api?.platform || "") === "darwin";
const librarySearchCache = new Map();

function createInitialChatHistory() {
  return [
    {
      role: "system",
      content: DEFAULT_SYSTEM_PROMPT
    }
  ];
}

function showToast(message, ms = 1500) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove("show"), ms);
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
  document.body.classList.add("theme-changing");
  setTheme(current === "dark" ? "light" : "dark");
  clearTimeout(toggleTheme._timer);
  toggleTheme._timer = setTimeout(() => {
    document.body.classList.remove("theme-changing");
  }, 260);
}

function autoGrow() {
  input.style.height = "0px";
  input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function styleEmoji(html) {
  return String(html || "").replace(
    /(\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)*|\p{Emoji_Presentation})/gu,
    '<span class="emoji">$1</span>'
  );
}

function renderInline(text) {
  let html = escapeHtml(text);
  const codeTokens = [];

  html = html.replace(/`([^`]+)`/g, (_, code) => {
    const token = `\uE000${codeTokens.length}\uE001`;
    codeTokens.push(`<code class="inlineCode">${code}</code>`);
    return token;
  });

  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label, url) => {
    return `<a href="${url}" target="_blank" rel="noreferrer">${label}</a>`;
  });

  html = html.replace(/\*\*([^*][\s\S]*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([^_][\s\S]*?)__/g, '<span class="underline">$1</span>');
  html = html.replace(/\*([^*\n][\s\S]*?)\*/g, "<em>$1</em>");
  html = html.replace(/_([^_\n][\s\S]*?)_/g, "<em>$1</em>");
  html = html.replace(/~~([^~][\s\S]*?)~~/g, "<del>$1</del>");

  for (let index = 0; index < codeTokens.length; index += 1) {
    html = html.replace(`\uE000${index}\uE001`, codeTokens[index]);
  }

  return styleEmoji(html);
}

function renderTextBlock(block) {
  const lines = String(block || "").replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let listType = "";

  function closeList() {
    if (!listType) return;
    html.push(listType === "ol" ? "</ol>" : "</ul>");
    listType = "";
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      closeList();
      continue;
    }

    const ordered = line.match(/^\d+\.\s+(.*)$/);
    if (ordered) {
      if (listType !== "ol") {
        closeList();
        html.push("<ol>");
        listType = "ol";
      }
      html.push(`<li>${renderInline(ordered[1])}</li>`);
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      if (listType !== "ul") {
        closeList();
        html.push("<ul>");
        listType = "ul";
      }
      html.push(`<li>${renderInline(bullet[1])}</li>`);
      continue;
    }

    closeList();

    if (line.startsWith("### ")) {
      html.push(`<h3>${renderInline(line.slice(4))}</h3>`);
      continue;
    }

    if (line.startsWith("## ")) {
      html.push(`<h2>${renderInline(line.slice(3))}</h2>`);
      continue;
    }

    if (line.startsWith("# ")) {
      html.push(`<h1>${renderInline(line.slice(2))}</h1>`);
      continue;
    }

    if (line.startsWith("> ")) {
      html.push(`<blockquote>${renderInline(line.slice(2))}</blockquote>`);
      continue;
    }

    html.push(`<p>${renderInline(line)}</p>`);
  }

  closeList();
  return html.join("");
}

function renderCodeBlock(block) {
  const trimmed = String(block || "").replace(/^\n+|\n+$/g, "");
  const lines = trimmed.split("\n");
  const first = lines[0]?.trim() || "";
  const hasLanguage = /^[a-z0-9_+#.-]{1,24}$/i.test(first);
  const language = hasLanguage ? first : "";
  const code = hasLanguage ? lines.slice(1).join("\n") : trimmed;

  return `
    <pre class="codeBlock">
      ${language ? `<div class="codeLabel">${escapeHtml(language)}</div>` : ""}
      <code>${escapeHtml(code)}</code>
    </pre>
  `;
}

function renderMessage(text) {
  const source = String(text || "").replace(/\r\n/g, "\n");
  const segments = source.split(/```/);

  if (segments.length === 1) {
    return renderTextBlock(source);
  }

  let html = "";
  for (let index = 0; index < segments.length; index += 1) {
    html += index % 2 === 0 ? renderTextBlock(segments[index]) : renderCodeBlock(segments[index]);
  }

  return html;
}

function isNearBottom(element, threshold = 140) {
  return element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
}

function editIconSvg() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20h9"></path>
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
    </svg>
  `;
}

function addBubble(text, kind, options = {}) {
  const stick = isNearBottom(messagesDiv);
  const div = document.createElement("div");
  const isError = /\*\*(Could not answer|Could not add|Could not load|Library upload failed|Upload failed|Library drop failed)\*\*/i.test(String(text || ""));
  div.className = `msg ${kind}${isError ? " errorMsg" : ""}`;

  if (Number.isInteger(options.historyIndex)) {
    div.dataset.historyIndex = String(options.historyIndex);
  }

  const canEdit = kind === "you" && Number.isInteger(options.historyIndex);
  div.innerHTML = `
    <div class="msgBody">${renderMessage(text)}</div>
    ${canEdit ? `
      <div class="msgActions">
        <button class="msgActionBtn" type="button" data-edit-message="${options.historyIndex}" title="Edit message" aria-label="Edit message">
          ${editIconSvg()}
        </button>
      </div>
    ` : ""}
  `;
  messagesDiv.appendChild(div);

  if (stick) {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  return div;
}

function removeEmptyState() {
  const empty = messagesDiv.querySelector(".emptyState");
  if (!empty) return;
  empty.classList.add("leaving");
  setTimeout(() => empty.remove(), 220);
}

function removeEmptyStateNow() {
  messagesDiv.querySelector(".emptyState")?.remove();
}

function userMessageFromError(error) {
  let message = String(error?.message || error || "Something went wrong.").trim();

  message = message
    .replace(/^Error invoking remote method '[^']+':\s*/i, "")
    .replace(/^Error:\s*/i, "")
    .trim();

  message = extractProviderErrorMessage(message);

  if (/api key is invalid|invalid api key|incorrect api key|unauthorized|forbidden|401|403/i.test(message)) {
    return "API key is invalid.";
  }

  if (/api key not set|api key is missing|empty key/i.test(message)) {
    return "API key is missing.";
  }

  if (/insufficient[_\s-]*(quota|funds|balance)|exceeded your current quota|billing details|check your plan|balance/i.test(message)) {
    return "Your API key does not have enough funds or quota. Please add credit or check your billing plan.";
  }

  if (/rate[_\s-]*limit|too many requests|429/i.test(message)) {
    return "The AI provider is receiving too many requests right now. Please wait a moment and try again.";
  }

  if (/model.*(not found|does not exist|invalid)|invalid.*model/i.test(message)) {
    return "The selected AI model is not available. Choose another model in settings and try again.";
  }

  if (/fetch failed|network|ENOTFOUND|ETIMEDOUT|ECONNRESET|ECONNREFUSED/i.test(message) && !/ollama|foundry/i.test(message)) {
    return "Could not reach the AI provider. Please check your internet connection and try again.";
  }

  if (/service unavailable|server error|bad gateway|gateway timeout|HTTP 5\d\d|500|502|503|504/i.test(message)) {
    return "The AI provider is having trouble right now. Please try again in a few minutes.";
  }

  if (/ollama/i.test(message) && /fetch failed|ECONNREFUSED|not running|connect/i.test(message)) {
    return "Ollama is not running.";
  }

  if (/no ollama models found/i.test(message)) {
    return "No Ollama models found.";
  }

  if (/foundry local.*not installed|foundry local cli was not found|foundry.*not found/i.test(message)) {
    return "Foundry Local is not installed.";
  }

  if (/foundry local.*not running|foundry.*not running/i.test(message)) {
    return "Foundry Local is not running.";
  }

  if (/no foundry local models found/i.test(message)) {
    return "No Foundry Local models found.";
  }

  if (/no local provider|no local ai provider/i.test(message)) {
    return "No local AI provider is available. Start Ollama or Foundry Local.";
  }

  return message || "Something went wrong.";
}

function extractProviderErrorMessage(message) {
  const text = String(message || "").trim();
  const jsonStart = text.indexOf("{");
  if (jsonStart === -1) return text;

  try {
    const parsed = JSON.parse(text.slice(jsonStart));
    const providerMessage = parsed?.error?.message || parsed?.message || parsed?.detail || "";
    const providerCode = parsed?.error?.code || parsed?.code || "";
    const providerType = parsed?.error?.type || parsed?.type || "";
    const parts = [providerMessage, providerCode, providerType].filter(Boolean);
    if (parts.length) return parts.join(" ");
  } catch {
    // Keep the original message when a provider returns plain text.
  }

  return text;
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function providerLabel(provider) {
  return PROVIDER_LABELS[provider] || provider || "Unknown";
}

function speedModeLabel(mode) {
  if (mode === "deep") return "Deep";
  if (mode === "balanced") return "Balanced";
  return "Fast";
}

function formatDateLabel(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

function clipText(text, max) {
  const value = String(text || "");
  return value.length > max ? `${value.slice(0, max)}... [clipped]` : value;
}

function getSpeedProfile() {
  return SPEED_PROFILES[currentLocalSpeedMode] || SPEED_PROFILES.fast;
}

function clearLibrarySearchCache() {
  librarySearchCache.clear();
}

function tokenizeSearchText(text) {
  return [...new Set(
    String(text || "")
      .toLowerCase()
      .match(/[a-z0-9_./-]{2,}/g) || []
  )];
}

function scoreTextAgainstTokens(text, tokens) {
  if (!tokens.length) return 0;

  const haystack = String(text || "").toLowerCase();
  let score = 0;

  for (const token of tokens) {
    if (!haystack.includes(token)) continue;
    score += 2;
    if (haystack.startsWith(token)) score += 1;
  }

  return score;
}

function scoreFileAgainstQuery(file, queryTokens, rawQuery) {
  if (!queryTokens.length && !rawQuery.trim()) return 1;

  const haystack = `${file.name} ${file.path}`.toLowerCase();
  let score = 0;

  for (const token of queryTokens) {
    if (file.name.toLowerCase().includes(token)) score += 8;
    if (file.path.toLowerCase().includes(token)) score += 5;
    if (haystack.includes(token)) score += 1;
  }

  if (rawQuery && haystack.includes(rawQuery.toLowerCase())) score += 6;
  return score;
}

function scoreChunkAgainstQuery(file, chunk, queryTokens, rawQuery) {
  const chunkText = String(chunk || "");
  const haystack = `${file.name} ${file.path} ${chunkText}`.toLowerCase();
  let score = scoreFileAgainstQuery(file, queryTokens, rawQuery);

  for (const token of queryTokens) {
    if (haystack.includes(token)) score += 4;
  }

  if (rawQuery && haystack.includes(rawQuery.toLowerCase())) score += 8;
  return score;
}

function renderFileMemory() {
  if (!uploadedFiles.length) {
    fileMemory.hidden = true;
    fileMemory.innerHTML = "";
    return;
  }

  fileMemory.hidden = false;
  fileMemory.innerHTML = uploadedFiles.map((file, index) => `
    <div class="fileChip">
      <div class="fileChipMeta">
        <div class="fileChipName">${escapeHtml(file.name)}</div>
        <div class="fileChipInfo">${escapeHtml(formatBytes(file.size))} - ${escapeHtml(String(file.mediaKind || "text"))}${file.truncated ? " - clipped for preview" : ""}</div>
      </div>
      <button class="fileChipRemove" type="button" data-file-index="${index}" aria-label="Remove ${escapeHtml(file.name)}">x</button>
    </div>
  `).join("");
}

function findRelevantUploadedChunks(queryText) {
  if (!uploadedFiles.length) return [];

  const profile = getSpeedProfile();
  const query = String(queryText || "").trim();
  const queryTokens = tokenizeSearchText(query);
  const matches = [];

  for (const file of uploadedFiles) {
    const chunks = Array.isArray(file.chunks) && file.chunks.length ? file.chunks : [file.content];

    chunks.forEach((chunk, index) => {
      const score = scoreChunkAgainstQuery(file, chunk, queryTokens, query);
      if (!score && query) return;

      matches.push({
        source: "chat",
        name: file.name,
        path: file.path,
        chunkIndex: index,
        score,
        excerpt: clipText(chunk, profile.excerptChars)
      });
    });
  }

  return matches
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.chunkIndex - b.chunkIndex;
    })
    .slice(0, profile.uploadedMatchLimit);
}

function deriveConversationTitle(messages, files) {
  const firstUser = (messages || []).find((message) => message?.role === "user" && String(message?.content || "").trim());
  if (firstUser) {
    return clipText(firstUser.content.replace(/\s+/g, " ").trim(), 48);
  }

  if (files?.length) {
    return `Files: ${files[0].name}`;
  }

  return "Untitled chat";
}

function buildConversationPayload() {
  return {
    id: currentConversationId,
    title: deriveConversationTitle(chatHistory, uploadedFiles),
    createdAt: currentConversationCreatedAt || new Date().toISOString(),
    messages: chatHistory,
    uploadedFiles,
    lastAssistantReply
  };
}

async function saveCurrentConversation() {
  if (!window.api?.historySave || !currentConversationId) return;

  const nonSystemMessages = chatHistory.filter((message) => message.role !== "system" && String(message.content || "").trim());
  if (!nonSystemMessages.length && !uploadedFiles.length) return;

  await window.api.historySave(buildConversationPayload());
  await loadHistoryList();
}

function scheduleConversationSave() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    saveCurrentConversation().catch(() => {});
  }, 220);
}

async function loadHistoryList() {
  if (!window.api?.historyList) return;
  historyScrollTop = historyList.scrollTop;
  historySummaries = await window.api.historyList();
  renderHistoryList();
  historyList.scrollTop = historyScrollTop;
}

function renderHistoryList() {
  if (!historySummaries.length) {
    historyList.innerHTML = `
      <div class="historyEmpty">
        <div class="historyEmptyTitle">No saved chats yet</div>
        <div class="historyEmptyText">Start a conversation and it will appear here automatically.</div>
      </div>
    `;
    return;
  }

  historyList.innerHTML = historySummaries.map((item) => `
    <div class="historyItem${item.id === currentConversationId ? " active" : ""}" data-history-id="${escapeHtml(item.id)}">
      <div class="historyItemMain">
        <div class="historyItemTitle">${escapeHtml(item.title || "Untitled chat")}</div>
        <div class="historyItemMeta">
          ${escapeHtml(formatDateLabel(item.updatedAt))}
          ${item.fileCount ? ` - ${item.fileCount} file${item.fileCount === 1 ? "" : "s"}` : ""}
        </div>
        <div class="historyItemPreview">${escapeHtml(item.preview || "Open this chat to continue it.")}</div>
      </div>
      <button class="historyDeleteBtn" type="button" data-history-delete="${escapeHtml(item.id)}" aria-label="Delete ${escapeHtml(item.title || "chat")}">x</button>
    </div>
  `).join("");
}

async function loadLibraryList() {
  if (!window.api?.libraryList) return;
  libraryDocs = await window.api.libraryList();
  clearLibrarySearchCache();
  renderLibraryList();
}

async function applyLibraryImportResult(result) {
  if (!result || result.canceled) return;

  if ((result.added || []).length) {
    showToast(`${result.added.length} library file${result.added.length === 1 ? "" : "s"} added`);
  }

  for (const rejected of result.rejected || []) {
    addBubble(`**Could not add ${rejected.name} to the library**\n\n${rejected.error}`, "ai");
  }

  await loadLibraryList();
}

function renderLibraryList() {
  if (!libraryDocs.length) {
    libraryList.innerHTML = `
      <div class="libraryEmpty">
        <div class="historyEmptyTitle">No study files yet</div>
        <div class="historyEmptyText">Add notes, source files, revision guides, or datasets here. The AI will search them by relevance.</div>
      </div>
    `;
    return;
  }

  libraryList.innerHTML = libraryDocs.map((doc) => `
    <div class="libraryItem">
      <div class="libraryItemMeta">
        <div class="libraryItemName">${escapeHtml(doc.name)}</div>
        <div class="libraryItemInfo">${escapeHtml(formatBytes(doc.size))} - ${doc.chunkCount} chunks</div>
      </div>
      <button class="historyDeleteBtn" type="button" data-library-delete="${escapeHtml(doc.id)}" aria-label="Remove ${escapeHtml(doc.name)}">x</button>
    </div>
  `).join("");
}

function openHistory() {
  historyPanel.classList.add("open");
  historyPanel.setAttribute("aria-hidden", "false");
}

function closeHistory() {
  historyPanel.classList.remove("open");
  historyPanel.setAttribute("aria-hidden", "true");
}

function openSettings() {
  settingsPanel.classList.add("open");
  settingsPanel.setAttribute("aria-hidden", "false");
}

function closeSettings() {
  settingsPanel.classList.remove("open");
  settingsPanel.setAttribute("aria-hidden", "true");
}

function greet() {
  const div = document.createElement("div");
  div.className = "emptyState";
  const greeting = displayName ? `How can I help, ${escapeHtml(displayName)}?` : "How can I help?";
  div.innerHTML = `
    <div class="emptyStateTitle">${greeting}</div>
  `;
  messagesDiv.appendChild(div);
}

function refreshEmptyGreeting() {
  const title = messagesDiv.querySelector(".emptyStateTitle");
  if (!title) return;
  title.textContent = displayName ? `How can I help, ${displayName}?` : "How can I help?";
}

function renderChatHistory() {
  messagesDiv.innerHTML = "";

  const visibleMessages = chatHistory
    .map((message, index) => ({ ...message, index }))
    .filter((message) => message.role !== "system" && String(message.content || "").trim());
  if (!visibleMessages.length) {
    greet();
    return;
  }

  for (const message of visibleMessages) {
    addBubble(message.content, message.role === "assistant" ? "ai" : "you", { historyIndex: message.index });
  }
}

async function createNewConversation() {
  const now = new Date().toISOString();
  chatHistory = createInitialChatHistory();
  uploadedFiles = [];
  lastAssistantReply = "";
  busy = false;
  queue = [];
  currentConversationCreatedAt = now;
  currentConversationId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  renderFileMemory();
  renderChatHistory();
  scheduleConversationSave();
  await loadHistoryList();
  closeHistory();
  input.focus();
}

async function openConversation(id) {
  if (!window.api?.historyGet) return;

  const conversation = await window.api.historyGet(id);
  if (!conversation) {
    showToast("That chat could not be found");
    await loadHistoryList();
    return;
  }

  currentConversationId = conversation.id;
  currentConversationCreatedAt = conversation.createdAt || conversation.updatedAt || new Date().toISOString();
  chatHistory = Array.isArray(conversation.messages) && conversation.messages.length
    ? conversation.messages
    : createInitialChatHistory();
  uploadedFiles = Array.isArray(conversation.uploadedFiles) ? conversation.uploadedFiles : [];
  lastAssistantReply = String(conversation.lastAssistantReply || "");
  busy = false;
  queue = [];
  renderFileMemory();
  renderChatHistory();
  await loadHistoryList();
  closeHistory();
  input.focus();
}

async function deleteConversation(id) {
  if (!window.api?.historyDelete) return;

  await window.api.historyDelete(id);
  if (id === currentConversationId) {
    await createNewConversation();
    return;
  }

  await loadHistoryList();
}

function updateKeyStatus(settings) {
  const speedText = ` Local speed is set to ${speedModeLabel(settings.localSpeedMode || currentLocalSpeedMode)} mode.`;

  if (!settings.apiKeySet) {
    keyStatus.textContent = "Key: not set";
    settingsHint.textContent = "Local (Auto) tries Ollama first, then Foundry Local. Paste any supported cloud API key and the app will detect the provider for you." + speedText;
    return;
  }

  if (settings.detectedProvider) {
    keyStatus.textContent = `Key: set - ${providerLabel(settings.detectedProvider)}`;
    settingsHint.textContent = settings.cloudModel
      ? `Detected ${providerLabel(settings.detectedProvider)} and saved model ${settings.cloudModel}.` + speedText
      : `Detected ${providerLabel(settings.detectedProvider)} for this key.` + speedText;
    return;
  }

  keyStatus.textContent = "Key: saved";
  settingsHint.textContent = "The key is stored locally on this PC. If detection fails, switch to the exact provider and try saving again." + speedText;
}

async function loadSettingsUI() {
  if (!window.api?.settingsGet) {
    keyStatus.textContent = "Key: settings API unavailable";
    return;
  }

  const settings = await window.api.settingsGet();
  providerSelect.value = settings.provider || "local-auto";
  displayName = String(settings.displayName || "").trim();
  displayNameInput.value = displayName;
  refreshEmptyGreeting();
  currentLocalSpeedMode = settings.localSpeedMode || "fast";
  speedModeSelect.value = currentLocalSpeedMode;
  updateKeyStatus(settings);
  updateAppearanceUI(settings);
}

const SHORTCUT_KEY_NAMES = {
  Space: "Space",
  Tab: "Tab",
  Enter: "Return",
  Backspace: "Backspace",
  Delete: "Delete",
  Escape: "Escape",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  BracketLeft: "[",
  BracketRight: "]",
  Minus: "-",
  Equal: "="
};

function acceleratorFromEvent(event) {
  const parts = [];
  if (event.ctrlKey) parts.push("Control");
  if (event.metaKey) parts.push("Command");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");

  const code = event.code || "";
  let key = "";

  if (/^Key[A-Z]$/.test(code)) key = code.slice(3);
  else if (/^Digit\d$/.test(code)) key = code.slice(5);
  else if (/^Numpad\d$/.test(code)) key = `num${code.slice(6)}`;
  else if (/^F\d{1,2}$/.test(code)) key = code;
  else if (SHORTCUT_KEY_NAMES[code]) key = SHORTCUT_KEY_NAMES[code];

  if (!key || !parts.length) return "";

  parts.push(key);
  return parts.join("+");
}

function prettyShortcut(accelerator) {
  if (!accelerator) return "";

  return String(accelerator)
    .split("+")
    .map((part) => {
      if (part === "Control") return "Ctrl";
      if (part === "Command" || part === "CommandOrControl") return "Cmd";
      if (part === "Alt") return isMacPlatform ? "Option" : "Alt";
      return part;
    })
    .join(" + ");
}

function updateAppearanceUI(settings) {
  if (!appearModeSelect) return;

  const mode = settings.appearMode || "both";
  appearModeSelect.value = mode;

  storedShortcut = settings.shortcut || settings.defaultShortcut || "";
  defaultShortcut = settings.defaultShortcut || "";
  shortcutInput.value = prettyShortcut(storedShortcut);

  breatheVisibleInput.value = Math.round((settings.breatheVisibleMs || 5000) / 1000);
  breatheHiddenInput.value = Math.round((settings.breatheHiddenMs || 5000) / 1000);

  const breatheOn = mode === "breathe" || mode === "both";
  const shortcutOn = mode === "shortcut" || mode === "both";

  shortcutInput.disabled = !shortcutOn;
  shortcutResetBtn.disabled = !shortcutOn;
  breatheVisibleInput.disabled = !breatheOn;
  breatheHiddenInput.disabled = !breatheOn;

  if (!shortcutOn) {
    appearHint.textContent = "Breathe only: ibia shows itself on a timer. Hover it to keep it on screen.";
    return;
  }

  const active = settings.activeShortcut || "";
  const activeNote = active && active !== storedShortcut
    ? ` Currently active: ${prettyShortcut(active)} (your pick was taken by another app).`
    : "";

  appearHint.textContent = breatheOn
    ? `Both: press ${prettyShortcut(storedShortcut)} any time, and ibia also fades itself in and out.${activeNote}`
    : `Shortcut only: press ${prettyShortcut(storedShortcut)} to show or hide ibia.${activeNote}`;
}

async function saveAppearance(patch) {
  if (!window.api?.settingsSetAppearance) {
    showToast("Settings API not wired");
    return;
  }

  const result = await window.api.settingsSetAppearance(patch);
  if (!result?.ok) {
    showToast(result?.error || "Could not update how ibia appears");
  }

  await loadSettingsUI();
}

async function refreshHealth() {
  try {
    currentHealth = await window.api.health();
    const label = providerLabel(currentHealth.provider || currentHealth.mode || "");
    const mode = currentHealth.provider === "local-auto" ? "Local auto" : label.replace(/^Local \((.*)\)$/, "$1");
    statusText.textContent = currentHealth.ok
      ? `${mode} ready`
      : userMessageFromError(currentHealth.error || "Not ready");
  } catch (error) {
    currentHealth = null;
    statusText.textContent = userMessageFromError(error);
  }
}

async function buildDocumentContext(queryText) {
  const profile = getSpeedProfile();
  const uploadedMatches = findRelevantUploadedChunks(queryText);
  const cacheKey = `${currentLocalSpeedMode}::${String(queryText || "").trim().toLowerCase()}::${libraryDocs.length}`;
  let libraryMatches = librarySearchCache.get(cacheKey);
  if (!libraryMatches && window.api?.librarySearch) {
    libraryMatches = await window.api.librarySearch({
      queryText,
      limit: profile.libraryMatchLimit,
      perDocumentLimit: currentLocalSpeedMode === "deep" ? 3 : 2
    });
    librarySearchCache.set(cacheKey, libraryMatches);
  }
  const sections = [];

  if (uploadedMatches.length) {
    sections.push(
      "Conversation file matches:\n" +
      uploadedMatches.map((match) =>
        `FILE: ${match.name}\nPATH: ${match.path}\nEXCERPT:\n${match.excerpt}`
      ).join("\n---\n")
    );
  }

  if (libraryMatches?.length) {
    sections.push(
      "Study library matches:\n" +
      libraryMatches.map((match) =>
        `FILE: ${match.name}\nPATH: ${match.path}\nEXCERPT:\n${clipText(match.excerpt, profile.excerptChars)}`
      ).join("\n---\n")
    );
  }

  if (!sections.length) return null;

  return {
    role: "system",
    content:
      "Relevant document context for this question. Prefer these excerpts when answering. " +
      "If the user asks for revision help, explain clearly and in depth.\n\n" +
      sections.join("\n\n")
  };
}

function buildMediaAttachments() {
  const mediaFiles = uploadedFiles.filter((file) => file.mediaKind === "image" || file.mediaKind === "video");
  return mediaFiles.slice(0, 3).map((file) => ({
    name: file.name,
    path: file.path,
    mediaKind: file.mediaKind,
    mimeType: file.mimeType || "",
    imageBase64: file.imageBase64 || "",
    videoFramesBase64: Array.isArray(file.videoFramesBase64) ? file.videoFramesBase64 : []
  }));
}

async function importFilesIntoChat(result) {
  if (!result || result.canceled) return;

  for (const file of result.files || []) {
    const existing = uploadedFiles.findIndex((item) => item.path === file.path);
    if (existing >= 0) uploadedFiles.splice(existing, 1);
    uploadedFiles.unshift(file);

    const details = [
      `Path: \`${file.path}\``,
      `Size: ${formatBytes(file.size)}`,
      `Type: ${file.mediaKind || "text"}`
    ];

    if (file.mediaKind === "image" && file.width && file.height) {
      details.push(`Image: ${file.width}x${file.height}`);
    }

    if (file.mediaKind === "video") {
      if (file.width && file.height) details.push(`Video: ${file.width}x${file.height}`);
      if (file.duration) details.push(`Duration: ${file.duration}s`);
      details.push("Frames extracted for local vision analysis.");
    }

    if (file.truncated) {
      details.push("Preview text was clipped, but chunk retrieval will still use the extracted chunks.");
    }

    addBubble(`Loaded file: **${file.name}**\n\n${details.join("\n")}`, "ai");
  }

  for (const rejected of result.rejected || []) {
    addBubble(`**Could not load ${rejected.name}**\n\n${rejected.error}`, "ai");
  }

  renderFileMemory();
  scheduleConversationSave();

  const loadedCount = (result.files || []).length;
  if (loadedCount) {
    showToast(`${loadedCount} file${loadedCount === 1 ? "" : "s"} added to this chat`);
  }
}

async function prepareHistoryForSend(history, latestQuery) {
  const all = Array.isArray(history) ? history : [];
  const profile = getSpeedProfile();
  const systemMessages = [];

  if (all[0]?.role === "system") {
    systemMessages.push({ ...all[0], content: clipText(all[0].content, currentLocalSpeedMode === "fast" ? 320 : 420) });
  }

  const documentContext = await buildDocumentContext(latestQuery);
  if (documentContext) {
    systemMessages.push(documentContext);
  }

  const tail = all.slice(all[0]?.role === "system" ? 1 : 0);
  const recent = tail.slice(Math.max(0, tail.length - profile.keepLastMessages)).map((message) => ({
    role: message.role,
    content: clipText(message.content, profile.messageChars)
  }));

  const out = [...systemMessages, ...recent];
  const totalChars = () => out.reduce((sum, message) => sum + String(message.content || "").length, 0);

  while (out.length > systemMessages.length + 1 && totalChars() > profile.contextChars) {
    out.splice(systemMessages.length, 1);
  }

  if (totalChars() > profile.contextChars && out.length) {
    const last = out[out.length - 1];
    last.content = clipText(last.content, Math.max(280, profile.contextChars - 320));
  }

  return out;
}

async function requestAssistantReply(latestQuery) {
  const typing = addBubble("", "ai");
  typing.classList.add("thinkingMsg");
  typing.innerHTML = `<span class="thinkingDots" aria-label="Thinking"><span></span><span></span><span></span></span>`;

  try {
    const payloadHistory = await prepareHistoryForSend(chatHistory, latestQuery);
    const reply = await window.api.ask({
      messages: payloadHistory,
      media: buildMediaAttachments()
    });
    typing.classList.remove("thinkingMsg");
    typing.innerHTML = `<div class="msgBody">${renderMessage(reply)}</div>`;
    chatHistory.push({ role: "assistant", content: reply });
    lastAssistantReply = reply;
    scheduleConversationSave();

    if (isNearBottom(messagesDiv)) {
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
  } catch (error) {
    const friendlyError = userMessageFromError(error);
    const textValue = `**Could not answer**\n\n${friendlyError}`;
    typing.classList.remove("thinkingMsg");
    typing.classList.add("errorMsg");
    typing.innerHTML = `<div class="msgBody">${renderMessage(textValue)}</div>`;
    showToast(friendlyError);
  }
}

async function sendMessage(text) {
  const message = text.trim();
  if (!message) return;

  if (busy) {
    queue.push(message);
    showToast(`Queued (${queue.length})`);
    return;
  }

  busy = true;
  const hadEmptyState = !!messagesDiv.querySelector(".emptyState");
  removeEmptyState();
  if (hadEmptyState) {
    await new Promise((resolve) => setTimeout(resolve, 170));
    removeEmptyStateNow();
  }

  const userMessageIndex = chatHistory.length;
  addBubble(message, "you", { historyIndex: userMessageIndex });
  chatHistory.push({ role: "user", content: message });
  scheduleConversationSave();

  try {
    await requestAssistantReply(message);
  } finally {
    busy = false;
    if (queue.length) setTimeout(() => sendMessage(queue.shift()), 120);
    input.focus();
  }
}

function resizeEditTextarea(textarea) {
  textarea.style.height = "0px";
  textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
}

function startEditingMessage(historyIndex) {
  if (busy) {
    showToast("Wait for the current answer to finish first");
    return;
  }

  const message = chatHistory[historyIndex];
  if (!message || message.role !== "user") return;

  const bubble = messagesDiv.querySelector(`.msg.you[data-history-index="${historyIndex}"]`);
  if (!bubble || bubble.classList.contains("editingMsg")) return;

  const currentText = String(message.content || "");
  bubble.classList.add("editingMsg");
  bubble.innerHTML = `
    <textarea class="msgEditInput" rows="1">${escapeHtml(currentText)}</textarea>
    <div class="msgEditActions">
      <button class="msgEditBtn primary" type="button" data-save-edit="${historyIndex}">Save</button>
      <button class="msgEditBtn" type="button" data-cancel-edit="${historyIndex}">Cancel</button>
    </div>
  `;

  const textarea = bubble.querySelector(".msgEditInput");
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  resizeEditTextarea(textarea);
}

function cancelEditingMessage(historyIndex) {
  renderChatHistory();
  const bubble = messagesDiv.querySelector(`.msg.you[data-history-index="${historyIndex}"]`);
  bubble?.scrollIntoView({ block: "nearest" });
}

async function saveEditedMessage(historyIndex) {
  if (busy) return;

  const bubble = messagesDiv.querySelector(`.msg.you[data-history-index="${historyIndex}"]`);
  const textarea = bubble?.querySelector(".msgEditInput");
  const nextText = String(textarea?.value || "").trim();
  const message = chatHistory[historyIndex];

  if (!message || message.role !== "user") return;
  if (!nextText) {
    showToast("Message cannot be empty");
    textarea?.focus();
    return;
  }

  const previousText = String(message.content || "").trim();
  if (nextText === previousText) {
    cancelEditingMessage(historyIndex);
    return;
  }

  busy = true;
  queue = [];
  chatHistory[historyIndex] = { ...message, content: nextText };
  chatHistory = chatHistory.slice(0, historyIndex + 1);
  lastAssistantReply = [...chatHistory].reverse().find((item) => item.role === "assistant")?.content || "";
  renderChatHistory();
  scheduleConversationSave();

  try {
    await requestAssistantReply(nextText);
  } finally {
    busy = false;
    input.focus();
  }
}

historyBtn.addEventListener("click", async () => {
  if (historyPanel.classList.contains("open")) {
    closeHistory();
    return;
  }

  await loadHistoryList();
  openHistory();
});

historyCloseBtn.addEventListener("click", closeHistory);

messagesDiv.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-message]");
  if (editButton) {
    startEditingMessage(Number(editButton.getAttribute("data-edit-message")));
    return;
  }

  const saveButton = event.target.closest("[data-save-edit]");
  if (saveButton) {
    await saveEditedMessage(Number(saveButton.getAttribute("data-save-edit")));
    return;
  }

  const cancelButton = event.target.closest("[data-cancel-edit]");
  if (cancelButton) {
    cancelEditingMessage(Number(cancelButton.getAttribute("data-cancel-edit")));
  }
});

messagesDiv.addEventListener("input", (event) => {
  if (event.target.classList.contains("msgEditInput")) {
    resizeEditTextarea(event.target);
  }
});

messagesDiv.addEventListener("keydown", async (event) => {
  if (!event.target.classList.contains("msgEditInput")) return;

  const bubble = event.target.closest("[data-history-index]");
  const historyIndex = Number(bubble?.dataset.historyIndex);

  if (event.key === "Escape") {
    event.preventDefault();
    cancelEditingMessage(historyIndex);
    return;
  }

  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    await saveEditedMessage(historyIndex);
  }
});

settingsBtn.addEventListener("click", () => {
  if (settingsPanel.classList.contains("open")) closeSettings();
  else openSettings();
});

settingsCloseBtn.addEventListener("click", closeSettings);

document.addEventListener("mousedown", (event) => {
  if (settingsPanel.classList.contains("open")) {
    const insideSettings = settingsPanel.contains(event.target) || settingsBtn.contains(event.target);
    if (!insideSettings) closeSettings();
  }

  if (historyPanel.classList.contains("open")) {
    const insideHistory = historyPanel.contains(event.target) || historyBtn.contains(event.target);
    if (!insideHistory) closeHistory();
  }
});

newChatBtn.addEventListener("click", async () => {
  await createNewConversation();
});

providerSelect.addEventListener("change", async () => {
  if (!window.api?.settingsSetProvider) {
    showToast("Settings API not wired");
    return;
  }

  const result = await window.api.settingsSetProvider(providerSelect.value);
  if (!result?.ok) {
    showToast(result?.error || "Could not update provider");
    return;
  }

  showToast("Provider updated");
  await loadSettingsUI();
  await refreshHealth();
});

speedModeSelect.addEventListener("change", async () => {
  if (!window.api?.settingsSetLocalSpeedMode) {
    showToast("Settings API not wired");
    return;
  }

  const result = await window.api.settingsSetLocalSpeedMode(speedModeSelect.value);
  if (!result?.ok) {
    showToast(result?.error || "Could not update speed mode");
    return;
  }

  currentLocalSpeedMode = speedModeSelect.value;
  clearLibrarySearchCache();
  showToast(`Local mode: ${speedModeLabel(currentLocalSpeedMode)}`);
  await loadSettingsUI();
  await refreshHealth();
});

appearModeSelect.addEventListener("change", async () => {
  await saveAppearance({ mode: appearModeSelect.value });
  showToast(
    appearModeSelect.value === "shortcut"
      ? "Shortcut keys only"
      : appearModeSelect.value === "breathe"
        ? "Breathe only"
        : "Shortcut keys + Breathe"
  );
});

function commitBreatheDuration(field, key) {
  const seconds = Math.min(600, Math.max(1, Math.round(Number(field.value) || 0)));
  field.value = seconds;
  return saveAppearance({ [key]: seconds * 1000 });
}

breatheVisibleInput.addEventListener("change", () => {
  commitBreatheDuration(breatheVisibleInput, "visibleMs");
});

breatheHiddenInput.addEventListener("change", () => {
  commitBreatheDuration(breatheHiddenInput, "hiddenMs");
});

shortcutInput.addEventListener("focus", () => {
  capturingShortcut = true;
  shortcutInput.value = "Press your keys...";
  shortcutInput.classList.add("capturing");
});

shortcutInput.addEventListener("blur", () => {
  capturingShortcut = false;
  shortcutInput.classList.remove("capturing");
  shortcutInput.value = prettyShortcut(storedShortcut);
});

shortcutInput.addEventListener("keydown", async (event) => {
  if (!capturingShortcut) return;

  event.preventDefault();
  event.stopPropagation();

  if (event.key === "Escape") {
    shortcutInput.blur();
    return;
  }

  const accelerator = acceleratorFromEvent(event);
  if (!accelerator) {
    shortcutInput.value = "Add Ctrl, Alt, Shift or Cmd...";
    return;
  }

  if (!window.api?.settingsSetShortcut) {
    showToast("Settings API not wired");
    return;
  }

  const result = await window.api.settingsSetShortcut(accelerator);
  if (!result?.ok) {
    showToast(result?.error || "Could not set that shortcut");
  } else {
    showToast(`Shortcut set to ${prettyShortcut(accelerator)}`);
  }

  capturingShortcut = false;
  shortcutInput.blur();
  await loadSettingsUI();
});

shortcutResetBtn.addEventListener("click", async () => {
  if (!window.api?.settingsSetShortcut || !defaultShortcut) return;

  const result = await window.api.settingsSetShortcut(defaultShortcut);
  if (!result?.ok) {
    showToast(result?.error || "Could not reset the shortcut");
  } else {
    showToast(`Shortcut reset to ${prettyShortcut(defaultShortcut)}`);
  }

  await loadSettingsUI();
});

displayNameInput.addEventListener("input", () => {
  displayName = displayNameInput.value.trim().slice(0, 48);
  refreshEmptyGreeting();

  clearTimeout(displayNameInput._timer);
  displayNameInput._timer = setTimeout(async () => {
    if (!window.api?.settingsSetDisplayName) {
      showToast("Settings API not wired");
      return;
    }

    const result = await window.api.settingsSetDisplayName(displayName);
    if (!result?.ok) showToast(result?.error || "Could not save name");
  }, 280);
});

saveKeyBtn.addEventListener("click", async () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    showToast("Paste your key first");
    return;
  }

  const saveApiKey = window.api?.settingsSetApiKey || window.api?.settingsSetOpenAIKey;
  if (!saveApiKey) {
    showToast("Settings API not wired");
    return;
  }

  const result = await saveApiKey(key);
  if (!result?.ok) {
    showToast(result?.error || "Could not save key", 2200);
    return;
  }

  apiKeyInput.value = "";
  showToast(result.detectedProviderLabel ? `Detected ${result.detectedProviderLabel}` : "Key saved");
  await loadSettingsUI();
  await refreshHealth();
});

libraryUploadBtn.addEventListener("click", async () => {
  if (!window.api?.libraryImport) {
    showToast("Library API not wired");
    return;
  }

  try {
    await applyLibraryImportResult(await window.api.libraryImport());
  } catch (error) {
    showToast("Could not add those files", 2200);
    addBubble(`**Library upload failed**\n\n${String(error?.message || error || "Unknown error")}`, "ai");
  }
});

closeBtn.addEventListener("click", async () => window.api.hide());
minBtn.addEventListener("click", async () => window.api.minimize());
maxBtn.addEventListener("click", async () => window.api.toggleMaximize());
themeBtn.addEventListener("click", toggleTheme);

async function syncMaxState() {
  const maximized = await window.api.isMaximized();
  appEl.classList.toggle("maxed", !!maximized);
}

window.api.onState(({ maximized }) => {
  appEl.classList.toggle("maxed", !!maximized);
});

sendBtn.addEventListener("click", () => {
  const text = input.value;
  input.value = "";
  autoGrow();
  sendMessage(text);
});

input.addEventListener("input", () => {
  autoGrow();
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    const text = input.value;
    input.value = "";
    autoGrow();
    sendMessage(text);
  }
});

uploadBtn.addEventListener("click", async () => {
  if (!window.api?.pickFiles) {
    showToast("File API not wired");
    return;
  }

  try {
    await importFilesIntoChat(await window.api.pickFiles());
  } catch (error) {
    showToast("Could not upload those files", 2200);
    addBubble(`**Upload failed**\n\n${String(error?.message || error || "Unknown error")}`, "ai");
  }
});

fileMemory.addEventListener("click", (event) => {
  const button = event.target.closest("[data-file-index]");
  if (!button) return;

  const index = Number(button.getAttribute("data-file-index"));
  if (!Number.isInteger(index) || index < 0 || index >= uploadedFiles.length) return;

  const removed = uploadedFiles.splice(index, 1)[0];
  renderFileMemory();
  scheduleConversationSave();
  showToast(`Removed ${removed.name} from this chat`);
});

function setLibraryDropActive(active) {
  libraryDropZone.classList.toggle("dragging", active);
}

libraryDropZone.addEventListener("dragenter", (event) => {
  event.preventDefault();
  libraryDragDepth += 1;
  setLibraryDropActive(true);
});

libraryDropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
  setLibraryDropActive(true);
});

libraryDropZone.addEventListener("dragleave", (event) => {
  event.preventDefault();
  libraryDragDepth = Math.max(0, libraryDragDepth - 1);
  if (libraryDragDepth === 0) {
    setLibraryDropActive(false);
  }
});

libraryDropZone.addEventListener("drop", async (event) => {
  event.preventDefault();
  libraryDragDepth = 0;
  setLibraryDropActive(false);

  const dropped = Array.from(event.dataTransfer?.files || []);
  const paths = dropped.map((file) => file.path).filter(Boolean);
  if (!paths.length) return;

  if (!window.api?.libraryImportPaths) {
    showToast("Drag and drop is not wired");
    return;
  }

  try {
    await applyLibraryImportResult(await window.api.libraryImportPaths(paths));
  } catch (error) {
    showToast("Could not add those dropped files", 2200);
    addBubble(`**Library drop failed**\n\n${String(error?.message || error || "Unknown error")}`, "ai");
  }
});

historyList.addEventListener("click", async (event) => {
  historyScrollTop = historyList.scrollTop;

  const deleteButton = event.target.closest("[data-history-delete]");
  if (deleteButton) {
    await deleteConversation(deleteButton.getAttribute("data-history-delete"));
    return;
  }

  const item = event.target.closest("[data-history-id]");
  if (!item) return;
  await openConversation(item.getAttribute("data-history-id"));
});

libraryList.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("[data-library-delete]");
  if (!deleteButton || !window.api?.libraryRemove) return;

  await window.api.libraryRemove(deleteButton.getAttribute("data-library-delete"));
  await loadLibraryList();
});

function playEntrance() {
  appEl.classList.remove("enter");
  void appEl.offsetWidth;
  appEl.classList.add("enter");
}

window.api.onShown(() => playEntrance());

async function boot() {
  setTheme(localStorage.getItem("theme") || "dark");
  await loadSettingsUI();
  await refreshHealth();
  await loadHistoryList();
  await loadLibraryList();
  await createNewConversation();

  setInterval(refreshHealth, 20000);
  autoGrow();
  input.focus();
  playEntrance();
  syncMaxState();
  renderFileMemory();
}

boot();
