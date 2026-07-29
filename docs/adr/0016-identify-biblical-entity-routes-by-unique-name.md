# ADR-0016: Identify Biblical Entity Routes by Unique Name

## Status

Accepted

## Context

Strong entity subpages must be directly openable and remain unambiguous across database
publications. SQLite row identifiers are publication-specific, while `uStrong` is not unique:
the current entity publication contains two distinct Abaddon records for `H0011`.

## Decision

Identify a Biblical entity route by its editorial `uniqueName`. Keep `uStrong` as secondary lexical
metadata rather than as the entity identity, and expose the target `uniqueName` on entity
relations. Route loaders may use a publication-specific row identifier internally after resolving
the `uniqueName`, but must not persist or expose that row identifier as the durable route key.

## Consequences

Entity links remain unambiguous even when several entities share one lexical identity. Publication
pipelines must preserve `uniqueName` values for existing entities once those values can appear in
shared or persisted links.
