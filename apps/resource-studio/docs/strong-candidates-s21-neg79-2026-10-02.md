# S21 et NEG79 : génération complète et audit — 2 octobre 2026

**Les deux candidates complètes sont générées et leurs exports sont vérifiés.**
Elles conservent le texte exact des publications canoniques locales. Les décisions
incertaines restent dans les dossiers d'auteur et n'apparaissent pas comme des
Strong établis dans l'export lecteur. La génération n'a appelé aucun modèle,
local ou distant, et aucune publication ou activation n'a été effectuée.

Ce résultat permet de travailler sur les deux corpus entiers. **Il ne certifie
pas tous les placements : la revue a encore trouvé des erreurs lexicales.**
Le livrable retenu est dans `outputs/strong-candidates-2026-10-02/refined/` ; les
répertoires parents et `final/` conservent les étapes antérieures de l'audit.

## Résultats complets

| Mesure                                              |        S21 |      NEG79 |
| --------------------------------------------------- | ---------: | ---------: |
| Livres / chapitres                                  | 66 / 1 189 | 66 / 1 189 |
| Versets du fichier natif                            |     31 168 |     31 169 |
| Unités source modélisées                            |    441 303 |    441 303 |
| Unités avec porteur visible retenu                  |    346 631 |    394 053 |
| Vides grammaticaux établis                          |      1 559 |      2 235 |
| Unités explicitement incertaines                    |     93 113 |     45 015 |
| Part incertaine des unités modélisées               |    21,10 % |    10,20 % |
| Versets sans incertitude modélisée ni alerte source |      4 019 |     13 275 |
| Versets avec une alerte source ou structurelle      |        100 |        162 |
| Lignes STEP non interprétées, conservées séparément |        350 |        350 |

Les effectifs « visibles » décrivent les décisions du moteur, pas un nombre de
placements certifiés justes. Les pourcentages excluent les 350 lignes non
interprétées : elles sont explicitement recensées, sans leur inventer une
décomposition lexicale. Les 465 518 identifiants de composantes du modèle ont
chacun un propriétaire unique ; ils ne représentent pas 465 518 mots distincts.
Les alternatives et les groupes restent regroupés en unités source.

Les deux exports JSONL font respectivement environ **18,9 Mio et 20,6 Mio**.
Le ledger SQLite, les décisions détaillées et les signaux d'audit sont également
conservés. Les fichiers lecteur sont :

- [S21](../outputs/strong-candidates-2026-10-02/refined/generated/s21/bible-s21-strong.jsonl)
- [NEG79](../outputs/strong-candidates-2026-10-02/refined/generated/neg79/bible-neg79-strong.jsonl)

## Raccordement et contrôles

La politique du [cycle précédent](./strong-concordance-reading-groups-results-2026-10-01.md)
est maintenant disponible dans `generateStrongLedger` avec
`concordanceDisplay: "expressions"`. Elle applique les lectures mineures, les
cardinaux, les limites de porteurs, la protection des expressions grammaticales,
les liens d'articles et la projection explicite visible/vide/incertain. La
convention `"heads"` reste disponible pour les contrôles CSV. Ce sont des choix
d'affichage ; aucun nouveau dictionnaire de traductions propre à S21 ou NEG79
n'a été ajouté.

Les annotations retirées de l'affichage restent dans le ledger. Les relations
complètes, les porteurs et les ancrages de vides restent distincts. Une raison
historique de recherche infructueuse est maintenant effacée du champ
« incertitude restante » lorsqu'une règle a ensuite résolu l'unité.

Le raccordement reproduit les mêmes placements, identités et états que la
politique sélectionnée sur **les sept scénarios de 172 versets** : S21/NEG79
avec puis sans la famille Segond, et LSG/Darby/DarbyR avec exclusion appropriée.
Ces chapitres ont déjà été consultés : il s'agit d'une non-régression, pas d'une
nouvelle mesure indépendante de généralisation.

Les entrées de prédiction sont des copies figées des textes sans annotations,
des six fichiers STEP et des trois témoins autorisés. Le dictionnaire neutre
contient zéro candidat. Les corrections historiques, lexiques français non
attestés et caches de modèles sont exclus. Les annotations externes ne sont lues
que par un évaluateur séparé. Les programmes prédictifs interdisent `fetch`.
Cette séparation est une restriction des entrées et des processus, pas un
bac à sable du système d'exploitation.

L'export conserve aussi les paramètres d'exclusion et de politique dans ses
empreintes. Un incident de lecture SQLite sous Node 23 a été reproduit puis
corrigé : la requête préparée doit rester utilisée après les attentes d'écriture,
sinon elle peut être finalisée pendant l'itération. Les deux lectures intégrales
et les deux exports passent désormais ce contrôle.

## Ce que le passage au corpus entier a révélé

**Numérotation NEG79.** Ses coordonnées natives diffèrent beaucoup plus du corpus
de témoins que celles de S21. Le premier détecteur proposait parfois un découpage
artificiel en fusion/séparation au milieu d'un simple décalage. L'audit par texte
complet a signalé 39 coordonnées suspectes.

La correction exige un texte normalisé unique dans un témoin autorisé, au moins
huit tokens, puis une bijection complète et monotone sur tout le groupe connecté
de versets. Aucun voisin non apparié n'est deviné et aucune référence source n'est
supprimée. La proximité de NEG79 avec LSG est utile ici ; elle ne constitue pas
une validation indépendante entre familles.

Cette règle rétablit **14 groupes, soit 42 versets**. Par exemple, Genèse
32.26–28 correspond aux coordonnées 32.27–29 du témoin : les textes complets
établissent les trois correspondances. Les 11 coordonnées encore signalées
appartiennent à huit groupes couvrant **16 versets** ; leurs porteurs sont mis
à l'écart et leurs unités restent incertaines. Une vérification complète confirme
qu'aucun de ces 16 versets n'expose de Strong lecteur.

| Décisions NEG79                    | Avant correction des correspondances |   Après |
| ---------------------------------- | -----------------------------------: | ------: |
| Visibles                           |                              393 746 | 394 053 |
| Vides établis                      |                                2 234 |   2 235 |
| Incertaines                        |                               45 323 |  45 015 |
| Versets sans incertitude ni alerte |                               13 260 |  13 275 |

Ces variations sont des états du moteur, pas 307 placements certifiés nouveaux.
Le contrôle de toutes les lignes du SQLite trouve des changements de porteurs
ou d'états dans 45 versets, tous dans les groupes concernés. S21 conserve
exactement les mêmes porteurs et états sur ses 31 168 versets. Une optimisation
du détecteur évite aussi de recopier les chemins déjà perdants ; sur toute S21,
le manifeste obtenu est identique octet pour octet au précédent.

**Inventaire STEP incomplet.** L'importeur comprend certaines références
parenthésées mais ignore des notations entre crochets ou accolades, par exemple
`Rom.16.25{14.24}` et `2Co.13.13[13.14]`. Compter uniquement les lignes importées
aurait masqué ce défaut. Les **350 lignes brutes**, réparties sur 48 formes de
référence, sont maintenant conservées avec fichier, ligne, empreinte, codes et
coordonnées possibles, sous l'état `unresolved-source-notation`.

Les 88 versets potentiellement concernés par ces coordonnées sont signalés dans
chaque édition et exclus du compte des versets entièrement comptabilisés. Ce
travail établit l'inventaire du manque ; il ne prétend pas résoudre la convention
de numérotation portée par chaque notation.

**Texte S21.** Le fichier natif contient Jérémie 23.19 dans le champ de 23.18,
avec le nombre « 19 » dans le texte, et n'a pas de champ 23.19. Cette anomalie
existe aussi dans la publication canonique locale. Elle est conservée et
documentée ; aucune correction silencieuse du texte n'a été faite. Les textes
des deux entrées correspondent exactement aux révisions locales
`s21-eef70fc9790cbbc1355d` et `neg79-b85d4965811458a60836`.

## Accord externe et revue des erreurs

L'évaluation des candidates complètes réutilise les anciens chapitres externes,
avec leurs empreintes d'origine. Elle compare seulement les séquences de tokens
identiques, à la casse et aux apostrophes typographiques près ; les différences
lexicales ou de découpage sont consignées sans déplacer arbitrairement les indices.

| Ancienne réserve, textes natifs comparables |   Versets | Précision exacte | Rappel exact | F1 exact |
| ------------------------------------------- | --------: | ---------------: | -----------: | -------: |
| S21                                         | 170 / 172 |          94,37 % |      76,63 % |  84,58 % |
| NEG79                                       | 167 / 172 |          95,10 % |      86,50 % |  90,59 % |

Ces scores mesurent l'accord éditorial sur ce sous-ensemble. **Ils ne mesurent
pas la précision de toute la Bible**, ni une amélioration comparable directement
aux scores calculés auparavant sur les 172 textes publics. Les textes natifs ont
également quatre exclusions S21 et quinze NEG79 sur l'ensemble des 631 anciens
versets de développement et réserve.

La revue assistée couvre **28 dossiers choisis par empreinte**, stratifiés par
testament, variantes mineures, nombres, répétitions et incertitudes, avec deux
versets distincts par catégorie disponible. NEG79 n'offre pas de dossiers dans
la strate de nouveaux cardinaux numériques. Dix-huit placements sont plausibles
au regard du texte et du contexte source, huit incertitudes sont conservées et
deux porteurs demandent une correction :

- S21, Deutéronome 5.19 : le Strong du vol est placé sur « commettras » seul.
  La locution « commettre un vol » demande une relation plus large ; la seule
  protection des expressions grammaticales ne résout pas ce cas lexical.
- NEG79, Jérémie 52.6 : une occurrence de « mois » porte le mot « jour ».
  La traduction réordonne la date et emploie une seule mention explicite du mois ;
  il faut traiter ensemble les occurrences sources, sans convertir le surplus
  apparent en absence automatique.

Des incertitudes telles que dire → demander, fils → père de dans une généalogie,
ou un nom composé dans une lecture alternative ne constituent pas des absences.
La revue les laisse comme telles. Ces jugements sont assistés et exposés aux
sources ; ce ne sont pas des annotations indépendantes. Ils n'ont pas été
réinjectés dans les prédictions figées.

## Validation et suite

- 79 tests ciblés réussissent.
- La suite du workspace compte 1 157 tests : 1 134 réussites, les mêmes 22 échecs
  préexistants et un test ignoré. Les noms détaillés ont été comparés aux journaux
  précédents.
- Typecheck, compilation avec le périmètre du workspace, contrôle strict des
  scripts, exécution du JavaScript émis et ESLint du périmètre réussissent.
- Le build standard garde les six erreurs TS6059 préexistantes liées aux scripts
  du lexique hors de `rootDir`. Ses diagnostics ont été comparés ; il n'est pas
  annoncé comme réussi.
- Les deux SQLite passent le contrôle d'intégrité ; les 62 337 textes natifs et
  les exports lecteur sont relus et contrôlés. Tous les identifiants source
  modélisés ont exactement un propriétaire, et tout vide affiché possède une
  justification d'absence et son ancrage distinct.

Le [mode d'emploi](../scripts/strong-candidates/README.md) décrit le rejeu.
`delivery-manifest.json`, les manifests d'entrées et de code, les correspondances,
les évaluations, la revue assistée et les journaux accompagnent les artefacts
locaux ignorés par Git. Les TSV avancés contiennent encore des propositions de
diagnostic et ne doivent pas être confondus avec les exports lecteur.

La suite utile est maintenant ciblée : interpréter les notations STEP restantes,
réparer le découpage canonique S21 identifié, puis améliorer les locutions
lexicales et la propriété des occurrences répétées. La publication nécessite une
nouvelle décision et une validation adaptée ; la présente livraison est un jeu
complet de candidates auditées, exploitable pour poursuivre ce travail.
