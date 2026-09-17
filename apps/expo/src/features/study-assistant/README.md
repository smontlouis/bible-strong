# Web assistant modal

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

Each new routed response can retain up to three public routing snapshots: initial allowed tool families/names and cumulative access after expansions. The expandable routing details distinguish authorized tools from executed tool activity. No provider prompts, reasoning, probabilities, keys or raw routing request bodies are sent. Old conversations have no routing record; do not infer one from their calls. Routing snapshots are excluded from model history and memory inputs.
