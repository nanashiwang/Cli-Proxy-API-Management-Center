import { afterEach, expect, test } from 'bun:test';
import { apiClient } from '../src/services/api/client';
import { providersApi } from '../src/services/api/providers';
import { openaiToResource } from '../src/features/providers/adapters';

const originalGet = apiClient.get;
const originalPut = apiClient.put;
const originalPatch = apiClient.patch;
const originalDelete = apiClient.delete;
afterEach(() => {
  apiClient.get = originalGet;
  apiClient.put = originalPut;
  apiClient.patch = originalPatch;
  apiClient.delete = originalDelete;
});

test('rename, reordered keys, notes and removing a key preserve IDs and per-key metadata', async () => {
  let records: unknown = [
    {
      id: 'provider-1',
      name: 'before',
      'base-url': 'https://example.test',
      keys: [
        { id: 'key-1', 'api-key': 'first', note: 'Production', custom: 'one' },
        { id: 'key-2', 'api-key': 'second', note: 'Testing', custom: 'two' },
      ],
    },
  ];
  apiClient.get = (async () => ({
    'api-keys': { 'openai-compatibility': records },
  })) as typeof apiClient.get;
  apiClient.put = (async (_url: string, data: unknown) => {
    records = data;
  }) as typeof apiClient.put;
  const [before] = await providersApi.getOpenAIProviders();
  // A concurrent reorder of providers must not redirect an edit by its stale index/name.
  records = [
    { id: 'unrelated', name: 'another', 'base-url': 'https://other.test', keys: [] },
    ...(records as object[]),
  ];
  await providersApi.updateOpenAIProvider('before', 0, {
    ...before,
    name: 'after',
    apiKeyEntries: [...before.apiKeyEntries].reverse(),
  });
  const after = (await providersApi.getOpenAIProviders()).find(
    (provider) => provider.id === before.id
  )!;
  expect(after.id).toBe(before.id);
  expect(openaiToResource(after, 1).id).toBe(openaiToResource(before, 0).id);
  expect(after.apiKeyEntries.map((k) => [k.id, k.note])).toEqual([
    ['key-2', 'Testing'],
    ['key-1', 'Production'],
  ]);
  await providersApi.updateOpenAIProvider('after', 1, {
    ...after,
    apiKeyEntries: [{ ...after.apiKeyEntries[1], apiKey: 'rotated', note: '' }],
  });
  const final = (records as Array<Record<string, unknown>>)[1]['keys'];
  expect(final).toEqual([{ id: 'key-1', 'api-key': 'rotated', custom: 'one' }]);
  expect((records as Array<Record<string, unknown>>)[0].name).toBe('another');
});

test('a new key never inherits the removed key identity or unknown fields by position', async () => {
  let records: unknown = [
    {
      id: 'provider',
      name: 'p',
      'base-url': 'https://example.test',
      keys: [{ id: 'old', 'api-key': 'old-key', note: 'old note', custom: 'private' }],
    },
  ];
  apiClient.get = (async () => ({
    'api-keys': { 'openai-compatibility': records },
  })) as typeof apiClient.get;
  apiClient.put = (async (_url: string, data: unknown) => {
    records = data;
  }) as typeof apiClient.put;
  const [before] = await providersApi.getOpenAIProviders();
  await providersApi.updateOpenAIProvider('p', 0, {
    ...before,
    id: 'provider',
    name: 'p',
    baseUrl: 'https://example.test',
    apiKeyEntries: [{ apiKey: 'new-key', note: 'new note' }],
  });
  expect((records as Array<Record<string, unknown>>)[0]['keys']).toEqual([
    { 'api-key': 'new-key', note: 'new note' },
  ]);
});

test('disable and delete retain persisted identities across concurrent provider reordering', async () => {
  let records: Array<Record<string, unknown>> = [
    { id: 'provider-id', name: 'p', 'base-url': 'https://example.test', keys: [] },
  ];
  apiClient.get = (async () => ({
    'api-keys': { 'openai-compatibility': records },
  })) as typeof apiClient.get;
  apiClient.put = (async (url: string, data: unknown) => {
    expect(url).toBe('/config/api-keys/openai-compatibility');
    records = data as Array<Record<string, unknown>>;
  }) as typeof apiClient.put;
  const [before] = await providersApi.getOpenAIProviders();
  records = [{ id: 'other', name: 'other', keys: [] }, ...records];
  await providersApi.updateOpenAIProviderDisabled(0, true, before.source);
  expect(records[1]).toMatchObject({ id: 'provider-id', disabled: true });
  const after = (await providersApi.getOpenAIProviders()).find(
    (provider) => provider.id === before.id
  )!;
  await providersApi.deleteOpenAIProvider(0, after.source);
  expect(records).toEqual([{ id: 'other', name: 'other', keys: [] }]);
  await expect(providersApi.deleteOpenAIProvider(0)).rejects.toThrow('ambiguous');
});
