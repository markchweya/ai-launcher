// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // AI
  ask: (history) => ipcRenderer.invoke("ai:ask", history),
  health: () => ipcRenderer.invoke("ai:health"),

  // Window controls
  hide: () => ipcRenderer.invoke("win:hide"),
  minimize: () => ipcRenderer.invoke("win:minimize"),
  toggleMaximize: () => ipcRenderer.invoke("win:toggleMaximize"),
  isMaximized: () => ipcRenderer.invoke("win:isMaximized"),

  // Bounds (optional, for drag/resize persistence)
  getBounds: () => ipcRenderer.invoke("win:getBounds"),
  setBounds: (b) => ipcRenderer.invoke("win:setBounds", b),

  // Settings (optional)
  settingsGet: () => ipcRenderer.invoke("settings:get"),
  settingsSetProvider: (p) => ipcRenderer.invoke("settings:setProvider", p),
  settingsSetOpenAIKey: (k) => ipcRenderer.invoke("settings:setOpenAIKey", k),
  settingsSetFoundryPrefer: (v) => ipcRenderer.invoke("settings:setFoundryPrefer", v),

  // Events from main -> renderer
  onShown: (cb) => ipcRenderer.on("win:shown", () => cb && cb()),
  onState: (cb) => ipcRenderer.on("win:state", (e, data) => cb && cb(data))
});
