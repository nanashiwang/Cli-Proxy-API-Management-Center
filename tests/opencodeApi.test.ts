import { describe, expect, test } from 'bun:test';
import { normalizeOpenCodeConfig, serializeOpenCodeConfig } from '@/services/api/opencode';

describe('OpenCode management config', () => {
  test('normalizes the management API envelope and hyphenated fields', () => {
    const config = normalizeOpenCodeConfig({
      opencode: {
        enabled: true,
        prefer: 'zen',
        'refresh-seconds': 600,
        zen: {
          'base-url': 'https://opencode.ai/zen',
          'api-key-entries': [{ 'api-key': 'zen-key', priority: 3, weight: 2 }],
        },
        go: { 'base-url': 'https://opencode.ai/zen/go', 'api-key-entries': [] },
      },
    });

    expect(config.enabled).toBe(true);
    expect(config.prefer).toBe('zen');
    expect(config.refreshSeconds).toBe(600);
    expect(config.zen.apiKeyEntries[0]).toEqual({
      apiKey: 'zen-key',
      priority: 3,
      weight: 2,
    });
  });

  test('normalizes masked credentials without retaining the secret', () => {
    const config = normalizeOpenCodeConfig({
      opencode: {
        enabled: true,
        zen: {
          'base-url': 'https://opencode.ai/zen',
          'api-key-entries': [
            {
              'api-key': '',
              'api-key-configured': true,
              'api-key-preview': 'zens...key',
              'source-index': 2,
            },
          ],
        },
        go: { 'base-url': 'https://opencode.ai/zen/go' },
      },
    });

    expect(config.zen.apiKeyEntries[0]).toMatchObject({
      apiKey: '',
      apiKeyConfigured: true,
      apiKeyPreview: 'zens...key',
      sourceIndex: 2,
    });
  });

  test('serializes masked credentials as retention markers', () => {
    const serialized = serializeOpenCodeConfig({
      enabled: true,
      prefer: 'zen',
      anonymous: false,
      refreshSeconds: 300,
      zen: {
        baseUrl: 'https://opencode.ai/zen',
        apiKeyEntries: [
          { apiKey: '', apiKeyConfigured: true, sourceIndex: 1, apiKeyPreview: 'hidden' },
        ],
      },
      go: { baseUrl: 'https://opencode.ai/zen/go', apiKeyEntries: [] },
    });

    expect(serialized.zen['api-key-entries']).toEqual([
      {
        'api-key': '',
        'api-key-configured': true,
        'api-key-preview': 'hidden',
        'source-index': 1,
      },
    ]);
  });

  test('serializes a complete config without dropping tier keys', () => {
    const serialized = serializeOpenCodeConfig({
      enabled: true,
      prefer: 'go',
      anonymous: false,
      refreshSeconds: 300,
      zen: {
        baseUrl: 'https://opencode.ai/zen',
        apiKeyEntries: [{ apiKey: 'zen-key', proxyUrl: 'http://127.0.0.1:7890' }],
      },
      go: {
        baseUrl: 'https://opencode.ai/zen/go',
        apiKeyEntries: [{ apiKey: 'go-key', disableCooling: true }],
      },
    });

    expect(serialized.zen['api-key-entries']).toEqual([
      { 'api-key': 'zen-key', 'proxy-url': 'http://127.0.0.1:7890' },
    ]);
    expect(serialized.go['api-key-entries']).toEqual([
      { 'api-key': 'go-key', 'disable-cooling': true },
    ]);
  });
});
