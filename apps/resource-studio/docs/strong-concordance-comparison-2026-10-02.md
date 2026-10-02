# S21 et NEG79 face à Concordance.bible

Comparaison faite le 2 octobre 2026 à la suite de la
[reconstruction S21](./strong-concordance-reconstruction-2026-10-01.md). Elle
porte sur le placement des Strong, pas sur le texte. Rien n'a été publié.

## En bref

Sur 150 chapitres tirés au hasard qui n'ont jamais servi à régler le moteur,
pour 100 mots hébreux ou grecs que Concordance annote (moteur A–G) :

|                                                |      S21 |    NEG79 |
| ---------------------------------------------- | -------: | -------: |
| placés exactement comme Concordance            |   **78** |   **92** |
| laissés incertains par nous (« non localisé ») |       16 |      4,4 |
| Concordance a raison contre nous               | env. 3,4 | env. 2,1 |
| nous avons raison contre Concordance           | env. 1,6 | env. 0,7 |
| deux choix défendables                         | env. 1,4 | env. 1,5 |
| faux des deux côtés                            | env. 0,3 | env. 0,4 |

- Quand nous plaçons un Strong, c'est le même mot que Concordance dans 93 %
  des cas pour S21 et 96 % pour NEG79.
- Le grand écart avec Concordance vient de notre prudence, pas de nos
  erreurs. Dans les 12 incertitudes examinées, Concordance place juste : ce
  sont des placements manqués, surtout parce que le vocabulaire de S21
  s'éloigne de LSG et Darby.
- Les chiffres du test réservé tiennent sur un échantillon six fois plus grand
  et neuf, et le gain du moteur A–G sur le moteur initial se confirme.
- Les pistes 1 à 3 ont ensuite été appliquées (moteur A–J). Mesurées sur la
  réserve scellée, elles portent les mots identiques à Concordance de 77,0 à
  78,5 % pour S21 et de 91,3 à 93,0 % pour NEG79, sans perte de précision
  ([détail](#pistes-1-à-3-appliquées-moteur-aj)).
- Les pistes 4 et 5 (moteur A–L), mesurées sur une seconde réserve, ajoutent
  peu à l'accord (+0,2 pt pour S21) mais retirent des erreurs : la précision
  des porteurs passe de 93,5 à 93,9 % (S21) et de 96,5 à 96,8 % (NEG79)
  ([détail](#pistes-4-et-5-appliquées-moteur-al)).

## Ce qui est comparé

- **Nous** : le moteur actuel (options A à G, code identique au gel v3b) sur
  nos propres textes S21 et NEG79. Il ne s'appuie que sur LSG, Darby et
  DarbyR et ne voit jamais les annotations de Concordance. Les corrections
  manuelles (20 versets S21, 52 NEG79) ne sont pas appliquées, comme dans
  l'expérience.
- **Concordance** : les annotations faites à la main de ses pages publiques S21
  et NEG, utilisées seulement pour comparer.
- **Échantillon** : 150 chapitres tirés au hasard par genre, au prorata de la
  Bible, parmi les 397 chapitres qu'aucune sélection passée n'a touchés
  (`plan-comparison-v1.json`). Cela fait 3 274 versets S21 comparés et
  3 231 NEG79, six fois le test réservé.
- **Réserve scellée** : 120 autres chapitres tirés en même temps, pour mesurer
  les prochaines améliorations. Empreinte : `2871510cca09…`. L'outil refuse de
  récupérer ou d'évaluer la réserve sans gel.
- **Récupération** : 300 pages en deux flux parallèles, une page toutes les 6 s
  par flux, en 15 minutes, sans aucun échec. Le cache reste local, hors Git.

## Résultats

Accord par mot source : un mot que Concordance annote, placé ou marqué non
traduit, compte comme identique si nous faisons exactement la même chose. Les
intervalles à 95 % sont obtenus par rééchantillonnage des chapitres.

|                                                 | S21 initial |                S21 A–G | NEG79 initial |              NEG79 A–G |
| ----------------------------------------------- | ----------: | ---------------------: | ------------: | ---------------------: |
| mots source annotés par Concordance             |      46 324 |                 46 324 |        45 637 |                 45 637 |
| identiques                                      |      74,5 % | **78,0 %** (77,2–78,9) |        87,2 % | **91,8 %** (91,1–92,4) |
| porteurs : même mot que Concordance (précision) |      91,3 % |                 93,1 % |        94,1 % |                 96,1 % |
| porteurs de Concordance retrouvés (rappel)      |      78,2 % |                 81,0 % |        90,6 % |                 93,9 % |
| F1 par occurrence                               |      84,2 % |     86,7 % (86,0–87,3) |        92,3 % |     95,0 % (94,6–95,3) |
| laissés incertains là où Concordance tranche    |      18,3 % |                 15,9 % |         7,4 % |                  4,4 % |
| versets entièrement identiques                  |       9,8 % |                 13,0 % |        32,2 % |                 44,2 % |
| F1 porteur (mesure des canaris)                 |      0,8475 |                 0,8598 |        0,9321 |                 0,9458 |

Sur le test réservé de l'expérience (24 chapitres), le F1 porteur était de
0,8666 pour S21 et 0,9448 pour NEG79 : la mesure tient.

Mots non traduits : Concordance en marque 2 188 dans S21 et 1 726 dans NEG79.
Le moteur A–G en établit 17,7 % et 39,9 %, et presque toujours à juste titre :
96,8 % et 99,4 % de ceux qu'il établit sur un mot annoté sont aussi non
traduits chez Concordance, ancrés au même endroit dans 97,7 % et 97,8 % des
cas. Le reste est laissé incertain, jamais affirmé sans preuve.

### Par genre (moteur A–G)

| Genre                | S21 identiques | S21 incertains | NEG79 identiques | NEG79 incertains |
| -------------------- | -------------: | -------------: | ---------------: | ---------------: |
| Loi                  |         80,8 % |         13,3 % |           93,9 % |            2,4 % |
| Livres historiques   |         79,2 % |         15,0 % |           93,1 % |            3,2 % |
| Poésie et sagesse    |         79,3 % |         14,9 % |           95,6 % |            1,7 % |
| Grands prophètes     |         73,1 % |         18,9 % |           93,0 % |            2,8 % |
| Petits prophètes     |         82,9 % |         11,7 % |           94,4 % |            2,1 % |
| Évangiles et Actes   |         78,7 % |         16,4 % |           88,9 % |            7,7 % |
| Paul                 |         74,5 % |         18,3 % |           87,9 % |            7,0 % |
| Hébreux à Apocalypse |         76,3 % |         17,6 % |           87,1 % |            8,3 % |

NEG79 suit LSG de près : ses écarts se concentrent dans le Nouveau Testament,
où les variantes du texte grec et les identifiants Strong divergent plus. S21
réécrit davantage, surtout chez les grands prophètes et Paul.

## Où nous divergeons

Moteur A–G, en part des mots source annotés par Concordance :

| Famille                                       |            S21 |         NEG79 |
| --------------------------------------------- | -------------: | ------------: |
| incertain chez nous, placé chez eux           | 7 367 (15,9 %) | 2 023 (4,4 %) |
| même Strong sur un autre mot                  |  1 561 (3,4 %) |   844 (1,8 %) |
| placé chez nous, non traduit chez eux         |    557 (1,2 %) |   520 (1,1 %) |
| même mot, portée différente (locution)        |    430 (0,9 %) |   125 (0,3 %) |
| numéro Strong différent pour le même mot      |    253 (0,5 %) |   234 (0,5 %) |
| non traduit chez nous, placé chez eux         |             13 |             4 |
| chez nous seulement (Concordance silencieuse) |            275 |           427 |

## Qui a raison ?

106 désaccords ont été examinés (jusqu'à 6 par famille et par Bible, tirés au
hasard) avec le mot hébreu ou grec, le verset et les trois témoins. Pondérés par la taille
de chaque famille, hors incertitudes :

| Verdict                | S21 (3 089 désaccords) | NEG79 (2 154 désaccords) |
| ---------------------- | ---------------------: | -----------------------: |
| Concordance a raison   |              env. 51 % |                env. 45 % |
| nous avons raison      |              env. 24 % |                env. 14 % |
| deux choix défendables |              env. 20 % |                env. 32 % |
| faux des deux côtés    |               env. 5 % |                 env. 8 % |

Avec six cas par famille, ce sont des ordres de grandeur. Les jugements sont
conservés hors Git (`review/comparison-v1-verdicts.json`).

**Nos erreurs les plus fréquentes**

- Un « et » ajouté par la traduction devant un verbe reçoit le καί initial du
  grec, que la traduction ne rend pas (Mt 25.20, Lc 22.45).
- Le Strong va sur la mauvaise occurrence d'un mot répété ou sur un mot voisin
  (« qui », « serviteur », « prêtre », « à »).
- La portée est trop courte (« effet » pour « En effet », « jusqu'à » pour
  « jusqu'à ce que ») ou une locution apprise est trop longue (« piège et »,
  « n'est pas »).
- Une erreur d'annotation d'un témoin est transférée telle quelle (« tourne »,
  « est », « de » dans LSG).
- Plus rarement, un mot est déclaré non traduit alors que le témoin le rend par
  un pronom collé au verbe (« Coupe-le », « Apportez-les-moi », « s'il ») :
  13 cas dans S21, 4 dans NEG79.

**Erreurs de Concordance trouvées**

- H2416 (« vie ») placé sur « rendirent » (Ex 1.14, dans les deux Bibles).
- Les deux « serviteur » décalés (2 R 5.17).
- Le verbe principal marqué non traduit (Jg 14.6).
- Un relatif, une conjonction ou un « disant » placés sur un mot sans rapport
  (Hé 2.6, Jr 35.1, Jr 42.20).
- H0853 au lieu de H0854 (Jr 12.1).

**Conventions**

- Nous montrons אֵת (marque de l'objet) comme non traduit ; Concordance ne
  l'annote pas. C'est notre convention produit.
- Nous plaçons plus souvent l'article grec.
- Quelques mots ont deux identifiants Strong reconnus (G4119/G4183,
  G3708/G1492).
- Les occurrences répétées sont parfois appariées autrement, avec un affichage
  identique pour le lecteur (« de méchanceté en méchanceté »).

**Nos incertitudes**

Dans les 12 cas examinés, le placement de Concordance est juste. Les causes :

- un vocabulaire absent des témoins (« apparition » pour vision, « parfumé »
  pour oignis, « le maître de l'univers » pour l'Éternel des armées) ;
- l'orthographe des noms propres ;
- des identifiants Strong différents d'un même mot ;
- l'apostrophe droite de « aujourd'hui » ;
- les pronoms élidés (« m'avez ») ;
- les numéraux composés (« dix-huitième ») ;
- les variantes du texte grec.

## Pistes d'amélioration

Repérées ici, puis appliquées : les pistes 1 à 3 d'abord
([moteur A–J](#pistes-1-à-3-appliquées-moteur-aj)), les pistes 4 et 5 ensuite
([moteur A–L](#pistes-4-et-5-appliquées-moteur-al)).

1. **Apostrophes.** Notre normalisation unifie les élisions (« l' »), pas
   « aujourd'hui ». Concordance place 44 « aujourd'hui » dans l'échantillon
   S21 : nous en laissons 28 incertains, et 29 sur 29 dans NEG79.
2. **Familles d'identifiants.** Relier les identifiants d'un même mot que les
   témoins et STEP numérotent différemment : G1492/G3708, G3440/G3441,
   G4302/G4277, G1510/G1511.
3. **Pronoms collés.** Transférer un pronom élidé ou lié par trait d'union sur
   son hôte (« m'avez », « Coupe-le »), et ne jamais y établir un mot non
   traduit.
4. **« Et » ajouté.** Ne pas transférer le « Et » initial d'un témoin sur un
   « et » plus loin dans la cible.
5. **Locutions françaises.** Compléter « jusqu'à ce que », « en effet » ou
   « parce que » quand le témoin n'en étiquette qu'une partie.

Ces pistes viennent de l'échantillon de comparaison, désormais vu : leur effet
devra être mesuré sur la réserve scellée.

## Pistes 1 à 3 appliquées (moteur A–J)

Trois options s'ajoutent au moteur, actives par défaut comme A à G :

- **H, apostrophes** (`typographicApostrophes`) : un mot de la cible écrit
  avec « ' » se compare comme les témoins l'écrivent, avec « ’ ». Le texte
  affiché ne change pas.
- **I, familles d'identifiants** (`strongIdentifierFamilies`) : un mot source
  porte aussi le numéro que les témoins lui donnent quand STEP le numérote
  autrement. Les 21 familles viennent des seuls témoins réutilisables
  (`scripts/strong-identifier-families/derive.ts`). Une paire est retenue si :
  - les témoins l'utilisent dans au moins 5 versets ;
  - le lexique STEP relie les deux numéros (même entrée, forme, dérivé) ;
  - ils ne nomment presque jamais deux mots distincts d'un même verset.

  Ce dernier critère écarte Jésus/Christ (G2424/G5547) et les deux אֵת
  (H0853/H0854). Il garde notamment εἶδον (G1492/G3708), εἶναι (G1510/G1511),
  μόνον (G3440/G3441), πλείων (G4119/G4183) et Jérusalem (G2414/G2419).

- **J, pronoms collés** (`cliticHosts`) : un pronom ou un mot élidé que les
  témoins étiquettent à part (« m’ », « qu’ », « s’ », « -le ») est porté par
  le mot de la cible auquel il est soudé (« m'avez », « s'il », « Coupe-le »).
  Le mot garde son propre numéro et reçoit celui du pronom.

En implémentant J, une erreur de G est apparue. G rapprochait une marque
« non traduit » d'un témoin et notre mot source par la seule position, alors
que les témoins numérotent parfois le verset autrement que STEP. En Mt 14.18,
la marque de ὧδε (« ici ») s'appliquait ainsi à αὐτούς (« les »). G exige
désormais que la marque porte aussi l'un des numéros du mot. Les mots « non
traduits à tort » de la revue (4 versets : Mt 14.18, Lc 6.7, Lc 13.7,
Hé 9.19) venaient tous de là : ils sont maintenant placés ou laissés
incertains.

### En développement (échantillon de comparaison)

| Moteur             | S21 identiques |     S21 F1 | S21 incertains | NEG79 identiques |   NEG79 F1 | NEG79 incertains |
| ------------------ | -------------: | ---------: | -------------: | ---------------: | ---------: | ---------------: |
| A–G (G corrigé)    |        78,02 % |     0,8598 |         18,6 % |          91,78 % |     0,9458 |            7,4 % |
| + H apostrophes    |        78,12 % |     0,8605 |         18,5 % |          91,89 % |     0,9464 |            7,3 % |
| + I familles       |        78,19 % |     0,8597 |         18,4 % |          91,98 % |     0,9456 |            7,3 % |
| + J pronoms collés |        79,32 % |     0,8685 |         17,3 % |          93,24 % |     0,9546 |            6,2 % |
| **A–J**            |    **79,59 %** | **0,8690** |     **17,2 %** |      **93,55 %** | **0,9551** |        **5,9 %** |

F1 : mesure porteur des canaris. Incertains : part des mots source laissés
« non localisé ».

- J porte l'essentiel : environ 600 incertitudes deviennent des placements
  identiques à Concordance dans chaque Bible.
- I fait passer les « numéros Strong différents » de 253 à 160 (S21) et de 234
  à 141 (NEG79).
- H est faible, juste sous le seuil d'adoption de l'expérience (+0,0007 F1),
  mais positif partout et sans régression.
- Coût : une trentaine de pronoms placés là où Concordance les dit non
  traduits.

Contrôles, de A–G à A–J, sans aucune baisse de précision :

| Configuration                       | F1 A–G | F1 A–J |
| ----------------------------------- | -----: | -----: |
| S21 sans la famille Segond          | 0,7836 | 0,7922 |
| NEG79 sans la famille Segond        | 0,8346 | 0,8428 |
| LSG (chapitres de développement)    | 0,8426 | 0,8523 |
| Darby (chapitres de développement)  | 0,8352 | 0,8429 |
| DarbyR (chapitres de développement) | 0,8345 | 0,8424 |
| canari LSG (200 versets)            | 0,8488 | 0,8566 |
| canari Darby                        | 0,8426 | 0,8475 |
| canari DarbyR                       | 0,8376 | 0,8440 |

Les familles sont tirées des annotations des témoins, y compris celui qui sert
de cible dans un contrôle. Elles ne voient jamais S21 ni NEG79.

### Sur la réserve scellée

Le moteur a été figé (`freeze-v4.json` : code, options, plan, cache scellé)
avant toute récupération de la réserve. Les prédictions du moteur remplacé
avaient été faites et scellées avant toute modification du code. La réserve
compte 120 chapitres jamais vus : 2 598 versets S21 et 2 555 NEG79 comparés.

|                                         | S21 initial | S21 A–G |    S21 A–J | NEG79 initial | NEG79 A–G |  NEG79 A–J |
| --------------------------------------- | ----------: | ------: | ---------: | ------------: | --------: | ---------: |
| identiques                              |      73,8 % |  77,0 % | **78,5 %** |        86,9 % |    91,3 % | **93,0 %** |
| F1 par occurrence                       |      83,8 % |  86,1 % | **87,1 %** |        92,1 % |    94,7 % | **95,7 %** |
| porteurs : même mot que Concordance     |      91,1 % |  92,8 % |     93,0 % |        94,0 % |    96,0 % |     96,3 % |
| laissés incertains où Concordance place |      18,7 % |  16,5 % |     15,4 % |         7,5 % |     4,8 % |      3,4 % |
| versets entièrement identiques          |       9,1 % |  11,6 % |     12,9 % |        30,7 % |    40,6 % |     49,1 % |

De A–G à A–J, les intervalles à 95 % sont appariés par chapitre :

- mots identiques : +1,5 pt pour S21 (1,3 à 1,7), +1,8 pt pour NEG79 (1,6 à
  2,0) ;
- F1 par occurrence : +1,0 pt pour les deux.

Le gain mesuré en développement se retrouve donc sur des chapitres neufs.

Ce qui reste :

- Les incertitudes de S21 (15,4 %) viennent surtout de son vocabulaire,
  différent de celui de LSG et Darby. Les trois pistes n'y touchaient pas.
- La réserve est désormais ouverte : les pistes 4 et 5 ont été mesurées sur
  une seconde réserve (section suivante).

## Pistes 4 et 5 appliquées (moteur A–L)

Deux options s'ajoutent, actives par défaut :

- **K, conjonction initiale** (`openingConjunctions`) : une conjonction qui
  ouvre le verset du témoin (« Et », « Or », « Mais ») n'est portée que par le
  premier cinquième du verset cible. Elle ne va plus sur un « et » que la
  traduction ajoute plus loin, devant un verbe (Mt 25.20, Lc 22.45).
- **L, locutions des témoins** (`witnessLocutionLexicon`) : les témoins
  étiquettent d'un tenant 1 607 locutions (« parce que », « afin que »,
  « en effet », « hauts lieux »…). Celles employées au moins trois fois
  forment un lexique. Un mot qui porte le numéro d'une de ces locutions
  s'étend à toute la locution quand la cible l'écrit et qu'aucun autre de ses
  mots ne porte de numéro. Le cas typique est « En effet » dans S21, là où les
  témoins écrivent « car ». Le lexique vient des seuls témoins réutilisables.

La régénération de NFC a aussi montré un défaut de B, aggravé par I. Deux
identifiants d'un même mot source pouvaient rester sur le même mot (« vu »
portait G1492 et G3708 en Lc 2.26). B n'arbitrait que les porteurs posés sur
des mots différents ; NBS comptait déjà 794 de ces doublons avec A–G, et 1 001
avec A–J. Désormais, sur les mêmes mots, un seul porteur reste : celui des
témoins, puis le mieux étayé, puis le premier identifiant de STEP.

### En développement (échantillon de comparaison)

| Moteur                 |     S21 F1 | S21 précision |   NEG79 F1 | NEG79 précision |
| ---------------------- | ---------: | ------------: | ---------: | --------------: |
| A–J                    |     0,8690 |        0,9309 |     0,9551 |          0,9615 |
| + K                    |     0,8696 |        0,9316 |     0,9556 |          0,9620 |
| + L                    |     0,8712 |        0,9332 |     0,9551 |          0,9615 |
| A–L                    |     0,8717 |        0,9339 |     0,9557 |          0,9621 |
| A–L, B sur un même mot | **0,8731** |    **0,9372** | **0,9572** |      **0,9654** |

F1 et précision : mesure porteur.

- K retire environ quatre conjonctions mal placées pour une juste perdue,
  qui devient incertaine. Son gain reste sous le seuil d'adoption ; elle est
  adoptée pour la précision, comme demandé.
- L aide S21 (+0,0022 F1) et ne change rien à NEG79, dont le texte suit les
  témoins.
- La correction de B fait gagner +0,003 de précision dans les deux Bibles.

Contrôles, de A–J à A–L avec B corrigé : tous progressent, en F1 et en
précision.

| Configuration                | F1 A–J | F1 A–L | Précision A–J | Précision A–L |
| ---------------------------- | -----: | -----: | ------------: | ------------: |
| S21 sans la famille Segond   | 0,7922 | 0,7965 |        0,9170 |        0,9246 |
| NEG79 sans la famille Segond | 0,8428 | 0,8454 |        0,9316 |        0,9371 |
| LSG (développement)          | 0,8523 | 0,8564 |        0,9357 |        0,9439 |
| Darby (développement)        | 0,8429 | 0,8463 |        0,8959 |        0,9011 |
| DarbyR (développement)       | 0,8424 | 0,8459 |        0,8994 |        0,9045 |
| canari LSG                   | 0,8566 | 0,8577 |        0,9450 |        0,9483 |
| canari Darby                 | 0,8475 | 0,8483 |        0,9045 |        0,9064 |
| canari DarbyR                | 0,8440 | 0,8451 |        0,9034 |        0,9053 |

### Sur une seconde réserve scellée

La première réserve était ouverte, et il ne restait qu'un chapitre de la Loi
jamais utilisé. La seconde réserve (`plan-comparison-v2.json`) tire donc
120 chapitres, au prorata des genres :

- parmi ceux qui n'ont jamais été comparés à S21 ni NEG79 ;
- en admettant ceux des anciens bancs d'essai, qui ont servi à régler le
  moteur contre LSG et Darby.

Elle compte 15 chapitres frais et 105 de ces bancs, soit 3 473 versets S21 et
3 425 NEG79 comparés. Elle a été scellée avant toute modification du code.
Le moteur A–J l'a prédite d'abord, puis le moteur A–L a été figé
(`freeze-v5.json`) avant de récupérer ses 240 pages.

|                                          | S21 A–J |    S21 A–L | NEG79 A–J |  NEG79 A–L |
| ---------------------------------------- | ------: | ---------: | --------: | ---------: |
| identiques                               |  79,5 % | **79,7 %** |    93,8 % | **93,8 %** |
| F1 par occurrence                        |  87,9 % | **88,1 %** |    96,3 % | **96,3 %** |
| porteurs, précision (mesure des canaris) |  93,5 % | **93,9 %** |    96,5 % | **96,8 %** |
| portée plus courte que Concordance       |     358 |        282 |        65 |         64 |
| placés chez nous, non traduits chez eux  |     603 |        584 |       568 |        550 |
| laissés incertains où Concordance place  |  15,1 % |     15,2 % |     3,1 % |      3,1 % |

De A–J à A–L, intervalles à 95 % appariés par chapitre :

- mots identiques : +0,1 à +0,2 pt pour S21, +0,0 à +0,1 pt pour NEG79 ;
- F1 par occurrence : +0,1 à +0,2 pt pour S21, pas de changement mesurable
  pour NEG79.

Les deux pistes visaient des erreurs rares : l'accord bouge peu, mais les
erreurs reculent. L corrige 76 portées trop courtes dans S21. K retire une
vingtaine de conjonctions mal placées dans chaque Bible. La précision des
porteurs, surtout grâce à B, gagne 0,3 à 0,5 pt.

## NBS et NFC régénérées

NBS et NFC ont été régénérées en entier avec chaque moteur
(`outputs/strong-autonomous/v4` à `v6`), toutes vérifications passées.

| Mesure                            | NBS A–G | NBS A–J | NBS A–L | NFC A–G | NFC A–J | NFC A–L |
| --------------------------------- | ------: | ------: | ------: | ------: | ------: | ------: |
| Mots source placés                | 349 606 | 354 653 | 354 539 | 267 842 | 272 358 | 272 148 |
| Mots non traduits établis         |   4 245 |   4 204 |   4 268 |   2 008 |   1 990 |   2 050 |
| dont par les témoins (G)          |   2 624 |   2 595 |   2 656 |   1 361 |   1 346 |   1 406 |
| Mots source incertains            |  19,8 % |  18,7 % |  18,7 % |  38,8 % |  37,8 % |  37,8 % |
| Versets entièrement comptabilisés |   3 825 |   4 240 |   4 237 |     536 |     601 |     598 |
| Mots du lecteur portant un Strong |  49,5 % |  49,8 % |  49,9 % |  31,8 % |  32,1 % |  32,1 % |
| Mots portant plusieurs Strong     |   5 273 |   7 932 |   6 948 |   4 412 |   6 431 |   5 705 |

- A–J place environ 5 000 mots source de plus dans NBS et 4 500 dans NFC.
  NFC, écrite avec l'apostrophe droite, gagne notamment « aujourd'hui » dans
  251 des 320 versets qui le contiennent.
- Le diagnostic « risques de placement » du générateur compte tout mot
  portant plusieurs Strong. Il monte donc avec J, par construction. Sur un
  échantillon de 16 de ces mots dans NBS, 13 sont justes : « temps-là »
  (עֵת + הוּא), « l'amenez-vous », « n'eut ». Un est un doublon d'identifiants,
  que B retire désormais, et deux sont faux.
- A–L retire environ un millier de doublons d'identifiants par Bible (B). Une
  partie des conjonctions qu'il ne place plus (K) devient « non traduite »
  d'après les témoins.

NBS et NFC n'ont pas de référence externe : ces chiffres décrivent ce qui
change, pas sa justesse, mesurée seulement sur S21 et NEG79.

## Limites

- Concordance n'est pas une vérité de référence, et la revue porte sur 106 cas
  jugés par l'assistant.
- Le texte NEG79 local n'a pas encore la réparation des sauts de ligne, qui
  attend publication. Parmi les 31 versets NEG79 au texte trop différent pour
  être comparés, 14 viennent de mots soudés.
- Les versets numérotés autrement (Nb 16.36–50, Dt 12.32, 2 R 11.21, Dn 5.31
  pour NEG79) et 19 versets aux versifications incompatibles ne sont pas
  comparés.
- Sans les corrections manuelles, la génération publiée différerait sur quelques
  dizaines de versets.

## Voir et rejouer

Le prototype local montre chaque verset avec nos placements et ceux de
Concordance, en trois modes (Comparer, Nous, Concordance), avec un filtre par
type de désaccord, un tableau d'accord par livre et un choix de moteur (A–G ou
A–J) :

```sh
yarn exec tsx scripts/strong-prototype/server.ts   # http://localhost:4321/concordance
```

Les commandes, depuis `apps/resource-studio` (sorties sous
`outputs/strong-concordance-night/`, ignorées par Git) :

```sh
R=scripts/strong-concordance-rebuild/run.ts
P=outputs/strong-concordance-night/plan-comparison-v1.json
yarn exec tsx $R plan-comparison --seed strong-concordance-comparison-2026-10-02 --comparison 150 --reserve 120
yarn exec tsx $R acquire --plan $P --editions SG21 --splits comparison   # et NEG, en parallèle
yarn exec tsx $R predict --plan $P --edition SG21 --scenario target-excluded --split comparison --policy ABCDEFG
yarn exec tsx $R score --run outputs/strong-concordance-night/predictions/SG21__target-excluded__comparison__policy-ABCDEFG
yarn exec tsx $R compare-view --run outputs/strong-concordance-night/predictions/SG21__target-excluded__comparison__policy-ABCDEFG
yarn exec tsx $R sample --run outputs/strong-concordance-night/predictions/SG21__target-excluded__comparison__policy-ABCDEFG \
  --per-category 6 --seed strong-concordance-comparison-review-2026-10-02 --output outputs/strong-concordance-night/review/comparison-v1-SG21.json
```

Les mêmes commandes valent pour NEG79 avec `--edition NEG`, et sans `--policy`
pour le moteur initial.

Les étapes suivantes se rejouent avec les scripts rangés sous
`outputs/strong-concordance-night/` :

- pistes 1 à 3 : `run-step4-dev.sh`, `run-step4-dev-controls.sh`,
  `run-canary-step4.sh`, puis le gel `freeze-v4.json` ;
- pistes 4 et 5 : `run-step5-dev.sh`, `run-step5b-dev.sh` (B sur un même
  mot), `run-step5-dev-controls.sh`, `run-canary-step5.sh`, puis le gel
  `freeze-v5.json`.

La seconde réserve se tire ainsi :

```sh
yarn exec tsx $R plan-comparison --seed strong-concordance-reserve-2026-10-02 --comparison 0 --reserve 120 \
  --exclude-plan outputs/strong-concordance-night/plan-comparison-v1.json --allow-prior \
  --output outputs/strong-concordance-night/plan-comparison-v2.json
```

Les familles d'identifiants se régénèrent avec
`yarn exec tsx scripts/strong-identifier-families/derive.ts --write`.
