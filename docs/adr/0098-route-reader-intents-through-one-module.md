# ADR-0098: Route reader intents through one module that owns every policy

## Status

Accepted.

## Context

The Bible reader is an Expo DOM page. It spoke to the application through a single `dispatch` prop:
54 message types named by strings, each with an untyped payload, sent from 17 files of the page and
received by a 52-case switch in `BibleDOMWrapper`. Each case read its payload again, then either acted
itself or called one of about 36 callbacks that `BibleViewer` passed down, among about 90 props. The
personal-data rule of a column (ADR-0030) was applied twice: once by a list of messages at the seam,
and once by about 20 callbacks that `BibleViewer` replaced with nothing. A reader feature touched four
to seven files, and the switch had no test. On Android, inside tabs, one page serves every Bible tab.

Three shapes were weighed on 2026-11-05:

- effects behind ports: a shell with native, web and in-memory adapters, and a Tab port of about 25
  methods. Rejected: the Tab port rebuilt the list of callbacks, and the rule of what the web shows as
  a preview left the module for an adapter;
- families declared as tables, with their handlers in hooks. Rejected: the effects went back into
  React, so testing one needed a rendered hook, and the tables needed a decoding language of their own;
- one door: a single function that decides everything. Kept.

## Decision

What the page sends is a **Reader intent** (see the glossary of `apps/expo`). The intents are one
union, `ReaderIntent`, in `apps/expo/src/features/bible/readerIntent/types.ts`. The page imports it as
types only. Each intent has a flat `kind`, and the kinds are grouped in seven families, one file each:
reading, open, select, annotate, personal sheets, resources, and the study of a verse in focus. An
intent carries identifiers and ranges, never multiline text (ADR-0004).

To open a study object, the page sends one `open` intent. It carries a Relation endpoint whenever one
describes the object, and the place the reader touched. Objects without an endpoint keep a target of
their own. The page no longer splits a Relation into several messages, and no longer chooses between
the Strong sheet and the Strong page: the module decides from where the intent came.

`handleReaderIntent(message, reader, world)` is the only way in:

- it decodes the message once;
- it refuses an intent sent for another Tab. The page stamps each intent with its `tabId`, the one
  data prop this decision adds to the page, and this settles the page that Android shares between tabs;
- it applies the personal-data rule and the rules of the modes (focus, annotation mode, form sheet)
  before any effect;
- it writes the Tab through the Jotai store with the recipes of `tabs.ts`, opens the sheets that only
  `BibleViewer` holds through `reader.surface`, and reaches everything else through `world`:
  navigation, external addresses, confirmations, toasts and haptics, the Offline-copy queue, the query
  cache;
- the platform is a field of `world`. The difference between the web, which shows a preview, and the
  native application, which opens a page, stays a rule of the module, and both paths run in tests;
- it never throws, and returns an outcome to the page: done, refused with the rule that refused it,
  rejected, or failed.

The signals of the page itself (mounted, overlay open, toast) are a separate small union,
`ReaderPageSignal`, outside the module. What the application sends to the page (its data props and
the four trigger counters) does not change.

The rule of the Selected verses is not part of this decision. It will become the handler of the select
family, and may use the outcome returned to the page.

## Consequences

- A new reader intent touches its type, its family file, the place of the page that sends it and its
  test. No constant, no case in the wrapper, no callback prop and no line in `BibleViewer`.
- Tests go through `handleReaderIntent` only, with a world that records its effects, a Jotai store
  created for the test and a recording surface. They replace the tests of the old decoders.
- `dispatch.ts`, `DispatchProvider`, the payload readers, the list of personal-data messages,
  `relationDisplayActions.ts` and the switch go away. The props of the wrapper drop from about 90 to
  about 50.
- `reader.surface` passes requests through to the sheets of `BibleViewer` as long as those sheets live
  in its local state.
- The migration goes family by family. Until the last family has moved, the intents not yet migrated
  still go through `dispatch`.
