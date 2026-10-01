# Premier traitement automatique des vides grammaticaux

Stéphane ne souhaite pas intervenir dans la revue ni dans les conventions
éditoriales. L’agent prend en charge ces décisions, les expériences et les
vérifications. Le dossier interactif reste facultatif ; aucune file de validation
humaine n’est nécessaire pour continuer. Une incertitude persistante est un
résultat documenté, pas une demande de travail adressée à Stéphane.

## Décision linguistique et éditoriale

La règle `fr-bare-object-marker-v1` traite une catégorie précise : **H0853 avec
la morphologie HTo**, sans préfixe de conjonction ni suffixe pronominal.
Les [codes OSHB](https://hb.openscriptures.org/parsing/HebrewMorphologyCodes.html)
identifient `To` comme marqueur de complément d’objet. La
[grammaire unfoldingWord](https://uhg.readthedocs.io/en/latest/particle_direct_object_marker.html)
décrit sa position devant le complément, ses formes avec suffixe et sa différence
avec la préposition homographe signifiant « avec ». Ces documents établissent la
catégorie source ; ils ne valident pas chacun de nos placements français.

La convention retenue est la suivante : lorsque cette particule nue se trouve
entre un verbe et un nom source identifiables, et que leurs porteurs français
forment une construction locale verbe–complément, elle reçoit un **porteur lexical
vide**. Son rôle de complément d’objet est conservé dans une relation grammaticale
distincte. Le point d’affichage est immédiatement avant le groupe objet français,
y compris son déterminant non attribué lorsqu’il existe.

Par exemple, dans « lève ta verge » (LSG, Exode 14.16), le verbe et le nom ont
leurs porteurs. Le marqueur source n’est pas artificiellement attaché à « ta » :
il reçoit un vide avant « ta verge », relié à cette construction.

Ce choix est une **règle linguistique explicite**, pas une validation humaine ni
une probabilité de justesse. L’ancrage reste conditionné par les porteurs existants.
L’absence d’un mot distinct ne signifie pas que la fonction grammaticale disparaît.

## Limites exécutables

La règle exige une cible explicitement française et une identité source unique.
Elle exclut les suffixes pronominaux, les conjonctions, les variantes de lecture,
les porteurs concurrents, les inversions, les prépositions et les frontières de
ponctuation. Elle ne remplace aucun porteur ou ancrage H0853 déjà présent, et ne
devine pas l’identité des annotations sans propriétaire source. Une revue explicite
reste prioritaire. Les occurrences répétées sont traitées par identité source,
jamais par simple numéro Strong.

Code : [règle](../src/strongGrammaticalEmpty.ts),
[intégration au résolveur](../src/strongResolutionWorkflow.ts).
Le flux local l’active avec `apply --grammar-fr`, sans revue manuelle ni modèle
distant. Les règles de publication de production restent hors de ce changement.

## Résultats

| Corpus                                         | Textes d’édition | Nouveaux vides étayés par la règle | Textes entièrement couverts avant → après |
| ---------------------------------------------- | ---------------: | ---------------------------------: | ----------------------------------------: |
| Développement existant                         |              720 |                                 50 |                                  99 → 110 |
| 200 nouvelles références de l’Ancien Testament |              600 |                                 66 |                                   81 → 88 |

Sur les nouveaux passages, les **7 746 unités** se répartissent en 6 237 porteurs
visibles existants, 66 vides issus de la règle et 1 443 cas non résolus. Les porteurs
visibles sont strictement inchangés ; le texte canonique est conservé. Au total,
**116 occurrences** reçoivent une décision automatique de vide lexical avec son
ancrage et sa relation grammaticale, sans nouvelle décision de revue assistée.

La couverture complète est une mesure structurelle. Elle ne certifie pas tous les
porteurs des versets concernés. Les nouveaux exemples ont aussi été inspectés par
l’assistant après calcul : les constructions observées incluent notamment « prit
Zilpa », « étends ta main », « envoyé Moïse », « abandonné l’Éternel » et « vois
notre opprobre ». Cette inspection n’est pas un second avis indépendant.

## Validation prospective et limite de la référence

Les 200 références nouvelles ont été sélectionnées sans regarder leurs tags cible,
dans des chapitres exclus des 340 références précédemment évaluées et du pilote
initial. Le code et les données ont été gelés avant la génération. Chaque famille
cible a été exclue des témoins du générateur. Les prédictions ont été scellées
avant les diagnostics éditoriaux, puis rejouées à l’identique.

**Aucune des 66 insertions ne trouve de balise vide H0853 correspondante dans la
zone locale des CSV cible.** Ce résultat est consigné : les CSV ne fournissent
pas ici une référence d’ancrage utilisable. On ne peut donc pas annoncer « 66/66
corrects », ni une précision sémantique indépendante. La justification vient de
la catégorie grammaticale et des conditions explicites de la règle, avec les
limites de cette convention. Les tags manquants ne servent jamais de preuve d’absence.

Les décisions sémantiques et les seuils n’ont pas été modifiés après ce résultat.
Une correction ultérieure de libellé dans le viewer distingue « règle linguistique »
et « revue » ; le rejeu conserve exactement les mêmes décisions. Le code original
du gel est conservé dans le dossier de validation. Le précédent cycle est également
préservé dans `outputs/strong-grammar-empty/before-v1` avant cette extension.

## Artefacts et contrôles

- [Gel et sélection](../outputs/strong-grammar-empty/validation-v1/freeze.json)
- [Résultats des 600 textes](../outputs/strong-grammar-empty/validation-v1/summary.json)
- [Chaque décision et ses preuves](../outputs/strong-grammar-empty/validation-v1/audit.json)
- [Prévisualisation générée automatiquement](../outputs/strong-grammar-empty/automatic-preview-v2/generated-preview.json)
- [Commandes reproductibles](../scripts/strong-resolution-workflow/README.md)

**95 tests ciblés réussis**, typecheck du workspace, TypeScript strict des scripts,
lint et formatage. Les tests incluent les pronoms, les prépositions, l’homographe
H0854, les répétitions, les conflits, la langue cible et la conservation des
placements. Les empreintes, le rejeu et l’égalité du texte rendu sont vérifiés.

Il s’agit d’une première règle automatique utilisable sur une catégorie bornée.
Les autres catégories restent explicitement incertaines ; elles ne sont ni
forcées dans cette règle, ni renvoyées à l’utilisateur pour validation.
