import type {
  AllTimeSummary,
  PeriodStats,
  TopEntitiesSummary,
} from '@pota-stats/shared/summary-types';
import { SUMMARY_FILES, type SummaryFile } from './config';

export interface PageSummaryData {
  allTime: AllTimeSummary | null;
  thirtyDay: PeriodStats | null;
  topEntities: TopEntitiesSummary | null;
  updatedAt: Date | null;
}

export function isSummaryFile(value: string): value is SummaryFile {
  return SUMMARY_FILES.includes(value as SummaryFile);
}

export async function readSummary<T>(r2: R2Bucket, file: SummaryFile): Promise<T | null> {
  const object = await r2.get(`summaries/${file}`);
  if (!object) return null;
  return await object.json<T>();
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function latestDate(values: (string | undefined)[]): Date | null {
  const timestamps = values
    .map(parseDate)
    .filter((date): date is Date => Boolean(date))
    .map((date) => date.getTime());

  return timestamps.length ? new Date(Math.max(...timestamps)) : null;
}

export async function loadPageSummaryData(r2: R2Bucket): Promise<PageSummaryData> {
  const [allTime, thirtyDay, topEntities] = await Promise.all([
    readSummary<AllTimeSummary>(r2, 'all_time.json'),
    readSummary<PeriodStats>(r2, 'stats_30d.json'),
    readSummary<TopEntitiesSummary>(r2, 'top_entities.json'),
  ]);

  return {
    allTime,
    thirtyDay,
    topEntities,
    updatedAt: latestDate([
      allTime?.updated_at,
      thirtyDay?.updated_at,
      topEntities?.updated_at,
    ]),
  };
}
