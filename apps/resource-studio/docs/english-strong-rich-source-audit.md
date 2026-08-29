# English Strong rich-source audit

Audit date: 2026-07-24.

The nine selected, unlocked SWORD modules were downloaded from the pinned
CrossWire/STEP URLs, verified by SHA-256, and extracted with filters disabled.
The generated JSONL artifacts remain under
`outputs/imports/english-sword/rich-source/`.

Counts below describe source elements or source spans, not rendered UI
components.

| Bible                       | Module | Verses | Red-letter spans | Pericopes | Headings | Paragraph events | Added/italic spans |  Notes | Cross-references | Divine-name spans | Poetry events | Strong identities | Morphology |
| --------------------------- | -----: | -----: | ---------------: | --------: | -------: | ---------------: | -----------------: | -----: | ---------------: | ----------------: | ------------: | ----------------: | ---------: |
| KJV                         |    3.1 | 31,102 |            2,035 |         0 |      138 |            2,970 |             21,628 |  6,959 |                0 |             6,958 |             0 |           374,069 |    199,999 |
| NASB 2020                   |    2.0 | 31,102 |            2,107 |     2,238 |    2,411 |            5,177 |             31,316 | 61,700 |           93,624 |             7,173 |        21,091 |           375,263 |          0 |
| NASB 1995                   |    1.2 | 31,102 |            2,116 |     2,229 |    2,371 |            5,180 |             28,430 | 61,361 |           93,614 |             7,164 |        21,097 |           358,150 |          0 |
| BSB                         |    2.0 | 31,102 |                0 |     1,907 |    3,375 |           23,792 |              5,301 |  4,853 |            4,688 |                 0 |        48,546 |           437,587 |          0 |
| ASV                         |    2.0 | 31,102 |                0 |         4 |      121 |            8,481 |              4,316 |     16 |               16 |                 0 |        22,980 |           681,155 |          0 |
| Darby English               |    2.0 | 31,102 |                0 |         0 |      116 |            1,039 |                  0 |  4,297 |            4,297 |                 0 |         4,888 |           682,120 |          0 |
| Revised Literal Translation |    1.0 | 31,102 |            2,035 |         0 |      138 |            3,597 |             21,619 |  6,955 |                0 |             6,955 |             0 |           374,062 |    200,004 |
| Revised Webster             |    2.3 | 31,102 |                0 |         0 |      137 |            7,550 |             21,408 |  7,881 |               17 |                 0 |            44 |           351,587 |     28,685 |
| Revised Version 1895        |   15.9 | 37,791 |                0 |        25 |      141 |            1,927 |              5,131 |  1,366 |                0 |                 0 |        13,822 |           401,886 |          0 |

## Interpretation

- KJV and RLT carry words of Jesus, translation additions, paragraph
  milestones, divine-name spans, notes, Strong data, source-token positions,
  and morphology. Their headings are primarily Psalm/acrostic material rather
  than section-level pericopes.
- Both NASB modules are the richest editorial sources in the batch: section
  titles, words of Jesus, paragraph/poetry milestones, explanatory notes,
  extensive cross-references, italics/additions, divine names, and Strong data.
- BSB has no red-letter encoding in this module, but it has a strong structural
  layer: section titles, parallel-passage headings, paragraphs, lists, poetry,
  notes, cross-references, source lemmas, transliteration, and Strong data.
- ASV, Darby English, Revised Webster, and RV 1895 do not expose red letters in
  these modules. Absence is recorded as source absence; it must not be inferred
  from another Bible.
- RV 1895 uses NRSVA versification. Its source includes 31,104 verses in the
  Protestant 66-book subset and 6,687 verses in supplemental books. All 37,791
  are retained in the authoring layer; product mapping must be resolved before
  publication.
- BSB has 290 verse fragments whose list markup crosses verse boundaries, so
  those individual fragments are not standalone XML documents. The source
  fragments are retained byte-for-byte and the affected references are
  recorded in its manifest. A later projection must carry active structural
  state across verses, as the current mobile publisher already does for
  spanning presentation tags.

## Publication boundary

These JSONL files are lossless source/authoring artifacts, not the final mobile
Bible JSON. The final projection must preserve the editorial information in
canonical JSON while moving Strong occurrences into the paired SQLite. It must
also retain source-only morphology/transliteration data in an auditable
sidecar or manifest if the first mobile schema does not expose it.

No ESV text was synthesized or reused from the existing Bible Strong CDN
JSONs. No `KJVS` dataset was created.
