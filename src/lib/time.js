const minute = 60 * 1000;
const day = 24 * 60 * minute;

function dateKey(dateInput) {
  const date = new Date(dateInput);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const currentDay = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${currentDay}`;
}

export function formatDigitalDuration(totalSeconds) {
  const seconds = Math.max(0, totalSeconds);
  const hours = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const remainingSeconds = String(seconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${remainingSeconds}`;
}

export function formatMinutes(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return "0h 00m";
  }

  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return `${hours}h ${String(remainder).padStart(2, "0")}m`;
}

export function formatShortDate(dateString) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
  }).format(new Date(dateString));
}

export function isWithinLastDays(dateString, days) {
  const current = Date.now();
  const target = new Date(dateString).getTime();
  return current - target <= days * day;
}

export function aggregateDailyTotals(records) {
  const dailyMap = new Map();

  for (const record of records) {
    const key = dateKey(record.createdAt);
    dailyMap.set(key, (dailyMap.get(key) ?? 0) + record.durationMinutes);
  }

  return [...dailyMap.entries()]
    .map(([key, total]) => ({ key, total }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function averageByPeriod(records, days) {
  const matches = records.filter((record) => isWithinLastDays(record.createdAt, days));
  const totals = aggregateDailyTotals(matches);

  if (!totals.length) {
    return 0;
  }

  const total = totals.reduce((sum, entry) => sum + entry.total, 0);
  return total / totals.length;
}

export function totalByPeriod(records, days) {
  const matches = records.filter((record) => isWithinLastDays(record.createdAt, days));
  const totals = aggregateDailyTotals(matches);
  return totals.reduce((sum, entry) => sum + entry.total, 0);
}

export function totalForDate(records, targetDate = new Date()) {
  const targetKey = dateKey(targetDate);
  return records.reduce((sum, record) => {
    return sum + (dateKey(record.createdAt) === targetKey ? record.durationMinutes : 0);
  }, 0);
}

export function buildSparklinePoints(records, days = 7) {
  const now = new Date();
  const totalsByDate = new Map(
    aggregateDailyTotals(records).map((entry) => [entry.key, entry.total]),
  );

  const buckets = Array.from({ length: days }, (_, index) => {
    const date = new Date(now.getTime() - (days - index - 1) * day);
    const key = dateKey(date);
    return { key, total: totalsByDate.get(key) ?? 0 };
  });

  const highest = Math.max(...buckets.map((bucket) => bucket.total), 1);
  return buckets.map((bucket, index) => ({
    x: (index / Math.max(days - 1, 1)) * 100,
    y: 100 - (bucket.total / highest) * 100,
    label: bucket.key,
    value: bucket.total,
  }));
}

export function buildDistributionPlot(records, days = 30) {
  const matches = records.filter((record) => isWithinLastDays(record.createdAt, days));
  const samples = aggregateDailyTotals(matches);

  if (!samples.length) {
    return {
      points: [],
      mean: 0,
      max: 1,
    };
  }

  const max = Math.max(...samples.map((sample) => sample.total), 1);
  const mean = samples.reduce((sum, sample) => sum + sample.total, 0) / samples.length;

  return {
    mean,
    max,
    points: samples.map((sample, index) => ({
      value: sample.total,
      x: (sample.total / max) * 100,
      y: 24 + (index % 4) * 16,
      label: sample.key,
    })),
  };
}

export function relativeIntensity(value, baseline) {
  if (!baseline) {
    return 0;
  }

  return ((value - baseline) / baseline) * 100;
}
