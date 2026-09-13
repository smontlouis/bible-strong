# Inline commentary reading index — implementation progress

## Current editorial decision: EGW Writings is not an inline commentary

Exclude `egw-writings` from the inline settings options and normalized saved
inline selections. Keep the general resource catalog, commentary selection and
resource reader unchanged. SDABC remains eligible. No reading request is made
for EGW even when an older local or synced inline selection contains it.
Prior EGW measurements remain useful stress-test evidence, not a requirement to
show this collection in the inline reading UI. Across the remaining 35 published
resources, the largest measured chapter index is Barnes FR Psalm 119: 176 sections,
44,398 bytes, 13,398 gzip bytes. Retain all sections and the 160-character excerpts.
Selection/placement/native-adapter tests pass (12); reader/access/cache tests pass
(11). The latter cover full-text loading on explicit selection and revision safety.

## Current decision: retain complete chapter coverage

The user's clarification rejects a chapter-wide cap of 30 sections. Preserve every
section ID and verse range, including the end of Psalm 119. Current code applies no
such cap. BA Psalm 119 has 95 sections and a 21,688-byte index; EGW John 1 has 1,238
sections and a 314,583-byte index. Grouping chips reduces UI/bridge volume without
removing sections. A regression covers all 176 anchors of a synthetic long chapter,
including a focused passage at its end. Excerpts remain limited to 160 characters.

The normalized offline reader passed exhaustive equivalence against the prior
local PostgreSQL projection: 1,120 EGW chapters, 85,014 sections, identical IDs,
ranges, excerpts and bodies. See inline-commentary-egw-normalized-reader.json.
The domain tests (6) and native local adapter tests (5) passed after this change.

## Current instruction: published R2 resources only

The user explicitly stopped Internet reacquisition and authorized the existing
Cloudflare CLI access to R2. EGW acquisition PID 53377 was interrupted; session
63050 confirmed exit 129. Do not restart any source exporter or install its
regenerated source data. All 36 already-published commentary archives (230 MB)
have now been fetched via authenticated `wrangler r2 object get --remote` from
`bible-strong-resource-artifacts-prod/revisions/<archiveSha256>/<file>`.
They are under apps/resource-studio/outputs/published-commentaries; catalog.json
is the baseline published catalogue, and download-verification.json records the
checksums. Use these exact published SQLite files as source of truth from now on.

All 36 ZIPs AND their extracted SQLite contents were checksum/size verified.
New measurements now use these exact R2 copies: Bible annotée median/p95/max
4388/9081/21688 bytes; SDABC FR 5367/11383/39956; EGW 7009/71471/314583.
EGW's maximum is John 1 with 1238 sections (61430 gzip bytes). This is material
evidence that the current one-chip-per-section presentation is too dense for EGW,
and its 256 KB cache-entry cap is too small for that case. This has now been addressed by grouping chips per resource/visible anchor,
retaining all sections, loading full text on selection, and increasing the cache
entry bound to 1 MB within an 8 MB total budget. Do not claim the UX/weight audit complete yet.

The regenerated Bible annotée bundle was moved out of the publication directory
to outputs/abandoned-source-rebuild. Its catalogue/inventory change was reverted.
The SDABC Internet-reacquisition script changes were reverted too. Preserve other
concurrent UI work. Prior measurements based on freshly reacquired source data
must be replaced with measurements of the published R2 copies. Nothing on R2 or
production was changed. The previous block was a wrong access-path decision,
not a lack of Cloudflare CLI access.

## Superseded history — do not execute the regeneration instructions below

The previous missing-corpus blocker is resolved for Bible annotée and SDABC.
Source regeneration is authorized by the user's latest message. Bible annotée was
reacquired from ThéoTeX (23,320 source units), installed in a fresh partial local
library, packaged, parity-validated and imported into local PostgreSQL on 55439.
SDABC's 65 PDFs were reacquired and all 25,058 units exported. Its script incorrectly
derived verse limits from sparse commentary coverage; it now uses the existing
Bible reference parser's canonical lastVerse metadata, with a regression test.

EGW regeneration is still running through the existing exporter (exec session
63050, child PID 53377 at last check), logging to
/tmp/inline-commentary-regenerate-egw.log. It has a durable source-page cache under
apps/resource-studio/workflows/commentaries/.local/sources/egw-writings. Do not
restart it without checking that handle. The export contains BC supplements and
ECSI writings together; after it finishes, install EGW Writings and SDABC using
their existing installer scripts, then package --resource egw-writings --resource
sdabc and measure/validate the actual outputs. Retain the complete source cache.

Real Bible annotée data exposed a duplicate-full-text cost in the original offline
projection (ZIP 14,834,994 bytes versus 6,618,808 previously). Reading index version
2 now stores only metadata/excerpts in SQLite; native full reads reconstruct from
the existing chapter source on explicit open. PostgreSQL still materializes full
sections for direct network reads. This changes the publication revision, not the
original text. New ZIP: 8,773,298 bytes. Median index 4,388 bytes, p95 9,081, maximum
21,688 (Psalm 119); gzip equivalents 1,779 / 3,539 / 7,062. Reports are in
docs/measurements/. Real local HTTP smoke passed for that largest chapter and a
full section. A temporary driver remains at
packages/resource-service/.scratch/commentary-reading-smoke.ts for other corpora;
remove it after measurements (nested .scratch is not ignored).

Selective packaging now permits explicitly selected available resources from a
partial library; default all-resource packaging still requires full coverage.
Only Bible annotée's catalogue/inventory entry changed so far. Other concurrent
user work has appeared in UI/menu files; preserve it and never stage/reset it as
part of this feature. Nothing has been published/deployed to production.

## Accepted outcome

Persist a subset of the user's selected commentaries for inline reading. Display
small passage-associated chips; load only revision-bound chapter indexes with
short plain-text excerpts, and fetch complete sections on demand. The same data
must work from deliberate Offline copies. Activation must not download an entire
book. Full implementation includes publication, service, app and release checks.

## Completed foundation

- Shared section construction extracted from Expo into resource-domain. Existing
  section IDs, overlapping ranges and EGW grouping remain compatible with current
  commentary detail screens (16 existing access tests pass).
- Wire schemas for bounded chapter batches (up to five commentaries), indexes,
  per-resource failures, and revision-required section lookup.
- 160-character excerpt projection with no full content in the index DTO.
- Resource Studio now prepares COMMENTARY_READING_SECTIONS at artifact generation,
  from both legacy COMMENTAIRES and normalized document associations. Chapter
  lookup index supports selecting only metadata/excerpts; section content can be
  selected independently by ID. Fixture tests cover both storage formats.

## Remaining work (not delivered or published)

1. Measure actual full-corpus index/zip sizes, especially EGW and SDABC. Current
   SQLite table materializes section text in addition to legacy source tables;
   evaluate deduplication and storage cost before releasing. Disjoint EGW reading
   associations now use separate contiguous groups (see validation below).
2. Publication integrity: index algorithm/schema changes must be reflected in
   immutable revisions, manifest validation/parity and import logic. No catalog
   or published resource has changed yet.
3. Add Postgres projection table/migration and import-time index construction;
   batch chapter index API and exact revision section API with proper caching,
   error isolation, app-check and HTTP tests.
4. Implement local index reading; old copies need a controlled per-revision
   sidecar migration (never change a catalog-checksummed file in place) or explicit
   updated artifact acquisition. Cache online indexes by revision for offline
   excerpts; indicate missing full content honestly.
5. Persist inline selection separately from the selected commentary list; build
   selector with availability/download actions and integrate Bible Params.
6. Render chips once per section/range, introductions at chapter start, focus-mode
   clipping; route selection to Web preview/native form sheet with excerpt-first
   display, revision-bound full content and links.
7. Full root validation required because shared package dependencies changed.
   Current targeted tests passed; production-shaped export, runtime UI, old-copy
   migration, parity and representative payload measurements remain outstanding.
8. Release only through authorized differential publication workflow after clean
   tree/revision/rollback checks. No production mutation performed so far.

The numbered list records the original work breakdown. Sections below supersede
its implementation status; unproven release requirements remain open.

## Service progress (continuation)

- Added Drizzle migration 0034 and typed Postgres table commentary_reading_sections.
- Publication importer now materializes the same shared sections/excerpts at import,
  grouped per chapter. Existing active revisions need a deliberate backfill or new
  import; new index endpoint reports index-unavailable if no projection exists.
- Added POST /v1/commentaries/reading-index (bounded batch, per-resource failures)
  and POST /v1/commentaries/reading-section (mandatory exact revision and section).
- Index SQL selects only id/range/excerpt, never full content. Section SQL binds
  publication identity, revision, book, chapter, and section ID. Exact revisions
  can refer to retained staged/previous editions; no fallback to current text.
- API tests prove batch error isolation, max batch validation, no content leakage,
  and a 404 on unavailable section revisions. Standard worker route protection
  classifies both routes as reading and applies App Check/rate limiting.
- Pending: real Postgres integration/SQL query tests; batch POST intentionally
  uses no-store at HTTP edge while client revision caching remains to implement.
  Full release caching design and revision/publication invariants still need audit.

## Application progress

- Persisted inline subset of selected commentaries (maximum five), pruned when
  resources are removed, with Firestore settings synchronization.
- Bible settings now expose selection, offline availability and explicit download.
- Batch index access validates identity/chapter/revision and persists bounded
  revision-keyed previews; complete sections are fetched only when opened.
- Native installed copies use the new SQLite projection. Legacy copies build a
  separate revision-bound chapter sidecar without modifying the original file.
- Bible DOM receives metadata-only chips, placed once after the last covered
  displayed verse, with chapter introductions outside focus mode. Click messages
  are checked against loaded chips before opening full content.
- Reader uses the existing contextual Web panel/native TrueSheet adapter and
  preserves the excerpt during loading or failure.
- Expo typecheck passes. Six targeted tests pass for selection, placement and
  index access, including offline preview reuse and revision mismatch rejection.
- Still pending: old-copy integration tests, exact disjoint associations,
  real-corpus measurements, immutable publication revisions, full root checks and
  release. No migration or resource publication has run against production.

## Publication and offline validation update

- Added four native adapter tests: projected reads exclude content; legacy
  sidecars are separate and reused; concurrent revision replacement is rejected;
  failed metadata reads close their SQLite connection. Full-content opening from
  an old copy is covered with the same section ID and revision.
- Added buildCommentaryReadingSections for exact contiguous EGW associations.
  Studio, service import and native legacy migration all use it. Regression test
  proves verses 1–2 and 5 remain separate, with no implication on verses 3–4;
  legacy commentary detail grouping remains unchanged.
- New canonical outputs declare readingIndexVersion=1, and their revision hash
  includes that algorithm version. Tests prove new artifacts cannot reuse the
  legacy revision for the same verse content.
- Publication parity now recomputes all reading sections from canonical data and
  verifies SQLite identities, ranges, excerpts, content and total rows. Tests
  reject each altered field, extra rows, missing projection and unknown algorithm
  versions; legacy publications without the version marker remain accepted.
- Expo, Studio and service typechecks passed during this update. Shared-domain
  tests passed (5), Studio publication/index tests passed (8), service bundle/parity
  tests passed (12). Final root-wide checks remain outstanding.
- No real corpus data found in this checkout's outputs or commentary .local
  directory. Next: locate verified installed/published artifacts for measurements;
  assess normalized corpus storage overhead and publication scalability, then
  finish integration/runtime and release audit. Production remains unchanged.

## Global checks and measurement readiness

- Whole-workspace typecheck passed, Resource architecture checks passed, and the
  Expo production Web export completed. Resource service tests: 180 passed.
- Root tests reached Expo: 347 suites/2270 tests passed; three suites failed in
  unchanged components (BibleVerseDetailCard carousel sizing/cancelAnimationFrame,
  FiltersHeader Reanimated transform, settings Verse native-codegen transform).
  The remaining Site tests were run separately: 16 passed. Root lint is blocked by
  unchanged generate-resource-icons.cjs `__dirname` no-undef; new commentaryAccess
  import-order/unused-import warnings were removed.
- i18n extraction was executed; retained new inlineCommentary keys and discarded
  unrelated extractor reorder/removal churn.
- A dedicated local PostgreSQL instance was started on port 55439 because 54329
  belongs to another project. All migrations including 0034 applied successfully.
  New integration test passed against PostgreSQL, proving index-only projection,
  exact identity/chapter/section/revision lookup, empty chapters, and rejection of
  staged revisions that have never been activated. Historical retained revisions
  may be read; existing importer deletion policy is still a release concern.
- Added a tested measurement command: Studio src/measureCommentaryReadingIndex.ts
  takes a local SQLite and JSON output path. Reports source hash, added DB storage,
  generation/lookup timing, payload bytes/gzip, worst chapters and query plan,
  while proving the original file is unmodified. Only fixture measurements have
  run so far; no representative size claims are justified yet.
- Authoritative corpus access: checkout output/.local folders empty; no matching
  simulator commentary SQLite found. Catalog artifact downloads returned HTTP403
  without app authentication; no workaround attempted. Asked user asynchronously
  for local bundles/SQLite location. This does not block remaining code checks.
- Durable operation/release notes: docs/inline-commentary-reading.md.
- Full available PostgreSQL integration suite passed (11 tests) after propagating
  RESOURCE_POSTGRES_PORT=55439 to its container-restart test as well as the database
  URL. Complete-corpus integration suites require missing bundle roots and did not
  exercise those corpora. The local resource-service PostgreSQL container remains
  healthy on 55439 for further integration work.
- Targeted lint for the new native access/settings/reader files passed. Reading
  access now preserves selection order when mixing installed and online resources;
  its four tests pass. No production actions were taken.

## Final code pass before awaiting corpus access

- End-to-end fixture tests now cover canonical v1 and normalized v2 bundles through
  parity validation, Postgres import, chapter-index HTTP and full-section HTTP.
  Both pass, including idempotent reimport, rejection of corrupted excerpts without
  replacing active content, and explicit 404/refresh behavior after revision change.
- Fixed the mhy-fr UI selection to request its actual MHY publication identity;
  chip and sheet labels resolve publication identity back to the catalogue.
- Installing/removing a local copy now changes the chapter query's registry signal.
  Missing editions retain their preview and offer explicit index refresh rather
  than retrying an unavailable revision forever or substituting another text.
- Reader component tests prove no full-content fetch before opening and verify
  exact revision loading plus missing-edition refresh. Four reader/selection tests
  pass; Expo typecheck and touched-file lint pass. Worker TS build passes.
- Import and parity processing now expand normalized documents chapter by chapter
  instead of constructing a second full expanded corpus in memory.
- Added an explicit single-resource backfill CLI for already imported resources.
  Default is dry-run; --apply atomically rebuilds derived rows and preserves source
  publication metadata/revision. PostgreSQL tests cover dry-run and repeat apply.
  This was tested only on local fixtures, not run against any real publication.
- Recovery strings were extracted and validated in both languages. Unrelated
  extraction churn was removed. git diff --check passes.

## Completion audit / external blocker

Selection, indexed reads, click-only full reads, revision checks, publication
projection/parity and old-copy migration have code and targeted fixture evidence.
The goal is NOT complete: real-corpus weight/storage/performance measurements,
final artifact preparation, real-resource validation and authorized production
release remain unproven and unperformed. The global test/lint baseline failures
noted above also remain documented rather than claimed green.

Corpus files were unavailable in three successive goal passes: publication outputs
and commentary .local data are absent; simulator file search found no commentary
SQLite; catalog downloads returned 403. The user was asked for the local bundle or
SQLite location. No response/location has arrived. Final recheck found only
.DS_Store under Studio outputs and an empty measurement input directory. There is
no remaining justified way to complete representative measurements/publication
without these inputs or explicitly authorized authenticated access. Do not keep
running fixture checks as a substitute for that missing evidence.

The dedicated test PostgreSQL container was stopped after validation; its volume
is retained. Resume with `RESOURCE_POSTGRES_PORT=55439 yarn resources:db:up` and
use the matching local database URL for tests.

## Eligibility and settings validation (2026-09-13)

- Component-level settings tests now exercise the rendered options, removal of
  previously saved EGW inline choices, online/offline captions, and the separate
  explicit download-details action. Enabling a commentary dispatches only its
  selection and does not open the download sheet. An EGW-only master selection
  displays the empty state. Both tests pass.
- Current focused checks: 25 tests across selection, placement, native adapter,
  reader, network access, persistent cache and settings components.
- Root typecheck passed after eligibility/settings changes. The resource-service
  test run passed: 181 tests succeeded, three skipped, zero failures.
- React Doctor completed against master/origin-master with six errors in files
  outside this feature (horizontal-wheel cleanup, touch-selection cleanup,
  playground, PlanPicker and discovery selection). Its inline-settings warning
  concerns a mapped ScrollView list bounded to five master selections; cache loop
  serialization preserves value-before-pointer write ordering. The diagnostic is
  not an all-green result and does not replace runtime checks.

### Remaining completion evidence

1. Inspect rendered Web/native reader and settings with actual chapter data,
   including Psalm 119, focused passage, changing chapters, disabled mode,
   exact-revision full text, offline availability and explicit download.
   Use iPhone 17 Pro Max for native checks if needed.
2. Reconcile final root checks and feature-local formatting/lint. Existing baseline
   failures must be distinguished from failures introduced by this work.
3. Prepare the concrete differential release/rollback manifest from verified R2
   sources and the final code revision. Follow the publication skill and repository
   gates for production changes; no current production release is claimed.
4. Confirm production migration, service/app deployment and artifact activation
   only if authorized and actually executed, otherwise document them as pending.

## Actual local HTTP / browser probe (2026-09-13)

The Node resource service is running on 8787 against dedicated local PostgreSQL
55439 (exec session 78693; revalidate liveness before reuse). The live HTTP batch
for BA FR + Barnes FR Psalm 119 returns 95 + 176 entries, both covering verse 176,
in 66,032 bytes. Neither index includes full bodies. Explicit section requests
for verse 176 return non-empty bodies with matching exact revision and section ID.
Evidence: docs/measurements/inline-commentary-psalm119-live-http.json.

Visual QA remains incomplete: the existing 9090 page displays the inline
unavailable banner. A separate Chrome DevTools context `inline-commentary-qa`
(page 2) fails Firebase App Check debug token exchange with HTTP 403 before resource
reads. Do not register/bypass production App Check or claim visual success. The
safe next step is an isolated local frontend configured for the local resource
service; preserve the user's existing 9090 server/profile. Local resource requests
are already outside the production App Check origin according to
resourceAppCheckRequest.ts. An isolated frontend also needs local Bible data to
render the full Bible Viewer (do not reacquire editorial sources from websites).

## Web visual path unblocked (2026-09-13)

A separate Metro on 9092 uses EXPO_PUBLIC_RESOURCE_API_URL=http://127.0.0.1:8787
and TMPDIR=/tmp/inline-commentary-metro (session 80663; verify liveness). An earlier
attempt reused the 9090 Metro transform cache including its embedded Expo manifest;
separating TMPDIR resolves this without editing production App Check or the user's
9090 server. The local database already contains LSG; no Bible acquisition needed.

Chrome DevTools isolated context inline-commentary-qa, page 3: opened Options du
passage > Police et paramètres > Commentaires dans la lecture, enabled Barnes.
The rendered settings show the selected checkbox and connection-required caption.
After reload, Genèse 1 renders the Bible and all Barnes anchors. The observed
network contains one reading-index POST and no reading-section before clicking.
Clicking the Barnes 3–5 chip opens the full commentary in the Web preview, with
its heading and source text visible. Screenshot inspected inline in the tool output; file export was denied by the
DevTools connector workspace restriction, so no screenshot file is claimed.
This is narrow-Web visual validation, not native form-sheet validation.

Fixed an accessibility discrepancy discovered during the probe: a single-section
chip's aria-label announced the count 1 instead of its displayed verse range.
The button now uses its visible text as its accessible name.

## Native form sheet verified (2026-09-13)

Used the requested iPhone 17 Pro Max ACAC811E-AE07-4C47-BFF8-BB61EAB99FFC,
installed com.smontlouis.biblestrong.dev (build 277). Opened native passage settings,
expanded the settings sheet, and verified the inline selector with separate
connection/download states. Initially Aquifer EN was checked; BA was briefly
checked and unchecked before switching the dev server.

Connected the dev client to the isolated local Metro 9092 using its installed
exp+bible-strong development-client scheme, then restarted the app to clear stale
native sheet presentations left by reload. Confirmed the device in 9092/json/list,
with no device on 8081; original Metro 8081 was not stopped. After reload, the
selector was disabled. Selected BA FR, dismissed both settings sheets and observed
BA chips in Luc 1. Tapped the 1:18 chip: the native expanded form sheet displays
Bible annotée, complete source paragraphs and Bible reference links. Screenshot
inspected inline via Argent; no
production endpoint or resource was changed. This verifies native online reading,
not airplane-mode reading. The simulator currently uses local Metro 9092 and BA FR
inline selection; restore its original Aquifer EN selection/server after QA.


## Differential release candidate (2026-09-13)

Prepared docs/inline-commentary-release.md and the exact 35-resource release
manifest in docs/measurements/inline-commentary-release-manifest.json. EGW's
catalog and authoring inventory entry now match HEAD exactly; its generated
index remains a local test artifact only. Verified all 35 archive hashes,
manifest/catalog revisions and exact changed-identity scope. Total selected
archives: 217,015,946 bytes. Catalog tests passed after the exclusion.
Production preparation still needs a final clean code revision and verified
rollback baseline; the metadata-only production snapshot is not a database backup.
No production writes have occurred. Native offline QA remains unfinished.

## Native offline installation probe (2026-09-13)

No commentary copy was present in the 17 Pro Max app Documents folder before the
probe. Fixed developmentArtifacts.ts: commentary bundles use /commentaries/, while
legacy MHY retains /databases/. Five route tests and service typecheck pass.
Started the actual validated BA bundle artifact server on 8788 (session 56083),
verified HTTP HEAD 200, 8,773,206 bytes and manifest SHA ETag. Replaced only our
9092 Metro with TMPDIR=/tmp/inline-commentary-metro-offline and both local API and
artifact base URLs (session 70207). Original 8081/9090 servers remain untouched.

On the native inline selector opened BA download details and pressed the actual
Télécharger 8,8 Mo button. DownloadManager rejects the local artifact URL with
RESOURCE_APP_CHECK_DOWNLOAD_URL_UNTRUSTED from resourceAppCheck.ts, before an
installation occurs. No commentary SQLite file was created. The existing download
token helper requires the production protected origin, despite the configurable
local artifact base URL. Do not claim native offline validation passed. Production
App Check was not changed. Next step must resolve the documented local artifact
workflow or use a clearly identified local-only test fixture, preserving the
production token trust boundary.


## Native resource-offline reading verified (2026-09-13)

Installed an explicitly labeled local QA fixture, first the checksum-verified old
R2 BA SQLite, then the new indexed bundle SQLite, in the simulator's expected
commentary path. The path did not previously exist. Stopped both owned resource
servers 8787 and 8788 and verified no listeners; Metro remained available solely
for the development JS bundle. This was not airplane mode and does not validate
production download transport.

After cold app restart, the old copy produced a revision-bound 69-section Luc 1
sidecar without full bodies; its SQLite SHA remained unchanged. Tapping Luc 1:18
opened complete source paragraphs in the native form sheet with resource servers
unreachable. Repeated with the new indexed copy after another cold restart:
complete text rendered, its SQLite SHA remained unchanged and no new sidecar was
created. Evidence: docs/measurements/inline-commentary-native-offline.json.

Terminated the test app and removed only the hash-verified injected SQLite and the
known generated sidecar. Reopened the development client on original Metro 8081.
The simulator's inline preference remains BA FR from QA; initial Aquifer EN choice
still needs restoring through the settings UI. No production state changed.

## Final local audit and QA cleanup (2026-09-13)

Restored the simulator's original inline choice through the UI: BA unchecked,
Aquifer/Tyndale EN checked, other options unchecked. The dev client is back on
8081. Injected offline QA files were removed after hash verification. The actual
resource-offline reader checks cover both prebuilt and legacy indexes; production
download transport remains an activation-time check.

Locally demonstrated requirements:
- Opt-in subset, EGW exclusion, persistence normalization: selection/settings tests
  and native/Web selector inspection; Redux hydration/actions and Firestore mapping.
- Complete chapter coverage and bounded excerpts: shared projection/parity tests,
  35-eligible-catalog measurements, real Psalm 119 batch through verse 176.
- No body on chapter load, explicit exact-revision body on click: HTTP tests,
  actual Web network observation and native form sheet with real source text.
- Revision-bound cache/failure refresh: reader/access/cache tests; exact revision
  and ID checked by actual local HTTP section requests.
- Prebuilt offline projection, old-copy sidecar without mutation: all prepared
  bundle parity plus native old/new fixture reads with resource servers stopped.
- Explicit download control: settings interaction tests/native selector; local
  download rejected by production-only trust policy, with no automatic install.
- Publication preparation: verified 35-identity candidate and original EGW entry;
  release order and rollback requirements documented. Production is unchanged.

Remaining external action: authorize committing/pushing this feature and executing
its production release, including the clean-revision/live-baseline/rollback gates.
No such production authorization is inferred from earlier releases or from R2
read permission. Completion is not claimed for that release.
