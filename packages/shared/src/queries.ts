import type { PotaStats, ModeData, BandData, CategoryBreakdown, GroupBy, TrendPeriod, ActivatorTrendData, ActivatorByModeTrendData } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AsyncDuckDBConnection = any;

async function queryOne<T>(conn: AsyncDuckDBConnection, sql: string): Promise<T | null> {
  const result = await conn.query(sql);
  const rows = result.toArray();
  return rows[0] as T | null;
}

async function queryAll<T>(conn: AsyncDuckDBConnection, sql: string): Promise<T[]> {
  const result = await conn.query(sql);
  return result.toArray() as T[];
}

export async function getStats(conn: AsyncDuckDBConnection): Promise<PotaStats> {
  const [spots, activators, parks, activations, topMode] = await Promise.all([
    queryOne<{ total: number }>(conn, `SELECT SUM(spot_count) as total FROM spots`),
    queryOne<{ total: number }>(conn, `SELECT COUNT(DISTINCT activator) as total FROM spots, UNNEST(activators) as t(activator)`),
    queryOne<{ total: number }>(conn, `SELECT COUNT(DISTINCT park) as total FROM spots, UNNEST(parks) as t(park)`),
    queryOne<{ total: number }>(conn, `SELECT COUNT(DISTINCT activation) as total FROM spots, UNNEST(activations) as t(activation)`),
    queryOne<{ mode: string }>(conn, `
      SELECT mode
      FROM spots
      GROUP BY mode
      ORDER BY SUM(spot_count) DESC
      LIMIT 1
    `),
  ]);

  return {
    totalSpots: Number(spots?.total ?? 0),
    totalActivations: Number(activations?.total ?? 0),
    uniqueActivators: Number(activators?.total ?? 0),
    uniqueParks: Number(parks?.total ?? 0),
    topMode: topMode?.mode ?? null,
  };
}

export async function getModeData(conn: AsyncDuckDBConnection): Promise<ModeData[]> {
  return queryAll<ModeData>(conn, `
    SELECT mode, SUM(spot_count) as count
    FROM spots
    GROUP BY mode
    ORDER BY count DESC
  `);
}

export async function getBandData(conn: AsyncDuckDBConnection): Promise<BandData[]> {
  return queryAll<BandData>(conn, `
    SELECT band, SUM(spot_count) as count
    FROM spots
    GROUP BY band
  `);
}

const BREAKDOWN_QUERIES: Record<GroupBy, string> = {
  mode: `
    WITH activator_counts AS (
      SELECT mode, COUNT(DISTINCT activator) as activators
      FROM spots, UNNEST(activators) as t(activator)
      GROUP BY mode
    ),
    park_counts AS (
      SELECT mode, COUNT(DISTINCT park) as parks
      FROM spots, UNNEST(parks) as t(park)
      GROUP BY mode
    ),
    activation_counts AS (
      SELECT mode, COUNT(DISTINCT activation) as activations
      FROM spots, UNNEST(activations) as t(activation)
      GROUP BY mode
    )
    SELECT s.mode as category,
           COALESCE(ac.activations, 0) as activations,
           SUM(s.spot_count) as spots,
           COALESCE(act.activators, 0) as activators,
           COALESCE(pc.parks, 0) as parks
    FROM spots s
    LEFT JOIN activator_counts act ON s.mode = act.mode
    LEFT JOIN park_counts pc ON s.mode = pc.mode
    LEFT JOIN activation_counts ac ON s.mode = ac.mode
    GROUP BY s.mode, ac.activations, act.activators, pc.parks
    ORDER BY activations DESC
  `,
  band: `
    WITH activator_counts AS (
      SELECT band, COUNT(DISTINCT activator) as activators
      FROM spots, UNNEST(activators) as t(activator)
      GROUP BY band
    ),
    park_counts AS (
      SELECT band, COUNT(DISTINCT park) as parks
      FROM spots, UNNEST(parks) as t(park)
      GROUP BY band
    ),
    activation_counts AS (
      SELECT band, COUNT(DISTINCT activation) as activations
      FROM spots, UNNEST(activations) as t(activation)
      GROUP BY band
    )
    SELECT s.band as category,
           COALESCE(ac.activations, 0) as activations,
           SUM(s.spot_count) as spots,
           COALESCE(act.activators, 0) as activators,
           COALESCE(pc.parks, 0) as parks
    FROM spots s
    LEFT JOIN activator_counts act ON s.band = act.band
    LEFT JOIN park_counts pc ON s.band = pc.band
    LEFT JOIN activation_counts ac ON s.band = ac.band
    GROUP BY s.band, ac.activations, act.activators, pc.parks
    ORDER BY activations DESC
  `,
  entity: `
    WITH activator_counts AS (
      SELECT entity, COUNT(DISTINCT activator) as activators
      FROM spots, UNNEST(activators) as t(activator)
      GROUP BY entity
    ),
    park_counts AS (
      SELECT entity, COUNT(DISTINCT park) as parks
      FROM spots, UNNEST(parks) as t(park)
      GROUP BY entity
    ),
    activation_counts AS (
      SELECT entity, COUNT(DISTINCT activation) as activations
      FROM spots, UNNEST(activations) as t(activation)
      GROUP BY entity
    )
    SELECT s.entity as category,
           COALESCE(ac.activations, 0) as activations,
           SUM(s.spot_count) as spots,
           COALESCE(act.activators, 0) as activators,
           COALESCE(pc.parks, 0) as parks
    FROM spots s
    LEFT JOIN activator_counts act ON s.entity = act.entity
    LEFT JOIN park_counts pc ON s.entity = pc.entity
    LEFT JOIN activation_counts ac ON s.entity = ac.entity
    GROUP BY s.entity, ac.activations, act.activators, pc.parks
    ORDER BY activations DESC
    LIMIT 20
  `,
};

export async function getCategoryBreakdown(
  conn: AsyncDuckDBConnection,
  groupBy: GroupBy
): Promise<CategoryBreakdown[]> {
  const sql = BREAKDOWN_QUERIES[groupBy];
  return queryAll<CategoryBreakdown>(conn, sql);
}

const PERIOD_CONFIGS: Record<TrendPeriod, { truncate: string; limit: number; format: string }> = {
  daily: { truncate: 'day', limit: 14, format: '%m/%d' },
  weekly: { truncate: 'week', limit: 14, format: '%m/%d' },
  monthly: { truncate: 'month', limit: 12, format: '%Y-%m' },
};

export async function getActivatorTrend(
  conn: AsyncDuckDBConnection,
  period: TrendPeriod
): Promise<ActivatorTrendData[]> {
  const config = PERIOD_CONFIGS[period];
  const sql = `
    WITH period_activators AS (
      SELECT
        DATE_TRUNC('${config.truncate}', hour::TIMESTAMP) as period,
        activator
      FROM spots, UNNEST(activators) as t(activator)
    )
    SELECT
      strftime(period, '${config.format}') as period,
      COUNT(DISTINCT activator) as uniqueActivators
    FROM period_activators
    GROUP BY period
    ORDER BY period DESC
    LIMIT ${config.limit}
  `;
  const results = await queryAll<{ period: string; uniqueActivators: number }>(conn, sql);
  return results.reverse();
}

// Mode categories for trend analysis
const MODE_CATEGORIES = {
  cw: ['CW'],
  ssb: ['SSB', 'AM', 'FM', 'LSB', 'USB'],
  digital: ['FT8', 'FT4', 'RTTY', 'PSK31', 'PSK', 'JS8', 'MFSK', 'OLIVIA', 'SSTV', 'DIGITAL'],
};

export async function getActivatorByModeTrend(
  conn: AsyncDuckDBConnection,
  period: TrendPeriod
): Promise<ActivatorByModeTrendData[]> {
  const config = PERIOD_CONFIGS[period];

  // Build CASE expressions for mode categorization
  const cwModes = MODE_CATEGORIES.cw.map(m => `'${m}'`).join(', ');
  const ssbModes = MODE_CATEGORIES.ssb.map(m => `'${m}'`).join(', ');
  const digitalModes = MODE_CATEGORIES.digital.map(m => `'${m}'`).join(', ');

  const sql = `
    WITH base_data AS (
      SELECT
        DATE_TRUNC('${config.truncate}', hour::TIMESTAMP) as period,
        mode,
        activator
      FROM spots, UNNEST(activators) as t(activator)
    ),
    cw_activators AS (
      SELECT period, COUNT(DISTINCT activator) as cnt
      FROM base_data
      WHERE UPPER(mode) IN (${cwModes})
      GROUP BY period
    ),
    ssb_activators AS (
      SELECT period, COUNT(DISTINCT activator) as cnt
      FROM base_data
      WHERE UPPER(mode) IN (${ssbModes})
      GROUP BY period
    ),
    digital_activators AS (
      SELECT period, COUNT(DISTINCT activator) as cnt
      FROM base_data
      WHERE UPPER(mode) IN (${digitalModes})
      GROUP BY period
    ),
    all_periods AS (
      SELECT DISTINCT period FROM base_data
    )
    SELECT
      strftime(p.period, '${config.format}') as period,
      COALESCE(cw.cnt, 0) as cw,
      COALESCE(ssb.cnt, 0) as ssb,
      COALESCE(dig.cnt, 0) as digital
    FROM all_periods p
    LEFT JOIN cw_activators cw ON p.period = cw.period
    LEFT JOIN ssb_activators ssb ON p.period = ssb.period
    LEFT JOIN digital_activators dig ON p.period = dig.period
    ORDER BY p.period DESC
    LIMIT ${config.limit}
  `;

  const results = await queryAll<ActivatorByModeTrendData>(conn, sql);
  return results.reverse();
}
