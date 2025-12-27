import test from 'ava';
import { filterManifestByTimeRange, filterManifestByTimeRangeWithLevel } from '../src/data.ts';
import type { Manifest } from '../src/types.ts';

// Helper to create a manifest with hourly entries
function createManifest(hourlyEntries: Array<{ hour: string; path: string }>): Manifest {
  return {
    hourly: hourlyEntries.map(e => ({ hour: e.hour, path: e.path })),
    daily: [],
  };
}

// Helper to create a date string for N hours ago
function hoursAgo(n: number): string {
  const d = new Date();
  d.setUTCHours(d.getUTCHours() - n);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString().slice(0, 13) + ':00:00.000Z';
}

test('filterManifestByTimeRange returns URLs for 1h range', t => {
  const baseUrl = 'https://r2.example.com';
  const manifest = createManifest([
    { hour: hoursAgo(0), path: 'hourly/2024/01/01/00.ndjson' },
    { hour: hoursAgo(1), path: 'hourly/2024/01/01/01.ndjson' },
    { hour: hoursAgo(2), path: 'hourly/2024/01/01/02.ndjson' },
    { hour: hoursAgo(3), path: 'hourly/2024/01/01/03.ndjson' },
  ]);

  const urls = filterManifestByTimeRange(manifest, '1h', baseUrl);

  // Should include current hour and previous hour (hour end time > cutoff)
  t.true(urls.length >= 1);
  t.true(urls.length <= 2);
  t.true(urls.every(url => url.startsWith(baseUrl)));
});

test('filterManifestByTimeRange returns URLs for 24h range', t => {
  const baseUrl = 'https://r2.example.com';
  const entries = [];
  for (let i = 0; i < 30; i++) {
    entries.push({ hour: hoursAgo(i), path: `hourly/2024/01/01/${String(i).padStart(2, '0')}.ndjson` });
  }
  const manifest = createManifest(entries);

  const urls = filterManifestByTimeRange(manifest, '24h', baseUrl);

  // Should include approximately 24-25 hours of data
  t.true(urls.length >= 24);
  t.true(urls.length <= 26);
});

test('filterManifestByTimeRangeWithLevel returns hourly rollup for 1h', t => {
  const baseUrl = 'https://r2.example.com';
  const manifest = createManifest([
    { hour: hoursAgo(0), path: 'hourly/2024/01/01/00.ndjson' },
  ]);

  const result = filterManifestByTimeRangeWithLevel(manifest, '1h', baseUrl);

  t.is(result.rollupLevel, 'hourly');
});

test('filterManifestByTimeRangeWithLevel returns hourly rollup for 24h', t => {
  const baseUrl = 'https://r2.example.com';
  const manifest = createManifest([
    { hour: hoursAgo(0), path: 'hourly/2024/01/01/00.ndjson' },
  ]);

  const result = filterManifestByTimeRangeWithLevel(manifest, '24h', baseUrl);

  t.is(result.rollupLevel, 'hourly');
});

test('filterManifestByTimeRangeWithLevel prefers daily rollup for 7d when available', t => {
  const baseUrl = 'https://r2.example.com';
  const manifest: Manifest = {
    hourly: [{ hour: hoursAgo(0), path: 'hourly/2024/01/01/00.ndjson' }],
    daily: [{ day: '2024-01-01', path: 'daily/2024/01/01.ndjson' }],
  };

  const result = filterManifestByTimeRangeWithLevel(manifest, '7d', baseUrl);

  t.is(result.rollupLevel, 'daily');
});

test('filterManifestByTimeRangeWithLevel falls back to hourly for 7d when no daily data', t => {
  const baseUrl = 'https://r2.example.com';
  const manifest: Manifest = {
    hourly: [{ hour: hoursAgo(0), path: 'hourly/2024/01/01/00.ndjson' }],
    daily: [],
  };

  const result = filterManifestByTimeRangeWithLevel(manifest, '7d', baseUrl);

  t.is(result.rollupLevel, 'hourly');
});

test('filterManifestByTimeRange handles empty manifest', t => {
  const baseUrl = 'https://r2.example.com';
  const manifest = createManifest([]);

  const urls = filterManifestByTimeRange(manifest, '24h', baseUrl);

  t.deepEqual(urls, []);
});

test('filterManifestByTimeRange handles legacy hours field', t => {
  const baseUrl = 'https://r2.example.com';
  // Simulate legacy manifest with 'hours' instead of 'hourly'
  const manifest = {
    hours: [{ hour: hoursAgo(0), path: 'hourly/2024/01/01/00.ndjson' }],
  } as unknown as Manifest;

  const urls = filterManifestByTimeRange(manifest, '24h', baseUrl);

  t.true(urls.length >= 1);
});
