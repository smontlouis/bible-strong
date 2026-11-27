# Versification dans Bible Strong : inventaire et proposition

**Date :** 27 novembre 2026

**Périmètre :** les 47 Bibles du catalogue de l'app (`apps/expo/src/helpers/bibleVersions.ts`) et toutes les ressources liées à un verset. Préparé pour la **fiche de verset** de Strobi, dont la clé de cache dépend de la versification.

**Méthode :**
- Lecture du code et des ADR 0010, 0011, 0012, 0013, 0018, 0030, 0066, 0071, 0073, 0078, 0088 et 0115.
- Lecture de l'API de ressources publique (`api.bible-strong.app`, routes GET uniquement) et des pages publiques du site.
- Comparaison avec les tables Paratext `eng`, `org`, `lxx` et `vul`.

**Ce qui n'a pas été fait :** aucune requête Neon, aucune écriture en production.

**Mise à jour du 27 novembre 2026, après la décision.** Rien n'est commité.

- **Étape 1, faite.** Le module `packages/resource-domain/src/versification.ts` et ses tables `org`, `bs-eng`, `bs-kjv` et `bs-nrsv` sont écrits.
- **Lot A, fait : l'app.** L'étude sous le verset et les cartes Références croisées, Nave et Dictionnaire convertissent leurs clés : Trésor, Nave, dictionnaires, extraits de commentaires, autres versions et ligne BHG.
- **Lot B, fait, pas encore déployé : le service et le site.** La route `/v1/verse-studies` accepte `numbering=org&reader=<numérotation>`. Le site l'appelle ainsi pour une Bible dont la numérotation est connue, puis reconvertit les cibles, les renvois de commentaires, les autres versions et la ligne hébraïque.
- **Vérification sur les données publiques réelles.** Les clés calculées par le module ont été comparées au texte, sur huit cas : Ps 51:3 en LSG et en KJF, Mal 3:23 en LSG, Mal 4:5 en KJV, Joël 3:1, Gn 32:2, 2 Co 13:12 et Ps 3:2.
- **Reste à faire.**
  - Les mots Strong empruntés par une Bible sans index Strong (KJF) dans l'app.
  - Les entités par chapitre dans l'app.
  - Les écrans de chapitre d'un commentaire et les commentaires dans le texte.
  - La lecture parallèle et la comparaison.
  - Les écrans de thèmes Nave.

**Révisions lues le 27 novembre 2026 :**
- `lsg-73efd3ba244d460ecd27`
- `tresor-f67397f0612312af5839`
- `nave-fr-90bcd10e1eb04cfb57fb` et `nave-en-a3ca283196d0eb084276`
- `acbc-fr-279d188d0459a1b82755`

Le projet d'ADR qui accompagne ce document est [`versification-adr-draft.md`](./versification-adr-draft.md).

## Synthèse

**Deux numérotations sont en usage, sous une seule étiquette.**
- Bible Strong publie la plupart de ses Bibles sous l'étiquette `bible-strong-default`.
- Ce nom ne désigne aucune numérotation précise :
  - LSG, NBS, DBY, DBR et NVS78P suivent **exactement** la numérotation hébraïque, `org` de Paratext : titres des psaumes comptés comme versets, Joël en 4 chapitres, Malachie en 3 ;
  - KJV, KJF, BSB, NASB et la plupart des Bibles anglaises suivent la numérotation **anglaise**, `eng`, à deux chapitres près.

**Les ressources liées à un verset sont presque toutes en numérotation anglaise.**
- C'est le cas des références croisées (Trésor), de la Nave française comme anglaise, d'environ vingt commentaires, des entités et du texte interlinéaire BHG (NRSV).

**Aucune conversion n'a lieu entre les deux.** L'app et le site demandent la ressource au numéro affiché.
- Un lecteur de la LSG voit donc des références croisées, des thèmes, des commentaires et une ligne hébraïque « mot à mot » qui appartiennent à un autre verset.
- Cela concerne **au plus 143 chapitres et 3 150 versets**, dont 62 psaumes.
- L'erreur va aussi dans l'autre sens. Un lecteur de la KJF voit, sous son verset, les mots de la LSG d'un autre verset.

**Ce qui est sûr aujourd'hui :** les index Strong des Bibles et les décisions sur les paroles de Jésus. Les premiers passent par l'identifiant de mot, les secondes sont propres à chaque Bible.

**Recommandation :**
1. Nommer la vraie versification de chaque Bible et de chaque ressource.
2. Embarquer les tables Paratext sous licence MIT (`org` comme pivot), complétées par nos propres `.vrs` pour les numérotations françaises mixtes.
3. Convertir à la lecture, dans `@bible-strong/resource-domain`.
4. Construire la fiche de verset sur des clés `org` dès le départ.

---

## 1. Ce que le dépôt sait aujourd'hui de la versification

### 1.1 Les identifiants déclarés

`BibleVersificationId` (`apps/expo/src/helpers/bibleVersions.ts:7`) accepte cinq valeurs.

| Identifiant | Bibles | Ce qu'il désigne |
|---|---|---|
| `bible-strong-default` | 43 Bibles sur 47, y compris toutes celles qui ne déclarent rien | Rien de précis : LSG (hébraïque) et KJV (anglaise) le portent toutes les deux |
| `bible-strong-french-4-chapter-joel` | LAU | Numérotation anglaise, mais Joël en 4 chapitres |
| `bible-strong-catholic-extended-esther-daniel` | BCC1923 | Esther en 16 chapitres et Daniel en 14 (ADR-0012) |
| `theotex-septuagint` | LXX | Septante ThéoTeX (ADR-0018) |
| `clementine-vulgate` | VUL | Vulgate clémentine (ADR-0011) |

Le service renvoie cette valeur dans `BibleVersionCoverageDto.versification` (`packages/resource-domain/src/contracts/bibleChapterContract.ts:241`). Elle vient du manifeste de publication (`packages/resource-service/src/repositories/publicationImporter.ts:496`).

**Une seule lecture produit un effet**, dans le widget de passages de l'assistant (`apps/expo/src/features/study-assistant/widgets/PassageWidget.tsx:167`) : il affiche « La numérotation des versets peut différer entre ces éditions » quand les identifiants diffèrent. Comme LSG et KJV portent le même identifiant, l'avertissement **ne s'affiche jamais** dans le cas le plus fréquent, LSG face à KJV dans les Psaumes.

**Les ADR posent une règle sans table.**
- L'ADR-0011 affirme que Bible Strong ne convertit pas automatiquement les références d'une versification à l'autre. Il garde des clés de verset indépendantes de la version et une comparaison par position numérique, sans équivalence affirmée.
- L'ADR-0012 reprend la même clause. L'ADR-0018 n'en contient pas.
- L'ADR-0010 demande que les exceptions de versification soient déclarées dans les métadonnées de la ressource.
- Aucune table ne permet aujourd'hui de vérifier cette déclaration.

### 1.2 Aucune conversion dans les chemins de lecture

L'app et le site envoient la clé `livre-chapitre-verset` du verset affiché, telle quelle. Les appels sont les suivants :

| Ressource | App | Site |
|---|---|---|
| Références croisées | `apps/expo/src/features/resources/bibleReadingResourceAccess.ts:185` | `apps/site/features/bible/bibleVerseStudy.ts:382` |
| Nave | `apps/expo/src/features/resources/naveAccess.ts:250` | `bibleVerseStudy.ts:456` |
| Extraits de commentaires | `apps/expo/src/features/resources/commentaryAccess.ts:332` | `bibleVerseStudy.ts:409` |
| Dictionnaires | `apps/expo/src/features/resources/dictionaryAccess.ts:1106` | `bibleVerseStudy.ts:480` |
| Étude de verset (ADR-0115) | — | `bibleVerseStudy.ts:149` (`/v1/verse-studies/:language/:verseKey`) |

- Ni le code, ni `CONTEXT.md`, ni les ADR ne contiennent de fonction de conversion.
- La seule référence à la versification dans `getVersesContent.ts:54` sert à journaliser un verset manquant.
- Les copies hors ligne reçoivent la même clé. Pour la Nave, `naveAccess.ts:516-521` passe le même `verse` à la copie hors ligne puis à l'API, et `naveAccess.ts:119-121` le transmet tel quel à la lecture SQLite. Je n'ai pas observé ce comportement sur un appareil.

### 1.3 Un outil de correspondance existe déjà, dans Resource Studio

`apps/resource-studio/src/verseCorrespondence.ts` et `src/generateVerseCorrespondence.ts` (`yarn strong:versification`) détectent, livre par livre, la correspondance entre une Bible cible et la numérotation des témoins Strong français (`Sg1910`, `Darby`, `DarbyR`).
- La détection compare les textes par programmation dynamique.
- Elle produit des blocs `identity | merge | split | resegment | shift | chapter-boundary | omitted | added`, avec un score.
- Trois manifestes existent localement, sous `apps/resource-studio/data/bibles/` :
  - `bible-neg79-verse-correspondence.json` : 30 383 blocs d'identité, 544 décalages, 110 changements de chapitre, 27 fusions, 25 divisions, 23 redécoupages ;
  - `bible-fmar-verse-correspondence.json` ;
  - `bible-nvs78p-verse-correspondence.json`.
- Le libellé `canonicalVersification: "French Strong references / STEP OSIS"` est trompeur. La numérotation canonique de ces manifestes est celle de `Sg1910.csv`, c'est-à-dire celle de la LSG. On le voit par exemple à NEG79 Gn 31:55, qui correspond à Gn 32:1.

**Le dépôt possède donc déjà de vraies tables NEG79 → LSG, FMAR → LSG et NVS78P → LSG**, et un détecteur capable de valider une table publique contre nos propres textes. Elles servent aujourd'hui uniquement au marquage Strong.

---

## 2. Nos Bibles

### 2.1 Méthode

`GET /v1/bibles/:version/coverage` publie le nombre de lignes de chaque chapitre (`verseCountByBookChapter`) et, pour les chapitres irréguliers, la liste des numéros de verset qui ont un texte (`verseNumbersByBookChapter`, ADR-0071).

J'ai lu les 47 couvertures du catalogue de l'app. L'ADR-0115 parle de 48 Bibles sur le site ; je n'ai pas identifié la 48e. Seuls les livres 1 à 66 sont mesurés : les deutérocanoniques et les livres 67 à 77 ne le sont pas.

Pour chaque chapitre, je retiens le **dernier numéro de verset**, puis je le compare :
- aux comptages des tables Paratext `org` (hébreu BHS et grec UBS) et `eng` (anglais type RSV/KJV) ;
- à ceux de `lxx` et `vul` pour la Septante et la Vulgate.

Le nombre de lignes ne suffit pas comme mesure. BFC, FRC97, NFC et PDV2017 regroupent des versets (`2-4` sur une seule ligne), si bien que leur nombre de lignes diffère sans que leur numérotation change.

**Limites :**
- La comparaison voit un décalage qui change la fin d'un chapitre, pas un décalage interne à nombre de versets égal. Ce cas est rare, mais seule une comparaison des textes le détecte, et le détecteur de Resource Studio sait la faire.
- Une fusion en fin de chapitre (BFC Ps 2:11-12) apparaît comme un écart alors que la numérotation est la même.

### 2.2 Inventaire

Les colonnes `org` et `eng` donnent le nombre de chapitres dont le dernier verset diffère de chaque table.

| Famille | Bibles | Déclarée | Table Bible Strong | ≠ `org` | ≠ `eng` | Écarts restants |
|---|---|---|---|---:|---:|---|
| **Hébraïque exacte** | LSG, NBS, NVS78P, DBY, DBR | `bible-strong-default` | `org` | 0 | 141 | aucun |
| Hébraïque, presque | S21 | défaut | `org` | 1 | 140 | Nb 25 |
| | BDS | défaut | `org` | 1 | 142 | 1 Ch 25 (regroupement) |
| | BHS | défaut | `org` | 1 | 138 | **Joël 4 absent** |
| | CHU | défaut | `bs-chu` | 5 | 142 | **Joël 4 absent, 2 Ch 36 vide**, Dt 34, Né 7, Jn 7 |
| | BFC, FRC97 | défaut | `bs-bfc` | 16 | 151 | regroupements de fin de chapitre, Ac 19:41 |
| | NFC | défaut | `bs-nfc` | 14 | 149 | idem |
| | PDV2017 | défaut | `bs-pdv` | 15 | 150 | idem, Rm 8, Jude |
| | TLV | défaut | `bs-tlv` | 11 | 138 | Nb 16-17 et 29-30 à l'anglaise, Dt 5, 1 S 23-24, Jr 30-31, Jon 4 |
| | DEL | défaut | `bs-del` | 6 | 145 | Jn 1, Ac 19, Rm 7, 1 Co 13, 2 Th 3, Ap 12 |
| | BCC1923 | `…catholic-extended-esther-daniel` | non décrite | 33 | 165 | Esther et Daniel grecs, versets isolés |
| | SBLGNT (NT) | défaut | `bs-sblgnt` | 2 | 4 | Jn 7, Rm 16 |
| | POV (NT) | défaut | `bs-pov` | 4 | 6 | Mt 8-9, Mc 9, Lc 1 |
| **Anglaise** | NLT | défaut | `bs-eng` | 141 | 0 | aucun |
| | ESV, NIV, AMP | défaut | `bs-esv` (ESV), `bs-niv` (NIV, AMP) | 142 | 1 | Ap 12 |
| | GW, CSB | défaut | `bs-gw`, `bs-csb` | 140 | 1 | 2 Co 13 |
| | **BHG** (NRSV, titres en verset 0) | défaut | `bs-nrsv` | 140 | 1 | 2 Co 13 |
| | NET | défaut | `bs-net` | 139 | 2 | Jon 1, 2 Co 13 |
| **Anglaise, type KJV** | KJV, KJF, BSB, ASV, DARBY, RLT, RWEBSTER, RV1895, NKJV, NASB2020, NASB1995 | défaut | `bs-kjv` | 143 | 2 | 3 Jn 1 (14 versets), Ap 12 (17 versets) |
| | TR1624, TR1894 (NT) | défaut | `bs-kjv` | 4 | 2 | idem |
| | EASY | défaut | `bs-easy` | 147 | 6 | 1 Ch 25, 2 Ch 35, Éz 36, Dn 10, Rm 8, 1 Co 5 |
| | LAU | `…french-4-chapter-joel` | `bs-lau` | 141 | 6 | Joël 2-4 à l'hébraïque, Mc 9-10, Ap 12 |
| **Protestante française mixte** | NEG79 | défaut | `bs-neg79` | 54 | 103 | Psaumes, Lv, Ct, Es, Éz et Mi à l'hébraïque ; Gn, Dt, Joël, Za et Mal à l'anglaise |
| | OST | défaut | `bs-ost` | 76 | 88 | Psaumes presque hébraïques, Éz et Jon hébraïques, le reste surtout anglais |
| | FMAR | défaut | `bs-fmar` | 78 | 81 | comme OST, Ap 12 à l'anglaise |
| **Septante** | LXX | `theotex-septuagint` | non décrite | — | — | 55 chapitres ≠ `lxx`, dont Esdras, scindé par l'ADR-0018 |
| | **LXX_FR** | **défaut** (à tort) | non décrite | — | — | 53 chapitres ≠ `lxx`. Psaumes numérotés comme la Septante : LXX_FR Ps 51:2 est « Quand Doeg l'Iduméen… », soit le Ps 52 hébreu (lu dans l'API) |
| **Vulgate** | VUL | `clementine-vulgate` | non décrite | — | — | 17 chapitres ≠ `vul` (additions d'Esther, Ps 115-116, Gn 5) |

**À retenir :**
- LSG, la Bible par défaut en français, est **identique à `org`** ; KJV, la Bible par défaut en anglais, est identique à `eng` sauf en 3 Jean et en Apocalypse 12.
- Selon le décodage de la recherche web, que je n'ai pas refait, la table SWORD « Segond » décrit Joël en 3 chapitres et Malachie en 4. Notre texte LSG ne suit pas cette structure. Le même décodage relève une incohérence interne (Ex 7:26). C'est une raison de plus de partir de nos données.
- **Titres des psaumes.** Seules BHG, LXX et LXX_FR publient un verset 0 (respectivement 116 chapitres, 1 et 1). Les autres Bibles anglaises n'ont pas de verset 0 : la KJF met le titre dans le v. 1 (« Au chef de musique… Use de miséricorde envers moi »), et la page KJV n'affiche pas de titre. La table `eng`, elle, place le titre au verset 0. La famille anglaise de Bible Strong n'est donc pas `eng` telle quelle : le titre y appartient au v. 1, comme dans la tradition « EngTitleMerged » de TVTMS. Le contrôle par dernier verset ne voit pas cet écart.
- **LXX_FR** déclare `bible-strong-default` alors que ses Psaumes suivent la numérotation de la Septante.
- **NEG79, OST et FMAR** ne suivent aucune table publique. Il leur faut une table propre : elles l'ont depuis le 27 novembre 2026, avec LAU (section 2.4). Le manifeste local de FMAR ne décrit pas le texte publié.
- **Trous de source, hors versification** :
  - BHS et CHU n'ont pas Joël 4 (21 versets). L'API renvoie 404 sur `BHS/books/29/chapters/4`.
  - Dans CHU, 2 Chroniques 36 est vide dans la source historique `bible-chu.json`.

### 2.3 Les écarts entre LSG (`org`) et KJV (`eng`)

Liste tirée des lignes de correspondance de `eng.vrs`. LSG y correspond chapitre par chapitre : 0 écart dans le tableau 2.2. La partie gauche est en numérotation KJV, la droite en numérotation LSG.

| KJV (`eng`) | LSG (`org`) | Effet pour un lecteur LSG |
|---|---|---|
| Gn 31:55 ; 32:1-32 | Gn 32:1 ; 32:2-33 | Gn 32 entier décalé d'un verset |
| Ex 8:1-4 ; 8:5-32 | Ex 7:26-29 ; 8:1-28 | Ex 8 décalé de 4 |
| Ex 22:1 ; 22:2-31 | Ex 21:37 ; 22:1-30 | |
| Lv 6:1-7 ; 6:8-30 | Lv 5:20-26 ; 6:1-23 | |
| Nb 16:36-50 ; 17:1-13 | Nb 17:1-15 ; 17:16-28 | |
| Nb 29:40 ; 30:1-16 | Nb 30:1 ; 30:2-17 | |
| Dt 12:32 ; 13 ; 22:30 ; 23 ; 29:1 ; 29:2-29 | Dt 13:1 ; 13:2-19 ; 23:1 ; 23:2-26 ; 28:69 ; 29:1-28 | |
| 1 S 20:42 ; 21 ; 23:29 ; 24 | 1 S 21:1 ; 21:2-16 ; 24:1 ; 24:2-23 | |
| 2 S 18:33 ; 19 | 2 S 19:1 ; 19:2-44 | |
| 1 R 4:21-34 ; 5:1-18 ; 22:43-53 | 1 R 5:1-14 ; 5:15-32 ; 22:44-54 | |
| 2 R 11:21 ; 12 | 2 R 12:1 ; 12:2-22 | |
| 1 Ch 6:1-15 ; 6:16-81 ; 12:4-40 | 1 Ch 5:27-41 ; 6:1-66 ; 12:5-41 | |
| 2 Ch 2:1 ; 2:2-18 ; 14:1 ; 14:2-15 | 2 Ch 1:18 ; 2:1-17 ; 13:23 ; 14:1-14 | |
| Né 4:1-6 ; 4:7-23 ; 7:69-73 ; 9:38 ; 10 | Né 3:33-38 ; 4:1-17 ; 7:68-72 ; 10:1 ; 10:2-40 | |
| Jb 41:1-8 ; 41:9-34 | Jb 40:25-32 ; 41:1-26 | |
| **Psaumes : titre en verset 0** (71 lignes, 62 psaumes) | titre en verset 1, ou 1-2 | Ps 51:1 KJV = Ps 51:3 LSG ; Ps 3:1 = 3:2… |
| Ec 5:1 ; 5:2-20 | Ec 4:17 ; 5:1-19 | |
| Ct 6:13 ; 7 | Ct 7:1 ; 7:2-14 | |
| Es 9:1 ; 9:2-21 ; 64:2-12 | Es 8:23 ; 9:1-20 ; 64:1-11 | |
| Jr 9:1 ; 9:2-26 | Jr 8:23 ; 9:1-25 | |
| Éz 20:45-49 ; 21:1-32 | Éz 21:1-5 ; 21:6-37 | |
| Dn 4:1-3 ; 4:4-37 ; 5:31 ; 6 | Dn 3:31-33 ; 4:1-34 ; 6:1 ; 6:2-29 | |
| Os 1:10-11 ; 2 ; 11:12 ; 12 ; 13:16 ; 14 | Os 2:1-2 ; 2:3-25 ; 12:1 ; 12:2-15 ; 14:1 ; 14:2-10 | |
| **Joël 2:28-32 ; 3:1-21** | **Joël 3:1-5 ; 4:1-21** | Joël 4 n'existe pas pour les ressources |
| Jon 1:17 ; 2 | Jon 2:1 ; 2:2-11 | |
| Mi 5:1 ; 5:2-15 | Mi 4:14 ; 5:1-14 | |
| Na 1:15 ; 2 | Na 2:1 ; 2:2-14 | |
| Za 1:18-21 ; 2 | Za 2:1-4 ; 2:5-17 | |
| **Mal 4:1-6** | **Mal 3:19-24** | Mal 3:19-24 LSG sans ressource |
| Ac 19:40-41 | Ac 19:40 (deux versets en un) | |
| 2 Co 13:12-14 | 2 Co 13:12-13 | **absent de `eng.vrs`, à ajouter** |
| 3 Jn 14 (KJV) | 3 Jn 14-15 | `eng` a 15 versets comme LSG, mais la KJV en a 14 |
| Ap 12:17 ; 13:1 (KJV) | Ap 12:17-18 ; 13:1 | idem : `eng` et LSG ont 12:18, la KJV non |

**Ampleur :** 143 chapitres ont un dernier verset différent. La LSG y compte 3 158 versets, dont 1 049 dans 62 psaumes. C'est un majorant des clés mal alignées, environ 10 % de la Bible.

### 2.4 Les tables de NEG79, OST, FMAR et LAU

Les quatre Bibles protestantes françaises ont chacune leur table Bible Strong, déclarée dans `BIBLE_VERSIFICATIONS` : `bible-strong/bs-neg79.vrs`, `bs-ost.vrs`, `bs-fmar.vrs` et `bs-lau.vrs`. Chaque ligne y porte en commentaire le texte qui la justifie.

| Bible | Base | Lignes de correspondance | Accord du détecteur | Écarts propres au texte publié |
|---|---|---:|---:|---|
| NEG79 | `org` | 57 | 31 052 / 31 113 (99,8 %) | Mc 9:44 et 9:46 non imprimés (vides aussi dans la LSG) |
| OST | `org` | 86 | 30 957 / 31 073 (99,6 %) | **Ps 40:17 LSG absent** ; Mt 11:2 et Rm 3:22 contiennent le verset suivant |
| FMAR | `bs-ost` | 29 | 30 863 / 31 039 (99,4 %) | Rm 3:22 et 8:20 contiennent le verset suivant ; fusions Ps 69:2, Ec 12:14, Os 12:14, Jon 2:10, Ap 12:17 |
| LAU | `bs-kjv` | 4 | non mesurable (voir plus bas) | aucun |

**Choix de la base.** J'ai estimé, verset par verset, les lignes qu'il faudrait sur chaque base. L'estimation est comparable d'une base à l'autre, à une ou deux lignes près du fichier écrit :
- NEG79 et OST partent de `org`, parce que leurs Psaumes sont numérotés comme la LSG, titres compris. Sur une base anglaise, chaque psaume coûterait une ligne. NEG79 demande 57 lignes sur `org` contre 92 sur `bs-eng`, OST 85 contre 92.
- FMAR part de `bs-ost` : Martin numérote comme Ostervald, sauf dans une dizaine de chapitres. Il faut 27 lignes sur `bs-ost`, contre 101 sur `org` et 96 sur `bs-eng`.
- LAU part de `bs-kjv` et n'en diffère qu'en Joël (4 chapitres, à l'hébraïque), en Mc 9:50 et 10:52 (coupés en deux) et en 3 Jean (15 versets).

**Ce que les textes montrent :**
- **Une numérotation française traditionnelle**, commune à NEG79, OST et FMAR. LAU l'imprime entre parenthèses, mais numérote elle-même ces passages comme la KJV :
  - Jb 39:1 = LSG 38:39, Jb 39:34 = LSG 40:1 et Jb 40:28 = LSG 41:1 ;
  - Ec 12 commence deux versets plus tôt : Ec 12:1 = LSG 11:9 ;
  - 1 S 20 a 43 versets, et 20:43 = LSG 21:1.
- **OST et FMAR ouvrent Nb 13 sur LSG 12:16**, comme les numéros entre parenthèses de LAU.
- **NEG79, OST et LAU coupent en deux** Mc 9:50 et Mc 10:52. OST coupe aussi Ps 30:13.
- **FMAR met le titre dans le v. 1** en Ps 102, 108 et 140, comme les Bibles anglaises, mais pas dans les autres psaumes.
- **OST publié n'a pas Ps 40:17** (« Que tous ceux qui te cherchent… »). C'est le seul verset LSG sans équivalent dans ces quatre tables, et le test le nomme.

**Mesure.** Le détecteur de Resource Studio a aligné le texte publié de NEG79, OST et FMAR, téléchargé chapitre par chapitre depuis l'API, sur la numérotation LSG, pour les 66 livres. Le tableau donne les blocs dont la table donne les mêmes versets LSG que le détecteur. Les accords comptent 670 blocs qui ne sont pas des identités pour NEG79, 796 pour OST et 784 pour FMAR.

Les désaccords se rangent en trois groupes :
- **Fusions ou divisions locales** de deux versets voisins. J'ai lu tous ceux dont le score atteint 0,75 (NEG79 Gn 32, Nb 16-17, 1 R 5, 1 Ch 6, 2 Ch 2, Dn 4 et 6, Za 1 ; OST Ex 8, Lv 6, Nb 13, Os 1-2, Jl 3 ; FMAR Ex 8, Né 10). La table est juste à chaque fois : le détecteur colle un verset court à son voisin, ou suit une coupe déplacée (Nb 17:2-3, 2 Ch 2:13-14, Né 7:68-69).
- **Identités à score faible** au milieu d'un passage décalé, dans le français ancien de Martin : FMAR Jb 41 et Na 2, plus quelques versets d'Ex 22 et 1 Ch 12. Le texte suit la table.
- **Repli du détecteur sur l'identité** quand il ne résout pas un passage : FMAR Né 7:69-71 et 10:25-26. Le texte suit là aussi la table.

**Pièges de mesure.** Les témoins du détecteur ont Ac 19:41 comme la KJV : leur 19:41 se lit LSG 19:40. La copie locale `bible-neg79.json` est identique au texte publié, mais pas `bible-fmar.json`, qui numérote les Psaumes à l'anglaise.

**LAU.** Le texte imprime la numérotation traditionnelle entre parenthèses (« (51:3) ») dans 1 324 versets.
- 1 182 de ces versets donnent exactement les versets LSG de la table.
- Les 142 autres sont en Nb 12-13, 1 S 20:42, Jb 38-41 et Ec 11-12, où ces numéros ne sont pas ceux de la LSG.
- Lus comme des numéros NEG79, ils retombent sur les mêmes versets LSG en Jb, Ec et 1 S. C'est une confirmation de ces trois passages indépendante du détecteur.

Sur LAU, le détecteur ne tranche pas : il déclare ambigus presque tous les livres où LAU diffère de la LSG, faute de témoin aussi littéral. J'ai donc lu Joël 2-4, Mc 9-10, 3 Jean et Ap 12-13 : la table suit le texte.

**Mécanique.** Une surcouche peut retirer un chapitre (`JOL 4:0`), une ligne dont le verset sort du chapitre est abandonnée, et une surcouche posée sur `org` reçoit l'identité par défaut. `bs-eng`, `bs-kjv` et `bs-nrsv` en sortent inchangés, verset par verset.

### 2.5 Les tables des autres Bibles

Depuis le 27 novembre 2026, toutes les Bibles publiées ont une table, sauf BCC1923, LXX, LXX_FR et VUL. La colonne « Table Bible Strong » du tableau 2.2 donne la table de chacune.

| Table | Bibles | Base | Lignes | Vérification |
|---|---|---|---:|---|
| `bs-esv` | ESV | `bs-eng` | 1 | texte : ESV Ap 12:17 finit par « And he stood on the sand of the sea » (LSG 12:18) |
| `bs-niv` | NIV, AMP | `bs-eng` | 2 | texte : Ap 13:1 commence par le dragon sur le rivage, comme la KJV ; mais 3 Jean a 15 versets |
| `bs-gw` | GW | `bs-eng` | 5 | 2 Co 13 en 13 versets ; Ex 27:14 et 38:14, Nb 4:47, Jr 27:19 contiennent le verset suivant |
| `bs-csb` | CSB | `bs-eng` | 3 | 2 Co 13 en 13 versets ; Ac 24:6 contient 24:8 |
| `bs-net` | NET | `bs-eng` | 1 | 2 Co 13 en 13 versets ; **pas de Jon 1:17** (LSG 2:1, le grand poisson) dans le texte publié |
| `bs-easy` | EASY | `bs-eng` | 72 | lignes de plusieurs versets, lues dans la couverture et contrôlées sur le texte |
| `bs-bfc` | BFC, FRC97 | `org` | 168 | idem ; Ac 19:40-41 = LSG 19:40 |
| `bs-nfc` | NFC | `org` | 146 | idem |
| `bs-pdv` | PDV2017 | `org` | 173 | idem |
| `bs-tlv` | TLV | `org` | 13 | Nb 16-17, 25-26, 29-30 et 1 S 23-24 à l'anglaise ; Dt 5:17 réunit quatre commandements ; Jr 30:25 = LSG 31:1 ; Jon 4:10 contient 4:11 |
| `bs-del` | DEL | `org` | 10 | lu dans l'hébreu : Jn 1:38, Ac 19:40, Rm 7:25, 1 Co 13:12 et 2 Th 3:16 coupés en deux ; Ap 13:1 comme la KJV |
| `bs-chu` | CHU | `org` | 13 | Dt 32:50-34:12 décalé d'un verset ; Né 7 à l'anglaise ; Ps 119:72 contient 119:73 |
| `bs-sblgnt` | SBLGNT | `org` | 0 | Jn 7 s'arrête au v. 52, Rm 16 au v. 24 |
| `bs-pov` | POV | `org` | 5 | Mt 8:33, 9:37, Lc 1:79 et 3:6 contiennent le verset suivant ; Mc 9:50 coupé en deux |

**Les lignes de plusieurs versets.** BFC, FRC97, NFC, PDV2017, EASY, et plus rarement GW, CSB et POV, impriment une ligne pour plusieurs versets (« 15-16 ») et la rangent sous son premier numéro ; les numéros suivants n'ont pas de ligne.
- La couverture publiée le montre : `verseNumbersByBookChapter` liste les numéros présents. Un numéro absent appartient à la ligne qui le précède, et une ligne qui finit le chapitre plus tôt que sa base porte la fin du chapitre (BFC 1 Ch 25:9 = LSG 25:9-31).
- La table envoie cette ligne vers tous ses versets (`1CH 25:9 = 1CH 25:9-31`) et raccourcit le chapitre. Un verset LSG ainsi couvert se lit sur la ligne qui le contient : LSG 1 Ch 25:20 est FRC97 25:9.
- Les omissions de critique textuelle (Mt 17:21, Mc 9:44…) et 1 S 13:1, que BFC omet, gardent leur numéro.
- Contrôle : pour chacune des 550 lignes environ, j'ai comparé la longueur du texte à celle des versets LSG (ou NIV pour EASY) qu'elle couvre. Les 60 cas douteux sont des résumés (BFC Nb 1:20 résume le recensement de 1:20-43, Gn 17:24 « Abraham avait quatre-vingt-dix-neuf ans et son fils Ismaël treize »). Je les ai lus : tous sont des regroupements.
- FRC97 a exactement les mêmes lignes que BFC et partage sa table. NFC et PDV2017 en diffèrent par une centaine de numéros et ont la leur.
- Le détecteur de Resource Studio échoue sur ces Bibles (mémoire saturée avant la fin du Pentateuque, à cause des grands regroupements).

**Trous du texte publié, nommés par le test :** NET Jon 1:17 ; CHU Ps 119:8 et Jn 7:53 ; SBLGNT Jn 7:53 et Rm 16:25-27 ; CHU n'a ni Jl 4 ni 2 Ch 36, qui gardent les versets de `org`.

**Titres des psaumes.** Les Bibles anglaises modernes n'impriment pas le titre dans le verset : leur v. 1 est le premier verset du psaume, comme dans `bs-eng`, qui y replie le titre.

**Non décrites :**
- **BCC1923** suit la Vulgate dans une dizaine de chapitres (Jos 21, Jg 5, 1 Ch 12, Né 7, Mt 17, Mc 4, 8 et 9, Ac 14). Elle a ses propres coupes ailleurs : Lv 24:23 et Dt 5:17-20, et des fins de chapitre en Ps 18, Ps 45, Is 21, Jr 20, Jn 11 et He 13. Il faut aussi trancher pour les additions grecques d'Esther (10:4-16:24) et de Daniel (3:24-90, 13, 14), que `org` range dans d'autres livres.
- **LXX, LXX_FR et VUL** demandent les tables Paratext `lxx` et `vul` et la même décision pour les livres 67 à 77 et les structures de l'ADR-0018. Je les ai laissées hors de ce travail.

---

## 3. Les ressources liées à un verset

### 3.1 Méthode

Pour chaque ressource, je sonde des versets dont le contenu tranche entre les deux numérotations :
- Ps 51:1 et 51:3 ;
- Gn 31:55 et 32:1 ;
- Joël 3:1 et 4:1 ;
- Mal 3:23 et 4:5 ;
- 3 Jn 15 ;
- Ap 12:18.

Pour les commentaires, je relève aussi, chapitre par chapitre, la première et la dernière clé publiée. Ce que je n'ai lu que dans le code est signalé comme tel.

### 3.2 Matrice

| Ressource | Numérotation | Preuve |
|---|---|---|
| **Références croisées** (Trésor / TSK, `fr`, seule langue) | **KJV** | `19-51-1` donne « after… 10-11-2 » (2 S 11, titre KJV replié dans le v. 1). `19-51-3` donne « For I… 19-32-5 » (KJV 51:3 = LSG 51:5). `39-4-5` existe, `39-3-23` renvoie 404. `29-4-1`, `64-1-15` et `66-12-18` renvoient 404. `1-32-1` donne « angels » (KJV Gn 32:1 = LSG 32:2). Les **cibles** sont elles aussi en KJV. |
| **Nave** `fr` et `en` | **KJV** | Gn 31:55 → « Baiser, Laban » (absent de la LSG, dont Gn 31 a 54 versets). `39-3-23`, `29-4-1`, `64-1-15` et `66-12-18` sans thème. Mal 4:5 → « Jean, Jour ». |
| **Commentaires** acbc (fr, en), barnes, mhcc, jfb, kd, wesley, geneva-notes, darby-notes, mhc, scofield, king-comments, sdabc (fr, en), egw-writings, calvin | **anglaise / KJV** | Tous publient Mal 4 et Joël en 3 chapitres, aucun Joël 4. Leurs clés de Ps 3 s'arrêtent à 8 ou avant. Sur `19-51-1`, Clarke, Barnes et SDABC commentent « Aie pitié ». |
| rwp, pnt, abbott, fourfold-gospel (NT) | anglaise (présumée) | NT seulement, non tranché sur 3 Jn et Ap 12 |
| **rashi-en** | **hébraïque** | Gn 31 va jusqu'à 54, Gn 32 jusqu'à 33, Joël 4 publié, Mal 3 jusqu'à 24, Mal 4 renvoie 404 |
| **fre-aug** (Augustin) | Psaumes numérotés selon l'hébreu au chapitre | « Discours sur le psaume 50 » rangé sous Ps 51:1 : le numéro de la Vulgate a été converti à l'import, au chapitre seulement |
| fre-chry | indéterminée | couverture trop mince |
| **bible-annotee** (Neuchâtel) | **mixte** | Psaumes avec clé 0 (titres), Mal 4, Joël en 3 chapitres, Gn 31:55, 3 Jn 15 et Ap 12:18 : proche d'OST et de NEG79 |
| **aquifer-fr** (Tyndale) | **mixte, à mesurer** | Mal 4, Joël en 3 chapitres, mais des sections qui vont jusqu'à Ps 3:9 et Ps 51:20. Les plages de section ne suffisent pas, il faut lire le contenu |
| mhy-fr | non lu | l'API répond 503 (« publication temporarily unavailable ») |
| burkitt, family-notes, lightfoot, luther, mhm, treasury-david, catena-aurea, douay-rheims-notes | **non classés** | non sondés, ou trop minces sur les chapitres témoins. Douay-Rheims peut suivre la Vulgate |
| **Entités bibliques** (STEP TIPNR) | **anglaise**, titres rattachés au v. 1 | Élie en Mal 4:5. Doeg en Ps 52:1, alors que son titre est au verset 0 en `eng` et aux versets 1-2 en `org` |
| **Chronologie** | anglaise (présumée) | `scriptures: ['46\|16:8', '44\|20:31']` venant d'une source anglaise ; aucun verset litigieux vérifié |
| **Dictionnaires : présence dans le verset** (`verse-name`, `verse-phrase`) | **fr : LSG (`org`) ; en : KJV** | code : `dictionary-verse-presences.mjs:29-38` (`referenceBibles: { fr: "LSG", en: "KJV" }`) |
| **Dictionnaires : citations des auteurs** (`source-citation`) | **celle de l'auteur** | Calmet, « Doeg » : l'article cite le « Psaume 51 », c'est-à-dire la Vulgate (Ps 52 hébreu). Il est rangé sous `19-51-*`, rien sous `19-52-*`. Westphal, « Kyrie, Eleison », sous `19-51-3` (« aie pitié » en LSG) : numérotation Segond **déduite**, article non lu |
| **Index Strong des Bibles** (sidecars LSG, DBY, DBR, KJV…) | celle de la Bible, liée au texte original par **identifiant de jeton** | LSG Ps 51:3 → `stepTokenIds` 202042 et 202043, que BHG range en Ps 51:1 (NRSV). **Juste quelle que soit la numérotation** |
| **Texte original BHG et index interlinéaires** | NRSV (`eng`, titres des psaumes en verset 0, 116 chapitres) | ADR-0078 ; couverture |
| **Étude de verset** (`/v1/verse-studies/:language/:verseKey`, ADR-0115) | **mélange** | Mots de la Bible Strong de la langue (LSG ou KJV) au même numéro, plus Trésor, Nave et commentaires en KJV. Pour `fr/19-51-3` : mots de « aie pitié » (LSG) et références de « car je reconnais » (KJV) dans la même réponse |
| Paroles de Jésus | celle de chaque Bible | décisions par Bible, ancrées sur le hachage du texte du verset (ADR-0066) |
| Données de l'utilisateur (surlignages, notes, signets, relations) | position numérique ; la version de création est gardée si elle est connue | ADR-0011 ; `version?` facultatif sur les surlignages (`redux/modules/user/highlights`) |
| Plans de lecture, verset du jour, enregistrements audio, bibliothèque de l'assistant | **non audités** | voir les suites à donner |

**Conclusion :** il n'y a pas une numérotation implicite unique, et l'erreur va dans les deux sens.
- Le **côté anglais** regroupe le Trésor, la Nave, la plupart des commentaires, les entités, BHG (NRSV, différente de la KJV en 2 Co 13, 3 Jn et Ap 12) et les dictionnaires anglais.
- Le **côté hébraïque ou Segond** regroupe Rachi, les dictionnaires français par présence (LSG), les citations de Westphal, et pour partie la Bible annotée.
- Les citations de Calmet suivent la **Vulgate** dans les Psaumes.

### 3.3 Cas vérifiés de contenu faux à l'écran

1. **Site, LSG Ps 51:3** : https://bible-strong.app/bible/lsg/ps/51/3 affiche le texte « Ô Dieu ! aie pitié de moi dans ta bonté », puis :
   - une ligne hébraïque « mot à mot » qui est celle de BHG 51:3, « כִּֽי־פְ֭שָׁעַי אֲנִ֣י אֵדָ֑ע », c'est-à-dire « car je connais mes transgressions ». La liste de mots en dessous, elle, est juste, parce qu'elle passe par les identifiants de jeton ;
   - les références croisées de KJV 51:3 (Ps 32:5, 38:18, Lv 26:40, Né 9:2…), qui portent sur le verset 51:5 de la LSG ;
   - des cibles décalées à leur tour : « Psaumes 38:18 » affiche en LSG « Car je suis près de tomber », alors que le Trésor visait KJV 38:18, « I will declare mine iniquity » (LSG 38:19). De même, « Psaumes 40:12 » affiche « tu ne me refuseras pas tes compassions » ;
   - les commentaires Clarke et Barnes « v. 3 » : « Car je reconnais mes transgressions… ».
2. **Site, KJF Ps 51:3** (français, numérotation anglaise) : https://bible-strong.app/bible/kjf/ps/51/3 affiche le texte « Car je reconnais mes transgressions ». Mais le bloc « dans d'autres versions » montre LSG, S21, BDS et NEG79 51:3 (« aie pitié »), et le bloc « Mots relevés dans la LSG » donne les mots de « aie pitié ». Les références croisées sont justes. La page KJV correspondante est cohérente partout.
3. **LSG Gn 32:1** (« Laban se leva de bon matin ») : le Trésor donne les références de « angels of God met him » (KJV 32:1 = LSG 32:2), la Nave donne « Jacob ». Tout Gn 32 est décalé d'un verset.
4. **LSG Mal 3:23** (« je vous enverrai Élie ») : le Trésor renvoie 404, la Nave est vide, et Clarke, Barnes, SDABC et EGW n'ont rien. Leur contenu est sous `39-4-5`, une clé qui n'existe pas dans la LSG. Les entités de Mal 3 n'incluent pas Élie.
5. **LSG Joël 3:1** (« je répandrai mon esprit sur toute chair ») : le Trésor donne les références de « in those days… bring again the captivity » (KJV 3:1 = LSG 4:1). Joël 4 n'a aucune ressource.
6. **LSG 3 Jn 15 et Ap 12:18** : le Trésor et la Nave renvoient 404 ou rien.
7. **Assistant** : la mention de numérotation différente n'apparaît pas entre LSG et KJV (section 1.1).
8. **Calmet** : l'article « Doeg » est relié au Ps 51 au lieu du Ps 52 dans tous les lecteurs.
9. **Rachi, pour un lecteur KJV** : Mal 4 renvoie 404 alors que Rachi commente le passage sous Mal 3:19-24 ; Gn 32 est décalé.
10. **Lecture parallèle et comparaison** : la même rangée de Ps 51 montre deux versets différents en LSG et en KJV. C'est le comportement décidé par l'ADR-0011 (comparaison par position), mais rien ne le signale.

---

## 4. Les tables publiques

Le dépôt est sous **GPL-3.0** (fichier `LICENSE` à la racine). J'ai vérifié les licences le 27 novembre 2026 par l'API GitHub et dans les en-têtes de source.

| Source | Couverture | Format | Licence | Embarquable ? |
|---|---|---|---|---|
| **Paratext `.vrs`** dans `sillsdev/libpalaso`, `SIL.Scripture/Resources/` (`eng`, `org`, `lxx` 1.6, `vul` 1.4, `rso`, `rsc`) | AT, NT et deutérocanoniques ; `org` (BHS, UBS GNT) sert de pivot | Texte : comptages `MAL 1:14 2:17 3:18 4:6`, puis correspondances `MAL 4:1-6 = MAL 3:19-24`, `PSA 51:0 = PSA 51:1` ; extensions `#!` : `&` pour une plage vers un seul verset, `-` pour un verset exclu, `*` pour des segments | **MIT** (SIL) | **Oui**, avec la notice MIT |
| **`ubsicap/versification_json`** | les mêmes, avec `lxx` 1.7 et `vul` 1.5, plus récents | `.vrs` et JSON (`maxVerses`, `mappedVerses`, `excludedVerses`, `partialVerses`) | **MIT** (UBS ICAP, 2019) | **Oui**, mais **prendre les `.vrs`** : les JSON perdent les correspondances en double (`PSA 51:0 → 51:1`) et les versets exclus de la Septante |
| `nida-institute/versification` (ex-Copenhagen Alliance) | mêmes JSON, plus des règles de détection tirées de TVTMS | JSON | données CC BY-SA 4.0, code Apache-2.0 (l'API GitHub répond `NOASSERTION`) | Possible, puisque CC BY-SA 4.0 peut entrer dans la GPLv3, mais inutile grâce à la copie MIT |
| **STEPBible TVTMS** (`STEPBible-Data/Versification`) | traditions anglaise (KJV comme standard, dont `EngTitleMerged` et `EngTitleSeparate`), hébraïque, latine, grecque et d'autres ; une seule entrée française, `FrenchNEG`, limitée à Jb 39-41 | TSV condensé et détaillé, verset par verset, avec actions (Renumber, Merge…) et **tests** de détection par chapitre | **CC BY 4.0** (README et en-tête du fichier). La FSF range CC BY 4.0 parmi les licences compatibles avec la GPLv3 ; je n'ai pas relu sa liste pour ce travail | **Oui, sous conditions** : attribution à Tyndale House et STEPBible.org, lien, changements consignés. L'en-tête demande de ne pas republier le fichier : embarquer une table **dérivée** |
| **SWORD `canon_*.h`** (Segond, DarbyFr, Calvin, KJVA, NRSV, Vulg, LXX, Synodal…) | les seules tables françaises nommées | tableaux C de règles de décalage vers KJVA | **GPL version 2 seulement**, vérifié dans l'en-tête de `canon_segond.h` | **Non** : incompatible avec la GPL-3.0. Sa « Segond » met d'ailleurs Joël en 3 chapitres et Malachie en 4, ce qui ne correspond pas à notre LSG |
| BibleOrgSys | une vingtaine de systèmes, comptages seulement | XML | MPL-2.0 / CC BY-SA 4.0 | utile pour recouper, pas comme table |
| bibletags-versification | texte original vers KJV, LXX, Synodale et Vulgate, au mot près | JSON, clés `BBCCCVVV` | MIT | possible ; moins complet que Paratext |
| bcv_parser (déjà dans le monorepo) | comptages ESV, KJV, NRSV, NAB… | ordre et comptages | MIT | aucune correspondance |
| TOB, Bible de Jérusalem, Colombe, S21 | — | — | — | **aucune table publique trouvée** |

**Correspondance avec nos Bibles :**
- `org` décrit exactement LSG, NBS, NVS78P, DBY et DBR, et à peu près S21, BDS, BHS, BFC, NFC, PDV2017, CHU, TLV, SBLGNT et DEL.
- `eng` décrit exactement NLT, et à un ou deux chapitres près toutes les Bibles anglaises, BHG compris.
- La famille KJV (KJV, KJF, NASB…) est `eng` avec deux différences : 3 Jn 14 et Ap 12:17 / 13:1.
- `lxx` et `vul` décrivent LXX, LXX_FR et VUL, à des écarts près que nos ADR ont déjà décidés.
- **Aucune table publique ne décrit NEG79, OST, FMAR, LAU ni la Bible annotée.** Il faut les rédiger nous-mêmes au format `.vrs`, à partir de nos textes (dans le domaine public ou sous autorisation), des manifestes de la section 1.3 et des tests TVTMS.

---

## 5. Proposition

Le détail est dans le [projet d'ADR](./versification-adr-draft.md). En résumé :

1. **Le pivot est `org` de Paratext, tel que publié.** Trois raisons :
   - chaque table publique s'exprime vers `org`, en une étape ;
   - la LSG, Bible par défaut en français, y est identique, et le texte original hébreu et grec aussi ;
   - pour les clés nouvelles, `org` n'a pas besoin du verset 0 pour les titres des psaumes, que les contrats Nave et commentaires refusent aujourd'hui.

   Les clés internes nouvelles sont écrites en `org` : fiche de verset, cache, assistant. Les ressources existantes **gardent leurs clés** et déclarent leur versification.

2. **Une versification nommée pour chaque Bible et chaque ressource.** Une versification est une **table de base** (`.vrs` Paratext), plus éventuellement une **surcouche** `.vrs` propre à Bible Strong qui ne liste que ses différences. C'est le principe du `custom.vrs` de Paratext. On remplace `bible-strong-default` ainsi :

   | Versification | Base + surcouche | Bibles |
   |---|---|---|
   | `org` | `org` | LSG, NBS, NVS78P, DBY, DBR |
   | `org` + surcouche propre à chaque Bible | `org` | S21, BDS, BHS, CHU, BFC, FRC97, NFC, PDV2017, TLV, DEL, SBLGNT, POV |
   | `bs-eng` | `eng`, titres des psaumes rattachés au v. 1 (pas de verset 0) | NLT |
   | `bs-eng` + Ap 12:17 / 13:1 | idem | ESV, NIV, AMP |
   | `bs-eng` + 2 Co 13:13 | idem | GW, CSB, NET (avec Jon 1 en plus pour NET) |
   | `bs-kjv` | `bs-eng` + 3 Jn 14 + Ap 12:17 / 13:1 | KJV, KJF, BSB, ASV, DARBY, RLT, RWEBSTER, RV1895, NKJV, NASB2020, NASB1995, TR1624, TR1894 ; EASY avec sa propre surcouche |
   | `bs-nrsv` | `eng` avec titres au verset 0 + 2 Co 13:13 | BHG et ses index interlinéaires |

   Toutes les numérotations bâties sur `eng` appliquent d'abord la surcouche commune `eng-fixes`, qui corrige `eng.vrs` (section 6).
   | `bs-lau` | `bs-kjv` + Joël en 4 chapitres + 3 Jn 15 | LAU (remplace `bible-strong-french-4-chapter-joel`) |
   | `bs-neg79`, `bs-ost`, `bs-fmar` | `org`, avec de larges surcouches tirées des manifestes de Resource Studio | NEG79, OST, FMAR |
   | `theotex-septuagint` (conservé) | `lxx` + surcouche (Esdras scindé, ADR-0018) | LXX et LXX_FR |
   | `clementine-vulgate` (conservé) | `vul` + surcouche (17 chapitres) | VUL |
   | `bible-strong-catholic-extended-esther-daniel` (conservé) | `org` + Esther et Daniel grecs | BCC1923 |

   - Les trois identifiants fixés par les ADR-0011, 0012 et 0018 sont gardés ; ils désignent désormais une table.
   - Chaque ressource déclare aussi la sienne : `bs-kjv` pour le Trésor et la Nave, `org` pour Rachi, `vul` dans les Psaumes pour les citations de Calmet, et ainsi de suite.
   - **Titres des psaumes :** en `bs-eng` et `bs-kjv`, `org` 51:1-3 correspond à `bs-kjv` 51:1, marqué comme partiel. Un lecteur de la LSG sur Ps 51:1 ou 51:2 reçoit donc ce que le Trésor range sous `19-51-1` (dont les références au titre), et non une clé `19-51-0` que personne ne publie.

3. **Une table de correspondance.**
   - Les `.vrs` Paratext (MIT) et nos `.vrs` propres sont versionnés dans `packages/resource-domain/src/versification/`, avec les notices de licence.
   - Ils sont compilés en un module pur, sans chargement : `toPivot(versification, ref)` et `fromPivot(versification, ref)`, qui renvoient une liste éventuellement vide, avec un indicateur pour une correspondance partielle.
   - Ce module est lu par le service de ressources, l'app, le site et le Worker de l'assistant.

4. **Un garde-fou de publication.** Une Bible dont la couverture (section 2.1) ne correspond pas à sa versification déclarée est refusée, sauf exception déclarée, comme l'ADR-0010 le demande déjà. Le détecteur de Resource Studio valide les tables propres contre les textes.

5. **Un verset sans équivalent ne reçoit rien**, jamais le contenu du voisin.
   - Une fusion ou une division renvoie l'union des clés.
   - L'interface affiche alors le numéro tel que la ressource l'écrit, par exemple « v. 1 (numérotation KJV) ».

6. **Ordre de migration :**
   1. table et garde-fou ;
   2. déclarations ;
   3. conversion à la lecture du Trésor (clé source **et** cibles), de la Nave, des commentaires, des entités, des dictionnaires, de la ligne « mot à mot » et de l'étude de verset ;
   4. fiche de verset ;
   5. lecture parallèle et comparaison ;
   6. données de l'utilisateur ;
   7. réindexation éventuelle des ressources en `org` à la publication, seulement si la conversion à la lecture coûte trop.

### Ce qui demande une décision de Stéphane

1. ~~**Le pivot.**~~ **Décidé le 27 novembre 2026 : `org`.** L'alternative `bs-kjv` et les raisons du choix sont dans la section « Considered pivots » du projet d'ADR.
2. **La clé de cache de la fiche.** **Décidé le 27 novembre 2026 : la plage convertie en `org`, sans la versification** (recommandation ci-dessous).
   - Je recommande la plage convertie en `org`, sans la versification. Une plage qui traverse un chapitre dans une numérotation est gardée comme une plage de début et de fin dans l'ordre `org` : LSG Mal 3:19-24 (`org`) et KJF Mal 4:1-6 (`bs-kjv`) partagent une seule fiche.
   - **La langue fait partie de la clé.** Le partage ne joue donc qu'entre Bibles d'une même langue : LSG, KJF, NEG79… en français, KJV, NIV… en anglais. LSG et KJV ne partagent jamais de fiche.
   - **Titres des psaumes : décidé le 27 novembre 2026, le titre est retiré de la clé, quelle que soit la numérotation.** En `bs-kjv`, le v. 1 contient aussi le titre. Sans cette règle, KJF Ps 51:1-4 donnerait `org` 51:1-6, et non 51:3-6 comme LSG Ps 51:3-6. Avec elle, LSG Ps 51:1-6, LSG 51:3-6 et KJF 51:1-4 donnent toutes `org` 51:3-6. Une plage qui ne contient que le titre le garde. La règle est `passageKeyRange` dans le module partagé.
   - Condition : la fiche écrit ses références en données structurées `org`, rendues dans la numérotation du lecteur, et ne cite jamais un numéro en dur.
   - L'alternative est la clé `(versification, plage)` demandée au départ : plus simple, mais elle sépare les Bibles d'une même langue qui numérotent autrement (LSG et KJF, KJV et NLT).
3. **Les données de l'utilisateur.** **Décidé le 27 novembre 2026 : les anciennes données sans version ne sont pas converties (a).**
   - Quand la version de création est connue (`version` des surlignages), lire la clé dans sa versification.
   - Pour les anciennes données sans version, il faut choisir entre :
     - (a) ne rien convertir ;
     - (b) supposer la versification de la Bible par défaut de la langue de l'app.
   - **Aucune réécriture dans Firestore.**
4. **L'amendement de la clause « ne convertit pas »** des ADR-0011 et 0012. **Décidé le 27 novembre 2026 : on convertit aussi pour comparer**, c'est-à-dire pour le bloc « dans d'autres versions », la comparaison de versions, la lecture parallèle et l'assistant. Les versets sans équivalent, comme les titres des psaumes face à la KJV, gardent leur rangée avec une case vide en face. La comparaison et la lecture parallèle passeraient par la table plutôt que par la position numérique.

---

## 6. Suites à donner, hors de ce travail

- BHS et CHU : Joël 4 manquant (21 versets) ; CHU : 2 Chroniques 36 vide dans la source historique.
- LXX_FR : versification déclarée à tort `bible-strong-default`.
- Le Trésor français garde ses mots-clés anglais dans la réponse (« For I », « my sin »).
- `mhy-fr` : l'API répond 503 sur ses chapitres.
- Libellé trompeur `"French Strong references / STEP OSIS"` dans les manifestes de correspondance : c'est la numérotation LSG.
- **Corrections de `eng.vrs` trouvées en écrivant la table**, chacune vérifiée sur les textes LSG et KJV. Elles sont dans la surcouche commune `bible-strong/eng-fixes.vrs` :
  - Nb 25:19 LSG = début de KJV 26:1 ;
  - Es 64:1 KJV = fin de LSG 63:19 (`eng.vrs` donnait 64:1) ;
  - 1 S 20:42, 1 R 22:43 et 1 Ch 12:4 KJV contiennent chacun deux versets LSG (20:42 et 21:1, 22:43 et 22:44, 12:4 et 12:5) ;
  - 2 Co 13:12-13 KJV = LSG 13:12, et KJV 13:14 = LSG 13:13. Cette correction est propre à `bs-eng`, parce que la NRSV numérote ici comme la LSG.

  Deux regroupements en sens inverse sont justes sans correction : LSG Né 7:68 = KJV 7:68-69 (chevaux, mulets, chameaux, ânes) et LSG Ps 13:6 = KJV 13:5-6. Les tests ne prouvent que la cohérence de la table (chaque verset a un correspondant et la conversion revient sur ses pas). Une erreur qui laisse les deux côtés couverts reste invisible, d'où le contrôle par le texte de la KJF.

  **Contrôle par le texte.** Le détecteur de Resource Studio a aligné, sur leur texte, la KJF publiée (`bs-kjv`, téléchargée chapitre par chapitre depuis l'API) et la numérotation LSG, pour les 31 livres où les deux diffèrent. Le résultat :
  - **21 334 blocs sur 21 521 (99,1 %) correspondent à la table, dont 1 690 qui ne sont pas des identités** : changements de chapitre, titres des psaumes, fusions.
  - Les 187 désaccords sont des fusions ou des divisions locales de deux versets voisins, presque toutes à score faible. Certaines sont des identités à 0,21-0,45 au milieu d'un passage décalé (Nb 30, Ps 18).
  - J'ai lu les huit désaccords à score de 0,75 ou plus : Nb 17:2 et 17:7-8, 1 R 5:1, Dn 4:25, Os 2:1-2, Za 1:19-21 et 2:7-8. Dans chaque cas, le détecteur colle un verset court (« L'Éternel parla à Moïse… ») à son voisin, et la table est juste.
  - Le texte de la KJF confirme aussi que le titre d'un psaume fait partie du v. 1 (Ps 3, 51 et 60).
  - La copie locale `apps/resource-studio/data/bibles/bible-kjf.json` n'est **pas** la KJF publiée : elle mêle la numérotation LSG (Exode 7 en 29 versets, Ps 51 en 21) et la KJV (Joël en 3 chapitres). Elle ne peut pas servir à ce contrôle.
- À auditer : plans de lecture, verset du jour, minutage des enregistrements audio, passages de la bibliothèque de l'assistant (traditions juive, catholique et patristique, qui numérotent chacune à sa façon), et la Bible annotée et Aquifer, à mesurer sur leur contenu.
