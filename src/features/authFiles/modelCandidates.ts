import type { AuthFileModelItem } from './constants';

/** Include persisted exact exclusions so removing a draft rule never hides its row. */
export function buildAuthFileModelCandidates(
  models: readonly AuthFileModelItem[],
  original: readonly string[],
  draft: readonly string[]
): AuthFileModelItem[] {
  const byId = new Map(models.map((model) => [model.id.toLowerCase(), model]));
  [...original, ...draft].forEach((id) => {
    if (!id.includes('*') && !byId.has(id.toLowerCase())) byId.set(id.toLowerCase(), { id });
  });
  return [...byId.values()];
}
