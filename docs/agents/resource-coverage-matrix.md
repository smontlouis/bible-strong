# Resource Coverage Matrix

This matrix records the local-first resource boundary introduced by issues #286–#299. It distinguishes the domain identity, the current remote capability, the optional offline copy, and the application surfaces that consume it.

The hosted publication step is intentionally out of scope. `LSG` is the only remotely readable Bible in the local development service today; every other resource keeps its existing offline acquisition path until a publication is added later.

Remote search endpoints are also a later slice. The target policy is already fixed: search is remote-first while connected, local-index-first while disconnected, and may fall back locally after a temporary remote failure. Until those endpoints exist, current searches are explicitly local-only.

| Resource identity | Domain access | Current online state | Optional offline copy | Main consuming surfaces | Automated coverage |
|---|---|---|---|---|---|
| `bible-text:<version>` | `bibleContent`, `bibleReading`, `bibleSearch` | `LSG`: remotely readable through `/v1/bibles/...` including ordered coverage; remote full-text search is not part of this first slice; other versions are unsupported for now | Bible SQLite archive, removable even when selected/default | Reader, book/chapter navigation, version selector, comparison, search, export, audio helpers | Resource model, hybrid source/coverage, queries, complete LSG API/presentation parity, version catalogue |
| `bible-presentation:<version>:pericope` | `bibleReading` | Unsupported for now | Pericope sidecar, independent from canonical Bible text | Pericope reader, passage navigation | Identity/offline-copy mapping and Bible reading tests |
| `bible-presentation:<version>:red-words` | `bibleReading` | Unsupported for now | Red-word sidecar, independent from canonical Bible text | Bible reader and export | Identity/offline-copy mapping and Bible reading tests |
| `strong-bible-index:<version>` | `strongBible`, `lexiconBible` | Unsupported for now | Strong index sidecar, independently downloadable/removable | Strong mode selector, concordance, verse detail, lexicon source selector | Strong Bible and lexicon Bible adapter suites |
| `interlinear-index:BHG:<language>` | `strongBible`, `lexiconBible` | Unsupported for now | BHG interlinear sidecar for FR/EN | Interlinear selector and Strong verse display | Resource model plus Strong/lexicon adapter suites |
| `strong-lexicon:<module>` | `strongLexicon` | Unsupported for now | Core, resources, and entity modules remain independent | Lexicon list/detail, Strong entry routes, relation graph | Strong lexicon adapter and route tests |
| `dictionary:<language>` | `dictionary` | Unsupported for now | FR/EN dictionary database | Dictionary list/detail and verse cards | Dictionary adapter/query tests and architecture guard |
| `nave:<language>` | `nave` | Unsupported for now | FR/EN Nave database | Nave list/detail, home widget, verse modal | Nave adapter/query tests and architecture guard |
| `cross-references` | `bibleReading` | Unsupported for now | TRESOR database | Reference cards and Bible verse details | Bible reading tests and architecture guard |
| `commentary:MHY:fr` | `bibleReading`, `commentary` | Unsupported for now | MHY commentary database | Commentary tab and verse details | Bible reading and commentary access tests plus architecture guard |
| `commentary:FIRESTORE:en` | `commentary` | Existing remotely readable commentary collection, translated by the app when needed | Unsupported; this remote collection is not presented as an MHY Offline copy | Commentary tab | Commentary access composition tests and architecture guard |
| `timeline:<language>` | `timeline` | Unsupported for now | FR/EN timeline database | Timeline, search, event details | Timeline access suite and resource boundary tests |

## UI contract

- Onboarding suggests a useful starter set but accepts an empty selection.
- A resource's online readability and offline-copy state are displayed independently.
- Selecting a version or opening a feature never implicitly starts a download.
- Missing, invalid, or temporarily unavailable resources render the shared recovery actions.
- Removing a copy does not erase the selected/default version, open tabs, notes, or preferences.
- Downloads management includes every offline-copy identity, including Strong sidecars, Bible presentation sidecars, cross-references, commentary, and both timeline languages.

## User-visible state matrix

| Situation | Product behavior |
|---|---|
| Valid Offline copy, with or without network | Read the installed copy. Online content never silently replaces the installed revision. |
| Search while connected, once remote search exists | Query the remote search service first, even when a local index is installed; fall back locally on a temporary remote failure. |
| Search while disconnected | Query the installed local index first; if none exists, show the shared unavailable state without offering an impossible transfer. |
| No Offline copy, online operation supported and connected | Read Online content. LSG chapter text and coverage are the first implemented operations. |
| No Offline copy, Online operation not implemented, connected | Keep the feature open and explain that an Offline copy is needed for now; offer **Make available offline**. |
| No Offline copy and disconnected | Keep the feature open, explain that reconnection is required, and disable the transfer action. |
| Download queued while connectivity disappears | Keep the item queued without consuming retries; resume processing after reconnection. |
| Temporary adapter, HTTP, or file-read failure | Keep the catalog or feature visible and offer **Retry**; do not reclassify the failure as missing content. |
| Genuine chapter, verse, entry, or topic absence | Show the domain empty/not-found state without an Offline-copy action. |
| Invalid Offline copy | Preserve the logical resource and preferences, then offer the shared recovery/storage actions. |
| Missing commentary, cross-reference, pericope, red-letter, Strong, or interlinear enrichment | Keep the readable base Bible chapter visible; show recovery only for the missing secondary resource. |
| Strong or interlinear display mode selected while its sidecar is unavailable | Keep plain Bible text readable, clear an unusable active mode, and require a separate explicit acquisition action. |
| First launch | Ask whether to start immediately or prepare Offline use. Both paths are optional; downloading can always be skipped while work remains queued. |

The same rules apply to home widgets, lists, detail cards, modal cards, global search, selectors,
the Bible reader, Timeline, onboarding, and Downloads. Availability-check failures render Retry and
never become a download button merely because the check returned no data.

## Local verification evidence

- The complete LSG publication contains 66 books, 1,189 chapters, and 31,171 verses.
- The API parity suite reads all 1,189 chapters and compares the response presentation with the publication bundle.
- The publication bundle and Postgres metadata preserve delivery capabilities independently from rights, the ordered 66-book canon, and declared chapter/verse coverage; the API/mobile parity suite compares that coverage end to end.
- Fresh iOS and Android installs entered the workspace with no Bible SQLite copy and read LSG through the local HTTP service.
- iOS additionally exercised download, installed-state detection, removal, and continued online readability after removal.
- Android additionally exercised the acquisition/failure/cancellation presentation; a simulator DNS failure prevented the remote ZIP from resolving, and is recorded in the smoke log rather than misreported as a successful lifecycle.
