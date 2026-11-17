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
      'api-key-entries': [
        { id: 'key-1', 'api-key': 'first', note: 'Production', custom: 'one' },
        { id: 'key-2', 'api-key': 'second', note: 'Testing', custom: 'two' },
      ],
    },
  ];
  apiClient.get = (async () => ({ 'openai-compatibility': records })) as typeof apiClient.get;
  apiClient.put = (async (_url: string, data: unknown) => {
    records = data;
  }) as typeof apiClient.put;
  const [before] = await providersApi.getOpenAIProviders();
  // A concurrent reorder of providers must not redirect an edit by its stale index/name.
  records = [
    { id: 'unrelated', name: 'another', 'base-url': 'https://other.test' },
    ...(records as object[]),
  ];
  await providersApi.updateOpenAIProvider('before', 0, {
    ...before,
    name: 'after',
    apiKeyEntries: [...before.apiKeyEntries].reverse(),
  });
  const after = (await providersApi.getOpenAIProviders())[1];
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
  const final = (records as Array<Record<string, unknown>>)[1]['api-key-entries'];
  expect(final).toEqual([{ id: 'key-1', 'api-key': 'rotated', custom: 'one' }]);
  expect((records as Array<Record<string, unknown>>)[0].name).toBe('another');
});

test('a new key never inherits the removed key identity or unknown fields by position', async () => {
  let records: unknown = [
    {
      id: 'provider',
      name: 'p',
      'base-url': 'https://example.test',
      'api-key-entries': [{ id: 'old', 'api-key': 'old-key', note: 'old note', custom: 'private' }],
    },
  ];
  apiClient.get = (async () => ({ 'openai-compatibility': records })) as typeof apiClient.get;
  apiClient.put = (async (_url: string, data: unknown) => {
    records = data;
  }) as typeof apiClient.put;
  await providersApi.updateOpenAIProvider('p', 0, {
    id: 'provider',
    name: 'p',
    baseUrl: 'https://example.test',
    apiKeyEntries: [{ apiKey: 'new-key', note: 'new note' }],
  });
  expect((records as Array<Record<string, unknown>>)[0]['api-key-entries']).toEqual([
    { 'api-key': 'new-key', note: 'new note' },
  ]);
});

test('disable and delete target persisted ID while older servers retain index compatibility', async () => {
  const calls: unknown[] = [];
  apiClient.patch = (async (url: string, data: unknown) => {
    calls.push([url, data]);
  }) as typeof apiClient.patch;
  apiClient.delete = (async (url: string) => {
    calls.push(url);
  }) as typeof apiClient.delete;
  await providersApi.updateOpenAIProviderDisabled(4, true, 'provider-id');
  await providersApi.deleteOpenAIProvider(4, 'provider-id');
  await providersApi.deleteOpenAIProvider(4);
  expect(calls).toEqual([
    ['/openai-compatibility', { id: 'provider-id', value: { disabled: true } }],
    '/openai-compatibility?id=provider-id',
    '/openai-compatibility?index=4',
  ]);
});
