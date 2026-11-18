import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { EmptyState } from '@/components/ui/EmptyState';
import { useNotificationStore } from '@/stores';
import type { AuthFileModelItem } from '@/features/authFiles/constants';
import { isModelExcluded } from '@/features/authFiles/constants';
import {
  getModelExclusionState,
  toggleExcludedRule,
} from '@/components/excludedModels/excludedModelRules';
import { buildAuthFileModelCandidates } from '../modelCandidates';
import { useAuthFileModelRules } from '../hooks/useAuthFileModelRules';
import styles from './AuthFileModelsModal.module.scss';

export type AuthFileModelsModalProps = {
  open: boolean;
  fileName: string;
  fileType: string;
  loading: boolean;
  error: 'unsupported' | null;
  models: AuthFileModelItem[];
  excluded: Record<string, string[]>;
  readOnly: boolean;
  disabled: boolean;
  onSaved: () => void;
  onClose: () => void;
  onCopyText: (text: string) => void;
};

export function AuthFileModelsModal(props: AuthFileModelsModalProps) {
  const { t } = useTranslation();
  const {
    open,
    fileName,
    fileType,
    loading,
    error,
    models,
    excluded,
    readOnly,
    disabled,
    onSaved,
    onClose,
    onCopyText,
  } = props;
  const editor = useAuthFileModelRules(open, fileName, readOnly);
  const [search, setSearch] = useState({ fileName: '', value: '' });
  const query = search.fileName === fileName ? search.value : '';
  const showConfirmation = useNotificationStore((s) => s.showConfirmation);
  const blocked =
    disabled || readOnly || editor.loading || editor.saving || editor.original === null;
  const candidates = useMemo(
    () => buildAuthFileModelCandidates(models, editor.original ?? [], editor.rules),
    [models, editor.original, editor.rules]
  );
  const visible = candidates.filter((model) =>
    `${model.id} ${model.display_name ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())
  );
  const close = () => {
    if (editor.saving) return;
    if (!editor.dirty) {
      onClose();
      return;
    }
    showConfirmation({
      title: t('providersPage.unsavedChanges.title'),
      message: t('providersPage.unsavedChanges.message'),
      confirmText: t('providersPage.unsavedChanges.discard'),
      cancelText: t('providersPage.unsavedChanges.keepEditing'),
      onConfirm: onClose,
    });
  };

  return (
    <Modal
      open={open}
      onClose={close}
      closeDisabled={editor.saving}
      width={720}
      title={`${t('auth_files.models_title')} - ${fileName}`}
      footer={
        <>
          {editor.dirty && <span className="hint">{t('auth_files.model_controls_unsaved')}</span>}
          <Button variant="secondary" onClick={close} disabled={editor.saving}>
            {t('common.close')}
          </Button>
          {!readOnly && (
            <Button
              onClick={() => {
                if (!blocked)
                  void editor.save(() => {
                    onSaved();
                    onClose();
                  });
              }}
              disabled={blocked || !editor.dirty}
              loading={editor.saving}
            >
              {t('common.save')}
            </Button>
          )}
        </>
      }
    >
      <p className="hint">
        {t(readOnly ? 'auth_files.model_controls_readonly' : 'auth_files.model_controls_hint')}
      </p>
      {editor.error && (
        <div className="error-box" role="alert">
          {editor.error}
          {editor.original === null && (
            <Button variant="secondary" onClick={editor.retry}>
              {t('excluded_models.catalog_retry')}
            </Button>
          )}
        </div>
      )}
      {loading || editor.loading ? (
        <div className="hint">{t('auth_files.models_loading')}</div>
      ) : error === 'unsupported' ? (
        <EmptyState
          title={t('auth_files.models_unsupported')}
          description={t('auth_files.models_unsupported_desc')}
        />
      ) : (
        <>
          <Input
            value={query}
            onChange={(event) => setSearch({ fileName, value: event.target.value })}
            placeholder={t('excluded_models.search_placeholder')}
            aria-label={t('excluded_models.search_aria')}
          />
          <div className={styles.list}>
            {visible.length === 0 && (
              <p className="hint">
                {t(query ? 'excluded_models.no_results' : 'auth_files.models_empty', { query })}
              </p>
            )}
            {visible.map((model) => {
              const state = getModelExclusionState(editor.rules, model.id);
              const globalExcluded = isModelExcluded(model.id, fileType, editor.global ?? excluded);
              const wildcard =
                state.state === 'excluded' && (state.by === 'wildcard' || state.by === 'both');
              const isExcluded = state.state === 'excluded' || globalExcluded;
              const reason = globalExcluded
                ? t('auth_files.model_controls_global')
                : wildcard
                  ? t('excluded_models.wildcard_locked', { rule: state.rule })
                  : '';
              return (
                <div
                  key={model.id}
                  className={`${styles.item} ${isExcluded ? styles.itemExcluded : ''}`}
                >
                  <div className={styles.modelText}>
                    <span className={styles.modelId}>{model.id}</span>
                    {model.display_name && model.display_name !== model.id && (
                      <span className={styles.modelDisplayName}>{model.display_name}</span>
                    )}
                    {reason && <span className={styles.reason}>{reason}</span>}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onCopyText(model.id)}
                    aria-label={`${t('common.copy')} ${model.id}`}
                  >
                    {t('common.copy')}
                  </Button>
                  <ToggleSwitch
                    checked={!isExcluded}
                    disabled={blocked || globalExcluded || wildcard}
                    label={t(
                      isExcluded
                        ? 'auth_files.model_controls_excluded'
                        : 'auth_files.model_controls_allowed'
                    )}
                    ariaLabel={`${t('auth_files.model_controls_allowed')} ${model.id}`}
                    onChange={(allowed) =>
                      editor.setText(
                        toggleExcludedRule(editor.rules, model.id, !allowed).join('\n')
                      )
                    }
                  />
                </div>
              );
            })}
          </div>
        </>
      )}
      {!readOnly && editor.original !== null && (
        <details className={styles.rules}>
          <summary>{t('auth_files.model_controls_rules')}</summary>
          <label className={styles.rulesLabel}>
            {t('auth_files.excluded_models_label')}
            <textarea
              className="input"
              rows={4}
              value={editor.text}
              disabled={blocked}
              onChange={(event) => editor.setText(event.target.value)}
            />
          </label>
          <p className="hint">{t('auth_files.model_controls_rules_hint')}</p>
        </details>
      )}
    </Modal>
  );
}
