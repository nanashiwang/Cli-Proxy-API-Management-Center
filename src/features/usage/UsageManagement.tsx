import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { usageApi, type PricingOverrideInput } from '@/services/api/usage';
import { useNotificationStore } from '@/stores/useNotificationStore';
import type { ModelPricingStatus, ModelPricingSummary, UsageStorageStatus } from '@/types/usage';
import { formatUSD } from './utils';
import styles from './UsagePage.module.scss';

type PricingDraft = {
  model: string;
  provider: string;
  input: string;
  output: string;
  cacheRead: string;
  cacheWrite: string;
};

const EMPTY_DRAFT: PricingDraft = {
  model: '',
  provider: '',
  input: '',
  output: '',
  cacheRead: '',
  cacheWrite: '',
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error';

export function UsageManagement({
  storage,
  onChange,
}: {
  storage?: UsageStorageStatus;
  onChange: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const { showNotification, showConfirmation } = useNotificationStore();
  const [pricingStatus, setPricingStatus] = useState<ModelPricingStatus | null>(null);
  const [pricingModels, setPricingModels] = useState<ModelPricingSummary[]>([]);
  const [pricingQuery, setPricingQuery] = useState('');
  const [pricingDraft, setPricingDraft] = useState<PricingDraft>(EMPTY_DRAFT);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [savingPricing, setSavingPricing] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const loadUsage = onChange;
  useEffect(() => {
    void usageApi
      .getPricingStatus()
      .then(setPricingStatus)
      .catch(() => {});
  }, []);
  const loadPricing = useCallback(async () => {
    setPricingLoading(true);
    try {
      const result = await usageApi.listPricing(pricingQuery, 100);
      setPricingModels(result.models ?? []);
    } catch (error) {
      showNotification(`${t('usage_stats.pricing_load_failed')}: ${errorMessage(error)}`, 'error');
    } finally {
      setPricingLoading(false);
    }
  }, [pricingQuery, showNotification, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPricing(), 250);
    return () => window.clearTimeout(timer);
  }, [loadPricing]);

  const handleExport = async () => {
    try {
      const payload = await usageApi.exportUsage();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `cpa-usage-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      showNotification(t('usage_stats.export_success'), 'success');
    } catch (error) {
      showNotification(`${t('usage_stats.export_failed')}: ${errorMessage(error)}`, 'error');
    }
  };

  const handleImport = async (file?: File) => {
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text()) as unknown;
      await usageApi.importUsage(payload);
      showNotification(t('usage_stats.import_success'), 'success');
      await loadUsage();
    } catch (error) {
      showNotification(`${t('usage_stats.import_failed')}: ${errorMessage(error)}`, 'error');
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const handleClear = () => {
    showConfirmation({
      title: t('usage_stats.clear_title'),
      message: t('usage_stats.clear_confirm'),
      confirmText: t('common.confirm'),
      cancelText: t('common.cancel'),
      variant: 'danger',
      onConfirm: async () => {
        await usageApi.clearUsage();
        showNotification(t('usage_stats.clear_success'), 'success');
        await loadUsage();
      },
    });
  };

  const handleRefreshPricing = async () => {
    setPricingLoading(true);
    try {
      const result = await usageApi.refreshPricing();
      setPricingStatus(result.status);
      await loadPricing();
      showNotification(t('usage_stats.pricing_refresh_success'), 'success');
    } catch (error) {
      showNotification(
        `${t('usage_stats.pricing_refresh_failed')}: ${errorMessage(error)}`,
        'error'
      );
    } finally {
      setPricingLoading(false);
    }
  };

  const editPricing = (model: ModelPricingSummary) => {
    setPricingDraft({
      model: model.model,
      provider: model.provider ?? '',
      input: String(model.input_usd_per_million_tokens),
      output: String(model.output_usd_per_million_tokens),
      cacheRead: String(model.cache_read_usd_per_million_tokens),
      cacheWrite: String(model.cache_write_usd_per_million_tokens),
    });
  };

  const handleSavePricing = async () => {
    if (!pricingDraft.model) return;
    const parseValue = (value: string) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
    };
    const payload: PricingOverrideInput = {
      provider: pricingDraft.provider.trim() || undefined,
      input: parseValue(pricingDraft.input),
      output: parseValue(pricingDraft.output),
      'cache-read': parseValue(pricingDraft.cacheRead),
      'cache-write': parseValue(pricingDraft.cacheWrite),
    };
    setSavingPricing(true);
    try {
      await usageApi.putCustomPricing(pricingDraft.model, payload);
      showNotification(t('usage_stats.pricing_save_success'), 'success');
      setPricingDraft(EMPTY_DRAFT);
      await Promise.all([loadPricing(), loadUsage()]);
    } catch (error) {
      showNotification(`${t('usage_stats.pricing_save_failed')}: ${errorMessage(error)}`, 'error');
    } finally {
      setSavingPricing(false);
    }
  };

  const handleDeletePricing = async (model: string) => {
    try {
      await usageApi.deleteCustomPricing(model);
      showNotification(t('usage_stats.pricing_delete_success'), 'success');
      await Promise.all([loadPricing(), loadUsage()]);
    } catch (error) {
      showNotification(
        `${t('usage_stats.pricing_delete_failed')}: ${errorMessage(error)}`,
        'error'
      );
    }
  };

  return (
    <div className={styles.management}>
      <article className={styles.panel}>
        <PanelHeader
          title={t('usage_stats.pricing_title')}
          meta={
            pricingStatus
              ? `${pricingStatus.model_count.toLocaleString()} · ${pricingStatus.active_source}`
              : undefined
          }
        />
        <div className={styles.pricingToolbar}>
          <input
            value={pricingQuery}
            onChange={(event) => setPricingQuery(event.target.value)}
            placeholder={t('usage_stats.pricing_search')}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleRefreshPricing()}
            loading={pricingLoading}
          >
            {t('usage_stats.pricing_refresh')}
          </Button>
        </div>
        {pricingStatus?.last_error ? (
          <div className={styles.errorBanner}>{pricingStatus.last_error}</div>
        ) : null}
        <div className={`${styles.tableWrap} ${styles.pricingTableWrap}`}>
          <table>
            <thead>
              <tr>
                <th>{t('usage_stats.model')}</th>
                <th>{t('usage_stats.provider')}</th>
                <th>{t('usage_stats.input_price')}</th>
                <th>{t('usage_stats.output_price')}</th>
                <th>{t('usage_stats.cache_read_price')}</th>
                <th>{t('usage_stats.cache_write_price')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pricingModels.map((model) => (
                <tr key={model.model}>
                  <td>
                    <strong>{model.model}</strong>
                    {model.custom_override ? (
                      <small>{t('usage_stats.custom_override')}</small>
                    ) : null}
                  </td>
                  <td>{model.provider || '—'}</td>
                  <td>{formatUSD(model.input_usd_per_million_tokens)}</td>
                  <td>{formatUSD(model.output_usd_per_million_tokens)}</td>
                  <td>{formatUSD(model.cache_read_usd_per_million_tokens)}</td>
                  <td>{formatUSD(model.cache_write_usd_per_million_tokens)}</td>
                  <td className={styles.rowActions}>
                    <button onClick={() => editPricing(model)}>{t('common.edit')}</button>
                    {model.custom_override ? (
                      <button onClick={() => void handleDeletePricing(model.model)}>
                        {t('common.delete')}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      {pricingDraft.model ? (
        <article className={styles.panel}>
          <PanelHeader title={t('usage_stats.pricing_edit', { model: pricingDraft.model })} />
          <div className={styles.priceForm}>
            {(['provider', 'input', 'output', 'cacheRead', 'cacheWrite'] as const).map((field) => (
              <label key={field}>
                <span>{t(`usage_stats.field_${field}`)}</span>
                <input
                  value={pricingDraft[field]}
                  onChange={(event) =>
                    setPricingDraft((current) => ({
                      ...current,
                      [field]: event.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>
          <div className={styles.formActions}>
            <Button variant="ghost" onClick={() => setPricingDraft(EMPTY_DRAFT)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void handleSavePricing()} loading={savingPricing}>
              {t('common.save')}
            </Button>
          </div>
        </article>
      ) : null}

      <article className={`${styles.panel} ${styles.storagePanel}`}>
        <div>
          <h2>{t('usage_stats.storage_title')}</h2>
          <p>{storage?.storage_path || t('usage_stats.storage_path_default')}</p>
        </div>
        <div className={styles.headerActions}>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => void handleImport(event.target.files?.[0])}
          />
          <Button variant="secondary" size="sm" onClick={() => importInputRef.current?.click()}>
            {t('usage_stats.import')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void handleExport()}>
            {t('usage_stats.export')}
          </Button>
          <Button variant="danger" size="sm" onClick={handleClear}>
            {t('usage_stats.clear')}
          </Button>
        </div>
      </article>
    </div>
  );
}

function PanelHeader({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className={styles.panelHeader}>
      <h2>{title}</h2>
      {meta ? <span>{meta}</span> : null}
    </div>
  );
}
