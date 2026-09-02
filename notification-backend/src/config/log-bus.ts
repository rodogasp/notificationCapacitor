import { EventEmitter } from 'node:events';

export interface BackendLogRecord {
  time: number;
  level: number;
  msg?: string;
  [key: string]: unknown;
}

const MAX_HISTORY = 200;
const history: BackendLogRecord[] = [];
export const logBus = new EventEmitter();

export function publishLog(record: BackendLogRecord): void {
  history.push(record);
  if (history.length > MAX_HISTORY) history.shift();
  logBus.emit('log', record);
}

export function recentLogs(): BackendLogRecord[] {
  return [...history];
}
