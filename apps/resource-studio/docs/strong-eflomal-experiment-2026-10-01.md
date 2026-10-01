# Eflomal local : résultats de la campagne élargie

Date : 1er octobre 2026. Expérience hors ligne, sans application en production.

**Rectificatif découvert dans la campagne suivante :** le texte français de
93 des 720 versets inclut le contenu de notes éditoriales Darby/DarbyR. Les
chiffres ci-dessous restent l’archive de cette expérience ; ils ne mesurent pas
strictement le seul texte de lecture. La préparation, les modèles et l’arbitrage
ont été recalculés après exclusion des notes, comme décrit dans le
[rapport d’arbitrage corrigé](./strong-arbitration-experiment-2026-10-01.md).

## Résultat

**Eflomal est utile pour proposer des candidats supplémentaires.** La version
entraînée sur des séquences de Strong apporte plus que celle entraînée sur les
formes originales brutes. Elle ne remplace pas notre moteur actuel. Une
simulation combinant stabilité, appui lexical et corrections conjointes améliore
précision et rappel, mais la précision des modifications reste insuffisante pour
une application automatique selon le critère fixé avant le calcul des scores.

Le protocole sélectionne donc **le moteur actuel sans modification automatique**.
Les autres résultats ci-dessous sont descriptifs ; ils ne servent pas à changer
cette sélection après lecture du test.

## Échantillon et séparation

- 240 passages différents du premier pilote, chacun dans Sg1910, Darby et DarbyR :
  720 textes de versets, pas 720 observations bibliques indépendantes.
- 112 passages pour la calibration, soit 336 textes ; 128 passages pour le test,
  soit 384 textes. Même séparation par chapitre dans les trois éditions.
- 100 passages supplémentaires réservés : leurs chapitres ne participent ni à
  l’apprentissage ni à cette évaluation.
- 14 803 versets d’apprentissage Sg1910 ; 14 804 pour Darby et DarbyR. Les
  chapitres du premier pilote, de la calibration, du test et de la réserve sont
  exclus. Les identités source partagées avec les passages évalués ou réservés
  sont également exclues des lignes d’apprentissage.
- Aucune identité physique STEP partagée entre calibration et test dans le lot
  préparé. L’exclusion de chapitres ne supprime cependant pas toute dépendance
  littéraire entre passages parallèles ; les résultats ne justifient pas une
  hypothèse d’indépendance de toutes les occurrences.

L’apprentissage reçoit uniquement les séquences source et le français débarrassé
de ses balises. Il n’utilise pas les annotations attendues. Les paramètres
lexicaux, de déplacement et de fertilité sont ensuite conservés. Chaque verset
évalué est traité **isolément** avec ces paramètres : l’inférence locale ajuste
ses variables d’alignement, sans apprendre des autres versets du test.

Le moteur de référence conserve ses règles : balises de la Bible évaluée masquées,
famille éditoriale exclue des témoins, corrections éditoriales désactivées. Le
transfert depuis les autres témoins autorisés reste disponible à l’inférence.
Il s’agit d’une comparaison de méthodes disposant de sources différentes, pas
d’une expérience où tout le savoir préalable serait identique.

## La revue couvre maintenant les placements établis

L’option expérimentale `includeAllReaderAnnotations` ajoute les mots et phrases
déjà visibles au rapport lexical. Les règles de sélection par défaut restent
inchangées. La revue examine 3 234, 3 246 et 3 239 annotations respectivement.

Sur le test, les **473 placements initiaux non conformes à la référence** sont
tous présents dans cette revue. Cela signifie qu’ils sont examinables ; cela ne
signifie pas que le bon remplacement est toujours disponible.

Le pilote précédent ne ciblait que 10 de ses 538 placements non conformes.
Les échantillons diffèrent : on peut comparer le périmètre de la revue, pas
interpréter la différence 538→473 comme une amélioration du moteur.

## Couverture des candidats

Cette mesure porte sur 878 cas de test avec une occurrence source et une
annotation attendue uniques, dont le placement initial ne contient pas la bonne
cible visible. Elle inclut 584 manques et 294 placements existants non conformes.

Les listes incluent le support existant lorsqu’il y en a un. L’ajout Eflomal
utilise la réunion des directions de la graine 17, projetée en supports continus,
sans consulter la réponse attendue.

| Candidats proposés                                  | Bonne cible disponible | Nombre moyen de choix |
| --------------------------------------------------- | ---------------------: | --------------------: |
| Lexique, cinq meilleurs candidats                   |    422 / 878 — 48,06 % |                  1,92 |
| Lexique, dix meilleurs candidats                    |    425 / 878 — 48,41 % |                  2,03 |
| Lexique, jusqu’à cent candidats                     |    425 / 878 — 48,41 % |                  2,03 |
| Cinq candidats lexicaux + Eflomal Strong            |    543 / 878 — 61,85 % |                  2,29 |
| Ensemble lexical + Eflomal Strong                   |    545 / 878 — 62,07 % |                  2,41 |
| Ensemble lexical + les deux représentations Eflomal |    573 / 878 — 65,26 % |                  2,66 |

**Augmenter simplement la limite de cinq à dix apporte peu.** Eflomal récupère
des cibles que le générateur lexical ne proposait pas. La combinaison complète
ajoute 151 cibles correctes par rapport au top cinq, avec moins d’un choix
supplémentaire en moyenne. Il reste 305 cas sans la bonne cible exacte.

Par catégorie, la combinaison complète couvre 375/584 manques et 198/294
placements non conformes. Ces taux ne sont pas directement comparables aux
66,9 % du pilote JEV/Laya, dont le sous-ensemble et la sélection étaient différents.

## Reconstruction des placements visibles

Les scores restent des mesures de conformité aux balises CSV, pas une validation
indépendante du sens. Le score officiel conserve les occurrences répétées.

| Variante, sur le même test                                | Précision |  Rappel |      F1 |
| --------------------------------------------------------- | --------: | ------: | ------: |
| Moteur actuel                                             |   89,76 % | 78,07 % | 83,51 % |
| Eflomal Strong seul, intersection des directions          |   75,08 % | 63,30 % | 68,69 % |
| Eflomal formes originales seul, intersection              |   65,80 % | 41,35 % | 50,79 % |
| Moteur + Strong, stabilité seule                          |   84,54 % | 79,33 % | 81,85 % |
| Moteur + Strong, stabilité et appui lexical, intersection |   91,15 % | 81,03 % | 85,79 % |
| Moteur + Strong, stabilité et appui lexical, réunion      |   90,99 % | 80,39 % | 85,36 % |

« Stable » signifie même support pour la même occurrence sur trois graines
distinctes. L’appui lexical exige une proposition portant sur ce support exact
dans la revue élargie. Une stabilité seule ajoute beaucoup de placements erronés.

Les déplacements sont simulés ensemble. Un échange de supports peut donc être
accepté ; les nouveaux chevauchements sont rejetés et les anciens supports
restaurés jusqu’à stabilisation. Une absence de lien produit une abstention,
sans supprimer une annotation existante ni affirmer que le mot n’est pas traduit.
Les liens discontinus sont conservés dans les sorties brutes mais ne sont pas
transformés artificiellement en une phrase continue.

### Pourquoi le gain global ne suffit pas

La variante descriptive au meilleur F1, Strong/intersection avec appui lexical,
effectue 232 modifications sur le test : 189 conformes et 43 non conformes,
soit **81,47 % de conformité des modifications**. Elle gagne 157 vrais positifs
et diminue les faux positifs nets de 55. Une amélioration agrégée peut donc
coexister avec un nombre important de modifications incorrectes.

Sur la calibration, cette variante obtient 125/157 modifications conformes,
soit 79,62 %. La variante réunion avec lexique atteint 99/116, soit 85,34 %.
Aucune des six variantes hybrides ne satisfait le seuil exploratoire de 98 %
sur au moins 30 modifications, sans augmentation des faux positifs. Le seuil
n’a pas été assoupli après lecture du test.

## Ce que les exemples disent de nos critères

L’examen technique des modifications Strong/intersection/lexique distingue :

- 102 ajouts de support visible, dont 95 conformes ;
- 97 modifications d’un support qui recouvrait déjà une cible de référence,
  dont 66 conformes ;
- 33 déplacements depuis un support sans chevauchement avec une cible attendue,
  dont 28 conformes.

Cette classification utilise les intervalles et balises existants. Elle ne
constitue pas une adjudication sémantique. En particulier, environ un tiers des
189 modifications conformes sont des ajustements d’étendue : le gain de F1
exact ne doit pas être présenté intégralement comme un gain de compréhension.

Exemples Sg1910 examinés, sans modifier le gold :

- Exode 26.29, H7175 : ajout sur « planches », conforme à la référence et à la
  glose STEP relative aux panneaux/cadres.
- Nombres 3.1, H8435 : ajout sur « postérité », conforme à la référence et à
  la glose de descendance.
- Exode 26.29, H1280 : « les barres » devient « barres ». Le score exact gagne,
  mais la différence est principalement une convention d’étendue.
- Lévitique 22.12, H6944 : « saintes » devient « choses », dans « choses saintes ».
  La référence et le modèle choisissent deux têtes différentes d’une même
  expression ; il faut annoter le groupe acceptable avant de trancher sur le sens.
- Ruth 3.10, H0970 : le support proposé devient « jeunes » plutôt que « gens »
  pour une glose « young men ». Là encore, la relation de groupe mérite d’être
  séparée du choix du mot portant le numéro.

Le paquet `blind-review.json` prépare 60 passages distincts, avec tokens source
et français, sans montrer les annotations CSV ni les prédictions. Les champs
« certains », « possibles », « absents » et « incertains » restent vides. Ce
paquet doit être annoté avant de devenir une nouvelle référence sémantique.

## Reproductibilité et coût

- Aucun appel à JEV ou à un modèle distant pour cette campagne.
- Six entraînements corrigés : 121,93 secondes cumulées ; 4 320 inférences locales :
  41,58 secondes cumulées, médiane 7,73 ms par paire. Hors préparation du moteur
  canonique, installation et génération des rapports ; timings non isolés.
- Les 18 fichiers d’entraînement/prior ont été reproduits à l’identique entre
  deux entraînements avec la même graine et le même binaire.
- 150 paires réexécutées avec les mêmes paramètres donnent les mêmes liens.
- Changer la graine modifie cependant le support ou l’abstention pour 1 623 des
  5 859 occurrences source de test avec Strong, et 2 212 avec les surfaces.
  Répétabilité et stabilité à une autre initialisation sont deux propriétés
  différentes ; aucune ne garantit la justesse.

Eflomal upstream lit normalement une graine système. Le checkout privé a reçu
un petit patch pour une graine explicite, et OpenMP est limité à un thread.
Révision : `1fe2a43e3667fb2461736ddb48783ab0cf98a171`. Les fichiers de modèle
enregistrent les empreintes du binaire, du runner, des données et des priors.
La répétabilité n’est pas certifiée sur une autre machine ou un autre compilateur.

Une première exécution d’inférence est invalide : mon filtre de priors oubliait
de normaliser la casse des Strong. Elle est conservée et signalée dans `v1`.
Le test de non-régression compare désormais les priors natifs complets et filtrés.
Le jeu d’entrée et les politiques sont restés identiques, puis tous les modèles
et inférences ont été recalculés dans `v1-corrected`. Les premiers scores
invalides ne fondent aucune conclusion de ce rapport. Le test a été recalculé
après cette correction d’intégration ; il ne s’agit pas d’un nouveau lot aveugle.

## Limites et décision

La comparaison Strong/surface favorise ici une représentation moins dispersée :
sur le test, 156/5 859 tokens Strong sont absents du vocabulaire d’apprentissage,
contre 1 713/5 859 surfaces. C’est une explication plausible de l’écart, pas une
ablation démontrant sa cause. Une normalisation linguistique ou des lemmes
pourraient améliorer le modèle de surfaces.

Les sources conservent l’inventaire amalgamé STEP, pas une édition manuscrite
unique. Les mêmes mots physiques portant plusieurs identités sont développés en
plusieurs occurrences de travail. Les scores CSV ne vérifient toujours pas une
identité source fine ni tous les groupes sémantiques. La qualité sur une Bible
cible plus libre, par exemple NBS, n’est pas établie par ce lot.

Le dictionnaire par défaut V3 reste refusé par ses contrôles d’attestation.
Comme dans le pilote précédent, le benchmark utilise explicitement le
dictionnaire legacy strict. Aucune protection n’a été désactivée.

**Suite recommandée : conserver Eflomal comme générateur de candidats locaux,
puis tester un arbitre sur ces listes élargies et sur les placements établis.**
La comparaison suivante peut utiliser JEV avec le contexte des occurrences
voisines. En parallèle, une petite référence de groupes certains/acceptables
permettrait de distinguer les véritables erreurs des conventions de support.

## Artefacts et validation

- [Code, installation, protocole et reproduction](../scripts/strong-alignment-benchmark/README.md).
- [Rapport généré](../outputs/strong-alignment-benchmark/v1-corrected/report.md).
- [Mesures et provenance](../outputs/strong-alignment-benchmark/v1-corrected/summary.json).
- [Modifications à auditer](../outputs/strong-alignment-benchmark/v1-corrected/changes-for-audit.json).
- [Paquet de revue sans prédictions](../outputs/strong-alignment-benchmark/v1-corrected/blind-review.json).
- [Vérifications des répétitions et durées](../outputs/strong-alignment-benchmark/v1-corrected/execution-verification.json).

Les sorties volumineuses sont locales et ignorées par Git. Les 34 tests Node
ciblés et les deux tests Python passent. Typecheck du workspace, contrôle
TypeScript explicite des scripts et lint ciblé passent. Les contrôles globaux
historiquement en échec, décrits dans le comparatif précédent, ne sont pas
présentés comme corrigés par cette expérience.
