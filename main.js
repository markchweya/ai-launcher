const { app, BrowserWindow, globalShortcut, screen, ipcMain, net } = require("electron");
const path = require("path");

let win;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width: 420,
    height: 560,
    x: width - 460,
    y: height - 620,
    frame: false,
    alwaysOnTop: true,
    show: true,
    resizable: false,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });

  win.loadFile("index.html");
}

app.whenReady().then(() => {
  createWindow();

  const accelerator = "Control+Shift+A+I";
  const ok = globalShortcut.register(accelerator, () => {
    if (!win) return;
    if (win.isVisible()) win.hide();
    else {
      win.show();
      win.focus();
    }
  });

  console.log(ok ? `Shortcut registered: ${accelerator}` : `Shortcut failed: ${accelerator}`);
});

app.on("will-quit", () => globalShortcut.unregisterAll());

ipcMain.handle("win:hide", async () => {
  if (win) win.hide();
  return true;
});

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
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error(`Bad JSON: ${body.slice(0, 300)}`));
        }
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

// Choose one you already have:
const OLLAMA_MODEL = "mistral:latest"; // or "llama3:latest" or "gemma3:4b"
const OLLAMA_CHAT_URL = "http://127.0.0.1:11434/api/chat";
const OLLAMA_TAGS_URL = "http://127.0.0.1:11434/api/tags";

async function askOllama(history) {
  const data = await requestJSON({
    method: "POST",
    url: OLLAMA_CHAT_URL,
    payload: { model: OLLAMA_MODEL, messages: history, stream: false },
    timeoutMs: 120000
  });

  return data?.message?.content?.trim() || "I didn’t get a response from the model.";
}

ipcMain.handle("ai:ask", async (event, history) => {
  return await askOllama(history);
});

ipcMain.handle("ai:health", async () => {
  try {
    const data = await requestJSON({
      method: "GET",
      url: OLLAMA_TAGS_URL,
      payload: null,
      timeoutMs: 4000
    });

    const modelNames = (data?.models || []).map(m => m.name);
    const hasModel = modelNames.includes(OLLAMA_MODEL);
    return { ok: true, model: OLLAMA_MODEL, hasModel, models: modelNames.slice(0, 20) };
  } catch (e) {
    return { ok: false, model: OLLAMA_MODEL, error: e.message || String(e) };
  }
});
