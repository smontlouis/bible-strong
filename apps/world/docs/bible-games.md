# Bible games

World includes **Who am I? / Qui suis-je ?** and **Bible challenge / Défi biblique**.
Both support 2–4 visitors, five freshly generated rounds, FR/EN, three difficulties,
people/places/objects/mixed subjects, and Old/New/both Testaments.

## Interaction

Open **Play together**, choose settings, then invite nearby avatars (180 world units).
Invitations are private and expire after 60 seconds. A host starts when at least two
participants are present; nobody can belong to two unfinished games.

**Who am I?** reveals four clues worth **4 → 3 → 2 → 1 points**, with
20 / 20 / 12 / 8 seconds to read and type. The first correct submission wins the
round immediately. Five rounds remain the length of a game.

- **Two players: duel.** A owns zones 4/2, B owns 3/1; the starter alternates each
  round. A wrong answer passes the remaining zone time to the opponent. Their
  next scheduled zone is still theirs in full. Each player gets one incorrect
  attempt per zone; if both miss, advance to the next clue immediately.
- **Three or four players: clue race.** Everyone can answer. A wrong answer blocks
  that player until the next clue. If everyone is blocked, advance immediately.
  The server adjudicates receipt order, even when AI evaluations finish out of order.
- Both modes keep the input editable during waiting so visitors can prepare a draft.
  Clarifications allow up to three submissions per player per clue; they do not
  allow repeated incorrect guesses. The clock freezes while evaluations are pending.
  An evaluation outage before a winning answer voids the round, never penalizes a player.
- The mode is selected at the beginning of each round. A departure does not switch
  a running race into a duel. The next round uses the remaining player count.

**Bible challenge** uses four choices on Discovery difficulty and free-text answers
otherwise. Each question lasts 60 seconds, with one point per correct answer.
Answers stay private until reveal (Who players see their own incorrect feedback immediately).
The host can advance after reveal; the server advances automatically after two minutes.
Closing the dialog keeps the game; **Leave game** explicitly leaves it.

Backgrounding or disconnecting pauses question/reveal for up to 90 seconds. Returning
with the existing World session identity preserves membership and scores. On expiry,
remove absent players, transfer host if needed and continue with at least two
participants. Otherwise finish with an explanation. The World session itself remains
resumable for 24 hours; this is distinct from a game's 90-second grace period.

In Bible challenge, a failed answer check permits up to three attempts. If an evaluation remains
unavailable at the end, the whole round is unscored. A pending timely submission
gets up to 12 seconds to complete even after the round's answer deadline.

## Ownership and persistence

`server/games/engine.ts` is the deterministic game authority. `room.ts` persists
its bounded state in the existing event room's SQLite store before sending private
snapshots. Game state, deadlines and pending operation identities survive Durable
Object recreation. Generation and evaluation completions re-read persisted state
and must match their operation ID and round. A lost asynchronous task times out
safely; a late result cannot score a later round.

The World room's existing alarm handles presence and the earliest game deadline.
The browser never receives answers or future clues before they should be visible.
It cannot supply player identities, scores, source chapters, provider URLs or prompts.
Credentials remain server-side. User answers are sent to Jev as untrusted data;
player names and visitor identifiers are not included in AI requests.

## Generated content

Generation calls **Gloo Grounded** directly, using auto-routing and the shared
`GlooGrounded` publisher. A single request retrieves sources and generates the five
playable rounds according to the language, Testament, subject and difficulty.
Game instructions remain in the system message, and displayed content uses the
requested French or English language. There is no fixed chapter pool, `get_passage`
tool, Resource API fetch or local database dependency for these games.

The difficulty instructions cover both identity familiarity and clue specificity:
widely known identities and accessible clues for Discovery, less obvious subjects
and details for Intermediate, less familiar identities and subtle but fair clues
for Advanced. These are model instructions, not an independently measured rating.

The single generation response must include `sources_returned: true` with usable
citation metadata and snippets. Validate the JSON shape, five distinct answers,
four clues, choices, name leakage and canonical book/chapter ranges. The request is
not retried. An unavailable provider, missing grounding or invalid content returns to the
lobby. No silent fallback to another provider or prewritten questions.

Gloo grounding supplies retrieved context; it is not independent verification that
every generated clue follows from its cited source. Explanations are paraphrases,
not claimed verbatim Bible quotations. The reading link opens the model-proposed
reference in LSG (French) or KJV (English); the displayed reference does not claim
that Gloo retrieved that translation. Provider-supplied URLs are never fetched or
used as the public reading link. Do not log provider content, snippets or secrets.

Exact normalized answers and generated aliases are checked locally. Other player
answers still use `typesafe-ai/jev` via AI Gateway: reject instructions/multiple
guesses; accept identity probability ≥0.8 with ambiguity <0.3; ask for clarification
when ambiguity ≥0.55 or identity >0.2; otherwise mark incorrect. These are heuristics,
not certainty guarantees. Jev receives the question, clues, expected identity and
explanation; its job is identity adjudication, not re-verifying Gloo's research.
Provider errors return `unavailable`, never `wrong`.

## Bounds

- 50 retained games per event room; 4 participants per game.
- Lobby/final summary retention: 10 minutes. Absent participants: 90 seconds.
- Creation cooldown: 10 seconds. Re-invite cooldown: 60 seconds; at most 3 incoming invites.
- Generation: no per-player retry delay; at most 3 concurrent preparations and 60 starts/hour/room.
- Generation overall timeout: 55 seconds; persisted recovery deadline: 180 seconds.
- Gloo: one Grounded call per five-question batch, with a 50-second request timeout. Jev answer calls: 10 seconds, persisted expiry: 12 seconds.
- Answers: 160 characters, at most 3 submissions per participant/round in Bible challenge, or per clue in Who am I?.
- Transport: existing 40 messages/second; game commands at most 4/second/connection. Solo dialog pause/resume uses only the global transport limit, like presence updates.
- Provider response bodies: 96 KB. Content validation rejects malformed output.

These budgets bound the public guest experience; they are not account-based abuse
prevention or a production spend guarantee. Provider-side spending limits remain useful.

## Local setup

1. Set server-only `GLOO_API_KEY` and `AI_GATEWAY_API_KEY` in ignored
   `apps/world/.dev.vars` (the latter is for Jev).
2. Run **`yarn dev:world`** and open `http://localhost:5186` in independent sessions.

**Do not start `yarn dev:resources` for games.** No Resource service, PostgreSQL,
service binding or `get_passage` tool is needed. Other Bible Strong products still
use Resources; their commands and service are unchanged. Provider secrets must
never use a `VITE_` prefix. Production needs both keys on the World Worker.

## Validation

Gloo migration checked on 2026-09-22: 255 World tests pass, typecheck and production
build pass. Live generation produced five grounded rounds each for French Who am I?
and English Bible challenge. The five live Jev calibration cases also passed,
including the misspelled name, wrong identities, multiple guesses and instructions.

```sh
yarn workspace @bible-strong/world test --maxWorkers=2 --no-file-parallelism
yarn workspace @bible-strong/world build
node apps/world/scripts/test-games.mjs
# Makes real Gloo and Jev calls using the local server-only keys:
yarn exec tsx apps/world/scripts/smoke-games-ai.ts
# Only Gloo generation:
yarn exec tsx apps/world/scripts/smoke-games-ai.ts --generation-only
```

Tests exercise duel/race scoring, receipt order, stale submissions, disconnects,
persistence, overlapping pauses, generation bounds, malformed outputs, absent
sources, credential handling and the absence of any Resource/tool calls. Earlier
browser validation covered the graphical board at 390×844, draft retention,
handover, four-player blocking and a real local +4 round. No production deployment
was performed. Device testing and sustained live load are outside these checks.

## Artwork

Generated with built-in imagegen in the `bible-strong-univers-v1` style:

- [Violet deduction illustration](../public/assets/games/who.webp)
- [Gold shared-reading illustration](../public/assets/games/quiz.webp)
- [Exact prompts and reference filenames](../public/assets/games/prompts.json)

Transparent PNG masters are retained beside the 600px WebP UI exports. Violet and
gold are palette choices for these games. The AI artwork was checked for alpha,
small-size readability and consistency with the supplied Bible Strong references.

## Game feedback and mobile presentation — 2026-09-22

Game controls use a separate game-only visual layer: raised buttons, colored answer
cards, active portraits and persistent turn banners. Wrong answers, clarification,
provider errors, verification and connection pauses have distinct presentations.
Quiz submissions remain visible, with a sent-count and participant badges; answers
stay hidden until the shared reveal. The reveal displays outcome and awarded points
before the explanation. Final standings support ties and interrupted games.

The room remains authoritative. Presentation helpers never award points themselves;
even a correct losing submission in a race must not display a gain. Celebrations
run only on a question-to-reveal transition, once per game/round in the current
client session. Reopening a result does not replay the celebration. Reduced-motion
styles suppress animation. Reply drafts survive turn changes; short local submission
guards expire if an acknowledgement never arrives.

Validation: 261 World tests, including state precedence, stale-clue errors, ties,
void rounds and concurrent correct answers. Browser checks used temporary fixtures
with the real UI components for 2/3/4 participants, send/error/reveal/finale, quiz
choices, English interface strings and pauses. Verified at 390×844, 390×500 (reduced
viewport for keyboard space), and 1100×900. The temporary fixture page was removed.
These checks do not constitute a physical-device keyboard test or a new live AI
multiplayer end-to-end run. No changes to generation or game timing were made.

## Incoming invitations — 2026-09-22

Incoming invitations have their own persistent illustrated notification in the world,
separate from the play/create launcher. Clicking one opens a dedicated invitation
screen with host, game, difficulty, language, expiry, accept and decline actions.
Notifications also remain reachable while the game setup dialog is open; they do
not open a dialog or steal focus on arrival. Other World dialogs defer their display.
Multiple live invitations remain separately selectable. Local expiry filtering runs
while the game dialog is closed as well as open. Removing an invitation on the
server leaves an explicit unavailable state if its detail screen was already open.

Submission controls wait for room acknowledgement and unlock after an eight-second
network timeout. A late accept acknowledgement still routes the detail screen into
the joined lobby. Creating a competing lobby is blocked while an invitation action
is pending. No OS notification permission or notification service is needed.

Validation: real local WebSocket invitation displayed in the world, opened at
390×844, accepted into the sender’s lobby, then a second invitation invalidated
while its detail was open by closing the sender’s lobby. The recipient left the
test lobby and the test sender was disconnected. World tests and production build pass.

## Game Lab — 2026-09-22

The local gallery at `/game-lab.html` renders the same `BibleGamesView` as the live
World. `BibleGames` alone owns the multiplayer subscription, clock synchronization
and invitation acknowledgement lifecycle. The view receives plain snapshots,
controlled options, a clock and callbacks. Small input drafts and animation state
remain local to presentation components.

The lab contains 55 fixtures and six guided sequences, rendered inside an iframe
so device breakpoints and native dialogs behave independently of the gallery.
Commands operate on an isolated simulation; no multiplayer connection, Worker key,
Resource request or AI provider is used. The simulation is intentionally not a
second game authority. Use it for UI iteration, not multiplayer correctness.

Validation: all fixtures constructed for both languages and 2/3/4 players; correct,
incorrect and ambiguous answer interactions; observer consistency; invitation
acceptance, decline and expiry. Browser checks covered mobile preview, response
submission, viewpoint changes, multiple invitations and guided state transitions.
267 World tests and production build passed. The artifact check excludes the lab
entry and simulation marker from production. See the World README for controls.

## Borne et défi solo

La borne se trouve à gauche du pont nord de l’île centrale (760,359). L’action dorée
« Jouer » apparaît à moins de 105 unités sur l’île. Elle ouvre les modes Solo / Jouer
ensemble. « Ma partie » reste accessible pendant une session, et les invitations
conservent leur notification indépendante.

Solo propose un « 4 à la suite » biblique, avec 120 secondes de temps actif et les
catégories/niveaux existants. La meilleure série reste visible après une erreur ou
un passage. Le chrono s’arrête pendant les explications, vérifications, générations,
clarifications et interruptions. Fermer le panneau conserve la partie en pause ; la
reprise est possible avec la même identité jusqu’à 24 heures. Quitter le défi termine
volontairement cette session. Les questions sont préparées par cinq ; un lot suivant
peut donc demander une attente supplémentaire. Aucun service Resources nécessaire.
Le contrat Gloo du solo contient uniquement question, réponse, alias, explication et
référence biblique : ni indices ni choix multiples. Toutes les difficultés utilisent
une réponse écrite, comparée d’abord localement puis confiée à Jev si elle n’est pas exacte.

Game Lab : `http://localhost:5186/game-lab.html?state=station` puis catégorie Solo,
ou parcours « Un défi solo ». Les états solo ignorent le nombre de joueurs choisi
pour la galerie et ne connectent aucun autre avatar.

Test réel Gloo, sur une salle locale disponible :

```sh
node apps/world/scripts/test-solo.mjs
# Pour une instance Worker locale isolée :
WORLD_TEST_URL=ws://127.0.0.1:8792/parties/world-room/asi-europe node apps/world/scripts/test-solo.mjs
```

Le script vérifie génération, confidentialité des réponses, pause, reconnexion,
score et question suivante, puis quitte sa propre partie.
