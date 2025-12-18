const { app, BrowserWindow, globalShortcut, screen, ipcMain, net } = require("electron");
const path = require("path");

let win;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width: 440,
    height: 620,
    x: width - 480,
    y: height - 680,
    frame: false,
    alwaysOnTop: true,
    show: true,
    resizable: true,
    minWidth: 360,
    minHeight: 420,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });

  win.loadFile("index.html");
}

function toggleWin() {
  if (!win) return;
  if (win.isVisible()) {
    win.hide();
  } else {
    win.show();
    win.focus();
    // tell renderer to play entrance animation
    win.webContents.send("win:shown");
  }
}

app.whenReady().then(() => {
  createWindow();

  // ✅ Your requested shortcut
  const accelerator = "Control+A+I";
  const ok = globalShortcut.register(accelerator, toggleWin);
  console.log(ok ? `Shortcut registered: ${accelerator}` : `Shortcut failed: ${accelerator}`);

  // play entrance anim on first show too
  win.webContents.on("did-finish-load", () => {
    win.webContents.send("win:shown");
  });
});

app.on("will-quit", () => globalShortcut.unregisterAll());

/* ---------- Window controls (IPC) ---------- */
ipcMain.handle("win:hide", async () => (win?.hide(), true));
ipcMain.handle("win:minimize", async () => (win?.minimize(), true));
ipcMain.handle("win:toggleMaximize", async () => {
  if (!win) return false;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
  return true;
});
ipcMain.handle("win:getBounds", async () => (win ? win.getBounds() : null));
ipcMain.handle("win:setBounds", async (e, bounds) => {
  if (!win) return false;
  win.setBounds(bounds, false);
  return true;
});

/* ---------- Ollama ---------- */
function requestJSON({ method, url, payload, timeoutMs = 60000 }) {
  return new Promise((resolve, reject) => {
    const req = net.request({ method, url });
    req.setHeader("Content-Type", "application/json");

    const timer = setTimeout(() => {
      try { req.abort(); } catch {}
      reject(new Error("Request timed out."));
    }, timeoutMs);

    req.on("response", (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk.toString("utf8")));
      res.on("end", () => {
        clearTimeout(timer);
        const ok = res.statusCode >= 200 && res.statusCode < 300;
        if (!ok) return reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 400)}`));
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error(`Bad JSON: ${body.slice(0, 300)}`)); }
      });
    });

    req.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    if (payload) req.write(JSON.stringify(payload));
    req.end();
  });
}

const OLLAMA_MODEL = "gemma3:4b";
const OLLAMA_CHAT_URL = "http://127.0.0.1:11434/api/chat";
const OLLAMA_TAGS_URL = "http://127.0.0.1:11434/api/tags";

async function askOllama(history) {
  const data = await requestJSON({
    method: "POST",
    url: OLLAMA_CHAT_URL,
    payload: { model: OLLAMA_MODEL, messages: history, stream: false },
    timeoutMs: 120000
  });

  return data?.message?.content?.trim() || "No response.";
}

ipcMain.handle("ai:ask", async (event, history) => await askOllama(history));

ipcMain.handle("ai:health", async () => {
  try {
    const data = await requestJSON({ method: "GET", url: OLLAMA_TAGS_URL, payload: null, timeoutMs: 2500 });
    const names = (data?.models || []).map(m => m.name);
    const hasModel = names.includes(OLLAMA_MODEL);
    return { ok: true, model: OLLAMA_MODEL, hasModel };
  } catch (e) {
    return { ok: false, model: OLLAMA_MODEL, error: e.message || String(e) };
  }
});
