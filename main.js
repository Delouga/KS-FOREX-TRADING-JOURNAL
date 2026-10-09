const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const dataFile = () => path.join(app.getPath('userData'), 'ftj-data.json');
const cfgFile = () => path.join(app.getPath('userData'), 'config.json');
let win = null, lang = 'fr';

const L = {
  fr: { file: 'Fichier', backup: 'Sauvegarder une copie…', restore: 'Restaurer une sauvegarde…', exp: 'Exporter le journal (CSV)…', imp: 'Importer un journal (CSV)…', quit: 'Quitter', lang: 'Langue', view: 'Affichage', json: 'Sauvegarde', csv: 'Fichier CSV', bad: 'Fichier illisible' },
  en: { file: 'File', backup: 'Back up a copy…', restore: 'Restore a backup…', exp: 'Export log (CSV)…', imp: 'Import log (CSV)…', quit: 'Quit', lang: 'Language', view: 'View', json: 'Backup', csv: 'CSV file', bad: 'Unreadable file' }
};

function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }
function writeAtomic(f, text) { fs.mkdirSync(path.dirname(f), { recursive: true }); const tmp = f + '.tmp'; fs.writeFileSync(tmp, text, 'utf8'); fs.renameSync(tmp, f); }

function buildMenu() {
  const s = L[lang], send = a => () => win && win.webContents.send('menu', a);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: s.file, submenu: [
      { label: s.backup, click: send('backup') }, { label: s.restore, click: send('restore') }, { type: 'separator' },
      { label: s.exp, click: send('exportCsv') }, { label: s.imp, click: send('importCsv') }, { type: 'separator' }, { label: s.quit, role: 'quit' }] },
    { label: s.lang, submenu: [
      { label: 'Français', type: 'radio', checked: lang === 'fr', click: send('lang:fr') },
      { label: 'English', type: 'radio', checked: lang === 'en', click: send('lang:en') }] },
    { label: s.view, submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] }
  ]));
}

function createWindow() {
  win = new BrowserWindow({ width: 1440, height: 900, minWidth: 360, minHeight: 560, backgroundColor: '#f4f6fa', title: 'KS FOREX TRADING JOURNAL',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.on('closed', () => { win = null; });
}

ipcMain.handle('lang:get', () => lang);
ipcMain.handle('lang:set', (_e, l) => { lang = l === 'en' ? 'en' : 'fr'; writeAtomic(cfgFile(), JSON.stringify({ lang })); buildMenu(); return lang; });
ipcMain.handle('db:load', () => {
  const d = readJson(dataFile());
  if (d) return d;
  const b = readJson(dataFile() + '.bak');            // repli sur la dernière copie automatique
  return b || null;
});
ipcMain.handle('db:save', (_e, data) => {
  try {
    const f = dataFile();
    if (fs.existsSync(f)) fs.copyFileSync(f, f + '.bak');
    writeAtomic(f, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
});
ipcMain.handle('db:backup', async (_e, data) => {
  const stamp = new Date().toISOString().slice(0, 10);
  const r = await dialog.showSaveDialog(win, { defaultPath: `ftj-backup-${stamp}.json`, filters: [{ name: L[lang].json, extensions: ['json'] }] });
  if (r.canceled || !r.filePath) return false;
  fs.writeFileSync(r.filePath, JSON.stringify(data, null, 1), 'utf8'); return true;
});
ipcMain.handle('db:restore', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: L[lang].json, extensions: ['json'] }] });
  if (r.canceled || !r.filePaths[0]) return null;
  const d = readJson(r.filePaths[0]);
  if (!d) { dialog.showErrorBox('KS FOREX TRADING JOURNAL', L[lang].bad); return null; }
  return d;
});
ipcMain.handle('csv:export', async (_e, text, name) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: name || 'ftj-trades.csv', filters: [{ name: L[lang].csv, extensions: ['csv'] }] });
  if (r.canceled || !r.filePath) return false;
  fs.writeFileSync(r.filePath, text, 'utf8'); return true;
});
ipcMain.handle('csv:import', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: L[lang].csv, extensions: ['csv', 'txt'] }] });
  if (r.canceled || !r.filePaths[0]) return null;
  return fs.readFileSync(r.filePaths[0], 'utf8');
});

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => { const c = readJson(cfgFile()); if (c && (c.lang === 'fr' || c.lang === 'en')) lang = c.lang; buildMenu(); createWindow(); });
  app.on('window-all-closed', () => app.quit());
}
