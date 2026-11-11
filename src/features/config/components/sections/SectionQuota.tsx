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
        <FieldAnchor fieldId="quotaGuardEnabled">
          <ToggleRow
            title={t('config_management.visual.sections.quota.guard_enabled')}
            description={t('config_management.visual.sections.quota.guard_hint')}
            checked={values.quotaGuardEnabled}
            disabled={disabled}
            onChange={(quotaGuardEnabled) => onChange({ quotaGuardEnabled })}
          />
        </FieldAnchor>
        <FieldGrid>
          <FieldAnchor fieldId="quotaGuardFiveHourPercent">
            <Input
              label={t('config_management.visual.sections.quota.five-hour-used-percent')}
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={values.quotaGuardFiveHourPercent}
              disabled={disabled}
              error={getValidationMessage(t, validationErrors?.quotaGuardFiveHourPercent)}
              onChange={(e) => onChange({ quotaGuardFiveHourPercent: e.target.value })}
            />
          </FieldAnchor>
          <FieldAnchor fieldId="quotaGuardFiveHourJitter">
            <Input
              label={t('config_management.visual.sections.quota.five-hour-jitter')}
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={values.quotaGuardFiveHourJitter}
              disabled={disabled}
              error={getValidationMessage(t, validationErrors?.quotaGuardFiveHourJitter)}
              onChange={(e) => onChange({ quotaGuardFiveHourJitter: e.target.value })}
            />
          </FieldAnchor>
          <FieldAnchor fieldId="quotaGuardWeeklyPercent">
            <Input
              label={t('config_management.visual.sections.quota.weekly-used-percent')}
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={values.quotaGuardWeeklyPercent}
              disabled={disabled}
              error={getValidationMessage(t, validationErrors?.quotaGuardWeeklyPercent)}
              onChange={(e) => onChange({ quotaGuardWeeklyPercent: e.target.value })}
            />
          </FieldAnchor>
          <FieldAnchor fieldId="quotaGuardWeeklyJitter">
            <Input
              label={t('config_management.visual.sections.quota.weekly-jitter')}
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={values.quotaGuardWeeklyJitter}
              disabled={disabled}
              error={getValidationMessage(t, validationErrors?.quotaGuardWeeklyJitter)}
              onChange={(e) => onChange({ quotaGuardWeeklyJitter: e.target.value })}
            />
          </FieldAnchor>
          <FieldAnchor fieldId="quotaGuardMonthlyPercent">
            <Input
              label={t('config_management.visual.sections.quota.monthly-used-percent')}
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={values.quotaGuardMonthlyPercent}
              disabled={disabled}
              error={getValidationMessage(t, validationErrors?.quotaGuardMonthlyPercent)}
              onChange={(e) => onChange({ quotaGuardMonthlyPercent: e.target.value })}
            />
          </FieldAnchor>
          <FieldAnchor fieldId="quotaGuardMonthlyJitter">
            <Input
              label={t('config_management.visual.sections.quota.monthly-jitter')}
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={values.quotaGuardMonthlyJitter}
              disabled={disabled}
              error={getValidationMessage(t, validationErrors?.quotaGuardMonthlyJitter)}
              onChange={(e) => onChange({ quotaGuardMonthlyJitter: e.target.value })}
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
