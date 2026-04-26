/**
 * POTA Stats Client
 *
 * Fetches pre-computed summary data from R2 instead of loading raw NDJSON files.
 * This reduces data transfer from ~42MB to ~10KB.
 */

import { ChartManager } from './charts';
import type { BandSortOrder, TimeDisplayMode } from './charts';
import type {
  ModeData,
  BandData,
  CategoryBreakdown,
  TopParkData,
  TopStateData,
  ActivatorTrendData,
  ActivatorByModeTrendData,
  TimeOfDayData,
  DayOfWeekData,
} from '@pota-stats/shared';
import type {
  AllTimeSummary,
  PeriodStats,
  TrendDataPoint,
  TrendsSummary,
  TimeOfDaySummary,
  DayOfWeekSummary,
  TopEntitiesSummary,
} from '@pota-stats/shared/summary-types';

// Chart.js is loaded from CDN and attached to window
declare global {
  interface Window {
    Chart: unknown;
  }
}

// ============================================================================
// Config and Types
// ============================================================================

interface PotaStatsConfig {
  summaryBaseUrl: string;
}

type TimeRange = '24h' | '7d' | '30d';
type TrendPeriod = 'daily' | 'weekly' | 'monthly';
type GroupBy = 'mode' | 'band' | 'entity';

// ============================================================================
// Helper Functions
// ============================================================================

function updateStatus(message: string, type: string = ''): void {
  const statusEl = document.getElementById('loading-status');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = 'loading-status' + (type ? ` ${type}` : '');
  }
}

function formatNumber(num: number | null | undefined): string {
  if (num == null) return '-';
  return Number(num).toLocaleString();
}

function showUI(): void {
  const elements = [
    'all-time-section',
    'stats-grid',
    'spot-stats-section',
    'controls',
    'mode-chart-container',
    'band-chart-container',
    'table-container',
    'activator-stats-section',
    'entity-stats-section',
    'time-of-day-section',
    'day-of-week-section',
    'data-timestamp',
  ];
  elements.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (id === 'stats-grid' || id === 'all-time-stats-grid') {
        el.style.display = 'grid';
      } else if (id === 'controls') {
        el.style.display = 'flex';
      } else {
        el.style.display = 'block';
      }
    }
  });
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

function updateDataTimestamp(updatedAt: string): void {
  const el = document.getElementById('data-timestamp');
  if (!el) return;

  const updateDate = new Date(updatedAt);
  const relativeTime = formatRelativeTime(updateDate);

  el.innerHTML = `Last updated: <time datetime="${updatedAt}" title="${updateDate.toLocaleString()}">${relativeTime}</time>`;
}

async function fetchSummary<T>(summaryBaseUrl: string, filename: string): Promise<T | null> {
  try {
    const response = await fetch(`${summaryBaseUrl}/summaries/${filename}`);
    if (!response.ok) return null;
    return await response.json() as T;
  } catch (error) {
    console.error(`Failed to fetch ${filename}:`, error);
    return null;
  }
}

// ============================================================================
// Table Rendering
// ============================================================================

function renderTable(data: CategoryBreakdown[]): void {
  const tbody = document.getElementById('table-body');
  if (!tbody) return;

  tbody.innerHTML = '';
  data.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.category}</td>
      <td>${formatNumber(row.activations)}</td>
      <td>${formatNumber(row.spots)}</td>
      <td>${formatNumber(row.activators)}</td>
      <td>${formatNumber(row.parks)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderTopParksTable(data: TopParkData[]): void {
  const tbody = document.getElementById('top-parks-body');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!data || !Array.isArray(data) || data.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="3" style="text-align: center; color: #666;">No data available</td>';
    tbody.appendChild(tr);
    return;
  }

  data.forEach((row, index) => {
    const reference = String(row.reference);
    const activators = Number(row.uniqueActivators);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td><a href="https://pota.app/#/park/${reference}" target="_blank" rel="noopener">${reference}</a></td>
      <td>${formatNumber(activators)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderTopStatesTable(data: TopStateData[]): void {
  const tbody = document.getElementById('top-states-body');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!data || !Array.isArray(data) || data.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="3" style="text-align: center; color: #666;">No state data available yet</td>';
    tbody.appendChild(tr);
    return;
  }

  data.forEach((row, index) => {
    const state = String(row.state);
    const activators = Number(row.uniqueActivators);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${state}</td>
      <td>${formatNumber(activators)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ============================================================================
// Main Initialization
// ============================================================================

export async function initPotaStats(config: PotaStatsConfig): Promise<void> {
  const { summaryBaseUrl } = config;

  let chartManager: ChartManager | null = null;

  // Cached summary data
  let allTimeSummary: AllTimeSummary | null = null;
  let periodStats: PeriodStats | null = null;
  let trendsSummary: TrendsSummary | null = null;
  let timeOfDaySummary: TimeOfDaySummary | null = null;
  let dayOfWeekSummary: DayOfWeekSummary | null = null;
  let topEntitiesSummary: TopEntitiesSummary | null = null;

  // Current selections
  let currentTimeRange: TimeRange = '24h';
  let currentTrendPeriod: TrendPeriod = 'daily';
  let currentGroupBy: GroupBy = 'mode';
  let timeDisplayMode: TimeDisplayMode = 'local';
  let dayDisplayMode: TimeDisplayMode = 'local';
  let bandSortOrder: BandSortOrder = 'count';

  // Cache band data for re-rendering when sort order changes
  let cachedBandData: BandData[] = [];

  function getTimeRangeFile(range: TimeRange): string {
    const files: Record<TimeRange, string> = {
      '24h': 'stats_24h.json',
      '7d': 'stats_7d.json',
      '30d': 'stats_30d.json',
    };
    return files[range];
  }

  // ========================================
  // All-time stats
  // ========================================

  async function loadAllTimeStats(): Promise<void> {
    allTimeSummary = await fetchSummary<AllTimeSummary>(summaryBaseUrl, 'all_time.json');
    if (!allTimeSummary) return;

    const setElementText = (id: string, value: string): void => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    setElementText('all-time-spots', formatNumber(allTimeSummary.total_spots));
    setElementText('all-time-activators', formatNumber(allTimeSummary.unique_activators));
    setElementText('all-time-parks', formatNumber(allTimeSummary.unique_parks));
    setElementText('all-time-activations', formatNumber(allTimeSummary.total_activations));

    // Update description with date range
    if (allTimeSummary.data_since) {
      const startDate = new Date(allTimeSummary.data_since);
      const descEl = document.getElementById('all-time-desc');
      if (descEl) {
        const startDateStr = startDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        descEl.textContent = `Cumulative statistics since ${startDateStr}.`;
      }
    }
  }

  // ========================================
  // Period stats (24h/7d/30d)
  // ========================================

  async function loadPeriodStats(): Promise<void> {
    const filename = getTimeRangeFile(currentTimeRange);
    periodStats = await fetchSummary<PeriodStats>(summaryBaseUrl, filename);
    if (!periodStats) {
      updateStatus(`No data available for ${currentTimeRange}`, 'error');
      return;
    }

    // Update stats display
    const setElementText = (id: string, value: string): void => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    setElementText('total-spots', formatNumber(periodStats.total_spots));
    setElementText('unique-activators', formatNumber(periodStats.unique_activators));
    setElementText('unique-parks', formatNumber(periodStats.unique_parks));
    setElementText('total-activations', formatNumber(periodStats.total_activations));

    // Update timestamp
    updateDataTimestamp(periodStats.updated_at);

    // Render charts
    renderCharts();
  }

  function renderCharts(): void {
    if (!chartManager || !periodStats) return;

    // Convert summary data to chart format
    const modeData: ModeData[] = periodStats.by_mode.map(m => ({
      mode: m.mode,
      count: m.spots,
    }));

    cachedBandData = periodStats.by_band.map(b => ({
      band: b.band,
      count: b.spots,
    }));

    const modeCanvas = document.getElementById('mode-chart') as HTMLCanvasElement | null;
    if (modeCanvas) chartManager.renderModeChart(modeCanvas, modeData);

    renderBandChart();
    renderCategoryTable();
  }

  function renderBandChart(): void {
    if (!chartManager || cachedBandData.length === 0) return;

    const bandCanvas = document.getElementById('band-chart') as HTMLCanvasElement | null;
    if (bandCanvas) {
      chartManager.renderBandChart(bandCanvas, cachedBandData, bandSortOrder);
      updateBandChartDescription();
    }
  }

  function updateBandChartDescription(): void {
    const descEl = document.getElementById('band-chart-desc');
    if (descEl) {
      descEl.textContent = bandSortOrder === 'frequency'
        ? 'Distribution of spot reports across amateur radio bands, ordered by frequency.'
        : 'Distribution of spot reports across amateur radio bands, ordered by popularity.';
    }
  }

  function renderCategoryTable(): void {
    if (!periodStats) return;

    let data: CategoryBreakdown[];

    switch (currentGroupBy) {
      case 'mode':
        data = periodStats.by_mode.map(m => ({
          category: m.mode,
          spots: m.spots,
          activations: m.activations,
          activators: m.activators,
          parks: m.parks,
        }));
        break;
      case 'band':
        data = periodStats.by_band.map(b => ({
          category: b.band,
          spots: b.spots,
          activations: b.activations,
          activators: b.activators,
          parks: b.parks,
        }));
        break;
      case 'entity':
        data = periodStats.by_entity.map(e => ({
          category: e.entity,
          spots: e.spots,
          activations: e.activations,
          activators: e.activators,
          parks: e.parks,
        }));
        break;
    }

    renderTable(data);
  }

  // ========================================
  // Trend charts
  // ========================================

  async function loadTrendData(): Promise<void> {
    trendsSummary = await fetchSummary<TrendsSummary>(summaryBaseUrl, 'trends.json');
    if (!trendsSummary) return;

    renderTrendCharts();
  }

  function renderTrendCharts(): void {
    if (!chartManager || !trendsSummary) return;

    // Select the right trend data based on period
    let trendData: TrendDataPoint[];
    switch (currentTrendPeriod) {
      case 'daily':
        trendData = trendsSummary.daily;
        break;
      case 'weekly':
        trendData = trendsSummary.weekly;
        break;
      case 'monthly':
        trendData = trendsSummary.monthly;
        break;
    }

    // Convert to chart format
    const activatorTrendData: ActivatorTrendData[] = trendData.map(d => ({
      period: d.period,
      uniqueActivators: d.activators,
    }));

    const modeTrendData: ActivatorByModeTrendData[] = trendData.map(d => ({
      period: d.period,
      cw: d.cw,
      ssb: d.ssb,
      digital: d.digital,
    }));

    const trendCanvas = document.getElementById('activator-trend-chart') as HTMLCanvasElement | null;
    const modeTrendCanvas = document.getElementById('activator-mode-trend-chart') as HTMLCanvasElement | null;

    if (trendCanvas) chartManager.renderActivatorTrendChart(trendCanvas, activatorTrendData);
    if (modeTrendCanvas) chartManager.renderActivatorByModeTrendChart(modeTrendCanvas, modeTrendData);
  }

  // ========================================
  // Time of day chart
  // ========================================

  async function loadTimeOfDayData(): Promise<void> {
    timeOfDaySummary = await fetchSummary<TimeOfDaySummary>(summaryBaseUrl, 'time_of_day.json');
    if (!timeOfDaySummary) return;

    renderTimeOfDayChart();
  }

  function renderTimeOfDayChart(): void {
    if (!chartManager || !timeOfDaySummary) return;

    const data: TimeOfDayData[] = timeOfDaySummary.hours.map(h => ({
      hour: h.hour,
      count: h.spots,
    }));

    const canvas = document.getElementById('time-of-day-chart') as HTMLCanvasElement | null;
    if (canvas) {
      chartManager.renderTimeOfDayChart(canvas, data, timeDisplayMode);
      updateTimeOfDayDescription();
    }
  }

  function updateTimeOfDayDescription(): void {
    const descEl = document.getElementById('time-of-day-desc');
    if (descEl) {
      if (timeDisplayMode === 'utc') {
        descEl.textContent = 'Shows when spot reports are most frequent throughout the day (UTC).';
      } else {
        const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone;
        descEl.textContent = `Shows when spot reports are most frequent throughout the day (${tzName}).`;
      }
    }
  }

  // ========================================
  // Day of week chart
  // ========================================

  async function loadDayOfWeekData(): Promise<void> {
    dayOfWeekSummary = await fetchSummary<DayOfWeekSummary>(summaryBaseUrl, 'day_of_week.json');
    if (!dayOfWeekSummary) return;

    renderDayOfWeekChart();
  }

  function renderDayOfWeekChart(): void {
    if (!chartManager || !dayOfWeekSummary) return;

    const data: DayOfWeekData[] = dayOfWeekSummary.days.map(d => ({
      dayOfWeek: d.day,
      count: d.spots,
    }));

    const canvas = document.getElementById('day-of-week-chart') as HTMLCanvasElement | null;
    if (canvas) {
      chartManager.renderDayOfWeekChart(canvas, data, dayDisplayMode);
      updateDayOfWeekDescription();
    }
  }

  function updateDayOfWeekDescription(): void {
    const descEl = document.getElementById('day-of-week-desc');
    if (descEl) {
      if (dayDisplayMode === 'utc') {
        descEl.textContent = 'Shows which days of the week have the most spot activity (UTC).';
      } else {
        const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone;
        descEl.textContent = `Shows which days of the week have the most spot activity (${tzName}).`;
      }
    }
  }

  // ========================================
  // Top entities (parks/states)
  // ========================================

  async function loadTopEntities(): Promise<void> {
    topEntitiesSummary = await fetchSummary<TopEntitiesSummary>(summaryBaseUrl, 'top_entities.json');
    if (!topEntitiesSummary) return;

    // Convert to table format
    const topParks: TopParkData[] = topEntitiesSummary.top_parks.map(p => ({
      reference: p.reference,
      uniqueActivators: p.activators,
    }));

    const topStates: TopStateData[] = topEntitiesSummary.top_states.map(s => ({
      state: s.state,
      uniqueActivators: s.activators,
    }));

    renderTopParksTable(topParks);
    renderTopStatesTable(topStates);
  }

  // ========================================
  // Initialize
  // ========================================

  // Wait for Chart.js to be loaded (it's loaded from CDN)
  async function waitForChart(): Promise<unknown> {
    if (window.Chart) return window.Chart;
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (window.Chart) {
          clearInterval(check);
          resolve(window.Chart);
        }
      }, 10);
    });
  }

  try {
    const startTime = performance.now();
    updateStatus('Loading POTA statistics...');

    const ChartJS = await waitForChart();
    chartManager = new ChartManager(ChartJS);

    // Load all summary data in parallel
    await Promise.all([
      loadAllTimeStats(),
      loadPeriodStats(),
      loadTrendData(),
      loadTimeOfDayData(),
      loadDayOfWeekData(),
      loadTopEntities(),
    ]);

    showUI();

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    updateStatus(`Loaded in ${elapsed}s`, 'success');

    // Event listeners
    document.getElementById('time-range')?.addEventListener('change', async (e) => {
      const select = e.target as HTMLSelectElement;
      currentTimeRange = select.value as TimeRange;
      await loadPeriodStats();
    });

    document.getElementById('group-by')?.addEventListener('change', (e) => {
      const select = e.target as HTMLSelectElement;
      currentGroupBy = select.value as GroupBy;
      renderCategoryTable();
    });

    document.getElementById('band-order')?.addEventListener('change', (e) => {
      const select = e.target as HTMLSelectElement;
      bandSortOrder = select.value as BandSortOrder;
      renderBandChart();
    });

    document.getElementById('trend-period')?.addEventListener('change', (e) => {
      const select = e.target as HTMLSelectElement;
      currentTrendPeriod = select.value as TrendPeriod;
      renderTrendCharts();
    });

    document.getElementById('time-utc-toggle')?.addEventListener('change', (e) => {
      const checkbox = e.target as HTMLInputElement;
      timeDisplayMode = checkbox.checked ? 'utc' : 'local';
      renderTimeOfDayChart();
    });

    document.getElementById('day-utc-toggle')?.addEventListener('change', (e) => {
      const checkbox = e.target as HTMLInputElement;
      dayDisplayMode = checkbox.checked ? 'utc' : 'local';
      renderDayOfWeekChart();
    });

  } catch (error) {
    console.error('Initialization failed:', error);
    updateStatus(`Error: ${(error as Error).message}`, 'error');
  }
}

void initPotaStats({ summaryBaseUrl: '/pota-stats/api' });
