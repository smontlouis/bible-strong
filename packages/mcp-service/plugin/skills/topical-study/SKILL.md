---
name: topical-study
description: Gather what the Bible says on a subject with Bible Strong, from the topical Bible, a search by meaning and the dictionaries. Use when the user asks what the Bible says about a subject (forgiveness, anxiety, money, prayer), asks for verses on a theme or "versets sur", or asks for an "étude thématique" or a topical study.
---

# Topical study

Use this skill to gather the passages of the Bible on a subject and to order them, from the
resources and not from memory.

## What you need first

The subject, in a few words. If it is very broad ("love"), keep it broad for the first
search and narrow it with the user from what the topic holds.

If the user wrote in French, pass `language: "fr"` to every tool; otherwise `"en"`.

## Steps

1. **Find the topic.** Call `search_bible_topics` with the main word of the subject. Nave's
   Topical Bible files the passages of the Bible under topics and their sub-topics.
2. **Show the topic.** Call `show_bible_topic` on the topic that fits: it shows the topic as
   a card and returns its outline, the sub-topics and the passages under each. It is the one
   card of the study; every other step reads without showing.
3. **Search by meaning.** Call `search_bible` with `mode: "meaning"` and the subject written
   as a plain sentence. It finds verses that speak of the subject without its words. Use it
   too when no topic fits.
4. **Read the passages you keep.** Call `read_passage` on each passage you will quote, so
   that its wording and its context are exact. Eight to twelve passages make a study; a
   topic may list hundreds.
5. **Add the notion**, when the subject is one a dictionary defines: `get_dictionary_entry`.

## What to give the user

Write the study in the language of the user:

1. **The subject in two or three sentences**: what the passages say together.
2. **The passages, ordered by what they say**, not by their place in the Bible: three to five
   headings, each with its passages quoted exactly, with reference and version.
3. **What holds them together**, and where passages pull in different directions, say so
   instead of smoothing it over.
4. **Where to read more**: the topic by its name, and the passages left out.

## What not to do

- Do not quote a verse from memory. Every verse quoted comes from a tool, with its reference
  and its version.
- Do not quote a verse against its context. When a verse only fits the subject once cut from
  its passage, leave it out.
- Do not turn the study into advice on a medical, legal or financial decision. Say what the
  passages say, and that such a decision needs someone qualified.
- Do not present a list of verses as the position of a church. The topical Bible gathers
  passages; it does not interpret them.
- When neither the topics nor the search find anything, say so and offer a nearby subject.
