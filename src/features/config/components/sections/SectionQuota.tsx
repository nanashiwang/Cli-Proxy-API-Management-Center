import { Input } from '@/components/ui/Input';
import { getValidationMessage } from '../blocks/shared';
import { useTranslation } from 'react-i18next';
import { CONFIG_TAB_ICONS, SECTION_INDEX_LABELS } from '../../constants';
import type { ConfigSectionProps } from '../../types';
import { SectionCard } from '../SectionCard';
import { FieldAnchor, FieldGrid, FieldStack, ToggleRow } from '../fields/FieldPrimitives';
import { QuotaSwitchPreviewModelToggle, QuotaSwitchProjectToggle } from '../fields/sharedFields';

const Icon = CONFIG_TAB_ICONS.quota;

/** 04 配额回退：配额耗尽时的回退策略（两个开关默认 true）。 */
export function SectionQuota({
  values,
  validationErrors,
  disabled,
  animateIn,
  onChange,
}: ConfigSectionProps) {
  const { t } = useTranslation();

  return (
    <SectionCard
      indexLabel={SECTION_INDEX_LABELS.quota}
      icon={<Icon size={16} />}
      title={t('config_management.visual.sections.quota.title')}
      description={t('config_management.visual.sections.quota.description')}
      animateIn={animateIn}
    >
      <FieldStack>
        <FieldAnchor fieldId="codexQuotaGuardEnabled">
          <ToggleRow
            title={t('config_management.visual.sections.quota.guard_enabled')}
            description={t('config_management.visual.sections.quota.guard_hint')}
            checked={values.codexQuotaGuardEnabled}
            disabled={disabled}
            onChange={(codexQuotaGuardEnabled) => onChange({ codexQuotaGuardEnabled })}
          />
        </FieldAnchor>
        <FieldGrid>
          <FieldAnchor fieldId="codexQuotaFiveHourPercent">
            <Input
              label={t('config_management.visual.sections.quota.five-hour-used-percent')}
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={values.codexQuotaFiveHourPercent}
              disabled={disabled}
              error={getValidationMessage(t, validationErrors?.codexQuotaFiveHourPercent)}
              onChange={(e) => onChange({ codexQuotaFiveHourPercent: e.target.value })}
            />
          </FieldAnchor>
          <FieldAnchor fieldId="codexQuotaFiveHourJitter">
            <Input
              label={t('config_management.visual.sections.quota.five-hour-jitter')}
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={values.codexQuotaFiveHourJitter}
              disabled={disabled}
              error={getValidationMessage(t, validationErrors?.codexQuotaFiveHourJitter)}
              onChange={(e) => onChange({ codexQuotaFiveHourJitter: e.target.value })}
            />
          </FieldAnchor>
          <FieldAnchor fieldId="codexQuotaWeeklyPercent">
            <Input
              label={t('config_management.visual.sections.quota.weekly-used-percent')}
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={values.codexQuotaWeeklyPercent}
              disabled={disabled}
              error={getValidationMessage(t, validationErrors?.codexQuotaWeeklyPercent)}
              onChange={(e) => onChange({ codexQuotaWeeklyPercent: e.target.value })}
            />
          </FieldAnchor>
          <FieldAnchor fieldId="codexQuotaWeeklyJitter">
            <Input
              label={t('config_management.visual.sections.quota.weekly-jitter')}
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={values.codexQuotaWeeklyJitter}
              disabled={disabled}
              error={getValidationMessage(t, validationErrors?.codexQuotaWeeklyJitter)}
              onChange={(e) => onChange({ codexQuotaWeeklyJitter: e.target.value })}
            />
          </FieldAnchor>

          <QuotaSwitchProjectToggle values={values} disabled={disabled} onChange={onChange} />
          <QuotaSwitchPreviewModelToggle values={values} disabled={disabled} onChange={onChange} />
          <FieldAnchor fieldId="quotaAntigravityCredits">
            <ToggleRow
              title={t('config_management.visual.sections.quota.antigravity_credits')}
              checked={values.quotaAntigravityCredits}
              disabled={disabled}
              onChange={(quotaAntigravityCredits) => onChange({ quotaAntigravityCredits })}
            />
          </FieldAnchor>
        </FieldGrid>
      </FieldStack>
    </SectionCard>
  );
}
