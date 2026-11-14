# Entity cards context

The collectible cards of the biblical characters (ADR-0090): the published catalog and the view
each face of a card draws, and the card itself in HTML and CSS, as the public atlas shows it and
the application's Web draws it (ADR-0113). The application's iOS and Android card, drawn with
Skia, reads the same model and ports the same CSS by hand.

## Language

**Card**:
A painted character, or one of its life stages, as a collectible card. Its identity is the
entity's unique name, followed by `~stage` for a life stage.
_Avoid_: Trading card, item

**Family**:
What kind of being a card shows (God and Jesus, humans, spiritual beings, gods and idols): it sets
the palette, never a rank.
_Avoid_: Rarity, tier

**Finish**:
The foil a card wears, read from its family and its character's life stages: holo, bands,
glitter, cosmos, reverse.
_Avoid_: Effect, skin

**Face**:
The front (picture, name, sentence) or the back (original name, Strong number, facts) of a card.
_Avoid_: Side

**Light**:
Where the foil catches the light, moved by the pointer, the finger or the phone's tilt.
_Avoid_: Cursor, hover
