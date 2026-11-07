import { describe, expect, test } from 'bun:test';
import {
  XAI_GROK_CLIENT_VERSION,
  XAI_GROK_USER_AGENT,
  XAI_REQUEST_HEADERS,
} from '@/utils/quota/constants';

describe('Grok quota client headers', () => {
  test('uses the current CLI identity for quota requests', () => {
    expect(XAI_GROK_CLIENT_VERSION).toBe('1.0.70');
    expect(XAI_REQUEST_HEADERS['x-grok-client-version']).toBe(XAI_GROK_CLIENT_VERSION);
    expect(XAI_GROK_USER_AGENT).toBe(
      `grok-pager/${XAI_GROK_CLIENT_VERSION} grok-shell/${XAI_GROK_CLIENT_VERSION} (macos; aarch64)`
    );
  });
});
