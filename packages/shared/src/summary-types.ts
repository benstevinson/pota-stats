export interface AllTimeSummary {
  updated_at: string;
  total_spots: number;
  total_activations: number;
  unique_activators: number;
  unique_parks: number;
  data_since: string;
}

export interface ModeStats {
  mode: string;
  spots: number;
  activations: number;
  activators: number;
  parks: number;
}

export interface BandStats {
  band: string;
  spots: number;
  activations: number;
  activators: number;
  parks: number;
}

export interface EntityStats {
  entity: string;
  spots: number;
  activations: number;
  activators: number;
  parks: number;
}

export interface PeriodStats {
  updated_at: string;
  period: string;
  total_spots: number;
  total_activations: number;
  unique_activators: number;
  unique_parks: number;
  by_mode: ModeStats[];
  by_band: BandStats[];
  by_entity: EntityStats[];
}

export interface TrendDataPoint {
  period: string;
  activators: number;
  cw: number;
  ssb: number;
  digital: number;
}

export interface TrendsSummary {
  updated_at: string;
  daily: TrendDataPoint[];
  weekly: TrendDataPoint[];
  monthly: TrendDataPoint[];
}

export interface TimeOfDaySummary {
  updated_at: string;
  hours: { hour: number; spots: number }[];
}

export interface DayOfWeekSummary {
  updated_at: string;
  days: { day: number; spots: number }[];
}

export interface TopEntitiesSummary {
  updated_at: string;
  top_parks: { reference: string; activators: number }[];
  top_states: { state: string; activators: number }[];
}
