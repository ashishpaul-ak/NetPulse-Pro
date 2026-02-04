
export type ConnectionStatus = 'alive' | 'dead' | 'unstable' | 'unknown';

export interface Hop {
  number: number;
  ip: string;
  name: string;
  avg: number;
  min: number;
  cur: number;
  pl: number;
}

export interface PingResult {
  timestamp: number;
  rtt: number;
  status: ConnectionStatus;
}

export interface DowntimeEvent {
  id: string;
  startTime: number;
  endTime?: number;
  lostCount: number;
}

export interface StatusColors {
  alive: string;
  unstable: string;
  dead: string;
}

export interface IPNode {
  id: string;
  label: string;
  ip: string;
  hostname: string;
  customName?: string;
  isResolving: boolean;
  history: PingResult[];
  downtimeEvents: DowntimeEvent[];
  minRtt: number;
  maxRtt: number;
  avgRtt: number;
  curRtt: number;
  sent: number;
  received: number;
  lost: number;
  packetLoss: number;
  isMonitoring: boolean;
  isGraphed: boolean;
  hops?: Hop[];
  isTracing?: boolean;
}

export interface MonitorSettings {
  interval: number; // in seconds
  warningThreshold: number; // in ms
  timeframe: number; // in minutes (History retention)
  statusColors: StatusColors;
}
