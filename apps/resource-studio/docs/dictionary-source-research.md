# Bible dictionary source research

Date: 2026-08-30

Related issue: [#327 — Rebuild dictionaries as multilingual multi-dictionary Resources with reliable verse linking](https://github.com/smontlouis/bible-strong/issues/327)

## Conclusion

The agreed initial catalog is now five independently identified resources:

1. **Westphal (French)** — the current Bible Strong resource, retained with explicit identity and
   provenance.
2. **Easton + Webster 1828 (English)** — the current combined English database, retained as one
   honestly named resource because Easton supplies the biblical articles while Webster supplies
   useful historical-English definitions.
3. **Bost (French)** — imported independently from the authorized levangile.com edition.
4. **Calmet (French)** — imported independently from the authorized levangile.com edition.
5. **Lelièvre (French)** — imported independently from the authorized levangile.com edition.

Smith, Vigouroux, ISBE, and the American Tract Society dictionary remain credible later additions.
Door43 French Translation Words is useful as a separate modern biblical-concepts/translation-help
resource, not as a replacement for an encyclopedic Bible dictionary.

This is a source and rights screening, not legal advice. Rights must be recorded per exact edition
and digital source before publication.

Resource Studio can now acquire the three levangile.com additions reproducibly and package all five
works. The 2026-08-30 candidate contains 5,436 Westphal entries, 8,620 Easton + Webster entries,
2,308 Bost entries, 5,130 Calmet entries, and 142 Lelièvre entries. Newly acquired articles ship
without automatically inferred verse anchors until a conservative, auditable linker is available;
this avoids recreating the legacy short-token false positives described in issue #327.

## Existing Bible Strong authorization

The maintainer states that Thomas Mathey, creator of levangile.com, granted Bible Strong the rights
to use the site's Westphal, Bost, Calmet, and Lelièvre content. This private authorization changes
the product decision even though the public terms visible on levangile.com and CrossWire are more
restrictive.

Before republishing the rebuilt work, retain evidence that the authorization covers the operations
Bible Strong actually performs:

- extraction and bulk ingestion;
- correction, normalization, structured conversion, and derived indexes;
- Online display and API delivery;
- Offline redistribution in downloadable SQLite archives;
- commercial use, if applicable;
- duration, territory, attribution, and the right to sublicense or redistribute any third-party
  material included in the source.

The current Resource Studio metadata is too generic for that purpose. The French and English
dictionary manifests name `Bible Strong editorial team` as holder and say only that source terms are
recorded in provenance; they do not name Westphal, levangile.com, Thomas Mathey, or the grant.

The public CrossWire Westphal module must not itself be treated as the permission document: its
[module notice](https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=FreDAW) limits public
distribution to non-commercial use in SWORD format. Bible Strong should cite its separate private
authorization and pin the exact authorized source revision.

## Recommended French sources

### 1. Dictionnaire encyclopédique de la Bible — Alexandre Westphal

- **Status for Bible Strong:** authorized by private agreement, according to the maintainer.
- **Available source:** existing Bible Strong database and levangile.com source; a downloadable SWORD
  module also exists but has a narrower public licence.
- **Why keep it:** broad, familiar French coverage and already integrated in the product.
- **Work required:** rebuild malformed formatting, recover structured articles and references, create
  stable entry IDs, and discard the legacy fuzzy verse-link index.
- **Rights action:** replace generic manifest wording with an exact permission/provenance reference.

The [BnF catalogue notice](https://catalogue.bnf.fr/ark:/12148/cb33347411k) identifies the original
two-volume 1932–1935 edition, Westphal as director, and the other contributors. It is useful for
bibliographic provenance, not as the ingestion source.

### 2. Dictionnaire de la Bible — Jean-Augustin Bost, second edition (1865)

- **Status:** the original work is public domain; the selected Internet Archive item carries a
  Public Domain Mark.
- **Download:** [Internet Archive item `bub_gb_6v4UAAAAYAAJ`](https://archive.org/details/bub_gb_6v4UAAAAYAAJ).
- **Formats:** PDF scan, ABBYY OCR, DjVu plain text, hOCR, and searchable OCR derivatives.
- **Scale:** the title declares more than 4,000 articles.
- **Why it is the best French addition:** it is substantial, already alphabetic, downloadable in
  machine-processable form, and independent of levangile.com's own transcription.
- **Work required:** segment articles from OCR, restore headings and accents, validate references,
  compare every parsed entry against page images, and keep source page coordinates.

Use the untouched 1865 scan/OCR as the pinned source. Do not ingest later annotated or “renewed and
augmented” web/PDF editions unless their additions have a separate compatible licence.

### 3. Dictionnaire historique et critique de la Bible — Augustin Calmet

- **Status:** Calmet (1672–1757) and the original eighteenth-century text are unambiguously old enough
  to be public domain.
- **Downloads:** the [BnF catalogue/Gallica record](https://catalogue.bnf.fr/ark:/12148/cb30643684g)
  exposes digitized volumes; [Internet Archive](https://archive.org/details/dictionnairehis00calmgoog)
  exposes PDF, ABBYY, DjVu text, and hOCR for a 1722 volume.
- **Value:** major historical French reference, complementary to the Protestant Bost and Westphal.
- **Cost:** old spelling, long-s typography, multi-volume layout, tables, engravings, and difficult OCR.
- **Recommendation:** second wave after Bost; choose and pin one edition rather than merging editions.

Gallica's own reuse conditions distinguish the public-domain underlying work from reuse of Gallica
reproductions and may charge for commercial reuse. Prefer a Public Domain Mark/CC0 reproduction or
obtain the appropriate Gallica permission before using its files in a commercial product.

### 4. Dictionnaire de la Bible — Fulcran Vigouroux (1912 edition)

- **Status:** Wikimedia marks the scans as public domain; Fulcran Vigouroux died in 1915. Because the
  dictionary has many signed contributors, confirm the exact collective/contribution rights analysis
  for the chosen edition before worldwide distribution.
- **Downloads:** [Wikisource project](https://fr.wikisource.org/wiki/Dictionnaire_de_la_Bible_-_Vigouroux)
  and [volume I scan](https://fr.wikisource.org/wiki/Fichier:Dictionnaire_de_la_Bible_-_F._Vigouroux_-_Tome_I.djvu),
  which is marked with the Public Domain Mark; complete volume scans and OCR derivatives are also on
  Internet Archive.
- **Value:** very rich Catholic encyclopedia with names, places, archaeology, theology, languages,
  illustrations, and long articles.
- **Cost:** Wikisource reports only about 25% completion and hundreds rather than all articles
  transcribed; raw OCR contains Greek/Hebrew, columns, plates, and missing pages.
- **Recommendation:** high-value long-term project, not the first generalized-import pilot.

### 5. unfoldingWord French Translation Words

- **Status:** CC BY-SA 4.0 according to its manifest and licence.
- **Download:** [Door43 repository](https://git.door43.org/unfoldingWord/fr_tw) or
  [`master.zip`](https://git.door43.org/unfoldingWord/fr_tw/archive/master.zip).
- **Format and scale:** Markdown source tree; the inspected revision contains about 981 articles
  (983 Markdown files including repository documents) and identifies itself as French Translation
  Words v7.3, issued in 2019 from English source v7.
- **Value:** definitions, translation suggestions, Bible references, and some Strong identifiers for
  important terms; it is much more recent in language than the public-domain encyclopedias.
- **Cautions:** it is translation help rather than a conventional Bible encyclopedia, its French
  editorial quality needs review, and adapted/combined content must respect ShareAlike obligations.
- **Recommendation:** publish as a clearly named concepts/translation-help resource if its editorial
  quality passes review; do not silently merge it into Westphal or Bost.

### Sources not yet cleared

- **David Martin 1744 glossary:** CrossWire offers about 970 definitions but labels the electronic
  module `Copyrighted; Freely distributable`, which is too ambiguous about modification and product
  redistribution. Seek clarification before using the module.
- **French Strong SWORD modules:** their public permissions and credited electronic editions may be
  narrower than the underlying old works. Do not assume the Thomas Mathey agreement covers unrelated
  third-party electronic editions unless it expressly does.

## Specialized lexical sources

These do not replace a general Bible dictionary, but they are particularly relevant to Bible
Strong's lexical surfaces.

### STEPBible TBESH and TBESG

- **Status:** CC BY 4.0 with STEPBible/Tyndale House attribution.
- **Download:** [STEPBible Data repository](https://github.com/STEPBible/STEPBible-Data), including
  the structured TBESH and TBESG extended-Strong lexicons.
- **Value:** deterministic TSV/text data, extended Strong identities, Hebrew BDB-derived summaries,
  and broad Greek coverage.
- **Recommendation:** retain as the canonical lexical foundation already used by Bible Strong; do
  not present it as another French encyclopedic dictionary. Layer reviewed French glosses and
  definitions over the pinned STEP identities.

### Sander–Trénel Dictionnaire hébreu-français (1859)

- **Status:** public-domain original; the selected Internet Archive item carries a Public Domain
  Mark.
- **Download:** [Internet Archive item `bub_gb_0BkUAAAAYAAJ`](https://archive.org/details/bub_gb_0BkUAAAAYAAJ).
- **Formats:** EPUB, PDF, DjVu, OCR text/XML, ABBYY, and hOCR.
- **Value:** French definitions for biblical Hebrew and Aramaic, including discussion of difficult
  passages; potentially valuable evidence for richer French Strong entries.
- **Cost:** Hebrew OCR is unreliable. Lemmas, vocalization, roots, and Strong correspondences must
  be reconstructed and checked against scans and the canonical STEP inventory.
- **Recommendation:** strong enrichment source after the general multi-dictionary pilot, with page-
  level evidence and no automatic overwrite of reviewed STEP-based content.

Other public-domain specialized works worth a later catalog pass include Charles Huré's
_Dictionnaire universel de philologie sacrée_, Barbié du Bocage's biblical geography dictionary,
Honoré Simon's 1693 dictionary, the 1806 Chompré/Petitot abridgment, E. Spol's 1876 proper-name
dictionary, and Marchand-Ennery's 1827 Hebrew–French dictionary. Each still needs an exact-edition,
scan-rights, OCR-quality, and product-value audit before acquisition.

## Recommended English sources

### 1. Easton's Bible Dictionary (1897)

- **Status:** public domain.
- **Structured sources:** [CrossWire SWORD module](https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=Easton)
  and [CCEL download page](https://www.ccel.org/ccel/easton/ebd2.html), which offers PDF, Word,
  marked-up HTML, UTF-8 text, and ThML XML.
- **Ready-to-import option:** the [NEUU Bible Dictionary Dataset](https://github.com/neuu-org/bible-dictionary-dataset)
  contains 3,962 separated Easton entries and parsed Scripture references as JSON. NEUU licenses its
  dataset and scripts under CC BY 4.0 while identifying the source dictionary as public domain.
- **Recommendation:** best English pilot because both original-format and normalized data are
  available. Validate NEUU output against pinned CCEL/CrossWire source before publication.

### 2. Smith's Bible Dictionary (1884 SWORD edition / nineteenth-century original)

- **Status:** CrossWire labels its edition public domain.
- **Structured sources:** [CrossWire SWORD module](https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=Smith)
  and CCEL; the NEUU dataset contains 4,561 separated Smith entries as JSON.
- **Recommendation:** publish independently from Easton even if both are acquired through NEUU.
  Do not use NEUU's merged-by-term layer as the canonical product model, because #327 requires clear
  work identity and provenance for every result.

### 3. International Standard Bible Encyclopedia, original edition

- **Status:** the [CrossWire module](https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=ISBE)
  is labeled public domain and downloadable as SWORD.
- **Value:** much deeper and more encyclopedic than Easton or Smith.
- **Cautions:** use only the original 1915-era edition, never the copyrighted revised ISBE; audit
  contributor/jurisdiction status for worldwide distribution and expect a larger normalization job.
- **Recommendation:** second-wave English encyclopedia.

### 4. American Tract Society Bible Dictionary (1859)

- **Status:** the [CrossWire module](https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=AmTract)
  is labeled public domain.
- **Format:** downloadable SWORD dictionary, about 1.85 MB installed.
- **Recommendation:** sound additional English work after Easton and Smith; useful for testing that
  multiple same-language dictionaries remain visibly distinct.

### Lower-priority English works

- **Hitchcock's Bible Names:** public-domain SWORD/CCEL data with more than 2,500 proper names, but it
  is a names dictionary rather than a general study dictionary.
- **Hastings Dictionary of the Bible:** rich and digitized by CCEL/NEUU, but the multi-author rights
  analysis and complex large-volume structure deserve a separate audit before publication.
- **Torrey's New Topical Textbook and Nave:** topical indexes, not general dictionaries; Nave is
  already part of the Bible Strong resource catalog.

## Source-provider assessment

### levangile.com

The site is a useful authorized source for Bible Strong because of the maintainer's private agreement.
Its public [legal notice](https://www.levangile.com/mentions.php) does not itself grant bulk reuse,
so the private grant—not public website availability—must be the recorded rights basis.

The site currently exposes Westphal, Bost, Calmet, and Lelièvre. Permission from the site operator
should be mapped per work: site ownership or permission to publish a web transcription does not
automatically prove authority to sublicense every underlying work or third-party addition.

### CrossWire SWORD

CrossWire is the best broad downloadable catalog: modules have explicit info pages, language,
edition, distribution licence, and raw ZIP download links. SWORD is a good acquisition format, not
the Bible Strong canonical format. Convert it in Resource Studio while preserving the module config,
exact ZIP checksum, entry markup, and licence notice in provenance.

### CCEL

CCEL provides several public-domain English dictionaries in downloadable text/XML-oriented formats.
The ThML markup retains terms and Scripture references and is easier to normalize than OCR. Pin the
exact source files and do not infer rights for a derivative transcription solely from the age of the
printed original; prefer a source with an explicit licence or Public Domain Mark.

### Internet Archive, Wikimedia Commons, and Wikisource

These are the strongest scan/OCR sources for old French works. Prefer items with an explicit Public
Domain Mark or CC0 signal. Keep scan images as the truth source, OCR/hOCR as acquisition aids, and
page coordinates in the editorial ledger so corrections remain auditable.

### Gallica

Gallica is authoritative for bibliography and scans, but its reproduction reuse terms can be more
restrictive than the copyright status of the old text. It should not be treated as the default
commercial ingestion source without checking the exact item's conditions.

## Proposed acquisition order for issue #327

1. Record the Westphal/levangile private authorization and rebuild Westphal under
   `dictionary:westphal:fr`.
2. Import Bost 1865 from the Public Domain Mark scan/OCR under `dictionary:bost:fr`.
3. Import Easton and Smith from separate NEUU JSON layers, with CC BY 4.0 attribution and validation
   against their public-domain source files, as `dictionary:easton:en` and `dictionary:smith:en`.
4. Use those four works to prove multi-work catalog, search, selection, Online/Offline parity, and
   non-fuzzy verse linking.
5. Evaluate Calmet next; evaluate Vigouroux only after an OCR/rights pilot; evaluate Door43 as a
   separate resource family or presentation.

Every acquisition config should pin: work and edition identity, source URL, immutable revision or
checksum, source format, author/editor/contributors, language, licence or permission reference,
required attribution, permitted delivery modes, and known editorial/OCR limitations.
