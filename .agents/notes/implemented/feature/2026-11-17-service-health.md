# Agent Note: Separate service health from overall request totals

Status: implemented

## Problem

Overall request success counts mix caller errors and cancellations with provider availability. Existing backend versions do not expose service health.

## Decision

Render optional backend service-health counters and nullable rates. Preserve legacy totals, billing and old-backend presentation. Use the backend rate in trends and dimensions without client-side reconstruction; missing samples break the curve.

## Alternatives considered

Replacing overall success rate would redefine existing reports. Reconstructing outcomes from diagnostic attempts risks counting retries and snapshots before completion. A new analytics store would duplicate backend authority.

## Validation

Passed rendering regressions for service versus overall rate, no service samples, legacy backend fallback and incomplete diagnostics. All four locales updated. Bun verification (tests, lint, TypeScript, production build) passed. The real local #/usage route was checked with synthetic Management API responses at 1440 × 1100 and 390 × 844; desktop and mobile screenshots are in output/playwright/nov17-service-health*.png. Browser console had no errors.

## Consequences

Retained usage records do not establish complete upstream attempt history. Show this scope in the UI. Existing usage decisions remain applicable; none is superseded.
