# Editorial link previews

Editorial Bible, dictionary, Strong and Nave links open a shared preview before navigating. Previews are Web-only and use the existing ContextualSheet popover anchored to the clicked/focused link. iOS, iPadOS and Android retain direct navigation and their existing form sheets.
The compact header shows the reference and version on one line, with an external-link action that invokes the
original navigation callback. Closing the preview leaves the source page in place.
The passage body scrolls independently, capped at 360 points or 55% of the viewport.

SwitchableHTMLView covers commentary, dictionary, Nave and full Strong editorial
content. Strong editorial excerpts and commentary section reference buttons use the same request hook.
Concordance verses deliberately keep direct navigation to the Bible. Ordinary web
URLs retain their existing handlers.

Supported targets include bible:// OSIS, packaged /Book_chapter.verse links,
Nave v=book-chapter-verses links and legacy dictionary verse labels. Same-book
cross-chapter ranges, whole chapters and disjoint selections retain all requested
verses. Unsupported targets fall through to their existing handler.

Version priority: version on the link, version supplied by the caller, active Bible
tab, default Bible version. Chapter loading uses Resource access and React Query,
including offline copies. Loading and unavailable states retain the open action;
unavailable text can be retried. Queries are keyed by version and selection, so an
old response cannot replace a newer preview. Requests are ephemeral and never synced.

The body uses the reading font at 16px / 24px, with verse numbers only and continuous text between verses.

Dictionary word targets carry their source work, resource ID, language and title;
plain words are never classified as dictionary links without that source context.
Strong links use `strong://H…` / `strong://G…`; Nave topic links use `w=…` with a
Nave source. Resource access loads each definition using that source's language.

Links inside an open resource preview append to an ephemeral history. The same
popover stays anchored to the original link; Back restores the previous content.
Open full entry closes the preview before invoking the original navigation. Back is forwarded to the Web contextual panel header.
Resource previews use the same 16/24 compact typography and bounded scroll region.

## Bible reader entry points

The Bible DOM bridge previews individual note, study, Nave, dictionary and verse relation endpoints,
as well as inline Bible-reference navigation. The external action preserves the
original route/callback and its note context. Note content is selected live from
Redux (including annotation notes) and remains read-only in the preview.

Saved external links use the compact link card, with live Redux metadata and an explicit browser action. The preview header opens the full link screen for editing.

Tags, relation counters, existing Strong selection and
concordance navigation retain their original behavior. Reader preview selection
is deliberately scoped to the Bible DOM bridge, not the global route handler.
Inline relation links expose link semantics and Enter activation, and the Web
popover anchors to the whole relation chip, including clicks on its icon.

Both editorial and Bible-reader entry points reject preview requests outside Web. The preview host is mounted only by FullAppRuntime.web.tsx.

Study previews show a read-only text excerpt with labels for embedded objects;
the full editor remains available through the open action. Nave and dictionary
reader relations use their stored resource language where present, otherwise the
current resource language. Dictionary relations currently identify only a word,
so their preview uses the default dictionary work for that language, like the
existing full-entry route. All of these reader previews remain Web-only.
