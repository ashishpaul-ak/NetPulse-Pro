
import React, { useState, useMemo } from 'react';
import { IPNode, MonitorSettings, ConnectionStatus, DowntimeEvent } from '../types';
import { LatencyChart } from './LatencyChart';

interface DiagnosticPanelProps {
  node: IPNode;
  theme: 'light' | 'dark';
  settings: MonitorSettings;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMove?: (dir: 'up' | 'down') => void;
  onUpdateName: (name: string) => void;
  onClose: () => void;
  onTrace: () => void;
}

export const DiagnosticPanel: React.FC<DiagnosticPanelProps> = ({ node, theme, settings, canMoveUp, canMoveDown, onMove, onUpdateName, onClose, onTrace }) => {
  const [filterStatus, setFilterStatus] = useState<ConnectionStatus | 'all'>('all');

  const panelBg = theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300';
  const headerBg = theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200';
  const textPrimary = theme === 'dark' ? 'text-white' : 'text-slate-900';
  const textSecondary = theme === 'dark' ? 'text-slate-500' : 'text-slate-600';

  const filterButtons: { label: string; value: ConnectionStatus | 'all'; color: string }[] = [
    { label: 'All', value: 'all', color: 'text-slate-500' },
    { label: 'Alive', value: 'alive', color: 'text-green-500' },
    { label: 'Unstable', value: 'unstable', color: 'text-amber-500' },
    { label: 'Dead', value: 'dead', color: 'text-red-500' },
  ];

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const incidents = useMemo(() => {
    return [...node.downtimeEvents].reverse().slice(0, 5);
  }, [node.downtimeEvents]);

  return (
    <div className={`flex flex-col border shadow-xl rounded-xl overflow-hidden transition-all duration-300 transform animate-in zoom-in-95 ${panelBg}`}>
      <div className={`px-4 py-3 border-b flex justify-between items-center ${headerBg}`}>
        <div className="flex items-center gap-3 overflow-hidden flex-1">
           <i className="fas fa-microchip text-blue-500 text-sm"></i>
           <div className="flex flex-col flex-1">
              <input 
                type="text" 
                value={node.customName ?? node.ip} 
                onChange={(e) => onUpdateName(e.target.value)}
                className={`text-xs font-bold mono truncate bg-transparent outline-none w-full ${textPrimary} focus:bg-white/10 rounded px-1`}
              />
              <span className="text-[9px] font-bold text-blue-500/80 uppercase tracking-tighter truncate italic">[{node.hostname}]</span>
           </div>
        </div>
        <div className="flex gap-1 shrink-0">
          {onMove && (
            <>
              <button 
                onClick={() => onMove('up')} 
                disabled={!canMoveUp}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all bg-slate-500/10 text-slate-400 hover:text-blue-500 disabled:opacity-20"
                title="Move Up"
              ><i className="fas fa-arrow-up text-[10px]"></i></button>
              <button 
                onClick={() => onMove('down')} 
                disabled={!canMoveDown}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all bg-slate-500/10 text-slate-400 hover:text-blue-500 disabled:opacity-20"
                title="Move Down"
              ><i className="fas fa-arrow-down text-[10px]"></i></button>
            </>
          )}
          <button 
            onClick={onTrace} 
            disabled={node.isTracing}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all bg-slate-500/10 text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 ${node.isTracing ? 'opacity-50 cursor-wait' : ''}`}
            title="Graphical Traceroute"
          ><i className={`fas ${node.isTracing ? 'fa-spinner fa-spin' : 'fa-route'}`}></i></button>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all">
            <i className="fas fa-times"></i>
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-4 gap-2">
           {[
             { label: 'AVG RTT', value: `${node.avgRtt.toFixed(1)}ms` },
             { label: 'CUR RTT', value: `${node.curRtt.toFixed(1)}ms`, color: node.curRtt > settings.warningThreshold ? 'text-amber-500' : 'text-blue-500' },
             { label: 'LOSS', value: `${node.packetLoss.toFixed(1)}%`, color: node.packetLoss > 0 ? 'text-red-500' : 'text-green-500' },
             { label: 'JITTER', value: `${(node.maxRtt - node.minRtt).toFixed(1)}ms` }
           ].map((stat, i) => (
             <div key={i} className={`p-2 rounded-lg border flex flex-col items-center justify-center ${theme === 'dark' ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</span>
                <span className={`text-[11px] font-black mono ${stat.color || textPrimary}`}>{stat.value}</span>
             </div>
           ))}
        </div>

        {/* Chart Header with Filters */}
        <div className="flex justify-between items-center mb-1">
          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Network Latency Flow</span>
          <div className="flex gap-1 bg-slate-500/5 p-0.5 rounded-md border border-slate-500/10">
            {filterButtons.map(btn => (
              <button
                key={btn.value}
                onClick={() => setFilterStatus(btn.value)}
                className={`px-2 py-0.5 rounded text-[7px] font-bold uppercase transition-all ${filterStatus === btn.value ? 'bg-blue-600 text-white shadow-sm' : `${btn.color} hover:bg-slate-500/10`}`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        <div className={`p-1 rounded-lg border ${theme === 'dark' ? 'bg-slate-950/50 border-slate-800' : 'bg-white border-slate-100'}`}>
           <LatencyChart 
             data={node.history} 
             downtimeEvents={node.downtimeEvents}
             threshold={settings.warningThreshold} 
             filterStatus={filterStatus}
             statusColors={settings.statusColors}
           />
        </div>

        {/* Downtime Incident Log */}
        <div className={`rounded-xl border overflow-hidden ${theme === 'dark' ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className="bg-red-500/5 px-3 py-1.5 border-b border-slate-500/10 flex justify-between items-center">
               <span className="text-[9px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2">
                 <i className="fas fa-exclamation-triangle"></i> Downtime Incident Log
               </span>
            </div>
            <div className="max-h-[120px] overflow-y-auto text-[9px] mono">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-slate-500/5 backdrop-blur-sm">
                  <tr className="border-b border-slate-500/10 text-[8px] text-slate-500">
                    <th className="px-3 py-1">Time Period</th>
                    <th className="px-3 py-1">Duration</th>
                    <th className="px-3 py-1">Pings Lost</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.length > 0 ? incidents.map(event => {
                    const duration = event.endTime ? event.endTime - event.startTime : Date.now() - event.startTime;
                    return (
                      <tr key={event.id} className="border-b border-slate-500/5 hover:bg-red-500/5 transition-colors">
                        <td className="px-3 py-1.5">
                          <span className={textSecondary}>{new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                          <span className="mx-1 opacity-30">→</span>
                          <span className={event.endTime ? textSecondary : 'text-red-500 font-bold'}>{event.endTime ? new Date(event.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Ongoing...'}</span>
                        </td>
                        <td className="px-3 py-1.5 font-bold text-slate-500">{formatDuration(duration)}</td>
                        <td className="px-3 py-1.5 font-black text-red-500">{event.lostCount}</td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={3} className="py-4 text-center text-slate-500 italic">No significant downtime detected.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
        </div>

        {(node.hops || node.isTracing) && (
          <div className={`rounded-xl border overflow-hidden animate-in slide-in-from-top-4 ${theme === 'dark' ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className="bg-slate-500/5 px-3 py-1.5 border-b border-slate-500/10 flex justify-between items-center">
               <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Network Path Analysis</span>
               {node.isTracing && <i className="fas fa-sync fa-spin text-[8px] text-blue-500"></i>}
            </div>
            <div className="max-h-[150px] overflow-y-auto text-[9px] mono">
              <table className="w-full text-left">
                <tbody>
                  {node.hops?.map(hop => (
                    <tr key={hop.number} className="border-b border-slate-500/5 hover:bg-slate-500/5 transition-colors">
                      <td className="px-3 py-1.5 font-black text-blue-500 w-8">{hop.number}</td>
                      <td className="px-1 py-1.5"><div className={`font-bold ${textPrimary}`}>{hop.ip}</div><div className="text-[7px] opacity-50 truncate max-w-[150px]">{hop.name}</div></td>
                      <td className="px-2 py-1.5 text-right font-bold text-slate-500">{hop.cur.toFixed(1)}ms</td>
                      <td className="px-3 py-1.5"><div className="h-1.5 w-20 bg-slate-500/10 rounded-full overflow-hidden"><div className={`h-full transition-all duration-1000 ${hop.cur > settings.warningThreshold ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min((hop.cur/300)*100, 100)}%` }}></div></div></td>
                    </tr>
                  ))}
                  {node.isTracing && !node.hops && (<tr><td className="py-8 text-center text-slate-500 italic">Capturing ICMP flow...</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
