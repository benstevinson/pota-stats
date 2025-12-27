# POTA Stats

Parks on the Air (POTA) statistics collection, aggregation, and querying library.

## Overview

This monorepo provides:

- **Cloudflare Workers** for collecting and aggregating POTA spot data
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
│           └── index.ts     # Barrel exports
├── workers/
│   ├── pota-collector/      # Collects raw spot data from POTA API
│   └── pota-aggregator/     # Aggregates data (hourly, daily, monthly)
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
