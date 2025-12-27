import type { Manifest, TimeRange, HourlyManifestEntry } from './types';
import { TIME_RANGE_HOURS } from './constants';

export type RollupLevel = 'hourly' | 'daily';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AsyncDuckDB = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AsyncDuckDBConnection = any;

const DUCKDB_CACHE_KEY = 'duckdb-wasm-1.29.0';

async function getCachedBundle(url: string, cacheName: string): Promise<Response> {
  try {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(url);
    if (cached) {
      console.log(`Cache hit: ${url}`);
      return cached;
    }
    console.log(`Cache miss, fetching: ${url}`);
    const response = await fetch(url);
    if (response.ok) {
      cache.put(url, response.clone());
    }
    return response;
  } catch {
    console.warn('Cache API not available, fetching directly');
    return fetch(url);
  }
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

  await Promise.all([
    getCachedBundle(bundle.mainModule, DUCKDB_CACHE_KEY),
    getCachedBundle(bundle.mainWorker, DUCKDB_CACHE_KEY),
  ]);

  const worker_url = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
  );

  const worker = new Worker(worker_url);
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
  const db = new duckdb.AsyncDuckDB(logger, worker);

  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(worker_url);

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

export function filterManifestByTimeRangeWithLevel(
  manifest: Manifest,
  timeRange: TimeRange,
  baseUrl: string
): FilteredManifestResult {
  const rollupLevel = selectRollupLevel(manifest, timeRange);
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
  urls: string[]
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

  // Clean up previous data
  await conn.query(`DROP VIEW IF EXISTS spots`);
  try {
    await db.dropFile('combined_data.ndjson');
  } catch {
    // File may not exist on first load
  }

  // Combine and register data
  const combinedData = files.map(f => f.content).join('\n');
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(combinedData);

  await db.registerFileBuffer('combined_data.ndjson', dataBuffer);
  await conn.query(`
    CREATE VIEW spots AS
    SELECT * FROM read_ndjson_auto('combined_data.ndjson')
  `);

  return { fileCount: files.length };
}
