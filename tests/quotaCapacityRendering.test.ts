import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18n from '../src/i18n/index';
import { QuotaCapacityPanel } from '../src/features/quota/components/QuotaCapacitySummary';
import type { CapacityGroupEstimate, CapacityStatus } from '../src/features/quota/capacityEstimate';
import en from '../src/i18n/locales/en.json';
import zh from '../src/i18n/locales/zh-CN.json';
import tw from '../src/i18n/locales/zh-TW.json';
import ru from '../src/i18n/locales/ru.json';

const group = (status: CapacityStatus): CapacityGroupEstimate => ({
  plan: 'plus',
  accounts: 14,
  limitedAccounts: 0,
  status,
  additionalAccounts: status === 'ready' ? 7 : null,
  bridgeAccounts: status === 'ready' ? 1 : null,
  windows: [
    {
      id: 'weekly',
      periodHours: 168,
      status,
      sampledAccounts: 14,
      remaining: 60,
      rate: 12,
      runwayHours: 5,
      recoveryHours: 8,
      requiredAccounts: 21,
      additionalAccounts: 7,
      bridgeAccounts: 1,
    },
  ],
});

describe('quota capacity panel', () => {
  test('shows both independent counts and the lightweight scope in Chinese', async () => {
    await i18n.changeLanguage('zh-CN');
    const html = renderToStaticMarkup(
      createElement(QuotaCapacityPanel, { groups: [group('ready')] })
    );
    expect(html).toContain('新增 7 个');
    expect(html).toContain('新增 1 个');
    expect(html).toContain('浏览器本地计算');
    expect(html).toContain('不相加');
    expect(html).toContain('不增加服务器任务或额外请求');
    expect(html).not.toContain('quota_management.capacity');
  });

  test.each(['sampling', 'incomplete', 'limited', 'idle'] as const)(
    '%s hides actionable account counts',
    (status) => {
      const html = renderToStaticMarkup(
        createElement(QuotaCapacityPanel, { groups: [group(status)] })
      );
      expect(html).toContain('role="status"');
      expect(html).not.toContain('新增 0 个');
      expect(html).not.toContain('>21<');
    }
  );

  test('all supported languages include every capacity string', () => {
    const keys = Object.keys(en.quota_management.capacity).sort();
    for (const locale of [zh, tw, ru]) {
      expect(Object.keys(locale.quota_management.capacity).sort()).toEqual(keys);
    }
  });
});
