# Strong S21/NEG79 — alignement des expressions, 3 octobre 2026

Le nouveau moteur retrouve davantage de placements sur des chapitres indépendants,
mais **la variante ne doit pas remplacer les Bibles validées**. Le rappel progresse
et le F1 augmente ; la précision exacte baisse légèrement à cause de trois
expressions incomplètes. Le critère de promotion fixé avant le test n'est donc pas
atteint. Les sorties restent expérimentales, avec une option d'intégration explicite.

Ce résultat précise le prochain problème à résoudre : reconnaître les limites
d'une locution française, même lorsque les témoins ne balisent qu'un de ses mots.
Retrouver le bon verbe ou pronom ne suffit pas à établir toute sa relation de traduction.

## Contexte et protocole

Référence : les candidates complètes S21 et NEG79 de
`outputs/strong-predicate-review-2026-10-02/recheck`. La passe précédente de
récupération de surface, non promue, reste désactivée. Les Bibles du visualiseur
ne sont pas remplacées par cette expérience.

Les anciens 3 789 versets de développement et 302 versets déjà exposés sont réunis
en **4 091 versets de développement par édition**, dont 2 044 AT et 2 047 NT.
Les annotations cibles sont utilisées uniquement par l'évaluateur. Les occurrences
STEP, les témoins autorisés et les ressources lexicales indépendantes fournissent
les preuves de prédiction.

La nouvelle réserve contient **232 versets par édition**, 120 AT et 112 NT, dans
12 chapitres : Exode 24, Lévitique 5, Josué 20, Juges 12, Psaume 11, Ecclésiaste 1,
Osée 8, Jérémie 43, Marc 11, Luc 21, 1 Corinthiens 13 et Hébreux 7. Lévitique 5
compte ici 26 versets selon le découpage français des entrées. Les adresses sources
natives sont conservées pour comparer les témoins. Aucun chapitre vierge d'Actes
ou d'Apocalypse ne restait dans l'inventaire historique : **la nouvelle réserve
ne valide pas ces deux genres**.

Le gel `candidate-freeze.json`, à **00:41:39 UTC le 3 octobre**, précède
l'acquisition des 24 pages publiques réservées. Il fixe le code, les ressources,
les variantes et la sélection `common-heads`. Aucun ajustement du prédicteur n'a
été effectué après ce gel. Un premier rejeu de développement avait été invalidé
par la garde de dérive du harnais ; il a été intégralement refait avant le gel.

Sept scénarios sont conservés : S21 et NEG79 avec cible exclue, ces mêmes éditions
avec famille Segond exclue, puis LSG/Darby/DarbyR reconstruits sans leur propre
famille. Darby et DarbyR ne sont jamais deux votes indépendants. La proximité
éditoriale entre LSG et NEG79 explique une partie des accords du premier scénario.

## Ce qui a été implémenté

Le moteur cherche un segment de un à quatre mots à l'intérieur d'un contexte court
des témoins. Il exige des mots fixes, au moins une occurrence voisine déjà placée,
des frontières de propositions compatibles et un emplacement unique. Les témoins
sont recherchés dans le **verset source natif**, y compris lorsque le découpage
français diffère.

Une vérification lexicale distincte utilise l'identité textuelle, les flexions
françaises Kaikki, les synsets WOLF explicitement validés ou un lien entre le sens
source STEP et une définition française indépendante. Les suffixes et la casse des
identités STEP restent significatifs. Les sens des dictionnaires ne sont pas
fusionnés, les traductions WOLF automatiques ne deviennent pas des validations et
un partage de mots anglais vagues ne suffit pas. La synonymie réciproque OpenOffice
est mesurée séparément, sans fermeture transitive ni synonymes écrits pour un verset.

La sélection exige l'accord de **deux familles** et refuse tout nouveau partage
d'un mot. Une variante plus large autorise le partage uniquement lorsque les mêmes
occurrences partagent explicitement leur porteur dans les témoins ; elle n'est pas
retenue. Les concurrents faibles restent des concurrents, les répétitions ambiguës
ne sont pas fusionnées et une lecture source incertaine bloque le placement.

Les placements, relations, vides et ancrages antérieurs sont préservés. La passe ne
crée aucun vide : une recherche infructueuse laisse l'occurrence non résolue.
Le segment de traduction et le porteur affiché sont enregistrés séparément. Cette
distinction est nécessaire mais **le segment trouvé peut encore être incomplet**.
Il s'agit d'un alignement local d'expressions, pas d'une analyse syntaxique complète.

Le canari connu **1 Jean 1.8** retrouve maintenant « trompons » : les témoins portent
« séduisons » dans le même contexte, et le sens source _deceive_ correspond à une
définition indépendante de _tromper_. Ce passage est hors des 4 091 versets mesurés
et ne compte pas comme validation indépendante. Dans 1 Rois 8.21, « ancêtres » est
retrouvé ; « conclue » reste non résolu. Nombres 16.35 ne provoque aucun transfert
de « jaillit » vers « venu ». Aucune exception propre à ces références n'a été ajoutée.

## Résultats avant/après

Un accord exact exige le même Strong, la même visibilité et les mêmes limites de
porteur — ou le même ancrage pour un vide. Les scores mesurent l'accord avec
Concordance.bible, **pas un pourcentage certifié de vérité linguistique**.

| Corpus                       | Édition | Accords exacts ajoutés | Désaccords exacts ajoutés | Précision avant → après | Rappel avant → après |    F1 avant → après |
| ---------------------------- | ------- | ---------------------: | ------------------------: | ----------------------: | -------------------: | ------------------: |
| Développement, 4 091 versets | S21     |                    255 |                         3 |     92,507 % → 92,540 % |  75,799 % → 76,217 % | 83,324 % → 83,589 % |
| Développement, 4 091 versets | NEG79   |                    137 |                         3 |     94,588 % → 94,597 % |  87,055 % → 87,281 % | 90,666 % → 90,792 % |
| Réserve, 232 versets         | S21     |                     14 |                         2 |     92,060 % → 92,035 % |  76,869 % → 77,278 % | 83,782 % → 84,013 % |
| Réserve, 232 versets         | NEG79   |                      4 |                         1 |     94,265 % → 94,242 % |  87,116 % → 87,233 % | 90,549 % → 90,602 % |

Sur la réserve S21, 2 632 accords / 227 désaccords deviennent 2 646 / 229, pour
3 424 porteurs de référence. NEG79 passe de 2 975 / 181 à 2 979 / 182, pour
3 415 porteurs de référence. Aucun accord antérieur n'est retiré. L'accord des
**seuls nouveaux placements** est de 14/16 et 4/5 ; les petits effectifs interdisent
de présenter ces proportions comme une précision générale du moteur.

En AT, la réserve apporte +4 accords S21 et +1 NEG79 sans désaccord nouveau.
En NT, elle apporte +10/+2 pour S21 et +3/+1 pour NEG79. Il ne serait pas valide
de sélectionner maintenant une politique « AT seulement » sur ce résultat.

Les 21 nouveaux placements chevauchent tous leur porteur de référence. Le F1
chevauchant passe de 85,628 % à 85,918 % pour S21, de 92,497 % à 92,579 % pour
NEG79. **Ce score masque précisément le défaut de limites découvert ici** ; il ne
remplace pas le critère exact choisi avant le test.

Sur 3 589 unités sources par édition, les non-résolues passent de 730 à 714 pour
S21 et de 434 à 429 pour NEG79. Le taux d'incertitude passe donc de 20,340 % à
19,894 %, et de 12,093 % à 11,953 %. Les versets entièrement comptabilisés passent
de 32 à 33 pour S21 et restent à 69 pour NEG79. Cela ne signifie pas qu'ils sont
entièrement exacts.

L'identité est comparable sur 106 versets S21 et 107 NEG79 seulement ; elle ne l'est
pas pour les trois contrôles sans identifiants éditoriaux compatibles. Le F1
d'identité passe de 84,073 % à 84,214 % en S21, de 90,987 % à 91,025 % en NEG79.
La précision d'identité S21 baisse également légèrement. Les inventaires sources
et les identités répétées sont conservés ; les répétitions ambiguës ne sont pas
améliorées par cette passe.

Les neuf vides S21 et douze NEG79 hérités restent identiques. Sur cette réserve,
le score d'accord des vides est nul face aux 188/154 vides de la référence. La
nouvelle passe n'améliore donc ni leur classification ni leur ancrage ; l'inventaire
et le rappel global ne doivent pas faire oublier ce chantier séparé.

## Comparaison des variantes

Chaque cellule indique **accords exacts / désaccords supplémentaires**.

| Variante                                      |    Dev. S21 |  Dev. NEG79 | Réserve S21 | Réserve NEG79 |
| --------------------------------------------- | ----------: | ----------: | ----------: | ------------: |
| Identité textuelle, deux familles             |      94 / 0 |     134 / 3 |       4 / 1 |         3 / 1 |
| + Flexions                                    |     109 / 2 |     134 / 3 |       4 / 2 |         3 / 1 |
| + WOLF validé                                 |     161 / 2 |     135 / 3 |       6 / 2 |         3 / 1 |
| + OpenOffice réciproque                       |    320 / 10 |     139 / 3 |      15 / 2 |         3 / 1 |
| Sens STEP/Kaikki, expressions                 |     254 / 4 |     137 / 3 |      14 / 2 |         4 / 1 |
| **Sens STEP/Kaikki, porteur commun retenu**   | **255 / 3** | **137 / 3** |  **14 / 2** |     **4 / 1** |
| Sens, une famille                             |    530 / 20 |    299 / 15 |      34 / 4 |        16 / 2 |
| Sens + partage, deux familles, expressions    |     267 / 5 |     160 / 4 |      16 / 2 |         6 / 1 |
| Sens + partage, deux familles, porteur commun |     268 / 4 |     160 / 4 |      16 / 2 |         6 / 1 |
| Sens + partage, une famille                   |    573 / 27 |    391 / 24 |      38 / 5 |        22 / 3 |

OpenOffice n'est pas inclus dans la variante STEP/Kaikki. Les lignes ne constituent
donc pas toutes une chaîne cumulative. Une preuve WOLF peut aussi corroborer une
flexion d'un verbe générique ; tous ses gains ne sont pas des synonymes nouveaux.

Le porteur commun améliore un cas de développement S21 (« y eut » → « eut »,
relation entière conservée) par rapport à l'affichage de l'expression. Cette
différence disparaît dans la réserve. Aucune adaptation nouvelle propre à une
édition n'est justifiée. Choisir une autre variante après lecture de la réserve
ne serait pas une validation indépendante ; de toute façon, aucune variante
testée ne maintient la précision exacte des deux cibles sur cette réserve.

Les cinq scénarios famille exclue/contrôle restent inchangés avec la politique
retenue, car une seule famille de témoins y est disponible. C'est une garantie de
non-régression par abstention, **pas une démonstration que la nouvelle règle réussit
sur LSG/Darby/DarbyR**. Les variantes à une famille agissent dans ces scénarios et
produisent davantage de gains, mais aussi des désaccords supplémentaires ; leurs
résultats complets sont conservés.

## Analyse des désaccords

Les six désaccords supplémentaires du développement ont été examinés localement :

- S21, Proverbes 8.36 : « détestent » contre « me » dans la référence pour H8130.
  Le verbe hébreu et son suffixe réalisent « me détestent » ; le HTML confirme le
  porteur éditorial sur « me ». Le choix lexical du moteur est plausible, mais la
  relation grammaticale entière n'est pas démontrée par son seul porteur.
- S21, Proverbes 9.5 : « manger » contre « de » pour H3898. La flexion
  mangez/manger est attestée ; le HTML confirme le tag de Concordance sur « de ».
- S21, Jean 16.2 : G4160 sur « exclura », comme les témoins sur « excluront » ;
  Concordance porte G0656 sur « exclura des synagogues » et omet G4160. La
  construction source et sa réalisation commune restent à distinguer de cette
  convention éditoriale.
- NEG79, Actes 23.12 et 23.21 : « qu'ils » contre « ce qu'ils ».
- NEG79, Actes 27.12 : G1519 sur « d'y » dans une construction de but ; ce code
  est omis par Concordance. L'omission ne prouve pas une absence de traduction.

Les trois désaccords indépendants sont plus décisifs pour la suite :

1. **Luc 21.4, S21 et NEG79** : G3739 est placé sur « qu'elle » ; Concordance
   inclut « ce qu'elle ». Les deux familles de témoins balisent le même pronom
   court. Leur accord ne fournit donc pas à lui seul les limites de la locution.
2. **Luc 21.26, S21** : G0674 est placé sur « rendront » ; Concordance porte
   « rendront l'âme ». Le sens source est celui de défaillir. La flexion
   rendant/rendront et le contexte sont corrects, mais _rendre_ isolé n'établit pas
   cette traduction : **la relation enregistrée est trop courte**, pas seulement
   son affichage. Les témoins héritent eux aussi d'un balisage partiel.

Ces cas ne sont pas retirés des scores. Le jugement est celui d'une analyse assistée
locale, sans revue humaine indépendante. Douze ajouts de développement ont aussi
été inspectés selon un échantillonnage déterministe par type de preuve. Le rapport
ne prétend pas démontrer que le moteur est « meilleur que Concordance ».

## Rejeu, validation et livrables

Le [mode d'emploi](../scripts/strong-clause-expressions/README.md) décrit les scripts,
ressources et options. Le dossier complet est
`outputs/strong-clause-expressions-2026-10-03` ; les textes et données volumineuses
restent ignorés par Git. Les nouvelles prédictions contiennent uniquement les
versets modifiés, liés par empreinte à leur baseline compressée.

Le moteur est dans `strongClauseAlignment.ts` et `strongClauseLexicon.ts`, avec une
intégration explicite `concordanceClauses` au générateur réel. Les ressources et
le code entrent dans l'empreinte ; les preuves et ambiguïtés sont enregistrées dans
`resolution.concordance.clauses`. La combinaison avec l'ancienne récupération de
surface expérimentale est refusée car elle n'a pas été évaluée.

Les 19 tests ciblés passent. La suite complète compte **1 223 tests : 1 200 réussis,
22 échecs préexistants inchangés, un ignoré**. Les noms des échecs correspondent à
la référence, tous dans le lexique V3 hors de cette passe. Typecheck, ESLint ciblé,
vérification stricte des scripts et compilation TypeScript avec `--rootDir .`
réussissent ; cela ne prétend pas réparer le build standard historique.

Les contrôles positifs natifs portent sur cinq versets connus par édition et
reproduisent exactement six ajouts S21 et cinq NEG79. **Les sept scénarios réservés
passent la vérification native et le rejeu masqué**, sur 232 versets chacun : mêmes
textes, inventaires d'occurrences, porteurs, états et relations que le prototype ;
prédictions pures identiques après rejeu. Les dossiers des pages, annotations et
scores sont retirés de leur emplacement attendu pendant ce contrôle. C'est une
vérification d'absence de dépendance à ces entrées, pas un bac à sable hostile.
Les reçus `integration-verification.json`, `blind-replay-verification.json` et
`positive-integration-verification.json` conservent ces résultats.

Les métriques complètes, ventilées par édition, scénario, testament et difficulté,
sont dans `evaluator-only/comparison-strata.json` ; les ablations, les résultats par
livre et les revues de désaccords sont dans le même dossier évaluateur. Les classes
de difficulté se recouvrent et ne doivent pas être additionnées. Les empreintes du
runtime Node et du lemmatiseur local sont conservées dans `runtime-receipt.json`.
Les environnements temporaires ont été supprimés après vérification de leurs
entrées contre les originaux ; les ressources de rejeu et sorties restent conservées.

Les empreintes des deux Bibles complètes, de leurs ledgers et des JSONL du visualiseur
sont identiques à la livraison précédente. Aucun modèle distant ou local n'a été
appelé, aucune ressource publiée, aucun lot de neuf Bibles généré.

## Décision et suite recommandée

**Conserver ce prototype désactivé pour la livraison.** Il démontre une récupération
réelle sur réserve, mais pas une amélioration sans compromis de précision. Ne pas
masquer ce résultat par le F1, le score chevauchant ou une correction manuelle des
trois exemples.

Le prochain cycle doit fournir une preuve indépendante des **limites des locutions
grammaticales et figées**, avant d'autoriser un porteur : séparer le mot balisé dans
le témoin de l'expression traduisant réellement l'occurrence, puis vérifier aussi
les mots fixes qui appartiennent à cette expression. Il faudra comparer expansion
et abstention, conserver les identités sources et tester sur de nouveaux chapitres.
Cette réserve devient du développement si elle sert à cette correction. Ajouter
encore des synonymes ou abaisser le nombre de familles ne résout pas ce problème.
