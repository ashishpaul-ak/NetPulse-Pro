
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Header } from './components/Header';
import { IPCard } from './components/IPCard';
import { SummaryTable } from './components/SummaryTable';
import { DiagnosticPanel } from './components/DiagnosticPanel';
import { IPNode, MonitorSettings, PingResult, Hop } from './types';
import { parseBulkInput } from './utils/networkUtils';

// Helper to detect if running in Electron
// Cast window to any to access Electron-injected global properties that TypeScript is unaware of
const isElectron = typeof window !== 'undefined' && (window as any).process && ((window as any).process as any).type;
const electron = isElectron ? (window as any).require('electron') : null;

const App: React.FC = () => {
  const [nodes, setNodes] = useState<IPNode[]>([]);
  const [bulkInput, setBulkInput] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'dashboard'>('table');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeGraphedIds, setActiveGraphedIds] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showDesktopModal, setShowDesktopModal] = useState(false);
  
  const [settings, setSettings] = useState<MonitorSettings>({
    interval: 2.5,
    warningThreshold: 100,
    timeframe: 120,
    statusColors: {
      alive: '#10b981',
      unstable: '#f59e0b',
      dead: '#ef4444'
    }
  });

  const maxDataPoints = useMemo(() => {
    const pointsNeeded = (settings.timeframe * 60) / settings.interval;
    return Math.min(pointsNeeded, 10000); 
  }, [settings.timeframe, settings.interval]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const resolveHostname = useCallback(async (nodeId: string, ipOrHost: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `What is the standard hostname for "${ipOrHost}"? Return ONLY the plain text hostname.`,
      });
      const hostname = response.text?.trim() || 'Unknown';
      setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, hostname, isResolving: false } : n));
    } catch (error) {
      setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, hostname: 'N/A', isResolving: false } : n));
    }
  }, []);

  const handleTraceroute = useCallback(async (nodeId: string, targetIp: string) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, isTracing: true } : n));
    
    try {
      let hops: Hop[] = [];
      if (isElectron) {
        // Real System Traceroute via IPC
        hops = await electron.ipcRenderer.invoke('node:trace', targetIp);
      } else {
        // Fallback Simulation for browser
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Generate a realistic JSON traceroute for "${targetIp}". Return ONLY a JSON array of 5-8 objects with keys: number, ip, name, avg, min, cur, pl.`,
        });
        const text = response.text?.replace(/```json|```/g, '') || '[]';
        hops = JSON.parse(text);
      }
      setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, hops, isTracing: false } : n));
    } catch (error) {
      setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, isTracing: false } : n));
    }
  }, []);

  const getPingResult = useCallback(async (node: IPNode): Promise<PingResult> => {
    if (isElectron) {
      // Real System Ping via IPC
      const { rtt, status } = await electron.ipcRenderer.invoke('node:ping', node.ip);
      return { 
        timestamp: Date.now(), 
        rtt, 
        status: status === 'dead' ? 'dead' : (rtt > settings.warningThreshold ? 'unstable' : 'alive')
      };
    } else {
      // Browser Simulation fallback
      const persistentDownSeed = node.ip.split('.').reduce((acc, v) => acc + (parseInt(v) || 0), 0) % 100;
      const randomFailure = Math.random() < 0.03;
      if (persistentDownSeed > 98 || randomFailure) return { timestamp: Date.now(), rtt: 0, status: 'dead' };
      const baseLatency = 10 + (persistentDownSeed % 40);
      const rtt = baseLatency + (Math.random() * 5);
      return {
        timestamp: Date.now(),
        rtt,
        status: rtt > settings.warningThreshold ? 'unstable' : 'alive'
      };
    }
  }, [settings.warningThreshold]);

  const updateNodeData = useCallback(async () => {
    // We update nodes sequentially or in small batches to avoid overlapping OS processes
    for (const node of nodes) {
      if (!node.isMonitoring) continue;
      
      const result = await getPingResult(node);
      
      setNodes(currentNodes => currentNodes.map(n => {
        if (n.id !== node.id) return n;

        const newHistory = [...n.history, result].slice(-maxDataPoints);
        let newDowntimeEvents = [...n.downtimeEvents];
        const lastEvent = newDowntimeEvents[newDowntimeEvents.length - 1];

        if (result.status === 'dead') {
          if (lastEvent && !lastEvent.endTime) {
            newDowntimeEvents[newDowntimeEvents.length - 1] = { ...lastEvent, lostCount: lastEvent.lostCount + 1 };
          } else {
            newDowntimeEvents.push({ id: Math.random().toString(36).substr(2, 9), startTime: result.timestamp, lostCount: 1 });
          }
          return { ...n, history: newHistory, downtimeEvents: newDowntimeEvents, curRtt: 0, sent: n.sent + 1, lost: n.lost + 1, packetLoss: ((n.lost + 1) / (n.sent + 1)) * 100 };
        }

        if (lastEvent && !lastEvent.endTime) {
          newDowntimeEvents[newDowntimeEvents.length - 1] = { ...lastEvent, endTime: result.timestamp };
        }

        const aliveResults = newHistory.filter(h => h.status !== 'dead');
        const minRtt = aliveResults.length > 0 ? Math.min(...aliveResults.map(h => h.rtt)) : n.minRtt;
        const avgRtt = aliveResults.length > 0 ? aliveResults.reduce((acc, curr) => acc + curr.rtt, 0) / aliveResults.length : 0;
        
        return {
          ...n,
          history: newHistory,
          downtimeEvents: newDowntimeEvents,
          minRtt,
          avgRtt,
          curRtt: result.rtt,
          sent: n.sent + 1,
          received: n.received + 1,
          packetLoss: (n.lost / (n.sent + 1)) * 100,
        };
      }));
    }
  }, [nodes, getPingResult, maxDataPoints]);

  useEffect(() => {
    const timer = setInterval(updateNodeData, settings.interval * 1000);
    return () => clearInterval(timer);
  }, [updateNodeData, settings.interval]);

  const handleAddIPs = () => {
    const targets = parseBulkInput(bulkInput);
    if (targets.length === 0) return;
    const newNodes: IPNode[] = targets.map(target => {
      const id = Math.random().toString(36).substr(2, 9);
      resolveHostname(id, target);
      return {
        id, ip: target, label: target, hostname: 'Resolving...', isResolving: true,
        history: [], downtimeEvents: [], minRtt: Infinity, maxRtt: 0, avgRtt: 0, curRtt: 0,
        sent: 0, received: 0, lost: 0, packetLoss: 0,
        isMonitoring: true, isGraphed: false
      };
    });
    setNodes(prev => [...prev, ...newNodes]);
    setBulkInput('');
  };

  const themeClasses = theme === 'dark' ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900";

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${themeClasses} overflow-x-hidden`}>
      <Header 
        theme={theme} 
        onToggleTheme={toggleTheme} 
        onOpenDesktopExport={() => setShowDesktopModal(true)} 
        engineMode={isElectron ? 'native' : 'simulated'}
      />
      
      <main className="flex-1 p-4 max-w-[1920px] mx-auto w-full space-y-4">
        <section className={`border rounded-xl p-4 shadow-sm flex flex-col lg:flex-row gap-4 items-center ${theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex-1 w-full flex gap-2">
            <input 
              type="text" 
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder="Targets: 8.8.8.8, 10.0.0.1-50, 192.168.1.0/24..."
              className={`flex-1 border rounded-lg px-4 py-2.5 text-sm mono outline-none focus:ring-2 focus:ring-blue-500 shadow-inner transition-all ${theme === 'dark' ? 'bg-slate-950 text-white border-slate-800' : 'bg-white text-slate-900 border-slate-200'}`}
              onKeyDown={(e) => e.key === 'Enter' && handleAddIPs()}
            />
            <button onClick={handleAddIPs} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-lg text-xs uppercase tracking-widest active:scale-95 transition-all shadow-md flex items-center gap-2">
              <i className="fas fa-plus"></i> Add
            </button>
          </div>

          <div className="flex gap-4 items-center shrink-0 lg:border-l lg:border-slate-800 lg:pl-4">
            <button onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded-lg transition-all ${showSettings ? 'bg-blue-500/20 text-blue-500' : 'text-slate-400 hover:bg-slate-500/10'}`} title="Settings"><i className="fas fa-cog text-lg"></i></button>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Window</label>
              <select value={settings.timeframe} onChange={(e) => setSettings({...settings, timeframe: parseInt(e.target.value)})} className={`border rounded-lg px-3 py-1.5 text-xs font-bold outline-none cursor-pointer ${theme === 'dark' ? 'bg-slate-950 text-white border-slate-800' : 'bg-white text-slate-900 border-slate-200'}`}>
                <option value={10}>10m</option>
                <option value={30}>30m</option>
                <option value={60}>60m</option>
                <option value={120}>120m</option>
              </select>
            </div>
            <div className="flex bg-slate-500/10 p-1 rounded-lg border border-slate-500/10 gap-1">
              <button onClick={() => setViewMode('table')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all flex items-center gap-2 ${viewMode === 'table' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}><i className="fas fa-list"></i> Table</button>
              <button onClick={() => setViewMode('grid')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all flex items-center gap-2 ${viewMode === 'grid' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}><i className="fas fa-th-large"></i> Cards</button>
              {activeGraphedIds.length > 0 && (
                <button onClick={() => setViewMode('dashboard')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all flex items-center gap-2 ${viewMode === 'dashboard' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}><i className="fas fa-chart-line"></i> Dashboard</button>
              )}
            </div>
          </div>
        </section>

        {showSettings && (
          <section className={`border rounded-xl p-6 shadow-xl animate-in slide-in-from-top-4 duration-300 ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex flex-col space-y-6">
              {/* Monitoring Config */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2"><i className="fas fa-sliders-h"></i> Monitoring Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Ping Interval (seconds)</label>
                      <span className="text-xs font-bold text-blue-500 mono">{settings.interval.toFixed(1)}s</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.5" 
                      max="10" 
                      step="0.1" 
                      value={settings.interval}
                      onChange={(e) => setSettings({ ...settings, interval: parseFloat(e.target.value) })}
                      className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between text-[8px] text-slate-500 font-bold">
                      <span>0.5s (Fast)</span>
                      <span>10s (Slow)</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Warning Threshold (ms)</label>
                      <span className="text-xs font-bold text-amber-500 mono">{settings.warningThreshold}ms</span>
                    </div>
                    <input 
                      type="range" 
                      min="10" 
                      max="1000" 
                      step="10" 
                      value={settings.warningThreshold}
                      onChange={(e) => setSettings({ ...settings, warningThreshold: parseInt(e.target.value) })}
                      className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-600"
                    />
                    <div className="flex justify-between text-[8px] text-slate-500 font-bold">
                      <span>10ms</span>
                      <span>1000ms</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Colors */}
              <div className="space-y-4 pt-4 border-t border-slate-800/50">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2"><i className="fas fa-palette"></i> Status Colors</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(settings.statusColors).map(([status, color]) => (
                    <div key={status} className="flex items-center justify-between p-3 rounded-lg border border-slate-500/10 bg-slate-500/5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{status}</span>
                      <input type="color" value={color} onChange={(e) => setSettings({ ...settings, statusColors: { ...settings.statusColors, [status as keyof typeof settings.statusColors]: e.target.value } })} className="w-8 h-8 rounded-lg cursor-pointer border-none bg-transparent" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {viewMode === 'dashboard' ? (
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
             {activeGraphedIds.map((id, index) => {
                const node = nodes.find(n => n.id === id);
                if (!node) return null;
                return (
                  <DiagnosticPanel 
                    key={node.id} node={node} theme={theme} settings={settings}
                    canMoveUp={index > 0} canMoveDown={index < activeGraphedIds.length - 1}
                    onMove={(dir) => {
                      const idx = activeGraphedIds.indexOf(id);
                      const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
                      const newIds = [...activeGraphedIds];
                      [newIds[idx], newIds[targetIdx]] = [newIds[targetIdx], newIds[idx]];
                      setActiveGraphedIds(newIds);
                    }}
                    onUpdateName={(name) => setNodes(prev => prev.map(n => n.id === id ? { ...n, customName: name } : n))}
                    onClose={() => setActiveGraphedIds(prev => prev.filter(gid => gid !== id))}
                    onTrace={() => handleTraceroute(id, node.ip)}
                  />
                );
             })}
          </section>
        ) : viewMode === 'table' ? (
          <SummaryTable 
            nodes={nodes} theme={theme} onUpdateName={(id, name) => setNodes(prev => prev.map(n => n.id === id ? { ...n, customName: name } : n))}
            onOpenGraph={(id) => { if(!activeGraphedIds.includes(id)) setActiveGraphedIds(p => [...p, id]); setNodes(prev => prev.map(n => n.id === id ? { ...n, isGraphed: true, isMonitoring: true } : n)); }}
            onToggleMonitoring={(id) => setNodes(prev => prev.map(n => n.id === id ? { ...n, isMonitoring: !n.isMonitoring } : n))}
            onRemove={(id) => { setNodes(prev => prev.filter(n => n.id !== id)); setActiveGraphedIds(p => p.filter(gid => gid !== id)); }}
          />
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {nodes.map(node => (
              <IPCard 
                key={node.id} node={node} theme={theme} threshold={settings.warningThreshold} timeframe={settings.timeframe}
                onUpdateName={(id, name) => setNodes(prev => prev.map(n => n.id === id ? { ...n, customName: name } : n))}
                onRemove={(id) => { setNodes(prev => prev.filter(n => n.id !== id)); setActiveGraphedIds(p => p.filter(gid => gid !== id)); }}
                onToggle={(id) => setNodes(prev => prev.map(n => n.id === id ? { ...n, isMonitoring: !n.isMonitoring } : n))}
                onOpenGraph={(id) => { if(!activeGraphedIds.includes(id)) setActiveGraphedIds(p => [...p, id]); setNodes(prev => prev.map(n => n.id === id ? { ...n, isGraphed: true, isMonitoring: true } : n)); }}
                onTrace={(id) => handleTraceroute(id, node.ip)}
              />
            ))}
          </section>
        )}

        {nodes.length === 0 && (
          <div className="py-32 flex flex-col items-center justify-center border-2 border-dashed border-slate-500/10 rounded-3xl">
            <div className="w-20 h-20 bg-blue-500/5 rounded-full flex items-center justify-center mb-6"><i className="fas fa-broadcast-tower text-4xl text-blue-500/20"></i></div>
            <h3 className="text-xl font-bold text-slate-500 uppercase tracking-widest">Awaiting Command</h3>
          </div>
        )}
      </main>

      {showDesktopModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className={`w-full max-w-md p-6 rounded-2xl border shadow-2xl ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><i className="fas fa-laptop-code text-blue-500"></i> Windows Native Mode</h2>
            <div className="space-y-4 text-sm opacity-70">
              <p>Since browsers cannot use your physical network card for ICMP Pings, you must run this as a desktop client to enable **Native Mode**.</p>
              <ul className="list-decimal list-inside space-y-1 mono text-[11px]">
                <li>Download Node.js</li>
                <li>Run <span className="text-blue-500">npm install</span></li>
                <li>Run <span className="text-green-500">npm run dist</span></li>
              </ul>
              <button onClick={() => setShowDesktopModal(false)} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold">Got it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
