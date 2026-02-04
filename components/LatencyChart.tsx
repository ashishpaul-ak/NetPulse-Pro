
import React, { useMemo } from 'react';
import { 
  ComposedChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine, 
  ReferenceArea
} from 'recharts';
import { PingResult, ConnectionStatus, StatusColors, DowntimeEvent } from '../types';

interface LatencyChartProps {
  data: PingResult[];
  downtimeEvents?: DowntimeEvent[];
  threshold: number;
  filterStatus?: ConnectionStatus | 'all';
  statusColors?: StatusColors;
}

export const LatencyChart: React.FC<LatencyChartProps> = ({ 
  data, 
  downtimeEvents = [],
  threshold, 
  filterStatus = 'all',
  statusColors = { alive: '#10b981', unstable: '#f59e0b', dead: '#ef4444' }
}) => {
  const chartData = useMemo(() => {
    return data.map((d, i) => {
      const matchesFilter = filterStatus === 'all' || d.status === filterStatus;
      const isDead = d.status === 'dead';
      
      const rtt = (!matchesFilter) ? null : (isDead ? 0.1 : d.rtt);
      
      return {
        index: i,
        timestamp: d.timestamp,
        time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        rtt: rtt,
        status: d.status,
        matchesFilter,
        isDead
      };
    });
  }, [data, filterStatus]);

  const { minIdx, maxIdx, minVal, maxVal } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    let minI = -1;
    let maxI = -1;
    
    chartData.forEach((d, i) => {
      if (d.rtt !== null && d.matchesFilter && !d.isDead) {
        if (d.rtt < min) { min = d.rtt; minI = i; }
        if (d.rtt > max) { max = d.rtt; maxI = i; }
      }
    });
    
    return { 
      minIdx: minI, 
      maxIdx: maxI, 
      minVal: min === Infinity ? 0 : min, 
      maxVal: max === -Infinity ? 0 : max 
    };
  }, [chartData]);

  const RenderCustomDot = (props: any) => {
    const { cx, cy, payload, index } = props;
    if (!payload.matchesFilter) return null;
    
    if (payload.isDead) {
      return (
        <g transform={`translate(${cx}, ${cy})`}>
          <line x1="-3" y1="-3" x2="3" y2="3" stroke={statusColors.dead} strokeWidth="1" />
          <line x1="3" y1="-3" x2="-3" y2="3" stroke={statusColors.dead} strokeWidth="1" />
        </g>
      );
    }

    if (index === minIdx) {
      return (
        <g>
          <circle cx={cx} cy={cy} r={5} fill={statusColors.alive} stroke="#fff" strokeWidth={2} filter="drop-shadow(0 2px 2px rgba(0,0,0,0.2))" />
        </g>
      );
    }
    if (index === maxIdx) {
      return (
        <g>
          <circle cx={cx} cy={cy} r={5} fill={statusColors.dead} stroke="#fff" strokeWidth={2} filter="drop-shadow(0 2px 2px rgba(0,0,0,0.2))" />
        </g>
      );
    }
    return <circle cx={cx} cy={cy} r={2} fill="#334155" />;
  };

  // Convert downtime timestamps to chart time labels for ReferenceArea
  const renderedDowntimeBands = useMemo(() => {
    return downtimeEvents.map(event => {
      const startPoint = chartData.find(d => d.timestamp >= event.startTime);
      const endPoint = event.endTime ? chartData.find(d => d.timestamp >= event.endTime) : chartData[chartData.length - 1];
      
      if (!startPoint || !endPoint) return null;

      return (
        <ReferenceArea 
          key={event.id}
          x1={startPoint.time}
          x2={endPoint.time}
          fill={statusColors.dead}
          fillOpacity={0.2}
          stroke={statusColors.dead}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      );
    }).filter(Boolean);
  }, [downtimeEvents, chartData, statusColors.dead]);

  return (
    <div className="h-48 w-full mt-2 bg-[#f8fafc] rounded-lg border border-slate-300 overflow-hidden shadow-inner relative">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 25, right: 60, left: -20, bottom: 5 }}>
          <defs>
            <linearGradient id="gradAlive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={statusColors.alive} stopOpacity={0.15}/>
              <stop offset="95%" stopColor={statusColors.alive} stopOpacity={0.05}/>
            </linearGradient>
            <linearGradient id="gradUnstable" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={statusColors.unstable} stopOpacity={0.15}/>
              <stop offset="95%" stopColor={statusColors.unstable} stopOpacity={0.05}/>
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#e2e8f0" />
          
          <ReferenceArea y1={0} y2={threshold} fill="url(#gradAlive)" isFront={false} />
          <ReferenceArea y1={threshold} y2={threshold + 100} fill="url(#gradUnstable)" isFront={false} />

          {/* Downtime Highlight Regions */}
          {renderedDowntimeBands}

          {/* Explicit Threshold Line */}
          <ReferenceLine 
            y={threshold} 
            stroke={statusColors.unstable} 
            strokeWidth={1.5} 
            strokeDasharray="5 5"
            label={{ 
              position: 'insideBottomRight', 
              value: `WARN: ${threshold}ms`, 
              fill: statusColors.unstable, 
              fontSize: 8, 
              fontWeight: 'bold',
              dy: -2
            }} 
          />

          {minVal > 0 && (
            <ReferenceLine 
              y={minVal} 
              stroke={statusColors.alive} 
              strokeDasharray="4 4" 
              label={{ 
                position: 'right', 
                value: `MIN: ${minVal.toFixed(1)}ms`, 
                fill: statusColors.alive, 
                fontSize: 9, 
                fontWeight: 'bold',
                dx: 5
              }} 
            />
          )}
          {maxVal > 0 && (
            <ReferenceLine 
              y={maxVal} 
              stroke={statusColors.dead} 
              strokeDasharray="4 4" 
              label={{ 
                position: 'right', 
                value: `MAX: ${maxVal.toFixed(1)}ms`, 
                fill: statusColors.dead, 
                fontSize: 9, 
                fontWeight: 'bold',
                dx: 5
              }} 
            />
          )}

          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 8, fill: '#64748b' }} 
            interval="preserveStartEnd"
            minTickGap={40}
            axisLine={{ stroke: '#cbd5e1' }}
          />
          <YAxis 
            domain={[0, (dataMax: number) => Math.max(150, Math.ceil((dataMax + 20) / 50) * 50)]} 
            stroke="#64748b" 
            fontSize={9} 
            axisLine={false}
            tickLine={false}
          />
          
          <Tooltip 
            contentStyle={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '10px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            cursor={{ stroke: '#94a3b8', strokeWidth: 1 }}
          />

          <Line 
            name="RTT"
            type="monotone" 
            dataKey="rtt" 
            stroke="#1e293b" 
            strokeWidth={2} 
            dot={<RenderCustomDot />}
            activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff', fill: '#2563eb' }}
            isAnimationActive={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
      
      <div className="absolute top-1 left-2 flex gap-3 pointer-events-none">
        {minVal > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColors.alive }}></div>
            <span className="text-[8px] font-bold uppercase" style={{ color: statusColors.alive }}>Min: {minVal.toFixed(1)}ms</span>
          </div>
        )}
        {maxVal > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColors.dead }}></div>
            <span className="text-[8px] font-bold uppercase" style={{ color: statusColors.dead }}>Max: {maxVal.toFixed(1)}ms</span>
          </div>
        )}
        {filterStatus !== 'all' && (
          <div className="flex items-center gap-1 ml-2 px-1 bg-blue-500/10 rounded">
            <span className="text-[8px] font-black text-blue-600 uppercase">Filtering: {filterStatus}</span>
          </div>
        )}
      </div>
    </div>
  );
};
