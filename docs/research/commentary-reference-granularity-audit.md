# Audit de granularité des références des commentaires

Date de l'audit : 28 août 2026

Périmètre : bibliothèque active `apps/resource-studio/workflows/commentaries/.local/library`, telle que référencée par son `index.json` (TSK exclu).

Nature de l'intervention : audit en lecture seule ; aucune donnée et aucun importeur n'ont été modifiés.

> État du chantier : ce document conserve les mesures de l'instantané antérieur au contrat de portée. La mise en œuvre issue de l'audit est désormais décrite dans `apps/resource-studio/workflows/commentaries/README.md` : contrat `chapter-json-v2`, index de couverture, parseurs ciblés et déduplication réversible de Barnes.

## Résumé exécutif

L'intuition de départ est confirmée : une part importante des textes n'est pas réellement de granularité « un commentaire = un verset », même si le prototype les présente aujourd'hui ainsi.

Le constat le plus important n'est cependant pas un défaut unique des sources. Trois situations différentes sont actuellement aplaties dans le même champ `passage` :

1. **Plages structurées et fiables** : Aquifer et MHM possèdent `passageEnd`; SDABC/EGW possède un champ analogue, `passageEndVerse`. Elles totalisent au moins **13 621 unités multiversets déclarées**. Le lecteur ne consulte aucun de ces deux champs et filtre exclusivement par égalité avec `entry.passage`.
2. **Plages visibles dans le texte, perdues comme structure** : Barnes, MHY-FR, MHCC, JFB, Bible Annotée, Keil & Delitzsch, Luther, Fourfold Gospel et plusieurs autres commencent fréquemment par « Verses 3–5 », « Ge 1:3–5 », « (3–5) », etc., mais leur JSON ne contient pas de fin de plage.
3. **Œuvres de niveau chapitre, psaume, section ou homélie** : MHC, Treasury of David, Calvin, Augustin, Chrysostome, Catena Aurea, Luther et KingComments contiennent beaucoup d'unités longues qui ne devraient pas être interprétées comme une simple note sur le seul verset d'ancrage.

L'effet dans l'interface est direct : `app.js` regroupe puis affiche les entrées par égalité stricte de `passage` (`passageGroups`, puis `entry.passage !== state.passage`). Ainsi, une unité Aquifer `1-1-3`–`1-1-13`, pourtant correctement déclarée, n'apparaît qu'en Genèse 1.3 ; JFB « Ge 1:3–5 » n'apparaît également qu'au verset 3 ; le commentaire intégral d'un psaume de *Treasury of David* est attaché au verset 1.

## Corpus et intégrité de l'échantillon

Le contrôle `node apps/resource-studio/workflows/commentaries/scripts/validate-library.mjs` réussit et donne :

- **31 corpus** ;
- **315 301 unités** ;
- **1 273 chapitres indexés** ;
- **23 503 chunks JSON actifs**.

Seuls les chemins référencés par `apps/resource-studio/workflows/commentaries/.local/library/index.json` ont été analysés. Des fichiers locaux devenus orphelins peuvent exister sous `.local/library/chunks` après des installations successives ; ils ne font pas partie de cet audit.

## Méthodologie

### Mesures exactes

Pour chaque entrée active, l'audit a compté :

- l'ancre `passage` et les ancres distinctes ;
- les fins de plage `passageEnd` différentes de `passage` ;
- les fins de plage SDABC/EGW `passageEndVerse` supérieures au verset d'ancrage ;
- les versets 0 et, séparément, les passages `livre-0-0` ;
- les ancres possédant plusieurs unités ;
- les corps dont le hash exact est réutilisé à plusieurs ancres, notamment sur des versets adjacents ;
- les volumes éditoriaux (`editorialKind`) lorsqu'ils existent ;
- les longueurs et balises de paragraphes comme propriétés matérielles, sans en déduire automatiquement une plage.

### Indices heuristiques

Une seconde passe a recherché dans les 180 premiers caractères visibles les formes telles que `Verses 3-5`, `V.5-10`, `Gen 1:3-5`, `(3-5)` et `3-5.`. Cette mesure est notée **P** dans le tableau. Elle signale des candidats à relire, pas des plages certaines : une référence croisée placée au début peut produire un faux positif ; inversement, une plage formulée en prose ou après 180 caractères échappe au test.

La colonne **L** compte les unités d'au moins 1 000 mots. C'est un indice de granularité large, jamais une preuve : un commentaire très détaillé peut légitimement porter sur un seul verset.

Les termes **confirmé**, **fortement indiqué** et **possible** sont employés comme suit :

- *confirmé* : information portée par un champ de structure ou par une répétition de hash exacte ;
- *fortement indiqué* : intitulé de plage cohérent avec l'ancre et/ou organisation documentée de l'importeur ;
- *possible* : longueur, paragraphes ou références internes seulement.

## Résultats globaux exacts

| Mesure | Nombre | Part des 315 301 unités | Interprétation |
|---|---:|---:|---|
| `passageEnd` différent de `passage` | 10 520 | 3,34 % | 6 286 Aquifer + 4 234 MHM |
| dont plages Aquifer franchissant un chapitre | 223 | 0,07 % | nécessite un index de couverture inter-chapitres |
| `passageEndVerse` réellement multiverset | 3 101 | 0,98 % | SDABC/EGW ; champ non standard par rapport à `passageEnd` |
| Total minimal de plages structurées | 13 621 | 4,32 % | minimum certain, avant toute récupération textuelle |
| Entrées au verset 0 | 3 417 | 1,08 % | introductions ou contenu de chapitre/livre |
| dont `livre-0-0` | 258 | 0,08 % | principalement introductions de livre CrossWire/ThéoTeX |
| Entrées dont le même corps exact existe à plusieurs ancres | 10 114 | 3,21 % | tous les doublons ne sont pas des erreurs |
| Entrées dans une répétition exacte sur des versets adjacents | 6 224 | 1,97 % | 6 214 proviennent de Barnes |
| Entrées d'au moins 1 000 mots | 12 229 | 3,88 % | indice seulement |

Pour mesurer l'effet potentiel sur la navigation, une seconde mesure exacte a déplié uniquement les plages structurées qui restent dans un même chapitre. Le lecteur pourrait ainsi retrouver **50 782 liens unité-verset supplémentaires** sans aucune inférence : 31 441 pour Aquifer FR, 7 245 pour MHM et 12 096 pour SDABC/EGW. Ce sont des liens de couverture, pas 50 782 nouveaux commentaires : plusieurs unités peuvent couvrir le même verset, et les 223 plages Aquifer inter-chapitres ne sont pas incluses dans ce total.

Par soustraction, **298 263 unités (94,60 %) ont aujourd'hui l'apparence structurelle d'une unité mono-verset ordinaire** : pas de plage structurée multiverset et pas de verset 0. Ce chiffre ne signifie pas qu'elles portent réellement sur un seul verset ; il montre précisément l'ampleur de l'information qui reste implicite dans le HTML.

## Tableau par ressource

Légende : **V0** = ancrage verset 0 ; **R** = plage structurée (`passageEnd`) ; **A** = plage structurée auxiliaire (`passageEndVerse`) ; **D** = entrées dans une répétition exacte sur des versets adjacents ; **P** = préfixes de plage détectés heuristiquement (y compris les répétitions dont le début de plage ne correspond plus au verset courant) ; **L** = unités ≥ 1 000 mots.

| Ressource | Unités | V0 | R | A | D | P (heur.) | L (heur.) | État des lieux |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| ACBC | 20 794 | 0 | 0 | 0 | 0 | 311 | 245 | Plutôt verset ; quelques références initiales et longs développements à revoir. |
| Barnes | 24 224 | 0 | 0 | 0 | 6 214 | 7 190 | 2 927 | **Plages fortement confirmées par duplication exacte** ; cas prioritaire. |
| MHY-FR | 4 145 | 77 | 0 | 0 | 2 | 3 300 | 1 | Résumés de plages du type `(3-5)` attachés au premier verset. |
| Aquifer FR | 16 923 | 0 | 6 286 | 0 | 0 | 3 978 | 0 | Structure native la plus fiable ; 223 plages inter-chapitres. Le P brut est redondant/faux positif possible. |
| MHCC | 4 059 | 12 | 0 | 0 | 0 | 3 400 | 1 | `Verses n-m` très fréquent, mais fin perdue par `parseImp`. |
| JFB | 16 945 | 63 | 0 | 0 | 0 | 4 270 | 49 | Groupes de versets explicites dans le corps, attachés seulement au premier verset. |
| Wesley | 16 930 | 29 | 0 | 0 | 0 | 67 | Majoritairement verset ; 461 corps répétés entre ancres non adjacentes à contrôler. |
| Augustin FR | 1 726 | 3 | 0 | 0 | 0 | 192 | 427 | Homélies/livres étendus : l'ancre est surtout un point d'entrée. |
| Chrysostome FR | 693 | 17 | 0 | 0 | 0 | 20 | 614 | Presque toutes les unités sont longues ; granularité homélie, non verset. |
| Calvin | 11 063 | 0 | 0 | 0 | 0 | 35 | 1 684 | Mélange verset/section ; longueurs fortes, aucune plage structurée. |
| Treasury of David | 151 | 1 | 0 | 0 | 0 | 2 | 150 | **Un commentaire complet par psaume**, ancré au verset 1 ; cas chapitre certain par construction. |
| Rachi EN | 28 060 | 0 | 0 | 0 | 0 | 26 | 0 | Granularité réellement verset, avec plusieurs gloses possibles par ancre (7 523 ancres multiples). |
| Bible Annotée | 23 320 | 694 | 0 | 0 | 2 | 294 | 107 | 667 introductions de chapitre + 27 de livre ; plages visibles (`3-5`, etc.) non structurées. Le détecteur conservateur sous-compte ces formes. |
| Abbott | 3 367 | 27 | 0 | 0 | 0 | 128 | 1 | Plutôt verset/section ; quelques corps exacts répétés entre ancres. |
| Burkitt | 3 276 | 0 | 0 | 0 | 0 | 7 | 51 | Peu d'indices automatiques de plage ; contenu parfois long. |
| Catena Aurea | 821 | 0 | 0 | 0 | 0 | 4 | 524 | Unités de péricopes/chaînes patristiques, souvent très longues. |
| Darby Notes | 8 873 | 1 189 | 0 | 0 | 0 | 17 | 0 | Une entrée verset 0 par chapitre ; 1 251 corps exacts répétés entre ancres, à distinguer des notes de verset. |
| Family Notes | 5 306 | 7 | 0 | 0 | 0 | 337 | 0 | Majoritairement verset ; quelques groupes et références initiales. |
| Geneva Notes | 14 713 | 18 | 0 | 0 | 0 | 8 | 0 | Principalement verset ; 294 entrées dans des corps répétés entre ancres. |
| Keil & Delitzsch | 8 806 | 1 | 0 | 0 | 0 | 5 144 | 898 | Très nombreux intitulés de sections/plages ; ancrage de début insuffisant. |
| KingComments | 7 590 | 0 | 0 | 0 | 0 | 596 | 938 | Sections longues de chapitre, souvent introduites par un passage plus large. |
| Lightfoot | 853 | 4 | 0 | 0 | 0 | 2 | 65 | Corpus sélectif et long ; ancre de point d'entrée. |
| Luther | 754 | 46 | 0 | 0 | 0 | 398 | 415 | Sections `V. n-m`, préfaces et commentaires longs ; granularité large. |
| MHC | 5 360 | 1 111 | 0 | 0 | 0 | 165 | 2 914 | Commentaire complet organisé surtout au niveau chapitre/section ; V0 massif. |
| PNT | 6 084 | 16 | 0 | 0 | 0 | 388 | 0 | Verset avec quelques sections/péricopes implicites. |
| RWP | 7 228 | 27 | 0 | 0 | 0 | 161 | 16 | Principalement verset, avec introductions et quelques groupes explicités en prose. |
| Scofield | 3 214 | 7 | 0 | 0 | 6 | 312 | 1 | Principalement note de verset ; répétitions et quelques plages textuelles. |
| Fourfold Gospel | 4 229 | 2 | 0 | 0 | 0 | 557 | 26 | Nombreux blocs numérotés couvrant des péricopes ; fin non structurée. |
| MHM | 21 367 | 0 | 4 234 | 0 | 0 | 4 118 | Plages partielles structurées ; titres de section `Genesis 1:3-5` supplémentaires dans le HTML. |
| SDABC + EGW | 42 768 | 66 | 0 | 3 101 | 0 | 3 135 | Plages fiables mais sous le champ distinct `passageEndVerse`; mélange de 4 couches éditoriales. |
| Douay–Rheims notes | 1 659 | 0 | 0 | 0 | 0 | 0 | 2 | Objets JSON source attachés à leur verset publié ; ne pas reconstruire de plage. |

## Exemples probants

### Plage déjà structurée mais non utilisée

Dans `chunks/1/1/aquifer-fr.json`, l'entrée `aquifer:12237` porte :

```json
{"passage":"1-1-3","passageEnd":"1-1-13"}
```

Dans `chunks/1/1/sdabc.json`, l'entrée `egw-ecsi:14275.15` porte `passage: "1-1-6"`, `passageEndVerse: 9` et `referenceLabel: "Genesis 1:6-9"`.

### Corps exact Barnes répété sur chaque verset d'une plage

Dans `chunks/1/1/barnes.json`, les ancres 1.3, 1.4 et 1.5 ont le même hash et commencent toutes par `Verses 3-5`. On trouve de même des séries 1.6–8, 1.9–13 et 1.14–19. L'audit dénombre 672 séries adjacentes, 6 214 occurrences et une série maximale de 72 versets. Ce n'est pas une coïncidence textuelle : la source a vraisemblablement projeté une unité de plage sur chacun de ses versets.

### Plage seulement textuelle

- `chunks/1/1/jfb.json`, entrée `jfb:1-1-3:4` : `Ge 1:3-5. The First Day` ;
- `chunks/1/1/mhy-fr.json`, entrée `mhy-fr:1-1-3` : `La création de la lumière. (3-5)` ;
- `chunks/1/1/bible-annotee.json`, entrée `bible-annotee:1-1-3:...` : `3-5. Le premier jour` ;
- `chunks/1/1/mhcc.json`, entrée `mhcc:1-1-3:2` : `Verses 3-5`.

### Niveau chapitre ou psaume

*Treasury of David* possède 151 unités pour 151 chunks : une introduction et un texte très long par psaume, presque toujours au verset 1. Cent cinquante unités sur 151 dépassent 1 000 mots. L'ancre ne décrit donc pas la portée.

MHC possède 1 111 entrées au verset 0 et 2 914 unités dépassant 1 000 mots. Darby possède 1 189 entrées au verset 0. Ces entrées doivent être rendues comme contenus de chapitre/introduction et non comme commentaires d'un « verset zéro ».

## Ce que font réellement les importeurs

### Firestore : ACBC et Barnes

`apps/resource-studio/workflows/commentaries/scripts/export-firestore.mjs` copie directement `comment.verseId` vers `passage`. Aucun champ de fin n'est lu ou calculé. Pour Barnes, la répétition exacte montre que l'amont contient déjà le même bloc sous plusieurs documents-versets ; l'exporteur le conserve fidèlement.

### SQLite MHY-FR

`apps/resource-studio/workflows/commentaries/scripts/build-library.mjs` lit l'objet `commentaires` de chaque chapitre et transforme chaque clé numérique en `${book}-${chapter}-${verse}`. Les plages présentes dans les titres français ne sont pas interprétées.

### Aquifer

Le même `build-library.mjs` est le meilleur cas : il mappe `association.start_ref` vers `passage` et `association.end_ref` vers `passageEnd`. L'information source est conservée, y compris 223 plages inter-chapitres.

### CrossWire vagues 1–3

`apps/resource-studio/workflows/commentaries/scripts/wave-sources.mjs`, fonction `parseImp`, n'accepte que les clés IMP de forme `Livre chapitre:verset` et produit uniquement `passage`. Les indications de portée contenues dans le HTML restent du texte. Cela concerne MHCC, JFB, Wesley, Augustin, Chrysostome, Calvin, Treasury of David et les modules CrossWire de la vague 3.

`apps/resource-studio/workflows/commentaries/scripts/export-wave-corpora.mjs` conserve pour Rachi l'imbrication Sefaria livre/chapitre/verset ; ses nombreuses unités par ancre sont donc des gloses distinctes, pas des plages perdues.

### MHM

`apps/resource-studio/workflows/commentaries/scripts/wave-3-sources.mjs`, fonction `parseMhmChapter`, incrémente un compteur de verset pour chaque `<span class="verse">`. Il ne crée `passageEnd` que si le corps contient exactement une forme forte `v. n-n`. Les titres de groupe tels que `<strong>Genesis 1:3-5: ...</strong>` ne sont pas captés par cette règle. Ils peuvent cependant représenter un contexte de section suivi d'unités propres à chaque verset ; il ne faut pas les convertir aveuglément en duplication intégrale.

### Bible Annotée

`apps/resource-studio/workflows/commentaries/scripts/bible-annotee-sources.mjs` conserve les marqueurs de verset ThéoTeX, crée explicitement les `chapter-introduction` et `book-introduction`, mais ne dérive aucune fin depuis les intitulés tels que `3-5.`. Cette retenue est saine tant qu'un processus éditorial distinct n'a pas validé les plages.

### SDABC et EGW

`apps/resource-studio/workflows/commentaries/scripts/sdabc-sources.mjs` analyse les en-têtes imprimés et calcule `passageEndVerse`. `apps/resource-studio/workflows/commentaries/scripts/egw-sources.mjs` fait de même depuis les expressions de référence EGW. `apps/resource-studio/workflows/commentaries/scripts/install-sdabc-library.mjs` fusionne quatre couches : 24 996 commentaires généraux, 66 introductions, 3 664 suppléments EGW et 14 042 entrées d'index scripturaire. Le problème n'est pas l'extraction, mais l'absence d'unification de `passageEndVerse` avec le contrat commun et son omission au rendu.

### Douay–Rheims

`apps/resource-studio/workflows/commentaries/scripts/export-douay-rheims.mjs` mappe mécaniquement `annotation.verse` vers `passage`, conformément à la politique `accepted-as-published` du manifeste `.local/douay-rheims-export/manifest.json`. Aucune restauration de plage n'est recommandée.

## Typologie des problèmes

### 1. Modèle de portée incomplet

`passage` sert à la fois d'identifiant d'ancrage, de début de plage et de clé d'affichage. Il manque une notion uniforme de **portée** et de **niveau éditorial**.

### 2. Donnée correcte, interface incorrecte

Le lecteur `apps/resource-studio/workflows/commentaries/app.js` ignore `passageEnd` et `passageEndVerse`. Il ne montre que les entrées dont le début est exactement le verset sélectionné. C'est le défaut à corriger en premier, car il ne demande aucune inférence éditoriale pour 13 621 unités.

### 3. Chunking incompatible avec les plages inter-chapitres

`build-library.mjs` range une unité dans le chunk de son `passage` initial. Une recherche de couverture dans le seul chunk du chapitre courant ne retrouvera pas les 223 plages Aquifer commencées dans un chapitre précédent. Un index secondaire est nécessaire.

### 4. Perte de structure CrossWire

Le format IMP remis par `mod2imp` expose une clé ponctuelle ; les plages peuvent se trouver dans le corps ou avoir été projetées par le module sur plusieurs versets. `parseImp` ne les représente pas. Barnes illustre la projection répétée, JFB/MHCC l'ancrage au début seulement.

### 5. Section et commentaire de verset mélangés

MHM peut placer un résumé de section `1:3-5` au début de l'entrée du verset 3, puis fournir des commentaires spécifiques aux versets 4 et 5. Étendre toute l'entrée 3 à 5 créerait une présentation trompeuse. Le modèle doit pouvoir distinguer `sectionRange` et `commentaryRange`.

### 6. Introduction non homogène

Une introduction peut être `book-0-0`, `book-1-0`, `book-chapter-0` ou seulement une unité au verset 1. `editorialKind` n'est pas présent partout. Le nombre 0 ne suffit pas comme modèle éditorial.

### 7. Longueur interprétée à tort comme portée

Les 12 229 unités de plus de 1 000 mots justifient une ergonomie adaptée, mais pas une attribution automatique à plusieurs versets. Les corpus patristiques et Calvin exigent une décision éditoriale par œuvre.

## Recommandations

### Priorité 1 — exploiter sans inférence les données déjà structurées

1. Normaliser à la lecture `passageEndVerse` en un `passageEnd` canonique, sans réécrire la source.
2. Afficher un libellé de portée (`Genèse 1.3–13`) sur la carte.
3. Lorsqu'un verset est sélectionné, inclure les unités dont la plage structurée contient ce verset.
4. Générer dans l'index un `coverageIndex` vers les chunks de départ, indispensable aux 223 plages inter-chapitres.
5. Conserver la distinction SDABC entre commentaire général, supplément EGW et index scripturaire.

Cette étape améliore immédiatement Aquifer, MHM et SDABC/EGW sans modifier un seul texte ni deviner une portée.

### Priorité 2 — modéliser les niveaux éditoriaux

Introduire, au minimum :

```ts
type CommentaryScope =
  | { kind: 'verse'; start: Passage; end?: Passage }
  | { kind: 'section'; start: Passage; end?: Passage }
  | { kind: 'chapter'; book: number; chapter: number }
  | { kind: 'book'; book: number }
```

Et conserver séparément `anchor` (où ouvrir l'œuvre), `scope` (où elle s'applique) et `editorialKind` (commentaire, introduction, résumé de section, index, supplément).

### Priorité 3 — corrections déterministes par corpus

- **Barnes** : regrouper les séries adjacentes ayant le même hash en une seule unité à plage ; conserver la liste des ancres sources dans la provenance. Le signal est exact et réversible.
- **MHCC, JFB, MHY-FR** : écrire des parseurs propres à l'œuvre pour les intitulés de tête et produire une liste d'anomalies ; ne publier les fins que si le début correspond à l'ancre et si les bornes sont canoniques.
- **Bible Annotée** : analyser séparément les titres de section, sans toucher aux 667 introductions de chapitre ni aux 27 introductions de livre.
- **MHM** : distinguer le titre de section du commentaire du verset avant d'élargir quoi que ce soit.
- **SDABC/EGW** : renommer mécaniquement le champ de fin dans la représentation commune ; aucune OCR supplémentaire n'est nécessaire pour les 3 101 plages déjà reconnues.

### Priorité 4 — profils éditoriaux par œuvre

- `treasury-david` : déclarer explicitement `chapter/psalm`, pas `verse 1` ;
- `mhc` et `darby-notes` : exposer les entrées V0 dans une zone « aperçu/introduction du chapitre » ;
- `fre-aug`, `fre-chry`, `catena-aurea`, `luther` : préférer « section/homélie liée à ce passage » à « commentaire de ce verset » ;
- `rashi-en` et `douay-rheims-notes` : préserver le rattachement source, sans reconstruction automatique ;
- `sdabc` : ne jamais compter l'index EGW comme commentaire exégétique ordinaire.

### Priorité 5 — ne pas faire

- Ne pas déduire une plage uniquement parce qu'un texte dépasse un seuil de longueur.
- Ne pas convertir toute référence biblique initiale en portée.
- Ne pas dupliquer physiquement les corps sur chaque verset ; résoudre la couverture au moment de l'indexation/lecture.
- Ne pas « compléter » Douay–Rheims au-delà des objets JSON publiés.
- Ne pas fusionner des unités de même hash non adjacentes sans comprendre l'importeur ; certains refrains ou notes standard sont légitimes.

## Plan de travail recommandé

1. **Contrat et lecteur** : prise en charge de `passageEnd`/`passageEndVerse`, libellé de plage, index de couverture inter-chapitres.
2. **Cas déterministe Barnes** : regroupement par hash + ancres adjacentes, avec tests sur Genèse 1.3–5, 1.6–8, 1.9–13.
3. **Profils chapitre** : Treasury of David, MHC, Darby, introductions Bible Annotée.
4. **Parseurs ciblés** : MHCC, JFB, MHY-FR, puis KD/Fourfold/Luther.
5. **Revue éditoriale** : MHM (section versus verset), corpus patristiques et Calvin.

Cette séquence traite d'abord les faits certains et laisse les inférences textuelles dans un chantier réversible et contrôlable.

## Limites

- L'audit porte sur l'instantané local du 28 août 2026 ; une reconstruction de la bibliothèque peut changer les comptes.
- Il ne compare pas les textes aux éditions imprimées ni aux sites distants.
- Les hashes comparent les corps dans leur langue disponible et leur HTML exact ; une différence de balisage empêche de reconnaître une répétition sémantique.
- Le détecteur P ne comprend ni toutes les langues ni toutes les formes typographiques et produit des faux positifs de références croisées.
- `L ≥ 1 000 mots` et le nombre de paragraphes décrivent la taille, pas la portée.
- La validité canonique complète des fins de plage n'a pas été revue verset par verset ; les valeurs structurées ont été acceptées comme données de l'importeur.

## Fichiers locaux de référence

- Bibliothèque : `apps/resource-studio/workflows/commentaries/.local/library/index.json` et `apps/resource-studio/workflows/commentaries/.local/library/chunks/**`.
- Rendu actuel : `apps/resource-studio/workflows/commentaries/app.js`.
- Validation : `apps/resource-studio/workflows/commentaries/scripts/validate-library.mjs`.
- Assemblage général, MHY et Aquifer : `apps/resource-studio/workflows/commentaries/scripts/build-library.mjs`.
- Firestore ACBC/Barnes : `apps/resource-studio/workflows/commentaries/scripts/export-firestore.mjs`.
- CrossWire/Sefaria : `apps/resource-studio/workflows/commentaries/scripts/wave-sources.mjs` et `apps/resource-studio/workflows/commentaries/scripts/export-wave-corpora.mjs`.
- Vague 3/MHM : `apps/resource-studio/workflows/commentaries/scripts/wave-3-sources.mjs` et `apps/resource-studio/workflows/commentaries/scripts/export-wave-3.mjs`.
- Bible Annotée : `apps/resource-studio/workflows/commentaries/scripts/bible-annotee-sources.mjs` et `apps/resource-studio/workflows/commentaries/scripts/export-bible-annotee.mjs`.
- SDABC : `apps/resource-studio/workflows/commentaries/scripts/sdabc-sources.mjs`, `apps/resource-studio/workflows/commentaries/scripts/export-sdabc.mjs`, `apps/resource-studio/workflows/commentaries/scripts/install-sdabc-library.mjs`.
- EGW : `apps/resource-studio/workflows/commentaries/scripts/egw-sources.mjs`, `apps/resource-studio/workflows/commentaries/scripts/export-egw.mjs`.
- Douay–Rheims : `apps/resource-studio/workflows/commentaries/scripts/export-douay-rheims.mjs` et `.local/douay-rheims-export/manifest.json`.
- Manifestes de provenance : `.local/full-export/manifest.json`, `.local/wave-export/manifest.json`, `.local/wave-3-export/manifest.json`, `.local/bible-annotee-export/manifest.json`, `.local/sdabc-export/manifest.json`, `.local/egw-export/manifest.json`, `.local/douay-rheims-export/manifest.json`.
