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
client independently selects online/offline access for each level.

The detail page presents a single “Meaning” section with two reading levels,
“Essential” and “In depth”, chosen with a switch and remembered across entries.
Levels name a depth, never a source, and blocks carry no source attribution.
Essential shows one best summary. In depth adds, in order: the other definition
(“Detailed definition” or “General definition”), a distinct name meaning, alternate
senses, and classical Greek when the dictionary resource is installed (nothing is
shown otherwise). The switch appears only when In depth has content. The
level switch sits below the jump navigation and before the verse context, retaining
its compact styling. Essential keeps context collapsed with its passage
reference visible; the reader can open it manually. In depth opens context and
shows morphology. Explicit level changes reset the context disclosure to that
level’s default; a different entry or passage also resets it. The switch is useful
whenever either contextual or lexical detail is available.

During the client-side trial, use a reversible reading-order policy. Identical
normalized text and references appear only once. Near duplicates (at least 70%
word similarity, with the guards below) appear once, in the detailed wording.
Similarity does not establish semantic equivalence.

For non-redundant Hebrew notices, explicit sibling-sense relations (`subentry` or
`same_estrong`) or an expanded `eStrong` distinct from `classicStrong` identify a
specific sense: its detailed text becomes the essential summary and the historical
family notice moves to In depth as “General definition”, provided the detailed
notice has at least six words. Shorter notices mostly restate the gloss (H0349A,
H7819B) and keep the historical definition first. Greek entries never apply
this rule: their detailed text is the Abbott-Smith article for the whole lemma,
published identically for every sibling (G3972G and G3972H), not a sense notice. A `dStrong` suffix alone is
insufficient. Entity-addon availability does not affect this policy. Otherwise the
historical definition is essential and STEP is the In-depth “Detailed definition”;
a missing level falls back to the other one as the essential summary.

Comparison uses Dice over the longest common subsequence of normalized words.
Ignore HTML, punctuation, nested list numbering and the repeated gloss. Keep
complementary definitions more than 20% longer than the simple text, or containing
changed references/media. Work is bounded to 250,000 token pairs and 32,000 combined
HTML characters; over-budget inputs remain available. A 32-entry cache uses both
complete texts and the gloss. No dependency or publication change is required.

Independent name meanings are deduplicated only when their normalized text and
references are identical. Cards/previews retain their existing historical-first
fallback.

After reviewing this trial in French and English, consider moving decisions to
publication generation. No source definitions are deleted during the trial.
Future storage reduction must preserve independent advanced-only installations,
revision compatibility and language-specific decisions.

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

## Progressive detail loading

The main word-study view requests both definition texts and lexical relations first.
They remain necessary to choose Essential without changing its text after first paint.
The entry API accepts `content=definitions` to omit dictionary articles and entity
hydration; the omitted option preserves the full response for released clients.
Projection-specific ETags keep these representations separate. The SQLite adapter
uses the same projection and the hybrid adapter does not wait for remote addons
when the definitions are installed locally.

After the essential view has painted, the client automatically loads detailed addons,
verse context, morphology and concordance. No scroll or disclosure action is required.
Addon results merge only addon fields; they never replace definitions, lexical relations
or identity. Background failures preserve the essential view and expose retry. Leaving
an entry cancels scheduled work and query keys isolate late responses by identity and
language. Other detail routes keep the full-entry behavior.

This changes delivery and scheduling only: no R2 artifact or database migration is needed.
Deploy the Worker projection before distributing the client to obtain the online benefit;
an older Worker remains compatible but still returns a full initial entry.
