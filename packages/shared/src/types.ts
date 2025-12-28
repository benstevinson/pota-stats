export interface PotaStats {
  totalSpots: number;
  totalActivations: number;
  uniqueActivators: number;
  uniqueParks: number;
}

export interface ModeData {
  mode: string;
  count: number;
}

export interface BandData {
  band: string;
  count: number;
}

export interface CategoryBreakdown {
  category: string;
  activations: number;
  spots: number;
  activators: number;
  parks: number;
}

export interface HourlyManifestEntry {
  hour: string;
  path: string;
  total_spots: number;
  total_activations: number;
}

export interface DailyManifestEntry {
  day: string;
  path: string;
  total_spots: number;
  total_activations: number;
}

export interface MonthlyManifestEntry {
  month: string;
  path: string;
  total_spots: number;
  total_activations: number;
}

export interface Manifest {
  updated_at: string;
  hourly: HourlyManifestEntry[];
  daily: DailyManifestEntry[];
  monthly: MonthlyManifestEntry[];
  // Legacy support
  hours?: HourlyManifestEntry[];
}

export type GroupBy = 'mode' | 'band' | 'entity';
export type TimeRange = '1h' | '24h' | '7d' | '30d';
export type TrendPeriod = 'daily' | 'weekly' | 'monthly';

export interface ActivatorTrendData {
  period: string;
  uniqueActivators: number;
}

export interface ActivatorByModeTrendData {
  period: string;
  cw: number;
  ssb: number;
  digital: number;
}

export interface TopParkData {
  reference: string;
  uniqueActivators: number;
}

export interface TopStateData {
  state: string;
  uniqueActivators: number;
}
