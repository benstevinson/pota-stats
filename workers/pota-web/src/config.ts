export const SITE_URL = 'https://w0arr.com';
export const PAGE_PATH = '/pota-stats/';
export const PAGE_URL = `${SITE_URL}${PAGE_PATH}`;
export const API_BASE_PATH = '/pota-stats/api';
export const ASSET_APP_PATH = '/pota-stats/assets/app.js';
export const TITLE = 'Parks on the Air Statistics and Activation Trends';
export const FULL_TITLE = `${TITLE} | W0ARR`;
export const DESCRIPTION = 'Live statistics and historical trends for Parks on the Air (POTA) activations. Track band activity, mode popularity, and activator counts over time.';

export const SUMMARY_FILES = [
  'all_time.json',
  'stats_24h.json',
  'stats_7d.json',
  'stats_30d.json',
  'stats_all.json',
  'trends.json',
  'time_of_day.json',
  'day_of_week.json',
  'top_entities.json',
] as const;

export type SummaryFile = (typeof SUMMARY_FILES)[number];

export const DATA_DOWNLOADS: { file: SummaryFile; name: string }[] = [
  { file: 'all_time.json', name: 'All-time POTA spot summary' },
  { file: 'stats_24h.json', name: 'Past 24 hours POTA spot summary' },
  { file: 'stats_7d.json', name: 'Past 7 days POTA spot summary' },
  { file: 'stats_30d.json', name: 'Past 30 days POTA spot summary' },
  { file: 'trends.json', name: 'POTA activator trend summary' },
  { file: 'top_entities.json', name: 'Top POTA parks and states summary' },
];
