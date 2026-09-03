# Mobile study workspace context

## Glossary

**Bible version** — A translation or source text identified by a stable code, such as `LSG`, `KJV`, `BHS`, or `SBLGNT`.

**Bible resource kind** — The nature of a Bible version: translation, original-language text, or interlinear resource.

**Verse key** — The canonical identifier of one verse, independent of how that verse is displayed.

**Selected verses** — The current verse selection on which the reader can perform study actions.

**Highlight** — A verse-level visual mark owned by the user.

**Word annotation** — A user-owned visual or semantic mark attached to a word or word range.

**Note** — User-authored text that can stand alone or be connected to other study objects.

**Annotation note** — A Note that belongs to one Word annotation and follows its lifecycle.

**Tag** — A reusable user-owned label for organizing study objects.

**Bookmark** — A named marker for one Bible location.

**Relation** — A typed connection between two openable study objects.

**Relation endpoint** — An openable study object that can participate in a Relation, such as a verse, Note, Study, Strong entry, or external link.

**Study** — A rich-text document authored by the user and connected to their wider study material.

**Reading plan** — An ordered program of Bible readings, meditations, media, or teaching units.

**Plan slice** — One reading or teaching unit inside a Reading plan.

**Strong entry** — A Hebrew or Greek lexical entry identified by a Strong number.

**Strong verse context** — The passage, selected surface word, and optional morphology carried when a Strong entry is opened from Bible reading.

**Interlinear** — An original-language Bible presentation aligned with lexical, grammatical, or translated information.

**Nave topic** — A topical Bible entry from Nave's Topical Bible.

**Resource identity** — The durable identifier of one independently distributable editorial resource.

**Resource revision** — The immutable content-derived identifier of one published edition of a Resource identity.

**Offline copy** — Complete resource content deliberately installed on the device for use without a network connection.

**Query cache** — Temporary reuse of resource query results; it is not an Offline copy.

**Resource availability** — The user-relevant state of a resource across independent online-access and Offline-copy dimensions.

**Tab** — One open working surface in the mobile study workspace.

**Tab group** — A persisted collection of Tabs with one active Tab.

**Recently viewed content** — A device-local, bounded list of successfully opened Bible passages and editorial-resource entries. It is independent from Tab persistence and from the Expo Router back stack, and is cleared when the current account session ends.

**Guest session** — A period without an authenticated account in which locally created study data belongs to the device user.

**Guest adoption** — The one-time assignment of eligible Guest-session data to a genuinely new account before account hydration.

## Avoid

- Use **Offline copy**, not “offline cache”, for a deliberately installed complete resource.
- Use **Strong entry**, not “Strong word”, when referring to the lexical object.
- Use **Relation endpoint**, not “relation item” or “linkable thing”.
- Use **Bible version** for a readable Bible source; reserve **Resource identity** for publication and delivery lifecycle discussions.

Detailed product invariants and implementation references live in `../../docs/mobile-domain-reference.md`.
