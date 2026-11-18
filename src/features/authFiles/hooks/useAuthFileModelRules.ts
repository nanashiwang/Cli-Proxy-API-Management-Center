import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authFilesApi } from '@/services/api';
import { useNotificationStore } from '@/stores';
import { getExcludedModelsField, readExcludedModels } from './useAuthFilesPrefixProxyEditor';
import { parseExcludedRulesText } from '@/components/excludedModels';

export function useAuthFileModelRules(open: boolean, fileName: string, readOnly: boolean) {
  const { t } = useTranslation();
  const notify = useNotificationStore((s) => s.showNotification);
  const [original, setOriginal] = useState<string[] | null>(null);
  const [text, setText] = useState('');
  const [field, setField] = useState<'excluded_models' | 'excluded-models'>('excluded_models');
  const [global, setGlobal] = useState<Record<string, string[]> | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    const current = ++generation.current;
    setOriginal(null);
    setText('');
    setGlobal(null);
    setError('');
    if (!open || readOnly) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void Promise.all([authFilesApi.downloadText(fileName), authFilesApi.getOauthExcludedModels()])
      .then(([raw, exclusions]) => {
        if (current !== generation.current) return;
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
      })
      .catch((err: unknown) => {
        if (current === generation.current)
          setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (current === generation.current) setLoading(false);
      });
    return () => {
      generation.current += 1;
    };
  }, [open, fileName, readOnly, revision, t]);

  const rules = parseExcludedRulesText(text);
  const dirty = original !== null && JSON.stringify(original) !== JSON.stringify(rules);
  const save = async (onSaved: () => void) => {
    if (busy.current || !dirty || readOnly || !open) return;
    const current = generation.current;
    busy.current = true;
    setSaving(true);
    setError('');
    try {
      await authFilesApi.patchFields(fileName, { [field]: rules });
      if (current !== generation.current) return;
      setOriginal(rules);
      notify(t('auth_files.prefix_proxy_saved_success', { name: fileName }), 'success');
      onSaved();
    } catch (err) {
      if (current === generation.current) {
        setError(
          `${t('notification.update_failed')}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    } finally {
      busy.current = false;
      setSaving(false);
    }
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
