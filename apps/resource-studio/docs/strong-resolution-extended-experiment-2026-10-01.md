# Résolution Strong : revue réutilisable et validation finale

Le cycle étendu livre un **flux local opérationnel**, du ledger à un dossier par
verset, puis de décisions documentées à une nouvelle prévisualisation Strong.
Les absences, les ancrages et l’origine des jugements restent séparés. Les règles
de production n’adoptent pas les nouvelles propositions automatiquement.

Le but reste de rendre compte de chaque occurrence, y compris lorsqu’un mot
source n’a pas d’équivalent explicite. Le livrable ne certifie pas une Bible
entière : la validation logicielle est accomplie, la référence sémantique reste
une revue assistée exposée et n’a pas reçu d’adjudication humaine indépendante.

## Ce qui fonctionne maintenant

- Construire un dossier à partir d’un ledger contenant ses versets, ou des
  corpus gelés. Chaque unité Strong source conserve son identité, sa glose,
  sa morphologie, son fichier et sa ligne de provenance.
- Proposer un porteur par transfert d’une expression témoin exactement retrouvée
  une seule fois dans la cible, avec contrôle des répétitions, conflits et
  porteurs occupés. Un échec ne propose jamais une absence certaine.
- Examiner les textes dans une page locale, choisir les mots d’une relation,
  son support d’affichage, ou motiver une absence et son ancrage séparément.
- Exporter les décisions, vérifier leurs liaisons au texte et à la source, puis
  les réappliquer de façon déterministe. Le changement du contexte des placements
  invalide un ancrage sans invalider silencieusement la relation.
- Produire le texte avec balises Strong via le renderer existant et conserver
  toutes les preuves dans un fichier associé. Les textes canoniques ne changent pas.

Les revues assistées ne sont appliquées qu’avec `--assisted`. Elles conservent le
statut `assistant-reviewed`, même lorsque leur décision est un vide. Les décisions
humaines portent une provenance différente ; ce champ seul n’établit pas une
indépendance ou une adjudication. Les relations discontinues restent des ensembles
de tokens ; le support affiché est choisi séparément, sans remplir artificiellement
les trous. Les ambiguïtés de lecture ou d’identité bloquent la projection concernée.

Code : [résolveur](../src/strongResolutionWorkflow.ts),
[commandes et protocole](../scripts/strong-resolution-workflow/README.md).

## Référence de travail effectivement examinée

[120 décisions](../scripts/strong-resolution-workflow/reference/assisted-review-2026-10-01.json)
couvrent **57 textes d’édition, 26 références bibliques** :

| Décision de revue                                          | Nombre |
| ---------------------------------------------------------- | -----: |
| Relation visible                                           |     88 |
| Absence explicite proposée, avec ancrage motivé séparément |     10 |
| Incertitude conservée                                      |     22 |

La sélection comprend toutes les 42 propositions de vide du cycle précédent et
toutes les unités de cinq passages courts dans trois éditions : Exode 13.1,
Psaumes 91.16 et 137.2, Proverbes 7.17 et Matthieu 3.8. Cela donne **15 textes
entièrement examinés**, dont **11 sans occurrence laissée incertaine dans cette
revue assistée**. Le périmètre est celui des unités Strong présentes dans le
modèle source ; ce n’est pas un inventaire de chaque morphème des langues originales.

Chaque jugement cite la ligne STEP et le texte français effectivement examinés.
L’assistant avait accès au développement et à ses résultats : ces décisions sont
donc explicitement **exposées**, sans annotation aveugle ni second expert inventé.
Les gloses anglaises et la morphologie aident l’inspection, mais ne remplacent pas
une expertise philologique indépendante. Aucun de ces jugements n’a servi à
ajuster la règle automatique testée sur la réserve.

## Exemples qui répondent au besoin métier

**Exode 13.1, DarbyR — H0559.** La source porte un second verbe, « disant », après
le verbe « parler ». DarbyR dit « L’Éternel parla à Moïse : ». La revue propose un
vide pour l’absence de second équivalent explicite, tout en reconnaissant que
l’acte de parole est conservé. Elle rattache ce vide à H1696 « parla ». Ce choix
d’ancrage est motivé séparément ; il n’est pas déduit d’un ratio de longueur.
Dans LSG et Darby, la même occurrence a respectivement « dit » et « disant ».

**Genèse 44.15 — H2088.** « Quelle action avez-vous faite ? » ne contient pas de
démonstratif explicite correspondant à « cette [action] ». La revue propose un
vide à côté d’« action ». « Quelle » appartient déjà à l’interrogatif source.
Ce jugement demeure assisté, même si son explication paraît convaincante.

**Lévitique 22.12, Darby/DBYR — H3588.** Le « si » français est explicite : il
faut retrouver un porteur, même si LSG porte un vide. De même, « Et » au début
d’Actes 8.2 dans Darby réalise la liaison que LSG et DBYR n’expriment pas au début.

**Deutéronome 22.2 — H8432.** La combinaison source « vers + l’intérieur de »
peut être exprimée conjointement par « dans ». Le dossier laisse ce cas incertain :
il manque une décision de groupe, pas forcément un mot français.

**Psaume 91.16 — H7200.** La relation comprend « et je lui ferai voir », tandis
que le support verbal retenu est « ferai voir ». Cela démontre concrètement que
la relation complète et le porteur du numéro sont deux décisions différentes.

## Développement et effets des revues

Le développement comprend **720 textes, 10 248 unités source d’édition**.
Le rejeu de la référence assistée donne les transitions suivantes :

| Avant            | Après la revue assistée     | Unités |
| ---------------- | --------------------------- | -----: |
| Non résolu       | Visible                     |     18 |
| Non résolu       | Vide avec ancrage documenté |     10 |
| Non résolu       | Toujours incertain          |     22 |
| Visible existant | Visible revu                |     70 |

Le diagnostic global passe de 8 195 visibles et 2 053 non résolus à **8 213
visibles, 10 vides et 2 025 non résolus**. La couverture structurelle complète
passe de 99 à 107 textes. **Zéro texte n’est déclaré entièrement revu humainement.**
Le gain de couverture après réapplication de décisions connues n’est pas une
mesure de généralisation ou de certitude indépendante.

La comparaison aux balises CSV passe de TP/FP/FN = 7 742/720/2 004 à
7 757/719/1 989. Elle retire toutefois **trois porteurs auparavant exacts selon les
CSV** : G2590 sur « fruit » dans Matthieu 3.8, dans les trois éditions. La revue
laisse explicitement la lecture STEP N(k)O non résolue ; la prévisualisation retire
alors l’affirmation de porteur, même si le mot français paraît évident. Ce retrait
conservateur est signalé, pas requalifié en réussite. Ces sorties sont des
prévisualisations de revue, pas une promotion automatique en production.

## Règle automatique gelée et réserve finale

Le transfert exact a proposé **28 porteurs** sur le développement : **26 exacts
selon les CSV, deux divergents**, aucun porteur correct existant perdu. Les
critères fixés avant la réserve étaient : au moins 30 propositions, 98 % d’accord
exact, aucune hausse de faux positifs, aucune perte de porteur exact existant.
La règle échoue à cette porte et reste **désactivée** dans la politique gelée.
Les suggestions restent consultables pour la revue.

Le [gel](../outputs/strong-resolution-workflow/freeze-v1.json) contient les
empreintes du code, du plan, des sources, des dictionnaires et des ressources
lexicales locales. La réserve a ensuite été préparée et évaluée sans changement
de politique. Les 100 références réservées donnent **300 textes, 4 467 unités** :

| Résultat de validation finale                           |  Nombre |
| ------------------------------------------------------- | ------: |
| Visibles existants                                      |   3 502 |
| Unités non résolues, avec raisons                       |     965 |
| Absences automatiquement certifiées                     |       0 |
| Textes avec couverture structurelle complète            |      40 |
| Textes entièrement revus humainement                    |       0 |
| Suggestions exactes / suggestions produites             | 16 / 20 |
| Porteurs exacts existants perdus par la politique gelée |       0 |

Les quatre divergences parmi les vingt suggestions confirment l’utilité de la
porte d’abstention. Aucun seuil n’a été réajusté après ce résultat. Le résultat
automatique conserve donc les TP/FP/FN de départ : **3 305/308/870**. Cette absence
de régression est attendue puisque les transferts sont désactivés ; elle ne
prouve pas un progrès automatique de précision.

La cible et toute sa famille éditoriale sont exclues des témoins de prédiction.
Darby et DBYR ne fournissent pas deux votes indépendants. Les décisions sont
rejouées à l’identique et enregistrées avant le calcul des accords avec les
annotations cible. Les CSV évaluent la compatibilité éditoriale du porteur, pas
la vérité sémantique d’une absence. Les 100 passages de réserve ont maintenant
été utilisés : ils ne sont plus une réserve vierge pour les prochaines méthodes.

## Artefacts et validation

- [Dossier interactif et revue locale](../outputs/strong-resolution-workflow/assisted-authoring-v1/review.html)
- [Prévisualisation Strong issue des revues](../outputs/strong-resolution-workflow/assisted-authoring-v1/generated-preview.json)
- [Décisions et preuves par occurrence](../outputs/strong-resolution-workflow/assisted-authoring-v1/predictions.json)
- [Développement gelé](../outputs/strong-resolution-workflow/development-frozen-v1/summary.json)
- [Évaluation des revues assistées](../outputs/strong-resolution-workflow/assisted-evaluation-v2/summary.json)
- [Validation finale](../outputs/strong-resolution-workflow/reserve-evaluation-v1/summary.json)

**85 tests ciblés passent**, avec typecheck du workspace, TypeScript strict du
runner, lint et vérification des empreintes. Le parcours ledger → dossier →
prévisualisation a aussi été exécuté sur un vrai ledger de 100 versets. La page a
été vérifiée dans le navigateur pour la recherche, la sélection de verset et la
consultation des justifications distinctes ; l’import/export complet dans le
navigateur n’a pas été vérifié après la perte de liaison avec le navigateur.
Les formats d’import et leur application sont vérifiés côté programme.

Le cycle est achevé avec un flux utilisable et une validation finale. Il reste
des décisions de groupe, de lecture source et de philologie qui demandent une
adjudication pour atteindre une certitude indépendante. Cette limite est portée
par les données elles-mêmes ; elle n’est pas masquée par un score ou par un vide.
