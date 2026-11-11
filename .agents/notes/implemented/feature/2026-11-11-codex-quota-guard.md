# Agent Note: Codex quota guard controls

Status: implemented

## Problem

Operators need to configure proactive Codex session and weekly quota thresholds.

## Decision

Extend the existing quota section, YAML round trip, validation, search and all four locales with the backend codex-quota-guard contract. Defaults use consumed percentages 90 ± 5 and 93 ± 3. Preserve unrelated YAML keys and disable protection explicitly with enabled: false.

## Alternatives considered

YAML-only configuration needs less UI but hides this routine control. A separate quota API duplicates the existing configuration save and reload path.

## Verification

Validate limits and defaults, preserve unknown YAML, run full verification and inspect the quota section in a browser.

## Consequences

Protection requires the matching backend and applies only to standalone Codex OAuth routing.

## Related notes

The existing usage-timezone-and-account-facts note concerns display and accounting, not routing configuration; it remains independent.

Threshold samples remain stable across quota resets to tolerate drifting relative reset timestamps; changing percentages rescales the same uniform sample. No per-request randomness is introduced.

Verified Go full tests, server build, management smoke checks and focused race tests; frontend 588 tests, lint (one existing warning), type check and production build pass. An isolated real backend accepts visual changes and reloads the saved YAML; desktop and 390px mobile layouts were inspected. No production service is changed.
