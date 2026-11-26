# ADR-0118: Serve the daily readings as files on the media host

## Status

Accepted

## Context

The verse of the day was a list of 366 references in the application (`bible-vod.json`), read in
the reader's Bible version. It became a daily meditation written for Bible Strong: 1,051 meditations
in French on the Louis Segond and in English on the BSB (a verse, a hook, two parts with a Strong
word, a prayer, two or three open questions), a calendar of 366 days and a reserve that « Changer de
verset » draws from. The 19 meditation books of Firestore `plans` (about 6,940 days) are read the
same way, card after card over a painted scene; their days had paragraphs glued together and no
place to keep where a card ends.

A verse meditation file weighs about 2 MB (600 KB compressed), a book about 1 MB. A reader reads one
day at a time and never searches them. The Resource service, with its revisions, its Neon import and
its Offline copies, is built for large resources read piecewise or searched; Firestore bills each
document a reader downloads.

## Decision

- **One file per collection**, the same format for the verse meditations and for the books
  (`apps/resource-studio/workflows/daily-readings/README.md`): a calendar `MM-DD` → entry, and
  entries made of typed cards. A book's day is the author's text cut between sentences, with only
  glued paragraphs repaired, and keeps its Firestore reading id.
- **On the public media host**, as the portraits (ADR-0089) and the paintings (ADR-0096):
  `daily-readings/<collection>/<hash>.json` and `daily-scenes/<scene>/<hash>/…webp` are immutable
  and cached for a year; `daily-readings/catalog.json`, cached an hour, names the current hash of
  each collection and scene. No Neon table, no API route, no Resource revision.
- **The application keeps the files.** It reads the catalog once per launch, downloads the file of a
  collection it shows when its hash differs from the copy it keeps, checks the bytes against that
  hash before replacing the copy, and reads only its copy. No download manager: a file is small, and
  every day reads offline once its file is there. The Web keeps no copy of its own and relies on the
  browser's cache of the immutable addresses.
- **Firestore keeps what it had**: the list of books, their covers, their premium flag, and the
  reader's progress and choice. The page of a book still reads Firestore; the stories read the file.
- **The verse meditation shows its own text**, in the version it is written on (LSG, BSB), on the
  home card as in the stories: its Strong word and its questions quote that text.
- **Resource Studio builds and publishes** (`yarn resources:daily-readings:*`): the sources stay in
  the authoring workspace, the outputs in `outputs/daily-readings/`, and `upload` puts the catalog
  last, once every file answers at its address.

## Consequences

- A correction reaches readers at their next launch, without a release or an update.
- The text of a book exists twice, in Firestore and in its file, until the plans read the files too;
  `source.sha256` of each day tells when Firestore has changed under a file.
- Public pages for the meditations, or a search in them, would need them imported into the Resource
  service; the files can be imported as they are.
- Supersedes `bible-vod.json` for the home card and `/daily-verse`; the standalone verse stays as the
  fallback when no file is on the device.
