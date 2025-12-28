import type { Manifest, TimeRange, TrendPeriod, HourlyManifestEntry } from './types.ts';
import { TIME_RANGE_HOURS } from './constants.ts';

/**
 * Converts a trend period to an equivalent time range for data loading
 */
export function getTrendTimeRange(period: TrendPeriod): TimeRange {
  switch (period) {
    case 'daily': return '30d';
    case 'weekly': return '30d';
    case 'monthly': return '30d';
    default: return '30d';
  }
}

export type RollupLevel = 'hourly' | 'daily';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AsyncDuckDB = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AsyncDuckDBConnection = any;

const DUCKDB_CACHE_KEY = 'duckdb-wasm-1.29.0';

async function getCachedArrayBuffer(url: string, cacheName: string): Promise<ArrayBuffer> {
  try {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(url);
    if (cached) {
      console.log(`DuckDB cache hit: ${url.split('/').pop()}`);
      return cached.arrayBuffer();
    }
    console.log(`DuckDB cache miss, fetching: ${url.split('/').pop()}`);
    const response = await fetch(url);
    if (response.ok) {
      cache.put(url, response.clone());
    }
    return response.arrayBuffer();
  } catch {
    console.warn('Cache API not available, fetching directly');
    const response = await fetch(url);
    return response.arrayBuffer();
  }
}

async function getCachedBlob(url: string, cacheName: string, mimeType: string): Promise<Blob> {
  const buffer = await getCachedArrayBuffer(url, cacheName);
  return new Blob([buffer], { type: mimeType });
}

export interface DuckDBInstance {
  db: AsyncDuckDB;
  conn: AsyncDuckDBConnection;
}

export async function initDuckDB(): Promise<DuckDBInstance> {
  // @ts-expect-error - Dynamic import from CDN, runs in browser only
  const duckdb = await import('https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/+esm');

  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

  // Fetch and cache the WASM module and worker in parallel
  const [mainModuleBlob, mainWorkerBlob] = await Promise.all([
    getCachedBlob(bundle.mainModule, DUCKDB_CACHE_KEY, 'application/wasm'),
    getCachedBlob(bundle.mainWorker, DUCKDB_CACHE_KEY, 'application/javascript'),
  ]);

  // Create blob URLs for both - DuckDB internally needs URLs it can fetch from
  const wasmUrl = URL.createObjectURL(mainModuleBlob);
  const workerUrl = URL.createObjectURL(mainWorkerBlob);

  const worker = new Worker(workerUrl);
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
  const db = new duckdb.AsyncDuckDB(logger, worker);

  // Pass the blob URL - DuckDB fetches from memory via the blob URL
  await db.instantiate(wasmUrl);

  // Clean up blob URLs after instantiation
  URL.revokeObjectURL(wasmUrl);
  URL.revokeObjectURL(workerUrl);

  const conn = await db.connect();

  return { db, conn };
}

export async function loadManifest(baseUrl: string): Promise<Manifest | null> {
  try {
    const response = await fetch(`${baseUrl}/manifest.json`, { cache: 'no-cache' });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Determines which rollup level to use based on time range and data availability
 */
function selectRollupLevel(manifest: Manifest, timeRange: TimeRange): RollupLevel {
  // For short time ranges, always use hourly
  if (timeRange === '1h' || timeRange === '24h') {
    return 'hourly';
  }

  // For longer ranges (7d, 30d), prefer daily if available
  const daily = manifest.daily ?? [];
  if (daily.length > 0) {
    return 'daily';
  }

  // Fall back to hourly
  return 'hourly';
}

/**
 * Gets hourly entries from manifest (handles legacy 'hours' field)
 */
function getHourlyEntries(manifest: Manifest): HourlyManifestEntry[] {
  return manifest.hourly ?? manifest.hours ?? [];
}

export interface FilteredManifestResult {
  urls: string[];
  rollupLevel: RollupLevel;
}

export function filterManifestByTimeRange(
  manifest: Manifest,
  timeRange: TimeRange,
  baseUrl: string
): string[] {
  const result = filterManifestByTimeRangeWithLevel(manifest, timeRange, baseUrl);
  return result.urls;
}

export interface FilterManifestOptions {
  forceHourly?: boolean;
}

export function filterManifestByTimeRangeWithLevel(
  manifest: Manifest,
  timeRange: TimeRange,
  baseUrl: string,
  options: FilterManifestOptions = {}
): FilteredManifestResult {
  // Force hourly rollup if requested (needed for trend queries that use 'hour' column)
  const rollupLevel = options.forceHourly ? 'hourly' : selectRollupLevel(manifest, timeRange);
  const hoursBack = TIME_RANGE_HOURS[timeRange] ?? 24;
  const cutoff = new Date();
  cutoff.setUTCHours(cutoff.getUTCHours() - hoursBack);

  if (rollupLevel === 'daily') {
    const daily = manifest.daily ?? [];
    const urls = daily
      .filter(d => new Date(d.day) >= cutoff)
      .map(d => `${baseUrl}/${d.path}`);

    // Also include today's hourly data (incomplete day)
    const todayStr = new Date().toISOString().slice(0, 10);
    const hourly = getHourlyEntries(manifest);
    const todayHourly = hourly
      .filter(h => h.hour.startsWith(todayStr))
      .map(h => `${baseUrl}/${h.path}`);

    return { urls: [...urls, ...todayHourly], rollupLevel };
  }

  // Hourly rollup
  // Compare hour END time (start + 1 hour) against cutoff, since hourly files
  // contain data for the full hour (e.g., 13:00 file has data from 13:00-13:59)
  const hourly = getHourlyEntries(manifest);
  const urls = hourly
    .filter(h => {
      const hourEnd = new Date(h.hour);
      hourEnd.setUTCHours(hourEnd.getUTCHours() + 1);
      return hourEnd > cutoff;
    })
    .map(h => `${baseUrl}/${h.path}`);

  return { urls, rollupLevel };
}

export interface LoadedData {
  fileCount: number;
}

export async function loadDataIntoView(
  db: AsyncDuckDB,
  conn: AsyncDuckDBConnection,
  urls: string[],
  viewName: string = 'spots'
): Promise<LoadedData> {
  // Fetch all files in parallel
  const fetchPromises = urls.map(async (url, idx) => {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to fetch ${url}: ${response.status}`);
      return null;
    }
    const text = await response.text();
    return { name: `data_${idx}.ndjson`, content: text };
  });

  const files = (await Promise.all(fetchPromises)).filter(
    (f): f is { name: string; content: string } => f !== null
  );

  if (files.length === 0) {
    throw new Error('No data files could be loaded');
  }

  const fileName = `${viewName}_data.ndjson`;

  // Clean up previous data
  await conn.query(`DROP VIEW IF EXISTS ${viewName}`);
  try {
    await db.dropFile(fileName);
  } catch {
    // File may not exist on first load
  }

  // Combine and register data
  const combinedData = files.map(f => f.content).join('\n');
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(combinedData);

  await db.registerFileBuffer(fileName, dataBuffer);
  await conn.query(`
    CREATE VIEW ${viewName} AS
    SELECT * FROM read_ndjson_auto('${fileName}')
  `);

  return { fileCount: files.length };
}
