# Lausanne Bible 1872 source

Bible Strong uses version code `LAU` for the Lausanne Bible (1872).

## Authoritative import source

- Publication page: <https://sites.google.com/view/bibledelausanne>
- Source revision: `AT-NT Lausanne 20250418.txt`
- Rights: public domain, as declared by the publication page
- Old Testament digitization: directed by Philippe Lacombe
- New Testament digitization: Yves Pétrakian
- Source encoding: Windows-1252
- Audited source SHA-256:
  `03ec4063f42b828cdf07c4134bae26368461604b04d6462aa962fc1f47c85c96`

The dated downloadable file is the authoritative input for this importer. The publication page says
its online book pages may lag behind the downloadable file.

## Editorial policy

The generator preserves the source spelling, punctuation, paragraph marks, bracketed additions,
and inline source notes. It decodes the source encoding and converts verse references into Bible
Strong's numeric book/chapter/verse JSON structure.

The source numbers Joel in three chapters (`20/32/21`). Bible Strong's existing French canon numbers
Joel in four chapters (`20/27/5/21`). The generator explicitly maps source Joel 2:28-32 to output
Joel 3:1-5 and source Joel 3 to output Joel 4. This keeps navigation and cross-version comparison
aligned without changing the verse text.

## Generation

Run:

```bash
yarn bible:lau:generate
```

The command writes:

- `.scratch/generated/bible-lau.json`
- `.scratch/generated/bible-lau.manifest.json`

The manifest records source and artifact checksums, coverage, provenance, rights metadata, and
validation canaries. This output is a validated import candidate, not a publication artifact.

The current mobile download entry expects this legacy-compatible JSON at:

```text
https://assets.bible-strong.app/bibles/bible-lau.json
```

Upload and verify that file before releasing the app metadata that exposes `LAU`. Production
publication is deliberately not performed by this local generator. When the canonical resource
pipeline described by
[ADR-0010](adr/0010-generate-offline-artifacts-from-canonical-postgres.md) is operational, the same
validated corpus should be imported there so online and offline representations derive from one
resource revision.

## Independent audit

The authoritative import file was compared on 2026-07-20 with
[Biblia Universalis](https://www.bibliauniversalis3.com), which independently publishes the
Lausanne text in the same four-chapter Joel versification used by Bible Strong:

- [Exodus 20](https://www.bibliauniversalis3.com/chapitre.php?version=LAU&livre=EXO&chapitre=20)
  has the complete verse 14, `Tu ne commettras point d'adultère.` after normalizing its typographic
  apostrophe to the source file's straight apostrophe;
- Joel chapters
  [1](https://www.bibliauniversalis3.com/chapitre.php?version=LAU&livre=JOL&chapitre=1),
  [2](https://www.bibliauniversalis3.com/chapitre.php?version=LAU&livre=JOL&chapitre=2),
  [3](https://www.bibliauniversalis3.com/chapitre.php?version=LAU&livre=JOL&chapitre=3), and
  [4](https://www.bibliauniversalis3.com/chapitre.php?version=LAU&livre=JOL&chapitre=4) contain
  `20/27/5/21` verses, including the final Joel 4:21 text.

The reported eBible defect was also reproduced: its Exodus 20:14 is truncated to
`Tu ne commettras point.` Its three Joel chapters currently contain `20/32/21` references, but
this does not repair the Exodus defect and does not make eBible the canonical source.

## Validation

Generation fails unless the source:

- maps to all 66 supported canonical books and their chapters;
- matches the audited per-chapter coverage checksum (1,190 chapters), so missing terminal verses
  cannot be hidden by extra verses elsewhere;
- contains exactly 31,105 verse records;
- has no malformed, unknown, or duplicate references;
- has contiguous verse numbering inside every source chapter;
- contains no empty text, replacement characters, or forbidden control characters;
- contains the audited Exodus 20:14 text;
- contains all of source Joel (`20/32/21`) and maps it to the app's `20/27/5/21` versification.
