# Audit des niveaux Strong historiques et STEP — 28 septembre 2026

L’impression signalée est confirmée : les définitions historiques et STEP sont souvent proches en hébreu, tandis que le grec STEP emploie des notices d’un style et d’une ampleur très différents. La publication des ressources simples n’a pas substitué STEP aux anciennes définitions.

## Vérifications effectuées

- Lecture seule des anciennes bases Firebase FR/EN conservées dans `outputs/legacy-strong/sources/`.
- Comparaison exhaustive de leurs **28 388 entrées lexicales conservées** avec les bases extraites : aucun changement du champ de définition, y compris la définition française vide de H3966.
- Pour chaque publication simple, contrôle des **22 717 identités STEP** et de leur définition historique attendue, reliée par `language + baseCode` : aucune différence.
- Lecture de **Neon en transaction READ ONLY**, pour les trois publications actives : les 68 151 entrées et 68 151 traductions correspondent aux projections SQLite sur leurs champs communs. Le core de production possède en plus les champs de sens des noms `nameMeaningEnHtml` et `nameMeaningFrHtml` ; ils ne constituent pas des divergences de définition.
- Vérification des empreintes des deux archives simples locales contre leurs manifestes : conformes. Les objets R2 n’ont pas été retéléchargés pendant cet audit.
- Lecture du branchement HTTP/local et du rendu de l’application : les demandes simples sélectionnent `level=simple`, et la fiche conserve séparément `definitionHtml` et `detailedDefinitionHtml`.
- L’API HTTP publique exige App Check ; l’audit de production a donc été réalisé directement en lecture seule dans Neon, sans changer l’authentification ni republier de ressource.

Publications actives contrôlées :

- `strong-lexicon:core` : `strong-lexicon-core-fe91da3f72fe28da25c60833`
- `strong-lexicon:simple-en` : `strong-lexicon-simple-en-784af9ff9fc29bf892cb0b55`
- `strong-lexicon:simple-fr` : `strong-lexicon-simple-fr-944bd06dc903ffaf83df9b51`

## Écart mesuré

Mesures sur le texte visible, après suppression des balises et décodage HTML. Seules les identités STEP possédant les deux définitions sont comparées ; les variantes comptent séparément. Le ratio indiqué est la médiane des ratios calculés entrée par entrée, pas le quotient des deux médianes de longueur. La longueur ne mesure ni la qualité ni l’équivalence du sens.

| Corpus | Identités comparées | Longueur simple médiane | Longueur STEP médiane | Ratio STEP/simple médian |
| --- | ---: | ---: | ---: | ---: |
| Français · hébreu | 11 632 | 85 | 110 | 1.1× |
| Français · grec | 5 707 | 72 | 200 | 2.9× |
| Anglais · hébreu | 11 633 | 90 | 98 | 1× |
| Anglais · grec | 5 705 | 90 | 183 | 2.14× |

Les longueurs sont en caractères. En français, STEP est au moins deux fois plus long pour **23,5 % des entrées hébraïques**, contre **66,8 % des grecques**. À l’inverse, STEP est plus court pour **42,3 % des hébraïques**. Le libellé « détaillé » n’est donc pas une garantie d’un contenu plus long sur chaque mot.

Exemples français, sans inclure le dictionnaire grec supplémentaire :

| Identité | Historique (caractères) | STEP (caractères) |
| --- | ---: | ---: |
| `H0802G` | 143 | 162 |
| `H7225G` | 60 | 179 |
| `H0157G` | 210 | 607 |
| `H0430G` | 95 | 130 |
| `G0026` | 75 | 1360 |
| `G3056` | 1603 | 3154 |
| `G0266` | 167 | 1583 |
| `G4102G` | 780 | 1476 |

- **H0802G, femme** : les deux textes déroulent femme/épouse/femelle, puis les mêmes sous-sens ; quelques formulations diffèrent. 143 contre 162 caractères.
- **H0157G, aimer** : STEP ajoute notamment les formes verbales et des subdivisions ; il est ici réellement plus développé.
- **G0026, amour** : l’historique est une liste courte ; STEP ajoute usages humains/divins, références, synonymes grecs et bibliographie. 75 contre 1 360 caractères.
- **G3056, parole** : même le lexique dit simple conserve une longue notice historique, avec un développement théologique. « Simple » désigne ici l’ancien corpus, pas une réécriture uniformément accessible.

Seulement 68 couples hébreux français ont exactement le même texte normalisé, et aucun couple grec français. « Proche » ne signifie donc pas une duplication technique des champs ; il faudrait une revue linguistique pour chiffrer une équivalence sémantique.

## Pourquoi cette asymétrie ?

Les fichiers STEP utilisés par le projet l’expliquent dans leur propre introduction :

- [TBESH](../data/external/stepbible/TBESH.txt), ligne 6 : l’hébreu bref est fondé sur le BDB abrégé d’Online Bible. Il est généralement organisé en listes de sens, proches de celles de l’ancien corpus.
- [TBESG](../data/external/stepbible/TBESG.txt), ligne 8 : le grec bref est fondé sur Abbott-Smith, avec quelques compléments Middle Liddell ou STEP. Ses notices contiennent des références et des indications philologiques très visibles.
- Le module grec **TFLSJ** est encore une ressource supplémentaire, distincte du grec STEP de base. Il n’est pas inclus dans les chiffres ci-dessus.

L’attribution précise des anciens textes Firebase n’est pas documentée dans les tables examinées. Leur proximité avec TBESH est directement observable ; cet audit ne prétend pas établir leur filiation éditoriale exacte ni attribuer formellement tout l’ancien grec à Thayer.

## Points d’intégration et de produit

### P2 — Le remplacement par l’avancé reste incomplet dans les aperçus

Dans `apps/expo/src/features/resources/layeredStrongLexiconAccess.ts`, `loadEntryCards` et `loadPreview` renvoient le résultat simple même si sa définition est vide. Si le module simple est inaccessible, leur branche de secours efface explicitement la définition STEP (`definitionHtml: undefined`). Les cartes et aperçus ne peuvent donc pas afficher l’avancé dans ces situations, même s’il est disponible.

Le remplacement demandé fonctionne déjà sur `StrongDetailMainPage`, grâce au champ `detailedDefinitionHtml`, mais ce mécanisme n’est pas appliqué aux aperçus. Exemple vérifiable : `H3966`, absent de définition historique française ; les codes étendus comme `H9009` sont également concernés. Correction à prévoir : choisir une définition disponible pour chaque carte, avec sa provenance, en conservant sélection et dédoublonnage des identités.

### Couverture très différente du répertoire STEP

En français, **5 328 identités grecques sur 11 035** n’ont pas de définition historique, dont **5 326 hors de la plage classique G0001–G5624**. Ce sont des extensions du répertoire STEP, pas des définitions perdues lors de l’extraction. Les deux cas dans la plage classique sont `G2994` et `G2995`.

En hébreu, **50 sur 11 682** n’ont pas de définition simple : 49 codes hors plage H0001–H8674, et `H3966` dont le texte source est vide. Ces proportions portent sur le répertoire lexical, pas sur la fréquence des mots rencontrés dans la Bible.

### Les en-têtes restent partagés

Les 22 717 formes originales, translittérations, prononciations et identités de chaque module simple sont identiques à celles du core STEP. Le générateur remplace les définitions mais conserve le répertoire et ses libellés. La fiche complète privilégie aussi les métadonnées de l’entrée détaillée quand elle est disponible. Voir le même mot hébreu/grec ou le même intitulé dans les deux niveaux est donc normal.

### Recommandation éditoriale

Conserver l’historique comme première lecture et nommer le second accès **« Approfondir · STEP Bible »**, puis **« Dictionnaire grec détaillé »** pour TFLSJ. Cela décrit la source et l’usage sans promettre une différence de longueur sur chaque entrée hébraïque. Une véritable définition simple uniforme nécessiterait un travail éditorial supplémentaire, particulièrement pour les longues notices historiques et les codes étendus sans ancien équivalent.

## Périmètre et reproductibilité

Aucune ressource, donnée de production ou règle d’affichage n’a été modifiée pendant cet audit. Les corrections non commitées des tours précédents ont été conservées.

Les scripts et résultats détaillés sont conservés localement dans `outputs/legacy-strong/audit-2026-09-28/` (ignoré par Git) : `read-production.cjs`, `production.json`, `compare.py`, `comparison.json`. Le script de production ne fait que des SELECT dans une transaction READ ONLY. Aucun secret n’est inclus dans ce rapport.


## Suite à l’audit : dédoublonnage de l’affichage

La présentation dispose maintenant d’une comparaison conservatrice dans
`packages/resource-domain/src/strongDefinitionComparison.ts`. Elle conserve les
mots, l’ordre, les diacritiques, les nombres, les négations, les références et les
qualifications grammaticales. Seules la mise en forme et la répétition du libellé
déjà visible sont neutralisées. Aucun seuil de similarité ne suffit à masquer un
texte.

Le registre `strongDefinitionEquivalences.json` ajoute 35 reformulations françaises
relues, chacune avec son motif et les deux textes complets normalisés. Ces décisions
sont invalidées si le contenu ou l’identité STEP exacte change. L’anglais est évalué
sur ses propres textes ; la décision française H0802G n’est pas appliquée au texte
anglais, qui apporte de l’étymologie.

L’exécution sur le snapshot de production de cet audit masque **711 définitions STEP
hébraïques françaises répétitives**, dont **676 équivalences de présentation** et
**35 reformulations vérifiées**. Aucune définition grecque ou anglaise n’est masquée
par ces règles sur ce snapshot. Il s’agit d’un premier lot conservateur : d’autres
reformulations proches restent visibles tant que leur équivalence n’est pas vérifiée.

La section repliable « Définition avancée » n’apparaît que si un complément demeure : une définition
STEP distincte, un sens de nom distinct, d’autres sens ou le dictionnaire grec.
Un texte répété n’est pas réaffiché lorsqu’on ouvre le dictionnaire. Les sources et
les publications sont conservées intégralement.

Le défaut P2 des aperçus relevé plus haut est également corrigé : si la définition
historique manque, la carte peut afficher la définition STEP de la même identité,
sans dépendre des IDs numériques locaux et sans requête supplémentaire quand le
texte historique est disponible.

Recalcul local :

```sh
apps/expo/node_modules/.bin/tsx --tsconfig apps/expo/tsconfig.json \
  apps/resource-studio/outputs/legacy-strong/audit-2026-09-28/dedup-audit.ts
```

Les résultats sont conservés dans `dedup-decisions.json` à côté du script.

## Essai mobile de similarité — 29 septembre 2026

La règle précédente (711 cas et 35 équivalences explicites) est remplacée pour cet
**essai côté application**. Le registre manuel reste uniquement comme fixture de test.
Les ressources R2, Neon et les bases SQLite restent inchangées.

Score : `2 × mots communs dans le même ordre / total des mots des deux définitions`
(plus longue sous-séquence commune). Seuil : 70 %. Garde-fou : la définition avancée
ne doit pas dépasser de plus de 20 % le nombre de mots de la définition simple.
Les références et médias différents empêchent aussi le masquage. Les variantes
sémantiques mineures sont acceptées par cette heuristique éditoriale.

Sur le snapshot de production précédent : **1 476 notices FR** (1 475 hébraïques,
1 grecque) et **2 notices EN** sont masquées, soit 1 478 au total. H5175 FR atteint
70,59 % et est masqué ; H5175 EN reste distinct. Les cas EN sont H0986 et H1087 ;
le cas grec FR est G5024. Relecture des huit premiers cas à la frontière de 70 % :
H0688, H1927, H2491B, H3717, H4931, H5194, H5886 et H7001. Cette règle peut masquer
une traduction différente (ex. dragons/chacal pour H5886) : elle ne prouve pas une
équivalence lexicale et doit être évaluée par l’utilisateur pendant l’essai.

Mesure dans Hermes, build de développement sur simulateur iPhone 17 Pro Max :
5 comparaisons sans cache par cas, 100 appels avec cache par répétition. H5175 FR :
médiane 0,15 ms ; H0802G FR : 0,27 ms ; G0026 FR : 1,02 ms. Sur les dix paires au
plus grand produit de longueurs nécessitant la comparaison, médianes 3,06–3,84 ms.
Cache : médianes inférieures à 0,01 ms. Un pic initial de 48,43 ms est observé pour
G0026 ; ces mesures sur simulateur ne garantissent pas les temps sur téléphone réel.
Le budget maximal conserve les très longues notices sans comparaison coûteuse.

Recalcul local : `similarity-audit.ts` dans le même répertoire ignoré que le snapshot,
avec `tsx --tsconfig apps/expo/tsconfig.json`. Résultats de cette session :
`/tmp/strong-similarity-audit.json` et `/tmp/strong-similarity-benchmark.json`.
