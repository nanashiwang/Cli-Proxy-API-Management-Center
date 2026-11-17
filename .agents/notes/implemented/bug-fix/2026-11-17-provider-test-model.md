# Agent Note: Persist and search provider test models

Status: implemented

## Problem

The OpenAI-compatible editor sends test-model, but the backend drops it from its typed configuration and management response. Reopening the editor selects the first model. Large model lists are difficult to navigate.

## Decision

The backend persists optional provider-level test-model in JSON/YAML and expose it through the existing management GET, PUT and PATCH paths. Empty means automatic selection; omitted PATCH preserves the selection. This is management test metadata, not a routing default. The frontend extends the existing Select with opt-in search for test selectors, preserving selected labels independently of search results.

## Alternatives considered

Browser-only persistence avoids a backend change but loses the preference across browsers and disagrees with the existing API payload. A separate model picker duplicates portal positioning and keyboard behavior; reuse Select instead.

## Verification

A management regression test saves a non-first model, reloads configuration and reads it back. PATCH unrelated fields preserves it; empty clears it. Browser checks confirm search supports case-insensitive label/value matches, no matches, keyboard selection and reopening without stale queries. Existing non-searchable selects retain their behavior.

## Consequences

Older backends still discard this field; deploy matching backend and frontend releases. Other provider families retain their existing persistence semantics.

## Related note review

Active-note searches for test-model, testModel and provider selection found no existing owner for this contract. Quota and auth notes are unrelated.

Backend `go test ./...` and server build pass. Frontend `bun run verify` passes (one pre-existing AccountPoolsPage lint warning). Browser checks exercise the provider editor with an isolated local backend and no live credentials.

## Connectivity probe compatibility

OpenAI-compatible connectivity probes prefer `max_completion_tokens`, including for reasoning models such as the selected gpt-6-luna. A single legacy `max_tokens` retry is allowed only after HTTP 400 explicitly rejects the modern parameter. Both attempts retain the model, auth index, headers and five-token cap. Successful, authentication, quota, network and unrelated validation responses never trigger fallback. This probes endpoint connectivity, not answer quality; reasoning can consume the small output budget.

Keeping the legacy field by default causes modern models to fail even with valid credentials. Model-name heuristics miss aliases and future models; explicit parameter rejection supports legacy endpoints without such a catalogue. No backend routing or config contract changes are needed.

Probe verification: 615 frontend tests and production build pass. A server-side request using the configured gpt-6-luna key and the same five-token modern payload returns HTTP 200 in 1.08 seconds; all five completion tokens are reasoning tokens, confirming that connectivity success does not imply visible answer text.
