
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "NetPulse Pro: Native Terminal",
    backgroundColor: '#0f172a',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  win.loadURL(process.env.APP_URL || `file://${path.join(__dirname, 'index.html')}`);
  win.setMenuBarVisibility(false);
}

// IPC Handler for Real System Ping (Windows)
ipcMain.handle('node:ping', async (event, ip) => {
  return new Promise((resolve) => {
    // -n 1: One packet, -w 1000: 1s timeout
    exec(`ping -n 1 -w 1000 ${ip}`, (error, stdout) => {
      if (error) {
        resolve({ rtt: 0, status: 'dead' });
        return;
      }
      
      // Parse Windows Ping Output: "time=25ms"
      const match = stdout.match(/time[=<](\d+)ms/);
      if (match) {
        const rtt = parseInt(match[1]);
        resolve({ rtt, status: 'alive' });
      } else {
        resolve({ rtt: 0, status: 'dead' });
      }
    });
  });
});

// IPC Handler for Real System Traceroute (Windows)
ipcMain.handle('node:trace', async (event, ip) => {
  return new Promise((resolve) => {
    // Windows uses 'tracert', limiting hops to 20 for speed
    exec(`tracert -d -h 20 -w 500 ${ip}`, (error, stdout) => {
      if (error) {
        resolve([]);
        return;
      }

      const lines = stdout.split('\n');
      const hops = [];
      lines.forEach(line => {
        // Look for lines starting with a hop number
        const match = line.trim().match(/^(\d+)\s+([\d\s*ms]+?)\s+([\d\.]+)/);
        if (match) {
          const rttMatch = line.match(/(\d+) ms/);
          hops.push({
            number: parseInt(match[1]),
            ip: match[3],
            name: '',
            cur: rttMatch ? parseInt(rttMatch[1]) : 0,
            avg: rttMatch ? parseInt(rttMatch[1]) : 0,
            min: rttMatch ? parseInt(rttMatch[1]) : 0,
            pl: 0
          });
        }
      });
      resolve(hops);
    });
  });
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
