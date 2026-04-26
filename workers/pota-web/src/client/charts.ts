import type {
  ModeData,
  BandData,
  ActivatorTrendData,
  ActivatorByModeTrendData,
  TimeOfDayData,
  DayOfWeekData,
} from "@pota-stats/shared";
import { BAND_ORDER } from "@pota-stats/shared";
import { MODE_COLORS, BAND_COLORS } from "./constants";

type ChartConfiguration = Record<string, unknown>;
type ChartInstance = { destroy(): void };
type ChartConstructor = new (
  context: CanvasRenderingContext2D,
  config: ChartConfiguration,
) => ChartInstance;
type TooltipContext = { raw: number };

export interface ChartWithData {
  percentages: string[];
  total: number;
}

function calculatePercentages(values: number[]): ChartWithData {
  const total = values.reduce((sum, v) => sum + v, 0);
  const percentages = values.map((v) => (total > 0 ? ((v / total) * 100).toFixed(1) : "0.0"));
  return { percentages, total };
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

export function createModeChartConfig(data: ModeData[]): ChartConfiguration {
  const sortedData = [...data].sort((a, b) => Number(b.count) - Number(a.count));
  const total = sortedData.reduce((sum, r) => sum + Number(r.count), 0);

  // Filter out items with less than 0.5% usage
  const filteredData = sortedData.filter(
    (r) => total > 0 && (Number(r.count) / total) * 100 >= 0.5,
  );

  const labels = filteredData.map((r) => r.mode);
  const values = filteredData.map((r) => Number(r.count));
  const colors = labels.map((l) => MODE_COLORS[l] || MODE_COLORS["other"]);
  const { percentages } = calculatePercentages(values);

  return {
    type: "bar",
    data: {
      labels: labels.map((l, i) => `${l} (${percentages[i]}%)`),
      datasets: [
        {
          label: "Spots",
          data: values,
          backgroundColor: colors,
          borderWidth: 1,
          borderColor: "#fff",
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context: TooltipContext) => {
              const value = context.raw;
              const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
              return `${formatNumber(value)} spots (${pct}%)`;
            },
          },
        },
        datalabels: {
          anchor: "end",
          align: "right",
          formatter: (value: number) => formatNumber(value),
          color: "#333",
          font: { size: 11 },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          title: { display: true, text: "Number of Spots" },
        },
      },
    },
  };
}

export type BandSortOrder = "frequency" | "count";

export function createBandChartConfig(
  data: BandData[],
  sortOrder: BandSortOrder = "count",
): ChartConfiguration {
  const total = data.reduce((sum, r) => sum + Number(r.count), 0);

  // Filter out items with less than 0.5% usage
  const filteredData = data.filter((r) => total > 0 && (Number(r.count) / total) * 100 >= 0.5);

  const sortedData =
    sortOrder === "frequency"
      ? [...filteredData].sort(
          (a, b) =>
            BAND_ORDER.indexOf(a.band as (typeof BAND_ORDER)[number]) -
            BAND_ORDER.indexOf(b.band as (typeof BAND_ORDER)[number]),
        )
      : [...filteredData].sort((a, b) => Number(b.count) - Number(a.count));

  const labels = sortedData.map((r) => r.band);
  const values = sortedData.map((r) => Number(r.count));
  const colors = labels.map((l) => BAND_COLORS[l] || BAND_COLORS["other"]);
  const { percentages } = calculatePercentages(values);

  return {
    type: "bar",
    data: {
      labels: labels.map((l, i) => `${l} (${percentages[i]}%)`),
      datasets: [
        {
          label: "Spots",
          data: values,
          backgroundColor: colors,
          borderWidth: 1,
          borderColor: "#fff",
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context: TooltipContext) => {
              const value = context.raw;
              const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
              return `${formatNumber(value)} spots (${pct}%)`;
            },
          },
        },
        datalabels: {
          anchor: "end",
          align: "right",
          formatter: (value: number) => formatNumber(value),
          color: "#333",
          font: { size: 11 },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          title: { display: true, text: "Number of Spots" },
        },
      },
    },
  };
}

const TREND_MODE_COLORS = {
  cw: "#e74c3c",
  ssb: "#3498db",
  digital: "#2ecc71",
};

export function createActivatorTrendConfig(data: ActivatorTrendData[]): ChartConfiguration {
  const labels = data.map((d) => d.period);
  const values = data.map((d) => Number(d.uniqueActivators));

  return {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Unique Activators",
          data: values,
          backgroundColor: "#3498db",
          borderWidth: 1,
          borderColor: "#2980b9",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: { display: false },
        tooltip: {
          callbacks: {
            label: (context: { raw: number }) => `${formatNumber(context.raw)} activators`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: "Unique Activators" },
        },
        x: {
          title: { display: false },
        },
      },
    },
  };
}

export function createActivatorByModeTrendConfig(
  data: ActivatorByModeTrendData[],
): ChartConfiguration {
  const labels = data.map((d) => d.period);

  return {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "CW",
          data: data.map((d) => Number(d.cw)),
          backgroundColor: TREND_MODE_COLORS.cw,
          borderWidth: 1,
          borderColor: "#c0392b",
        },
        {
          label: "SSB",
          data: data.map((d) => Number(d.ssb)),
          backgroundColor: TREND_MODE_COLORS.ssb,
          borderWidth: 1,
          borderColor: "#2980b9",
        },
        {
          label: "Digital",
          data: data.map((d) => Number(d.digital)),
          backgroundColor: TREND_MODE_COLORS.digital,
          borderWidth: 1,
          borderColor: "#27ae60",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { boxWidth: 12, padding: 15 },
        },
        datalabels: { display: false },
        tooltip: {
          callbacks: {
            label: (context: { dataset: { label: string }; raw: number }) =>
              `${context.dataset.label}: ${formatNumber(context.raw)} activators`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: "Unique Activators" },
        },
        x: {
          title: { display: false },
        },
      },
    },
  };
}

export type TimeDisplayMode = "local" | "utc";

function formatHourLabel(hour: number): string {
  // hour is already the display hour (0-23 representing local or UTC hours)
  // No transformation needed - just format as 12-hour time
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}${suffix}`;
}

export function createTimeOfDayChartConfig(
  data: TimeOfDayData[],
  displayMode: TimeDisplayMode = "local",
): ChartConfiguration {
  // Get UTC offset in hours (e.g., -6 for CST)
  const utcOffset = -new Date().getTimezoneOffset() / 60;

  // Reorder data based on display mode
  let orderedData = [...data];
  if (displayMode === "local") {
    // Shift data so UTC hours map to local display positions
    orderedData = data.map((_, i) => {
      const utcHour = (i - utcOffset + 24) % 24;
      return data.find((d) => d.hour === utcHour) || { hour: utcHour, count: 0 };
    });
  }

  const labels = Array.from({ length: 24 }, (_, i) => formatHourLabel(i));
  const values = orderedData.map((d) => Number(d.count));
  const total = values.reduce((sum, v) => sum + v, 0);

  // Color gradient from light to dark blue based on activity
  const maxValue = Math.max(...values);
  const colors = values.map((v) => {
    const intensity = maxValue > 0 ? v / maxValue : 0;
    const r = Math.round(52 + (1 - intensity) * 150);
    const g = Math.round(152 + (1 - intensity) * 80);
    const b = Math.round(219 - (1 - intensity) * 50);
    return `rgb(${r}, ${g}, ${b})`;
  });

  return {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Spots",
          data: values,
          backgroundColor: colors,
          borderWidth: 1,
          borderColor: "#2980b9",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: { display: false },
        tooltip: {
          callbacks: {
            label: (context: { raw: number }) => {
              const value = context.raw;
              const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
              return `${formatNumber(value)} spots (${pct}%)`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: "Number of Spots" },
        },
        x: {
          title: { display: false },
        },
      },
    },
  };
}

const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function createDayOfWeekChartConfig(
  data: DayOfWeekData[],
  _displayMode: TimeDisplayMode = "local",
): ChartConfiguration {
  // Data from database is in UTC day of week
  // For simplicity, we don't shift day of week data since the shift
  // varies throughout the day. The data represents which UTC day the
  // activity occurred on.
  const orderedData = [...data];

  const labels = DAY_NAMES_SHORT;
  const values = orderedData.map((d) => Number(d.count));
  const total = values.reduce((sum, v) => sum + v, 0);

  // Color gradient based on activity (weekend days slightly different tint)
  const maxValue = Math.max(...values);
  const colors = values.map((v, i) => {
    const intensity = maxValue > 0 ? v / maxValue : 0;
    const isWeekend = i === 0 || i === 6; // Sunday or Saturday
    if (isWeekend) {
      // Weekend: green tint
      const r = Math.round(46 + (1 - intensity) * 150);
      const g = Math.round(204 + (1 - intensity) * 40);
      const b = Math.round(113 + (1 - intensity) * 100);
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      // Weekday: blue tint
      const r = Math.round(52 + (1 - intensity) * 150);
      const g = Math.round(152 + (1 - intensity) * 80);
      const b = Math.round(219 - (1 - intensity) * 50);
      return `rgb(${r}, ${g}, ${b})`;
    }
  });

  return {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Spots",
          data: values,
          backgroundColor: colors,
          borderWidth: 1,
          borderColor: "#2980b9",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: { display: false },
        tooltip: {
          callbacks: {
            label: (context: { raw: number }) => {
              const value = context.raw;
              const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
              return `${formatNumber(value)} spots (${pct}%)`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: "Number of Spots" },
        },
        x: {
          title: { display: false },
        },
      },
    },
  };
}

export class ChartManager {
  private modeChart: ChartInstance | null = null;
  private bandChart: ChartInstance | null = null;
  private activatorTrendChart: ChartInstance | null = null;
  private activatorByModeTrendChart: ChartInstance | null = null;
  private timeOfDayChart: ChartInstance | null = null;
  private dayOfWeekChart: ChartInstance | null = null;
  private ChartConstructor: ChartConstructor;

  constructor(chartConstructor: unknown) {
    this.ChartConstructor = chartConstructor as ChartConstructor;
  }

  renderModeChart(canvas: HTMLCanvasElement, data: ModeData[]): void {
    if (this.modeChart) {
      this.modeChart.destroy();
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    this.modeChart = new this.ChartConstructor(ctx, createModeChartConfig(data));
  }

  renderBandChart(
    canvas: HTMLCanvasElement,
    data: BandData[],
    sortOrder: BandSortOrder = "count",
  ): void {
    if (this.bandChart) {
      this.bandChart.destroy();
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    this.bandChart = new this.ChartConstructor(ctx, createBandChartConfig(data, sortOrder));
  }

  renderActivatorTrendChart(canvas: HTMLCanvasElement, data: ActivatorTrendData[]): void {
    if (this.activatorTrendChart) {
      this.activatorTrendChart.destroy();
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    this.activatorTrendChart = new this.ChartConstructor(ctx, createActivatorTrendConfig(data));
  }

  renderActivatorByModeTrendChart(
    canvas: HTMLCanvasElement,
    data: ActivatorByModeTrendData[],
  ): void {
    if (this.activatorByModeTrendChart) {
      this.activatorByModeTrendChart.destroy();
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    this.activatorByModeTrendChart = new this.ChartConstructor(
      ctx,
      createActivatorByModeTrendConfig(data),
    );
  }

  renderTimeOfDayChart(
    canvas: HTMLCanvasElement,
    data: TimeOfDayData[],
    displayMode: TimeDisplayMode = "local",
  ): void {
    if (this.timeOfDayChart) {
      this.timeOfDayChart.destroy();
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    this.timeOfDayChart = new this.ChartConstructor(
      ctx,
      createTimeOfDayChartConfig(data, displayMode),
    );
  }

  renderDayOfWeekChart(
    canvas: HTMLCanvasElement,
    data: DayOfWeekData[],
    displayMode: TimeDisplayMode = "local",
  ): void {
    if (this.dayOfWeekChart) {
      this.dayOfWeekChart.destroy();
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    this.dayOfWeekChart = new this.ChartConstructor(
      ctx,
      createDayOfWeekChartConfig(data, displayMode),
    );
  }

  destroy(): void {
    this.modeChart?.destroy();
    this.bandChart?.destroy();
    this.activatorTrendChart?.destroy();
    this.activatorByModeTrendChart?.destroy();
    this.timeOfDayChart?.destroy();
    this.dayOfWeekChart?.destroy();
    this.modeChart = null;
    this.bandChart = null;
    this.activatorTrendChart = null;
    this.activatorByModeTrendChart = null;
    this.timeOfDayChart = null;
    this.dayOfWeekChart = null;
  }
}
