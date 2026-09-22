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
