# ADR-0064: Separate simple and detailed Strong lexicons

## Status

Accepted

## Context

Readers want the historical French and English Strong definitions as their first
reading level, while retaining STEP and the detailed Greek dictionary for deeper
study. Replacing the current core in place would misidentify installed copies and
break the dependencies of the Greek dictionary and biblical entities.

## Decision

Publish two independent resources, `strong-lexicon:simple-fr` and
`strong-lexicon:simple-en`. Present four resource families: Strong lexicon (simple,
localized), detailed lexicon (the existing `core`), detailed Greek dictionary
(`resources`), and biblical entities (`entities`). Preserve all existing identities
and revisions. Only `resources` and `entities` depend on the detailed core.

Simple publications reuse the validated lexical core schema and PostgreSQL domain
projection. Each contains its own exact STEP identity directory, localized labels,
historical definitions and morphology metadata. It needs no detailed-core download.
No Bible text, STEP definition, named-entity article or detailed dictionary article
is carried as a simple definition. Missing historical definitions remain absent.

Map each resolved STEP entry using its explicit lexical language and `baseCode` /
`eStrong` family. Preserve suffix case and do not infer families by stripping
`dStrong` suffixes or following `uStrong` aliases. Independent simple publications
do not join optional modules using local numeric STEP IDs; enrichments come from
the separately resolved detailed entry.

Keep the API's existing default detailed behavior for released clients. An explicit
`level=simple` selects the language-specific publication for entry, batch, browse,
random and morphology reads. Cache revisions include that publication. The new
client independently selects online/offline access for each level, displays the
simple definition first, and reveals STEP and the Greek dictionary in the advanced
section. An existing detailed-only offline installation remains readable.

Strong onboarding defaults to the simple lexicon in the chosen resource language.
Detailed enrichments retain their normal dependency ordering and independent
installation, update and deletion lifecycle.

## Consequences

The identity directory is duplicated so that a small simple download is useful on
its own. Revisions, checksums and online/offline parity remain enforced by the
existing publication pipeline. Renewing the directory requires rebuilding the
simple bundle, but does not require republishing the detailed core or its addons.
The two new publications are uploaded and imported differentially; unrelated
catalog entries and existing lexicon publications remain unchanged.
