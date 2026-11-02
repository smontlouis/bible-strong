# ADR-0095: Read an Outdated Offline Copy Rather Than Refuse It

- Status: Accepted
- Date: 2026-11-02

## Context

A Strong lexicon Offline copy counted as usable only when its Resource revision equalled the one
the catalog names. A sound copy of another revision was marked `incompatible`. Online, the reader
never noticed: the Resource API answered instead. Offline, the lexicon refused to open with
« Vous êtes hors ligne », although the Downloads screen listed the copy as installed (#474).

Three situations lead there: a copy older than the current publication, a copy older than the
additive `LexiconNameMeanings` table, whose absence the validator treated as corruption although
the reader handles it, and, after a future publication, a copy newer than the catalog compiled in
the application, which is the one in force when the application starts without a network.

## Decision

Installing and reading follow different rules. Activating an artifact still requires the exact
catalog revision (ADR-0034). A copy already on the device is only refused when it cannot be read:

- a sound copy of the right Resource identity with the required shape, but another revision, is
  `outdated`. It is readable and it counts as an available update;
- tables the reader handles the absence of are optional: they are checked only when present;
- `resources` and `entities` rows point at core rows, so these modules read only alongside the
  core revision they were built on, whatever the catalog says;
- online, the reader gets the current edition from the Resource API, and falls back on the
  outdated copy when the network fails. Offline, the outdated copy answers.

The status belongs to the Strong lexicon: the other Offline copies do not compare revisions when
they are read.

## Consequences

Offline, a reader may see an older edition instead of an error. The update stays offered in the
Downloads screen. An older copy may lack a field added since: anything a reader needs of it must
stay optional, or the copy goes back to being refused for its shape. Without a live catalog the
update badge may show for a copy newer than the compiled catalog, until the next connection.
