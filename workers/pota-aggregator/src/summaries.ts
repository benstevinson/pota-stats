/**
 * Pre-computed summary generation for POTA stats
 *
 * Generates lightweight JSON files that power the frontend charts
 * without requiring the client to download full aggregated data.
 */

import { Result, ok, err } from 'neverthrow';

// ============================================================================
// Types
// ============================================================================

interface BaseAggregate {
  mode: string;
  band: string;
  entity: string;
  spot_count: number;
  activation_count: number;
  unique_activators: number;
  unique_parks: number;
  activators: string[];
  parks: string[];
  activations: string[];
  state_activators: string[];
}

interface HourlyAggregate extends BaseAggregate {
  hour: string;
}

interface DailyAggregate extends BaseAggregate {
  date: string;
}

type SummaryError =
  | { type: 'LIST_ERROR'; message: string }
  | { type: 'READ_ERROR'; message: string }
  | { type: 'STORAGE_ERROR'; message: string };

// ============================================================================
// Summary Schemas
// ============================================================================

interface AllTimeSummary {
  updated_at: string;
  total_spots: number;
  total_activations: number;
  unique_activators: number;
  unique_parks: number;
  data_since: string;
}

interface ModeStats {
  mode: string;
  spots: number;
  activations: number;
  activators: number;
  parks: number;
}

interface BandStats {
  band: string;
  spots: number;
  activations: number;
  activators: number;
  parks: number;
}

interface EntityStats {
  entity: string;
  spots: number;
  activations: number;
  activators: number;
  parks: number;
}

interface PeriodStats {
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

interface TrendDataPoint {
  period: string;
  activators: number;
  cw: number;
  ssb: number;
  digital: number;
}

interface TrendsSummary {
  updated_at: string;
  daily: TrendDataPoint[];
  weekly: TrendDataPoint[];
  monthly: TrendDataPoint[];
}

interface TimeOfDaySummary {
  updated_at: string;
  hours: { hour: number; spots: number }[];
}

interface DayOfWeekSummary {
  updated_at: string;
  days: { day: number; spots: number }[];
}

interface TopEntitiesSummary {
  updated_at: string;
  top_parks: { reference: string; activators: number }[];
  top_states: { state: string; activators: number }[];
}

// Mode categories for trend analysis
const MODE_CATEGORIES = {
  cw: ['CW'],
  ssb: ['SSB', 'AM', 'FM', 'LSB', 'USB'],
  digital: ['FT8', 'FT4', 'RTTY', 'PSK31', 'PSK', 'JS8', 'MFSK', 'OLIVIA', 'SSTV', 'DIGITAL'],
};

function getModeCategory(mode: string): 'cw' | 'ssb' | 'digital' | null {
  const upperMode = mode.toUpperCase();
  if (MODE_CATEGORIES.cw.includes(upperMode)) return 'cw';
  if (MODE_CATEGORIES.ssb.includes(upperMode)) return 'ssb';
  if (MODE_CATEGORIES.digital.includes(upperMode)) return 'digital';
  return null;
}

// ============================================================================
// File reading helpers
// ============================================================================

async function listFiles(
  r2: R2Bucket,
  prefix: string
): Promise<Result<string[], SummaryError>> {
  try {
    const listed = await r2.list({ prefix });
    const keys = listed.objects
      .map((obj) => obj.key)
      .filter((key) => key.endsWith('.ndjson'));
    return ok(keys);
  } catch (error) {
    return err({
      type: 'LIST_ERROR',
      message: error instanceof Error ? error.message : 'Unknown list error',
    });
  }
}

async function readAggregateFile<T extends BaseAggregate>(
  r2: R2Bucket,
  key: string
): Promise<Result<T[], SummaryError>> {
  try {
    const obj = await r2.get(key);
    if (!obj) return ok([]);

    const text = await obj.text();
    const lines = text.split('\n').filter((line) => line.trim());

    const aggregates = lines.reduce<T[]>((acc, line) => {
      try {
        return [...acc, JSON.parse(line) as T];
      } catch {
        return acc;
      }
    }, []);

    return ok(aggregates);
  } catch (error) {
    return err({
      type: 'READ_ERROR',
      message: error instanceof Error ? error.message : 'Unknown read error',
    });
  }
}

async function storeSummary(
  r2: R2Bucket,
  key: string,
  data: unknown
): Promise<Result<void, SummaryError>> {
  try {
    await r2.put(key, JSON.stringify(data), {
      httpMetadata: {
        contentType: 'application/json',
        // Summaries update frequently - short cache
        cacheControl: 'public, max-age=300',
      },
    });
    return ok(undefined);
  } catch (error) {
    return err({
      type: 'STORAGE_ERROR',
      message: error instanceof Error ? error.message : 'Unknown storage error',
    });
  }
}

// ============================================================================
// Aggregation helpers
// ============================================================================

interface AggregationGroups {
  activators: Set<string>;
  parks: Set<string>;
  activations: Set<string>;
  stateActivators: Set<string>;
  totalSpots: number;
  byMode: Map<string, { spots: number; activators: Set<string>; parks: Set<string>; activations: Set<string> }>;
  byBand: Map<string, { spots: number; activators: Set<string>; parks: Set<string>; activations: Set<string> }>;
  byEntity: Map<string, { spots: number; activators: Set<string>; parks: Set<string>; activations: Set<string> }>;
  byHour: Map<number, number>;
  byDayOfWeek: Map<number, number>;
}

function createEmptyGroups(): AggregationGroups {
  return {
    activators: new Set(),
    parks: new Set(),
    activations: new Set(),
    stateActivators: new Set(),
    totalSpots: 0,
    byMode: new Map(),
    byBand: new Map(),
    byEntity: new Map(),
    byHour: new Map(),
    byDayOfWeek: new Map(),
  };
}

function mergeIntoGroups(groups: AggregationGroups, aggregates: BaseAggregate[], timestamp?: string): void {
  aggregates.forEach((agg) => {
    groups.totalSpots += agg.spot_count;
    agg.activators.forEach((a) => groups.activators.add(a));
    agg.parks.forEach((p) => groups.parks.add(p));
    agg.activations.forEach((act) => groups.activations.add(act));
    (agg.state_activators ?? []).forEach((sa) => groups.stateActivators.add(sa));

    // By mode
    const modeGroup = groups.byMode.get(agg.mode) ?? {
      spots: 0,
      activators: new Set<string>(),
      parks: new Set<string>(),
      activations: new Set<string>(),
    };
    modeGroup.spots += agg.spot_count;
    agg.activators.forEach((a) => modeGroup.activators.add(a));
    agg.parks.forEach((p) => modeGroup.parks.add(p));
    agg.activations.forEach((act) => modeGroup.activations.add(act));
    groups.byMode.set(agg.mode, modeGroup);

    // By band
    const bandGroup = groups.byBand.get(agg.band) ?? {
      spots: 0,
      activators: new Set<string>(),
      parks: new Set<string>(),
      activations: new Set<string>(),
    };
    bandGroup.spots += agg.spot_count;
    agg.activators.forEach((a) => bandGroup.activators.add(a));
    agg.parks.forEach((p) => bandGroup.parks.add(p));
    agg.activations.forEach((act) => bandGroup.activations.add(act));
    groups.byBand.set(agg.band, bandGroup);

    // By entity (top 20 only)
    const entityGroup = groups.byEntity.get(agg.entity) ?? {
      spots: 0,
      activators: new Set<string>(),
      parks: new Set<string>(),
      activations: new Set<string>(),
    };
    entityGroup.spots += agg.spot_count;
    agg.activators.forEach((a) => entityGroup.activators.add(a));
    agg.parks.forEach((p) => entityGroup.parks.add(p));
    agg.activations.forEach((act) => entityGroup.activations.add(act));
    groups.byEntity.set(agg.entity, entityGroup);

    // By hour (for time of day chart)
    if (timestamp) {
      const hour = new Date(timestamp).getUTCHours();
      groups.byHour.set(hour, (groups.byHour.get(hour) ?? 0) + agg.spot_count);

      // By day of week
      const dayOfWeek = new Date(timestamp).getUTCDay();
      groups.byDayOfWeek.set(dayOfWeek, (groups.byDayOfWeek.get(dayOfWeek) ?? 0) + agg.spot_count);
    }
  });
}

function groupsToPeriodStats(groups: AggregationGroups, period: string): PeriodStats {
  const byMode: ModeStats[] = Array.from(groups.byMode.entries())
    .map(([mode, g]) => ({
      mode,
      spots: g.spots,
      activations: g.activations.size,
      activators: g.activators.size,
      parks: g.parks.size,
    }))
    .sort((a, b) => b.spots - a.spots);

  const byBand: BandStats[] = Array.from(groups.byBand.entries())
    .map(([band, g]) => ({
      band,
      spots: g.spots,
      activations: g.activations.size,
      activators: g.activators.size,
      parks: g.parks.size,
    }))
    .sort((a, b) => b.spots - a.spots);

  const byEntity: EntityStats[] = Array.from(groups.byEntity.entries())
    .map(([entity, g]) => ({
      entity,
      spots: g.spots,
      activations: g.activations.size,
      activators: g.activators.size,
      parks: g.parks.size,
    }))
    .sort((a, b) => b.activations - a.activations)
    .slice(0, 20);

  return {
    updated_at: new Date().toISOString(),
    period,
    total_spots: groups.totalSpots,
    total_activations: groups.activations.size,
    unique_activators: groups.activators.size,
    unique_parks: groups.parks.size,
    by_mode: byMode,
    by_band: byBand,
    by_entity: byEntity,
  };
}

// ============================================================================
// Main summary generation functions
// ============================================================================

export async function generateAllSummaries(r2: R2Bucket): Promise<void> {
  const now = new Date();
  console.log('[SUMMARIES] Starting summary generation...');

  // Load manifest to get file lists
  const manifestObj = await r2.get('manifest.json');
  if (!manifestObj) {
    console.error('[SUMMARIES] No manifest found');
    return;
  }

  const manifest = JSON.parse(await manifestObj.text()) as {
    hourly: { hour: string; path: string }[];
    daily: { day: string; path: string }[];
    monthly: { month: string; path: string }[];
  };

  // Calculate time boundaries
  // Round down to start of hour to include complete hours in the window
  const now24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  now24h.setMinutes(0, 0, 0);
  const now7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  now7d.setHours(0, 0, 0, 0); // Round to start of day
  const now30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  now30d.setHours(0, 0, 0, 0);
  const now14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  now14d.setHours(0, 0, 0, 0);

  // Filter files by time range
  const hourlyFiles24h = manifest.hourly.filter((h) => new Date(h.hour) >= now24h);
  const dailyFiles7d = manifest.daily.filter((d) => new Date(d.day) >= now7d);
  const dailyFiles30d = manifest.daily.filter((d) => new Date(d.day) >= now30d);
  const dailyFiles14d = manifest.daily.filter((d) => new Date(d.day) >= now14d);
  const allDailyFiles = manifest.daily;
  const allMonthlyFiles = manifest.monthly;

  // ========================================
  // Generate 24h stats (uses hourly data)
  // ========================================
  console.log(`[SUMMARIES] Generating 24h stats from ${hourlyFiles24h.length} hourly files...`);
  const groups24h = createEmptyGroups();

  for (const file of hourlyFiles24h) {
    const result = await readAggregateFile<HourlyAggregate>(r2, file.path);
    if (result.isOk()) {
      mergeIntoGroups(groups24h, result.value, file.hour);
    }
  }

  const stats24h = groupsToPeriodStats(groups24h, '24h');
  await storeSummary(r2, 'summaries/stats_24h.json', stats24h);
  console.log(`[SUMMARIES] 24h stats: ${stats24h.total_spots} spots, ${stats24h.unique_activators} activators`);

  // Generate time of day from 24h hourly data
  const timeOfDay: TimeOfDaySummary = {
    updated_at: new Date().toISOString(),
    hours: Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      spots: groups24h.byHour.get(i) ?? 0,
    })),
  };
  await storeSummary(r2, 'summaries/time_of_day.json', timeOfDay);
  console.log('[SUMMARIES] Time of day generated');

  // ========================================
  // Generate 7d stats (uses daily data)
  // ========================================
  console.log(`[SUMMARIES] Generating 7d stats from ${dailyFiles7d.length} daily files...`);
  const groups7d = createEmptyGroups();

  for (const file of dailyFiles7d) {
    const result = await readAggregateFile<DailyAggregate>(r2, file.path);
    if (result.isOk()) {
      mergeIntoGroups(groups7d, result.value, file.day);
    }
  }

  const stats7d = groupsToPeriodStats(groups7d, '7d');
  await storeSummary(r2, 'summaries/stats_7d.json', stats7d);
  console.log(`[SUMMARIES] 7d stats: ${stats7d.total_spots} spots, ${stats7d.unique_activators} activators`);

  // Generate day of week from 7d+ data
  const dayOfWeek: DayOfWeekSummary = {
    updated_at: new Date().toISOString(),
    days: Array.from({ length: 7 }, (_, i) => ({
      day: i,
      spots: groups7d.byDayOfWeek.get(i) ?? 0,
    })),
  };
  await storeSummary(r2, 'summaries/day_of_week.json', dayOfWeek);
  console.log('[SUMMARIES] Day of week generated');

  // ========================================
  // Generate 30d stats
  // ========================================
  console.log(`[SUMMARIES] Generating 30d stats from ${dailyFiles30d.length} daily files...`);
  const groups30d = createEmptyGroups();

  for (const file of dailyFiles30d) {
    const result = await readAggregateFile<DailyAggregate>(r2, file.path);
    if (result.isOk()) {
      mergeIntoGroups(groups30d, result.value, file.day);
    }
  }

  const stats30d = groupsToPeriodStats(groups30d, '30d');
  await storeSummary(r2, 'summaries/stats_30d.json', stats30d);
  console.log(`[SUMMARIES] 30d stats: ${stats30d.total_spots} spots, ${stats30d.unique_activators} activators`);

  // ========================================
  // Generate all-time stats
  // ========================================
  console.log(`[SUMMARIES] Generating all-time stats...`);
  const groupsAllTime = createEmptyGroups();
  let earliestDate = '';

  // Use monthly files for bulk of data
  for (const file of allMonthlyFiles) {
    const result = await readAggregateFile<BaseAggregate>(r2, file.path);
    if (result.isOk()) {
      mergeIntoGroups(groupsAllTime, result.value);
    }
    if (!earliestDate || file.month < earliestDate) {
      earliestDate = file.month;
    }
  }

  // Add daily files not covered by monthly (current month)
  const coveredMonths = new Set(allMonthlyFiles.map((m) => m.month));
  for (const file of allDailyFiles) {
    const fileMonth = file.day.slice(0, 7);
    if (!coveredMonths.has(fileMonth)) {
      const result = await readAggregateFile<DailyAggregate>(r2, file.path);
      if (result.isOk()) {
        mergeIntoGroups(groupsAllTime, result.value);
      }
      if (!earliestDate || file.day < earliestDate) {
        earliestDate = file.day;
      }
    }
  }

  // Add hourly files for today (not in daily yet)
  const todayStr = now.toISOString().slice(0, 10);
  const coveredDays = new Set(allDailyFiles.map((d) => d.day));
  for (const file of manifest.hourly) {
    const fileDay = file.hour.slice(0, 10);
    if (!coveredDays.has(fileDay)) {
      const result = await readAggregateFile<HourlyAggregate>(r2, file.path);
      if (result.isOk()) {
        mergeIntoGroups(groupsAllTime, result.value);
      }
    }
  }

  const allTime: AllTimeSummary = {
    updated_at: new Date().toISOString(),
    total_spots: groupsAllTime.totalSpots,
    total_activations: groupsAllTime.activations.size,
    unique_activators: groupsAllTime.activators.size,
    unique_parks: groupsAllTime.parks.size,
    data_since: earliestDate,
  };
  await storeSummary(r2, 'summaries/all_time.json', allTime);
  console.log(`[SUMMARIES] All-time stats: ${allTime.total_spots} spots, ${allTime.unique_activators} activators`);

  // ========================================
  // Generate trends (14 daily, 14 weekly, 12 monthly)
  // ========================================
  console.log('[SUMMARIES] Generating trends...');

  // Daily trends from last 14 days
  const dailyTrends: TrendDataPoint[] = [];
  for (const file of dailyFiles14d.slice(0, 14)) {
    const result = await readAggregateFile<DailyAggregate>(r2, file.path);
    if (result.isOk()) {
      const activators = new Set<string>();
      const cwActivators = new Set<string>();
      const ssbActivators = new Set<string>();
      const digitalActivators = new Set<string>();

      result.value.forEach((agg) => {
        agg.activators.forEach((a) => activators.add(a));
        const category = getModeCategory(agg.mode);
        if (category === 'cw') agg.activators.forEach((a) => cwActivators.add(a));
        if (category === 'ssb') agg.activators.forEach((a) => ssbActivators.add(a));
        if (category === 'digital') agg.activators.forEach((a) => digitalActivators.add(a));
      });

      dailyTrends.push({
        period: file.day,
        activators: activators.size,
        cw: cwActivators.size,
        ssb: ssbActivators.size,
        digital: digitalActivators.size,
      });
    }
  }

  // Weekly trends (aggregate by week)
  const weeklyTrends: TrendDataPoint[] = [];
  const weeklyGroups = new Map<string, { activators: Set<string>; cw: Set<string>; ssb: Set<string>; digital: Set<string> }>();

  for (const file of allDailyFiles) {
    const date = new Date(file.day);
    // Get week start (Sunday)
    const weekStart = new Date(date);
    weekStart.setUTCDate(date.getUTCDate() - date.getUTCDay());
    const weekKey = weekStart.toISOString().slice(0, 10);

    const result = await readAggregateFile<DailyAggregate>(r2, file.path);
    if (result.isOk()) {
      const week = weeklyGroups.get(weekKey) ?? {
        activators: new Set<string>(),
        cw: new Set<string>(),
        ssb: new Set<string>(),
        digital: new Set<string>(),
      };

      result.value.forEach((agg) => {
        agg.activators.forEach((a) => week.activators.add(a));
        const category = getModeCategory(agg.mode);
        if (category === 'cw') agg.activators.forEach((a) => week.cw.add(a));
        if (category === 'ssb') agg.activators.forEach((a) => week.ssb.add(a));
        if (category === 'digital') agg.activators.forEach((a) => week.digital.add(a));
      });

      weeklyGroups.set(weekKey, week);
    }
  }

  Array.from(weeklyGroups.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 14)
    .forEach(([week, data]) => {
      weeklyTrends.push({
        period: week,
        activators: data.activators.size,
        cw: data.cw.size,
        ssb: data.ssb.size,
        digital: data.digital.size,
      });
    });

  // Monthly trends from monthly files
  const monthlyTrends: TrendDataPoint[] = [];
  for (const file of allMonthlyFiles.slice(0, 12)) {
    const result = await readAggregateFile<BaseAggregate>(r2, file.path);
    if (result.isOk()) {
      const activators = new Set<string>();
      const cwActivators = new Set<string>();
      const ssbActivators = new Set<string>();
      const digitalActivators = new Set<string>();

      result.value.forEach((agg) => {
        agg.activators.forEach((a) => activators.add(a));
        const category = getModeCategory(agg.mode);
        if (category === 'cw') agg.activators.forEach((a) => cwActivators.add(a));
        if (category === 'ssb') agg.activators.forEach((a) => ssbActivators.add(a));
        if (category === 'digital') agg.activators.forEach((a) => digitalActivators.add(a));
      });

      monthlyTrends.push({
        period: file.month,
        activators: activators.size,
        cw: cwActivators.size,
        ssb: ssbActivators.size,
        digital: digitalActivators.size,
      });
    }
  }

  const trends: TrendsSummary = {
    updated_at: new Date().toISOString(),
    daily: dailyTrends.reverse(),
    weekly: weeklyTrends.reverse(),
    monthly: monthlyTrends.reverse(),
  };
  await storeSummary(r2, 'summaries/trends.json', trends);
  console.log(`[SUMMARIES] Trends: ${dailyTrends.length} daily, ${weeklyTrends.length} weekly, ${monthlyTrends.length} monthly`);

  // ========================================
  // Generate top entities (parks/states) from 14d data
  // ========================================
  console.log('[SUMMARIES] Generating top entities...');

  // Use 14d data for top entities
  const parkActivators = new Map<string, Set<string>>();
  const stateActivators = new Map<string, Set<string>>();

  for (const file of dailyFiles14d) {
    const result = await readAggregateFile<DailyAggregate>(r2, file.path);
    if (result.isOk()) {
      result.value.forEach((agg) => {
        // Parse activations to get park -> activators
        agg.activations.forEach((activation) => {
          const [activator, park] = activation.split('|');
          if (park && activator) {
            const set = parkActivators.get(park) ?? new Set();
            set.add(activator);
            parkActivators.set(park, set);
          }
        });

        // Parse state_activators
        (agg.state_activators ?? []).forEach((sa) => {
          const [state, activator] = sa.split('|');
          if (state && activator) {
            const set = stateActivators.get(state) ?? new Set();
            set.add(activator);
            stateActivators.set(state, set);
          }
        });
      });
    }
  }

  const topParks = Array.from(parkActivators.entries())
    .map(([reference, activators]) => ({ reference, activators: activators.size }))
    .sort((a, b) => b.activators - a.activators)
    .slice(0, 10);

  const topStates = Array.from(stateActivators.entries())
    .map(([state, activators]) => ({ state, activators: activators.size }))
    .sort((a, b) => b.activators - a.activators)
    .slice(0, 10);

  const topEntities: TopEntitiesSummary = {
    updated_at: new Date().toISOString(),
    top_parks: topParks,
    top_states: topStates,
  };
  await storeSummary(r2, 'summaries/top_entities.json', topEntities);
  console.log(`[SUMMARIES] Top entities: ${topParks.length} parks, ${topStates.length} states`);

  console.log('[SUMMARIES] All summaries generated successfully!');
}
