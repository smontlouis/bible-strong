# Exploration World Context

The Exploration World is a standalone, illustrated Bible Strong experience. Visitors move an Avatar through six places that introduce the product's study-resource families.

## Language

**Exploration world**:
The navigable illustrated environment that presents Bible Strong resources.
_Avoid_: Game, competition

**Place**:
One destination in the Exploration world associated with a study-resource family.
_Avoid_: Level

**Navigation document**:
The versioned collection of allowed ground and blocked object footprints used by movement.
_Avoid_: Tilemap

**Occluder**:
A source-aligned foreground cutout that lets an Avatar pass visually behind part of the illustration.
_Avoid_: Collision zone

**Avatar**:
The visitor's visual companion and controllable character in the Exploration world.
_Avoid_: Player unit

**Guestbook**:
The shared collection of public visitor notes, opened from the Community board.

**Community board**:
The wooden post-it board on the northeast side of the central plaza, where visitors read and leave notes.

**Signature**:
A visitor's note and chosen public name, published after automatic admission.

**Bible game**:
An optional biblical discovery activity, played solo or shared between nearby visitors.

**Lobby**:
The group of invited visitors preparing to play one Bible game.

**Round**:
One shared question or identity to discover, followed by its answer and biblical source.

**Game terminal**:
The illustrated meeting point on the central island that opens solo and shared games.

**Solo streak**:
Consecutive correct answers in the solo biblical challenge, aiming for four.

**Game catalogue**:
The shared bilingual collection of biblical questions and identities available to Bible games.

**Question history**:
The record of questions offered to an anonymous visitor, used to prioritize unfamiliar questions.

**Ambient avatar**:
A local companion that wanders the central island and responds to nearby emojis
in the Exploration world, without being a connected visitor or a Bible game participant.

**Stand display**:
The World opened with the `stand` URL parameter for an event screen.

**Stand scan**:
A phone opening a stand's QR code, counted on the way to its place; a person counts once a day.
_Avoid_: Visit, hit

**Universe**:
A separate explorable map on the same engine, opened by its own address. The archipelago is the default universe; Valence 1876 is the second.
_Avoid_: Level, mode

**Portal**:
A place on a world's map that leads to another world: the stone arch on the central plaza, east of the Bible, leads to Valence 1876, and the train at Valence's station leads back.
_Avoid_: Door, teleporter

**Journey**:
Going from one world to another through a portal, without leaving the page; the traveller keeps their avatar and arrives at the destination's portal.

**Valence 1876**:
The sepia universe at `/valence-1876` that retraces Daniel Bourdeau's eleven months in Valence, from October 1876 to September 1877.

**Station**:
One dated place of Valence 1876 where townsfolk tell what happened, how they studied, and what Bible Strong offers today.
_Avoid_: Place (reserved for the archipelago's resource islands)

**Thread**:
The route linking the stations of Valence 1876 in the order of their dates; it is no longer drawn on the ground, the timeline shows the order.

**Pioneer object**:
One of seven study objects of 1877 hidden in Valence 1876; finding it opens a "yesterday, today" card.

**Composite character**:
An invented townsperson of Valence 1876 who carries daily life and emotion; real people only say what the sources allow. Visitors are not told which is which.

**Mood**:
The expression a speaker wears for one spoken line of a station (neutral, happy, thinking, surprised or grave), shown by their bust in the dialogue scene.
_Avoid_: Emotion, emote (reserved for visitors' reactions)

**Workshop**:
The development-only editor of Valence 1876 (access zones, landmarks and thread, water and effects, shorelines, ambient zones), saving straight into the project files.
_Avoid_: Debug mode

