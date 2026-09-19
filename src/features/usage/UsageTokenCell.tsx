import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { IconInbox, IconInfo } from '@/components/ui/icons';
import type { UsageRecord } from '@/types/usage';
import { usageTokenMetrics } from './tokenPresentation';
import { formatTokens } from './utils';
import styles from './UsageTokenCell.module.scss';

export function UsageTokenCell({ record }: { record: UsageRecord }) {
  const { t, i18n } = useTranslation();
  const metrics = usageTokenMetrics(record);
  const tooltipId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const pinned = useRef(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' });
  const exact = (value: number | null) =>
    value === null ? '—' : value.toLocaleString(i18n.language);
  const cacheUnreported =
    metrics.cacheWrite === 0 && record.billing?.reason === 'cache_write_tokens_unreported';

  const cancelLeave = () => {
    if (leaveTimer.current !== null) clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
  };
  const preview = () => {
    cancelLeave();
    setOpen(true);
  };
  const leave = () => {
    cancelLeave();
    if (pinned.current || document.activeElement === trigger.current) return;
    leaveTimer.current = setTimeout(() => setOpen(false), 150);
  };

  useEffect(
    () => () => {
      if (leaveTimer.current !== null) clearTimeout(leaveTimer.current);
    },
    []
  );

  useEffect(() => {
    if (!open) return;
    const dismiss = () => {
      pinned.current = false;
      setOpen(false);
    };
    const outside = (event: PointerEvent) => {
      if (
        trigger.current?.contains(event.target as Node) ||
        popup.current?.contains(event.target as Node)
      )
        return;
      dismiss();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    const scroll = (event: Event) => {
      if (!popup.current?.contains(event.target as Node)) dismiss();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', dismiss);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !trigger.current || !popup.current) return;
    const anchor = trigger.current.getBoundingClientRect();
    const panel = popup.current.getBoundingClientRect();
    const margin = 12;
    const below = anchor.bottom + 8;
    const above = anchor.top - panel.height - 8;
    setPosition({
      left: Math.max(
        margin,
        Math.min(anchor.right - panel.width, window.innerWidth - panel.width - margin)
      ),
      top: Math.max(
        margin,
        Math.min(
          below + panel.height <= window.innerHeight - margin ? below : above,
          window.innerHeight - panel.height - margin
        )
      ),
    });
  }, [open, i18n.language]);

  return (
    <div className={styles.summary}>
      <div className={styles.values}>
        <div className={styles.flow}>
          <span
            className={styles.input}
            title={`${t('usage_stats.token_input_total')}: ${exact(metrics.input)}`}
          >
            <span aria-hidden="true">↓</span>
            <span>{exact(metrics.input)}</span>
          </span>
          <span
            className={styles.output}
            title={`${t('usage_stats.token_output_total')}: ${exact(metrics.output)}`}
          >
            <span aria-hidden="true">↑</span>
            <span>{exact(metrics.output)}</span>
          </span>
        </div>
        <span
          className={styles.cache}
          title={`${t('usage_stats.cache_read_tokens')}: ${exact(metrics.cacheRead)}`}
        >
          <IconInbox size={15} />
          <span>{metrics.cacheRead === null ? '—' : formatTokens(metrics.cacheRead)}</span>
          {metrics.unclassified !== null && metrics.unclassified > 0 && (
            <span className={styles.unclassified} title={t('usage_stats.unclassified_tokens')}>
              {t('usage_stats.unclassified_tokens')} {formatTokens(metrics.unclassified)}
            </span>
          )}
        </span>
      </div>
      <button
        ref={trigger}
        type="button"
        className={styles.info}
        aria-label={t('usage_stats.token_details')}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') preview();
        }}
        onPointerLeave={leave}
        onFocus={preview}
        onBlur={() => {
          pinned.current = false;
          cancelLeave();
          setOpen(false);
        }}
        onClick={() => {
          cancelLeave();
          if (pinned.current) {
            pinned.current = false;
            setOpen(false);
          } else {
            pinned.current = true;
            setOpen(true);
          }
        }}
      >
        <IconInfo size={16} />
      </button>
      {open &&
        createPortal(
          <div
            ref={popup}
            id={tooltipId}
            role="tooltip"
            className={styles.popover}
            style={position}
            onPointerEnter={cancelLeave}
            onPointerLeave={leave}
          >
            <h3>{t('usage_stats.token_details')}</h3>
            <dl>
              <div>
                <dt>{t('usage_stats.token_input_total')}</dt>
                <dd>{exact(metrics.input)}</dd>
              </div>
              <div>
                <dt>{t('usage_stats.token_output_total')}</dt>
                <dd>{exact(metrics.output)}</dd>
              </div>
              <div>
                <dt>{t('usage_stats.cache_read_tokens')}</dt>
                <dd>{exact(metrics.cacheRead)}</dd>
              </div>
              <div>
                <dt>{t('usage_stats.cache_write_tokens')}</dt>
                <dd>
                  {cacheUnreported ? t('usage_stats.token_unreported') : exact(metrics.cacheWrite)}
                </dd>
              </div>
              <div>
                <dt>{t('usage_stats.reasoning_tokens')}</dt>
                <dd>{exact(metrics.reasoning)}</dd>
              </div>
              {metrics.unclassified !== null && metrics.unclassified > 0 && (
                <div>
                  <dt>{t('usage_stats.unclassified_tokens')}</dt>
                  <dd>{exact(metrics.unclassified)}</dd>
                </div>
              )}
              <div className={styles.total}>
                <dt>{t('usage_stats.total_tokens')}</dt>
                <dd>{exact(metrics.total)}</dd>
              </div>
            </dl>
            <p>
              {t(
                metrics.quality === 'unavailable'
                  ? 'usage_stats.token_legacy_note'
                  : 'usage_stats.token_inclusive_note'
              )}
            </p>
            {metrics.quality !== 'complete' && metrics.quality !== 'unavailable' && (
              <p>{t(`usage_stats.quality_${metrics.quality}`)}</p>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
