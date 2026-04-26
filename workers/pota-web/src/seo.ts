import { DESCRIPTION, PAGE_URL, SITE_URL, TITLE } from './config';
import type { PageSummaryData } from './summaries';

export function renderSitemap(data: PageSummaryData): string {
  const lastmod = data.updatedAt?.toISOString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${PAGE_URL}</loc>${lastmod ? `
    <lastmod>${lastmod}</lastmod>` : ''}
  </url>
</urlset>
`;
}

export function renderLlmsTxt(data: PageSummaryData): string {
  const updated = data.updatedAt ? `\nLatest data rollup: ${data.updatedAt.toISOString()}` : '';

  return `# ${TITLE}

> ${DESCRIPTION}
${updated}

## Page

- [POTA Statistics](${PAGE_URL}): Interactive Parks on the Air spot statistics, band and mode trends, activator counts, and methodology.

## Data

- [All-time POTA summary](${SITE_URL}/pota-stats/api/summaries/all_time.json): Aggregate spot, activation, activator, and park counts.
- [Past 24 hours POTA summary](${SITE_URL}/pota-stats/api/summaries/stats_24h.json): Recent band, mode, and entity breakdowns.
- [Past 7 days POTA summary](${SITE_URL}/pota-stats/api/summaries/stats_7d.json): Weekly band, mode, and entity breakdowns.
- [Past 30 days POTA summary](${SITE_URL}/pota-stats/api/summaries/stats_30d.json): Monthly band, mode, and entity breakdowns.
- [POTA trends](${SITE_URL}/pota-stats/api/summaries/trends.json): Daily, weekly, and monthly activator trends.
- [Top POTA entities](${SITE_URL}/pota-stats/api/summaries/top_entities.json): Top parks and US states by unique activators.

## Related

- [Main site](${SITE_URL}/)
- [POTA app](https://pota.app/)
- [Source code](https://github.com/benstevinson/pota-stats/)
`;
}
