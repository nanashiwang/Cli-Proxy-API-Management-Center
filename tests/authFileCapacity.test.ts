import { describe, expect, test } from 'bun:test';
import { normalizeAuthFilesResponse } from '../src/services/api/authFiles';
import {
  executionCapacityFull,
  normalizeExecutionCapacity,
} from '../src/features/authFiles/executionCapacity';

const observation = {
  active: 2,
  limit: null,
  unlimited: true,
  scope: 'local',
  observed_at: '2026-09-28T03:00:00Z',
};
describe('execution capacity API contract', () => {
  test('keeps legacy/malformed observations unknown instead of deriving from a lease', () => {
    for (const value of [
      undefined,
      {},
      { ...observation, active: -1 },
      { ...observation, active: 1.5 },
      { ...observation, limit: 0 },
      { ...observation, scope: 'upstream' },
      { ...observation, observed_at: 'invalid' },
      { ...observation, active: Number.MAX_SAFE_INTEGER + 1 },
    ]) {
      expect(normalizeExecutionCapacity(value)).toBeUndefined();
    }
    expect(
      normalizeAuthFilesResponse({ files: [{ name: 'old.json', active: 9, disabled: false }] })
        .files[0].executionCapacity
    ).toBeUndefined();
  });
  test('distinguishes unlimited, unknown cap and actual fullness', () => {
    expect(executionCapacityFull(normalizeExecutionCapacity(observation))).toBe(false);
    expect(
      executionCapacityFull(normalizeExecutionCapacity({ ...observation, unlimited: false }))
    ).toBe(false);
    expect(
      executionCapacityFull(
        normalizeExecutionCapacity({ ...observation, unlimited: false, limit: 2 })
      )
    ).toBe(true);
    expect(
      executionCapacityFull(
        normalizeExecutionCapacity({ ...observation, unlimited: false, limit: 3 })
      )
    ).toBe(false);
  });
  test('preserves server idle observations while leaving lease and availability separate', () => {
    const result = normalizeAuthFilesResponse({
      files: [
        {
          name: 'idle.json',
          unavailable: true,
          disabled: true,
          execution_capacity: { ...observation, active: 0 },
        },
      ],
    }).files[0];
    expect(result.executionCapacity?.active).toBe(0);
    expect(result.executionCapacity?.unlimited).toBe(true);
    expect(result.unavailable).toBe(true);
    expect(result.disabled).toBe(true);
  });
});
