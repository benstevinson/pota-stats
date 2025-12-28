import { Result, ok, err } from 'neverthrow';
// @ts-expect-error - Local ESM build of coord2state
import { getState } from './coord2state.js';

// Types for POTA API response
interface PotaSpot {
  spotId: number;
  activator: string;
  activatorLastSpotTime: string | null;
  activatorLastComments: string | null;
  frequency: string;
  mode: string;
  reference: string;
  parkName: string | null;
  spotTime: string;
  spotter: string;
  comments: string;
  source: string;
  invalid: null;
  name: string;
  locationDesc: string;
  grid4: string;
  grid6: string;
  latitude: number;
  longitude: number;
  count: number;
  expire: number;
}

// Normalized spot for storage
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
  state: string | null;
}

interface Env {
  R2: R2Bucket;
}

type CollectorError =
  | { type: 'FETCH_ERROR'; message: string }
  | { type: 'PARSE_ERROR'; message: string }
  | { type: 'STORAGE_ERROR'; message: string };

const POTA_API_URL = 'https://api.pota.app/v1/spots';

// POTA API returns frequency in kHz (e.g., 7137 for 7.137 MHz)
function freqToBand(freqKhz: number): string {
  const freqMhz = freqKhz / 1000;
  if (freqMhz >= 1.8 && freqMhz <= 2.0) return '160m';
  if (freqMhz >= 3.5 && freqMhz <= 4.0) return '80m';
  if (freqMhz >= 5.3 && freqMhz <= 5.4) return '60m';
  if (freqMhz >= 7.0 && freqMhz <= 7.3) return '40m';
  if (freqMhz >= 10.1 && freqMhz <= 10.15) return '30m';
  if (freqMhz >= 14.0 && freqMhz <= 14.35) return '20m';
  if (freqMhz >= 18.068 && freqMhz <= 18.168) return '17m';
  if (freqMhz >= 21.0 && freqMhz <= 21.45) return '15m';
  if (freqMhz >= 24.89 && freqMhz <= 24.99) return '12m';
  if (freqMhz >= 28.0 && freqMhz <= 29.7) return '10m';
  if (freqMhz >= 50.0 && freqMhz <= 54.0) return '6m';
  if (freqMhz >= 144.0 && freqMhz <= 148.0) return '2m';
  if (freqMhz >= 420.0 && freqMhz <= 450.0) return '70cm';
  return 'other';
}

function extractEntity(reference: string): string {
  const parts = reference.split('-');
  return parts[0] ?? 'unknown';
}

function formatDatePath(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  return `${year}/${month}/${day}/${hour}`;
}

function formatTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

async function fetchSpots(): Promise<Result<PotaSpot[], CollectorError>> {
  try {
    const response = await fetch(POTA_API_URL, {
      headers: {
        'User-Agent': 'W0ARR-POTA-Stats/1.0 (https://w0arr.com)',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return err({
        type: 'FETCH_ERROR',
        message: `HTTP ${response.status}: ${response.statusText}`,
      });
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      return err({
        type: 'PARSE_ERROR',
        message: 'Expected array response from POTA API',
      });
    }

    return ok(data as PotaSpot[]);
  } catch (error) {
    return err({
      type: 'FETCH_ERROR',
      message: error instanceof Error ? error.message : 'Unknown fetch error',
    });
  }
}

function normalizeSpots(spots: PotaSpot[], timestamp: string): NormalizedSpot[] {
  return spots.map((spot) => ({
    ts: timestamp,
    spotId: spot.spotId,
    activator: spot.activator,
    reference: spot.reference,
    freq: parseFloat(spot.frequency) || 0,
    mode: spot.mode.toUpperCase(),
    band: freqToBand(parseFloat(spot.frequency) || 0),
    source: spot.source,
    entity: extractEntity(spot.reference),
    grid: spot.grid4,
    lat: spot.latitude,
    lon: spot.longitude,
    name: spot.name,
    spotter: spot.spotter,
    state: getState(spot.latitude, spot.longitude) ?? null,
  }));
}

async function storeSpots(
  r2: R2Bucket,
  spots: NormalizedSpot[],
  now: Date
): Promise<Result<{ key: string; count: number }, CollectorError>> {
  const datePath = formatDatePath(now);
  const timestamp = formatTimestamp(now);
  const key = `raw/${datePath}/spots-${timestamp}.ndjson`;

  const ndjson = spots.map((spot) => JSON.stringify(spot)).join('\n');

  try {
    await r2.put(key, ndjson, {
      httpMetadata: {
        contentType: 'application/x-ndjson',
      },
      customMetadata: {
        spotCount: String(spots.length),
        capturedAt: now.toISOString(),
      },
    });

    return ok({ key, count: spots.length });
  } catch (error) {
    return err({
      type: 'STORAGE_ERROR',
      message: error instanceof Error ? error.message : 'Unknown storage error',
    });
  }
}

async function collectSpots(env: Env): Promise<Result<{ key: string; count: number }, CollectorError>> {
  const now = new Date();
  const timestamp = now.toISOString();

  const fetchResult = await fetchSpots();
  if (fetchResult.isErr()) {
    return err(fetchResult.error);
  }

  const spots = fetchResult.value;
  const normalizedSpots = normalizeSpots(spots, timestamp);

  return storeSpots(env.R2, normalizedSpots, now);
}

export default {
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    const result = await collectSpots(env);

    result.match(
      ({ key, count }) => {
        console.log(`Successfully stored ${count} spots to ${key}`);
      },
      (error) => {
        console.error(`Collection failed: [${error.type}] ${error.message}`);
      }
    );
  },

  // HTTP handler - health check only, collection is cron-triggered
  async fetch(
    request: Request,
    _env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ service: 'pota-collector', status: 'ok', endpoints: ['/health'] }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  },
};
