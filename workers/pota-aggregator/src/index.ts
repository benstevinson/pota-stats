import { Result, ok, err } from 'neverthrow';

interface NormalizedSpot {
  ts: string;
  spotId: number;
  activator: string;
  reference: string;
  freq: number;
  mode: string;
  band: string;
  source: string;
  entity: string;
  grid: string;
  lat: number;
  lon: number;
  name: string;
  spotter: string;
}

// Base aggregate structure - used at hourly, daily, and monthly levels
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
}

interface HourlyAggregate extends BaseAggregate {
  hour: string;
}

interface DailyAggregate extends BaseAggregate {
  date: string;
}

interface MonthlyAggregate extends BaseAggregate {
  month: string;
}

interface BaseSummary {
  generated_at: string;
  total_spots: number;
  total_activations: number;
  total_unique_activators: number;
  total_unique_parks: number;
  files_processed: number;
}

interface HourlySummary extends BaseSummary {
  hour: string;
  aggregates: HourlyAggregate[];
}

interface DailySummary extends BaseSummary {
  date: string;
  aggregates: DailyAggregate[];
}

interface MonthlySummary extends BaseSummary {
  month: string;
  aggregates: MonthlyAggregate[];
}

interface Env {
  R2: R2Bucket;
}

type AggregatorError =
  | { type: 'LIST_ERROR'; message: string }
  | { type: 'READ_ERROR'; message: string }
  | { type: 'PARSE_ERROR'; message: string }
  | { type: 'STORAGE_ERROR'; message: string };

// Path formatting helpers
function formatHourPath(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  return `${year}/${month}/${day}/${hour}`;
}

function formatDayPath(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

function formatMonthPath(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}/${month}`;
}

function getHourTimestamp(date: Date): string {
  const d = new Date(date);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

function getDayTimestamp(date: Date): string {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function getMonthTimestamp(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// File listing helpers
async function listRawFiles(
  r2: R2Bucket,
  hourPath: string
): Promise<Result<string[], AggregatorError>> {
  try {
    const prefix = `raw/${hourPath}/`;
    const listed = await r2.list({ prefix });
    const keys = listed.objects.map((obj) => obj.key);
    return ok(keys);
  } catch (error) {
    return err({
      type: 'LIST_ERROR',
      message: error instanceof Error ? error.message : 'Unknown list error',
    });
  }
}

async function listHourlyFiles(
  r2: R2Bucket,
  dayPath: string
): Promise<Result<string[], AggregatorError>> {
  try {
    const prefix = `hourly/${dayPath}/`;
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

async function listDailyFiles(
  r2: R2Bucket,
  monthPath: string
): Promise<Result<string[], AggregatorError>> {
  try {
    const prefix = `daily/${monthPath}/`;
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

// File reading helpers
async function readRawFile(
  r2: R2Bucket,
  key: string
): Promise<Result<NormalizedSpot[], AggregatorError>> {
  try {
    const obj = await r2.get(key);
    if (!obj) {
      return ok([]);
    }

    const text = await obj.text();
    const lines = text.split('\n').filter((line) => line.trim());

    const spots = lines.reduce<NormalizedSpot[]>((acc, line) => {
      try {
        const spot = JSON.parse(line) as NormalizedSpot;
        return [...acc, spot];
      } catch {
        console.warn(`Skipping malformed line in ${key}`);
        return acc;
      }
    }, []);

    return ok(spots);
  } catch (error) {
    return err({
      type: 'READ_ERROR',
      message: error instanceof Error ? error.message : 'Unknown read error',
    });
  }
}

async function readAggregateFile<T extends BaseAggregate>(
  r2: R2Bucket,
  key: string
): Promise<Result<T[], AggregatorError>> {
  try {
    const obj = await r2.get(key);
    if (!obj) {
      return ok([]);
    }

    const text = await obj.text();
    const lines = text.split('\n').filter((line) => line.trim());

    const aggregates = lines.reduce<T[]>((acc, line) => {
      try {
        const agg = JSON.parse(line) as T;
        return [...acc, agg];
      } catch {
        console.warn(`Skipping malformed line in ${key}`);
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

// Aggregation helpers
interface AggregateGroup {
  spotCount: number;
  activators: Set<string>;
  parks: Set<string>;
  activations: Set<string>;
}

function mergeAggregatesIntoGroups<T extends BaseAggregate>(
  aggregates: T[],
  groups: Map<string, AggregateGroup>
): void {
  aggregates.forEach((agg) => {
    const key = `${agg.mode}|${agg.band}|${agg.entity}`;
    const existing = groups.get(key);
    const group = existing ?? {
      spotCount: 0,
      activators: new Set<string>(),
      parks: new Set<string>(),
      activations: new Set<string>(),
    };

    group.spotCount += agg.spot_count;
    agg.activators.forEach((a) => group.activators.add(a));
    agg.parks.forEach((p) => group.parks.add(p));
    agg.activations.forEach((act) => group.activations.add(act));

    if (!existing) {
      groups.set(key, group);
    }
  });
}

function groupsToAggregates<T extends BaseAggregate>(
  groups: Map<string, AggregateGroup>,
  timestampKey: string,
  timestampValue: string
): T[] {
  return Array.from(groups.entries())
    .map(([key, group]) => {
      const [mode, band, entity] = key.split('|');
      return { mode, band, entity, group };
    })
    .filter((item): item is { mode: string; band: string; entity: string; group: AggregateGroup } =>
      Boolean(item.mode && item.band && item.entity)
    )
    .map(({ mode, band, entity, group }) => {
      const aggregate = {
        [timestampKey]: timestampValue,
        mode,
        band,
        entity,
        spot_count: group.spotCount,
        activation_count: group.activations.size,
        unique_activators: group.activators.size,
        unique_parks: group.parks.size,
        activators: Array.from(group.activators),
        parks: Array.from(group.parks),
        activations: Array.from(group.activations),
      };
      return aggregate as unknown as T;
    });
}

interface SpotGroup {
  spots: NormalizedSpot[];
  activators: Set<string>;
  parks: Set<string>;
  activations: Set<string>;
}

function aggregateSpotsToHourly(spots: NormalizedSpot[], hour: string): HourlyAggregate[] {
  const groups = spots.reduce<Map<string, SpotGroup>>((acc, spot) => {
    const key = `${spot.mode}|${spot.band}|${spot.entity}`;
    const existing = acc.get(key);
    const group = existing ?? {
      spots: [],
      activators: new Set<string>(),
      parks: new Set<string>(),
      activations: new Set<string>(),
    };

    group.spots.push(spot);
    group.activators.add(spot.activator);
    group.parks.add(spot.reference);
    group.activations.add(`${spot.activator}|${spot.reference}`);

    if (!existing) {
      acc.set(key, group);
    }
    return acc;
  }, new Map());

  return Array.from(groups.entries())
    .map(([key, group]) => {
      const [mode, band, entity] = key.split('|');
      return { mode, band, entity, group };
    })
    .filter((item): item is { mode: string; band: string; entity: string; group: SpotGroup } =>
      Boolean(item.mode && item.band && item.entity)
    )
    .map(({ mode, band, entity, group }) => ({
      hour,
      mode,
      band,
      entity,
      spot_count: group.spots.length,
      activation_count: group.activations.size,
      unique_activators: group.activators.size,
      unique_parks: group.parks.size,
      activators: Array.from(group.activators),
      parks: Array.from(group.parks),
      activations: Array.from(group.activations),
    }));
}

// Storage helpers
async function storeAggregate(
  r2: R2Bucket,
  key: string,
  aggregates: BaseAggregate[],
  metadata: Record<string, string>
): Promise<Result<string, AggregatorError>> {
  const lines = aggregates.map((agg) => JSON.stringify(agg));
  const ndjson = lines.join('\n');

  try {
    await r2.put(key, ndjson, {
      httpMetadata: {
        contentType: 'application/x-ndjson',
      },
      customMetadata: metadata,
    });
    return ok(key);
  } catch (error) {
    return err({
      type: 'STORAGE_ERROR',
      message: error instanceof Error ? error.message : 'Unknown storage error',
    });
  }
}

async function storeMeta(
  r2: R2Bucket,
  key: string,
  meta: Record<string, unknown>
): Promise<Result<void, AggregatorError>> {
  try {
    await r2.put(key, JSON.stringify(meta), {
      httpMetadata: {
        contentType: 'application/json',
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

// Manifest types and helpers
interface ManifestEntry {
  timestamp: string;
  path: string;
  total_spots: number;
  total_activations: number;
}

interface Manifest {
  updated_at: string;
  hourly: ManifestEntry[];
  daily: ManifestEntry[];
  monthly: ManifestEntry[];
}

async function updateManifest(
  r2: R2Bucket,
  level: 'hourly' | 'daily' | 'monthly',
  newEntry: ManifestEntry,
  maxEntries: number
): Promise<Result<void, AggregatorError>> {
  try {
    let manifest: Manifest = {
      updated_at: new Date().toISOString(),
      hourly: [],
      daily: [],
      monthly: [],
    };

    const existingManifest = await r2.get('manifest.json');
    if (existingManifest) {
      try {
        const parsed = JSON.parse(await existingManifest.text());
        // Handle migration from old format
        if (parsed.hours && !parsed.hourly) {
          manifest.hourly = parsed.hours;
        } else {
          manifest = { ...manifest, ...parsed };
        }
      } catch {
        // Invalid JSON, start fresh
      }
    }

    // Update or add the entry
    const entries = manifest[level];
    const existingIndex = entries.findIndex((e) => e.timestamp === newEntry.timestamp);
    if (existingIndex >= 0) {
      entries[existingIndex] = newEntry;
    } else {
      entries.push(newEntry);
    }

    // Sort by timestamp descending (newest first)
    entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    // Keep only max entries
    manifest[level] = entries.slice(0, maxEntries);
    manifest.updated_at = new Date().toISOString();

    await r2.put('manifest.json', JSON.stringify(manifest), {
      httpMetadata: {
        contentType: 'application/json',
        cacheControl: 'public, max-age=60',
      },
    });

    return ok(undefined);
  } catch (error) {
    return err({
      type: 'STORAGE_ERROR',
      message: error instanceof Error ? error.message : 'Failed to update manifest',
    });
  }
}

// Main aggregation functions
async function aggregateHour(
  r2: R2Bucket,
  targetHour: Date
): Promise<Result<HourlySummary, AggregatorError>> {
  const hourPath = formatHourPath(targetHour);
  const hourTimestamp = getHourTimestamp(targetHour);

  const listResult = await listRawFiles(r2, hourPath);
  if (listResult.isErr()) {
    return err(listResult.error);
  }

  const fileKeys = listResult.value;
  if (fileKeys.length === 0) {
    const summary: HourlySummary = {
      hour: hourTimestamp,
      generated_at: new Date().toISOString(),
      total_spots: 0,
      total_activations: 0,
      total_unique_activators: 0,
      total_unique_parks: 0,
      files_processed: 0,
      aggregates: [],
    };
    return ok(summary);
  }

  const readResults = await Promise.all(
    fileKeys.map((key) => readRawFile(r2, key).then((result) => ({ key, result })))
  );

  const allSpots = readResults.reduce<Map<number, NormalizedSpot>>((acc, { key, result }) => {
    if (result.isErr()) {
      console.warn(`Failed to read ${key}: ${result.error.message}`);
      return acc;
    }
    result.value.forEach((spot) => {
      acc.set(spot.spotId, spot);
    });
    return acc;
  }, new Map());

  const uniqueSpots = Array.from(allSpots.values());
  const aggregates = aggregateSpotsToHourly(uniqueSpots, hourTimestamp);

  const allActivators = new Set(uniqueSpots.map((s) => s.activator));
  const allParks = new Set(uniqueSpots.map((s) => s.reference));
  const allActivations = new Set(uniqueSpots.map((s) => `${s.activator}|${s.reference}`));

  const summary: HourlySummary = {
    hour: hourTimestamp,
    generated_at: new Date().toISOString(),
    total_spots: uniqueSpots.length,
    total_activations: allActivations.size,
    total_unique_activators: allActivators.size,
    total_unique_parks: allParks.size,
    files_processed: fileKeys.length,
    aggregates,
  };

  const storeResult = await storeAggregate(
    r2,
    `hourly/${hourPath}.ndjson`,
    aggregates,
    {
      hour: summary.hour,
      generatedAt: summary.generated_at,
      totalSpots: String(summary.total_spots),
      filesProcessed: String(summary.files_processed),
    }
  );
  if (storeResult.isErr()) {
    return err(storeResult.error);
  }

  await storeMeta(r2, `hourly/${hourPath}.meta.json`, {
    hour: summary.hour,
    generated_at: summary.generated_at,
    total_spots: summary.total_spots,
    total_activations: summary.total_activations,
    total_unique_activators: summary.total_unique_activators,
    total_unique_parks: summary.total_unique_parks,
    files_processed: summary.files_processed,
    aggregate_count: summary.aggregates.length,
  });

  const manifestEntry: ManifestEntry = {
    timestamp: hourTimestamp,
    path: `hourly/${hourPath}.ndjson`,
    total_spots: summary.total_spots,
    total_activations: summary.total_activations,
  };

  const manifestResult = await updateManifest(r2, 'hourly', manifestEntry, 720);
  if (manifestResult.isErr()) {
    console.warn(`Failed to update manifest: ${manifestResult.error.message}`);
  }

  return ok(summary);
}

async function aggregateDay(
  r2: R2Bucket,
  targetDay: Date
): Promise<Result<DailySummary, AggregatorError>> {
  const dayPath = formatDayPath(targetDay);
  const dayTimestamp = getDayTimestamp(targetDay);

  const listResult = await listHourlyFiles(r2, dayPath);
  if (listResult.isErr()) {
    return err(listResult.error);
  }

  const fileKeys = listResult.value;
  if (fileKeys.length === 0) {
    const summary: DailySummary = {
      date: dayTimestamp,
      generated_at: new Date().toISOString(),
      total_spots: 0,
      total_activations: 0,
      total_unique_activators: 0,
      total_unique_parks: 0,
      files_processed: 0,
      aggregates: [],
    };
    return ok(summary);
  }

  // Read all hourly files and merge
  const readResults = await Promise.all(
    fileKeys.map((key) => readAggregateFile<HourlyAggregate>(r2, key).then((result) => ({ key, result })))
  );

  const groups = new Map<string, AggregateGroup>();
  let totalSpots = 0;

  readResults.forEach(({ key, result }) => {
    if (result.isErr()) {
      console.warn(`Failed to read ${key}: ${result.error.message}`);
      return;
    }
    mergeAggregatesIntoGroups(result.value, groups);
    result.value.forEach((agg) => {
      totalSpots += agg.spot_count;
    });
  });

  const aggregates = groupsToAggregates<DailyAggregate>(groups, 'date', dayTimestamp);

  // Calculate totals from merged groups
  const allActivators = new Set<string>();
  const allParks = new Set<string>();
  const allActivations = new Set<string>();

  groups.forEach((group) => {
    group.activators.forEach((a) => allActivators.add(a));
    group.parks.forEach((p) => allParks.add(p));
    group.activations.forEach((act) => allActivations.add(act));
  });

  const summary: DailySummary = {
    date: dayTimestamp,
    generated_at: new Date().toISOString(),
    total_spots: totalSpots,
    total_activations: allActivations.size,
    total_unique_activators: allActivators.size,
    total_unique_parks: allParks.size,
    files_processed: fileKeys.length,
    aggregates,
  };

  const storeResult = await storeAggregate(
    r2,
    `daily/${dayPath}.ndjson`,
    aggregates,
    {
      date: summary.date,
      generatedAt: summary.generated_at,
      totalSpots: String(summary.total_spots),
      filesProcessed: String(summary.files_processed),
    }
  );
  if (storeResult.isErr()) {
    return err(storeResult.error);
  }

  await storeMeta(r2, `daily/${dayPath}.meta.json`, {
    date: summary.date,
    generated_at: summary.generated_at,
    total_spots: summary.total_spots,
    total_activations: summary.total_activations,
    total_unique_activators: summary.total_unique_activators,
    total_unique_parks: summary.total_unique_parks,
    files_processed: summary.files_processed,
    aggregate_count: summary.aggregates.length,
  });

  const manifestEntry: ManifestEntry = {
    timestamp: dayTimestamp,
    path: `daily/${dayPath}.ndjson`,
    total_spots: summary.total_spots,
    total_activations: summary.total_activations,
  };

  const manifestResult = await updateManifest(r2, 'daily', manifestEntry, 90);
  if (manifestResult.isErr()) {
    console.warn(`Failed to update manifest: ${manifestResult.error.message}`);
  }

  return ok(summary);
}

async function aggregateMonth(
  r2: R2Bucket,
  targetMonth: Date
): Promise<Result<MonthlySummary, AggregatorError>> {
  const monthPath = formatMonthPath(targetMonth);
  const monthTimestamp = getMonthTimestamp(targetMonth);

  const listResult = await listDailyFiles(r2, monthPath);
  if (listResult.isErr()) {
    return err(listResult.error);
  }

  const fileKeys = listResult.value;
  if (fileKeys.length === 0) {
    const summary: MonthlySummary = {
      month: monthTimestamp,
      generated_at: new Date().toISOString(),
      total_spots: 0,
      total_activations: 0,
      total_unique_activators: 0,
      total_unique_parks: 0,
      files_processed: 0,
      aggregates: [],
    };
    return ok(summary);
  }

  // Read all daily files and merge
  const readResults = await Promise.all(
    fileKeys.map((key) => readAggregateFile<DailyAggregate>(r2, key).then((result) => ({ key, result })))
  );

  const groups = new Map<string, AggregateGroup>();
  let totalSpots = 0;

  readResults.forEach(({ key, result }) => {
    if (result.isErr()) {
      console.warn(`Failed to read ${key}: ${result.error.message}`);
      return;
    }
    mergeAggregatesIntoGroups(result.value, groups);
    result.value.forEach((agg) => {
      totalSpots += agg.spot_count;
    });
  });

  const aggregates = groupsToAggregates<MonthlyAggregate>(groups, 'month', monthTimestamp);

  // Calculate totals from merged groups
  const allActivators = new Set<string>();
  const allParks = new Set<string>();
  const allActivations = new Set<string>();

  groups.forEach((group) => {
    group.activators.forEach((a) => allActivators.add(a));
    group.parks.forEach((p) => allParks.add(p));
    group.activations.forEach((act) => allActivations.add(act));
  });

  const summary: MonthlySummary = {
    month: monthTimestamp,
    generated_at: new Date().toISOString(),
    total_spots: totalSpots,
    total_activations: allActivations.size,
    total_unique_activators: allActivators.size,
    total_unique_parks: allParks.size,
    files_processed: fileKeys.length,
    aggregates,
  };

  const storeResult = await storeAggregate(
    r2,
    `monthly/${monthPath}.ndjson`,
    aggregates,
    {
      month: summary.month,
      generatedAt: summary.generated_at,
      totalSpots: String(summary.total_spots),
      filesProcessed: String(summary.files_processed),
    }
  );
  if (storeResult.isErr()) {
    return err(storeResult.error);
  }

  await storeMeta(r2, `monthly/${monthPath}.meta.json`, {
    month: summary.month,
    generated_at: summary.generated_at,
    total_spots: summary.total_spots,
    total_activations: summary.total_activations,
    total_unique_activators: summary.total_unique_activators,
    total_unique_parks: summary.total_unique_parks,
    files_processed: summary.files_processed,
    aggregate_count: summary.aggregates.length,
  });

  const manifestEntry: ManifestEntry = {
    timestamp: monthTimestamp,
    path: `monthly/${monthPath}.ndjson`,
    total_spots: summary.total_spots,
    total_activations: summary.total_activations,
  };

  const manifestResult = await updateManifest(r2, 'monthly', manifestEntry, 24);
  if (manifestResult.isErr()) {
    console.warn(`Failed to update manifest: ${manifestResult.error.message}`);
  }

  return ok(summary);
}

// Response helpers
function summaryToResponse(
  summary: HourlySummary | DailySummary | MonthlySummary,
  timeKey: string
): Response {
  const timeValue = 'hour' in summary ? summary.hour : 'date' in summary ? summary.date : summary.month;
  return new Response(
    JSON.stringify({
      success: true,
      [timeKey]: timeValue,
      total_spots: summary.total_spots,
      total_activations: summary.total_activations,
      total_unique_activators: summary.total_unique_activators,
      total_unique_parks: summary.total_unique_parks,
      files_processed: summary.files_processed,
      aggregate_count: summary.aggregates.length,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

function errorToResponse(error: AggregatorError): Response {
  return new Response(
    JSON.stringify({ success: false, error: error.type, message: error.message }),
    { status: 500, headers: { 'Content-Type': 'application/json' } }
  );
}

export default {
  async scheduled(
    controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    const now = new Date();
    const cronName = controller.cron;

    // Determine which aggregation to run based on cron schedule
    // Hourly: */5 * * * * (every hour at :05)
    // Daily: 15 0 * * * (00:15 UTC daily)
    // Monthly: 30 0 * * * (00:30 UTC daily)

    if (cronName === '5 * * * *') {
      // Hourly aggregation - aggregate the previous hour
      const targetHour = new Date(now);
      targetHour.setUTCHours(targetHour.getUTCHours() - 1);

      const result = await aggregateHour(env.R2, targetHour);
      result.match(
        (summary) => {
          console.log(
            `[HOURLY] Aggregated ${summary.hour}: ${summary.total_spots} spots, ` +
            `${summary.total_unique_activators} activators, ${summary.files_processed} files`
          );
        },
        (error) => {
          console.error(`[HOURLY] Aggregation failed: [${error.type}] ${error.message}`);
        }
      );
    } else if (cronName === '15 0 * * *') {
      // Daily aggregation - aggregate the previous day
      const targetDay = new Date(now);
      targetDay.setUTCDate(targetDay.getUTCDate() - 1);

      const result = await aggregateDay(env.R2, targetDay);
      result.match(
        (summary) => {
          console.log(
            `[DAILY] Aggregated ${summary.date}: ${summary.total_spots} spots, ` +
            `${summary.total_unique_activators} activators, ${summary.files_processed} hourly files`
          );
        },
        (error) => {
          console.error(`[DAILY] Aggregation failed: [${error.type}] ${error.message}`);
        }
      );
    } else if (cronName === '30 0 * * *') {
      // Monthly aggregation - re-aggregate current month (updates as days complete)
      const result = await aggregateMonth(env.R2, now);
      result.match(
        (summary) => {
          console.log(
            `[MONTHLY] Aggregated ${summary.month}: ${summary.total_spots} spots, ` +
            `${summary.total_unique_activators} activators, ${summary.files_processed} daily files`
          );
        },
        (error) => {
          console.error(`[MONTHLY] Aggregation failed: [${error.type}] ${error.message}`);
        }
      );
    } else {
      // Default: run hourly aggregation
      const targetHour = new Date(now);
      targetHour.setUTCHours(targetHour.getUTCHours() - 1);

      const result = await aggregateHour(env.R2, targetHour);
      result.match(
        (summary) => {
          console.log(
            `[DEFAULT] Aggregated hour ${summary.hour}: ${summary.total_spots} spots`
          );
        },
        (error) => {
          console.error(`[DEFAULT] Aggregation failed: [${error.type}] ${error.message}`);
        }
      );
    }
  },

  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    // Hourly aggregation
    if (url.pathname === '/aggregate' || url.pathname === '/aggregate-hour') {
      const hourParam = url.searchParams.get('hour');
      let targetHour: Date;

      if (hourParam) {
        targetHour = new Date(hourParam);
        if (isNaN(targetHour.getTime())) {
          return new Response(
            JSON.stringify({ error: 'Invalid hour parameter' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
      } else {
        targetHour = new Date();
        targetHour.setUTCHours(targetHour.getUTCHours() - 1);
      }

      const result = await aggregateHour(env.R2, targetHour);
      return result.match(
        (summary) => summaryToResponse(summary, 'hour'),
        (error) => errorToResponse(error)
      );
    }

    // Daily aggregation
    if (url.pathname === '/aggregate-day') {
      const dateParam = url.searchParams.get('date');
      let targetDay: Date;

      if (dateParam) {
        targetDay = new Date(dateParam);
        if (isNaN(targetDay.getTime())) {
          return new Response(
            JSON.stringify({ error: 'Invalid date parameter' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
      } else {
        targetDay = new Date();
        targetDay.setUTCDate(targetDay.getUTCDate() - 1);
      }

      const result = await aggregateDay(env.R2, targetDay);
      return result.match(
        (summary) => summaryToResponse(summary, 'date'),
        (error) => errorToResponse(error)
      );
    }

    // Monthly aggregation
    if (url.pathname === '/aggregate-month') {
      const monthParam = url.searchParams.get('month');
      let targetMonth: Date;

      if (monthParam) {
        // Accept YYYY-MM format
        const parts = monthParam.split('-').map(Number);
        const year = parts[0] ?? 0;
        const month = parts[1] ?? 0;
        targetMonth = new Date(Date.UTC(year, month - 1, 1));
        if (isNaN(targetMonth.getTime()) || year === 0 || month === 0) {
          return new Response(
            JSON.stringify({ error: 'Invalid month parameter (use YYYY-MM)' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
      } else {
        targetMonth = new Date();
      }

      const result = await aggregateMonth(env.R2, targetMonth);
      return result.match(
        (summary) => summaryToResponse(summary, 'month'),
        (error) => errorToResponse(error)
      );
    }

    // Aggregate current hour (for testing)
    if (url.pathname === '/aggregate-current') {
      const result = await aggregateHour(env.R2, new Date());
      return result.match(
        (summary) => summaryToResponse(summary, 'hour'),
        (error) => errorToResponse(error)
      );
    }

    // Aggregate current day (for testing)
    if (url.pathname === '/aggregate-current-day') {
      const result = await aggregateDay(env.R2, new Date());
      return result.match(
        (summary) => summaryToResponse(summary, 'date'),
        (error) => errorToResponse(error)
      );
    }

    // Health check
    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      'POTA Aggregator\n' +
      'Endpoints:\n' +
      '  /aggregate[-hour]?hour=ISO - Aggregate hourly data\n' +
      '  /aggregate-day?date=YYYY-MM-DD - Aggregate daily data\n' +
      '  /aggregate-month?month=YYYY-MM - Aggregate monthly data\n' +
      '  /aggregate-current - Aggregate current hour\n' +
      '  /aggregate-current-day - Aggregate current day\n' +
      '  /health - Health check',
      { status: 200 }
    );
  },
};
