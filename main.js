const path = require("path");
const fs = require("fs");
const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  screen,
  Tray,
  Menu,
  nativeImage
} = require("electron");

let win = null;
let tray = null;

/* -----------------------------
   Cache / Chromium permissions
   (fixes cache_util_win.cc access denied spam)
------------------------------ */
const userCache = path.join(app.getPath("userData"), "Cache");
app.setPath("cache", userCache);
app.commandLine.appendSwitch("disk-cache-dir", userCache);
app.commandLine.appendSwitch("disable-gpu-cache");
// optional: reduces some Windows occlusion behavior edge-cases
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");
// optional: reduce autofill protocol noise
app.commandLine.appendSwitch(
  "disable-features",
  "AutofillEnableAccountWalletStorage,AutofillServerCommunication"
);

/* -----------------------------
   Settings (stored locally)
------------------------------ */
function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function loadSettings() {
  try {
    const p = settingsPath();
    if (!fs.existsSync(p)) return { provider: "ollama", openai_api_key: "" };
    const raw = fs.readFileSync(p, "utf-8");
    const data = JSON.parse(raw);
    return {
      provider: data.provider || "ollama",
      openai_api_key: data.openai_api_key || ""
    };
  } catch {
    return { provider: "ollama", openai_api_key: "" };
  }
}

function saveSettings(partial) {
  const current = loadSettings();
  const merged = { ...current, ...partial };
  fs.writeFileSync(settingsPath(), JSON.stringify(merged, null, 2), "utf-8");
  return merged;
}

/* -----------------------------
   Window helpers
------------------------------ */
function toggleWindow() {
  if (!win) return;
  if (win.isVisible()) win.hide();
  else {
    win.show();
    win.focus();
  }
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width: 520,
    height: 640,
    x: Math.max(20, width - 560),
    y: Math.max(20, height - 700),
    frame: false,
    transparent: true,
    resizable: true,
    minimizable: true,
    maximizable: true,
    fullscreenable: true,
    show: false,
    alwaysOnTop: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.loadFile("index.html");

  win.on("show", () => {
    if (win && win.webContents) win.webContents.send("app:shown");
  });

  win.on("maximize", () => {
    if (win && win.webContents) win.webContents.send("app:state", { maximized: true });
  });

  win.on("unmaximize", () => {
    if (win && win.webContents) win.webContents.send("app:state", { maximized: false });
  });

  // Prevent quitting when user closes window (we hide instead; tray opens it)
  win.on("close", (e) => {
    // If app is quitting, allow close
    if (app.isQuiting) return;
    e.preventDefault();
    win.hide();
  });

  win.on("closed", () => {
    win = null;
  });
}

/* -----------------------------
   Tray (fallback to open/hide)
------------------------------ */
function createTray() {
  // Try to load custom icon if you add one later:
  // build/icon.ico
  let icon = nativeImage.createEmpty();
  const iconPath = path.join(__dirname, "build", "icon.ico");
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
  }

  tray = new Tray(icon);
  tray.setToolTip("AI Launcher");

  const menu = Menu.buildFromTemplate([
    {
      label: "Show / Hide",
      click: () => toggleWindow()
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(menu);

  // Left click toggles too
  tray.on("click", () => toggleWindow());
}

/* -----------------------------
   Global Shortcut
------------------------------ */
function registerShortcuts() {
  // You requested Ctrl + A + I (note: many apps intercept Ctrl+A)
  const primary = "Control+A+I";

  // Fallback so you never get locked out
  const fallback = "Control+Shift+I";

  let ok = globalShortcut.register(primary, toggleWindow);
  if (!ok) console.log("Shortcut failed:", primary);

  // Always register fallback as a backup
  const ok2 = globalShortcut.register(fallback, toggleWindow);
  if (!ok2) console.log("Shortcut failed:", fallback);

  const active =
    (globalShortcut.isRegistered(primary) ? primary : "") ||
    (globalShortcut.isRegistered(fallback) ? fallback : "") ||
    "none";

  console.log("Shortcut active:", active);
}

/* -----------------------------
   Ollama + OpenAI helpers
------------------------------ */
async function ollamaTags() {
  const r = await fetch("http://127.0.0.1:11434/api/tags");
  if (!r.ok) throw new Error("Ollama not reachable");
  return await r.json();
}

async function ollamaChat(model, messages) {
  const payload = { model, messages, stream: false };

  const r = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error("Ollama chat failed: " + t);
  }

  const data = await r.json();
  return data?.message?.content || "";
}

async function openaiChat(apiKey, messages) {
  const payload = {
    model: "gpt-4o-mini",
    messages
  };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error("OpenAI request failed: " + t);
  }

  const data = await r.json();
  return data?.choices?.[0]?.message?.content || "";
}

/* -----------------------------
   IPC
------------------------------ */
function wireIPC() {
  ipcMain.handle("app:hide", () => {
    if (win) win.hide();
    return true;
  });

  ipcMain.handle("app:minimize", () => {
    if (win) win.minimize();
    return true;
  });

  ipcMain.handle("app:toggleMaximize", () => {
    if (!win) return false;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
    return true;
  });

  ipcMain.handle("app:isMaximized", () => {
    if (!win) return false;
    return win.isMaximized();
  });

  ipcMain.handle("settings:get", () => {
    const s = loadSettings();
    return {
      provider: s.provider || "ollama",
      openaiKeySet: !!(s.openai_api_key && s.openai_api_key.trim().length > 0)
    };
  });

  ipcMain.handle("settings:setProvider", (evt, provider) => {
    const p = String(provider || "").trim();
    if (p !== "ollama" && p !== "openai") return { ok: false, error: "Invalid provider" };
    saveSettings({ provider: p });
    return { ok: true };
  });

  ipcMain.handle("settings:setOpenAIKey", (evt, key) => {
    const k = String(key || "").trim();
    if (!k) return { ok: false, error: "Empty key" };
    saveSettings({ openai_api_key: k });
    return { ok: true };
  });

  ipcMain.handle("app:health", async () => {
    const s = loadSettings();

    if (s.provider === "openai") {
      const hasKey = !!(s.openai_api_key && s.openai_api_key.trim().length > 0);
      return { provider: "openai", ok: hasKey, model: "gpt-4o-mini" };
    }

    try {
      const tags = await ollamaTags();
      const models = (tags.models || []).map((m) => m.name);
      const model =
        models.find((x) => x.toLowerCase().startsWith("gemma3:4b")) ||
        models[0] ||
        "";
      return { provider: "ollama", ok: true, hasModel: !!model, model };
    } catch {
      return { provider: "ollama", ok: false, hasModel: false, model: "" };
    }
  });

  ipcMain.handle("ai:ask", async (evt, messages) => {
    const s = loadSettings();
    const safeMessages = Array.isArray(messages) ? messages : [];

    if (s.provider === "openai") {
      const key = (s.openai_api_key || "").trim();
      if (!key) throw new Error("OpenAI key not set");
      return await openaiChat(key, safeMessages);
    }

    const tags = await ollamaTags();
    const models = (tags.models || []).map((m) => m.name);
    const model =
      models.find((x) => x.toLowerCase().startsWith("gemma3:4b")) ||
      models[0];

    if (!model) throw new Error("No Ollama models found");
    return await ollamaChat(model, safeMessages);
  });
}

/* -----------------------------
   App lifecycle
------------------------------ */
app.whenReady().then(() => {
  createWindow();
  createTray();
  wireIPC();
  registerShortcuts();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

// Keep running in background with tray even if all windows are closed/hidden
app.on("window-all-closed", () => {
  // do nothing (tray keeps app alive)
});
