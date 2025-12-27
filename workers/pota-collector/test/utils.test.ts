import test from 'ava';
import {
  freqToBand,
  extractEntity,
  formatDatePath,
  formatTimestamp,
  normalizeSpots,
  type PotaSpot,
} from '../src/utils.ts';

// freqToBand tests
test('freqToBand returns 160m for 1.8-2.0 MHz', t => {
  t.is(freqToBand(1800), '160m');
  t.is(freqToBand(1900), '160m');
  t.is(freqToBand(2000), '160m');
});

test('freqToBand returns 80m for 3.5-4.0 MHz', t => {
  t.is(freqToBand(3500), '80m');
  t.is(freqToBand(3750), '80m');
  t.is(freqToBand(4000), '80m');
});

test('freqToBand returns 60m for 5.3-5.4 MHz', t => {
  t.is(freqToBand(5330), '60m');
  t.is(freqToBand(5400), '60m');
});

test('freqToBand returns 40m for 7.0-7.3 MHz', t => {
  t.is(freqToBand(7000), '40m');
  t.is(freqToBand(7137), '40m');
  t.is(freqToBand(7300), '40m');
});

test('freqToBand returns 30m for 10.1-10.15 MHz', t => {
  t.is(freqToBand(10100), '30m');
  t.is(freqToBand(10125), '30m');
  t.is(freqToBand(10150), '30m');
});

test('freqToBand returns 20m for 14.0-14.35 MHz', t => {
  t.is(freqToBand(14000), '20m');
  t.is(freqToBand(14250), '20m');
  t.is(freqToBand(14350), '20m');
});

test('freqToBand returns 17m for 18.068-18.168 MHz', t => {
  t.is(freqToBand(18068), '17m');
  t.is(freqToBand(18100), '17m');
  t.is(freqToBand(18168), '17m');
});

test('freqToBand returns 15m for 21.0-21.45 MHz', t => {
  t.is(freqToBand(21000), '15m');
  t.is(freqToBand(21250), '15m');
  t.is(freqToBand(21450), '15m');
});

test('freqToBand returns 12m for 24.89-24.99 MHz', t => {
  t.is(freqToBand(24890), '12m');
  t.is(freqToBand(24940), '12m');
  t.is(freqToBand(24990), '12m');
});

test('freqToBand returns 10m for 28.0-29.7 MHz', t => {
  t.is(freqToBand(28000), '10m');
  t.is(freqToBand(28500), '10m');
  t.is(freqToBand(29700), '10m');
});

test('freqToBand returns 6m for 50.0-54.0 MHz', t => {
  t.is(freqToBand(50000), '6m');
  t.is(freqToBand(52000), '6m');
  t.is(freqToBand(54000), '6m');
});

test('freqToBand returns 2m for 144.0-148.0 MHz', t => {
  t.is(freqToBand(144000), '2m');
  t.is(freqToBand(146000), '2m');
  t.is(freqToBand(148000), '2m');
});

test('freqToBand returns 70cm for 420.0-450.0 MHz', t => {
  t.is(freqToBand(420000), '70cm');
  t.is(freqToBand(435000), '70cm');
  t.is(freqToBand(450000), '70cm');
});

test('freqToBand returns other for out-of-band frequencies', t => {
  t.is(freqToBand(0), 'other');
  t.is(freqToBand(1000), 'other');
  t.is(freqToBand(100000), 'other');
  t.is(freqToBand(500000), 'other');
});

// extractEntity tests
test('extractEntity extracts entity from K- reference', t => {
  t.is(extractEntity('K-1234'), 'K');
  t.is(extractEntity('K-0001'), 'K');
});

test('extractEntity extracts entity from VE- reference', t => {
  t.is(extractEntity('VE-1234'), 'VE');
});

test('extractEntity extracts entity from multi-part reference', t => {
  t.is(extractEntity('US-PA-1234'), 'US');
});

test('extractEntity returns empty string for empty reference', t => {
  t.is(extractEntity(''), '');
});

// formatDatePath tests
test('formatDatePath formats date correctly', t => {
  const date = new Date('2024-03-15T09:30:00Z');
  t.is(formatDatePath(date), '2024/03/15/09');
});

test('formatDatePath pads single digits', t => {
  const date = new Date('2024-01-05T03:00:00Z');
  t.is(formatDatePath(date), '2024/01/05/03');
});

// formatTimestamp tests
test('formatTimestamp formats ISO timestamp with dashes', t => {
  const date = new Date('2024-03-15T09:30:45.123Z');
  const result = formatTimestamp(date);
  t.true(result.includes('2024-03-15T09-30-45'));
  t.false(result.includes(':'));
  t.false(result.includes('.'));
});

// normalizeSpots tests
test('normalizeSpots transforms POTA spots correctly', t => {
  const spots: PotaSpot[] = [{
    spotId: 12345,
    activator: 'W0ARR',
    activatorLastSpotTime: null,
    activatorLastComments: null,
    frequency: '7137',
    mode: 'ssb',
    reference: 'K-1234',
    parkName: 'Test Park',
    spotTime: '2024-03-15T09:30:00Z',
    spotter: 'W1ABC',
    comments: 'test',
    source: 'POTA',
    invalid: null,
    name: 'Test Activator',
    locationDesc: 'Test Location',
    grid4: 'FN31',
    grid6: 'FN31ab',
    latitude: 42.0,
    longitude: -72.0,
    count: 1,
    expire: 3600,
  }];

  const timestamp = '2024-03-15T09:30:00Z';
  const normalized = normalizeSpots(spots, timestamp);

  t.is(normalized.length, 1);
  const spot = normalized[0]!;
  t.is(spot.ts, timestamp);
  t.is(spot.spotId, 12345);
  t.is(spot.activator, 'W0ARR');
  t.is(spot.reference, 'K-1234');
  t.is(spot.freq, 7137);
  t.is(spot.mode, 'SSB'); // Uppercased
  t.is(spot.band, '40m');
  t.is(spot.source, 'POTA');
  t.is(spot.entity, 'K');
  t.is(spot.grid, 'FN31');
  t.is(spot.lat, 42.0);
  t.is(spot.lon, -72.0);
  t.is(spot.name, 'Test Activator');
  t.is(spot.spotter, 'W1ABC');
});

test('normalizeSpots handles invalid frequency', t => {
  const spots: PotaSpot[] = [{
    spotId: 12345,
    activator: 'W0ARR',
    activatorLastSpotTime: null,
    activatorLastComments: null,
    frequency: 'invalid',
    mode: 'CW',
    reference: 'K-1234',
    parkName: null,
    spotTime: '2024-03-15T09:30:00Z',
    spotter: 'W1ABC',
    comments: '',
    source: 'POTA',
    invalid: null,
    name: 'Test',
    locationDesc: '',
    grid4: 'FN31',
    grid6: 'FN31ab',
    latitude: 0,
    longitude: 0,
    count: 1,
    expire: 3600,
  }];

  const normalized = normalizeSpots(spots, '2024-03-15T09:30:00Z');

  t.is(normalized[0]!.freq, 0);
  t.is(normalized[0]!.band, 'other');
});

test('normalizeSpots processes multiple spots', t => {
  const spots: PotaSpot[] = [
    {
      spotId: 1,
      activator: 'W0ARR',
      activatorLastSpotTime: null,
      activatorLastComments: null,
      frequency: '7137',
      mode: 'SSB',
      reference: 'K-1234',
      parkName: null,
      spotTime: '2024-03-15T09:30:00Z',
      spotter: 'W1ABC',
      comments: '',
      source: 'POTA',
      invalid: null,
      name: 'Test1',
      locationDesc: '',
      grid4: 'FN31',
      grid6: 'FN31ab',
      latitude: 42.0,
      longitude: -72.0,
      count: 1,
      expire: 3600,
    },
    {
      spotId: 2,
      activator: 'K1XYZ',
      activatorLastSpotTime: null,
      activatorLastComments: null,
      frequency: '14250',
      mode: 'CW',
      reference: 'VE-5678',
      parkName: null,
      spotTime: '2024-03-15T09:31:00Z',
      spotter: 'W2DEF',
      comments: '',
      source: 'POTA',
      invalid: null,
      name: 'Test2',
      locationDesc: '',
      grid4: 'EN82',
      grid6: 'EN82cd',
      latitude: 40.0,
      longitude: -80.0,
      count: 1,
      expire: 3600,
    },
  ];

  const normalized = normalizeSpots(spots, '2024-03-15T09:30:00Z');

  t.is(normalized.length, 2);
  t.is(normalized[0]!.band, '40m');
  t.is(normalized[1]!.band, '20m');
  t.is(normalized[0]!.entity, 'K');
  t.is(normalized[1]!.entity, 'VE');
});
