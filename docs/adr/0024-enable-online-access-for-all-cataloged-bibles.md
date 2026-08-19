# ADR-0024: Enable Online access for all cataloged Bibles

## Status

Accepted

## Context

The ordinary-Bible publication catalog previously enabled Online access only for an explicit
subset. Other versions remained limited to Offline-copy delivery and local development even though
they were already part of the supported application catalog.

The production Resource service is intended to make every supported Bible version readable through
the same Resource domain API. Keeping part of the catalog staged would make Online availability
depend on an earlier conservative rollout flag rather than the current product decision.

## Decision

Every Bible version currently listed in `config/ordinary-bible-publications.json` is approved for
Online access. Each entry records `publicOnline: true`; generated publication bundles therefore
declare both `rights.online: true` and `deliveryCapabilities.onlineAccess: true`.

Strong Bible indexes inherit Online availability from their canonical Bible dependency and are
republished after the corresponding ordinary-Bible bundles.

Rights-holder, attribution, and terms-reference metadata remain mandatory and must be preserved in
published manifests and responses where required. This operational approval records the project's
distribution decision; it does not replace independent legal review or provider-specific
attribution and geographic obligations.

## Consequences

All cataloged Bible versions can be activated during a production catalog import without the
local-development override. Online readers and searches may address any supported version through
the Resource domain API, while Offline-copy delivery remains independently available.

Adding a Bible now requires an explicit Online-access decision in the publication configuration.
Any future restriction must set the affected publication back to non-Online delivery and produce a
new publication revision before deployment.
