const { app, BrowserWindow, globalShortcut, screen, ipcMain } = require("electron");
const path = require("path");

let win;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width: 420,
    height: 520,
    x: width - 460,
    y: height - 580,
    frame: false,
    alwaysOnTop: true,
    show: true, // show at start so you see the greeting
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

// Hide (don’t quit)
ipcMain.handle("win:hide", async () => {
  if (win) win.hide();
  return true;
});

// === AI provider: OLLAMA (offline) ===
// Requires Ollama running locally: http://127.0.0.1:11434
async function askOllama(history) {
  const model = "llama3.2:3b"; // fast on many laptops; you can change to 7b if your PC can handle
  const url = "http://127.0.0.1:11434/api/chat";

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: history,
      stream: false
    })
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Ollama error (${res.status}): ${txt}`);
  }

  const data = await res.json();
  return data?.message?.content?.trim() || "I didn’t get a response.";
}

ipcMain.handle("ai:ask", async (event, history) => {
  return await askOllama(history);
});
