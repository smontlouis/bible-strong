# Web assistant modal

## Live dictation

The web composer uses the official assistant-ui Dictate/StopDictation primitives with
`LiveDictationAdapter`. A mono PCM16 AudioWorklet streams microphone audio; partial
transcripts replace the preview and the final transcript is committed once. Stop
waits for the last words before unlocking Send/Enter. Closing the modal, showing
history, changing/deleting the conversation, signing out or leaving the page releases
the microphone and ignores late results. Browser microphone permission and a secure
context (HTTPS or localhost) are required. This does not add native iOS/Android capture.

`POST /v1/study-assistant/dictation` uses the existing Firebase ID token and App Check
headers. The private service returns `{ token, url }` for a short-lived transcription
session; permanent credentials and model selection remain private. Audio and tokens
are not persisted in conversations. Deploy this backend route before releasing the
client. No new client environment variable or dependency is needed.

Transport matches the transcription-stream v1 protocol in `@ai-sdk/gateway` 4.0.86
and `@ai-sdk/provider-utils` 5.0.44. Capture stops after two minutes or at the composer
character limit; connection/finalization timeouts unlock the editor and preserve its
partial text. These client limits are UX bounds, not server-enforced spending limits.

Validation: live Grok STT via Vercel accepted a synthetic French recording and emitted
partial, final and finish frames. Unit tests cover stop/finalization, cancellation,
disconnects, timeouts, interim replacement and microphone denial. The microphone
button was visually checked in the signed-in localhost app. A real microphone session
through the authenticated app remains a manual check after backend rollout.

Entry: `AssistantLauncher.web.tsx`, mounted only in `FullAppRuntime.web.tsx`. The native screen remains separate. Uses `@assistant-ui/react` 0.15.20 AssistantModal/Thread/Composer primitives with a custom external-store runtime and the existing authenticated Worker SSE client.

`useReadingContext.web.ts` observes active Bible selection/chapter and Strong tab/route context. Pin/remove controls affect only future messages. `conversations.ts` validates, limits and serializes browser-local histories by account; it also builds the smaller inference history. `conversationRun.ts` owns one cancellable streaming operation, snapshots context and refuses late updates from an obsolete session. No keys, tokens or full editorial resource dumps are stored in local conversations. Persistence is debounced and flushed on page hide. Opening the modal or history does not trigger inference.

Local limits: 50 conversations, 300 messages each, 2 million serialized characters. No generated summaries, cloud synchronization, cross-browser-tab write coordination or automatic account-history merging in this slice. The UI shows storage failures. Backend authentication and the two-account beta allowlist remain enforced.

## Verification (2026-09-17)

- Real web UI on localhost:9090, using the existing signed-in beta session: selected Luke 3:4, sent a question, received a complete streamed answer and saw its original context stored on the message.
- Pin held Luke 3:4 while switching to 2 Corinthians 8; unpin followed the new chapter.
- New conversation/history navigation worked. Reload restored the previous response and its original reference independently from the current reading context.
- Stop retained the partial answer with an explicit incomplete status and restored composer controls.
- Nine feature tests pass: local account isolation, malformed/full storage handling, bounded model history, context snapshot, cancellation, obsolete-session events and Markdown safety. Eleven Worker tests pass, including preservation of text before tool calls.
- Root typecheck and root build passed. Web export passed. Targeted ESLint passed. Style/architecture checks passed (architecture retains its existing warnings).
- Broad Expo tests: 5 failing suites, 394 passing, with 1 failing assertion and import/environment failures already present in the earlier baseline. Full source lint (excluding generated .scratch output) reports 5 unrelated existing errors. Site tests and Resource service tests passed separately because root test stops on the Expo failures.
- React Doctor on the new code: no errors after extraction of the async runner; remaining warnings are component size/complexity and browser-storage hydration in an effect.


Additional browser checks: Strong-tab identity was normalized using the existing lexical route helper (G2839H, not an unprefixed number); removing the context switched to free conversation. The avatar and modal stay above the non-modal verse-selection sheet. The local conversation tests now include the extracted request runner, making nine feature tests in total.

## Conversation memory update

`conversationMemory.ts` now replaces the short fixed window for the web modal. It keeps all eligible complete exchanges until memory exceeds 32,000 characters, then retains whole recent pairs around 12,000 characters and requests a summary capped at 3,000. The versioned checkpoint is stored alongside the full transcript, validated by a prefix hash, and reused across reloads. Summaries are generated through the authenticated Worker, not in the browser. The legacy standalone screen retains a bounded recent window for compatibility.

Preparation has a visible status. Failure/cancellation preserves the full transcript and does not send an incomplete memory to chat. Existing very large histories are processed in bounded batches, up to four per attempt; a remaining backlog is explicit and resumable. Each compaction counts toward the existing beta request quota. No automatic retries. See ADR-0050 for limits and exceptional large-pair handling.

## Resource-aware context

The assistant also recognizes commentary chapter/section views, dictionary articles and Nave topics. Resource views publish their current metadata to a web-only registry; dictionary source switches and commentary section changes update the same context without requiring a route change. Commentaries include the actual catalog author and biblical location; dictionary context keeps the work/article identity; Nave keeps the actual topic identifier and resource language. The chip and saved-message caption show a readable label, while the bounded provider context carries identifiers for subsequent tool reads.

Metadata is not the full resource text. No editorial content is automatically scraped or attached; the prompt explicitly says to read the indicated source before explaining it. Existing server tool/catalog restrictions still apply, including unavailable resources. Context publication does not make additional resource or model requests. Native context publication is a no-op.

Workspace reader/panel surfaces identify pointer, keyboard-focus and wheel interactions. A newly opened route panel becomes the proposed context. Interacting with the reader switches back to its context; interacting with the panel switches to its current resource. Assistant controls are ignored by this focus tracking. Closing/unfocusing panels removes their publications; pin/remove and per-message snapshots continue to work independently.

Verified in the browser: Aquifer commentary tab, Clarke Jean 15:4 panel, alternation between Luc 3 and Clarke through scrolling, Bost article switched to Westphal in the same panel, and Patience in Nave. Context-specific shortcuts are available for each kind. Unit checks cover source identity, bounded context, persistence, surface selection and publication cleanup. 24 targeted tests pass, as do Expo typecheck, web export and style/architecture checks (existing architecture warnings retained).

A multi-author commentary list keeps the passage and the selected author list distinct from an individual commentary; it never labels one author as selected when none is.

Stability follow-up: the selected conversation ID is persisted per account, so choosing an older thread and reloading restores that thread. Compaction checkpoints now use `memory-2`; old checkpoints are rebuilt from the unchanged transcript. Failure/network/cancellation tests keep partial text explicit and out of model history. See `docs/research/assistant-stability-validation.md` for evidence and limits.

### Tool activity

The Worker emits bounded public `tool` events keyed by call ID. The web modal displays a compact timeline, expanded during a response and collapsed afterwards. Individual invocations disclose the technical name, parameters and a truncated data preview. The official assistant-ui registry components are installed through shadcn and composed by thin adapters. Radix disclosures and upstream label animations remain in use. Errors and unfinished calls are distinct from completed calls.

Up to six activities per assistant message are stored with local history. Reload converts running activities to interrupted. Tool display data never enters conversation memory or subsequent model history. Historical messages from before this change do not have a timeline.

Validation: 26 frontend tests, 20 server tests (one optional resource integration skipped), typechecks, targeted lint and web export passed. The browser smoke on 2026-09-17 reached DAILY_LIMIT before generation, so live visual confirmation remains pending; no quota was changed.

Error banners use the installed assistant-ui Elements ErrorState with translated text. Quota errors explain the UTC reset without an immediate retry button. Transient failures can be retried explicitly with the original question and reading-context snapshot; the failed final pair is replaced instead of duplicating the user message. Storage failures use the same banner. Retry progress is announced with role=status; errors use role=alert.


### Official component installation

Run from the monorepo root:

```sh
npx shadcn@latest add @assistant-ui/elements-tool-call @assistant-ui/elements-tool-timeline @assistant-ui/elements-error-state --cwd apps/expo --yes
```

`apps/expo/components.json` maps the official registry to this feature's components folder. Installed dependencies: lucide-react, radix-ui and tw-shimmer. The adapters hold application state and map real events to component props. Local upstream extensions: timeline renderStep composition, failed/interrupted indicator, translated labels and optional retry action. CSS bridges Radix height/open attributes and bounds result previews. SwapLabel opts out of Expo React Compiler because compiling its upstream hook array caused a hook-queue crash. Preserve these small extensions when updating registry files. Web-only shimmer CSS belongs in global.web.css; do not modify generated global.css.


The visible activity UI now uses ToolTimeline's standard icon/verb/target rows, without nested ToolCall disclosures or success-state wording. Icons identify resource/search type; only failed or interrupted steps include a status label. ToolCall remains installed but is not rendered in the timeline. The renderStep extension was removed.

### Reading plans and meditations

Plan overview, open reading step, meditation collection and the resolved meditation publish account-independent editorial context in route panels and plan tabs. `editorialContext` explicitly projects only titles, descriptions, resource/step IDs, language, reference slices and text slices; it never spreads participation/progress data. Up to 12,000 characters of the open editorial content are attached at send time, with an explicit truncation marker. This first integration uses already-loaded Firebase catalog content, not a new Resource Service tool. Context remains a user-role untrusted document, never system instructions. The Worker allows a 13,000-character reading context. Snapshots retain the excerpt locally; subsequent model history retains reference metadata only. Video transcripts and image contents are not inferred. New suggestions cover explanation, biblical references and reflection.

### People, places and timeline events

The loaded Strong entity profile publishes its editorial identity, descriptions, lexical codes and relationships (including certainty), without personal fields. The loaded timeline event publishes its title, period/dates, article and scripture references in the selected resource language. Timeline detail screens pass their tab scope to the shared content renderer; standalone route details use panel scope. These contexts reuse the bounded 12,000-character editorial snapshot policy; no extra model call happens on navigation. Timeline overview/panning does not invent a selected event.

Each new routed response can retain up to three public routing snapshots: initial allowed tool families/names and cumulative access after expansions. Routing details are kept for diagnostics but are not shown in the conversation. Executed tools remain visible in ToolTimeline. No provider prompts, reasoning, probabilities, keys or raw routing request bodies are sent. Old conversations have no routing record; do not infer one from their calls. Routing snapshots are excluded from model history and memory inputs.

### Interactive references

The public `source` SSE event carries a bounded, validated destination and a preview for a successful passage/Strong/commentary/dictionary read. The response can cite its response-local URL. The renderer resolves that URL only against sources persisted with the same message; unknown source IDs remain text. Historic inference strips response-local source URLs to avoid reusing another message's IDs. Gloo's general retrieved citations are not automatically treated as local sources or sentence-level proof.

Source links open the existing ReferencePreviewHost on click, displaying the retrieved excerpt and the standard external-open icon. No hover preview is used. The experimental Base UI Inline Citation specimen and its dependency/Metro workaround were removed.

### Study widgets

`widgets/` owns deterministic presentation and exact client resource reads. `packages/ai-contract/src/widgets.ts` validates bounded descriptors. The 17 study presentations cover passages and translations, Strong/concordance/word analysis, attributed commentaries/dictionaries/Nave, people/relations/places/events, book overviews, editorial reading steps/meditations and further resources.

Widgets persist per message. Subsequent model memory includes only ordered resource identities, not the full client-loaded texts. Expansions, filters, passage selections and translation changes are temporary exploration controls; reloading restores the original descriptor. Changing a version does not rewrite the earlier assistant analysis, which is stated next to the controls. Difference highlighting is lexical alignment, not semantic equivalence, and differing versification is signalled.

All cards use the shared theme tokens and sans-serif assistant typography. Wide content uses a Radix dialog; resource references use the existing click previews and exact internal routes. Successful source reads supply attributed excerpts. Missing resources, coverage or morphology are explicit; no generated text replaces unavailable source content. Only source-provided valid coordinates generate map links.

Reading widgets resolve public editorial content through `useReadingContent` without enrolling or updating progress. Candidate resources are explicitly distinguished from documents actually read. Private orchestration, prompts, provider credentials and editorial tools remain in the private API repository. See `plans/assistant-study-widgets.md` for validation evidence and source limitations.

### Widget playground (development, web)

Open `/ai-widgets` or choose **Catalogue des widgets IA** from `/playground`. The gallery is organized like a compact Storybook: eleven UI component entries own sixteen selectable states. `PassageWidget` groups Passages and Traductions, while `VerseAnalysisWidget` owns Mots du verset. `EntityWidget`, `SourceGroupWidget` and `ReadingWidget` also group their variants. Provider tool names such as `present_study_widget` appear only inside **Ce que Gloo reçoit**, never as component names in the catalog. The `widget` and `state` query parameters make every state directly addressable; legacy example/tool-group URLs still resolve to their UI component without unsafe navigation rewriting. The gallery mounts one actual `StudyWidget` at a time and uses the existing Resource access adapters. Commentary/dictionary examples resolve published content before constructing their source descriptors. No model request is sent and no assistant quota is consumed. The theme override is local to the gallery; reset clears the current widget state's temporary controls. Descriptions, example requests, interaction checklists and the public descriptor follow the selected state. The route redirects outside development and on native platforms.

Verified: all sixteen states render real resource content; search, copy, reset, wide/compact controls, scoped light/dark theme and 390px layout. Expo typecheck, targeted lint and web export pass. React Doctor only reports the already-known legacy StudyAssistantScreen/compiler diagnostics outside the playground.

Passage UI simplification: `passages` and legacy `passage_comparison` descriptors both render a plain list with reference previews, Bible navigation and reading expansion. No passage selection or Read/Compare switch remains. Translation comparison retains its version controls and lexical differences. These variants are states of `PassageWidget`; word exploration is a separate `VerseAnalysisWidget` entry even though Gloo can request both through `present_study_widget`.

The playground's **Ce que Gloo reçoit** panel loads exact tool descriptions, argument schemas and the selection-guidance paragraph from the private repository's loopback-only diagnostic server (`yarn dev:widget-catalog` in bible-strong-ai). It distinguishes explicit presentation calls from widgets emitted automatically after a successful resource read. The panel follows the selected state, shows the local prompt version, explains JEV-dependent tool exposure, and does not claim to trace a specific model request or deployed version. No private prompt is bundled or persisted in the public app. This request does not consume an AI quota.

`PassageWidget` translation controls use HeroUI's compound `Select` and `ListBox` primitives. The trigger and options intentionally render only stable version identifiers such as `LSG` or `DBY`; full publication names belong to the version catalog, not this compact comparison card. The portaled menu receives the current Bible Strong theme as concrete CSS variables, remains bounded and scrollable, and retains React Aria keyboard/focus behavior. Verified in light/dark themes and a 390 px viewport.

Compact widget polish reuses the same HeroUI select adapter for the concordance book filter, aligned to the card's right edge. Concordance references use a smaller title style while matched Strong words keep the shared concordance emphasis. `VerseAnalysisWidget` uses a centered HeroUI spinner inside a 200 px minimum loading region for both verse and lexical-entry reads. Standalone `StrongWidget` no longer repeats its identifier below the widget header. `EntityWidget` opts into the shared entity card's compact mode with a 16 px internal name, 40 px avatar and 13/21 editorial typography; full entity screens keep their original sizing.

### Application language and source editions

Every chat request now includes `appLanguage` (fr/en) and a preferred `bibleVersion`. The selected reading context carries its edition explicitly; it wins over the user's default Bible, followed by the language default (LSG/fr, KJV/en). This is separate from the response-language instruction. An explicit edition in the question can override the default through the tool's version argument. Source citations and concordance widgets persist the actual version; reopening an English source in a French UI does not switch its text to LSG. Word analysis rejects a mismatched fallback edition.

The private engine uses English system/tool/routing instructions, while responses default to the application language unless the user asks otherwise. English-only or French-only source text is not relabelled as another edition. The currently exposed dictionary/commentary tools remain French-only and advertise that limitation. Nave, lexicon and reference-resource reads can select French or English where published. Older request payloads remain compatible with the previous French/LSG defaults.

Validated: default English/KJV retrieval; French app with KJV source and French explanation; click preview stays KJV; structured tests cover English app with explicit LSG, missing alignment without a substituted edition, KJV search/concordance, and JEV preference propagation. Original French app/resource settings restored after live testing.

### Independent normal, Strong and open-reading Bible preferences

A question snapshots `appLanguage`, `defaultBibleVersion`, `defaultStrongBibleVersion` and optional `readingBibleVersion` before memory preparation. The defaults use the same resolution as the Bible-defaults settings screen; an open/pinned passage supplies its own edition independently. New text searches use the normal default; concordance uses the Strong default; the open passage keeps its own edition. Explicit user version requests override those defaults. Legacy `bibleVersion` requests remain accepted for older clients.

No unavailable alignment is copied between translations. A text-only read can suggest the configured Strong edition for a **separate** read; source links and widgets retain each actual edition. Ordinary prose links use the uniquely known edition from source/widget evidence, including concordance, without guessing when several editions are present. Temporary preference changes cannot alter the settings of an already-started question.

Verification: mocked S21 reading / NBS text search / KJV Strong index exercise all three priorities; tests cover explicit overrides, DBY index selection, unavailable indexes, legacy requests and frozen settings. Live smoke with the user's unchanged LSG normal default and DBR Strong default returned a DBR concordance (G3306, 105 distinct verses); a prose reference reopened Matthieu 10:11 in DBR after page reload. Private provider rules remain in bible-strong-ai; the playground can display their exact version-priority policy.

### Shared lexical UI refinements

The concordance widget uses the existing `ConcordanceVerse` / `CanonicalStrongVerseText` renderer to emphasize indexed words. Its heading is the exact Strong identifier; the former family/scope badge and explanatory notice are no longer shown in the card. Retrieval scope and source-version checks are unchanged. The translation checkbox no longer has its generic explanatory paragraph.

Word analysis reuses the resource modal's `CanonicalStrongVerseText`, `StrongResourceScrollProvider`, occurrence mapping and `StrongCard`. Selecting a word replaces the whole body with its lexical card; a back arrow in the widget header returns to the verse. The detail body does not repeat the Bible reference/version, but keeps that context for opening the full lexical resource. Typography stays sans-serif. Verified Demeurez→G3306→back→sarment→G2814, header placement, and H7050 highlighted words using actual Strong spans. Scoped regression suites: 65 tests passed; types, targeted lint, style guard and web export passed. Broader React Doctor diagnostics remain in unchanged legacy/other widget files.

## Development diagnostics on Cloudflare

In web development, **Debug** opens an optional panel. **Enable for 15 minutes** requests an account-authorized session from the same Cloudflare service; the existing Firebase sign-in is sufficient, with no extra password or provider confirmation. It traces subsequent real requests, never replays old messages. The panel exposes Jev scores/raw decisions, base versus actually sent prompts, tool schemas/calls/results, timing and reported usage. Authentication secrets are removed server-side. Raw events are expandable and can be copied explicitly as JSON; copied traces may contain private prompts and conversation text.

The session and traces remain in component memory, separate from stored conversations, and clear on disabling, expiry/account changes or navigation between conversations (session remains until expiry when switching conversations). The normal chat route stays unchanged. Diagnostic modules and their network endpoints are removed from production web JavaScript by `__DEV__` guards; server authorization is independent of that UI guard. The backend requires a separate UID allowlist, origin allowlist, feature switch and signed temporary session. A server-disabled or unauthorized request cannot expose diagnostics.
