const { app, BrowserWindow, globalShortcut, screen, ipcMain, net } = require("electron");
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

function postJSON(url, payload, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: "POST",
      url
    });

    request.setHeader("Content-Type", "application/json");

    const timer = setTimeout(() => {
      try { request.abort(); } catch {}
      reject(new Error("Ollama request timed out. Try a lighter model or check Ollama is responsive."));
    }, timeoutMs);

    request.on("response", (response) => {
      let body = "";
      response.on("data", (chunk) => (body += chunk.toString("utf8")));
      response.on("end", () => {
        clearTimeout(timer);
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error("Failed to parse Ollama JSON response: " + body.slice(0, 300)));
          }
        } else {
          reject(new Error(`Ollama error (${response.statusCode}): ${body.slice(0, 500)}`));
        }
      });
    });

    request.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    request.write(JSON.stringify(payload));
    request.end();
  });
}

async function askOllama(history) {
 const model = "gemma3:4b";
 // you have this installed
  const url = "http://127.0.0.1:11434/api/chat";

  const data = await postJSON(url, {
    model,
    messages: history,
    stream: false
  });

  return data?.message?.content?.trim() || "I didn’t get a response from the model.";
}

ipcMain.handle("ai:ask", async (event, history) => {
  console.log("AI ask:", { messages: history?.length });
  return await askOllama(history);
});
