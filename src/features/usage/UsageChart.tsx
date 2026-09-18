import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { chartLineSegments } from './analytics';
import styles from './UsagePage.module.scss';

export interface ChartSeries {
  label: string;
  color: string;
  values: Array<number | null>;
}
export function UsageChart({
  labels,
  series,
  format,
  stacked = false,
  hasActivity = true,
}: {
  labels: string[];
  series: ChartSeries[];
  format: (value: number) => string;
  stacked?: boolean;
  hasActivity?: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const width = 640,
    height = 202,
    left = 58,
    right = 14,
    top = 16,
    bottom = 27;
  const plotWidth = width - left - right,
    plotHeight = height - top - bottom;
  const values = stacked
    ? labels.map((_, i) => series.reduce((sum, item) => sum + (item.values[i] ?? 0), 0))
    : series.flatMap((item) => item.values.filter((v): v is number => v != null));
  const maximum = Math.max(0, ...values);
  const max = maximum || 1;
  const x = (i: number) => left + (plotWidth * (i + 0.5)) / Math.max(1, labels.length);
  const y = (v: number) => top + plotHeight - (v / max) * plotHeight;
  const hasData =
    hasActivity &&
    series.some((item) => item.values.some((value) => value != null && Number.isFinite(value)));
  const selected = active != null && active < labels.length ? active : null;
  return (
    <div className={styles.chart}>
      <div className={styles.chartLegend}>
        {series.map((item) => (
          <span key={item.label}>
            <i style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
      {!hasData ? (
        <div className={styles.chartEmpty}>{t('usage_stats.no_chart_data')}</div>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-labelledby={id}
            onMouseLeave={() => setActive(null)}
          >
            <title id={id}>{series.map((item) => item.label).join(' / ')}</title>
            {[0, 0.5, 1].map((fraction) => (
              <g key={fraction}>
                <line
                  x1={left}
                  x2={width - right}
                  y1={y(max * fraction)}
                  y2={y(max * fraction)}
                  className={styles.chartGrid}
                />
                <text x={left - 8} y={y(max * fraction) + 4} textAnchor="end">
                  {format(max * fraction)}
                </text>
              </g>
            ))}
            {stacked
              ? labels.map((_, i) => {
                  let cumulative = 0;
                  return (
                    <g key={i}>
                      {series.map((item) => {
                        const value = item.values[i] ?? 0;
                        cumulative += value;
                        return (
                          <rect
                            key={item.label}
                            x={x(i) - Math.min(18, (plotWidth / labels.length) * 0.68) / 2}
                            y={y(cumulative)}
                            width={Math.min(18, (plotWidth / labels.length) * 0.68)}
                            height={(value / max) * plotHeight}
                            rx={2}
                            fill={item.color}
                            opacity={0.82}
                          />
                        );
                      })}
                    </g>
                  );
                })
              : series.map((item) => (
                  <g key={item.label}>
                    {chartLineSegments(item.values, x, y).map((path, i) => (
                      <path
                        key={i}
                        d={path}
                        fill="none"
                        stroke={item.color}
                        strokeWidth={2.3}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    ))}
                    {item.values.map((value, i) =>
                      value == null ? null : (
                        <circle
                          key={i}
                          cx={x(i)}
                          cy={y(value)}
                          r={selected === i ? 4 : labels.length < 33 ? 2.3 : 0}
                          fill={item.color}
                        />
                      )
                    )}
                  </g>
                ))}
            {selected != null && (
              <line
                x1={x(selected)}
                x2={x(selected)}
                y1={top}
                y2={height - bottom}
                className={styles.chartCrosshair}
              />
            )}
            {labels.map((label, i) => (
              <g key={i}>
                {(i === 0 ||
                  i === labels.length - 1 ||
                  i % Math.max(1, Math.ceil(labels.length / 5)) === 0) && (
                  <text x={x(i)} y={height - 5} textAnchor="middle">
                    {label}
                  </text>
                )}
                <rect
                  x={left + (plotWidth * i) / labels.length}
                  y={top}
                  width={plotWidth / labels.length}
                  height={plotHeight}
                  fill="transparent"
                  data-bucket={i}
                  tabIndex={i === (selected ?? 0) ? 0 : -1}
                  role="button"
                  onKeyDown={(event) => {
                    const next =
                      event.key === 'ArrowRight'
                        ? Math.min(labels.length - 1, i + 1)
                        : event.key === 'ArrowLeft'
                          ? Math.max(0, i - 1)
                          : event.key === 'Home'
                            ? 0
                            : event.key === 'End'
                              ? labels.length - 1
                              : null;
                    if (next == null) return;
                    event.preventDefault();
                    setActive(next);
                    event.currentTarget.ownerSVGElement
                      ?.querySelector<SVGRectElement>(`rect[data-bucket="${next}"]`)
                      ?.focus();
                  }}
                  aria-label={`${label}: ${series.map((item) => `${item.label} ${item.values[i] == null ? '—' : format(item.values[i]!)}`).join(', ')}`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                />
              </g>
            ))}
          </svg>
          <div className={styles.chartReadout} aria-live="polite">
            {selected != null ? (
              <>
                <strong>{labels[selected]}</strong>
                {series.map((item) => (
                  <span key={item.label}>
                    <i style={{ background: item.color }} />
                    {item.label}{' '}
                    <b>{item.values[selected] == null ? '—' : format(item.values[selected]!)}</b>
                  </span>
                ))}
              </>
            ) : (
              <span>{t('usage_stats.chart_hint')}</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
