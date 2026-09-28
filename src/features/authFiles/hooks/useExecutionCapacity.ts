import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/services/api/client';
import { useAuthStore } from '@/stores/useAuthStore';
import type { AuthFileItem, ExecutionCapacity } from '@/types/authFile';
import { normalizeExecutionCapacity } from '../executionCapacity';

type Snapshot = { identity: string; accounts: Record<string, ExecutionCapacity>; failed: boolean };
export function useExecutionCapacity(files: AuthFileItem[], enabled: boolean) {
  const apiBase = useAuthStore((s) => s.apiBase);
  const managementKey = useAuthStore((s) => s.managementKey);
  const ids = useMemo(
    () => [...new Set(files.map((f) => String(f.id ?? '')).filter(Boolean))].sort().slice(0, 200),
    [files]
  );
  const idsKey = JSON.stringify(ids);
  // Include session identity so a late response cannot cross server/log-in changes.
  const identity = JSON.stringify([apiBase, managementKey, idsKey]);
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!enabled || !ids.length) return;
    let disposed = false;
    let pending = false;
    let unsupported = false;
    let controller: AbortController | undefined;
    const poll = async () => {
      setNow(Date.now());
      if (disposed || pending || unsupported || document.visibilityState === 'hidden') return;
      pending = true;
      controller = new AbortController();
      try {
        const data = await apiClient.post<{ accounts?: Record<string, unknown> }>(
          '/auth-files/capacity',
          { ids: JSON.parse(idsKey) },
          { signal: controller.signal }
        );
        if (disposed) return;
        if (!data.accounts || typeof data.accounts !== 'object' || Array.isArray(data.accounts))
          throw new Error('Invalid capacity snapshot');
        const accounts: Record<string, ExecutionCapacity> = {};
        for (const id of JSON.parse(idsKey) as string[]) {
          const value = normalizeExecutionCapacity(data.accounts[id]);
          if (value) accounts[id] = value;
        }
        setSnapshot({ identity, accounts, failed: false });
      } catch (error) {
        if (disposed || controller.signal.aborted) return;
        const status = (error as { status?: number }).status;
        unsupported = status === 404 || status === 405 || status === 501;
        setSnapshot((old) => ({
          identity,
          accounts: old?.identity === identity ? old.accounts : {},
          failed: true,
        }));
      } finally {
        pending = false;
      }
    };
    const visibility = () => {
      setNow(Date.now());
      if (document.visibilityState === 'hidden') controller?.abort();
      else void poll();
    };
    void poll();
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') void poll();
    }, 5_000);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      disposed = true;
      controller?.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [identity, idsKey, enabled, ids.length]);
  return (file: AuthFileItem) => {
    const current = snapshot?.identity === identity ? snapshot : undefined;
    const capacity =
      current && !current.failed
        ? current.accounts[String(file.id)]
        : (current?.accounts[String(file.id)] ?? file.executionCapacity);
    const stale = Boolean(
      capacity && (current?.failed || now - Date.parse(capacity.observedAt) > 15_000)
    );
    return { capacity, stale };
  };
}
