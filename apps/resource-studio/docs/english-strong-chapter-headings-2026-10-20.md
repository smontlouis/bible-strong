# Titres de péricope avant le verset 1 dans les Bibles anglaises SWORD

Date : 20 octobre 2026. Correction de l'extraction, régénération et
publication en production le même jour.

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

## Publication (20 octobre 2026)

1. Sources de texte téléversées dans R2 sous leur clé `sources/<sha256>/` et
   nommées par `config/ordinary-bible-sources.json` ; bundles Bible
   reconstruits sans override.
2. Les quatre bundles dans R2 (`resources:r2:publish-changed:prod`), catalogue
   mobile corrigé (`r2ArtifactSources catalog-patch`), copies hors ligne
   chiffrées recréées (`resources:offline:encrypt:prod`), inventaire adopté.
3. Import et activation dans Neon : `bible-text:BSB`, `bible-text:RV1895`,
   `strong-bible-index:BSB`, `strong-bible-index:RV1895`.
4. Worker déployé (le cache de l'API est conservé ; ces quatre ressources ont
   de nouvelles clés). Vérifié : `/health`, catalogue hors ligne, lectures
   `/v1/bibles/BSB/books/51/chapters/2` (« Absent in Body, Present in
   Spirit » puis le renvoi), Genèse 1, Matthieu 5, RV1895 Ps 42, et lecture
   Strong des deux Bibles appariée aux nouvelles révisions.
5. Pages du site rafraîchies : `/bible/bsb`, `/bible/rv1895` et leurs dossiers
   `strong` et `reverse-interlinear`.

Les annotations de mots suivent la migration de l'ADR-0013 ; le texte des
versets étant inchangé, le réalignement est immédiat.

Appariement des sidecars : `restampStrongSidecarText` comparait des
révisions (`presentationRestampedFromTextRevision`, figée au premier
re-tamponnage). Une fois la nouvelle source adoptée, la reconstruction des
bundles Strong aurait refusé BSB et RV1895 alors que leurs textes de verset
n'ont pas changé. Le sidecar enregistre désormais l'empreinte des seuls
textes de verset (`verseTextSha256`) ; quand elle est présente, elle seule
décide de l'appariement. Les sidecars sans empreinte gardent l'ancienne
règle et la reçoivent au prochain re-tamponnage.
