
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
      webSecurity: false 
    }
  });

  win.loadFile('index.html');
  win.setMenuBarVisibility(false);
}

// Global set to track active ping processes to prevent leaks
const activePings = new Set();

ipcMain.handle('node:ping', async (event, ip) => {
  return new Promise((resolve) => {
    // Windows ping command: -n 1 (one packet), -w 800 (800ms timeout)
    // We add a safety timeout to the child process itself
    const child = exec(`ping -n 1 -w 800 ${ip}`, { timeout: 1000 }, (error, stdout) => {
      activePings.delete(child);
      
      if (error || !stdout) {
        resolve({ rtt: 0, status: 'dead' });
        return;
      }
      
      const match = stdout.match(/time[=<](\d+)ms/);
      if (match) {
        resolve({ rtt: parseInt(match[1]), status: 'alive' });
      } else {
        // Handle "Destination host unreachable" or "Request timed out" in stdout
        resolve({ rtt: 0, status: 'dead' });
      }
    });

    activePings.add(child);
  });
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // Cleanup any lingering ping processes on exit
  for (const child of activePings) {
    child.kill();
  }
  if (process.platform !== 'darwin') app.quit();
});
