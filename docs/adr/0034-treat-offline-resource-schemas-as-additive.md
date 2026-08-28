# ADR-0034: Treat Offline Resource Schemas as Additive Reader Contracts

- Status: Accepted
- Date: 2026-08-28

## Context

The mobile application downloads the current Offline-copy artifact selected by the Resource
catalog. Strong Bible and interlinear readers already accept newer schema metadata when every table
and column they use is present. The Strong lexicon reader instead required an exact schema version
and rejected every additional application table or column. Canonical Bible JSON also required an
exact schema number.

Publishing the additive `LexiconNameMeanings` table therefore produced a healthy current artifact
that the mobile installer rejected as `STRONG_LEXICON_SCHEMA_MISMATCH`. Exact version equality also
made older application builds unable to install a newer additive artifact selected by the catalog.

## Decision

Offline resource schemas evolve additively. Readers validate the subset they require:

- required tables and columns must exist with compatible types and nullability;
- additional tables, columns, metadata rows, and higher schema-version metadata are accepted;
- JSON resources validate their known structure and Resource identity without requiring exact
  schema-version equality.

Schema versions remain useful publication metadata and diagnostics, but they are not an activation
gate for a current catalog artifact. Archive and content hashes, bounded extraction, SQLite
integrity, foreign keys, Resource identity, Resource revision, declared dependencies, and atomic
installation remain mandatory.

A publication must not remove or rename an existing field, table, or column, change the meaning or
storage type of an existing value, or make a previously optional value mandatory. Such a change is
not additive and requires a new Resource identity or a separately designed migration contract.

## Consequences

Application builds implementing this contract can install newer artifacts that only add data they
do not use. Builds with the previous exact-match validator must first receive this code through an
OTA or binary update. Newer builds can require and consume the added subset. Publication and mobile
tests must cover a simulated future artifact containing extra tables, columns, and a higher schema
version.

The additive-only rule becomes a publication invariant. Removing exact schema equality does not
mean loading unchecked files: integrity, identity, dependency, and required-shape validation still
fail closed, and a failed replacement leaves the previous Offline copy intact.
