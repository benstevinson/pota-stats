# POTA Stats

Parks on the Air (POTA) statistics collection, aggregation, and querying library.

## Overview

This monorepo provides:

- **Cloudflare Workers** for collecting and aggregating POTA spot data
- **Summary JSON files** in R2: the public interface that dashboards read
- **TypeScript modules** for querying aggregated data using DuckDB WASM
- **Data loading utilities** for fetching and processing NDJSON files from R2

## Structure

```
pota-stats/
├── packages/
│   └── shared/              # Shared TypeScript modules
│       └── src/
│           ├── types.ts     # Type definitions
│           ├── constants.ts # Band order, time ranges
│           ├── queries.ts   # DuckDB query functions
│           ├── data.ts      # Data loading and manifest handling
│           ├── summary-types.ts # Summary JSON contracts
│           └── index.ts     # Barrel exports
├── workers/
│   ├── pota-collector/      # Collects raw spot data from POTA API
│   └── pota-aggregator/     # Aggregates data and writes summary JSON
├── common/
│   └── config/rush/         # Rush configuration
├── rush.json                # Rush monorepo config
└── pnpm-workspace.yaml      # pnpm workspace config
```

## Getting Started

This project uses [Rush](https://rushjs.io/) with pnpm for monorepo management.

### Prerequisites

- Node.js >= 18
- Install Rush globally: `npm install -g @microsoft/rush`

### Installation

```bash
rush update
```

### Building

```bash
rush build
```

### Deploying Workers

```bash
# Deploy collector
rush deploy:collector

# Deploy aggregator
rush deploy:aggregator

# Deploy all
rush deploy:all
```

## Workers

### pota-collector

Runs every minute to fetch current spots from the POTA API and store them in R2.

### pota-aggregator

Scheduled aggregation worker:
- **Hourly** (`:05`): Aggregates raw minute data into hourly NDJSON
- **Daily** (`00:15 UTC`): Rolls up hourly data into daily summaries
- **Monthly** (`00:30 UTC on 1st`): Rolls up daily data into monthly summaries

Each run also repairs recent gaps: the hourly run rolls up any hour in the
past 24 hours, and the daily run any day in the past 7 days, that has source
files but no rollup. The daily run also rolls up last month if it is missing.
A period that already has a rollup is never rolled up again, because readers
merge every file under a prefix and would count it twice.

All R2 calls in the collector and aggregator retry transient errors (such as
`internal error (10001)`) with backoff. Neither worker deletes objects.

Manual endpoints need `POST` and `Authorization: Bearer $ADMIN_TOKEN`
(`wrangler secret put ADMIN_TOKEN`):

```bash
# Roll up one completed UTC period if it has no rollup yet
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://pota-aggregator.<subdomain>.workers.dev/aggregate?level=day&date=2026-11-21"

# Regenerate the summary files
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://pota-aggregator.<subdomain>.workers.dev/generate-summaries"
```

`level` is `hour` (`YYYY-MM-DDTHH`), `day` (`YYYY-MM-DD`), or `month` (`YYYY-MM`).

## Summary files

The aggregator writes these files to the `pota-data` R2 bucket under
`summaries/` every hour. Their shapes are defined in
[`packages/shared/src/summary-types.ts`](packages/shared/src/summary-types.ts).
Treat them as a public API: add fields freely, but rename or remove a field
only together with every reader.

| File | Contents | Window |
| --- | --- | --- |
| `all_time.json` | Spots, spotted activations, activators, parks | All time |
| `stats_24h.json`, `stats_7d.json`, `stats_30d.json`, `stats_all.json` | Totals and breakdowns by mode, band, and entity | As named |
| `trends.json` | Unique activators, total and by CW/SSB/Digital | Daily (14 days), weekly (14 weeks), monthly (12 months) |
| `time_of_day.json` | Spots by UTC hour | Past 24 hours |
| `day_of_week.json` | Spots by UTC day (0 = Sunday) | Past 7 days |
| `top_entities.json` | Top parks and US states by unique activators | Past 14 days |

## Dashboard

The public dashboard at [w0arr.com/pota-stats/](https://w0arr.com/pota-stats/)
lives in the [w0arr.com](https://github.com/benstevinson/w0arr.com) site. It
reads the summary files from R2 and also serves them as JSON at
`https://w0arr.com/pota-stats/api/summaries/<file>`. To build your own view,
read that API or bind the bucket in your own Worker.

## Usage

```typescript
import {
  initDuckDB,
  loadManifest,
  filterManifestByTimeRange,
  loadDataIntoView,
  getStats,
  getModeData,
  getBandData,
} from '@pota-stats/shared';

// Initialize DuckDB WASM
const { db, conn } = await initDuckDB();

// Load manifest and filter by time range
const manifest = await loadManifest(R2_BASE_URL);
const urls = filterManifestByTimeRange(manifest, '24h', R2_BASE_URL);

// Load data into DuckDB
await loadDataIntoView(db, conn, urls);

// Query the data
const stats = await getStats(conn);
const modeData = await getModeData(conn);
```

## License

MIT
