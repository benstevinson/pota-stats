// Types
export type {
  PotaStats,
  ModeData,
  BandData,
  CategoryBreakdown,
  HourlyManifestEntry,
  DailyManifestEntry,
  MonthlyManifestEntry,
  Manifest,
  GroupBy,
  TimeRange,
  TrendPeriod,
  ActivatorTrendData,
  ActivatorByModeTrendData,
  TopParkData,
  TopStateData,
} from './types';

// Constants
export {
  BAND_ORDER,
  TIME_RANGE_HOURS,
} from './constants';

// Queries
export {
  getStats,
  getModeData,
  getBandData,
  getCategoryBreakdown,
  getActivatorTrend,
  getActivatorByModeTrend,
  getTopParks,
  getTopStates,
  getTimeOfDayActivity,
} from './queries';
export type { TimeOfDayData } from './queries';

// Data loading
export {
  initDuckDB,
  loadManifest,
  filterManifestByTimeRange,
  filterManifestByTimeRangeWithLevel,
  loadDataIntoView,
  getTrendTimeRange,
} from './data';
export type { DuckDBInstance, LoadedData, FilteredManifestResult, RollupLevel, FilterManifestOptions } from './data';
