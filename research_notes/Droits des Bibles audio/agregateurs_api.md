# Aggregators, platforms and APIs for obtaining many audio Bibles at once (state: November 2026)

> **Method caveat (read first).** This research session ran in a sandbox whose network policy blocked direct access to every primary site (faithcomesbyhearing.com, 4.dbt.io, api.bible, developers.youversion.com, open.bible, thedigitalbiblelibrary.org, find.bible, etc.). Only web search and raw.githubusercontent.com were reachable. Consequently: (1) every "quote" below is text returned by the search engine from the cited page, not a full-page reading — clause numbering and exact wording must be re-read on the live page before relying on it; (2) the per-fileset French/English listing from the Bible Brain API could NOT be retrieved (it needs an API key and a call to 4.dbt.io); (3) items I could not confirm are explicitly marked **UNVERIFIED** or moved to Gaps. No contact address or term has been invented; where no email was found, that is stated.

## 1. Faith Comes By Hearing (FCBH): Bible Brain / Digital Bible Platform v4 / Bible.is

### Takeaway
Bible Brain (API at 4.dbt.io, free API key, no licence fee) is the single largest legal source of audio Bibles for a third-party app and the obvious first route for Bible Strong: streaming inside the app tied to the key is licensed, offline download is allowed only for filesets the API itself flags as downloadable, and nothing in the licence allows taking the audio out of the app (so no Audible). Which French/English filesets a given key actually sees is decided per copyright holder and must be read from the API after obtaining a key.

### Cited Findings
- The API licence is "a binding contract between you ('you' or 'your') and Hosanna, d/b/a Faith Comes By Hearing, a New Mexico nonprofit corporation." — [Bible Brain – License](https://www.faithcomesbyhearing.com/bible-brain/license) (as reported in search results; a mirror exists at [faithcomesbyhearing.asia](https://www.faithcomesbyhearing.asia/bible-brain/license))
- The licence is a limited, revocable, non-transferable licence tied to an API key, for building an application that lets end users reach Bible Brain content; "no license fees or other payments will be due under this Agreement in exchange for the license granted by us to you for the API"; access can be ended at any time and the agreement terminates automatically on breach. Gospel Films and LUMO films are covered by separate terms. — [Bible Brain – License](https://www.faithcomesbyhearing.com/bible-brain/license)
- Offline/download rule: the licence "allows for certain content to be downloaded for offline personal use within the application if the content is specifically marked as permitted for download within the API" (the .asia copy adds "by FCBH"). — [Bible Brain – Core Concepts](https://www.faithcomesbyhearing.com/bible-brain/core-concepts)
- Content confinement rule: "the content must remain within the application; the license allows the content to only be consumed by the application associated with the API Key." — [Bible Brain – Core Concepts](https://www.faithcomesbyhearing.com/bible-brain/core-concepts)
- No content may be downloaded or made available offline other than content the API marks as permitted for offline use within the application. — [Bible Brain – License](https://www.faithcomesbyhearing.com/bible-brain/license)
- A separate consumer-facing "Terms & Conditions" page exists; it states that rights granted are "expressly conditioned upon, and subject to, any use restrictions set forth in such third party terms and conditions" (i.e. the upstream copyright holders'), and it names digitalbibleplatform.com/license as the controlling document for developers. — [Bible Brain – Terms & Conditions](https://www.faithcomesbyhearing.com/bible-brain/terms-conditions)
- API key request form: `https://4.dbt.io/api_key/request` ("Request a free API key"). Keys are personal; the developer "remain[s] responsible for following the licence of every Bible version you display" and for "confirming that your use (displaying, streaming, downloading, sharing) is allowed for each Bible version you use." — [bible-brain-toolkit README](https://raw.githubusercontent.com/shalomdesigns2dio/bible-brain-toolkit/main/README.md); [bible-brain-toolkit NOTICE](https://raw.githubusercontent.com/shalomdesigns2dio/bible-brain-toolkit/main/NOTICE.md) (unofficial community project, not FCBH)
- A `/download/list` endpoint (API key required) enumerates the filesets a key may cache/download inside the app; a third-party review summarises it as "Only the filesets Faith Comes By Hearing marks as downloadable." Developer projects report that Bible Brain "licenses downloads per fileset, not per key." — [learnofchrist.com review of Bible Brain API](https://learnofchrist.com/resources/bible-brain-api) (secondary); [verse-mate-mobile PR #376](https://github.com/verse-mate/verse-mate-mobile/pull/376) (developer notes, secondary)
- Attribution: developer projects implementing Bible Brain state that copyright information must remain visible and that a copyright component was added because it is "required by licence term 3". Exact clause wording not confirmed. — [verse-mate-mobile PR #376](https://github.com/verse-mate/verse-mate-mobile/pull/376); [johannes-personal/bible-app PR #16](https://github.com/johannes-personal/bible-app/pull/16) (secondary)
- Restricted content: a third-party review says the developer docs describe content as "either fully available to all, or via a restricted API key" and invite developers to contact FCBH for content not exposed to all. An old GitHub issue (earlier API generation) shows the refusal message "The Fileset exists, but no Permissions were found for your current key". The same review says availability can depend on the caller's geolocated IP. — [learnofchrist.com](https://learnofchrist.com/resources/bible-brain-api) (secondary); [digitalbiblesociety/dbp issue #9](https://github.com/digitalbiblesociety/dbp/issues/9)
- SIL's Scripture App Builder community advises asking FCBH directly: "you can ask them to expedite it being added to the Bible Brain and issue you a file set ID and API key." — [SIL Scripture Software Community thread](https://community.scripture.software.sil.org/t/audio-files-from-fcbh-bible-brain/3292)
- Fileset ID convention: the first three letters are the language, the next three the version (together the six-character BibleId), then collection (N/O), a drama-type digit ("1" = non-drama, usually multi-voice without background music; "2" = drama, multi-voice with background music) and a format code; e.g. `ENGESVN2DA` = English, ESV, New Testament, drama, mp3 at constant 64 kbps. FCBH warns that some filesets do not follow the convention and that "client decoding of filesetId is not necessary and is explicitly discouraged" — read type from API metadata (e.g. the toolkit passes `--type audio_drama`). — [Bible Brain – Core Concepts](https://www.faithcomesbyhearing.com/bible-brain/core-concepts); [bible-brain-toolkit README](https://raw.githubusercontent.com/shalomdesigns2dio/bible-brain-toolkit/main/README.md)
- Evidence that English KJV non-drama NT audio exists as `ENGKJVN1DA` (file name `B01___01_Matthew_____ENGKJVN1DA.mp3` cited in a forum example). — [SIL Scripture Software Community thread](https://community.scripture.software.sil.org/t/audio-files-from-fcbh-bible-brain/3292)
- French audio associated with FCBH (seen on third-party listings, NOT confirmed as filesets open to a new key): Louis Segond 1910 with a "Trésorsonore" recording (FCBH's own LSG app says the audio is "used with permission"); "La Bible du Semeur (Faith Comes By Hearing)"; "The New Testament – French (Parole de Vie – African)" and "(Parole de Vie – Canadian)". — [Ma Bible – Louis Segond 1910, App Store](https://apps.apple.com/ci/app/ma-bible-louis-segond-1910/id6469347990?l=en-GB); [GRN French language page](https://globalrecordings.net/en/language/fra)
- A third-party site built on Bible Brain (DBP v4) lists for French: Nouvelle Louis Segond 1978 (Colombe), Darby 1885, Louis Segond 1910 and Ostervald, with audio on some (the page is internally inconsistent about how many). — [The Historic Faith – French Audio Bible](https://thehistoricfaith.com/audio-bible/language/french)
- Scale (sources conflict): the official Bible Brain page says text in 1,477 languages; Wikipedia says FCBH provides audio Bibles in 1,996 languages; FCBH's YouVersion profile says "over 2,000 languages"; faith.tools claims 2,695 languages for Bible Brain and "2,200+" for Bible.is. — [faithcomesbyhearing.com/audio-bible-resources/bible-brain](https://faithcomesbyhearing.com/audio-bible-resources/bible-brain); [Wikipedia – Faith Comes By Hearing](https://en.wikipedia.org/wiki/Faith_Comes_By_Hearing); [FCBH on bible.com](https://bible.com/organizations/05b6b472-7bf6-453f-8d52-b010c54a896b); [faith.tools](https://faith.tools/app/153-bible-brain-api)
- The server code of the platform is public on GitHub (`faithcomesbyhearing/dbp`), with activity in 2026 including a "Public API Release". — [faithcomesbyhearing/dbp PR #1168](https://github.com/faithcomesbyhearing/dbp/pull/1168)
- A third-party review notes that FCBH's public pages do not spell out commercial terms. — [learnofchrist.com](https://learnofchrist.com/resources/bible-brain-api) (secondary)

### Inferences
- Streaming in a free app is the designed use case. Because the licence confines content to "the application associated with the API Key", redistribution on Audible (a different distribution channel, outside the app) is not permitted by the API licence; it would need a separate written licence from each recording's copyright holder (FCBH/Hosanna or the Bible society that owns it).
- Offline download in Bible Strong is feasible only for the subset returned by `/download/list` for the app's key; the app must check this dynamically rather than hard-code versions.
- Whether ads/subscriptions in the host app are compatible is not answered by the snippets found; given per-holder restrictions, assume some filesets (e.g. Bible-society-owned French versions) are non-commercial only until FCBH confirms in writing.
- Practical first step: request a key, then call the bibles/filesets endpoints filtered on `fra` and `eng` and store, per fileset: id, type (`audio` vs `audio_drama`), size (NT/OT/C), copyright holder and download flag. That yields the exact FR/EN list this note could not produce.

### Gaps
- **Exact list of French and English audio filesets (IDs, drama vs non-drama) could not be retrieved** — requires a key and access to 4.dbt.io, both unavailable in this session. IDs such as FRNLSG/FRNPDV/FRNPDC/FRNSEM/ENGESV/ENGNIV/ENGWEB N1DA/N2DA are plausible under the naming convention but **UNVERIFIED**.
- Full text of the licence (attribution clause wording, any clause on advertising/commercial use, rate limits) not read end-to-end. No rate-limit figure was found.
- No verified FCBH developer-support email address was found; do not use a guessed address — use the key-request form and the contact form on faithcomesbyhearing.com.
- Nothing specific was found about "Audio Bible Resources" partnership terms beyond the page name `faithcomesbyhearing.com/audio-bible-resources/bible-brain`.
- Bible.is (FCBH's consumer app/site) has no separate developer route that I could find; it appears to be a consumer front end of the same catalogue (inference, unverified).

## 2. American Bible Society — API.Bible (api.bible, docs.api.bible; formerly scripture.api.bible)

### Takeaway
API.Bible does expose audio Bibles (an `audio-bibles` endpoint returning what your key is entitled to), but its model is commercial-licence-per-translation: the free Starter tier is non-commercial only, any monetisation (ads, freemium, sponsorship) pushes the app into paid Pro plus per-Bible fees, and audio reportedly "requires special licensing" through support. Storage/download of audio outside the app is prohibited and cached content must be refreshed every 30 days.

### Cited Findings
- Audio endpoint: "To fetch your list of available Audio Bibles, you must send a GET request to the above API endpoint. This will return a list of every Audio Bible you have access to via API.Bible." Chapters are fetched by Bible ID and Chapter ID (host `rest.api.bible`). — [docs.api.bible – Audio Bibles guide](https://docs.api.bible/guides/audio-bibles/)
- A third-party review says the docs describe audio as "requires special licensing" and route developers to support. — [learnofchrist.com – API.Bible review](https://learnofchrist.com/resources/api-bible) (secondary)
- Catalogue size: an aggregator describes "nearly 2,500 text and audio Bible versions". — [faith.tools – API.Bible](https://faith.tools/app/api-bible) (secondary)
- Free Starter plan: non-commercial use only, up to three licensed Bibles, 5,000 calls per month. — [api.bible](https://api.bible/) / [learnofchrist.com](https://learnofchrist.com/resources/api-bible)
- Pro plan: "starting at $29 USD/month plus licensing fees based on monthly active users and selected translations"; another published figure is per-translation pricing from $10/month. A third-party review gives a ladder of $25 at 5,000 users, $75 at 20,000, $150 at 50,000, $250 at 100,000 (secondary, possibly outdated). — [API.Bible Help Center – How to Use an Express License](https://care.api.bible/article/385-how-to-use-an-express-license); [Express Licensing FAQs](https://care.api.bible/article/405-express-licensing-faqs); [learnofchrist.com](https://learnofchrist.com/resources/api-bible)
- Commercial scope: only "the specific copyright Bible commercial licenses you have selected and added to your commercial paid plan" are eligible for commercial use. — [API.Bible Terms and Conditions](https://api.bible/terms-and-conditions)
- Definition of commercial use: monetised products, "including website advertising, licensing fees, in-app promotions, sponsorships, freemium models, and/or paid access." — [Express Licensing FAQs](https://care.api.bible/article/405-express-licensing-faqs)
- Audio/TTS restrictions: "Text-to-Audio recordings for download outside of use in your app are clearly prohibited." Ephemeral TTS of ABS translations is allowed with "no more than one Bible chapter of audio at a time, and no recording, storage, download, or distribution of the resulting audio outside your application." — [API.Bible Terms and Conditions](https://api.bible/terms-and-conditions)
- Caching: "All cached content from API.Bible must be updated at least once every 30 days from API.Bible." — [API.Bible FAQ](https://api.bible/faq)
- ESV "is not currently available through API.Bible — the only official way to access it is through Crossway's own ESV API"; NIV commercial licensing is handled separately ("See Commercial Licensing for the NIV"). — [Express Licensing FAQs](https://care.api.bible/article/405-express-licensing-faqs)
- Biblica itself points to "api.bible by the American Bible Society" as a ministry partner for immediate use of its texts. — [Biblica – Permissions](https://www.biblica.com/permissions/)
- The address `support@api.bible` appeared in search results as API.Bible's support contact (seen only in a search summary — confirm on the site). — [docs.api.bible](https://docs.api.bible/api-reference/getting-started/)

### Inferences
- Bible Strong is free but, if it has any monetisation at all (premium, ads, sponsorship), API.Bible would treat it as commercial; cost then scales with MAU × number of translations — expensive for "as many audio Bibles as possible".
- API.Bible's terms clearly exclude Audible: no storage, download or distribution of audio outside the application.

### Gaps
- Which French and English audio Bibles API.Bible offers was not found (list is key-dependent). Number of audio Bibles: not found.
- Whether Pro pricing applies identically to audio recordings, and whether offline caching of audio is allowed in-app, is not confirmed.

## 3. YouVersion Platform (Life.Church) — developers.youversion.com / platform.youversion.com

### Takeaway
The YouVersion Platform (public developer API and SDKs, app key from the Platform portal) is text-centric: the official API pages found cover versions, books, chapters, verses, passages and licences, with no documented audio route. Its conditions are strictly non-commercial (no ads, no paywalls, no subscriptions), which may already exclude Bible Strong if it has any paid tier.

### Cited Findings
- Official endpoints found: Bibles/versions, indexes, books, chapters, verses, passages (USFM passage IDs), and a licences endpoint returning the licence for a given Bible ID; calls go to api.youversion.com with an app key header. — [developers.youversion.com/api/bibles](https://developers.youversion.com/api/bibles); [developers.youversion.com/api/licenses](https://developers.youversion.com/api/licenses); [API Usage](https://developers.youversion.com/api-usage)
- Setup step: "Accept the license agreements for the Bible versions you want to use"; "always display a Bible Version's copyright attribution in accordance with the license agreement." — [JavaScript SDK Quick Start](https://developers.youversion.com/sdks/javascript/quick-start)
- "Requirements To Use Platform: Non commercial usage (meaning no advertisements/paywalls/subscriptions) in your app. If the requirements above are not met, this will result in removal from the Platform." — [YouVersion Support – How To Sign Up For Platform](https://help.youversion.com/l/en/article/72ghg45c41-how-to-sign-up-for-platform)
- Third-party write-ups: Platform access "is not providing rights in biblical works"; each publisher must opt in before its text is on the Platform; it "grants no persistent/offline rights or positive retention period"; "The portal currently refuses commercial applications". Caching is documented for staying under rate limits (HTTP 304). — [bible-sdk.com](https://bible-sdk.com/) (secondary); [asvirts/aenon issue #3](https://github.com/asvirts/aenon/issues/3) (secondary)
- Audio: an *unofficial* Python client documents `get_audio_chapter(reference, version_id)` and `get_audio_version(audio_id)` against YouVersion's internal endpoints — this is not the licensed Platform API. — [tushortz/youversion-bible-client](https://github.com/tushortz/youversion-bible-client)
- Terms location named in search results: platform.youversion.com/terms. — [faith.tools – YouVersion Platform Services](https://faith.tools/app/youversion-platform-services) (secondary)
- YouVersion's own audio comes from the same rights holders: e.g. the LSG 1910 audio on bible.com is "Nouveau Testament Louis Segond 1910 (Drama), APOGÉE (BibleVivante), 2022"; the Bible du Semeur audio is marked not public domain. — [bible.com audio version 93](https://www.bible.com/audio-bible-app-versions/93-lsg-la-sainte-bible-par-louis-segond-1910); [bible.com/fr audio version 111](https://bible.com/fr/audio-bible-app-versions/111)

### Inferences
- As of the sources found, the YouVersion Platform is not a route to audio Bibles for third parties. Using the unofficial internal audio endpoints would be unlicensed scraping — not a legal route.
- bible.com's public "audio-bible-app-versions/<id>" pages are, however, a very useful *catalogue of who owns which recording* (copyright line per audio version), to identify rights holders to contact directly.

### Gaps
- Could not read developers.youversion.com directly to confirm the absence of an audio endpoint in November 2026 — **UNVERIFIED**; re-check the API reference.
- Rate limits and the full Platform terms text were not retrieved.

## 4. Digital Bible Library (DBL) — United Bible Societies / ETEN

### Takeaway
DBL is the upstream B2B rights repository (text, audio, video, print entries), not a public API: an organisation must be approved as a "Library Card Holder" (LCH) and then still negotiate a licence with each IP holder for most content. It suits an established legal entity/ministry with technical capacity; it is the route for Bible-society-owned French audio (e.g. Alliance biblique française) but it is slow and gate-kept.

### Cited Findings
- "There are two ways to get involved with the Digital Bible Library® (DBL) – become an Intellectual Property Contributor (IPC) or a Library Card Holder (LCH)." — [DBL – Get involved](https://thedigitalbiblelibrary.org/get-involved)
- A DBL organisation "may be either a content contributor (also called an IPC) or a publisher of content (also called an LCH)"; LCHs get files by establishing licence agreements with IP contributors; audio is one of the entry types alongside text, video, print and ePub. — [About the Digital Bible Library (app docs)](https://app.thedigitalbiblelibrary.org/static/docs/about.html)
- Applicants must fulfil criteria (agree to respect licence terms, existing technical capability); approval rests with the Partnership Credentials Committee; "A majority of the content will require additional licensing steps in order to secure permissions from each IP holder." — [DBL – Get involved](https://thedigitalbiblelibrary.org/get-involved); [technical competency page](https://dev.thedigitalbiblelibrary.org/get-involved/technical-competency/)
- Contributors can release entries under an open-access licence ("Releasing Content for Open Access" / "Configuring the Open Access License"). — [DBL contributor documentation](https://paratext.thedigitalbiblelibrary.org/static/docs/contributors/index.html)

### Inferences
- For a solo developer, DBL is not a quick route; FCBH Bible Brain and API.Bible are themselves LCH-type publishers of DBL content. DBL becomes relevant only if Bible Strong incorporates (Biblica also requires "a registered legal entity" for full-text licences) and wants direct file delivery.
- Audible distribution would require an explicit licence from the IP holder covering audiobook sale — not something an LCH card grants.

### Gaps
- Counts of audio entries/languages in DBL, the application form URL, fees (if any) and a contact email were not retrieved.

## 5. Biblica / Open.Bible ("Biblica Open") and Davar Partners

### Takeaway
Open.Bible (run by Biblica) is the main source of *openly licensed* (CC BY / CC BY-SA) Bible texts and audio that can legally be downloaded, cached, redistributed and even used commercially — but the open audio found is in African/Asian languages; no French or English open audio edition was found. Biblica's mainstream audio (NIV, Bible du Semeur) remains all-rights-reserved and is licensed only for streaming.

### Cited Findings
- "Open.Bible is managed and maintained by Biblica"; resources are supplied by partner agencies under various CC licences; catalogue snapshots show "1014 Bible translations found" (earlier 915); "Bible translations available under CC BY and CC BY-SA may be freely used subject to their license terms." — [open.bible/bibles](https://open.bible/bibles); [preview.open.bible/bibles](https://preview.open.bible/bibles)
- Biblica Open audio editions exist for e.g. Ewe and Indian Tamil; the Ewe audio lists copyright held by Biblica and Davar Partners; licence filters on the site include CC BY, CC BY-SA, CC BY-NC-SA, CC BY-NC-ND. — [Biblica Open Ewe Contemporary Scriptures, Audio Edition](https://open.bible/bibles/ewe-biblica-audio-bible/); [Indian Tamil audio](https://preview.open.bible/bibles/Indian_Tamil-Biblica-Bible-Audio)
- The Biblica Open Yoruba Contemporary Bible audio is "made available under the Creative Commons Attribution-ShareAlike 4.0 International License (CC BY-SA)"; "you must also make your derivative work available under the same license." — [bible.com audio version 911](https://www.bible.com/ar/audio-bible-app-versions/911-ycb-yoruba-contemporary-bible)
- Early Open.Bible translations listed: Biblica Open New Arabic Version, Asante Twi, Kiswahili Contemporary Bible, New Luo Translation, Yoruba Contemporary Bible ("other translations will follow"). — [scripture-engagement.org](https://scripture-engagement.org/?p=1623)
- BibleTTS (speech corpus for six Sub-Saharan languages) is derived from the Biblica open.bible project and released under CC BY-SA. — [BibleTTS](https://masakhane-io.github.io/bibleTTS/); [OpenSLR 129](http://www.openslr.org/129/)
- Biblica mainstream audio: texts and audio Bibles "may only be licensed for online website display and audio streaming", not unrestricted download or social-media redistribution; streaming only via websites or mobile apps; permission only for latest editions; Biblica does not permit unlicensed parties to create new audio derivatives of its texts where official audio exists; full-text licences only to "a registered legal entity", not an individual. — [Biblica – Permissions](https://www.biblica.com/permissions/); [Biblica Europe – Permissions](https://www.biblicaeurope.com/permissions/)
- NIV: up to 500 verses may be quoted "in any form (written, visual, electronic or audio)" without written permission, under conditions; larger commercial use goes via Zondervan (US/Canada) or Hodder & Stoughton (UK/EU/EFTA). — [Biblica – How do I license the NIV?](https://www.biblica.com/resources/bible-faqs/how-do-i-license-the-niv/); [Biblica Europe – Permissions](https://www.biblicaeurope.com/permissions/)
- The French Bible du Semeur audio on YouVersion is marked "These Scriptures are not public domain". — [bible.com/fr audio version 111](https://bible.com/fr/audio-bible-app-versions/111)
- Davar Partners International: library in 60 languages (30 full Bibles) per a member profile; stated policy to make audio "available for free and wide distribution through our many international ministry partners", with the conditions "cannot be sold or distributed for commercial purposes or financial gain", "cannot be altered in any way", "cannot be used to create derivative products". Yet recent Davar recordings on bible.com are labelled CC-BY-SA-4.0 (e.g. Dawro Audio Bible 2018; Tavoyan/Dawei NT 2025). — [Missions Box article](https://missionsbox.org/?p=13101); [FOBAI member page – Davar](https://forum-intl.org/member/davar-audio-bibles/); [bible.com audio version 3791](https://www.bible.com/audio-bible-app-versions/3791)

### Inferences
- CC BY-SA audio is the only category in this whole landscape that can lawfully be cached offline, shipped in a monetised app AND placed on Audible without asking (subject to attribution and share-alike; Audible/ACX exclusivity or DRM terms may sit awkwardly with share-alike — legal check needed).
- For Bible du Semeur and NIV audio, the route is a written streaming licence from Biblica (via biblica.com/permissions) or via API.Bible; Audible redistribution is excluded by Biblica's stated "streaming only" policy.
- Davar's older "no commercial / no derivative" statement and the newer CC BY-SA labels conflict; treat licence per recording.

### Gaps
- Could not browse open.bible to confirm whether any French or English audio exists there under an open licence — none found; **UNVERIFIED** absence.
- Davar French audio: none found. Davar contact address not retrieved.

## 6. Other producers, catalogues and consumer platforms (long tail)

### Takeaway
None of the remaining names offers a public third-party audio API; they are either consumer destinations that themselves license audio from publishers (Bible Gateway, Bible.com, Dwell, bible.audio, Blue Letter Bible, Bible Study Tools), producers to contact one by one (GRN, Davar, Talking Bibles, ASM, MegaVoice), or openly licensed repositories (eBible.org, Door43) that can be mirrored. The only clearly public-domain English audio found is the World English Bible on eBible.org.

### Cited Findings
- **eBible.org (WEB audio)**: Michael Paul Johnson's recordings are "in the Public Domain. Please feel free to download, copy, mirror, and share these files."; the Winfred W. Henson recording is described as public domain with no copyright restrictions and downloadable as a zip; the page also lists an FCBH NT recording and James Toebes OGG files without stating their licence. "World English Bible" is a trademark of eBible.org. — [ebible.org/webaudio/mp3.htm](https://ebible.org/webaudio/mp3.htm); [ebible.org/webaudio](https://ebible.org/webaudio/); [ebible.org/eng-web/audio](https://ebible.org/eng-web/audio/)
- **Global Recordings Network (GRN)**: "GRN shares its audio, video and written scripts under Creative Commons"; unless otherwise indicated, materials may be copied and used under the Creative Commons Attribution-NonCommercial-ShareAlike licence. GRN's French page also indexes third-party audio Bibles (e.g. FCBH's). — [GRN – Policies](https://www.globalrecordings.net/en/policies); [GRN – Copyright and Licensing](https://globalrecordings.net/en/copyright); [GRN – French](https://globalrecordings.net/en/language/fra)
- **Find-A-Bible (find.bible)**: a directory by the Forum of Bible Agencies International linking to print, digital, audio and visual Bibles; "The Bible-based resources in the directory are the property of individual FOBAI members or other Bible agencies" — i.e. it is a catalogue to identify rights holders, not a licensor. Sources differ on the maintainer (Digital Bible Society commissioned in 2013 vs. Pioneer Bible Translators historically). — [find.bible/en/about](https://find.bible/en/about); [forum-intl.org – Find a Bible](https://forum-intl.org/?p=216); [Wikipedia – FOBAI](https://en.wikipedia.org/wiki/Forum_of_Bible_Agencies_International)
- **Bible Gateway (HarperCollins Christian)**: "the text and audio files available on Bible Gateway are, with the exception of some public domain versions, provided to us by Bible publishers"; missing audio means the publisher "has not granted us permission to use the audio"; credits say e.g. "Recorded under licensing agreement". No public audio API or developer licence was found. — [Bible Gateway support KA-01384](https://www.biblegateway.com/support/KA-01384); [Audio Bibles Information](https://www.biblegateway.com/resources/audio/info/)
- **Dwell**: App Store listing claims "20+ voice recordings, 14 translations (ESV, NIV, NLT, KJV, CSB, NKJV, NASB, The Message, and more)"; its founders hired narrators directly (Christianity Today) — i.e. Dwell produces its own recordings and licenses the *texts* from publishers; it is not a source for third parties. — [Dwell on the App Store](https://apps.apple.com/us/app/dwell-audio-bible/id1343917374); [Christianity Today](https://christianitytoday.com/?p=32956)
- **bible.audio (Journal Chrétien)**: free French app/site with Semeur, Louis Segond 1910 and King James audio; App Store copyright line "Content: © 2024 Bible.audio". No licensing or API information found. — [bible.audio](https://www.bible.audio/bible-audio.php); [App Store listing](https://apps.apple.com/us/app/bible-audio/id1533853518)
- **Wordproject**: its French audio pages carry a "Copyrights" link, but the terms could not be read. — [wordproject.org French audio page](https://wordproject.org/bibles/audio/05_french/b09.htm)
- **ScriptureEarth (SIL)**: the Scripture Earth app is published by SIL (© 2026 SIL International) with audio in many languages; no reuse terms for the audio were found. — [Scripture Earth on the App Store](https://apps.apple.com/app/id1580089704)
- **Door43 / unfoldingWord**: texts are CC BY-SA; audio recordings of unfoldingWord-based translations found are produced by Davar under CC BY-SA 4.0 (e.g. Nepali Unlocked Literal Bible audio NT, listed on find.bible — the listing itself looked unreliable). — [find.bible NPIDPI](https://find.bible/bibles/NPIDPI/)
- **MegaVoice**: sells solar audio players and hosts a "media cloud" catalogue (e.g. an English dramatized Bible entry); partners "purchase audio Bibles for your own use and distribution" — a hardware channel, not an app-licensing API. — [MegaVoice media cloud entry](https://megavoice.com/media-cloud/m0b1625-bible-dramatized-eng-english-audio-bible/)
- **LibriVox / Internet Archive** (not in the brief but surfaced): LibriVox recordings are public domain in the USA (users elsewhere must check); archive.org hosts uploads such as "French Audio Bible – Louis Segond 1910" and "KJV NT Drama" whose rights status is uploader-asserted and unverified. — [LibriVox](https://librivox.org/author/6444); [archive.org french_audiobible](https://archive.org/details/french_audiobible)
- **Audible/ACX**: ACX offers exclusive (40%/50% royalty) or non-exclusive (25%/30%) distribution to the *rights holder* of the audiobook; under the posting agreement the poster warrants control of the audio rights. — [ACX – exclusive vs non-exclusive](https://help.acx.com/s/article/what-s-the-difference-between-exclusive-distribution-and-non-exclusive-distribution); [ACX Book Posting Agreement](https://help.acx.com/s/article/acx-book-posting-agreement)

### Inferences
- Audible distribution requires owning or holding a sublicensable audiobook-distribution right in the *recording* (and, for copyrighted translations, in the text). None of the API routes (Bible Brain, API.Bible, YouVersion) grants this. Realistic Audible candidates: (a) public-domain recordings (WEB by M. P. Johnson / W. Henson — English only), (b) CC BY-SA recordings (Open.Bible/Davar — no FR/EN found), (c) Bible Strong's own new recording of a public-domain text (Louis Segond 1910, Darby, Ostervald, Martin, KJV, WEB), or (d) a bespoke contract with a recording owner.
- For French specifically, the realistic "many at once" route is Bible Brain; everything else is one-by-one negotiation with rights holders identified via find.bible, bible.com audio pages and GRN's language page.
- GRN's default licence is NonCommercial — usable in a free app, questionable in a monetised one, unusable on Audible.

### Gaps
- No information retrieved for: Talking Bibles International, Audio Scripture Ministries, Hosanna (as distinct from FCBH — Hosanna is FCBH's legal name per the licence), Audio.Bible, Bible Study Tools/Salem, Blue Letter Bible audio, Aquifer (BiblioNexus), ScriptureDirect. Searches returned nothing usable; treat all as **not researched / unknown**.
- Wordproject's licence terms (critical, since it hosts French LSG audio) remain unread; do not assume reuse is allowed.
- bible.audio's and Bible Gateway's contact routes for licensing were not found.

## 7. Summary matrix: offline, monetised app, Audible

### Takeaway
Only public-domain and CC BY/BY-SA recordings pass all three tests (offline, monetised app, Audible); every API route is streaming-first, app-confined and excludes Audible.

### Cited Findings
- Bible Brain: streaming yes; offline only for content "specifically marked as permitted for download within the API"; content "must remain within the application"; no fee. — [Core Concepts](https://www.faithcomesbyhearing.com/bible-brain/core-concepts); [License](https://www.faithcomesbyhearing.com/bible-brain/license)
- API.Bible: free tier non-commercial only; commercial = Pro from $29/month plus per-Bible fees; no storage/download/distribution of audio outside the app; cache refresh every 30 days. — [Terms](https://api.bible/terms-and-conditions); [FAQ](https://api.bible/faq); [Help Center](https://care.api.bible/article/385-how-to-use-an-express-license)
- YouVersion Platform: "Non commercial usage (meaning no advertisements/paywalls/subscriptions)"; no audio endpoint documented in the pages found. — [YouVersion Support](https://help.youversion.com/l/en/article/72ghg45c41-how-to-sign-up-for-platform)
- DBL: per-IP-holder licence after Library Card approval. — [DBL – Get involved](https://thedigitalbiblelibrary.org/get-involved)
- Biblica standard audio: "online website display and audio streaming" only. — [Biblica – Permissions](https://www.biblica.com/permissions/)
- Open.Bible CC BY / CC BY-SA audio: "may be freely used subject to their license terms". — [open.bible/bibles](https://open.bible/bibles)
- eBible.org WEB audio (Johnson, Henson): public domain, free to copy and mirror. — [ebible.org/webaudio/mp3.htm](https://ebible.org/webaudio/mp3.htm)
- GRN: CC BY-NC-SA by default. — [GRN – Copyright](https://globalrecordings.net/en/copyright)

### Inferences
- Matrix (Y = allowed by the terms found, N = not allowed, ? = unverified):
  - Bible Brain — offline: Y for flagged filesets only; free app: Y; monetised app (ads/subscription): ? (ask FCBH, likely per holder); Audible: N.
  - API.Bible — offline: ? (30-day cache rule; audio storage outside app N); free app: Y (Starter, 3 Bibles); monetised app: Y with paid plan + per-Bible fees; Audible: N.
  - YouVersion Platform — audio: none documented; monetised app: N; Audible: N.
  - DBL — whatever each IP holder signs; Audible only by express contract.
  - Biblica (NIV/BDS audio) — streaming only; offline: N by default; Audible: N.
  - Open.Bible / Davar CC BY-SA — offline Y; monetised Y; Audible Y in principle (share-alike + attribution; verify ACX compatibility); but no FR/EN found.
  - eBible WEB public-domain audio — Y/Y/Y (English only).
  - GRN — offline Y; free app Y; monetised ?/N (NonCommercial); Audible N.
- Recommended order of action for Bible Strong: (1) request a Bible Brain key and inventory FR/EN filesets and download flags; (2) write to FCBH asking explicitly about use in an app with a paid tier and about restricted French filesets; (3) contact Biblica for Semeur streaming; (4) for Audible, plan own recordings of public-domain texts or negotiate a bespoke licence with a recording owner.

### Gaps
- All "?" cells above need written confirmation from the provider.
- The whole note should be re-verified against the live pages once the primary hosts are reachable (they were blocked in this session's network settings).
