# Comparaison des candidates du visualiseur avec Concordance.bible

Le 2 octobre 2026, les deux exports effectivement chargés dans le visualiseur
ont été comparés aux annotations publiques de Concordance.bible. NEG79 est
sensiblement plus proche de cette référence que S21. Le manque principal est
la couverture ; les porteurs trop courts, les reformulations et les vides
restent des limites importantes. Les fichiers sont des candidates de lecture,
pas une annotation intégralement validée.

## Périmètre et reproductibilité

- Sources prédictives inchangées : livraison `strong-source-context-2026-10-02/recheck`.
- Empreintes des JSONL contrôlées contre le manifeste de livraison et enregistrées
  avant l'acquisition complémentaire. Aucun moteur de prédiction n'a été lancé.
- Réévaluation des 201 versets de la dernière réserve et des 968 versets déjà
  consultés. Les résultats de ces derniers sont diagnostiques.
- Acquisition complémentaire de [1 Jean 1 en SG21](https://concordance.bible/SG21/1John/1/)
  et de [1 Jean 1 en NEG](https://concordance.bible/NEG/1John/1/), chapitre consulté
  dans le visualiseur. Ses dix versets ne constituent pas un échantillon aléatoire.
- Comparaison des Strong classiques et de leurs mots porteurs, avec répétitions
  conservées. Les identités d'occurrence source et les enrichissements eStrong,
  dStrong et uStrong ne sont pas notés dans cette comparaison des exports.
- Les expressions discontinues de la référence restent des ensembles d'indices.
  Un accord exact exige le même code et les mêmes mots, ou le même ancrage vide.
- Seules la casse et les apostrophes typographiques sont normalisées. Les
  séquences de mots différentes sont exclues, avec les deux textes conservés.

Commande, depuis `apps/resource-studio`, avec les acquisitions livrées :

```sh
node --import tsx scripts/strong-candidates/compare-reader.ts \
  outputs/strong-source-context-2026-10-02/recheck \
  outputs/strong-viewer-comparison-2026-10-02
```

Ce dernier dossier contient `frozen-readers.json`, les deux pages HTML et leurs
reçus d'acquisition, les annotations réservées à l'évaluateur et `comparison.json`.
Les étiquettes historiques sont vérifiées contre `prepared-inputs.json`.
Les nouveaux exports, lexiques et prédictions ne reçoivent aucune annotation
cible. Aucun appel de modèle, aucune publication, aucune correction du moteur.

## Résultats sur la réserve de 201 versets

| Mesure                                             |         S21 |       NEG79 |
| -------------------------------------------------- | ----------: | ----------: |
| Versets comparables                                |   199 / 201 |   192 / 201 |
| Annotations de référence                           |       2 791 |       2 701 |
| Annotations dans notre lecteur                     |       2 235 |       2 457 |
| Accords exacts                                     |       2 038 |       2 328 |
| Précision exacte : accords / annotations affichées | **91,19 %** | **94,75 %** |
| Rappel exact : accords / annotations de référence  | **73,02 %** | **86,19 %** |
| F1 exact : synthèse de précision et rappel         | **81,10 %** | **90,27 %** |
| F1 avec chevauchement des porteurs accepté         |     83,33 % |     91,74 % |
| Précision sur les seuls porteurs visibles          |     91,39 % |     95,10 % |
| Rappel sur les seuls porteurs visibles             |     77,55 % |     89,81 % |
| Versets entièrement identiques à la référence      |    11 / 199 |    44 / 192 |

Ces nombres mesurent un **accord éditorial**, pas une probabilité de justesse
linguistique. La [FAQ du site](https://concordance.bible/pages/faq/) décrit une
première affectation automatique suivie de vérifications et corrections humaines.
Elle explique aussi la convention des Strong vides et le découpage BHS/NA.
La comparaison ne donne pas accès à leur implémentation interne.

Les huit chapitres réservés avaient été choisis avant le dernier test pour
couvrir différents genres et certains problèmes de notation STEP. Cette
sélection ciblée ne permet pas d'annoncer une précision de toute la Bible.
La présente réévaluation de cette réserve n'est pas un nouveau test indépendant.

| F1 exact par testament |                   S21 |                 NEG79 |
| ---------------------- | --------------------: | --------------------: |
| AT                     | 81,98 % (122 versets) | 93,49 % (117 versets) |
| NT                     |  80,13 % (77 versets) |  86,59 % (75 versets) |

Les résultats diagnostiques sur les anciens chapitres consultés sont cohérents :
F1 exact de 84,20 % pour S21 (964 versets comparables) et 91,11 % pour NEG79
(937 versets). Il ne faut pas les mélanger à la réserve pour améliorer le score.

## Ce qui manque par rapport à la référence

Classification automatique des écarts de la réserve, après protection des
accords exacts puis appariement des mêmes codes par critères plus larges :

| Classe de surface                                       | S21 | NEG79 |
| ------------------------------------------------------- | --: | ----: |
| Même code, porteur qui chevauche mais diffère           |  56 |    38 |
| Même code sur d'autres mots ou une autre répétition     |  88 |    37 |
| Différence visible / vide                               |  20 |    11 |
| Occurrences de référence sans équivalent affiché        | 589 |   287 |
| Occurrences affichées sans équivalent dans la référence |  33 |    43 |

Il s'agit d'un classement des annotations, pas d'une adjudication des causes.
Un même Strong répété peut encore demander un examen de l'identité source.
« Sans équivalent affiché » ne signifie pas « absent de la traduction ».

**Vides : écart majeur.** Concordance affiche 163 vides S21 et 109 vides NEG79
sur les versets comparables ; notre lecteur en affiche respectivement 5 et 9.
Aucun ne coïncide comme vide dans cette réserve. Les catégories éditoriales
diffèrent, et beaucoup de cas sont laissés incertains chez nous. Cela ne justifie
ni de recopier leur convention ni de convertir les cas non résolus en vides.
Il manque une preuve de l'absence et, séparément, une preuve de l'ancrage.

**Expressions.** Une annotation sur un seul mot peut retrouver le bon sens
lexical sans reproduire toute l'expression annotée par Concordance. Cela explique
une partie, mais pas la majorité, de l'écart de rappel.

**Reformulations et variantes.** Les correspondances entre un verbe et une
formulation nominale sont encore mal couvertes. Certaines lectures STEP
alternatives restent également non tranchées. Le système conserve ces situations
dans les dossiers au lieu de les présenter comme des absences.

## Exemple actuel : 1 Jean 1

| Mesure sur les dix versets             |      S21 |   NEG79 |
| -------------------------------------- | -------: | ------: |
| Précision exacte                       |  92,31 % | 93,75 % |
| Rappel exact                           |  83,58 % | 90,00 % |
| F1 exact                               |  87,73 % | 91,84 % |
| F1 avec chevauchement accepté          |  92,95 % | 96,94 % |
| Occurrences de référence non affichées | 20 / 201 | 9 / 200 |

Exemples examinés avec nos dossiers source :

- 1.1 : nous portons plusieurs G3739 sur « que » ; Concordance annote « ce que ».
- 1.2 S21 : G3140 reste incertain chez nous sur la reformulation par « témoins ».
  Le dossier conserve le verbe grec de témoignage ; le manque n'est pas une absence.
- 1.3 : G5547 reste non résolu chez nous alors que le texte contient Jésus-Christ.
  C'est un manque lexical concret à examiner, distinct du découpage d'une expression.
- 1.5 : G0031/G1860 reste bloqué par une lecture STEP alternative `NK(O)`.
  Le code classique choisi par Concordance n'est donc pas simplement perdu à l'export.
- 1.8 S21 : G4105 reste incertain sur « trompons », là où le témoin plus littéral
  NEG79 reçoit un porteur. Cela illustre la dépendance aux formulations témoins.

Dans les expériences antérieures, retirer aussi LSG des témoins fait tomber le
F1 de la réserve publique à 75,78 % pour S21 et 81,32 % pour NEG79, contre
81,19 % et 90,29 % avec LSG. Ces scores portent sur les textes publics de la
réserve, donc sur un dénominateur différent du tableau des exports natifs.
Ils montrent l'utilité de LSG et la limite de généralisation aux traductions
moins proches. Darby et DarbyR demeurent une seule famille de témoins.

## Défaut textuel identifié dans NEG79

Cinq exclusions de la réserve concernent des mots collés dans le texte local :
Psaume 3.7 et Proverbes 20.4, 20.8, 20.11, 20.21. Par exemple, `justiceDissipe`
forme actuellement un seul token. Le défaut existe déjà dans l'entrée figée
`full/environment/data/bibles/bible-neg79.json` et dans le ledger ; il ne vient
pas d'une suppression de balises par le présent évaluateur.

Les autres exclusions concernent les frontières Matthieu 17.14–15 pour les deux
éditions et Actes 24.2–3 pour NEG79. Les textes sont conservés et exclus du score
exact plutôt que de forcer leurs indices à correspondre. Ces cas demandent une
réparation textuelle avec provenance ou une comparaison explicite par blocs.

## Ce que mesure le corpus entier

Le comptage exhaustif des dossiers demeure distinct de l'accord externe :

| État des 441 653 unités source par édition |                      S21 |                     NEG79 |
| ------------------------------------------ | -----------------------: | ------------------------: |
| Unités incertaines                         |         93 460 (21,16 %) |          45 254 (10,25 %) |
| Versets sans incertitude ni alerte source  | 4 010 / 31 169 (12,87 %) | 13 272 / 31 169 (42,58 %) |

« Sans incertitude » décrit la décision du moteur et ne certifie pas tous ses
placements. Le lecteur compact masque les propositions incertaines ; un lecteur
ne peut donc pas encore distinguer tous les motifs d'un mot non annoté.

## Suite recommandée

1. Réparer et vérifier les mots collés de NEG79, puis traiter les blocs de versets
   qui changent de frontière, avec conservation du texte et des preuves.
2. Afficher dans le visualiseur le nombre et les motifs d'occurrences non résolues
   par verset, à partir des dossiers, pour rendre l'incomplétude lisible.
3. Améliorer les expressions et les reformulations lexicales, puis la propriété
   des occurrences répétées. Chaque amélioration doit passer un nouveau test figé.
4. Traiter les vrais vides avec leurs deux justifications. Une recherche sans
   résultat ne doit jamais fournir la preuve d'absence.
5. Mesurer ensuite sur une nouvelle sélection de chapitres, tirée et stratifiée
   avant consultation, pour mieux estimer la généralisation.

La priorité est d'augmenter le rappel sans dégrader la précision, en gardant
l'incertitude explicite. Le dernier cycle n'apportait que des gains de F1 très
modestes ; il reste un travail de fond, particulièrement pour S21.

Validation du comparateur : contrôle TypeScript strict et ESLint réussis ; les
8 tests du contrat de comparaison et les 9 tests Python de l'importeur passent.
Le comparateur n'écrit que dans le dossier de diagnostic et n'altère pas les
Bibles du visualiseur.
