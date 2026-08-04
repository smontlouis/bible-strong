# BibleProject videos in the Bible viewer

Research snapshot: 2026-08-04.

## Conclusion

BibleProject videos are a strong fit for Bible Strong when treated as curated contextual resources, not as a live mirror of either YouTube channel. Book overviews and visual commentaries can be anchored precisely in the reading flow. Themes, book collections, and how-to-read videos are useful as secondary resources. Podcasts, announcements, trailers, and behind-the-scenes material should not appear inline.

The existing French and English Read Scripture plans are a useful seed corpus, but they should not become the source of truth. They contain duplicates, stale or cross-language links, broad day-level associations, and at least one incorrect French association: `Apocalypse 1-11` points to the French Jude video.

## First-party findings

- BibleProject's own introduction to its library identifies six useful editorial categories: How to Read the Bible, Themes, Book Collections, Word Studies, Overviews, and Visual Commentaries. Overviews introduce whole books, while Visual Commentaries focus on specific passages. This gives Bible Strong a sound basis for different anchor and placement rules. [BibleProject Help Center: video library categories](https://help.bibleproject.com/hc/en-us/articles/4479282424087-How-do-I-get-started-with-your-video-library)
- BibleProject explicitly permits creators to use its resources in custom applications, subject to its usage rules. It requires embedding or linking from BibleProject/YouTube rather than storing the media, keeping the resources outside a paywall, and displaying production credit. [BibleProject Help Center: app creators](https://help.bibleproject.com/hc/en-us/articles/22547623073687-I-m-building-an-app-Can-I-use-your-content-in-it)
- The full terms permit embedded streams or links in websites and mobile applications. They prohibit charging or profiting from the video content, copying or modifying it, and uploading it to another host. A prominent nearby attribution and link to BibleProject are required. Permission is revocable. [BibleProject Terms of Use](https://bibleproject.com/terms/)
- BibleProject describes localized videos as translated, re-voiced, and re-illustrated for the target language. French items should therefore be modeled as localized counterparts of works, not merely English videos with a language label. [BibleProject Help Center: localization](https://help.bibleproject.com/hc/en-us/articles/4414767668375-What-is-localization)
- YouTube supports direct iframe embeds and the IFrame Player API. Players must meet its minimum viewport requirements, and API clients must identify the embed request; current documentation also describes Android WebView media-integrity behavior and error `153` for missing client identification. [YouTube iframe API](https://developers.google.com/youtube/iframe_api_reference), [embedded player parameters](https://developers.google.com/youtube/player_parameters), [required minimum functionality](https://developers.google.com/youtube/terms/required-minimum-functionality)

## Comprehensive collection sources

No single public source exposes a complete bilingual catalog with canonical work identity, localization pairs, exact Scripture anchors, and current YouTube playback metadata. The most complete collection should therefore join several first-party sources during a repeatable generation job:

| Source | What it authoritatively provides | Stability and limitation |
|---|---|---|
| [English channel uploads](https://www.youtube.com/@bibleproject/videos) and [French channel uploads](https://www.youtube.com/@BibleProject-Fran%C3%A7ais/videos) | Exhaustive public uploads for each official channel; YouTube video ID is the playback identity. | The channel UI is not an API and must not be scraped. Use the official YouTube Data API uploads-playlist flow instead. Uploads include Shorts, podcasts, updates, trailers, and other items that should not be inserted into Bible reading. |
| [English official playlists](https://www.youtube.com/@bibleproject/playlists) and [French official playlists](https://www.youtube.com/@BibleProject-Fran%C3%A7ais/playlists) | Publisher-maintained series membership. At this snapshot the pages expose 44 English and 18 French playlists. The useful long-lived series include Overviews/Panoramas, Visual Commentaries/Commentaire visuel, Biblical Themes/Thèmes bibliques, Word Studies/Étude de mots, How to Read/Comment lire, Torah, Luke–Acts, Wisdom, Spiritual Beings, Royal Priesthood, and the Ten Commandments. | Playlists overlap, can be reordered or renamed, and are not guaranteed to contain every relevant upload. English also contains topical recommendation playlists, Shorts, podcasts, Classroom, Process, and Studio News. Treat playlist IDs as collection hints, not as canonical work IDs. |
| [BibleProject English video library](https://bibleproject.com/videos/), [all-videos index](https://bibleproject.com/videos/all/), and [collection pages](https://bibleproject.com/videos/collections/sermon-on-the-mount-visual-commentaries/) | BibleProject title, description, duration, canonical page slug, collection/series, episode order, and often an exact passage in the title or description. Individual pages such as [Matthew 5–7](https://bibleproject.com/videos/matthew-5-7-sermon-overview/) also link related guides and downloads. | These are public editorial pages, not a documented public API. Their HTML and any private page-data/network endpoints may change without notice; use them as build-time inputs with validation, never as runtime contracts. A slug is a useful BibleProject-side identity but is not documented as immutable. |
| [French resource library](https://bibleproject.com/francais/) and [French downloads catalog](https://bibleproject.com/locale/downloads/fra/) | The broadest first-party French inventory found, grouped into localized series. It includes material absent from the old reading plan and indicates which localized videos and posters exist. | It does not publish an explicit machine-readable `French work -> English work` relation. Match counterparts at generation time using series, episode order, canonical subject/passage, and human-reviewed exceptions; never assume matching titles or YouTube IDs. |
| [Bible book guides](https://bibleproject.com/guides/categories/old-testament/) and book pages such as the [Genesis guide](https://bibleproject.com/guides/book-of-genesis/) | Book structure, chapter ranges, embedded overview videos, and curated related resources. This is the strongest public source for assigning overview videos to books and major divisions. | Guides provide rich editorial context but not a complete video-to-passage export. Theme links are recommendations, not necessarily precise inline anchors. |
| BibleProject's own Bible Reader annotations | BibleProject confirms that its app links videos and podcasts from its library according to the selected chapter or verse. [BibleProject Help Center](https://help.bibleproject.com/hc/en-us/articles/4479394508183-I-have-a-Bible-question-Can-you-help) | This is potentially the highest-quality passage mapping, but no public export or API is documented. Before hand-curating hundreds of anchors, ask BibleProject whether they can provide an approved annotation/catalog export or integration feed. Do not reverse-engineer the app as a production dependency. |

For the YouTube portion, use the documented Data API rather than channel HTML: `channels.list(part=contentDetails)` returns the channel's uploads playlist, `playlistItems.list` enumerates video IDs, and `videos.list(part=snippet,contentDetails,status)` provides title, description, provider thumbnails, ISO-8601 duration, caption state, privacy state, and whether the video is embeddable. [Official uploads-playlist procedure](https://developers.google.com/youtube/v3/guides/implementation/videos), [playlist item schema](https://developers.google.com/youtube/v3/docs/playlistItems), [video schema](https://developers.google.com/youtube/v3/docs/videos)

This suggests a two-layer generation pipeline:

1. Use BibleProject pages, guides, and official playlist membership to create the durable, human-reviewed data: `workId`, language pairing, category, Scripture anchors, placement, BibleProject page URL, and provider ID.
2. Use the YouTube Data API in CI with a private API key to verify provider IDs and embeddability and to refresh presentation metadata. Do not ship a privileged API key in the app.

The safe storage baseline is deliberately narrow:

- Store the application's own work IDs, editorial categories, Scripture anchors, BibleProject source URLs, YouTube video/playlist IDs, and attribution rules in the versioned manifest. Keep a retrieval date and provenance per record.
- Do not download, bundle, edit, proxy, or re-host video or audio. BibleProject permits embedding streams or links in an app, requires free access and a prominent nearby BibleProject owner/author notice linking to its site, and can revoke permission. [BibleProject Terms, Video Content](https://bibleproject.com/terms/)
- If title, description, duration, thumbnails, status, or other fields are obtained through the YouTube Data API, treat them as YouTube API Data: limited non-authorized data must be deleted or refreshed within 30 days, current data must be displayed, and scraping YouTube is prohibited. Prefer remote YouTube thumbnail URLs over copied image files and run a full refresh/availability audit at least every 30 days. [YouTube Developer Policies, storage and scraping](https://developers.google.com/youtube/terms/developer-policies)
- Keep human editorial anchors independent of YouTube-derived data. YouTube prohibits using API Data to create derived data or metrics; passage relevance should come from BibleProject's own resource pages/guides and editorial review, not algorithmic inference from YouTube engagement or metadata.
- The inline player must remain an unmodified YouTube player, visibly attributed to YouTube, without overlays, with a viewport of at least 200x200, an identifying referrer/origin in mobile WebViews, and a Made-for-Kids lookup/configuration for every embedded video. Delaying player creation until a user taps Play also limits data shared with YouTube before interaction. [YouTube required minimum functionality](https://developers.google.com/youtube/terms/required-minimum-functionality), [YouTube Developer Policies](https://developers.google.com/youtube/terms/developer-policies)

Endpoint assessment: the YouTube Data API is the only documented structured API found and is appropriate for scheduled inventory/validation. BibleProject's public indexes, locale pages, collections, video pages, and guides are valuable build-time sources, but no supported public BibleProject catalog API was found. Any JSON or GraphQL endpoint observed behind those pages should be considered private and unstable unless BibleProject explicitly approves its use.

## Catalog snapshot

A flat extraction of the public `Videos` tabs and the subsequent official uploads-playlist inventory
on 2026-08-04 exposed:

| Channel | `Videos` tab snapshot | All public API uploads | Existing plan occurrences | Unique plan video IDs |
|---|---:|---:|---:|---:|
| [BibleProject Français](https://www.youtube.com/@BibleProject-Fran%C3%A7ais/videos) | 221 | 255 | 94 | 88 |
| [BibleProject](https://www.youtube.com/@bibleproject/videos) | 349 | 540 | 94 | 90 |

The generated research corpus is stored under `docs/research/data/bible-project/`:

- `source-snapshot.json` preserves all 795 public uploads, 63 official playlists and their memberships, and the public source metadata collected without storing any media files.
- `catalog.json` adds normalized categories, viewer suitability, references found in source metadata, related video IDs, plan occurrences, and 149 validated directional localization links from the plan seed corpus.
- `audit.json` records coverage, unresolved records, duplicate/stale plan associations, and classification totals.

The authenticated collector obtained complete metadata for all 795 public uploads: 255 French and 540 English. All 795 currently report `status.embeddable: true` and an explicit Made-for-Kids state; 310 advertise captions and nine English videos are blocked in Israel. The broader API inventory adds Shorts, announcements, older uploads, and other records not exposed by the two `Videos` tab snapshots. These are retained for completeness but placed in explicit review/exclusion categories instead of being silently treated as Bible-view recommendations.

Offline derivation currently yields 83 confirmed FR/EN pairs (74 validated plan-backed pairs plus nine Ten Commandments series matches), 18 additional high-confidence candidates, 17 medium-only candidates, and 137 French records requiring lower-confidence/manual matching. The pairing layer ignores English channel IDs embedded in French plan days and explicitly corrects the known Apocalypse 1-11/Jude collision. Anchor candidates exist for 245 videos: 55 have a precise reference in the publisher title, 141 book-overview records have a title-derived book scope, and 163 retain their plan reading context. These groups overlap and the plan context is deliberately not promoted to a semantic anchor.

The public channel count is a point-in-time operational observation, not a stable API contract. Channel output also mixes directly useful teaching videos with podcasts, studio updates, trailers, fundraising/update videos, and behind-the-scenes material. Runtime channel scraping would therefore produce noisy and unstable viewer content.

The French channel currently includes newer passage-specific material absent from the plan, including visual commentaries on Matthew 5-7, Matthew 6:1-4, the Lord's Prayer, Isaiah 61, Genesis 1, Psalms 1/8/148, Proverbs 8, and John 1. It also includes the Ten Commandments series, which can be anchored to Exodus 20 and Deuteronomy 5. These examples show that extending beyond the plans is worthwhile.

## Local audit

The two plan files contain 358 reading slices and 706 chapter slices each. A video belongs to a reading day and is indirectly associated with that day's chapter range. That association is too coarse for a Bible viewer:

- A book overview should normally anchor to a book or major book section.
- A visual commentary should anchor to its exact verse range.
- A theme can have several curated passage anchors with different relevance.
- A word study belongs naturally in lexical/Strong discovery as well as selected passages.

Known data-quality examples:

- French `Apocalypse 1-11` uses the same YouTube ID as `Jude`; the public French channel has a separate Apocalypse 1-11 panorama.
- Eight French plan entries use English Torah-series IDs rather than videos from the French channel.
- One URL contains `&t=3s`; the current plan player derives the ID by removing a fixed URL prefix and would pass the timestamp as part of the video ID.
- Repeated theme videos are intentional in the plan but must be represented as one catalog item with multiple anchors.

## Reviewed book overview manifest

The first publishable editorial subset is generated in `book-overview-manifest.json`. It contains
73 language-independent works and all 145 official book/Testament overview editions: 73 English and
72 French. Every source record is assigned exactly once. English editions completely cover the 66
canonical Protestant books; French editions cover 65, with Philippians explicitly absent rather than
falling back to English.

Twenty works anchor split book sections, four works anchor multiple books, and two Testament-wide
overviews remain library resources rather than appearing on every chapter. Per-language book indexes
contain only works with an edition in that exact language. Full-book works use `book-intro`; later
split sections use `before-range`. All anchors in this subset are reviewed from publisher titles and
official playlist membership rather than inferred from plan reading context.

## Reviewed visual commentary manifest

The second publishable subset is generated in `visual-commentary-manifest.json`. All 44 records in
the catalog category are accounted for: 43 localized editions belong to 24 reviewed passage works,
and the French “Prochainement” trailer is explicitly excluded. Nineteen works are bilingual, three
are French-only, and two are English-only. The language indexes never expose a work without an
edition in the selected route language.

The 25 reviewed primary anchors preserve exact inclusive verse ranges. One work intentionally has
two discontiguous anchors: the newer religious-practices episode treats Matthew 6:1-6 and 6:16-18.
The John commentary is limited to the prologue (John 1:1-18), and the two distinct Sermon on the
Mount series remain separate works even when they share a passage. Exact sources and the complete
44-record review table are documented in `bible-project-visual-commentary-anchors.md`.

## Recommended editorial model

Use a provider-neutral catalog record, for example:

```ts
type PassageMedia = {
  id: string
  workId: string
  provider: 'youtube'
  providerId: string
  language: 'fr' | 'en'
  title: string
  description?: string
  category:
    | 'book-overview'
    | 'visual-commentary'
    | 'theme'
    | 'book-collection'
    | 'how-to-read'
    | 'word-study'
  anchors: Array<{
    book: number
    chapterStart: number
    verseStart?: number
    chapterEnd?: number
    verseEnd?: number
    placement: 'book-intro' | 'before-range' | 'after-range' | 'chapter-resources'
    relevance: 'primary' | 'related'
  }>
  sourceUrl: string
  attributionUrl: 'https://bibleproject.com/'
}
```

`workId` pairs localized editions of the same conceptual video. Store the provider video ID separately from the source URL. Keep anchors editorial and reviewable rather than deriving them from titles at runtime.

## Product recommendation

1. Show a collapsed poster/card first; create the iframe only after a user taps Play. This limits WebView work, network requests, tracking exposure, and disruption to reading.
2. Put book overviews at the start of the first relevant chapter or major section.
3. Put visual commentaries immediately after their exact verse range.
4. Put themes and how-to-read material in a chapter-end “Pour aller plus loin” section.
5. Select editions strictly from the application or route language. Never replace a missing French edition with English, or a missing English edition with French.
6. Keep the feature available without subscription, show the required nearby BibleProject credit/link, never cache the video files, and provide a clean offline/unavailable state.
7. Reuse the Bible viewer's existing contextual-information loading path and DOM section pattern, but give videos their own display preference so users can disable them independently.

## Comprehensive implementation sequence

- Finish the entire bilingual editorial manifest before wiring the viewer: canonical works, localized counterparts, categories, source provenance, and reviewed Scripture anchors.
- Ask BibleProject for an approved export of its existing Bible Reader annotations or an integration feed; merge it without changing the catalog identity model if it becomes available.
- Validate player behavior on iOS/Android, full-screen transitions, selection gestures, parallel mode, focused context mode, and offline behavior against the complete content model.
- Schedule the existing YouTube Data API collector before each `refreshDueAt`, while keeping passage anchors and relevance human-reviewed and independent from transient provider metadata.
- Ship the complete supported catalog together rather than using a book-level pilot.

Because Bible Strong includes premium functionality, confirm the proposed presentation against BibleProject's current terms before release, particularly the prohibition on direct or indirect financial benefit from its content.
