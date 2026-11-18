import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { apiClient } from '../src/services/api/client';
import { providersApi } from '../src/services/api/providers';
import { normalizeProviderGroups } from '../src/services/api/transformers';
import type { ProviderKeyConfig } from '../src/types';

const originalGet = apiClient.get;
const originalPut = apiClient.put;
afterEach(() => {
  apiClient.get = originalGet;
  apiClient.put = originalPut;
});

function backend(groups: Record<string, unknown>[] = [], family = 'openai-compatibility') {
  let state = structuredClone(groups);
  apiClient.get = (async () => ({
    'api-keys': { [family]: structuredClone(state) },
  })) as typeof apiClient.get;
  apiClient.put = (async (url: string, data: unknown) => {
    expect(url).toBe(`/config/api-keys/${family}`);
    state = structuredClone(data as Record<string, unknown>[]);
  }) as typeof apiClient.put;
  return () => state;
}

const fixture = () => ({
  name: 'fixture',
  'base-url': 'https://example.invalid',
  keys: [{ 'api-key': 'fixture-key' }],
  models: [{ name: 'first' }, { name: 'second' }],
});

describe('OpenAI test selection persists independently of shared model fields', () => {
  for (const testModel of ['', 'first', 'second']) {
    test(`create persists provider model selection ${JSON.stringify(testModel)}`, async () => {
      const state = backend();
      const config = {
        name: 'fixture',
        baseUrl: 'https://example.invalid',
        apiKeyEntries: [{ apiKey: 'fixture-key' }],
        models: [{ name: 'first', testModel: 'obsolete' }, { name: 'second' }],
        testModel,
      };
      await providersApi.createOpenAIProvider(config);
      expect(state()).toEqual([
        { ...fixture(), ...(testModel ? { 'test-model': testModel } : {}) },
      ]);
    });

    test(`edit persists provider model selection ${JSON.stringify(testModel)}`, async () => {
      const state = backend([fixture()]);
      const current = (await providersApi.getOpenAIProviders())[0];
      const config = { ...current, testModel, priority: 2 };
      await providersApi.updateOpenAIProvider(current.name, 0, config);
      expect(state()).toEqual([
        { ...fixture(), priority: 2, ...(testModel ? { 'test-model': testModel } : {}) },
      ]);
    });
  }

  test('clearing a persisted selection returns to automatic without changing model order', async () => {
    const state = backend([{ ...fixture(), 'test-model': 'second' }]);
    const [current] = await providersApi.getOpenAIProviders();
    await providersApi.updateOpenAIProvider(current.name, 0, { ...current, testModel: '' });
    const [saved] = await providersApi.getOpenAIProviders();
    expect(saved.testModel).toBeUndefined();
    expect(state()[0]).not.toHaveProperty('test-model');
    expect(saved.models?.map((model) => model.name)).toEqual(['first', 'second']);
  });

  test('preserves the provider preference and opaque metadata while cleaning misplaced model fields', async () => {
    const group = {
      ...fixture(),
      'test-model': 'second',
      headers: { 'test-model': 'keep-header' },
      future: { 'test-model': 'keep-metadata' },
      models: [{ name: 'first', 'test-model': 'obsolete', future: 'keep' }],
      keys: [{ 'api-key': 'fixture-key', future: 'keep' }],
    };
    const state = backend([group]);
    const current = (await providersApi.getOpenAIProviders())[0];
    expect(current.testModel).toBe('second');
    expect(current.models?.[0]).not.toHaveProperty('testModel');
    await providersApi.updateOpenAIProvider(current.name, 0, { ...current, priority: 3 });
    expect(state()).toEqual([
      {
        ...fixture(),
        priority: 3,
        'test-model': 'second',
        headers: group.headers,
        future: group.future,
        models: [{ name: 'first', future: 'keep' }],
        keys: group.keys,
      },
    ]);
    expect(current.source?.group).toEqual(group);
  });

  test('cleans shared model fields on other providers while retaining inherited metadata', async () => {
    const group = {
      name: 'codex-fixture',
      models: [{ name: 'inherited', 'test-model': 'obsolete', future: 'keep' }],
      keys: [
        {
          'api-key': 'fixture-key',
          models: [{ name: 'first', 'test-model': 'obsolete', future: 'keep' }],
          headers: { 'test-model': 'keep-header' },
        },
      ],
    };
    const state = backend([group], 'codex');
    const current = normalizeProviderGroups([group])[0] as ProviderKeyConfig;
    await providersApi.updateCodexConfig(current.apiKey, current.baseUrl, {
      ...current,
      priority: 2,
    });
    expect(state()).toEqual([
      {
        ...group,
        models: [{ name: 'inherited', future: 'keep' }],
        keys: [
          {
            ...group.keys[0],
            priority: 2,
            models: [{ name: 'first', future: 'keep' }],
          },
        ],
      },
    ]);
  });

  test('form restores persisted OpenAI selection and exposes a preference hint', () => {
    const source = readFileSync(
      new URL('../src/features/providers/sheets/forms/BaseProviderForm.tsx', import.meta.url),
      'utf8'
    );
    expect(source).toContain('testModel: form.testModel');
    expect(source).toContain("onChange={(value) => updateField('testModel', value)}");
    expect(source).toContain('cfg.testModel');
    expect(source).toContain("'providersPage.form.testModelHintOpenAI'");
    expect(source).not.toContain('testModelClaudeHint');
    for (const locale of ['en', 'zh-CN', 'zh-TW', 'ru', 'vi']) {
      const messages = JSON.parse(
        readFileSync(new URL(`../src/i18n/locales/${locale}.json`, import.meta.url), 'utf8')
      );
      expect(messages.providersPage.form.testModelHint).toBeString();
    }
  });
});
