# ADR-0022: Model Avatar Studio as a versioned document

## Status

Accepted

## Context

Avatar Studio previously persisted Avatars, Expressions, States, and Playback separately. State
steps referenced Expressions by their current array position, so inserting or deleting an
Expression required coordinated remapping and could leave partially persisted data.

## Decision

Avatar Studio persists one versioned Studio document. Every Expression has a durable identity and
State steps reference that identity. Existing local data is migrated automatically by resolving
legacy expression indexes against the migrated Expression catalog. An Avatar owns its Neutral
appearance; global Expressions describe relative changes, and optional Expression colors remain
temporary overrides. Playback exclusively owns the animated Pose until a direct user manipulation
pauses it. Changing Avatar preserves the current Playback position.

## Consequences

Studio mutations and migrations can preserve cross-object invariants in one transaction. Reordering
Expressions no longer changes State meaning. Future document versions require an explicit migration,
while legacy local-storage keys remain readable only as migration inputs.
