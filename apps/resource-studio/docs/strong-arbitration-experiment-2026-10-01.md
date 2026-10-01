# Arbitrage JEV après enrichissement Eflomal et correction du texte

Date : 1er octobre 2026. Expérience hors ligne ; aucun placement de production
ni pointeur de dictionnaire n’est modifié.

**L’enrichissement Eflomal et le contexte source augmentent le nombre de bonnes
cibles choisies par JEV : 309/378 contre 275/378 avec le lexique seul.** Aucune
politique ne satisfait toutefois le seuil d’application automatique sur la
calibration. L’audit montre surtout que notre score exact mélange des erreurs
d’alignement, des conventions d’étendue et des identifiants Strong alternatifs.

## Résultats corrigés

Sur les 450 décisions de test, 383 sont évaluables sans ambiguïté contre la
référence CSV : 378 avec une cible visible et cinq avec une balise vide explicite.
Les 67 autres restent non évaluables pour le choix individuel. Elles restent
prises en compte dans la reconstruction complète contre les balises CSV.

| Variante                     | Bonne cible proposée, sur 378 | Bonne cible visible choisie, sur 378 |
| ---------------------------- | ----------------------------: | -----------------------------------: |
| Lexique                      |                 296 — 78,31 % |                        275 — 72,75 % |
| Lexique + Eflomal            |                 340 — 89,95 % |                        301 — 79,63 % |
| Lexique + Eflomal + contexte |                 340 — 89,95 % |                        309 — 81,75 % |

Eflomal rend disponibles 44 cibles exactes supplémentaires ; JEV avec contexte
en choisit 37. Sur les 296 cibles déjà disponibles dans le lexique, il en choisit
272 correctement, contre 275 avec le lexique seul. L’ajout de candidats crée
donc aussi de nouvelles possibilités de confusion. Le contexte apporte huit
choix visibles conformes nets par rapport à l’enrichissement seul.

La mesure incluant les abstentions correctes donne respectivement 338/383,
314/383 et 322/383. Elle ne raconte pas la même chose : lorsque la cible manque
dans une liste, `UNSURE` est la réponse attendue ; lorsque cette cible est ajoutée,
il faut la choisir. C’est pourquoi le tableau compare aussi les cibles visibles
retrouvées sur un dénominateur commun. Ces taux ne se comparent pas directement
aux 65,3 % de couverture de la campagne Eflomal précédente : le sous-ensemble
est différent et le présent échantillon comprend des placements déjà corrects.

La simulation suivante utilise le seuil descriptif 0,95, inclus dans le protocole
avant les appels. Elle porte sur les 384 textes de versets de test, dont seulement
450 occurrences sont soumises à l’arbitrage.

| Variante                          | Précision |  Rappel |      F1 | Modifications conformes |
| --------------------------------- | --------: | ------: | ------: | ----------------------: |
| Moteur actuel sur texte corrigé   |   90,75 % | 78,69 % | 84,29 % |                       — |
| + JEV, lexique, ≥ 0,95            |   90,85 % | 79,48 % | 84,78 % |         42/43 — 97,67 % |
| + JEV, enrichi, ≥ 0,95            |   90,80 % | 79,57 % | 84,82 % |         47/53 — 88,68 % |
| + JEV, enrichi + contexte, ≥ 0,95 |   90,82 % | 79,68 % | 84,89 % |         53/59 — 89,83 % |

Aucun placement initial conforme n’est dégradé dans ces trois variantes à 0,95.
La variante avec contexte ajoute cependant deux faux positifs nets. Sans seuil,
elle atteint F1 85,26 %, mais effectue 146 modifications dont 111 conformes,
dégrade huit placements auparavant conformes et ajoute 26 faux positifs nets.
Le meilleur F1 descriptif ne suffit pas à sélectionner une politique.

La calibration reste décisive : à 0,95, le lexique seul obtient 45/47 modifications
conformes et le contexte enrichi 53/62. Aucune des 21 combinaisons variante/seuil
n’atteint simultanément 98 % de conformité, au moins 30 modifications et aucun
faux positif supplémentaire. **La sélection conservée est le moteur initial.**

## Les six écarts à 0,95 interrogent notre référence

Dans la variante enrichie avec contexte, les six modifications non conformes
au CSV se répartissent ainsi :

| Édition et passage                | Proposition          | Balise ou support de la référence | Diagnostic technique  |
| --------------------------------- | -------------------- | --------------------------------- | --------------------- |
| Sg1910, Ecclésiaste 9.10, H7585   | « séjour des morts » | « morts »                         | Étendue du groupe     |
| Sg1910, Romains 8.32, G3739       | « Lui qui »          | « Lui »                           | Étendue du groupe     |
| DarbyR, 1 Chroniques 26.26, H5921 | « responsables de »  | « responsables »                  | Étendue du groupe     |
| Darby, Luc 4.33, G2258            | « avait »            | Même expression sous G1510        | Identifiant différent |
| DarbyR, Actes 2.31, G4308         | « prévoyant »        | Même expression sous G4275        | Identifiant différent |
| DarbyR, Actes 8.2, G3778          | « lui »              | Même expression sous G0846        | Identifiant différent |

Ces observations **ne reclassent pas les six cas en réussites sémantiques**.
Elles montrent pourquoi 53/59 de conformité exacte n’est pas directement une
estimation du taux de justesse linguistique. Il faut arbitrer les groupes,
l’identité source et la convention de publication avant de modifier la mesure.

Les trois différences de code illustrent un problème de représentation à
examiner avant de multiplier les modèles. L’en-tête TAGNT décrit ses « Alt
Strongs » comme des façons alternatives d’étiqueter un même mot. Notre lecteur
les ajoute à l’inventaire et `getOriginalStrongOccurrences` les développe en
occurrences de travail distinctes. Par exemple, le même token d’Actes 8.2 porte
G0846 et l’alternative G3778 ; une proposition peut alors trouver « lui » sans
justifier l’ajout d’un second Strong dans l’édition cible.

Dans cet échantillon, 79/900 cas, dont 40/450 de test, ont un code évalué différent
de la base du code STEP présenté. Cela inclut des équivalences de formes fléchies
et ne signifie pas 79 erreurs. Les requêtes indiquent le code STEP et sa glose ;
elles ne demandent pas de résoudre explicitement la politique de choix entre
alias. Cette expérience évalue donc principalement le support français, pas
l’adjudication des identifiants. L’audit complet est conservé dans
`source-alias-audit.json` ; les sources sont `stepOriginals.ts`,
`completeAlignment.ts` et l’en-tête du TAGNT local épinglé.

**Prochaine priorité proposée : représenter une occurrence physique avec ses
identifiants alternatifs, puis évaluer séparément la relation de traduction et
le support du numéro.** La charte et le paquet de revue préparent cette étape.
Ni le score exact ni les propositions JEV ne suffisent à choisir arbitrairement
un alias ou à supprimer une annotation existante.

## Stabilité et coût

- 2 700 requêtes principales corrigées : 2 699 réponses acceptées, une réponse
  incohérente rejetée parce que le choix annoncé n’avait pas la probabilité
  maximale. Elle appartient à la calibration. Aucun appel génératif de secours.
- 100 requêtes identiques répétées : sept changements de choix ; 100 inversions
  de l’ordre des choix : sept changements aussi. L’effet d’ordre n’est pas isolé
  de la variabilité ordinaire par ces seuls comptes.
- Latence médiane principale : 312,6 ms ; quatre appels simultanés. Ce n’est pas
  une mesure isolée de performance matérielle.
- Maximum déclaré : 1 495 tokens en entrée. Aucune requête exclue pour longueur,
  aucune alerte fournisseur de troncature. Le tokenizer interne n’est pas inspecté.
- Coût déclaré par la passerelle : **0,098082 USD** pour la campagne corrigée,
  répétitions comprises ; **0,197273 USD** déclaré au total avec le premier essai.
  Quatre erreurs de délai du premier essai ne disposent pas de coût retourné :
  le total ne certifie pas leur facturation éventuelle.

L’apprentissage local corrigé représente environ 202 secondes cumulées pour
les six modèles, pendant d’autres tâches sur la machine. La reproductibilité
locale des liens est vérifiée sur les 150 répétitions ; les futurs appels JEV
ne présentent pas cette garantie. Pour une construction déterministe, conserver
les requêtes, réponses et décisions retenues comme artefacts versionnés.

## Correction préalable : les notes n’appartiennent pas au verset

L’inspection du paquet de revue a révélé un défaut de mes benchmarks précédents :
`stripTags` retire les balises `<note>`, mais conserve leur texte. Ce texte entrait
donc dans les entrées françaises de l’aligneur, les candidats et la numérotation
des mots. En Darby, Ézéchiel 10.1 contenait ainsi « surlitt. : à, dans. l’étendue »
au lieu de « sur l’étendue » dans l’entrée du benchmark.

| Corpus | Textes évalués avec notes | Versets d’apprentissage avec notes |
| ------ | ------------------------: | ---------------------------------: |
| Sg1910 |                   0 / 240 |                         0 / 14 803 |
| Darby  |                  38 / 240 |                     2 624 / 14 804 |
| DarbyR |                  55 / 240 |                     3 579 / 14 804 |

J’ai corrigé cette **projection de benchmark** : retrait des sous-arbres de
notes avant tokenisation, puis recalcul des positions attendues à partir des
balises Strong restantes. La source CSV et le parseur de publication du produit
restent inchangés. Les notes imbriquées et autofermantes sont prises en charge ;
des balises de notes déséquilibrées font échouer la préparation.

Les six modèles Eflomal ont été réentraînés sur le français corrigé ; leurs
4 320 inférences ont été recalculées. Les chapitres, les 720 inventaires source
et les neuf fichiers de séquences source/références d’apprentissage sont
identiques. Sg1910 conserve exactement ses entrées, ses balises attendues et son
résultat de génération. Les 150 paires de répétabilité locale donnent les mêmes
liens lors de leur réexécution.

Le premier arbitrage, conservé dans `strong-arbitration-benchmark/v1`, a déjà été
calculé sur le texte contenant les notes. Le présent rapport porte sur le nouveau
lot `v2-reader-text`. Les anciens rapports sont annotés avec cette limite ; leurs
chiffres ne sont pas remplacés silencieusement.

## Comparaison contrôlée

900 décisions sur 223 passages distincts, dans Sg1910, Darby et DarbyR :
450 décisions de calibration et 450 de test. Chaque édition et chaque moitié
contient 75 placements existants et 75 occurrences sans placement visible.
L’échantillon surreprésente donc volontairement les manques.

Trois requêtes sont envoyées pour chaque décision :

1. **Lexique** : candidats lexicaux disponibles et support existant.
2. **Enrichi** : même liste, augmentée par les deux représentations Eflomal.
3. **Enrichi + contexte** : mêmes choix que 2, avec jusqu’à trois occurrences
   source voisines de chaque côté, leurs gloses et leur morphologie.

Les instructions et indices lexicaux restent communs. Ni la provenance des
candidats, ni leurs scores, ni les annotations attendues ne sont montrés à JEV.
L’ordre est déterminé par une empreinte fixe ; les anciens choix gardent leur
ordre relatif quand de nouveaux choix sont ajoutés. L’ordre des occurrences
source est indiqué par leurs positions.

La sélection des cas n’utilise pas les balises attendues. Elle exclut les Strong
répétés dans la source et les appariements ambigus avec le placement initial.
Les occurrences répétées restent dans le score de reconstruction des versets.
La correction du texte modifie l’éligibilité de quelques cas : 872 des 900 cas
se retrouvent dans les deux campagnes. Les comparaisons entre variantes ci-dessous
portent bien sur les mêmes 900 cas corrigés.

La séparation par chapitre est celle du précédent Eflomal : **réutilisation
exploratoire d’un test déjà étudié**, sans prétention de nouvelle validation
aveugle. Les 100 passages de réserve restent intacts. Les seuils et règles
d’application n’ont pas été changés après les résultats du premier arbitrage.

Les décisions visibles sont simulées ensemble ; les échanges peuvent être
acceptés, les nouveaux chevauchements sont bloqués et les anciens supports sont
restaurés jusqu’à stabilisation. `NONE`, `UNSURE`, erreur du fournisseur ou score
insuffisant conservent le placement initial. Une absence de balise dans la
référence n’est pas interprétée comme preuve d’absence de traduction.

## Critères sémantiques et revue

La nouvelle [charte de revue](./strong-semantic-review-charter-2026-10-01.md)
sépare relation de traduction, groupe français acceptable et support visuel du
Strong. Le format accepte les groupes discontinus et plusieurs-à-plusieurs,
avec liens certains/possibles, absences motivées et incertitudes.

Le paquet conserve les 60 passages sélectionnés avant cet arbitrage. Neuf textes
contenant des notes ont été corrigés, avec de nouveaux indices de mots. Leurs
identités source et leurs annotations vides sont conservées. **Aucun de ces
passages n’est encore validé humainement.** Le validateur contrôle la structure,
les identifiants et les contradictions ; il ne valide pas le sens.

La version 2 du paquet explicite aussi les groupes d’identités associés à chaque
token physique : 44 de ces groupes portent plusieurs identités Strong. Cela
rend le problème des alias visible avant l’annotation, sans choisir un numéro
à la place du réviseur.

## Artefacts corrigés

- [Résultats et tous les seuils](../outputs/strong-arbitration-benchmark/v2-reader-text/report.md).
- [Mesures structurées](../outputs/strong-arbitration-benchmark/v2-reader-text/summary.json).
- [Décision de calibration figée](../outputs/strong-arbitration-benchmark/v2-reader-text/calibration-selection.json).
- [Modifications proposées à examiner](../outputs/strong-arbitration-benchmark/v2-reader-text/changes-for-audit.json).
- [Paquet sémantique sans prédictions, version 2](../outputs/strong-arbitration-benchmark/v2-reader-text/semantic-review-v2.json).
- [Contrôles de la correction du corpus](../outputs/strong-arbitration-benchmark/v2-reader-text/correction-verification.json).
- [Audit des identités Strong alternatives](../outputs/strong-arbitration-benchmark/v2-reader-text/source-alias-audit.json).

## Reproduction et limites

Le [README de la campagne](../scripts/strong-arbitration-benchmark/README.md)
décrit les commandes, empreintes, règles figées et chemins. Les sorties corrigées
sont dans `outputs/strong-arbitration-benchmark/v2-reader-text` et les modèles dans
`outputs/strong-alignment-benchmark/v2-reader-text`. Les sorties volumineuses
sont locales et ignorées par Git.

Le [modèle JEV de la passerelle](https://vercel.com/ai-gateway/models/jev) reçoit
des questions à choix ; aucun appel génératif ni repli vers un autre modèle
n’a été utilisé. Son alias ne fournit pas de version immuable. Les réponses
archivées permettent une reconstruction fixe, pas une promesse de réponses
identiques lors de futurs appels distants.

Le dictionnaire reste le même legacy strict, explicitement déclaré. Le
dictionnaire V3 par défaut n’est pas validé par cette expérience. Le transfert
depuis les témoins autorisés reste disponible au moteur initial, avec la famille
éditoriale évaluée exclue. Les sources STEP restent amalgamées. Les éditions
françaises corrélées ne forment pas des observations bibliques indépendantes.

Les 14 tests Node et les trois tests Python ajoutés passent, ainsi que le contrôle
TypeScript explicite des scripts, leur lint et le typecheck du workspace.
Les contrôles globaux historiques ne sont pas présentés comme réparés.
