
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { IPNode, ConnectionStatus } from '../types';

interface IPCardProps {
  node: IPNode;
  theme: 'light' | 'dark';
  threshold: number;
  timeframe: number;
  onUpdateName: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
  onOpenGraph: (id: string) => void;
  onTrace: (id: string) => void;
}

export const IPCard: React.FC<IPCardProps> = ({ node, theme, threshold, timeframe, onUpdateName, onRemove, onToggle, onOpenGraph, onTrace }) => {
  const [flashType, setFlashType] = useState<'success' | 'error' | null>(null);
  const [showHops, setShowHops] = useState(false);
  const [traceDuration, setTraceDuration] = useState(0);
  const lastSentRef = useRef(node.sent);
  const timerRef = useRef<number | null>(null);
  
  const lastResult = node.history[node.history.length - 1];
  const curRttValue = lastResult?.status === 'dead' ? 0 : lastResult?.rtt || 0;
  
  const isDown = lastResult?.status === 'dead';
  const isWarning = !isDown && curRttValue >= threshold;
  const isIdle = !node.isMonitoring;

  // Calculate last successful ping timestamp
  const lastSuccessfulPing = useMemo(() => {
    for (let i = node.history.length - 1; i >= 0; i--) {
      if (node.history[i].status !== 'dead') {
        return node.history[i].timestamp;
      }
    }
    return null;
  }, [node.history]);

  const formattedLastSeen = useMemo(() => {
    if (!lastSuccessfulPing) return 'Never';
    const date = new Date(lastSuccessfulPing);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, [lastSuccessfulPing]);

  useEffect(() => {
    if (node.sent > lastSentRef.current) {
      const type = isDown ? 'error' : 'success';
      setFlashType(null);
      setTimeout(() => setFlashType(type), 10);
      lastSentRef.current = node.sent;
    }
  }, [node.sent, isDown]);

  // Handle Traceroute timer and state
  useEffect(() => {
    if (node.isTracing) {
      setShowHops(true);
      setTraceDuration(0);
      const start = Date.now();
      timerRef.current = window.setInterval(() => {
        setTraceDuration(Math.floor((Date.now() - start) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setTraceDuration(0); // Reset timer when tracing is complete
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [node.isTracing]);

  const cardBg = theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300';
  const headerBg = theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-200';
  const textPrimary = theme === 'dark' ? 'text-white' : 'text-slate-900';

  const getStatusColor = () => {
    if (isIdle) return 'bg-slate-500';
    if (isDown) return 'bg-red-500';
    if (isWarning) return 'bg-amber-500';
    return 'bg-green-500';
  };

  return (
    <div className={`border rounded-lg shadow-sm overflow-hidden flex flex-col transition-all duration-300 relative ${cardBg} ${flashType === 'success' ? 'animate-flash-success' : flashType === 'error' ? 'animate-flash-error' : ''}`}>
      <div className={`px-3 py-2 flex justify-between items-center border-b ${headerBg}`}>
        <div className="flex items-center gap-2 overflow-hidden flex-1">
           <div className={`w-2 h-2 rounded-full ${getStatusColor()} border border-black/10 shadow-sm shrink-0`}></div>
           <input 
              type="text" 
              value={node.customName ?? node.ip} 
              onChange={(e) => onUpdateName(node.id, e.target.value)}
              className={`text-[11px] font-bold mono tracking-tight bg-transparent outline-none w-full ${textPrimary} focus:bg-white/10 px-1 rounded`}
              title={node.hostname}
           />
        </div>
        <div className="flex gap-1 shrink-0">
          <button 
            onClick={() => onTrace(node.id)} 
            disabled={node.isTracing}
            className={`w-6 h-6 flex items-center justify-center hover:bg-indigo-600 hover:text-white rounded text-indigo-500 transition-colors ${node.isTracing ? 'opacity-50' : ''}`} 
            title="Traceroute"
          >
            <i className={`fas ${node.isTracing ? 'fa-spinner fa-spin' : 'fa-route'} text-[10px]`}></i>
          </button>
          <button onClick={() => onOpenGraph(node.id)} className="w-6 h-6 flex items-center justify-center hover:bg-blue-600 hover:text-white rounded text-blue-500 transition-colors" title="Detailed Analysis">
            <i className="fas fa-chart-line text-[10px]"></i>
          </button>
          <button onClick={() => onToggle(node.id)} className={`w-6 h-6 flex items-center justify-center hover:bg-slate-400/20 rounded transition-colors ${node.isMonitoring ? 'text-amber-500' : 'text-green-500'}`} title={node.isMonitoring ? "Pause Tracking" : "Start Tracking"}>
            <i className={`fas ${node.isMonitoring ? 'fa-pause' : 'fa-play'} text-[10px]`}></i>
          </button>
          <button onClick={() => onRemove(node.id)} className="w-6 h-6 flex items-center justify-center hover:bg-red-500 hover:text-white rounded text-red-500 transition-colors" title="Delete Node">
            <i className="fas fa-times text-[10px]"></i>
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col">
            <span className="text-[8px] text-slate-500 uppercase font-bold tracking-widest mb-1">Status</span>
            <span className={`text-xs font-bold mono ${isIdle ? 'text-slate-500' : isDown ? 'text-red-500' : 'text-green-500'}`}>
              {isIdle ? 'IDLE' : isDown ? 'UNREACHABLE' : 'ONLINE'}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[8px] text-slate-500 uppercase font-bold tracking-widest mb-1">Latency</span>
            <span className={`text-sm font-bold mono ${isDown ? 'text-red-500' : 'text-blue-500'}`}>
              {isIdle ? '--' : isDown ? 'LOSS' : `${node.curRtt.toFixed(1)}ms`}
            </span>
          </div>
        </div>
        
        <div className="space-y-1 border-t border-slate-500/10 pt-2">
          <div className="flex justify-between items-center text-[9px] opacity-70">
            <span className="text-slate-500 uppercase font-bold tracking-tighter">Last Response:</span>
            <span className={`mono font-bold ${textPrimary}`}>{formattedLastSeen}</span>
          </div>
          <div className="flex justify-between items-center text-[8px] opacity-50">
            <span className="text-slate-500 uppercase font-bold tracking-tighter">Total Packets:</span>
            <span className={`mono ${textPrimary}`}>S:{node.sent} | R:{node.received}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 border-t pt-3 border-slate-500/10">
          <div className="text-center"><span className="block text-[7px] text-slate-400 uppercase font-bold">Min</span><span className={`text-[10px] mono ${textPrimary}`}>{node.minRtt === Infinity ? '--' : node.minRtt.toFixed(1)}</span></div>
          <div className="text-center"><span className="block text-[7px] text-slate-400 uppercase font-bold">Avg</span><span className={`text-[10px] mono ${textPrimary}`}>{node.avgRtt === 0 ? '--' : node.avgRtt.toFixed(1)}</span></div>
          <div className="text-center"><span className="block text-[7px] text-slate-400 uppercase font-bold">Loss</span><span className={`text-[10px] mono ${node.packetLoss > 0 ? 'text-red-500 font-bold' : 'text-slate-500'}`}>{node.packetLoss.toFixed(1)}%</span></div>
        </div>

        {/* Collapsible Traceroute Section */}
        {(node.hops || node.isTracing) && (
          <div className={`mt-2 rounded border overflow-hidden transition-all ${theme === 'dark' ? 'border-slate-700 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}>
            <button 
              onClick={() => setShowHops(!showHops)}
              className="w-full px-2 py-1 flex justify-between items-center text-[8px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-500/5 transition-colors"
            >
              <span className="flex items-center gap-2">
                Traceroute Analysis 
                {node.isTracing && (
                  <span className="text-blue-500 font-mono lowercase">({traceDuration}s elapsed)</span>
                )}
              </span>
              <i className={`fas fa-chevron-${showHops ? 'up' : 'down'}`}></i>
            </button>
            {showHops && (
              <div className="p-1 max-h-32 overflow-y-auto">
                <table className="w-full text-[8px] mono">
                  <tbody>
                    {node.hops?.map(hop => (
                      <tr key={hop.number} className="border-b border-slate-500/5 last:border-0">
                        <td className="py-0.5 text-indigo-500 font-bold w-4">{hop.number}</td>
                        <td className={`py-0.5 truncate max-w-[80px] ${textPrimary}`}>{hop.ip}</td>
                        <td className="py-0.5 text-right font-bold text-slate-500">{hop.cur.toFixed(0)}ms</td>
                      </tr>
                    ))}
                    {node.isTracing && !node.hops && (
                      <tr><td className="py-2 text-center text-slate-500 italic">Probing hops...</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <button onClick={() => onOpenGraph(node.id)} className={`w-full py-2 rounded border-2 border-dashed transition-all flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest ${theme === 'dark' ? 'border-slate-700 text-slate-500 hover:border-blue-500 hover:text-blue-500' : 'border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-400'}`}>
          <i className="fas fa-chart-area"></i> Open Focus View
        </button>
      </div>
    </div>
  );
};
