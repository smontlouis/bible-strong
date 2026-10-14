---
name: passage-study
description: Study a Bible verse or passage in depth with Bible Strong, from its text to its original words, cross-references and commentaries. Use when the user asks to study, explain or understand a verse or a passage, asks for an "étude de passage" or an exegesis, or prepares a lesson, a sermon or a group study on a passage.
---

# Passage study

Use this skill to walk through a passage from the text outward: what it says, what its words
mean, what the rest of Scripture says beside it, and how it has been read.

## What you need first

The passage. If the user named none, ask for it. If the passage is longer than a chapter,
study it one section at a time and say so.

If the user wrote in French, pass `language: "fr"` to every tool; otherwise `"en"`. Read the
passage in the version the user named; without one, the tools choose the usual version of the
language.

## Steps

Do the steps in order. Stop early when the user asked a narrow question.

1. **Read the text.** Call `show_passage` so that the user has the passage in front of them.
   For a comparison, pass two to four `versions`: differences between translations show
   where the original is hard to render.
2. **Read the context.** When the passage is a few verses, call `read_passage` on its chapter
   to see what comes before and after. `list_chapter_people_and_places` names who is who.
3. **Read the key words.** Call `get_verse_words` on the one or two verses that carry the
   passage. For each word the meaning turns on, call `get_strong_entry`. Two or three words
   are enough; do not look up every word.
4. **Let Scripture explain Scripture.** Call `get_cross_references` on the main verse and
   keep the references that shed light on it.
5. **Read how it has been understood.** Call `get_commentaries` on the main verse. Report
   what the commentaries say and name each author. Where they differ, say so.
6. **Place it in time**, when the passage tells an event: `search_timeline`.

## What to give the user

Write the study in the language of the user:

1. **The passage in one sentence**: what it says, in plain words.
2. **Context**: who speaks, to whom, and what surrounds the passage.
3. **Key words**: each with its original spelling, transliteration, Strong number and what it
   adds to the reading.
4. **Other passages**: the cross-references that matter, each quoted with its reference.
5. **Readings**: what the commentaries say, each under the name of its author.
6. **Questions to go further**: two or three, for a personal or a group study.

Quote the Bible exactly as the tools returned it, with reference and version.

## What not to do

- Do not quote a verse, a definition or a commentary that a tool did not return.
- Do not present one commentary as the meaning of the passage. The commentaries belong to
  different traditions; name the author and let the user weigh them.
- Do not settle a question on which churches differ. Lay out the readings and what each
  rests on in the text.
- Do not repeat what a card already shows; comment on it.
- When a tool finds nothing for a step, skip the step and say what was not found.
