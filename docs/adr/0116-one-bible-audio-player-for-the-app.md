# ADR-0116: One Bible audio player for the app, which the tabs start

## Status

Accepted

## Context

Since the move to expo-audio, one playlist voiced the recorded chapters for the whole app, but a
Bible Tab owned it: the Tab that started it held its controls in its footer, its book and version
filled the queue, it turned its pages with the audio, and closing it stopped the sound. Another Tab
only offered a way back to the one that played. The device's voice, for the versions with no
recording, read the verses that Tab had loaded and moved on through its chapter buttons.

So a reader could not read one passage while hearing another, the audio stopped with its Tab, and
nothing showed it outside a Bible Tab.

## Decision

- **One player, with a passage of its own.** `features/bible-audio/bibleAudioPlayer.ts` holds the
  passage heard (version, book, chapter), its status and its progress in Jotai atoms. Playing,
  pausing, the next and previous chapter, a step back or forward, the change of passage, version or
  voice and the sleep timer are its calls, whatever screen makes them. The move from book to book
  and the end of the Bible are its own.
- **Two engines behind the same calls.** `BibleAudioEngine` opens a chapter, plays, pauses, stops
  and skips. `recordedEngine` keeps the expo-audio playlist of a book, which moves on natively
  and drives the lock screen; `speechEngine` reads the text verse by verse with expo-speech and loads
  each chapter itself, online when the Bible is not installed. A version with recordings plays them,
  unless the reader chose the device's voice; a version without plays the voice. A third engine
  would change neither the calls nor the screens.
- **Small in the tab bar, large over the app.** While a passage is loaded, a row on top of the tab
  bar shows it, with play and a cross that stops it; the bar grows by its height, and every
  screen reads that height from `useBottomBarHeightInTab`. On a wide screen the row is a card at
  the bottom of the sidebar, or floats where it would be when the sidebar is hidden. The large
  player, a sheet dragged up from the row on a phone and a panel at the bottom left on a wide
  screen, holds the controls and a choice of version, book and chapter of its own. It shows no text.
- **Tabs start it and follow it loosely.** A Bible Tab's play button listens to the passage it
  shows. That Tab turns its pages with the audio until its reader goes to another passage, when it
  lets go and the audio plays on; it also lets go when the audio leaves its plan passage or its
  version. « Show the text » brings the Tab back to the passage heard, or opens one, and it follows
  again. A Bible page opened outside a Tab starts the player and follows nothing.

## Consequences

- The audio outlives the Tab it started from, and plays on while the reader reads elsewhere.
- The device's voice reads without a reader on screen, so it moves on through the Bible like the
  recordings; it still has no lock screen controls, which expo-speech does not offer.
- On Android, activating the lock screen controls a second time rebuilds the media session and stops
  the player: the recorded engine activates them once and then only updates their text.
- The footer of the Bible keeps the chapter buttons and the way into the player; the expanded footer,
  its two audio variants and the way back to the playing Tab are gone.
