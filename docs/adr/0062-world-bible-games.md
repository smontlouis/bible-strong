# ADR-0062: Run small biblical games under World room authority

- Status: Accepted
- Date: 2026-09-21

World owns optional games between nearby avatars: Who am I? and Bible challenge,
with two to four participants and five rounds. These are conversational knowledge
games, independent of movement physics and the private study assistant.

The existing event-room Durable Object arbitrates invitations, membership,
deadlines, answers and scores. Persist the bounded game collection in its SQLite
store before delivering private snapshots. Keep all answer keys, future clues and
provider credentials on the server. Bind each asynchronous generation/evaluation
to an operation ID and round; stale completions cannot mutate a later state.
The room's single alarm services both presence cleanup and game deadlines.

A backgrounded or disconnected participant pauses a running game for 90 seconds.
The World resume identity restores membership within that window. Beyond it,
remove absent participants, transfer the host and continue with at least two
players. The World session itself retains its existing 24-hour resume lifetime.
Who am I? awards 4/3/2/1 points according to the clue visible at submission, with
20/20/12/8-second zones. At two players, alternating turns transfer on an incorrect
answer; at three/four players, each player can try once per clue. Adjudicate receipt
order, not provider completion order; freeze the clock while evaluating. The mode
is stable within a round and selected again when the next round begins. Bible
challenge retains one point per correct answer. A technical evaluation failure must
never become an incorrect answer; unresolved failures void the round.

## Generation update — 2026-09-22

At the owner's request, use Gloo Grounded for topic selection, retrieval and round
generation. Gloo chooses from the Bible according to category, Testament and
level. Remove the fixed chapter list, the World-to-Resource service binding, the
local Resource URL and the game-specific Resource Worker entrypoint. No
`get_passage` tool is exposed. Other Resource consumers remain unchanged.

Use Gloo auto-routing with the shared GlooGrounded publisher, citations and bounded
output. Require reported grounding and usable source metadata; validate structure,
canonical reference ranges, distinct answers, choices and clue name leakage.
Plan subjects first, then research each separately through a focused English
question, keeping formatting/game instructions outside the retrieval query.
Require grounding for each final round; a broad plan alone is not playable.
Bound preparation to seven calls (one plan, five final rounds, one shared repair),
three concurrent research calls and a 170-second overall deadline. Otherwise
return to the lobby. Grounding is
not proof of every generated fact or an exact Bible translation; present
explanations as paraphrases and use canonical reading links for proposed references.

Jev remains the player-answer adjudicator for spelling and identity, through
AI Gateway. Exact normalized answers and aliases remain deterministic. Generation
and answer checks use separate server-only keys. Game deadlines, operation IDs,
scoring and presence rules remain under the existing Durable Object authority.

See [game operation and validation](../../apps/world/docs/bible-games.md).

## Solo and in-world game terminal — 2026-09-22

The terminal beside the central island's north bridge is the shared entry point
for solo and multiplayer. It replaces the idle floating game launcher; an active
session retains a resume button and invitations retain their dedicated notification.
The terminal uses reviewed generated sprites and a small ground repair overlay at
source coordinates (726,294), preserving the map's coordinate system and existing
navigation. Its base sits at the edge of the northern walking lane. The nearby interaction also requires
central-island membership, so the adjacent bridge cannot activate it.

Solo is a Bible adaptation of “4 à la suite”: four consecutive correct answers,
a mistake or deliberate pass resets the current streak, and the best streak remains.
[France TV describes the original 40-second challenge](https://www.france.tv/france-3/questions-pour-un-champion/6845875-emission-du-lundi-27-janvier-2025.html).
Our adaptation gives 120 seconds of **active question time**, suitable for written
answers. Explanations, generation, answer checks, technical errors, clarification,
background/disconnection and closing the game dialog pause that timer. Overlapping
pause reasons are independent and may only resume when all have cleared.

Reuse the room's persisted game collection, identity and operation guards. Solo
membership cannot receive invitees; its paused session is retained for up to 24
hours, independently of multiplayer's 90-second rejoin window. No answer key is
sent before reveal. Easy questions use four choices; medium/hard accept free text
and reuse exact aliases and Jev adjudication. A technical failure preserves the
question, streak and clock, and offers explicit retry. Clarification is also free.

Gloo generates a batch of five grounded questions using the existing bounded
pipeline. Once exhausted, prepare another batch while the timer is paused, supply
previous answer identities as exclusions, and discard returned duplicates. Round
indices never recycle during a run, so delayed submissions cannot target a new
question. Keep the existing rate/concurrency/hourly generation limits. Cap a run
at 50 questions; this is a technical bound, with a distinct completed outcome.
The Lab uses the same pure solo rules with local fixtures, not a second connection.

## Curated catalogue prototype — 2026-09-22

Prepare a draft catalogue for written-answer solo questions before switching live
round preparation away from Gloo. The first catalogue contains 300 distinct facts:
100 per difficulty, split equally between the Old and New Testaments. Each record
has one stable ID with French and English question, answer, aliases and explanation,
plus canonical Bible coordinates and a source link. Remove the people/place/object
selector from the game setup UI. Keep Testament and difficulty.

The development-only Question Lab allows bilingual review, local review status and
notes, JSON export and a written-answer trial with independent simulated profiles.
Prefer unseen question IDs; recycle oldest seen questions only after exhaustion.
These local histories demonstrate the selection policy, not durable account history.
Review is an explicit editorial phase: draft data is not shipped in the public
client or connected to live games. Server-side catalogue selection and per-player
history are a subsequent step after approval. Jev remains suitable for live free
text adjudication; the prototype uses aliases and explicit self-assessment.

## Curated SQLite catalogue in live games — 2026-09-22

At the owner's request, replace Gloo generation with the 1,200 bilingual written
questions and 200 bilingual identity cards. This supersedes the generation and
prototype-only restrictions above. Jev remains the only game AI dependency, called
only for written answers that do not match normalized canonical answers/aliases.
All new Bible challenge rounds are written-answer, including easy difficulty.
Who am I has four progressive clues, not three editorial difficulty tiers; hide
its difficulty control, preserve Testament filtering, and mix people/places/objects.

Add the SQLite-backed `GameCatalogue` class in additive migration v3. One named
catalogue coordinates batch allocation/history for this event across its rooms;
only allocation reaches it, never movement, sockets, scoring or answer checks.
WorldRoom keeps its existing SQLite and game authority. This modest event catalogue
is intentionally centralized for atomic group selection, not a replacement for
per-room game state. A larger multi-event service would scope catalogues per event.

Server-only JSON files are versioned seed material. A generated manifest hashes
all files; an atomic reconciliation imports them on revision changes without losing
history. Content is loaded into SQLite by the catalogue instance, not reimported
by each room. Development watches both banks; build/deploy refresh the manifest.
No public catalogue endpoint exists, and the browser bundle excludes the banks.
Review labs remain local editorial tools: their browser decisions do not publish.

Each private RPC reserves up to five questions and writes its operation ID and
result atomically. Retry of the same operation returns the same batch. Prefer
questions unseen by all participants, then those seen by the fewest participants,
then the least recently offered (latest participant exposure). Randomize ties.
A reserved batch counts as offered even if abandoned before all its questions
are displayed. Within a solo run exclude catalogue IDs, not answer identities:
different facts can share an answer. Allocation records expire after 48 hours;
history remains durable. A lack of eligible content or storage failure returns a
retryable preparation error, never invented content. Preparation recovery timeout
is 15 seconds; obsolete AI generation budgets are removed.

An anonymous UUID in browser localStorage identifies question history across room
sessions, with in-memory fallback if storage is unavailable. It is not an account,
a credential or an avatar resume token; it grants no read access and is never
broadcast. Clearing browser storage or using another browser starts new history.
The existing session token and 24-hour avatar resumption remain unchanged.

Every clue retains its source link, revealed alongside the answer. Old persisted
rounds can finish under their original choice/answer contract; every newly selected
round uses the catalogue. Deployment is a separate operation: local data and cloud
SQLite are separate, each initialized by the same versioned seed.

## Continuous solo and final review — 2026-09-22

Solo no longer reveals a correction or waits for Next between questions. A settled
correct/wrong/skipped answer updates the streak and advances in the same persisted
transition. The active timer resumes immediately after adjudication; only Jev,
clarification, technical errors, presence and explicit dialog pauses freeze it.
New runs reserve up to 50 catalogue questions before starting, avoiding mid-run
loading pauses. These reserved questions count as offered under the existing
history policy, even if the run finishes early. Legacy short batches refill
automatically under operation guards if necessary.

Store each final question verdict, submitted text and round index privately in the
room. Send only a short verdict event during play; send the review with canonical
answers, explanations and sources only when the run finishes. At timeout include
the currently displayed unanswered question, never the unused reserve. Jev retries,
clarifications and technical failures are not extra scored questions. A migrated
old run may lack earlier verdicts; identify its review as incomplete rather than
inventing results. The solo input stays mounted between questions to retain focus
and the mobile keyboard. Multiplayer reveal/scoring behavior remains unchanged.
