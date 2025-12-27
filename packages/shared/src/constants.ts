export const BAND_ORDER = [
  '160m', '80m', '60m', '40m', '30m', '20m', '17m', '15m', '12m', '10m', '6m', '2m', '70cm', 'other'
] as const;

export const TIME_RANGE_HOURS: Record<string, number> = {
  '1h': 1,
  '24h': 24,
  '7d': 168,
  '30d': 720
};
