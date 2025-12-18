const { app, BrowserWindow, globalShortcut, screen } = require("electron");
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
    show: false,
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

  // Reliable Windows global shortcut (single keys like A+I won't work well)
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

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
