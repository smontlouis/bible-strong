# Raffinement déterministe des lemmes et POS anglais

Date de décision : 2026-07-30

## Statut et objectif

Ce document est le contrat durable du chantier de correction des lemmes et
parties du discours des neuf Bibles anglaises. Il doit être lu avant toute
nouvelle génération ou modification de `src/englishStrongLemmas.ts`,
`src/projectEnglishStrongMobileJsonl.ts`,
`src/reverseInterlinearMobile.ts` ou
`src/packageReverseInterlinearStrongBibles.ts`.

Les neuf éditions concernées sont KJV, NASB 2020, NASB 1995, BSB, ASV,
Darby EN, RLT, RWebster et RV1895.

État courant : la politique `english-lexeme-refinement@9` /
`english-wordnet-context-pos@8` est matérialisée dans le candidat additif
`bible-strong-reverse-interlinear-v18-wordnet-context-candidate`. Elle passe
les canaris des neuf Bibles et l'audit reproductible KJV/ASV de 100 Strong.
Les candidats v10 à v17 sont conservés comme historique, mais ne doivent pas
être promus.

Le POS produit par `wink-pos-tagger` est une proposition provisoire. Il ne doit
plus être considéré comme la vérité éditoriale finale. Le POS final doit être
raffiné après l'alignement STEP et, pour ASV/Darby EN, après l'assainissement
des Strong classiques.

## Décision produit non négociable

Chaque occurrence publiée doit conserver un POS concret.

- Ne jamais publier `unknown`, `undetermined`, `unresolved`, une chaîne vide
  ou une valeur équivalente.
- Ne jamais supprimer un POS parce que les preuves se contredisent.
- Quand aucune correction déterministe n'est assez forte, conserver le POS
  provisoire du tagger.
- Une erreur résiduelle concrète est préférable à une valeur indéterminée :
  elle reste requêtable, mesurable, explicable et corrigeable lors d'une passe
  additive ultérieure.
- Toute correction automatique doit enregistrer sa méthode, ses preuves, ses
  compteurs et un fingerprint. Toute non-correction reste observable dans un
  audit résiduel.

## Cause racine observée

Toutes les sources anglaises passent par
`enrichEnglishStrongMarkup()`. Le tagger contextuel se trompe fréquemment dans
les tournures bibliques ou anciennes, notamment avant `has`, `hath`, `had`,
`shall` et après `which`, `to` ou une préposition.

Exemples attestés :

- `God`, `Jehovah`, `David`, `Moses`, `Abraham`, `Paul`, etc. classés
  `verb`;
- `H0430G` classé `verb` alors que l'occurrence STEP est nominale;
- erreurs différentes selon la formulation de chaque traduction, bien que le
  pipeline de lemmatisation soit commun.

Le problème de POS concerne les neuf Bibles. Le sur-balisage Strong massif est
un problème distinct, actuellement propre aux modules SWORD ASV et Darby EN.

## Audit de départ

Les compteurs suivants proviennent du candidat
`bible-strong-reverse-interlinear-v9-sanitized-candidate`.

| Bible    | `H0430G` avec POS `verb` | verbes sur une liste conservatrice de noms bibliques | `Jehovah` avec POS `verb` |
| -------- | -----------------------: | ---------------------------------------------------: | ------------------------: |
| KJV      |                       70 |                                                  411 |                         2 |
| NASB2020 |                       94 |                                                  684 |                         0 |
| NASB1995 |                      100 |                                                  700 |                         0 |
| BSB      |                      109 |                                                  582 |                         0 |
| ASV      |                       34 |                                                  408 |                       362 |
| Darby EN |                        1 |                                                  605 |                       693 |
| RLT      |                       70 |                                                  411 |                         2 |
| RWebster |                       82 |                                                  737 |                         0 |
| RV1895   |                       37 |                                                  411 |                         1 |

La liste conservatrice contient uniquement `David`, `Moses`, `Abraham`,
`Jacob`, `Isaac`, `Joseph`, `Aaron`, `Joshua`, `Saul`, `Solomon`, `Paul`,
`Peter`, `Jeremiah`, `Hezekiah`, `Pharaoh`, `Satan`, `Zion` et `Israel`.
Elle exclut volontairement les homographes ordinaires et les titres divins.

Ces compteurs sont des canaris minimaux, pas une estimation exhaustive de
toutes les erreurs.

## Architecture retenue

Le pipeline est composé de deux passes.

1. **Passe provisoire avant alignement**
   - le projecteur SWORD conserve le texte et les Strong sources;
   - `wink-pos-tagger` fournit un lemme et un POS concret;
   - ces valeurs restent disponibles pour l'alignement et l'assainissement.
2. **Passe finale après alignement**
   - exploite le `stepTokenId` exact et les identités matérialisées;
   - consulte le registre local des entités bibliques;
   - applique les décisions de consensus multi-Bibles;
   - remplace seulement les décisions suffisamment prouvées;
   - conserve le POS provisoire pour tout résidu ambigu.

Cette séparation évite la dépendance circulaire dans laquelle un POS corrigé
servirait à décider si le Strong qui fournit sa preuve doit lui-même être
conservé.

## Priorité des preuves

Les décisions finales suivent cet ordre.

1. **Invariants de surface**
   - texte canonique exact, offsets et longueur du span;
   - `H430/H430G + God` donne `name`, tandis que `god/gods` donne `noun`;
   - `Jehovah` donne `name`;
   - les possessifs détachés dont le lemme technique est `s` donnent
     `particle`.
2. **Entités et noms propres**
   - registre `data/entities/bible_entities.production.sqlite`;
   - identité Strong/STEP compatible;
   - casse de la tête ou forme propre composée (`Kiriath-jearim`,
     `Ben-hadad`) confirmée par le contexte;
   - un alias seul ne suffit jamais à produire `name`.
3. **Stabilité des classes fermées**
   - `conj`, `det`, `prep`, `pron`, `particle`, etc. ne sont pas réécrits par
     un homonyme WordNet.
4. **Lexique anglais et contexte**
   - WordNet fournit les catégories possibles;
   - `wink-lemmatizer` fournit les bases flexionnelles;
   - `wink-pos-tagger` analyse la phrase complète et départage les sens;
   - des règles anglaises versionnées couvrent les formes bibliques certaines
     (`saith`, `liveth`, `ye`, `thee`, `unto`, `lest`, etc.).
5. **Morphologie STEP**
   - utilisée comme vote diagnostique lorsqu'elle est compatible avec
     l'anglais;
   - elle ne peut pas renverser une règle anglaise certaine : par exemple un
     STEP `noun` sur `saith` ne transforme pas le verbe anglais en nom.
6. **Consensus multi-Bibles**
   - clé fondée sur le lemme anglais normalisé et l'identité lexicale la plus
     précise disponible;
   - apprentissage limité aux occurrences reliées à un token STEP concret;
   - seuils, marge et nombre minimal de preuves versionnés;
   - aucune décision apprise depuis les seules balises SWORD brutes
     sur-balisées.
7. **Repli concret**
   - valeur de repli concrète obligatoire;
   - jamais remplacée par une valeur indéterminée.
8. **Override éditorial versionné**
   - réservé aux résidus prouvés;
   - additif, fingerprinté, audité et couvert par un test.

La morphologie originale ne doit pas imposer aveuglément le POS anglais :
une traduction peut changer de catégorie grammaticale. Elle sert à valider une
décision consensuelle ou à bloquer une catégorie impossible. Les noms propres
exacts et les canaris divins font l'objet de contraintes plus fortes.

## Politique divine minimale

Pour l'identité exacte `H0430G` :

- `God` est publié comme `name`;
- `god` ou `gods` employés comme appellation commune sont publiés comme
  `noun`;
- aucune de ces formes ne peut être publiée comme `verb`.

Pour l'identité divine `H3068G`, `Jehovah` est publié comme `name`.

La casse de surface n'est pas stockée dans `FrenchLexemes`; quand elle est
nécessaire, la passe finale doit la lire depuis le texte source ou utiliser la
preuve d'entité/occurrence exacte. Elle ne doit pas la deviner à partir du
lemme minuscule seul.

## Index dérivé et provenance

Les décisions partagées doivent être matérialisées dans un index SQLite dérivé
et immuable pour une release. Le contrat logique attendu contient au minimum :

```sql
EnglishLexemeDecisions (
  normalizedSurface TEXT NOT NULL,
  identityKind INTEGER NOT NULL,
  identityCode TEXT NOT NULL,
  lemma TEXT NOT NULL,
  partOfSpeech TEXT NOT NULL,
  method TEXT NOT NULL,
  evidenceCount INTEGER NOT NULL,
  confidence REAL NOT NULL,
  sourceFingerprint TEXT NOT NULL
);
```

Le schéma physique peut évoluer, mais il doit préserver ces informations.
Les méthodes initiales sont :

- `entity-registry`;
- `step-proper-name`;
- `step-pos-constraint`;
- `cross-version-consensus`;
- `contextual-tagger`;
- `curated-override`.

Chaque sidecar raffiné enregistre dans `ResourceMetadata` la version de
politique, le digest logique des décisions appliquées et les compteurs avant /
après. Un audit externe de release conserve les décisions et des échantillons
localisables.

## Générations strictement additives

- Ne jamais écraser un release candidat existant.
- Une nouvelle politique produit un nouveau dossier de release et une nouvelle
  révision Strong/lexème.
- Les entrées, la politique, l'index de décisions, les audits, le catalogue et
  les checksums sont fingerprintés ensemble.
- Le release précédent reste disponible pour comparaison.
- Une correction éditoriale ultérieure ajoute une décision versionnée; elle ne
  réécrit pas silencieusement l'historique.
- Un nouveau run avec les mêmes entrées et la même politique doit produire le
  même digest logique de décisions.

## Invariants de publication

La génération échoue si :

- un POS publié est vide ou indéterminé;
- une occurrence corrigée n'a pas de méthode et de preuve auditables;
- le digest des décisions diffère entre l'index, les métadonnées et le
  catalogue;
- une entité exacte reconnue reste `verb`;
- `H0430G` sur `God`, `god` ou `gods` reste `verb`;
- `H3068G` sur `Jehovah` reste autre chose que `name`;
- les compteurs avant, corrigés et après ne se recomposent pas;
- un sidecar, un audit ou un index annoncé manque dans les checksums.

Les ambiguïtés lexicales légitimes (`love`, `judge`, `answer`, `saw`, etc.)
restent possibles, mais chaque occurrence conserve un POS concret et apparaît
dans le rapport résiduel lorsqu'aucune preuve ne permet de modifier le tagger.

## Stratégie de livraison

1. figer cet audit de départ;
2. implémenter l'index d'entités et le consensus exact;
3. ajouter les tests unitaires et les canaris inter-Bibles;
4. intégrer la passe finale après reverse-interlinear;
5. générer un nouveau candidat sans toucher au v9;
6. comparer les compteurs avant/après et inspecter les résidus;
7. seulement ensuite promouvoir la nouvelle release.

## Implémentation historique `english-lexeme-refinement@1`

La première politique est implémentée dans :

- `src/englishLexemeRefinement.ts` pour la construction du consensus, les
  preuves d'entité/morphologie, les corrections SQLite et les canaris;
- `src/refineEnglishStrongLexemes.ts` pour la génération additive d'un nouveau
  release, l'index de décisions, les audits, les archives et checksums;
- `tests/englishLexemeRefinement.test.ts` pour les invariants unitaires.

Commande :

```sh
npm run strong:english:lexemes:refine
```

Entrée par défaut de cette politique historique :

`outputs/releases/bible-strong-reverse-interlinear-v9-sanitized-candidate`

Sortie par défaut de cette politique historique, créée seulement si elle
n'existe pas :

`outputs/releases/bible-strong-reverse-interlinear-v10-lexeme-refined-candidate`

Options disponibles :

```sh
npm run strong:english:lexemes:refine -- \
  --input-dir <release-source> \
  --output-dir <nouveau-release> \
  --entity-db <bible_entities.production.sqlite> \
  --step-runtime <bible-step-interlinear-en.sqlite> \
  --generated-at <date-ISO-figée>
```

Le run de validation complet effectué sur le candidat v9 a produit :

- 25 529 décisions de consensus;
- 34 750 corrections appliquées;
- 12 325 corrections par le registre d'entités;
- 2 663 corrections par identité divine;
- 18 707 corrections par consensus multi-Bibles;
- 1 055 overrides `Jehovah` après suppression du Strong source sur-balisé;
- zéro `God/god/gods + H0430G` encore classé `verb`;
- zéro `Jehovah` encore classé `verb`;
- zéro entité reconnue encore classée `verb`;
- zéro POS vide ou indéterminé.

Digest logique des décisions de ce run :

`079bbb8aa86c492b70318fb51fb72e5592e86984f165b7e5cfeebc252ac8768b`

Le candidat additif validé est disponible dans :

`outputs/releases/bible-strong-reverse-interlinear-v10-lexeme-refined-candidate`

SHA-256 de son catalogue :

`8ad7c7dfcffbf1ae7892beba40690124b740be2623153dc0bfbbd4c31550a5a5`

SHA-256 de l'index SQLite des décisions :

`238b91d2d3bb3baa3378b3d98b925ae469d9e9e7518dc0928080520076b5c36a`

Les checksums de tous les fichiers du release ont été validés. Les neuf
sidecars retournent `PRAGMA integrity_check = ok`, zéro erreur de clé
étrangère, la même politique et le même digest de décisions.

## Contre-audit KJV/ASV du 2026-07-30

Le contrôle mécanique ci-dessus ne suffit pas à promouvoir le candidat v10.
Un audit stratifié de 100 identités Strong partagées par KJV et ASV a trouvé
des faux `name` systématiques :

- 468 formes minuscules `god/gods` promues par `divine-identity`;
- 544 formes minuscules promues par `entity-registry`, principalement
  `sabbath`, `passover`, `river`, `hell`, `lord`, `man` et `great`;
- 1 012 corrections suspectes vers `name` au total dans l'échantillon.

Le candidat v10 est donc **mécaniquement valide mais sémantiquement à
corriger**. Il ne doit pas être promu en l'état.

Le rapport durable, la cause racine, la commande reproductible et le contrat
du prochain candidat additif sont documentés dans
`docs/english-lemma-pos-sample-audit.md`.

## Implémentation courante `english-lexeme-refinement@9`

La politique courante ajoute à la première passe :

- WordNet via `wink-lexicon` comme inventaire des POS lexicaux possibles;
- `wink-lemmatizer` pour les formes fléchies;
- le tagueur contextuel sur la phrase canonique complète;
- des règles anglaises versionnées pour les formes bibliques/archaïques;
- la distinction de surface `God` / `god` / `gods`;
- la reconnaissance des noms propres composés avec trait d'union;
- un repli toujours concret et un journal de faible marge;
- un digest des sources de WordNet, du lemmatiseur, du tagueur, du tokenizer
  et de leurs dépendances effectives.

Fichiers autoritatifs :

- `src/englishPosResolver.ts` : candidats lexicaux, analyse contextuelle et
  ordre des preuves;
- `src/englishLexemeRefinement.ts` : décisions, consensus, application SQLite
  et canaris;
- `src/refineEnglishStrongLexemes.ts` : génération additive, provenance,
  archives et checksums;
- `src/auditEnglishStrongLexemeSample.ts` : audit stratifié KJV/ASV;
- `src/diagnoseEnglishLexemeCanaries.ts` : diagnostic localisable lorsqu'un
  canari bloque une génération;
- `tests/englishPosResolver.test.ts`,
  `tests/englishLexemeRefinement.test.ts` et
  `tests/auditEnglishStrongLexemeSample.test.ts`.

Commandes :

```sh
npm run strong:english:lexemes:refine -- \
  --generated-at 2026-07-30T00:00:00.000Z
npm run strong:english:lexemes:audit -- \
  --sample-from outputs/audits/english-lexeme-pos-kjv-asv-v10-sample-100-v3/audit.json
npm run strong:english:lexemes:diagnose -- \
  --release outputs/releases/bible-strong-reverse-interlinear-v18-wordnet-context-candidate \
  --bible KJV
```

Le générateur refuse d'écraser une sortie. Pour toute nouvelle politique,
incrémenter le nom du release, le nom de l'index/audit et les identifiants de
politique; repartir du dernier parent accepté explicitement, jamais d'un
candidat rejeté.

### Release v18

Parent : `bible-strong-reverse-interlinear-v10-lexeme-refined-candidate`.
Le choix de ce parent est intentionnel : v11 à v16 ont servi de candidats de
diagnostic et ne sont pas chaînés dans v18. V17 est également rejeté et n'est
pas un parent de v18.

- release :
  `outputs/releases/bible-strong-reverse-interlinear-v18-wordnet-context-candidate`;
- index :
  `lexemes/english-lexeme-decisions-v9.sqlite`;
- décisions lexicales : 27 591;
- corrections : 86 835;
- digest logique des décisions :
  `617295063c1884bd6f89fa7ca01f90b6b69b9e7e6fe7089d9103c9edaafb8f79`;
- SHA-256 du catalogue :
  `c5a042e061e5c2b7cf3e2a987f96b63895b49cfe9e8274c1a3db43687c9175a9`;
- SHA-256 de l'index :
  `83745e90bc541e07be4bf26d89246d2cbeb88712b8970caea5fedb53e9eacc58`;
- SHA-256 des ressources lexicales :
  `6f729da8bd63ba6df031c8c1dd978f7ea4740f7d67f9d0c03493f0493e52c85c`.

Les neuf Bibles ont zéro pour chacun des canaris : `H430G` verbe,
`H430G` commun non-nom, `H430G` divin non-name, `Jehovah` non-name, entité
capitalisée verbe, `name` sans forme propre reconnue et POS indéterminé.
Tous les fichiers annoncés dans `SHA256SUMS` ont été revérifiés.

### Historique des candidats rejetés

Tous les dossiers restent immuables pour permettre la comparaison.

- v10 : registre d'entités trop fort; `god/gods`, `sabbath`, `river`, etc.
  promus à tort vers `name`;
- v11 : WordNet appliqué trop largement, y compris aux classes fermées;
- v12 : périmètre réduit mais encore trop agressif;
- v13 : garde du tagueur insuffisante;
- v14 : le tagueur pouvait encore renverser des décisions lexicales uniques;
- v15 : 3 155 occurrences `name` minuscules dans l'échantillon;
- v16 : corrigeait ces formes, mais la morphologie source précédait encore
  les règles anglaises (`saith→noun`, `ye→verb`, `liveth→adj`) et des noms
  composés comme `Kiriath-jearim` étaient déclassés;
- v17 : règles anglaises prioritaires et noms composés conservés, mais garde
  de capitalisation trop large (`Behold` restait `name`);
- v18 : garde restreinte aux vrais composés capitalisés, `Behold→verb`,
  candidat courant ayant passé les gates.

Le compteur historique `knownLowercaseName` signifie désormais « `name` sans
forme propre reconnue ». Une tête capitalisée, un composé propre capitalisé
confirmé par le contexte ou l'exception technique d'un lemme d'un caractère
est accepté; une forme réellement minuscule non justifiée bloque la release.
