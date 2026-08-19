const STORAGE_KEY_PREFIX = 'quotaPage.weeklyUsageHistory.v1:';
const MAX_SAMPLES_PER_BASIS = 32;
const MAX_BASIS_KEYS = 256;
const MAX_SAMPLE_AGE_MS = 21 * 24 * 60 * 60 * 1000;
const COST_RESET_EPSILON_USD = 0.000001;
const PERCENT_RESET_EPSILON = 0.01;

export interface WeeklyUsageSample {
  capturedAtMs: number;
  costUsd: number;
  usedPercent: number;
}

export interface WeeklyUsageHistory {
  samplesByKey: Record<string, WeeklyUsageSample[]>;
}

const emptyHistory = (): WeeklyUsageHistory => ({ samplesByKey: {} });

const isFiniteSample = (sample: WeeklyUsageSample): boolean =>
  Number.isFinite(sample.capturedAtMs) &&
  Number.isFinite(sample.costUsd) &&
  sample.costUsd >= 0 &&
  Number.isFinite(sample.usedPercent) &&
  sample.usedPercent >= 0 &&
  sample.usedPercent <= 100;

const normalizeSamples = (value: unknown, nowMs: number): WeeklyUsageSample[] => {
  if (!Array.isArray(value)) return [];
  const minCapturedAtMs = nowMs - MAX_SAMPLE_AGE_MS;
  return value
    .filter((item): item is WeeklyUsageSample => {
      if (!item || typeof item !== 'object') return false;
      const candidate = item as Partial<WeeklyUsageSample>;
      return (
        typeof candidate.capturedAtMs === 'number' &&
        typeof candidate.costUsd === 'number' &&
        typeof candidate.usedPercent === 'number' &&
        isFiniteSample(candidate as WeeklyUsageSample) &&
        candidate.capturedAtMs >= minCapturedAtMs &&
        candidate.capturedAtMs <= nowMs + 60_000
      );
    })
    .sort((left, right) => left.capturedAtMs - right.capturedAtMs)
    .slice(-MAX_SAMPLES_PER_BASIS);
};

const normalizeHistory = (value: unknown, nowMs: number): WeeklyUsageHistory => {
  if (!value || typeof value !== 'object') return emptyHistory();
  const raw = value as { samplesByKey?: unknown };
  if (!raw.samplesByKey || typeof raw.samplesByKey !== 'object') return emptyHistory();

  const entries = Object.entries(raw.samplesByKey as Record<string, unknown>)
    .map(([key, samples]) => [key, normalizeSamples(samples, nowMs)] as const)
    .filter(([, samples]) => samples.length > 0)
    .sort((left, right) => {
      const leftLatest = left[1][left[1].length - 1]?.capturedAtMs ?? 0;
      const rightLatest = right[1][right[1].length - 1]?.capturedAtMs ?? 0;
      return rightLatest - leftLatest;
    })
    .slice(0, MAX_BASIS_KEYS);

  return { samplesByKey: Object.fromEntries(entries) };
};

export const getWeeklyUsageHistoryStorageKey = (serverKey: string): string =>
  `${STORAGE_KEY_PREFIX}${encodeURIComponent(serverKey || 'default')}`;

export const readWeeklyUsageHistory = (
  serverKey: string,
  storage: Pick<Storage, 'getItem'> | null | undefined = typeof window === 'undefined'
    ? undefined
    : window.localStorage,
  nowMs = Date.now()
): WeeklyUsageHistory => {
  if (!storage) return emptyHistory();
  try {
    const raw = storage.getItem(getWeeklyUsageHistoryStorageKey(serverKey));
    return raw ? normalizeHistory(JSON.parse(raw), nowMs) : emptyHistory();
  } catch {
    return emptyHistory();
  }
};

export const writeWeeklyUsageHistory = (
  serverKey: string,
  history: WeeklyUsageHistory,
  storage: Pick<Storage, 'setItem'> | null | undefined = typeof window === 'undefined'
    ? undefined
    : window.localStorage
): void => {
  if (!storage) return;
  try {
    storage.setItem(getWeeklyUsageHistoryStorageKey(serverKey), JSON.stringify(history));
  } catch {
    // Ignore private-mode or quota failures.
  }
};

/**
 * Append a quota/cost observation and start a new segment when the statistics store was rebuilt.
 */
export const appendWeeklyUsageSample = (
  history: WeeklyUsageHistory,
  basis: { key: string },
  sample: WeeklyUsageSample,
  nowMs = sample.capturedAtMs
): WeeklyUsageHistory => {
  if (!isFiniteSample(sample)) return history;

  const current = history.samplesByKey[basis.key] ?? [];
  const latest = current[current.length - 1];
  const statisticsReset =
    latest &&
    (sample.costUsd + COST_RESET_EPSILON_USD < latest.costUsd ||
      sample.usedPercent + PERCENT_RESET_EPSILON < latest.usedPercent);
  const nextSamples = statisticsReset ? [sample] : normalizeSamples([...current, sample], nowMs);

  const samplesByKey = { ...history.samplesByKey, [basis.key]: nextSamples };
  const keys = Object.keys(samplesByKey);
  if (keys.length <= MAX_BASIS_KEYS) return { samplesByKey };

  const retainedKeys = keys
    .sort((left, right) => {
      const leftLatest = samplesByKey[left]?.[samplesByKey[left].length - 1]?.capturedAtMs ?? 0;
      const rightLatest = samplesByKey[right]?.[samplesByKey[right].length - 1]?.capturedAtMs ?? 0;
      return rightLatest - leftLatest;
    })
    .slice(0, MAX_BASIS_KEYS);
  return {
    samplesByKey: Object.fromEntries(
      retainedKeys.map((key) => [key, samplesByKey[key] as WeeklyUsageSample[]])
    ),
  };
};

export const getWeeklyUsageSamples = (
  history: WeeklyUsageHistory,
  basisKey: string
): WeeklyUsageSample[] => history.samplesByKey[basisKey] ?? [];
