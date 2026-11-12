/**
 * Generic API call helper (proxied via management API).
 */

import type { AxiosRequestConfig } from 'axios';
import { apiClient } from './client';
import { isRecord } from '@/utils/helpers';
import { captureQuotaCacheGeneration } from '@/stores/useQuotaStore';

export interface ApiCallRequest {
  authIndex?: string;
  method: string;
  url: string;
  header?: Record<string, string>;
  data?: string;
}

export interface ApiCallResult<T = unknown> {
  statusCode: number;
  header: Record<string, string[]>;
  bodyText: string;
  body: T | null;
}

const normalizeBody = (input: unknown): { bodyText: string; body: unknown | null } => {
  if (input === undefined || input === null) {
    return { bodyText: '', body: null };
  }

  if (typeof input === 'string') {
    const text = input;
    const trimmed = text.trim();
    if (!trimmed) {
      return { bodyText: text, body: null };
    }
    try {
      return { bodyText: text, body: JSON.parse(trimmed) };
    } catch {
      return { bodyText: text, body: text };
    }
  }

  try {
    return { bodyText: JSON.stringify(input), body: input };
  } catch {
    return { bodyText: String(input), body: input };
  }
};

export const getApiCallErrorMessage = (result: ApiCallResult): string => {
  const status = result.statusCode;
  const body = result.body;
  const bodyText = result.bodyText;
  let message = '';

  if (isRecord(body)) {
    const errorValue = body.error;
    if (isRecord(errorValue) && typeof errorValue.message === 'string') {
      message = errorValue.message;
    } else if (typeof errorValue === 'string') {
      message = errorValue;
    }
    if (!message && typeof body.message === 'string') {
      message = body.message;
    }
  } else if (typeof body === 'string') {
    message = body;
  }

  if (!message && bodyText) {
    message = bodyText;
  }

  if (status && message) return `${status} ${message}`.trim();
  if (status) return `HTTP ${status}`;
  return message || 'Request failed';
};

const quotaNextChecks = new Map<string, number>();
export const getQuotaNextCheck = (authIndex: unknown): number | undefined =>
  quotaNextChecks.get(`${captureQuotaCacheGeneration()}:${String(authIndex)}`);

export const apiCallApi = {
  request: async (payload: ApiCallRequest, config?: AxiosRequestConfig): Promise<ApiCallResult> => {
    const cacheKey = `${captureQuotaCacheGeneration()}:${payload.authIndex}`;
    if (quotaNextChecks.size > 4096) quotaNextChecks.clear();
    if (!payload.url.endsWith('/profile')) quotaNextChecks.delete(cacheKey);
    const response = await apiClient.post<Record<string, unknown>>('/api-call', payload, config);
    const statusCode = Number(response?.status_code ?? 0);
    const header = (response?.header ?? {}) as Record<string, string[]>;
    const { bodyText, body } = normalizeBody(response?.body);

    const nextHeader = Object.entries(header).find(
      ([key]) => key.toLowerCase() === 'x-cpa-quota-next-check'
    )?.[1]?.[0];
    if (payload.authIndex && !payload.url.endsWith('/profile') && nextHeader) {
      const timestamp = Date.parse(nextHeader);
      if (Number.isFinite(timestamp)) quotaNextChecks.set(cacheKey, timestamp);
    }
    if (statusCode === 429 && payload.authIndex) {
      const raw = Object.entries(header).find(
        ([key]) => key.toLowerCase() === 'x-cpa-quota-next-check'
      )?.[1]?.[0];
      const retry = Object.entries(header).find(
        ([key]) => key.toLowerCase() === 'retry-after'
      )?.[1]?.[0];
      const parsed = raw
        ? Date.parse(raw)
        : retry && /^\d+$/.test(retry)
          ? Date.now() + Number(retry) * 1000
          : retry
            ? Date.parse(retry)
            : NaN;
      const nextCheckAt =
        Number.isFinite(parsed) && parsed > Date.now() ? parsed : Date.now() + 120_000;
      quotaNextChecks.set(cacheKey, nextCheckAt);
      throw Object.assign(
        new Error(getApiCallErrorMessage({ statusCode, header, bodyText, body })),
        { status: 429, nextCheckAt }
      );
    }
    return {
      statusCode,
      header,
      bodyText,
      body,
    };
  },
};
