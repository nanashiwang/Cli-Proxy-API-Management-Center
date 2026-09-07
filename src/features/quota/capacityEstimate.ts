/** Lightweight, browser-only capacity estimates. Percentages are percentage points, not tokens. */
import type { AuthFileItem, CodexQuotaState } from '@/types';
import { normalizePlanType } from '@/utils/quota/parsers';
import { resolveCodexChatgptAccountId, resolveCodexPlanType } from '@/utils/quota/resolvers';
import { isDisabledAuthFile } from '@/utils/quota/validators';

export const HOUR_MS = 3_600_000;
export const CAPACITY_LOOKBACK_MS = 6 * HOUR_MS;
export const CAPACITY_FRESH_MS = HOUR_MS / 2;
export const CAPACITY_MIN_SAMPLE_MS = HOUR_MS / 4;
const MAX_GAP_MS = HOUR_MS;
const MAX_SAMPLES = 96;
const MAX_KEYS = 512;
const RESET_TOLERANCE_MS = 60_000;
const WINDOW_IDS = new Set(['five-hour', 'weekly', 'monthly']);

export interface CapacitySample {
  atMs: number;
  used: number;
  resetAtMs: number;
}
export type CapacityHistory = Record<string, CapacitySample[]>;
export interface CapacityWindow extends CapacitySample {
  id: string;
  periodHours: number;
}
export interface CapacityAccount {
  key: string;
  plan: string | null;
  available: boolean;
  windows: CapacityWindow[];
}
export type CapacityStatus = 'ready' | 'sampling' | 'incomplete' | 'idle' | 'limited';
export interface CapacityWindowEstimate {
  id: string;
  periodHours: number;
  status: CapacityStatus;
  sampledAccounts: number;
  remaining: number;
  rate: number | null;
  runwayHours: number | null;
  recoveryHours: number | null;
  requiredAccounts: number | null;
  additionalAccounts: number | null;
  bridgeAccounts: number | null;
}
export interface CapacityGroupEstimate {
  plan: string;
  accounts: number;
  limitedAccounts: number;
  status: CapacityStatus;
  windows: CapacityWindowEstimate[];
  additionalAccounts: number | null;
  bridgeAccounts: number | null;
}

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const validSample = (value: Partial<CapacitySample>): value is CapacitySample =>
  finite(value.atMs) &&
  finite(value.used) &&
  value.used >= 0 &&
  value.used <= 100 &&
  finite(value.resetAtMs) &&
  value.resetAtMs > value.atMs;
const sameSegment = (a: CapacitySample, b: CapacitySample) =>
  b.atMs > a.atMs &&
  b.atMs < a.resetAtMs &&
  Math.abs(a.resetAtMs - b.resetAtMs) <= RESET_TOLERANCE_MS &&
  b.used >= a.used &&
  b.atMs - a.atMs <= MAX_GAP_MS;

export const capacityHistoryKey = (account: CapacityAccount, window: CapacityWindow): string =>
  JSON.stringify([account.key, account.plan, window.id, window.periodHours]);

/** Use the entire account pool, not the current page. Duplicate credentials are not extra capacity. */
export function buildCapacityAccounts(
  files: AuthFileItem[],
  quota: Record<string, CodexQuotaState>
): CapacityAccount[] {
  const accounts = new Map<string, CapacityAccount>();
  for (const file of files) {
    if (isDisabledAuthFile(file)) continue;
    const state = quota[file.name];
    const key =
      resolveCodexChatgptAccountId(file) || String(file.auth_index ?? file.authIndex ?? file.name);
    const account: CapacityAccount = {
      key,
      plan: normalizePlanType(state?.planType) || resolveCodexPlanType(file),
      available: state?.status === 'success' && !file.unavailable && file.status !== 'error',
      windows: [],
    };
    if (state?.status === 'success' && finite(state.capturedAtMs)) {
      for (const window of state.windows) {
        if (!WINDOW_IDS.has(window.id)) continue;
        if (!finite(window.periodHours) || window.periodHours <= 0) {
          account.available = false;
          continue;
        }
        const sample = {
          atMs: state.capturedAtMs,
          used: window.usedPercent,
          resetAtMs: window.resetAtMs,
        };
        if (validSample(sample as Partial<CapacitySample>)) {
          account.windows.push({
            ...(sample as CapacitySample),
            id: window.id,
            periodHours: window.periodHours,
          });
        } else {
          // A malformed mandatory window must not disappear from the capacity constraints.
          account.available = false;
        }
      }
    }
    const previous = accounts.get(key);
    if (
      !previous ||
      (account.available &&
        (!previous.available || (account.windows[0]?.atMs ?? 0) > (previous.windows[0]?.atMs ?? 0)))
    )
      accounts.set(key, account);
  }
  return [...accounts.values()];
}

/** Bounded observations only; no request logs, tokens, timers or network calls. */
export function recordCapacitySamples(
  history: CapacityHistory,
  accounts: CapacityAccount[],
  nowMs: number
): CapacityHistory {
  const next: CapacityHistory = {};
  let keyCount = 0;
  for (const account of accounts) {
    for (const window of account.windows) {
      if (
        !account.available ||
        !account.plan ||
        !validSample(window) ||
        window.atMs > nowMs + RESET_TOLERANCE_MS ||
        nowMs - window.atMs > CAPACITY_LOOKBACK_MS
      )
        continue;
      const key = capacityHistoryKey(account, window);
      if (keyCount >= MAX_KEYS && !(key in next)) break;
      let samples = (history[key] ?? []).filter(
        (s) => validSample(s) && s.atMs >= nowMs - CAPACITY_LOOKBACK_MS
      );
      const last = samples[samples.length - 1];
      if (!last || window.atMs > last.atMs) {
        if (last && !sameSegment(last, window)) samples = [];
        if (!samples.length || !last || window.atMs - last.atMs >= 60_000) {
          samples = [
            ...samples,
            { atMs: window.atMs, used: window.used, resetAtMs: window.resetAtMs },
          ].slice(-MAX_SAMPLES);
        }
      }
      if (!(key in next)) keyCount++;
      next[key] = samples;
    }
  }
  // Keep samples during a refresh/error; pruning uses the current pool, not quota success.
  const accountKeys = new Set(accounts.map((a) => a.key));
  for (const [key, samples] of Object.entries(history)) {
    if (key in next || keyCount >= MAX_KEYS) continue;
    try {
      const identity: unknown = JSON.parse(key);
      if (!Array.isArray(identity) || !accountKeys.has(identity[0])) continue;
      const retained = samples.filter(
        (s) => validSample(s) && s.atMs >= nowMs - CAPACITY_LOOKBACK_MS
      );
      if (retained.length) {
        next[key] = retained;
        keyCount++;
      }
    } catch {
      /* Ignore invalid storage keys. */
    }
  }
  return JSON.stringify(next) === JSON.stringify(history) ? history : next;
}

function windowRate(
  account: CapacityAccount,
  window: CapacityWindow,
  history: CapacityHistory
): number | null {
  const samples = history[capacityHistoryKey(account, window)] ?? [];
  let baseline: CapacitySample = window;
  let next: CapacitySample = window;
  for (let i = samples.length - 1; i >= 0; i--) {
    const sample = samples[i];
    if (sample.atMs >= window.atMs) continue;
    if (sample.atMs < window.atMs - CAPACITY_LOOKBACK_MS || !sameSegment(sample, next)) break;
    baseline = sample;
    next = sample;
  }
  const elapsed = window.atMs - baseline.atMs;
  return elapsed >= CAPACITY_MIN_SAMPLE_MS
    ? ((window.used - baseline.used) * HOUR_MS) / elapsed
    : null;
}

const ceilAccounts = (value: number) => Math.ceil(Math.max(0, value - 1e-9));

export function estimateCapacity(
  accounts: CapacityAccount[],
  history: CapacityHistory,
  nowMs: number
): CapacityGroupEstimate[] {
  const groups = new Map<string, CapacityAccount[]>();
  for (const account of accounts) {
    const plan = account.plan || 'unknown';
    const group = groups.get(plan) ?? [];
    group.push(account);
    groups.set(plan, group);
  }
  // Unknown-plan accounts could belong to any pool; never silently omit their demand.
  const unknownPlan = accounts.some((a) => !a.plan);
  return [...groups].map(([plan, group]) => {
    const fresh = (w: CapacityWindow) =>
      validSample(w) &&
      w.resetAtMs > nowMs &&
      w.atMs <= nowMs + RESET_TOLERANCE_MS &&
      nowMs - w.atMs <= CAPACITY_FRESH_MS;
    const signature = (a: CapacityAccount) =>
      a.windows
        .map((w) => `${w.id}:${w.periodHours}`)
        .sort()
        .join('|');
    const complete =
      !unknownPlan &&
      group.every(
        (a) =>
          a.available &&
          a.windows.length > 0 &&
          a.windows.every(fresh) &&
          signature(a) === signature(group[0])
      );
    const windows: CapacityWindowEstimate[] = group[0].windows.map((window) => {
      const observations = group.map((a) => a.windows.find((w) => w.id === window.id));
      const remaining = observations.reduce((sum, w) => sum + (w ? 100 - w.used : 0), 0);
      const rates = observations.map((w, i) => (w ? windowRate(group[i], w, history) : null));
      const sampledAccounts = rates.filter((r) => r !== null).length;
      const rate =
        sampledAccounts === group.length
          ? rates.reduce<number>((sum, r) => sum + (r ?? 0), 0)
          : null;
      // A fully exhausted window cannot reveal unmet demand. Partial exhaustion is flagged at pool level.
      const limited = observations.every((w) => w?.used === 100);
      const status: CapacityStatus = !complete
        ? 'incomplete'
        : limited
          ? 'limited'
          : rate === null
            ? 'sampling'
            : rate <= 0
              ? 'idle'
              : 'ready';
      const recoveryHours = complete
        ? Math.min(...observations.map((w) => (w!.resetAtMs - nowMs) / HOUR_MS))
        : null;
      const ready = status === 'ready' && rate !== null;
      const requiredAccounts = ready ? ceilAccounts((rate * window.periodHours) / 100) : null;
      // Project each balance from its own capture time to the common 'now'. This does not simulate resets.
      const projectedRemaining = ready
        ? observations.reduce(
            (sum, w, i) =>
              sum +
              Math.max(0, 100 - w!.used - (rates[i]! * Math.max(0, nowMs - w!.atMs)) / HOUR_MS),
            0
          )
        : remaining;
      return {
        id: window.id,
        periodHours: window.periodHours,
        status,
        sampledAccounts,
        remaining: projectedRemaining,
        rate: complete ? rate : null,
        runwayHours: ready ? projectedRemaining / rate : null,
        recoveryHours,
        requiredAccounts,
        additionalAccounts:
          requiredAccounts === null ? null : Math.max(0, requiredAccounts - group.length),
        bridgeAccounts:
          ready && recoveryHours !== null
            ? ceilAccounts((rate * recoveryHours - projectedRemaining) / 100)
            : null,
      };
    });
    const limitedAccounts = group.filter((a) => a.windows.some((w) => w.used === 100)).length;
    const status: CapacityStatus = !complete
      ? 'incomplete'
      : limitedAccounts === group.length || windows.some((w) => w.status === 'limited')
        ? 'limited'
        : windows.some((w) => w.status === 'sampling')
          ? 'sampling'
          : windows.some((w) => w.status === 'idle')
            ? 'idle'
            : 'ready';
    return {
      plan,
      accounts: group.length,
      limitedAccounts,
      status,
      windows,
      additionalAccounts:
        status === 'ready' ? Math.max(...windows.map((w) => w.additionalAccounts!)) : null,
      bridgeAccounts:
        status === 'ready' ? Math.max(...windows.map((w) => w.bridgeAccounts!)) : null,
    };
  });
}

export const capacityStorageKey = (server: string) =>
  `quotaPage.capacityHistory.v1:${encodeURIComponent(server)}`;
export function readCapacityHistory(
  server: string,
  storage?: Pick<Storage, 'getItem'>,
  nowMs = Date.now()
): CapacityHistory {
  try {
    const raw: unknown = JSON.parse(storage?.getItem(capacityStorageKey(server)) ?? '{}');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const result: CapacityHistory = {};
    for (const [key, value] of Object.entries(raw).slice(0, MAX_KEYS)) {
      if (!Array.isArray(value)) continue;
      const samples = value
        .filter(
          (s): s is CapacitySample =>
            s &&
            typeof s === 'object' &&
            validSample(s) &&
            s.atMs >= nowMs - CAPACITY_LOOKBACK_MS &&
            s.atMs <= nowMs + RESET_TOLERANCE_MS
        )
        .sort((a, b) => a.atMs - b.atMs)
        .slice(-MAX_SAMPLES);
      if (samples.length) result[key] = samples;
    }
    return result;
  } catch {
    return {};
  }
}
export function writeCapacityHistory(
  server: string,
  history: CapacityHistory,
  storage?: Pick<Storage, 'setItem'>
): void {
  try {
    storage?.setItem(capacityStorageKey(server), JSON.stringify(history));
  } catch {
    /* Private mode/storage full. */
  }
}
