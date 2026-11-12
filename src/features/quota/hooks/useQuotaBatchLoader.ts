/**
 * 混合提供商批量额度加载（原 useQuotaLoader 的跨分区泛化）。
 *
 * 保留的三道守卫与旧实现逐一对应：
 * - loadingRef：并发批量加载去重；
 * - requestIdRef：被超越的响应直接丢弃；
 * - cacheGeneration：断线重连后过期请求不得写入新会话缓存。
 * 提交按 provider 分组进行 —— 快的提供商先落地，不等慢的。
 */

import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { captureQuotaCacheGeneration, commitIfQuotaCacheCurrent } from '@/stores';
import { getStatusFromError } from '@/utils/quota';
import type { QuotaFileEntry } from '../logic';
import { getQuotaNextCheck } from '@/services/api/apiCall';
import { quotaRetryAt, quotaWaitUntil } from '../cooldown';
import { QUOTA_ADAPTERS, getQuotaSetter, getQuotaMap } from '../providers';
import type { QuotaProviderType } from '../providers/types';

interface BatchFetchResult {
  name: string;
  status: 'success' | 'error';
  data?: unknown;
  error?: string;
  errorStatus?: number;
  nextCheckAt?: number;
}

export function useQuotaBatchLoader() {
  const { t } = useTranslation();
  const [batchLoading, setBatchLoading] = useState(false);
  const loadingRef = useRef(false);
  const requestIdRef = useRef(0);

  const loadQuota = useCallback(
    async (targets: QuotaFileEntry[]) => {
      if (loadingRef.current) return;
      targets = targets.filter(
        ({ file, type }) =>
          quotaWaitUntil(file, getQuotaMap(QUOTA_ADAPTERS[type])[file.name]) <= Date.now()
      );
      if (targets.length === 0) return;
      loadingRef.current = true;
      const requestId = ++requestIdRef.current;
      const cacheGeneration = captureQuotaCacheGeneration();
      setBatchLoading(true);

      try {
        const groups = new Map<QuotaProviderType, QuotaFileEntry[]>();
        targets.forEach((entry) => {
          const group = groups.get(entry.type) ?? [];
          group.push(entry);
          groups.set(entry.type, group);
        });

        await Promise.all(
          Array.from(groups.entries()).map(async ([type, entries]) => {
            const adapter = QUOTA_ADAPTERS[type];
            const setQuota = getQuotaSetter(adapter);

            commitIfQuotaCacheCurrent(cacheGeneration, () => {
              setQuota((prev) => {
                const nextState = { ...prev };
                entries.forEach(({ file }) => {
                  nextState[file.name] = adapter.buildLoadingState();
                });
                return nextState;
              });
            });

            const results = await Promise.all(
              entries.map(async ({ file }): Promise<BatchFetchResult> => {
                try {
                  const data = await adapter.fetchQuota(file, t);
                  return {
                    name: file.name,
                    status: 'success',
                    data,
                    nextCheckAt: getQuotaNextCheck(file.authIndex ?? file.auth_index),
                  };
                } catch (err: unknown) {
                  const message = err instanceof Error ? err.message : t('common.unknown_error');
                  return {
                    name: file.name,
                    status: 'error',
                    error: message,
                    errorStatus: getStatusFromError(err),
                    nextCheckAt:
                      quotaRetryAt(err) ?? getQuotaNextCheck(file.authIndex ?? file.auth_index),
                  };
                }
              })
            );

            if (requestId !== requestIdRef.current) return;

            commitIfQuotaCacheCurrent(cacheGeneration, () => {
              setQuota((prev) => {
                const nextState = { ...prev };
                results.forEach((result) => {
                  nextState[result.name] =
                    result.status === 'success'
                      ? {
                          ...adapter.buildSuccessState(result.data),
                          nextCheckAt: result.nextCheckAt,
                        }
                      : {
                          ...adapter.buildErrorState(
                            result.error || t('common.unknown_error'),
                            result.errorStatus
                          ),
                          nextCheckAt: result.nextCheckAt,
                        };
                });
                return nextState;
              });
            });
          })
        );
      } finally {
        if (requestId === requestIdRef.current) {
          setBatchLoading(false);
          loadingRef.current = false;
        }
      }
    },
    [t]
  );

  return { batchLoading, loadQuota };
}
