import type { StockData } from "@/api/stocks";

export type JobStatus = 'idle' | 'running' | 'failed';

export interface JobProgress {
  completed: number;
  total: number;
  startedAt: string;
  estimatedMinutes: number;
}

export interface SnapshotEntry extends StockData {
}

export interface StockPosition {
  ticker: string;
  x: number;
  y: number;
  radius: number; // Hit detection radius
  data: StockData;
}

export interface CanvasConfig {
  centerX: number;
  centerY: number;
  maxRadius: number;
  yieldRanges: number[];
}

export interface Sector {
  name: string;
  color: string;
}

export interface SectorAngles {
  start: number;
  end: number;
  mid: number;
}