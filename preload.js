const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  load: () => ipcRenderer.invoke('db:load'),
  save: d => ipcRenderer.invoke('db:save', d),
  backup: d => ipcRenderer.invoke('db:backup', d),
  restore: () => ipcRenderer.invoke('db:restore'),
  exportCsv: (text, name) => ipcRenderer.invoke('csv:export', text, name),
  importCsv: () => ipcRenderer.invoke('csv:import'),
  getLang: () => ipcRenderer.invoke('lang:get'),
  setLang: l => ipcRenderer.invoke('lang:set', l),
  onMenu: cb => ipcRenderer.on('menu', (_e, a) => cb(a))
});
