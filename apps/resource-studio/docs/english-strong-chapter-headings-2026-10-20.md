# Titres de péricope avant le verset 1 dans les Bibles anglaises SWORD

Date : 20 octobre 2026. Correction de l'extraction et régénération locale ;
rien n'a été importé, téléversé ni activé en production.

## Symptôme

En BSB, le premier titre de péricope de chaque chapitre manquait
(Colossiens 2 : « Absent in Body, Present in Spirit » ; Genèse 1 : « The
Creation » ; Matthieu 5 : « The Sermon on the Mount »). 442 chapitres sur 1 189
n'avaient que des renvois `parallel` au verset 1.

## Cause racine

`scripts/extract_sword_rich_bibles.py` lisait chaque chapitre avec
`bible.get_iter(...)` de pysword, qui ne renvoie que les versets 1..N. SWORD
range tout ce qui précède le verset 1 dans l'entrée « en-tête de chapitre »
(verset 0), juste avant celle du verset 1. Cette entrée n'était jamais lue.

## Contenu des versets 0 (9 modules épinglés)

| Module               | Titres                                              | Traitement |
| -------------------- | --------------------------------------------------- | ---------- |
| BSB                  | 1 194 titres sans type (péricopes, « BOOK I…V »)    | projetés   |
| RV1895               | 6 « BOOK I. »…« BOOK V. » des Psaumes (+1 Siracide) | 5 projetés |
| KJV, RLT             | 1 184 `type="chapter"` (« CHAPTER 1. »)             | écartés    |
| NASB 2020/1995       | 1 189 `subType="x-Chapter"` (« CHAPTER 1 »)         | écartés    |
| ASV, Darby, RWebster | aucun                                               | —          |

Contenu non titre, conservé dans la couche riche mais non projeté : 43
sommaires de chapitre RWebster (`div type="introduction"`), « א ALEPH. » de
l'ASV (Ps 119), repères poétiques ouverts au verset 0.

## Correction

- Extraction : le verset 1 porte l'entrée verset 0 telle quelle
  (`chapterPrelude`) ; ses titres passent en tête de `headings`, marqués
  `sourceEntry: "chapterPrelude"`, `order` renuméroté. Le texte du verset 1 ne
  change pas. Le manifeste compte les en-têtes de chapitre, leurs balises et
  les types de titres.
- Projection : les libellés de chapitre (`type="chapter"`,
  `subType="x-Chapter"`) ne sont jamais projetés ; `order` est renuméroté après
  filtrage. Le résumé expose `chapterHeadingCount` et
  `droppedChapterLabelCount`.
- Tests : `scripts/test_extract_sword_rich_bibles.py` (Colossiens 2 : titre puis
  renvoi, aucun texte parasite) et un cas de bout en bout dans
  `tests/projectEnglishStrongMobileJsonl.test.ts` (libellé NASB écarté).

## Écart mesuré

Référence : ancienne extraction projetée par le nouveau code. Elle reproduit
octet pour octet les JSONL du 1er octobre, et sa compilation reproduit les
sources de texte en production (`bible-bsb.json` `bsb-a80fae…`,
`bible-rv1895.json` `rv1895-d5ba11…`).

| Bible    | Titres        | Péricopes     | JSONL                               |
| -------- | ------------- | ------------- | ----------------------------------- |
| BSB      | 3 375 → 4 569 | 1 907 → 3 101 | 1 189 versets 1, titres seuls       |
| RV1895   | 139 → 144     | 23 → 28       | 5 versets 1 (Ps 1, 42, 73, 90, 107) |
| 7 autres | inchangés     | inchangés     | identiques octet pour octet         |

Aucun doublon entre titre du verset 0 et titres du verset 1. Exemples BSB :
Gn 1 « The Creation » puis « (John 1:1–5; Hebrews 11:1–3) » ; Ps 1 « BOOK I »,
« Psalms 1–41 », « The Two Paths » ; Mt 5 « The Sermon on the Mount ».

## Artefacts régénérés (locaux)

- Sources de texte : `outputs/bible-sources/english-chapter-headings-2026-10-20/`
  (`bible-bsb.json` `bsb-596b707dcf7cf4643945`, `bible-rv1895.json`
  `rv1895-d076a1113d2bd445ea3b`, archives et `source-overrides.json`).
- Bundles Bible : `outputs/releases/ordinary-bible-publications-2026-10-20-chapter-headings/`
  — `bsb-00f7609b8455436be1bd` (était `bsb-cdaadf…`),
  `rv1895-dd708435f3bae2f7d788` (était `rv1895-3853e7…`). Par rapport aux
  bundles en production : seuls les titres changent, paroles de Jésus et texte
  identiques.
- Bundles Strong : `outputs/releases/strong-bible-publications-2026-10-20-chapter-headings/`
  — `bsb-strong-1258e098f40244368cdd`, `rv1895-strong-24d318dc93af64dfd480`.
  Construits par `buildStrongBibleResourcePublication` à partir des sidecars
  en production, re-tamponnés par `restampStrongSidecarText` (texte de chaque
  verset vérifié identique). Tables `Verses`, `WordSpans`, `WordStrongCodes`,
  `StrongCodes`, `FrenchLexemes` identiques ; seuls `textRevision`,
  `textSha256`, `strongRevision` et `baseStrongRevision` changent.

## Ce qu'il reste à faire (hors de Resource Studio)

1. Téléverser les sources de texte et les artefacts, puis mettre à jour
   `config/ordinary-bible-sources.json` et `config/mobile-resource-inventory.json`.
2. Importer et activer les bundles `bible:BSB`, `bible:RV1895` puis
   `bible-strong:BSB`, `bible-strong:RV1895` (Resource service).
3. Les annotations de mots suivent la migration de l'ADR-0013 ; le texte des
   versets étant inchangé, le réalignement est immédiat.
4. Piège : les sidecars re-tamponnés gardent
   `presentationRestampedFromTextRevision` sur l'ancienne source
   (`bsb-a80fae…`, `rv1895-d5ba11…`). Une fois la nouvelle source adoptée dans
   `config/ordinary-bible-sources.json`, `yarn resources:publication:strong-bibles`
   refusera ces sidecars (`strong-publication-restamp-source-mismatch`) tant
   qu'il apparie avec la source configurée.
