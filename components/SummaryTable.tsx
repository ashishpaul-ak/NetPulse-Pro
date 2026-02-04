
import React, { useMemo } from 'react';
import { IPNode } from '../types';

interface SummaryTableProps {
  nodes: IPNode[];
  theme: 'light' | 'dark';
  onUpdateName: (id: string, name: string) => void;
  onOpenGraph: (id: string) => void;
  onToggleMonitoring: (id: string) => void;
  onRemove: (id: string) => void;
}

export const SummaryTable: React.FC<SummaryTableProps> = ({ nodes, theme, onUpdateName, onOpenGraph, onToggleMonitoring, onRemove }) => {
  const tableClasses = theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-[#f3f4f6] border-slate-400';
  const rowClasses = theme === 'dark' ? 'border-slate-700 hover:bg-slate-700/50' : 'border-slate-200 hover:bg-blue-50/50';
  const textPrimary = theme === 'dark' ? 'text-slate-100' : 'text-slate-900';
  const textSecondary = theme === 'dark' ? 'text-slate-400' : 'text-slate-500';

  // Sort nodes by status: dead (0), unstable (1), alive (2), idle (3)
  const sortedNodes = useMemo(() => {
    return [...nodes].sort((a, b) => {
      const getStatusWeight = (node: IPNode) => {
        if (!node.isMonitoring) return 10; // Idle nodes at the very bottom
        const lastResult = node.history[node.history.length - 1];
        if (!lastResult) return 5; // No data yet
        
        switch (lastResult.status) {
          case 'dead': return 0;
          case 'unstable': return 1;
          case 'alive': return 2;
          default: return 5;
        }
      };

      const weightA = getStatusWeight(a);
      const weightB = getStatusWeight(b);

      if (weightA !== weightB) {
        return weightA - weightB;
      }
      
      // Secondary sort: IP address for consistency within the same status
      return a.ip.localeCompare(b.ip, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [nodes]);

  return (
    <div className={`border rounded shadow-inner overflow-hidden ${tableClasses}`}>
      <table className="w-full text-left border-collapse table-fixed">
        <thead>
          <tr className={`text-[10px] font-bold uppercase tracking-tighter border-b ${theme === 'dark' ? 'bg-slate-900/50 border-slate-700 text-slate-400' : 'bg-[#e5e7eb] border-slate-400 text-slate-600'}`}>
            <th className="px-2 py-2 w-10 text-center">#</th>
            <th className="px-2 py-2 w-32">IP Address</th>
            <th className="px-2 py-2 w-44">Hostname / Label</th>
            <th className="px-2 py-2 w-16 text-center">Avg</th>
            <th className="px-2 py-2 w-16 text-center">Cur</th>
            <th className="px-2 py-2 w-16 text-center">PL%</th>
            <th className="px-2 py-2">Latency Distribution (0-500ms)</th>
            <th className="px-2 py-2 text-center w-28">Actions</th>
          </tr>
        </thead>
        <tbody className={`text-[11px] mono ${theme === 'dark' ? 'bg-slate-900/30' : 'bg-white'}`}>
          {sortedNodes.map((node, idx) => {
            const lastH = node.history[node.history.length - 1];
            const isDown = lastH?.status === 'dead';
            const isIdle = !node.isMonitoring;
            
            const getPos = (ms: number) => Math.min((ms / 500) * 100, 100);
            const minPos = node.minRtt === Infinity ? 0 : getPos(node.minRtt);
            const maxPos = getPos(node.maxRtt);
            const curPos = getPos(node.curRtt);
            const avgPos = getPos(node.avgRtt);

            return (
              <tr key={node.id} className={`border-b transition-colors group ${rowClasses} ${isIdle ? 'opacity-50' : ''}`}>
                <td className="px-2 py-1.5 text-center text-slate-500 font-bold">{idx + 1}</td>
                <td className={`px-2 py-1.5 font-medium truncate ${textPrimary}`}>{node.ip}</td>
                <td className={`px-2 py-1.5 truncate ${textSecondary}`}>
                  <input 
                    type="text" 
                    value={node.customName ?? (node.isResolving ? 'Resolving...' : node.hostname)} 
                    onChange={(e) => onUpdateName(node.id, e.target.value)}
                    className={`bg-transparent outline-none w-full italic hover:bg-black/5 rounded px-1 transition-all ${textSecondary} focus:text-blue-500 focus:font-bold`}
                    placeholder="Set Name..."
                  />
                </td>
                <td className={`px-2 py-1.5 text-center ${textPrimary}`}>
                  {isDown || isIdle ? '--' : node.avgRtt.toFixed(1)}
                </td>
                <td className={`px-2 py-1.5 text-center font-bold ${isDown ? 'text-red-500' : isIdle ? 'text-slate-400' : 'text-blue-500'}`}>
                  {isIdle ? 'OFF' : isDown ? 'LOSS' : node.curRtt.toFixed(1)}
                </td>
                <td className={`px-2 py-1.5 text-center font-bold ${node.packetLoss > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                  {isIdle ? '--' : `${node.packetLoss.toFixed(1)}%`}
                </td>
                <td className="px-2 py-1.5 relative">
                  <div className={`h-4 w-full rounded-sm relative border overflow-hidden shadow-inner ${theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-100 border-slate-300'}`}>
                    {isIdle ? (
                       <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-slate-500 tracking-tighter">IDLE / PAUSED</div>
                    ) : isDown ? (
                       <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center text-[8px] font-bold text-red-500 animate-pulse">NO RESPONSE</div>
                    ) : (
                      <>
                        <div className="absolute top-0 bottom-0 left-0 w-[20%] bg-green-500/5"></div>
                        <div className="absolute top-0 bottom-0 left-[20%] w-[20%] bg-yellow-500/5"></div>
                        <div className="absolute top-0 bottom-0 left-[40%] w-[60%] bg-red-500/5"></div>
                        <div className="absolute h-0.5 bg-slate-400/50 top-1/2 -translate-y-1/2" style={{ left: `${minPos}%`, right: `${100 - maxPos}%` }}></div>
                        <div className="absolute w-1.5 h-1.5 bg-slate-700 rounded-full top-1/2 -translate-y-1/2 border border-white" style={{ left: `calc(${avgPos}% - 3px)` }}></div>
                        <div className="absolute w-2 h-3 bg-blue-600 top-1/2 -translate-y-1/2 rounded-sm border border-white shadow-sm" style={{ left: `calc(${curPos}% - 4px)` }}></div>
                      </>
                    )}
                  </div>
                </td>
                <td className="px-2 py-1.5 text-center">
                  <div className="flex justify-center gap-1">
                    <button onClick={() => onOpenGraph(node.id)} className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded-sm text-[9px] uppercase font-bold transition-all"><i className="fas fa-chart-line"></i></button>
                    <button onClick={() => onToggleMonitoring(node.id)} className={`px-2 py-0.5 rounded-sm text-[9px] uppercase font-bold transition-all border ${node.isMonitoring ? 'bg-amber-600/10 border-amber-600 text-amber-600' : 'bg-green-600/10 border-green-600 text-green-600'}`}><i className={`fas ${node.isMonitoring ? 'fa-pause' : 'fa-play'}`}></i></button>
                    <button onClick={() => onRemove(node.id)} className="bg-red-600/10 border border-red-600 text-red-600 px-2 py-0.5 rounded-sm text-[9px] uppercase font-bold transition-all hover:bg-red-600 hover:text-white"><i className="fas fa-trash"></i></button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
