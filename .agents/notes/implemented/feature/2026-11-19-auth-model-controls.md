# Agent Note: Per-file model controls in the supported-model dialog

Status: implemented

## Problem

The supported-model dialog only copies IDs; restricting a credential requires opening a separate details editor. The registry omits excluded models, so a naive toggle list loses entries after saving.

## Decision

Keep the existing registry endpoint and field-only PATCH. Add explicit excluded IDs to the dialog candidates, retain wildcard rules in an editable rule field, and distinguish provider-wide exclusions from file rules. Only actual file credentials are editable. Reuse shared exclusion matching/toggling. Keep copy as a separate button. Invalidate derived caches after saving, retain drafts on failure, and confirm discarding edits.

## Alternatives considered

- Link to the existing details editor: minimal duplication, but does not allow direct editing where users inspect models.
- Populate every provider catalog model: restores hidden candidates, but incorrectly implies every account supports every catalog model. Use registry plus explicit rules instead; wildcard removal restores matching registry entries after reload.
- Upload the full JSON: existing download makes this easy, but risks overwriting refreshed tokens. PATCH only the exclusion field.

## Consequences

The dialog now offers direct per-file control and restores exact exclusions without pretending that the full provider catalog is available to every account. Wildcard-hidden IDs cannot be enumerated by the existing registry endpoint; editing rules and reopening refreshes the list. The API has no per-field revision token, so concurrent edits to the same exclusion field remain last-writer-wins.

## Verification

Candidate tests cover filtered/empty registries, draft restoration, casing, wildcard omission and legacy field precedence. Browser checks with local mock credentials cover exclusion/save/reopen/restore, failed-save draft retention, field-only PATCH, global/wildcard locks, search, copying, discard confirmation and 390px layout. No production credentials or configuration were changed. Async generation guards invalidate closed/replaced loads; runtime entries remain read-only. All 622 tests, lint (one pre-existing unrelated warning), TypeScript, production build and note gates pass.

## Related-note audit

Search of active notes for excluded/models modal finds no owning decision; provider-test-model concerns connectivity requests and is unrelated. Process/release notes remain unchanged.

V8 integration retains the field-only credential PATCH and shared OAuth restrictions. Loads and saves belong to their initiating connection revision; switching files or connections releases local busy state while stale completions cannot alter the new editor. The paired v8 browser mock verifies exclusion, save, reopen, exact-rule restoration and the 390px layout.
