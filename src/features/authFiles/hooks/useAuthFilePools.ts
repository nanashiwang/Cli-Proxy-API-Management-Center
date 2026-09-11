import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { accountPoolsApi, type AccountPoolsResponse } from '@/services/api/accountPools';
import { useAuthStore } from '@/stores';
import { indexPoolCredentials } from '../poolAccess';

export function useAuthFilePools(active: boolean) {
  const apiBase = useAuthStore((s) => s.apiBase);
  const [snapshot, setSnapshot] = useState<{ server: string; data: AccountPoolsResponse } | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const sequence = useRef({ value: 0 });
  const data = snapshot?.server === apiBase ? snapshot.data : null;
  const refresh = useCallback(async () => {
    const id = ++sequence.current.value;
    setLoading(true);
    try {
      const result = await accountPoolsApi.get();
      if (id !== sequence.current.value) return null;
      setSnapshot({ server: apiBase, data: result });
      setError(false);
      return result;
    } catch {
      if (id === sequence.current.value) {
        setSnapshot(null);
        setError(true);
      }
      return null;
    } finally {
      if (id === sequence.current.value) setLoading(false);
    }
  }, [apiBase]);
  useEffect(() => {
    const token = sequence.current;
    setSnapshot(null);
    if (active) void refresh();
    return () => {
      token.value++;
    };
  }, [active, refresh]);
  const resolve = useMemo(() => indexPoolCredentials(data), [data]);
  return { data, loading, error, refresh, resolve, apiBase };
}
