
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "NetPulse Pro: Native Terminal",
    backgroundColor: '#020617',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false // Necessary for local file access in this diagnostic context
    }
  });

  // Load the local index.html
  win.loadFile('index.html');
  win.setMenuBarVisibility(false);
  
  // Open dev tools automatically if in development
  // win.webContents.openDevTools();
}

ipcMain.handle('node:ping', async (event, ip) => {
  return new Promise((resolve) => {
    // Aggressive timeout (800ms) to keep UI responsive
    exec(`ping -n 1 -w 800 ${ip}`, (error, stdout) => {
      if (error || !stdout) {
        resolve({ rtt: 0, status: 'dead' });
        return;
      }
      
      const match = stdout.match(/time[=<](\d+)ms/);
      if (match) {
        resolve({ rtt: parseInt(match[1]), status: 'alive' });
      } else {
        resolve({ rtt: 0, status: 'dead' });
      }
    });
  });
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
