---
name: word-study
description: Study a Hebrew or Greek word of the Bible with Bible Strong, from a verse, a Strong number or the word itself. Use when the user asks what a word means in the original language, asks for a word study or "étude de mot", names a Strong number (H430, G26), or asks how a word is used across the Bible.
---

# Word study

Use this skill to explain a word of the original text of the Bible from the lexicon and from
the verses that hold it, never from memory.

## What you need first

A word study starts from one of three things. Find which one the user gave.

- **A verse and a word of it** ("what does *love* mean in John 3:16?"). Call
  `get_verse_words` on the verse, find the Hebrew or Greek word whose meaning matches the
  word asked about, and take its `strong` number.
- **A Strong number** ("G26", "H430"). Use it as given.
- **A word alone** ("agape", "the Hebrew word for peace"). Call `search_strong_lexicon`.
  When several entries match, say which ones exist and study the one that fits the request;
  ask the user only when the entries are different words and nothing tells them apart.

If the user wrote in French, pass `language: "fr"` to every tool; otherwise `"en"`.

## Steps

1. **Show the entry.** Call `show_strong_entry` with the Strong number: it shows the entry
   as a card and returns its content. It is the one card of the study; every other step
   reads without showing.
2. **Read how it is used.** Call `find_strong_occurrences` with the same number. The answer
   gives the number of verses, the books where the word is most frequent, the words a Bible
   translates it by and a first set of verses. Ask for more verses with `cursor`, or for one
   book with `book`, when the study needs it. Ten to twenty verses are enough for most words.
3. **Read the verse in its context**, when the study started from a verse: `read_passage` on
   the verses around it.
4. **Add background only when it helps**: `get_dictionary_entry` for the notion behind the
   word, `get_commentaries` for how the verse has been read.

## What to give the user

Write the study in the language of the user, in this order:

1. The word: its original spelling, its transliteration, its Strong number, and its short
   meaning.
2. What the lexicon says, in your own words, shorter than the entry.
3. How the Bible uses it: the main senses, each with one or two verses quoted exactly as the
   tool returned them, with reference and version. Say how many verses hold the word and how
   it is translated.
4. What this brings to the verse the user asked about, when there was one.

## What not to do

- Do not give a Strong number, a definition, a transliteration or a verse that a tool did
  not return. When a tool finds nothing, say so.
- Do not present one sense as the only one when the lexicon lists several.
- Do not build a doctrine on the root or the etymology of a word: the meaning of a word is
  the one its sentences give it. Say when a conclusion is yours and not the lexicon's.
- Do not repeat in your answer what a card already shows; comment on it.
- A suffix after a Strong number (`H1254A`) names one sense of the word. Keep it as it was
  returned, with its letter case.
