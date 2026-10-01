# ADR-0066: Author words of Jesus as anchored decisions and deliver self-contained canonical Bibles

## Status

Accepted. Completes the Schema V4 decision of [ADR-0013](./0013-pair-canonical-bible-text-with-optional-strong-sidecars.md)
for every Bible: headings and words of Jesus travel inside the canonical text, online and offline.

## Context

Readers lost red letters. Canonical presentations mark the words of Jesus as `wj` layout events
(Bibles rebuilt from legacy JSON) or `red` events (rich SWORD sources), but the reader rendered only
`red`, and it stopped reading the historical red-word files once a chapter was canonical.

The historical red-word files were not a sound base either. They stored word indexes produced by an
earlier, LLM-assisted pipeline that aligned every Bible on a Louis Segond marking:

- the LSG marking missed whole discourses (Matthew 10, Mark 13, Luke 15, John 10 and 14…), so all
  derived Bibles missed about 280 verses that KJV and NASB mark;
- LSG and DBY were retypeset after authoring (`dit :` with a space), shifting about 500 verses each by
  one word; FRC97 received a new text while keeping its old indexes (1,339 of 1,751 verses out of
  range); POV, OST, CSB and KJF showed smaller shifts;
- word indexes carry no proof of the text they were authored for, so these shifts were silent;
- LSG and DBY, published through the Strong pipeline, carried neither red letters nor pericopes.

Offline copies of ordinary Bibles still shipped legacy JSON with separate pericope and red-word
files, while online reading served canonical verses that embed them.

## Decision

### Words-of-Jesus decisions are authoring data

Resource Studio keeps one decision file per Bible in `workflows/words-of-jesus/data/<bible>.jsonl`.
Each verse decision lists half-open UTF-16 spans and the truncated SHA-256 of the verse text it was
made for; an empty span list records a reviewed verse without words of Jesus. Decisions record their
origin (`legacy-red-words`, `aligned`, `manual`). The repository is public, so decisions store no
Bible text.

Publisher markings stay authoritative where they exist (KJV, RLT, NASB 2020, NASB 1995) and serve as
references. Every other modern translation receives derived decisions, including English modules
whose sources carry no red letters: red letters are a reader convention, and the provenance of each
decision remains recorded. Original-language texts and Old-Testament-only Bibles have none.

The editorial rules live in `workflows/words-of-jesus/ALIGNMENT.md`: Jesus' direct speech, including
from heaven and in Revelation; never speech introductions or other speakers; never words of Jesus
recalled or reported by others (unlike NASB, which marks them); the target translation's own
quotation structure wins when it clearly differs from the references.

Decisions are produced in this order, each step leaving reviewed decisions untouched:

1. import historical files, resolving LSG and DBY indexes on their earlier wording and carrying them
   to the current text by word alignment;
2. audit against the publisher-marked references (missing, unsupported, coverage, mid-sentence
   boundaries);
3. transfer deterministically: whole verses every reference marks, and spans whose boundaries align
   with an anchored neighbour in a closely related pivot Bible; a publisher marking transfers only
   when a reference of another family marks the verse too;
4. review the remaining verses with agents, at word granularity, then trim speaker changes glued to
   a word.

### Publication merges decisions into the canonical text

The ordinary Bible publication reads its inputs from `config/ordinary-bible-sources.json` (verse
text and historical pericopes), applies the decisions as `wj` open/close layout events, and fails
closed when a verse text no longer matches its decision or already carries publisher markup. Spans are
split at paragraph and poetry boundaries; layout events and notes keep one renumbered order space.
Historical pericopes complete canonical sources that have no headings (LSG).

Every Bible's Offline copy is the canonical JSON alone. R2 holds everything new: published
archives under their immutable `revisions/<sha256>/` keys, and new authoring inputs under
`sources/<sha256>/`. After publication, the mobile inventory points at the R2 copy of each
republished archive (`r2://` locations read with the operator's wrangler session, bytes checked
against the key), so the catalog stays reproducible from the inventory. `assets.bible-strong.app`
remains a read-only store of historical inputs. The inventory describes deliveries only, never
authoring inputs.

### Strong sidecars are re-paired, not regenerated

Adding presentation changes a Strong-capable Bible's text revision. When every verse text is
identical, the Strong publication re-pairs the existing sidecar: it rewrites `textRevision`,
`textSha256`, `baseStrongRevision` and `strongRevision`, and records
`presentationRestampedFromTextRevision`. Word offsets stay valid. A changed verse text aborts.

The English projection fix restoring separators around notes (DARBY, BSB, RWEBSTER) only inserts
spaces. The released sidecars, with their lexical refinement and reverse interlinear, are carried
to the corrected texts: offsets and event orders come from a sidecar compiled from the corrected
projection, and every span must keep its length and word (`textRebasedFromTextRevision`).

### The reader renders canonical words of Jesus

`wj` and `red` render as red words, gated by the reader's red-letter setting and hidden in annotation
mode. Pericopes come from SQLite headings for any installed canonical copy. The side-file reading
path remains for copies installed before this change until a later cleanup release.

## Consequences

- All published ordinary Bibles and eight Strong-capable Bibles get new text revisions; annotation
  realignment is trivial because verse texts do not change, except the spaces restored in DARBY
  (3,676 verses), BSB and RWEBSTER.
- Installed copies update only when the reader chooses to. Builds released before canonical Offline
  copies cannot install the new archives; this risk was accepted.
- Agent decisions are word-level: a word gluing narration and speech can stay partly red. Historical
  decisions that pass every audit heuristic may still keep a small offset.

## Validation

All 35 decision sets anchor to their production texts (`verify-sources`, `check`): 70,997 verses
carry words of Jesus, 2,018 to 2,044 per Bible, with no audit flag left. A rebuilt NBS bundle passes
the Resource service validation with a canonical-only archive; a rebuilt LSG gains 907 headings, and
its real Strong sidecar re-pairs with a passing integrity check. The reader renders NBS John 14 in red
on the iOS simulator, with narration and other speakers left black.
