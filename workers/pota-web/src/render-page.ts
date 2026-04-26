import type { BandStats, ModeStats } from '@pota-stats/shared/summary-types';
import {
  API_BASE_PATH,
  ASSET_APP_PATH,
  DATA_DOWNLOADS,
  DESCRIPTION,
  FULL_TITLE,
  PAGE_URL,
  SITE_URL,
  TITLE,
} from './config';
import type { PageSummaryData } from './summaries';
import { PAGE_CSS } from './styles';

const numberFormatter = new Intl.NumberFormat('en-US');
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});
const monthFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  timeZone: 'UTC',
  year: 'numeric',
});

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatNumber(value: number | undefined): string {
  return value == null ? '-' : numberFormatter.format(value);
}

function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replaceAll('<', '\\u003c');
}

function dataSinceLabel(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(`${value}-01T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : monthFormatter.format(date);
}

function renderModeRows(rows: ModeStats[]): string {
  return rows
    .slice(0, 5)
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.mode)}</td><td>${formatNumber(row.spots)}</td><td>${formatNumber(row.activators)}</td></tr>`,
    )
    .join('');
}

function renderBandRows(rows: BandStats[]): string {
  return rows
    .slice(0, 5)
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.band)}</td><td>${formatNumber(row.spots)}</td><td>${formatNumber(row.activators)}</td></tr>`,
    )
    .join('');
}

function renderStaticSummary(data: PageSummaryData): string {
  const since = dataSinceLabel(data.allTime?.data_since);
  const updated = data.updatedAt
    ? ` Latest rollup: <time datetime="${data.updatedAt.toISOString()}">${dateFormatter.format(data.updatedAt)} UTC</time>.`
    : '';
  const collectionStart = since ? ` Data collection started in ${escapeHtml(since)}.` : '';
  const topParks = data.topEntities?.top_parks.slice(0, 5) ?? [];
  const topStates = data.topEntities?.top_states.slice(0, 5) ?? [];

  return `
    <section class="static-summary" aria-labelledby="pota-snapshot-heading">
      <h2 id="pota-snapshot-heading">Current POTA Snapshot</h2>
      <p>This snapshot is built from aggregated POTA spot summaries.${collectionStart}${updated}</p>
      ${
        data.allTime
          ? `<div class="stats-grid">
              <div class="stat-card"><div class="stat-value">${formatNumber(data.allTime.total_activations)}</div><div class="stat-label">Spotted Activations</div></div>
              <div class="stat-card"><div class="stat-value">${formatNumber(data.allTime.total_spots)}</div><div class="stat-label">Spot Reports</div></div>
              <div class="stat-card"><div class="stat-value">${formatNumber(data.allTime.unique_activators)}</div><div class="stat-label">Unique Activators</div></div>
              <div class="stat-card"><div class="stat-value">${formatNumber(data.allTime.unique_parks)}</div><div class="stat-label">Unique Parks</div></div>
            </div>`
          : ''
      }
      <div class="static-tables">
        ${
          data.thirtyDay?.by_mode.length
            ? `<div>
                <h3>Top Modes, Past 30 Days</h3>
                <table class="static-table"><thead><tr><th>Mode</th><th>Spots</th><th>Activators</th></tr></thead><tbody>${renderModeRows(data.thirtyDay.by_mode)}</tbody></table>
              </div>`
            : ''
        }
        ${
          data.thirtyDay?.by_band.length
            ? `<div>
                <h3>Top Bands, Past 30 Days</h3>
                <table class="static-table"><thead><tr><th>Band</th><th>Spots</th><th>Activators</th></tr></thead><tbody>${renderBandRows(data.thirtyDay.by_band)}</tbody></table>
              </div>`
            : ''
        }
        ${
          topParks.length
            ? `<div>
                <h3>Top Parks, Rolling 14 Days</h3>
                <table class="static-table"><thead><tr><th>Park</th><th>Activators</th></tr></thead><tbody>${topParks.map((row) => `<tr><td>${escapeHtml(row.reference)}</td><td>${formatNumber(row.activators)}</td></tr>`).join('')}</tbody></table>
              </div>`
            : ''
        }
        ${
          topStates.length
            ? `<div>
                <h3>Top US States, Rolling 14 Days</h3>
                <table class="static-table"><thead><tr><th>State</th><th>Activators</th></tr></thead><tbody>${topStates.map((row) => `<tr><td>${escapeHtml(row.state)}</td><td>${formatNumber(row.activators)}</td></tr>`).join('')}</tbody></table>
              </div>`
            : ''
        }
      </div>
      <p>A spotted activation is counted as a unique callsign and park reference in the spot stream. These summaries do not verify the 10 or more contacts required for an official POTA activation.</p>
    </section>
  `;
}

function renderJsonLd(data: PageSummaryData): string {
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: TITLE,
        description: DESCRIPTION,
        url: PAGE_URL,
        applicationCategory: 'Amateur Radio',
        operatingSystem: 'Web Browser',
      },
      {
        '@type': 'Dataset',
        name: 'Parks on the Air Spot Statistics',
        description: 'Aggregated Parks on the Air spot statistics, including activations, spots, activators, parks, bands, modes, and entity trends.',
        url: PAGE_URL,
        creator: {
          '@id': `${SITE_URL}/about/#ben-stevinson`,
          '@type': 'Person',
          alternateName: 'W0ARR',
          name: 'Ben Stevinson',
          url: `${SITE_URL}/about/`,
          sameAs: [
            'https://www.qrz.com/db/W0ARR',
            'https://www.linkedin.com/in/ben-stevinson/',
            'https://x.com/benstevinson',
            'https://pota.app/#/profile/W0ARR',
            'https://stevinson.org',
          ],
        },
        isAccessibleForFree: true,
        keywords: ['Parks on the Air', 'POTA', 'amateur radio', 'ham radio', 'spot data', 'activations'],
        datePublished: '2025-12-27',
        ...(data.updatedAt ? { dateModified: data.updatedAt.toISOString() } : {}),
        ...(data.allTime?.data_since ? { temporalCoverage: `${data.allTime.data_since}/..` } : {}),
        isBasedOn: {
          '@type': 'WebSite',
          name: 'Parks on the Air',
          url: 'https://pota.app/',
        },
        distribution: DATA_DOWNLOADS.map(({ file, name }) => ({
          '@type': 'DataDownload',
          contentUrl: `${SITE_URL}${API_BASE_PATH}/summaries/${file}`,
          encodingFormat: 'application/json',
          name,
        })),
      },
    ],
  };

  return safeJsonLd(schema);
}

export function renderPage(data: PageSummaryData): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(FULL_TITLE)}</title>
    <meta name="description" content="${escapeHtml(DESCRIPTION)}">
    <meta name="author" content="Ben Stevinson">
    <meta name="robots" content="max-snippet:-1, max-image-preview:large, max-video-preview:-1">
    <link rel="canonical" href="${PAGE_URL}">
    <link rel="alternate" type="application/xml" title="POTA Stats Sitemap" href="/pota-stats/sitemap.xml">
    <link rel="alternate" type="text/plain" title="POTA Stats LLMs TXT" href="/pota-stats/llms.txt">
    <meta property="og:site_name" content="W0ARR">
    <meta property="og:type" content="website">
    <meta property="og:title" content="${escapeHtml(FULL_TITLE)}">
    <meta property="og:description" content="${escapeHtml(DESCRIPTION)}">
    <meta property="og:url" content="${PAGE_URL}">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${escapeHtml(FULL_TITLE)}">
    <meta name="twitter:description" content="${escapeHtml(DESCRIPTION)}">
    <script type="application/ld+json">${renderJsonLd(data)}</script>
    <style>${PAGE_CSS}</style>
  </head>
  <body>
    <main>
      <header class="site-header">
        <p class="site-brand"><a href="/">W0ARR</a></p>
        <nav aria-label="Main navigation">
          <a href="/">Home</a>
          <a href="/projects/">Projects</a>
          <a href="/about/">About</a>
        </nav>
      </header>
      <h1>POTA Statistics</h1>
      <p style="color:#666;margin-bottom:1rem;font-size:.9em;">
        Historical <a href="https://parksontheair.com?utm_source=w0arr.com" target="_blank" rel="noopener">Parks on The Air</a> spot data.
        Track which bands, modes, and parks are the most popular across the program.
      </p>
      ${renderStaticSummary(data)}
      ${renderInteractiveShell()}
      ${renderFaqAndFooter()}
    </main>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js"></script>
    <script>
      if (window.Chart && window.ChartDataLabels) {
        window.Chart.register(window.ChartDataLabels);
      }
    </script>
    <script type="module" src="${ASSET_APP_PATH}"></script>
  </body>
</html>`;
}

function renderInteractiveShell(): string {
  return `
    <div id="loading-status" class="loading-status">Initializing Stats, give it a sec<span class="loading-dots">...</span></div>
    <div id="data-timestamp" class="data-timestamp" style="display:none;"></div>
    <div id="all-time-section" style="display:none;">
      <h2 class="section-title" style="margin-top:0;border-top:none;padding-top:0;">All Time Stats</h2>
      <p class="section-desc" id="all-time-desc">Cumulative statistics since data collection began.</p>
      <div class="stats-grid" id="all-time-stats-grid">
        <div class="stat-card" title="Unique activator + park combinations spotted. Does not verify 10+ contacts required for valid POTA activation."><div class="stat-value" id="all-time-activations">-</div><div class="stat-label">Spotted Activations*</div></div>
        <div class="stat-card"><div class="stat-value" id="all-time-spots">-</div><div class="stat-label">Spot Reports</div></div>
        <div class="stat-card"><div class="stat-value" id="all-time-activators">-</div><div class="stat-label">Unique Activators</div></div>
        <div class="stat-card"><div class="stat-value" id="all-time-parks">-</div><div class="stat-label">Unique Parks</div></div>
      </div>
    </div>
    <div id="spot-stats-section" style="display:none;"><h2 class="section-title">Spot Statistics</h2><p class="section-desc">Analyze POTA spot activity by mode, band, and location. Data updates every hour.</p></div>
    <div class="controls" id="controls" style="display:none;">
      <div class="control-group"><label for="time-range">Time Range</label><select id="time-range"><option value="24h" selected>Last 24 Hours</option><option value="7d">Last 7 Days</option><option value="30d">Last 30 Days</option></select></div>
    </div>
    <div class="stats-grid" id="stats-grid" style="display:none;">
      <div class="stat-card" title="Unique activator + park combinations spotted."><div class="stat-value" id="total-activations">-</div><div class="stat-label">Spotted Activations*</div></div>
      <div class="stat-card"><div class="stat-value" id="total-spots">-</div><div class="stat-label">Spot Reports</div></div>
      <div class="stat-card"><div class="stat-value" id="unique-activators">-</div><div class="stat-label">Unique Activators</div></div>
      <div class="stat-card"><div class="stat-value" id="unique-parks">-</div><div class="stat-label">Unique Parks</div></div>
    </div>
    <div class="chart-container" id="mode-chart-container" style="display:none;"><h3>Activity by Mode</h3><p class="chart-desc">Distribution of spot reports across operating modes (CW, SSB, FT8, etc.).</p><div class="chart-wrapper"><canvas id="mode-chart"></canvas></div></div>
    <div class="chart-container" id="band-chart-container" style="display:none;">
      <div class="table-header"><h3>Activity by Band</h3><div class="control-group"><label for="band-order">Order By</label><select id="band-order"><option value="count" selected>Most Used</option><option value="frequency">Frequency</option></select></div></div>
      <p class="chart-desc" id="band-chart-desc">Distribution of spot reports across amateur radio bands, ordered by popularity.</p><div class="chart-wrapper"><canvas id="band-chart"></canvas></div>
    </div>
    <div class="chart-container" id="table-container" style="display:none;">
      <div class="table-header"><h3>Detailed Breakdown</h3><div class="control-group"><label for="group-by">Group By</label><select id="group-by"><option value="mode" selected>Mode</option><option value="band">Band</option><option value="entity">Entity (Country)</option></select></div></div>
      <table class="data-table" id="data-table"><thead><tr><th>Category</th><th>Activations</th><th>Spots</th><th>Activators</th><th>Parks</th></tr></thead><tbody id="table-body"></tbody></table>
    </div>
    <div id="activator-stats-section" style="display:none;">
      <h2 class="section-title">Activator Statistics</h2><p class="section-desc">Track unique activator trends over time to understand hobby participation patterns.</p>
      <div class="controls"><div class="control-group"><label for="trend-period">Time Scale</label><select id="trend-period"><option value="daily" selected>Daily (14 days)</option><option value="weekly">Weekly (14 weeks)</option><option value="monthly">Monthly (12 months)</option></select></div></div>
      <div class="chart-container"><h3>Unique Activators Over Time</h3><div class="chart-wrapper"><canvas id="activator-trend-chart"></canvas></div></div>
      <div class="chart-container"><h3>Unique Activators by Mode</h3><p class="chart-desc">An activator using multiple modes counts once per mode category.</p><div class="chart-wrapper"><canvas id="activator-mode-trend-chart"></canvas></div></div>
    </div>
    <div id="time-of-day-section" style="display:none;">
      <h2 class="section-title">Activity by Time of Day</h2><p class="section-desc">Spot activity aggregated by hour to show when POTA is most active.</p>
      <div class="chart-container"><div class="table-header"><h3>Hourly Activity Distribution</h3><div class="control-group"><label class="toggle-label"><input type="checkbox" id="time-utc-toggle"><span class="toggle-text">UTC</span></label></div></div><p class="chart-desc" id="time-of-day-desc">Shows when spot reports are most frequent throughout the day (local time).</p><div class="chart-wrapper"><canvas id="time-of-day-chart"></canvas></div></div>
    </div>
    <div id="day-of-week-section" style="display:none;">
      <h2 class="section-title">Activity by Day of Week</h2><p class="section-desc">Spot activity aggregated by day to show which days POTA is most active.</p>
      <div class="chart-container"><div class="table-header"><h3>Daily Activity Distribution</h3><div class="control-group"><label class="toggle-label"><input type="checkbox" id="day-utc-toggle"><span class="toggle-text">UTC</span></label></div></div><p class="chart-desc" id="day-of-week-desc">Shows which days of the week have the most spot activity (local time).</p><div class="chart-wrapper"><canvas id="day-of-week-chart"></canvas></div></div>
    </div>
    <div id="entity-stats-section" style="display:none;">
      <h2 class="section-title">Entity Statistics - Past 14 Days Rolling</h2><p class="section-desc">Top parks and US states by unique activator count.</p>
      <div class="entity-tables">
        <div class="chart-container"><h3>Top Parks by Unique Activators</h3><p class="chart-desc">Most popular parks ranked by number of unique operators who activated them.</p><table class="data-table"><thead><tr><th style="width:32px;">#</th><th>Park Reference</th><th>Unique Activators</th></tr></thead><tbody id="top-parks-body"></tbody></table></div>
        <div class="chart-container"><h3>Top US States by Unique Activators</h3><p class="chart-desc">US states ranked by number of unique operators activating parks within them.</p><table class="data-table"><thead><tr><th style="width:32px;">#</th><th>State</th><th>Unique Activators</th></tr></thead><tbody id="top-states-body"></tbody></table></div>
      </div>
    </div>
    <div class="note"><strong>About this data:</strong> Spot data is collected from the <a href="https://pota.app?utm_source=w0arr.com" target="_blank" rel="noopener">POTA app</a> once a minute. Data collection started December 27, 2025.</div>
  `;
}

function renderFaqAndFooter(): string {
  return `
    <section class="faq-section" aria-labelledby="pota-faq-heading">
      <h2 id="pota-faq-heading" class="faq-header">Frequently Asked Questions</h2>
      <div class="faq-content">
        <div class="faq-item"><h4>How are spots counted?</h4><p>A "spot" is a report of an activator being heard on the air. We collect this data every minute and aggregate it hourly. The <strong>total spots</strong> count represents the sum of all spot reports in the selected time range.</p></div>
        <div class="faq-item"><h4>How are unique activators counted?</h4><p><strong>Unique activators</strong> are counted by extracting distinct callsigns from all spots in the time range. If the same operator is spotted multiple times across different parks, bands, or modes, they still count as one unique activator.</p></div>
        <div class="faq-item"><h4>How are "spotted activations" tracked?</h4><p>A <strong>spotted activation</strong> is a unique combination of callsign + park reference in the spot data.</p><p><strong>Important:</strong> These are <em>spotted</em> activations based on spot reports only. We cannot verify whether the activator made the 10+ contacts required for an official POTA activation.</p></div>
        <div class="faq-item"><h4>What do the mode categories mean?</h4><ul><li><strong>CW</strong> - Morse code</li><li><strong>SSB</strong> - Voice modes (SSB, AM, FM, LSB, USB)</li><li><strong>Digital</strong> - FT8, FT4, RTTY, PSK31, JS8, etc.</li></ul></div>
        <div class="faq-item"><h4>How does this work?</h4><p>Raw spot data is pulled in once a minute via a Cloudflare Worker and stored as NDJSON files into Cloudflare R2. Periodic rollups make it easy for the browser to query.</p></div>
        <div class="faq-item"><h4>Is this open source?</h4><p>The collection, aggregation and queries are <a href="https://github.com/benstevinson/pota-stats/?utm_source=w0arr.com" target="_blank" rel="noopener">up on GitHub here.</a></p></div>
      </div>
    </section>
    <footer class="site-footer">
      <hr>
      <h2>Receive updates</h2>
      <p>Follow me via <a href="/rss.xml">RSS</a>, <a href="https://x.com/benstevinson?utm_source=w0arr.com" target="_blank" rel="noopener">X</a>, <a href="https://www.linkedin.com/in/ben-stevinson/?utm_source=w0arr.com" target="_blank" rel="noopener">LinkedIn</a>, and <a href="https://www.qrz.com/db/W0ARR?utm_source=w0arr.com" target="_blank" rel="noopener">QRZ</a>.</p>
      <hr>
      <p class="easter-egg"><a href="https://www.youtube.com/watch?v=eM_UFWFh0hc" target="_blank" rel="noopener">Something completely different</a></p>
    </footer>
  `;
}
