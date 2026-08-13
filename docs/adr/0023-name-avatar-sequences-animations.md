# ADR-0023: Name Avatar Studio sequences Animations

## Status

Accepted

## Context

ADR-0022 introduced the technical `State` model for a persisted sequence of Expressions. In the
Studio interface, “State” did not clearly communicate that the object is a complete, playable
animation. “Sequence” was also used for the same object in editor copy, creating three competing
names.

## Decision

The product term is **Animation**. An Animation contains ordered Expression steps, transitions,
playback behavior and blink settings. **Playback** remains the running execution of an Animation.

Existing internal identifiers such as `AvatarSequence`, `stateId` and legacy storage keys may remain
until a dedicated migration is justified. They must not leak into user-facing copy or exported APIs.

## Consequences

Avatar Studio uses one consistent user-facing term in its tabs, editor, player and export flow.
Existing persisted documents remain compatible because this decision changes terminology, not the
versioned document shape.
