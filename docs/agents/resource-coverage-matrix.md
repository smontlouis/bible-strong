# Resource Coverage Matrix

This matrix records the local-first resource boundary introduced by issues #286–#299. It distinguishes the domain identity, the current remote capability, the optional offline copy, and the application surfaces that consume it.

The hosted publication step is intentionally out of scope. `LSG` is the only remotely readable Bible in the local development service today; every other resource keeps its existing offline acquisition path until a publication is added later.

| Resource identity | Domain access | Current online state | Optional offline copy | Main consuming surfaces | Automated coverage |
|---|---|---|---|---|---|
| `bible-text:<version>` | `bibleContent`, `bibleReading`, `bibleSearch` | `LSG`: remotely readable through `/v1/bibles/...` including ordered coverage; other versions: unsupported for now | Bible SQLite archive, removable even when selected/default | Reader, book/chapter navigation, version selector, comparison, search, export, audio helpers | Resource model, hybrid source/coverage, queries, complete LSG API/presentation parity, version catalogue |
| `bible-presentation:<version>:pericope` | `bibleReading` | Unsupported for now | Pericope sidecar, independent from canonical Bible text | Pericope reader, passage navigation | Identity/offline-copy mapping and Bible reading tests |
| `bible-presentation:<version>:red-words` | `bibleReading` | Unsupported for now | Red-word sidecar, independent from canonical Bible text | Bible reader and export | Identity/offline-copy mapping and Bible reading tests |
| `strong-bible-index:<version>` | `strongBible`, `lexiconBible` | Unsupported for now | Strong index sidecar, independently downloadable/removable | Strong mode selector, concordance, verse detail, lexicon source selector | Strong Bible and lexicon Bible adapter suites |
| `interlinear-index:BHG:<language>` | `strongBible`, `lexiconBible` | Unsupported for now | BHG interlinear sidecar for FR/EN | Interlinear selector and Strong verse display | Resource model plus Strong/lexicon adapter suites |
| `strong-lexicon:<module>` | `strongLexicon` | Unsupported for now | Core, resources, and entity modules remain independent | Lexicon list/detail, Strong entry routes, relation graph | Strong lexicon adapter and route tests |
| `dictionary:<language>` | `dictionary` | Unsupported for now | FR/EN dictionary database | Dictionary list/detail and verse cards | Dictionary adapter/query tests and architecture guard |
| `nave:<language>` | `nave` | Unsupported for now | FR/EN Nave database | Nave list/detail, home widget, verse modal | Nave adapter/query tests and architecture guard |
| `cross-references` | `bibleReading` | Unsupported for now | TRESOR database | Reference cards and Bible verse details | Bible reading tests and architecture guard |
| `commentary:MHY:fr` | `bibleReading` | Unsupported for now | MHY commentary database | Commentary tab and verse details | Bible reading tests and architecture guard |
| `timeline:<language>` | `timeline` | Unsupported for now | FR/EN timeline database | Timeline, search, event details | Timeline access suite and resource boundary tests |

## UI contract

- Onboarding suggests a useful starter set but accepts an empty selection.
- A resource's online readability and offline-copy state are displayed independently.
- Selecting a version or opening a feature never implicitly starts a download.
- Missing, invalid, or temporarily unavailable resources render the shared recovery actions.
- Removing a copy does not erase the selected/default version, open tabs, notes, or preferences.
- Downloads management includes every offline-copy identity, including Strong sidecars, Bible presentation sidecars, cross-references, commentary, and both timeline languages.

## Local verification evidence

- The complete LSG publication contains 66 books, 1,189 chapters, and 31,171 verses.
- The API parity suite reads all 1,189 chapters and compares the response presentation with the publication bundle.
- The publication bundle and Postgres metadata preserve delivery capabilities independently from rights, the ordered 66-book canon, and declared chapter/verse coverage; the API/mobile parity suite compares that coverage end to end.
- Fresh iOS and Android installs entered the workspace with no Bible SQLite copy and read LSG through the local HTTP service.
- iOS additionally exercised download, installed-state detection, removal, and continued online readability after removal.
- Android additionally exercised the acquisition/failure/cancellation presentation; a simulator DNS failure prevented the remote ZIP from resolving, and is recorded in the smoke log rather than misreported as a successful lifecycle.
