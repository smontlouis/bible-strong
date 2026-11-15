# ADR-0114: Ask a question about the chapter before a card

## Status

Proposed, parked (2026-11-15). The owner wants the idea kept, not built yet. Nothing in the
application or the card catalog carries it. Take it up again with the pilot under « Next step ».

## Context

The collectible cards of ADR-0090 exist to encourage reading the Bible. Since its amendment of
2026-11-14, a painted character whose card the reader lacks wears a gold dot in the chapter's
grid « Dans ce chapitre », and the card is collected from the character's page with « Récupérer ».
The dot rewards reaching the end of a chapter, not reading it: a reader can jump from chapter to
chapter and gather cards.

The owner asked for a small friction that sends the reader back to the text without turning the
application into an exam.

Counted on 2026-11-15 from the entity publication (`EntityRefs`), the card catalog and the
portrait catalog's life stages, God's cards left out:

| What | Count |
|---|---|
| Cards that can be offered | 354, each in at least one chapter |
| Card × chapter pairs (every chapter whose grid shows the character) | 4,858, in 1,063 chapters |
| Pairs where the character is named at least twice | 2,639, covering 300 cards |
| Cards offered in a single chapter | 63 |
| Chapters per card, largest | Israel 615, Judah 339, Jesus 211, David 202, Moses 201 |

## Decision (proposed)

### One question, and the card is revealed

Tapping a dotted avatar opens the character's page with the card overlay as today, but the card
waits face down behind a question about this chapter. A right answer turns it over, and
« Récupérer » collects it as decided in ADR-0090.

- **Three choices**, never free text: typing is painful on a phone and would depend on the
  version of the Bible. The application shuffles them.
- **About this character in this chapter**, answered in a second by someone who read it and not
  guessed by someone who did not.
- **A wrong answer does not punish.** No score, no count of mistakes, no red. The overlay says to
  read the passage again, links to the verse that holds the answer, and lets the reader try again.
  The verse is given only after a wrong answer: given before, it would test searching, not reading.
- **God's cards** stay held from the start, without a question.
- **The tone is a riddle, not a test** (« Pour révéler la carte : … »): a reader in prayer or a
  reader unsure of themselves must not feel examined. The setting « Collection de cartes » still
  turns the whole thing off.

### Every chapter that shows the character

The rule stays the one the reader sees: **when the grid shows a character whose card the reader
lacks, the card can be won here.** A character shown without a dot in one chapter and with one in
another would look arbitrary. So every one of the 4,858 pairs gets a question, passing mentions
included: the question is about how the character appears in that chapter, however briefly.

A card is won once. Being offered in forty chapters means forty places to meet it, not forty
questions: a reader answers at most one question per card.

### How the questions are made

- **By chapter, not by card.** A local agent reads a chapter once and writes the question of each
  painted character in it, in French and in English, with the right answer, two distractors and
  the verse. About 4,900 questions per language, from 1,063 chapters.
- **Checked by a second, independent agent** against the text in at least two versions. It
  refuses a question whose answer is not plainly in the chapter, whose distractor is true or
  half-true anywhere in it, whose right answer stands out by its form, or whose wording follows one
  translation's vocabulary. The owner reads samples, above all of brief mentions.
- **A fallback built from the data** where no good question exists: « Lequel de ces personnages
  apparaît aussi dans ce chapitre ? », a real neighbour of the chapter against two characters of
  the same era who are absent. No avatar is ever left without its dot.
- **Delivered with the card catalog**, so it works offline and is corrected by republishing the
  catalog, without an application update.

### Examples

From a draft of ten, checked against NEG79 and S21:

- Genèse 22, Isaac: « Pendant la montée vers la montagne, que porte Isaac ? » Le bois de
  l'holocauste · Le couteau · Un agneau (v. 6).
- Juges 7, Gédéon: « Comment l'Éternel choisit-il les trois cents hommes de Gédéon ? » À leur
  façon de boire l'eau · Par un tirage au sort · Selon leur tribu (v. 5–7).
- Luc 19, Zachée: « Pourquoi Zachée monte-t-il sur un sycomore ? » Pour voir Jésus, car il est de
  petite taille · Pour se cacher de la foule · Pour appeler Jésus par-dessus la foule (v. 3–4).
- A brief mention, 1 Chroniques 1, Abraham: « Quels fils d'Abraham sont nommés dans ce
  chapitre ? » (v. 28).

The checker sent back four of the ten: a verb that misread the story (the servant does not
« recognise » Rebekah, he understands God chose her), a wording taken from one version (« la face
de l'Éternel »), a half-true distractor, and a right answer whose form differed from the
distractors.

## Alternatives set aside

- **A few key chapters per card** (3 to 5, about 900 to 1,300 questions). Too few: a reader of
  Genesis 12 to 25 would meet Abraham's avatar without a dot in most of his own story. Key
  chapters cannot come from counting mentions either: Moses's most-mentioning chapter is
  Leviticus 8.
- **No card where the character is only mentioned.** Breaks the rule the reader sees: the avatar
  would be there without its dot.
- **Giving the verse with the question.** Proves searching, not reading.

## Consequences

- The overlay gains a face-down state and a question step; the card catalog gains the questions
  by chapter and character, in both languages, and grows accordingly.
- Making and checking about 9,800 questions is several hours of local agents and some reading by
  the owner; a later change of the entity publication (a character added to chapters) needs new
  questions for the new pairs, the fallback covering them meanwhile.
- A wrong or ambiguous question is worse than none: the checking pass is not optional.

## Before building

- **Israel and Jacob.** Israel is offered in 615 chapters, which suggests that « Israël » the
  people is linked to Jacob in the entity publication. If so, Jacob's avatar already shows in
  chapters where he is absent, and a question would expose it. Correct the link first.
- **Next step: a pilot** on three chapters of different kinds (Genesis 22, a story; 1 Chronicles
  1, a genealogy; Romans 4, a theological reference): every painted character of each, questions
  written and checked, to see whether questions on brief mentions hold up.
