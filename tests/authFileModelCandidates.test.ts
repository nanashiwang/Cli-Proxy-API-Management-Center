import { expect, test } from 'bun:test';
import { buildAuthFileModelCandidates } from '../src/features/authFiles/modelCandidates';
import {
  getExcludedModelsField,
  readExcludedModels,
} from '../src/features/authFiles/hooks/useAuthFilesPrefixProxyEditor';

test('excluded model survives registry filtering and draft restoration', () => {
  expect(
    buildAuthFileModelCandidates([{ id: 'allowed' }], ['hidden'], []).map((m) => m.id)
  ).toEqual(['allowed', 'hidden']);
});

test('candidates retain metadata, deduplicate casing and never invent wildcard support', () => {
  const registered = { id: 'Claude-Sonnet', display_name: 'Sonnet' };
  expect(
    buildAuthFileModelCandidates([registered], ['claude-sonnet', 'opus-*'], ['new-id'])
  ).toEqual([registered, { id: 'new-id' }]);
});

test('empty registry still permits restoring exact exclusions', () => {
  expect(buildAuthFileModelCandidates([], ['hidden', '*'], [])).toEqual([{ id: 'hidden' }]);
});

test('model editor preserves the legacy field and canonical precedence', () => {
  const legacy = { 'excluded-models': ['OLD', 'old', ' wild-* '] };
  expect(getExcludedModelsField(legacy)).toBe('excluded-models');
  expect(readExcludedModels(legacy)).toEqual(['OLD', 'wild-*']);
  expect(getExcludedModelsField({ ...legacy, excluded_models: [] })).toBe('excluded_models');
  expect(readExcludedModels({ ...legacy, excluded_models: [] })).toEqual([]);
});
