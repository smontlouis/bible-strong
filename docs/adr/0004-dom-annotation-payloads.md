# WebView payloads must treat multiline text as fragile

## Status

Accepted

## Context

The Bible reader uses Expo DOM/WebView as a boundary between React Native state and DOM-rendered
Bible content. Text containing raw line breaks has proven fragile at that boundary: it can survive
normal React Native state and persistence, but still break or stall DOM/WebView mounting when passed
as part of a large prop payload.

This is not a general reason to remove line breaks from app data. Notes and studies are authored
user content, so their line breaks are meaningful and must be preserved. If notes/studies lose or
mis-handle newlines, fix the serialization/encoding at the boundary that transports that user
content.

Word annotations are different. They persist a `ranges[].text` snapshot for list previews and
user-facing screens. This text can contain line breaks and other formatting from the source Bible
version, but it is derived cache data, not the source of truth for DOM highlight rendering.

The Bible DOM reader does not need that text to render annotation highlights. It recalculates
highlight rectangles from the canonical range coordinates:

- `version`
- `verseKey`
- `startWordIndex`
- `endWordIndex`
- `color`
- `type`

A bug on NBS Genesis 16 confirmed this failure mode: multi-line `ranges[].text` in the word
annotation payload prevented the DOM reader from mounting, while the same chapter rendered once that
derived text was omitted from the WebView payload.

## Decision

When passing word annotations to the Bible DOM reader, strip the derived selected text from each
range. Keep the persisted annotation unchanged, and keep `ranges[].text` available for native/list
UI that displays annotation previews.

For WebView/Expo DOM payloads, only pass multiline text when the DOM actually needs that exact text.
When it does, add explicit tests for newline transport. When it does not, prefer passing canonical
identifiers/ranges and deriving display text on the receiving side.

## Consequences

The DOM payload is smaller and less fragile because it only carries the range data required for
rendering. Multi-line selected text cannot break DOM mounting for a chapter.

Any future DOM feature that needs selected annotation text must derive it from the verse text and
range coordinates inside the DOM reader, or explicitly introduce a new serialized field with tests
covering line breaks.
