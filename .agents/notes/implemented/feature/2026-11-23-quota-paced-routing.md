# Agent Note: Show quota-adjusted weights on the routing board

Status: implemented

## Problem

A manual weight alone cannot explain a credential's estimated share under quota pacing. The board edits a draft while quota observations can expire independently.

## Decision

The board reads the maintained v8 routing configuration and credential summary. A backend-supplied boolean advertises support even when pacing is disabled. The operator selects all eligible credentials or one configured account group. The save dialog reviews both settings and patches changed keys. A limited-lifetime factor scales the draft weight for the share preview. A change in scope suppresses the share estimate until saved observations are available.

## Alternatives considered

- Recalculating factors in the browser would duplicate backend thresholds, snapshot validation and expiry.
- Showing configured weights as traffic shares would hide a potentially material difference from the weighted dispatch inputs.

## Consequences

The board shows a snapshot. After its expiry it uses the manual weight until refreshed. The underlying [quota guard](2026-11-11-codex-quota-guard.md) owns admission and the effective share can differ with sticky traffic, transport and retries.

## Verification

Routing board tests exercise legacy reads, diagnosis expiry, scope, draft preview and PATCH. A local browser selected the Pilot group, confirmed both changes and read the saved scope back from the paired backend.
