// Utility functions extracted for testing

// Compute short content hash for cache-busting filenames
export async function computeContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  // Return first 8 characters for a short but unique hash
  return hashHex.slice(0, 8);
}

// Insert hash into filename: "hourly/2025/12/27/20.ndjson" -> "hourly/2025/12/27/20-abc12345.ndjson"
export function addHashToFilename(key: string, hash: string): string {
  const lastDot = key.lastIndexOf('.');
  if (lastDot === -1) return `${key}-${hash}`;
  return `${key.slice(0, lastDot)}-${hash}${key.slice(lastDot)}`;
}

export function formatHourPath(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  return `${year}/${month}/${day}/${hour}`;
}

export function formatDayPath(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

export function formatMonthPath(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}/${month}`;
}

export function getHourTimestamp(date: Date): string {
  const d = new Date(date);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

export function getDayTimestamp(date: Date): string {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function getMonthTimestamp(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// Aggregation types
export interface NormalizedSpot {
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

export interface BaseAggregate {
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

export interface HourlyAggregate extends BaseAggregate {
  hour: string;
}

export interface SpotGroup {
  spots: NormalizedSpot[];
  activators: Set<string>;
  parks: Set<string>;
  activations: Set<string>;
}

export function aggregateSpotsToHourly(spots: NormalizedSpot[], hour: string): HourlyAggregate[] {
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

export interface AggregateGroup {
  spotCount: number;
  activators: Set<string>;
  parks: Set<string>;
  activations: Set<string>;
}

export function mergeAggregatesIntoGroups<T extends BaseAggregate>(
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

// ============================================================================
// Rollup bookkeeping (self-heal and manual backfill)
// ============================================================================

/**
 * The slots that already have a rollup file under a listing prefix.
 * "hourly/2026/11/21/00-abc12345.ndjson" under "hourly/2026/11/21/" → "00".
 * Old unhashed names ("daily/2025/12/27.ndjson") count too. Meta files do not.
 */
export function rollupSlots(keys: string[], prefix: string): Set<string> {
  const slots = new Set<string>();
  for (const key of keys) {
    if (!key.startsWith(prefix) || !key.endsWith('.ndjson')) continue;
    const name = key.slice(prefix.length);
    if (name.includes('/')) continue;
    const slot = name.split(/[-.]/)[0];
    if (slot) slots.add(slot);
  }
  return slots;
}

function startOfHour(date: Date): Date {
  const d = new Date(date);
  d.setUTCMinutes(0, 0, 0);
  return d;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Start of each UTC hour from `from` to `to` hours before `now`'s hour, oldest first. */
export function hoursBefore(now: Date, from: number, to: number): Date[] {
  const base = startOfHour(now).getTime();
  const out: Date[] = [];
  for (let n = from; n >= to; n--) out.push(new Date(base - n * 3_600_000));
  return out;
}

/** Start of each UTC day from `from` to `to` days before `now`'s day, oldest first. */
export function daysBefore(now: Date, from: number, to: number): Date[] {
  const base = startOfDay(now);
  const out: Date[] = [];
  for (let n = from; n >= to; n--) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() - n);
    out.push(d);
  }
  return out;
}

export type RollupLevel = 'hour' | 'day' | 'month';

/**
 * Parse a manual backfill target. Accepts "YYYY-MM-DDTHH" (hour),
 * "YYYY-MM-DD" (day), or "YYYY-MM" (month), in UTC. Returns null unless the
 * period has fully ended before `now`, so a backfill never rolls up a period
 * that is still collecting spots.
 */
export function parseCompletedPeriod(level: RollupLevel, value: string, now: Date): Date | null {
  const patterns: Record<RollupLevel, RegExp> = {
    hour: /^(\d{4})-(\d{2})-(\d{2})T(\d{2})$/,
    day: /^(\d{4})-(\d{2})-(\d{2})$/,
    month: /^(\d{4})-(\d{2})$/,
  };
  const match = patterns[level].exec(value);
  if (!match) return null;
  const [, y, mo, d = '01', h = '00'] = match;
  const start = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h)));
  // Reject rollovers such as 2026-02-30.
  if (
    start.getUTCFullYear() !== Number(y) ||
    start.getUTCMonth() !== Number(mo) - 1 ||
    start.getUTCDate() !== Number(d) ||
    start.getUTCHours() !== Number(h)
  ) {
    return null;
  }
  const end = new Date(start);
  if (level === 'hour') end.setUTCHours(end.getUTCHours() + 1);
  else if (level === 'day') end.setUTCDate(end.getUTCDate() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return end.getTime() <= now.getTime() ? start : null;
}
