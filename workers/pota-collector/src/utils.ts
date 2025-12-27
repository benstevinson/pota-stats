// Utility functions extracted for testing

// POTA API returns frequency in kHz (e.g., 7137 for 7.137 MHz)
export function freqToBand(freqKhz: number): string {
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

export function extractEntity(reference: string): string {
  const parts = reference.split('-');
  return parts[0] ?? 'unknown';
}

export function formatDatePath(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  return `${year}/${month}/${day}/${hour}`;
}

export function formatTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

export interface PotaSpot {
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

export function normalizeSpots(spots: PotaSpot[], timestamp: string): NormalizedSpot[] {
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
  }));
}
