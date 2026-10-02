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

Repérées ici. Les pistes 1 à 3 ont ensuite été appliquées
([section suivante](#pistes-1-à-3-appliquées-moteur-aj)) ; les pistes 4 et 5
restent à faire.

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
- La réserve est désormais ouverte. Pour mesurer les pistes 4 et 5, il
  faudra une nouvelle réserve : 127 chapitres frais restent inutilisés.
- Les Bibles générées (NBS, NFC et les sept autres) ne sont pas régénérées
  avec A–J.

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
