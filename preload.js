const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  ask: (history) => ipcRenderer.invoke("ai:ask", history),
  health: () => ipcRenderer.invoke("ai:health"),

  hide: () => ipcRenderer.invoke("win:hide"),
  minimize: () => ipcRenderer.invoke("win:minimize"),
  toggleMaximize: () => ipcRenderer.invoke("win:toggleMaximize"),
  isMaximized: () => ipcRenderer.invoke("win:isMaximized"),

  getBounds: () => ipcRenderer.invoke("win:getBounds"),
  setBounds: (b) => ipcRenderer.invoke("win:setBounds", b),

  onShown: (cb) => ipcRenderer.on("win:shown", cb),
  onState: (cb) => ipcRenderer.on("win:state", (e, data) => cb(data))
});
