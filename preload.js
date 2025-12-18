const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  ask: (history) => ipcRenderer.invoke("ai:ask", history),
  hide: () => ipcRenderer.invoke("win:hide")
});
