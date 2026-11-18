import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient, authFilesApi } from '@/services/api';
import { useAuthStore, useNotificationStore } from '@/stores';
import { getExcludedModelsField, readExcludedModels } from './useAuthFilesPrefixProxyEditor';
import { parseExcludedRulesText } from '@/components/excludedModels';

type ModelRulesOperation<T> = {
  start: () => void;
  success: (value: T) => void;
  error: (error: unknown) => void;
  finish: () => void;
};

/** Owns async completions and the save lock for one file/connection session. */
export function createAuthFileModelRulesSessions(getConnectionRevision: () => number) {
  let generation = 0;
  return {
    begin() {
      const current = ++generation;
      const revision = getConnectionRevision();
      let busy = false;
      const isCurrent = () => current === generation && revision === getConnectionRevision();
      const run = async <T>(
        operation: () => Promise<T>,
        callbacks: ModelRulesOperation<T>,
        exclusive: boolean
      ) => {
        if (!isCurrent() || (exclusive && busy)) return;
        if (exclusive) busy = true;
        try {
          callbacks.start();
          const value = await operation();
          if (isCurrent()) callbacks.success(value);
        } catch (error) {
          if (isCurrent()) callbacks.error(error);
        } finally {
          if (exclusive) busy = false;
          if (isCurrent()) callbacks.finish();
        }
      };
      return {
        load: <T>(operation: () => Promise<T>, callbacks: ModelRulesOperation<T>) =>
          run(operation, callbacks, false),
        save: <T>(operation: () => Promise<T>, callbacks: ModelRulesOperation<T>) =>
          run(operation, callbacks, true),
        invalidate: () => {
          if (current === generation) generation += 1;
        },
      };
    },
  };
}

export function useAuthFileModelRules(open: boolean, fileName: string, readOnly: boolean) {
  const { t } = useTranslation();
  const apiBase = useAuthStore((s) => s.apiBase);
  const managementKey = useAuthStore((s) => s.managementKey);
  const connectionStatus = useAuthStore((s) => s.connectionStatus);
  const notify = useNotificationStore((s) => s.showNotification);
  const [original, setOriginal] = useState<string[] | null>(null);
  const [text, setText] = useState('');
  const [field, setField] = useState<'excluded_models' | 'excluded-models'>('excluded_models');
  const [global, setGlobal] = useState<Record<string, string[]> | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const sessions = useRef(
    createAuthFileModelRulesSessions(() => apiClient.getConnectionRevision())
  );
  const session = useRef<ReturnType<typeof sessions.current.begin> | null>(null);

  useEffect(() => {
    const current = sessions.current.begin();
    session.current = current;
    setSaving(false);
    setOriginal(null);
    setText('');
    setGlobal(null);
    setError('');
    if (!open || readOnly || connectionStatus !== 'connected') {
      setLoading(false);
      return current.invalidate;
    }
    void current.load(
      () =>
        Promise.all([authFilesApi.downloadText(fileName), authFilesApi.getOauthExcludedModels()]),
      {
        start: () => setLoading(true),
        success: ([raw, exclusions]) => {
          let json: unknown;
          try {
            json = JSON.parse(raw);
          } catch {
            throw new Error(t('auth_files.prefix_proxy_invalid_json'));
          }
          if (!json || typeof json !== 'object' || Array.isArray(json)) {
            throw new Error(t('auth_files.prefix_proxy_invalid_json'));
          }
          const record = json as Record<string, unknown>;
          const rules = readExcludedModels(record);
          setOriginal(rules);
          setText(rules.join('\n'));
          setField(getExcludedModelsField(record));
          setGlobal(exclusions);
        },
        error: (err) => setError(err instanceof Error ? err.message : String(err)),
        finish: () => setLoading(false),
      }
    );
    return current.invalidate;
  }, [open, fileName, readOnly, revision, t, apiBase, managementKey, connectionStatus]);

  const rules = parseExcludedRulesText(text);
  const dirty = original !== null && JSON.stringify(original) !== JSON.stringify(rules);
  const save = async (onSaved: () => void) => {
    if (!dirty || readOnly || !open || connectionStatus !== 'connected') return;
    await session.current?.save(() => authFilesApi.patchFields(fileName, { [field]: rules }), {
      start: () => {
        setSaving(true);
        setError('');
      },
      success: () => {
        setOriginal(rules);
        notify(t('auth_files.prefix_proxy_saved_success', { name: fileName }), 'success');
        onSaved();
      },
      error: (err) => {
        setError(
          `${t('notification.update_failed')}: ${err instanceof Error ? err.message : String(err)}`
        );
      },
      finish: () => setSaving(false),
    });
  };
  return {
    original,
    rules,
    text,
    setText,
    global,
    loading,
    saving,
    error,
    dirty,
    save,
    retry: () => setRevision((value) => value + 1),
  };
}
