
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { execFile } = require('child_process');

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
    // Basic sanitization of the input
    const cleanIp = String(ip).trim().split(' ')[0];

    // Using execFile for lower overhead and better security
    // -n 1: 1 packet
    // -w 800: 800ms timeout
    const child = execFile('ping', ['-n', '1', '-w', '800', cleanIp], { timeout: 1200 }, (error, stdout) => {
      activePings.delete(child);
      
      if (!stdout) {
        resolve({ rtt: 0, status: 'dead' });
        return;
      }
      
      // regex handles "time=15ms", "time<1ms", "time=1ms"
      const match = stdout.match(/time[=<](\d+)ms/i);
      
      if (match) {
        const rtt = parseInt(match[1], 10);
        resolve({ rtt: rtt, status: 'alive' });
      } else {
        resolve({ rtt: 0, status: 'dead' });
      }
    });

    activePings.add(child);
  });
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // CRITICAL: Prevent "zombie" processes by killing all active pings on exit
  for (const child of activePings) {
    try { child.kill(); } catch (e) {}
  }
  if (process.platform !== 'darwin') app.quit();
});
