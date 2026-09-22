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
