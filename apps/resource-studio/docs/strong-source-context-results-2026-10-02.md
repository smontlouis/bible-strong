# S21 et NEG79 : sources complètes, texte réparé et contrôle du contexte

Les deux candidates ont été régénérées et vérifiées. **Jérémie 23.19 est séparé
de 23.18 dans une nouvelle révision canonique S21 ; les 350 lignes STEP auparavant
ignorées sont importées avec leurs conventions de numérotation.** Les contrôles
de contexte corrigent certains porteurs et retirent des affectations douteuses.
Ils ne certifient pas tous les mots et ne transforment jamais un échec en absence.

La livraison retenue est dans
`outputs/strong-source-context-2026-10-02/recheck/`. Le dossier parent conserve
les premiers essais, dont une version rejetée après audit intégral. Aucun modèle
local ou distant n'a été appelé. Aucune ressource n'a été publiée ou activée.

## Les changements

### Import STEP

Le parseur commun conserve les trois notations de coordonnées. La légende TAGNT
décrit la référence principale comme NRSV, les parenthèses comme une variante NA,
les crochets comme une variante KJV et les accolades comme d'autres éditions.
Les coordonnées entre crochets ou accolades sont conservées sans devenir
automatiquement des occurrences supplémentaires dans la projection française.
Le traitement antérieur des coordonnées parenthésées est préservé.

L'audit des fichiers complets passe de **441 303 à 441 653 unités physiques**.
Les 350 lignes ajoutées couvrent 48 formes de référence. Aucune identité
préexistante, surface ou identité lexicale primaire n'est perdue ou modifiée.
Il reste zéro ligne Strong non analysée par l'importeur sur ces fichiers.

Cela résout le défaut de lecture du format, **pas toute ambiguïté de projection
entre éditions**. Actes 24.18–19 et Romains 7.9–10 montrent encore que les
frontières effectives des textes français et les conventions d'annotation
doivent être examinées séparément. Les variantes demeurent dans les dossiers.

### Réparation textuelle S21

La réparation exige l'empreinte exacte du texte antérieur de Jérémie 23.18,
l'absence d'un champ 23.19 et l'absence de présentation à déplacer. Elle retire
uniquement le séparateur `\n 19 `, le remplace par une frontière de verset et
prouve que sa réinsertion reconstitue l'ancien texte octet pour octet.

Les **31 167 autres entrées canoniques**, avec leurs notes, titres et événements
de présentation, sont identiques. Le fichier d'origine et la publication
existante restent intacts. La nouvelle candidate possède 31 169 versets et la
révision `s21-06944faa56ea3fc5155c`, contre `s21-eef70fc9790cbbc1355d` auparavant.
La vérification du contrat canonique V4 passe. Cette nouvelle révision n'est pas
automatiquement compatible avec un ancien sidecar Strong.

### Relations et porteurs

La couche commune utilise uniquement les témoins autorisés, les informations
source et le texte à annoter. Elle traite cinq situations :

- Un verbe support peut partager sa relation avec un mot lexical attesté dans
  plusieurs passages et deux familles. Dans « commettre un vol », le lecteur
  peut porter le Strong sur « vol » et conserver la relation avec le verbe.
- Un contexte local exact, appuyé par deux familles et un repère nominal unique,
  peut départager deux positions. Les accents restent significatifs : « là » ne
  devient pas « la » pour fabriquer un accord.
- Une forme impérative française unique, attestée et compatible avec le mode
  source, peut être distinguée d'un verbe narratif ultérieur. Un complément
  adjacent, comme « debout », reste dans la relation de traduction.
- Un verbe dont l'environnement de prédicats et de nom contredit les témoins
  peut devenir incertain, sans être déclaré absent.
- Deux noms source entourés de nombres peuvent former un groupe non résolu
  lorsque la traduction compresse la mesure et que les familles divergent.
  Le « mois » répété ne devient pas automatiquement un Strong sur « jour ».

L'affichage traditionnel des contrôles CSV reste distinct de la relation complète.
La variante commune de la nouvelle couche n'apporte ici aucun avantage mesuré
sur cette adaptation. Aucune règle de traduction propre à S21 ou NEG79, ni
exception de placement indexée par verset ou numéro Strong, n'a été ajoutée.

## Protocole et résultats réservés

Le point de comparaison est `34e3949ec`. Les scénarios séparent la cible exclue
avec LSG disponible, puis la famille Segond entièrement exclue. Darby et DarbyR
ne constituent jamais deux familles. Les contrôles LSG, Darby et DarbyR excluent
leur propre famille.

Une première réserve comportait 337 versets dans douze chapitres. L'audit des
générations entières a ensuite trouvé un défaut : une préposition telle que
« en » pouvait être choisie comme contenu lexical d'une expression. **Ces
sorties ont été écartées et cette réserve a été retirée.** Un filtre de mots
grammaticaux, la conservation des compléments et leurs tests de régression ont
été ajoutés. La recherche des attestations a également été mémorisée pendant
chaque verset pour éviter de relire inutilement le corpus.

Le développement final réunit les **968 versets déjà consultés**. Les règles ont
été figées avant d'évaluer une seconde réserve de **201 versets** : Genèse 39,
1 Samuel 15, Psaume 3, Proverbes 20, Ésaïe 7, Matthieu 17, Actes 24 et Romains 7.
Les chapitres NT ont été choisis parmi ceux contenant des notations nouvellement
importées, à partir de la source seule. La sélection par empreinte exclut tous
les chapitres consultés. Ce test ciblé n'est pas un échantillon aléatoire de la
qualité de la Bible entière.

| Scénario, 201 versets  | F1 exact initial | F1 exact final | Variation des porteurs exacts | Variation des désaccords |
| ---------------------- | ---------------: | -------------: | ----------------------------: | -----------------------: |
| S21 · cible exclue     |         81,109 % |       81,187 % |                            +2 |                       −2 |
| NEG79 · cible exclue   |         90,247 % |       90,288 % |                            +2 |                        0 |
| S21 · famille exclue   |         75,757 % |       75,783 % |                            +1 |                        0 |
| NEG79 · famille exclue |         81,262 % |       81,317 % |                            +3 |                       +1 |
| LSG · contrôle         |         82,822 % |       82,875 % |                            +3 |                       +1 |
| Darby · contrôle       |         83,437 % |       83,433 % |                            +2 |                       +3 |
| DarbyR · contrôle      |         82,826 % |       82,807 % |                            +2 |                       +4 |

**Aucun porteur auparavant exact n'est perdu dans ces sept scénarios**, mais de
nouvelles propositions peuvent rester en désaccord. Le F1 baisse légèrement pour
Darby et DarbyR : les ajouts dépassent les nouveaux accords exacts. Le gain est
modeste et ne doit pas être présenté comme une augmentation générale de précision.

Les ablations distinguent l'import seul, les expressions, les contextes et les
groupes de mesures. Sur la seconde réserve, le contexte ajoute un placement exact
S21 dans Actes 24.15 et retire un porteur non exact dans 1 Samuel 15.12. Il ne
modifie pas les six autres scénarios. L'essentiel des autres variations vient
des nouvelles unités importées.

Les annotations cibles restent côté évaluateur. Les dictionnaires historiques,
corrections cibles et caches de modèles sont exclus ; le dictionnaire neutre
contient zéro candidat. L'éligibilité des scores d'identité est fixée sur le
modèle initial, avec conservation des identités physiques par fichier et ligne.
La génération intégrée reproduit les placements et états du moteur pur sur les
sept scénarios. Un rejeu avec les pages, labels et évaluations masqués produit
les mêmes prédictions. Il s'agit d'une séparation contrôlée des entrées, pas
d'un bac à sable du système d'exploitation.

## Désaccords pris en charge

Tous les nouveaux désaccords de la seconde réserve sont consignés et examinés.
À Actes 24.19, les textes Darby contiennent « Juifs d'Asie » et « certains/Or »
sans annotations correspondantes dans les CSV. Les ajouts de codes pour ces mots
sont plausibles, mais restent pénalisés par l'accord exact. À l'inverse, le
nouvel article sur « ta » dans « ta présence », avec la famille Segond exclue,
n'établit pas le lien avec le groupe source des Juifs d'Asie : c'est une limite
réelle de projection à une frontière de versets. Le connecteur ajouté à Romains
7.10 dans le contrôle DarbyR garde également une ambiguïté de frontière.

La première réserve avait montré une autre limite de la mesure : dans
Apocalypse 7.13, déplacer la copule vers « qui sont-ils » est cohérent avec le
contexte grec, mais ne change pas le score parce que la référence n'annote pas
cette copule. Dans Romains 1.10, « mes prières » est reformulé par S21 en « je lui
demande » ; ni un code posé sur un seul pronom, ni le choix de la référence sur
« le/cadre », ne suffit à adjuger la relation de groupe.

Ces examens sont des jugements assistés, pas une vérité indépendante. Aucun
verdict tiré de la réserve n'a été réinjecté dans les règles finales.

## Candidates entières

| Mesure                                      |     S21 |   NEG79 |
| ------------------------------------------- | ------: | ------: |
| Versets                                     |  31 169 |  31 169 |
| Unités source modélisées                    | 441 653 | 441 653 |
| Unités avec porteur visible retenu          | 346 634 | 394 164 |
| Vides grammaticaux établis                  |   1 559 |   2 235 |
| Unités incertaines                          |  93 460 |  45 254 |
| Lignes Strong non analysées par l'importeur |       0 |       0 |

Le nombre d'incertitudes augmente par rapport aux candidats précédents : les
350 unités autrefois ignorées entrent désormais dans le bilan, et des porteurs
douteux sont retirés. Ce n'est pas une recherche d'absence ni une augmentation
artificielle de densité. Les nombres « visibles » restent des décisions du moteur,
pas des placements tous certifiés. Les 465 909 identifiants de composantes ont
chacun un propriétaire unique ; ils ne sont pas autant de mots distincts.

L'audit intégral ne retrouve aucun des porteurs grammaticaux interdits produits
par la règle d'expression dans l'essai écarté. Les dossiers gardent les propositions
antérieures, les relations, les raisons d'incertitude et les ancrages séparés.

## Validation et livraison

- 1 171 tests : 1 148 réussites, les mêmes 22 échecs préexistants, un ignoré.
- Les tests de format STEP, de réparation, de contexte et de non-régression du
  garde-fou passent. Typecheck, compilation avec le périmètre du workspace,
  contrôle strict des scripts et ESLint du périmètre passent.
- Les deux SQLite et les exports JSONL sont relus : texte exact, inventaires,
  unicité des composantes, états et ancrages sont contrôlés. Le canonique S21
  réparé passe séparément sa validation V4.
- Les six erreurs TS6059 du build standard déjà documentées ne sont pas réparées
  par ce travail ; la compilation utilisée ici conserve le périmètre du workspace.

Le [mode d'emploi](../scripts/strong-source-context/README.md) décrit le rejeu.
Le manifeste de livraison, les snapshots, les deux réserves, les ablations,
les audits et les preuves de réparation restent dans les sorties locales ignorées
par Git. Les fichiers retenus sont les JSONL et SQLite sous `recheck/full/`, ainsi
que le nouveau canonique S21 sous `recheck/text-repair/`.

La suite à privilégier concerne les fragments qui changent de verset entre
conventions et les reformulations de plusieurs mots. Les candidats sont utiles
pour poursuivre cette validation ; la présente expérience ne les rend pas prêts
à une publication générale.
