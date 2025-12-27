import test from 'ava';
import {
  formatHourPath,
  formatDayPath,
  formatMonthPath,
  getHourTimestamp,
  getDayTimestamp,
  getMonthTimestamp,
  aggregateSpotsToHourly,
  mergeAggregatesIntoGroups,
  type NormalizedSpot,
  type HourlyAggregate,
  type AggregateGroup,
} from '../src/utils.ts';

// formatHourPath tests
test('formatHourPath formats date correctly', t => {
  const date = new Date('2024-03-15T09:30:00Z');
  t.is(formatHourPath(date), '2024/03/15/09');
});

test('formatHourPath pads single digits', t => {
  const date = new Date('2024-01-05T03:00:00Z');
  t.is(formatHourPath(date), '2024/01/05/03');
});

// formatDayPath tests
test('formatDayPath formats date correctly', t => {
  const date = new Date('2024-03-15T09:30:00Z');
  t.is(formatDayPath(date), '2024/03/15');
});

test('formatDayPath pads single digits', t => {
  const date = new Date('2024-01-05T03:00:00Z');
  t.is(formatDayPath(date), '2024/01/05');
});

// formatMonthPath tests
test('formatMonthPath formats date correctly', t => {
  const date = new Date('2024-03-15T09:30:00Z');
  t.is(formatMonthPath(date), '2024/03');
});

test('formatMonthPath pads single digit month', t => {
  const date = new Date('2024-01-05T03:00:00Z');
  t.is(formatMonthPath(date), '2024/01');
});

// getHourTimestamp tests
test('getHourTimestamp truncates to hour', t => {
  const date = new Date('2024-03-15T09:30:45.123Z');
  const result = getHourTimestamp(date);
  t.true(result.startsWith('2024-03-15T09:00:00'));
});

test('getHourTimestamp preserves hour', t => {
  const date = new Date('2024-03-15T15:59:59.999Z');
  const result = getHourTimestamp(date);
  t.true(result.startsWith('2024-03-15T15:00:00'));
});

// getDayTimestamp tests
test('getDayTimestamp returns date only', t => {
  const date = new Date('2024-03-15T09:30:45.123Z');
  t.is(getDayTimestamp(date), '2024-03-15');
});

test('getDayTimestamp handles midnight correctly', t => {
  const date = new Date('2024-03-15T00:00:00.000Z');
  t.is(getDayTimestamp(date), '2024-03-15');
});

// getMonthTimestamp tests
test('getMonthTimestamp returns YYYY-MM format', t => {
  const date = new Date('2024-03-15T09:30:45.123Z');
  t.is(getMonthTimestamp(date), '2024-03');
});

test('getMonthTimestamp pads single digit month', t => {
  const date = new Date('2024-01-15T09:30:45.123Z');
  t.is(getMonthTimestamp(date), '2024-01');
});

// aggregateSpotsToHourly tests
test('aggregateSpotsToHourly groups spots by mode/band/entity', t => {
  const spots: NormalizedSpot[] = [
    {
      ts: '2024-03-15T09:30:00Z',
      spotId: 1,
      activator: 'W0ARR',
      reference: 'K-1234',
      freq: 7137,
      mode: 'SSB',
      band: '40m',
      source: 'POTA',
      entity: 'K',
      grid: 'FN31',
      lat: 42.0,
      lon: -72.0,
      name: 'Test1',
      spotter: 'W1ABC',
    },
    {
      ts: '2024-03-15T09:31:00Z',
      spotId: 2,
      activator: 'K1XYZ',
      reference: 'K-5678',
      freq: 7200,
      mode: 'SSB',
      band: '40m',
      source: 'POTA',
      entity: 'K',
      grid: 'EN82',
      lat: 40.0,
      lon: -80.0,
      name: 'Test2',
      spotter: 'W2DEF',
    },
  ];

  const hour = '2024-03-15T09:00:00.000Z';
  const aggregates = aggregateSpotsToHourly(spots, hour);

  t.is(aggregates.length, 1);
  const agg = aggregates[0]!;
  t.is(agg.hour, hour);
  t.is(agg.mode, 'SSB');
  t.is(agg.band, '40m');
  t.is(agg.entity, 'K');
  t.is(agg.spot_count, 2);
  t.is(agg.unique_activators, 2);
  t.is(agg.unique_parks, 2);
  t.is(agg.activation_count, 2);
  t.deepEqual(agg.activators.sort(), ['K1XYZ', 'W0ARR']);
  t.deepEqual(agg.parks.sort(), ['K-1234', 'K-5678']);
});

test('aggregateSpotsToHourly separates different modes', t => {
  const spots: NormalizedSpot[] = [
    {
      ts: '2024-03-15T09:30:00Z',
      spotId: 1,
      activator: 'W0ARR',
      reference: 'K-1234',
      freq: 7137,
      mode: 'SSB',
      band: '40m',
      source: 'POTA',
      entity: 'K',
      grid: 'FN31',
      lat: 42.0,
      lon: -72.0,
      name: 'Test1',
      spotter: 'W1ABC',
    },
    {
      ts: '2024-03-15T09:31:00Z',
      spotId: 2,
      activator: 'K1XYZ',
      reference: 'K-5678',
      freq: 7030,
      mode: 'CW',
      band: '40m',
      source: 'POTA',
      entity: 'K',
      grid: 'EN82',
      lat: 40.0,
      lon: -80.0,
      name: 'Test2',
      spotter: 'W2DEF',
    },
  ];

  const aggregates = aggregateSpotsToHourly(spots, '2024-03-15T09:00:00.000Z');

  t.is(aggregates.length, 2);
  const modes = aggregates.map(a => a.mode).sort();
  t.deepEqual(modes, ['CW', 'SSB']);
});

test('aggregateSpotsToHourly counts same activator at same park once', t => {
  const spots: NormalizedSpot[] = [
    {
      ts: '2024-03-15T09:30:00Z',
      spotId: 1,
      activator: 'W0ARR',
      reference: 'K-1234',
      freq: 7137,
      mode: 'SSB',
      band: '40m',
      source: 'POTA',
      entity: 'K',
      grid: 'FN31',
      lat: 42.0,
      lon: -72.0,
      name: 'Test1',
      spotter: 'W1ABC',
    },
    {
      ts: '2024-03-15T09:35:00Z',
      spotId: 2,
      activator: 'W0ARR', // Same activator
      reference: 'K-1234', // Same park
      freq: 7137,
      mode: 'SSB',
      band: '40m',
      source: 'POTA',
      entity: 'K',
      grid: 'FN31',
      lat: 42.0,
      lon: -72.0,
      name: 'Test1',
      spotter: 'W2DEF',
    },
  ];

  const aggregates = aggregateSpotsToHourly(spots, '2024-03-15T09:00:00.000Z');

  t.is(aggregates.length, 1);
  const agg = aggregates[0]!;
  t.is(agg.spot_count, 2);
  t.is(agg.unique_activators, 1);
  t.is(agg.unique_parks, 1);
  t.is(agg.activation_count, 1); // Same activator at same park = 1 activation
});

test('aggregateSpotsToHourly handles empty spots array', t => {
  const aggregates = aggregateSpotsToHourly([], '2024-03-15T09:00:00.000Z');
  t.deepEqual(aggregates, []);
});

// mergeAggregatesIntoGroups tests
test('mergeAggregatesIntoGroups merges aggregates correctly', t => {
  const aggregates: HourlyAggregate[] = [
    {
      hour: '2024-03-15T09:00:00.000Z',
      mode: 'SSB',
      band: '40m',
      entity: 'K',
      spot_count: 5,
      activation_count: 2,
      unique_activators: 2,
      unique_parks: 2,
      activators: ['W0ARR', 'K1XYZ'],
      parks: ['K-1234', 'K-5678'],
      activations: ['W0ARR|K-1234', 'K1XYZ|K-5678'],
    },
    {
      hour: '2024-03-15T10:00:00.000Z',
      mode: 'SSB',
      band: '40m',
      entity: 'K',
      spot_count: 3,
      activation_count: 1,
      unique_activators: 1,
      unique_parks: 1,
      activators: ['W0ARR'], // Same activator
      parks: ['K-9999'], // New park
      activations: ['W0ARR|K-9999'],
    },
  ];

  const groups = new Map<string, AggregateGroup>();
  mergeAggregatesIntoGroups(aggregates, groups);

  t.is(groups.size, 1);
  const group = groups.get('SSB|40m|K')!;
  t.is(group.spotCount, 8);
  t.is(group.activators.size, 2); // W0ARR and K1XYZ
  t.is(group.parks.size, 3); // K-1234, K-5678, K-9999
  t.is(group.activations.size, 3);
});

test('mergeAggregatesIntoGroups creates separate groups for different modes', t => {
  const aggregates: HourlyAggregate[] = [
    {
      hour: '2024-03-15T09:00:00.000Z',
      mode: 'SSB',
      band: '40m',
      entity: 'K',
      spot_count: 5,
      activation_count: 1,
      unique_activators: 1,
      unique_parks: 1,
      activators: ['W0ARR'],
      parks: ['K-1234'],
      activations: ['W0ARR|K-1234'],
    },
    {
      hour: '2024-03-15T09:00:00.000Z',
      mode: 'CW',
      band: '40m',
      entity: 'K',
      spot_count: 3,
      activation_count: 1,
      unique_activators: 1,
      unique_parks: 1,
      activators: ['K1XYZ'],
      parks: ['K-5678'],
      activations: ['K1XYZ|K-5678'],
    },
  ];

  const groups = new Map<string, AggregateGroup>();
  mergeAggregatesIntoGroups(aggregates, groups);

  t.is(groups.size, 2);
  t.true(groups.has('SSB|40m|K'));
  t.true(groups.has('CW|40m|K'));
});

test('mergeAggregatesIntoGroups handles empty array', t => {
  const groups = new Map<string, AggregateGroup>();
  mergeAggregatesIntoGroups([], groups);
  t.is(groups.size, 0);
});
