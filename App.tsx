
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Header } from './components/Header';
import { IPCard } from './components/IPCard';
import { SummaryTable } from './components/SummaryTable';
import { DiagnosticPanel } from './components/DiagnosticPanel';
import { IPNode, MonitorSettings, PingResult } from './types';
import { parseBulkInput } from './utils/networkUtils';

// Global check for Electron environment
const isElectron = typeof window !== 'undefined' && (window as any).process && (window as any).process.type;
const electron = isElectron ? (window as any).require('electron') : null;

const App: React.FC = () => {
  const [nodes, setNodes] = useState<IPNode[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'dashboard'>('table');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeGraphedIds, setActiveGraphedIds] = useState<string[]>([]);
  const [bulkInput, setBulkInput] = useState('');
  
  const [settings, setSettings] = useState<MonitorSettings>({
    interval: 2.0,
    warningThreshold: 150,
    timeframe: 120, // 120 minutes as requested
    statusColors: { alive: '#10b981', unstable: '#f59e0b', dead: '#ef4444' }
  });

  // Performance optimized ref to track if a tick is already running
  const isUpdatingRef = useRef(false);
  // Ref to track nodes for the interval to avoid expensive dependency array updates
  const nodesRef = useRef<IPNode[]>([]);
  
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const maxDataPoints = useMemo(() => {
    return Math.floor((settings.timeframe * 60) / settings.interval);
  }, [settings.timeframe, settings.interval]);

  const getPingResult = useCallback(async (ip: string): Promise<PingResult> => {
    if (isElectron) {
      try {
        const res = await electron.ipcRenderer.invoke('node:ping', ip);
        return { 
          timestamp: Date.now(), 
          rtt: res.rtt, 
          status: res.status === 'dead' ? 'dead' : (res.rtt > settings.warningThreshold ? 'unstable' : 'alive')
        };
      } catch (e) {
        console.error("Ping Error:", e);
        return { timestamp: Date.now(), rtt: 0, status: 'dead' };
      }
    }
    // Simulation fallback for web preview
    const rtt = 10 + Math.random() * 40;
    return { 
      timestamp: Date.now(), 
      rtt, 
      status: rtt > settings.warningThreshold ? 'unstable' : 'alive' 
    };
  }, [settings.warningThreshold]);

  // STABLE MONITORING TICK: Uses batching to prevent CPU spikes
  const runMonitoringTick = useCallback(async () => {
    // Prevention: If a tick is still running, skip this one. This prevents process piling.
    if (isUpdatingRef.current || nodesRef.current.length === 0) return;
    
    const monitoringNodes = nodesRef.current.filter(n => n.isMonitoring);
    if (monitoringNodes.length === 0) return;

    isUpdatingRef.current = true;

    try {
      // Process in parallel batches of 5. High speed without crashing the OS scheduler.
      const resultsMap: Record<string, PingResult> = {};
      const batchSize = 5;
      
      for (let i = 0; i < monitoringNodes.length; i += batchSize) {
        const batch = monitoringNodes.slice(i, i + batchSize);
        const results = await Promise.all(batch.map(node => getPingResult(node.ip)));
        batch.forEach((node, idx) => {
          resultsMap[node.id] = results[idx];
        });
      }

      // Single Atomic State Update to minimize React re-renders
      setNodes(currentNodes => currentNodes.map(node => {
        const result = resultsMap[node.id];
        if (!result) return node;

        const newHistory = [...node.history, result].slice(-maxDataPoints);
        const isDead = result.status === 'dead';
        
        const aliveHistory = newHistory.filter(h => h.status !== 'dead');
        const minRtt = aliveHistory.length ? Math.min(...aliveHistory.map(h => h.rtt)) : node.minRtt;
        const maxRtt = aliveHistory.length ? Math.max(...aliveHistory.map(h => h.rtt)) : node.maxRtt;
        const avgRtt = aliveHistory.length ? aliveHistory.reduce((s, h) => s + h.rtt, 0) / aliveHistory.length : 0;

        return {
          ...node,
          history: newHistory,
          curRtt: isDead ? 0 : result.rtt,
          sent: node.sent + 1,
          received: node.received + (isDead ? 0 : 1),
          lost: node.lost + (isDead ? 1 : 0),
          packetLoss: ((node.lost + (isDead ? 1 : 0)) / (node.sent + 1)) * 100,
          minRtt,
          maxRtt,
          avgRtt
        };
      }));
    } catch (err) {
      console.error("Monitoring tick failed:", err);
    } finally {
      isUpdatingRef.current = false;
    }
  }, [getPingResult, maxDataPoints]);

  useEffect(() => {
    // Stable timer that only resets if the interval duration itself changes
    const timer = setInterval(runMonitoringTick, settings.interval * 1000);
    return () => clearInterval(timer);
  }, [runMonitoringTick, settings.interval]);

  const handleAddIPs = () => {
    const targets = parseBulkInput(bulkInput);
    if (!targets.length) return;
    
    const newNodes: IPNode[] = targets.map(ip => ({
      id: Math.random().toString(36).substr(2, 9),
      ip, 
      label: ip, 
      hostname: 'Network Target', 
      isResolving: false,
      history: [], 
      downtimeEvents: [], 
      minRtt: Infinity, 
      maxRtt: 0, 
      avgRtt: 0, 
      curRtt: 0,
      sent: 0, 
      received: 0, 
      lost: 0, 
      packetLoss: 0,
      isMonitoring: true, 
      isGraphed: false
    }));
    
    setNodes(prev => [...prev, ...newNodes]);
    setBulkInput('');
  };

  const themeClasses = theme === 'dark' ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900";

  return (
    <div className={`flex-1 flex flex-col transition-colors duration-300 ${themeClasses} overflow-hidden`}>
      <Header 
        theme={theme} 
        onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} 
        engineMode={isElectron ? 'native' : 'simulated'}
      />
      
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        <section className={`border rounded-xl p-3 flex flex-col md:flex-row gap-3 items-center ${theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex-1 flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase font-bold mb-1 ml-1">Targets (IPs, Subnets/24, or Ranges x-y)</span>
            <input 
              type="text" 
              value={bulkInput} 
              onChange={e => setBulkInput(e.target.value)}
              placeholder="e.g. 8.8.8.8, 192.168.1.1-20, 10.0.0.0/24"
              className={`w-full rounded-lg px-4 py-2 text-sm mono outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}
              onKeyDown={e => e.key === 'Enter' && handleAddIPs()}
            />
          </div>
          <div className="flex items-end gap-3 mt-4 md:mt-0">
            <button onClick={handleAddIPs} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-lg text-xs uppercase transition-all shadow-lg shrink-0">
              <i className="fas fa-plus mr-2"></i> Deploy Monitor
            </button>
            <div className="flex gap-2 border-l border-slate-800 pl-3 shrink-0">
               <button onClick={() => setViewMode('table')} className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-800'}`} title="Table View"><i className="fas fa-list"></i></button>
               <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-800'}`} title="Grid View"><i className="fas fa-th"></i></button>
            </div>
          </div>
        </section>

        <div className="flex-1">
          {nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
               <i className="fas fa-satellite-dish text-4xl mb-4 opacity-20"></i>
               <p className="text-sm">Ready for deployment. Enter network targets to start monitoring.</p>
            </div>
          ) : viewMode === 'table' ? (
            <SummaryTable 
              nodes={nodes} theme={theme} 
              onUpdateName={(id, name) => setNodes(ns => ns.map(n => n.id === id ? {...n, customName: name} : n))}
              onOpenGraph={(id) => { if(!activeGraphedIds.includes(id)) setActiveGraphedIds(p => [...p, id]); setViewMode('dashboard'); }}
              onToggleMonitoring={(id) => setNodes(ns => ns.map(n => n.id === id ? {...n, isMonitoring: !n.isMonitoring} : n))}
              onRemove={(id) => setNodes(ns => ns.filter(n => n.id !== id))}
            />
          ) : viewMode === 'dashboard' ? (
             <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
               {activeGraphedIds.map(id => {
                 const node = nodes.find(n => n.id === id);
                 return node ? (
                   <DiagnosticPanel key={id} node={node} theme={theme} settings={settings} onClose={() => setActiveGraphedIds(prev => prev.filter(gid => gid !== id))} onUpdateName={(name) => setNodes(ns => ns.map(n => n.id === id ? {...n, customName: name} : n))} onTrace={() => {}} />
                 ) : null;
               })}
               {activeGraphedIds.length === 0 && (
                 <div className="col-span-full py-20 text-center text-slate-500 italic">Select a target from the list to initialize focus view.</div>
               )}
             </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {nodes.map(node => (
                <IPCard key={node.id} node={node} theme={theme} threshold={settings.warningThreshold} timeframe={settings.timeframe} onUpdateName={(id, name) => setNodes(ns => ns.map(n => n.id === id ? {...n, customName: name} : n))} onRemove={id => setNodes(ns => ns.filter(n => n.id !== id))} onToggle={id => setNodes(ns => ns.map(n => n.id === id ? {...n, isMonitoring: !n.isMonitoring} : n))} onOpenGraph={id => { setActiveGraphedIds([id]); setViewMode('dashboard'); }} onTrace={()=>{}} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
