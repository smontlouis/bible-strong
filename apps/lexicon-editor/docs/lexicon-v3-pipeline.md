# Pipeline opérationnelle Lexicon V3

Date de référence : 2026-07-13

> **Mise à jour de release :** la baseline EN-only intermédiaire décrite plus
> bas a depuis été entièrement arbitrée et publiée sous le profil séparé
> `core-en`. Les chiffres et décisions finaux font foi dans
> [la fiche de release anglaise](./lexicon-v3-core-en-release.md).
>
> La chaîne française sans CEL ni AI Gateway, ses rôles indépendants, sa porte
> pilote et son protocole de publication sont décrits dans
> [le contrat de pipeline française interne](./lexicon-v3-french-internal-pipeline.md).

## Objectif et contrat de publication

Le pipeline Lexicon V3 doit produire, pour chaque entrée STEP :

- un glossaire et une notice anglaise (`en:gloss`, `en:meaning`) rattachés à
  la bonne entrée, avec provenance et droits vérifiables ;
- un glossaire et une notice française (`fr:gloss`, `fr:meaning`) dérivés de la
  version anglaise exacte, dans un français clair et fidèle ;
- seulement les termes d'alignement français dont la preuve est suffisante ;
- deux bases SQLite projetées à partir d'une release immuable : un profil
  `core` garanti V3 et un profil `full` qui conserve aussi des ressources
  historiques explicitement hors garantie V3.

Le chemin canonique est :

```text
sources STEP + base full
  -> audit anglais (Meaning TBESH brut conservé)
  -> corroboration hébraïque indépendante épinglée et vérifiée
  -> gate hébreu (TIPNR + AugIndex + LexicalIndex + Strong/BDB)
  -> authoring anglais canonique (StepEntries.meaning + attestations)
  -> décisions humaines EN rejouables
  -> snapshot anglais revu et attesté
  -> packets français dérivés de ce snapshot exact
  -> double proposition + arbitrage français
  -> authoring final (décisions EN, puis FR re-parenté, puis décisions FR)
  -> candidate de release
  -> vérification courante
  -> promotion
  -> projection atomique core + full
```

Une traduction n'est jamais déclarée correcte parce qu'un modèle l'a produite
ou parce qu'elle existait déjà dans `strong.legacy.sqlite`. Les artefacts
intermédiaires restent des candidats jusqu'aux portes de validation et de
release.

## Baseline réelle du 2026-07-13

Ces chiffres décrivent le rebuild de référence. Ils sont utiles pour détecter
une dérive, mais ne sont pas des constantes du logiciel : le résumé de chaque
nouveau run fait autorité.

| Mesure                                         | Valeur observée |
| ---------------------------------------------- | --------------: |
| Entrées source                                 |          22 717 |
| Audit EN `accepted`                            |          22 684 |
| Audit EN `repaired`                            |              15 |
| Audit EN `source-conflict`                     |               6 |
| Audit EN `quarantined`                         |              12 |
| Corroborations hébraïques `validated`          |          10 332 |
| Corroborations hébraïques `review_needed`      |           1 251 |
| Corroborations hébraïques `source_issue`       |              99 |
| Meanings hébreux EN `auto_validated`           |           8 580 |
| Meanings hébreux EN `candidate`                |           3 000 |
| Meanings hébreux EN `blocked_source_issue`     |             102 |
| Glosses hébreux ouverts `validated`            |           8 896 |
| Glosses hébreux ouverts `review_needed`        |           2 713 |
| Glosses hébreux ouverts `source_issue`         |              73 |
| Champs EN dans l'authoring                     |          45 433 |
| Champs FR dans l'authoring                     |               0 |
| Blockers ouverts dans l'authoring EN-only      |             202 |
| Warnings ouverts dans l'authoring EN-only      |           5 715 |
| Informations ouvertes dans l'authoring EN-only |           5 170 |
| Champs actionnables dans la file de revue      |           5 912 |
| Entrées distinctes dans la file de revue       |           3 910 |
| Appels modèle exécutés                         |               0 |

Ces trois comptes qualifient l'artefact OpenScriptures/TIPNR indépendant. Le
champ sélectionné reste le Meaning TBESH attesté quand il franchit ses gates ;
une notice exacte indépendante peut désormais le remplacer lorsque le tail
TBESH ne décrit pas l'identité STEP exacte. Le raw TBESH n'est jamais supprimé :
il reste une assertion de provenance.
Le rebuild EN-only ne peut pas devenir une release : il manque les deux champs
français par entrée et la résolution explicite des revues et problèmes de
source restants. Les chiffres ci-dessus viennent des résumés générés ; ils
doivent être recalculés après toute modification des sources ou du code.

La règle stricte de relation suffixée a trouvé 62 relations auparavant non
vérifiées qui sont structurellement prouvées. Le garde-fou de gloss n'en rend
cependant que 27 directement validables ; 35 restent `review_needed` avec
`step-gloss-open-source-mismatch`. Ces comptes sont intégrés au rebuild
canonique ci-dessus.

La génération française, la construction des packets FR et même le dry-run ont
été explicitement exclus de ce rebuild : aucun champ FR n'a été généré et aucun
modèle n'a été appelé. La présence du Meaning TBESH brut dans l'audit ne rend pas
un packet traduisible : seul un authoring attestant les droits et les gates de
contenu peut le faire.

Le séparateur `§` apparaît dans 4 094 Meanings TBESH : 2 360 entrées suffixées
et 1 734 non suffixées. Il est désormais traité comme une frontière de
provenance, pas comme une erreur. Le contenu avant `§` est la section STEP
spécifique ; le contenu après `§` est du contexte legacy/général dont la portée
est évaluée séparément. Le brut reste inchangé dans 4 094 assertions ; le
builder dérive 3 332 assertions STEP spécifiques et 4 093 assertions de contexte
legacy. Le corpus contient 3 331 notices avec les deux sections, 762
`legacy_only`, une `specific_only`, aucune vide et aucun séparateur multiple.

Après segmentation, corroboration et sélection de publication, 4 029 de ces
4 094 notices sont `auto_validated`, 62 restent `candidate` avec un motif ciblé
et trois conflits confirmés sont bloqués. Les 4 094 sources brutes restent
conservées. La sélection active se répartit en 3 312 meanings TBESH complets,
750 notices exactes TIPNR/OpenScriptures, 15 sections STEP seules et 17 cas sans
contenu de remplacement prouvé. L'audit exhaustif des 65 cas non-noms-propres a
classé 43 contexts comme valides, 17 tails comme appartenant à un sibling, quatre
comme conflits de source et un comme tail vide. Ce ledger est scellé par le
digest TBESH et le digest individuel du record : toute dérive repasse
automatiquement en revue.

Une citation qui manque le dStrong exact n'est levée que si la section avant
`§`, l'unique entité TIPNR et une occurrence TAHOT sensible à la casse se
recoupent sur les mêmes références d'entité. Cette preuve a réconcilié 171
citations et 42 portées suffixées ; le tail legacy n'est pas un paramètre de la
preuve. Les 42 citations résiduelles et 302 portées suffixées résiduelles restent
dans le raw, mais la sélection de publication exacte ramène les problèmes encore
actifs à 32 écarts de citation et 10 portées suffixées. L'audit reproductible
`lexicon:v3:audit:tbesh` vérifie en plus la
conservation du brut, chaque assertion dérivée, chaque lien de preuve et
l'absence totale de contenu français ; le rebuild courant passe avec zéro
violation.

Cette baseline est volontairement plus conservatrice que la précédente : 315
entrées hébraïques ont quitté `validated` pour `review_needed` lorsque leur
relation n'était confirmée qu'au niveau du Strong classique et non de chaque
identité STEP suffixée. Elles ne sont pas déclarées en conflit lorsque la
relation lexicale générale reste cohérente ; elles attendent simplement une
preuve de sous-sens exacte. `H0381`, dont une seule composante de la combinaison
était auparavant suffisante, fait partie de cette file.

L'analyse qualitative qui a conduit aux garde-fous sous-STEP est conservée dans
[l'audit de 100 candidats](./lexicon-v3-sample-audit.md).

## Préconditions

- Node.js 20 ou plus récent et les dépendances du dépôt installées.
- La base source canonique
  `data/dictionaries/strong_lexicon.full.production.sqlite`.
- Les snapshots STEP sous `data/external/stepbible`, dont TBESG, TBESH, TFLSJ,
  TAGNT et TAHOT.
- L'attestation de droits du projet pour `step-tbesh-meaning`, confirmée par le
  propriétaire du projet le 2026-07-13 et scellée dans le manifeste authoring.
- Les sources ouvertes OpenScriptures HebrewLexicon au commit épinglé. La
  commande de fetch ci-dessous les télécharge et vérifie chaque SHA-256.
- `data/dictionaries/strong.legacy.sqlite` et les concordances Sg1910, Darby et
  DarbyR pour construire les indices français.
- Le binaire Codex fourni avec l'application ChatGPT, copié sous un nom
  content-addressed puis vérifié avant et après chaque exécution. La génération
  française n'utilise ni CEL, ni AI Gateway, ni clé de fournisseur externe.
- Un seul processus écrivain par fichier de revue française et par journal.

Avant de toucher aux artefacts, lancer la porte read-only :

```sh
npm run lexicon:v3:pipeline:check
```

Cette commande exécute le typecheck ciblé et les tests Lexicon V3. Elle ne
reconstruit aucun artefact. À l'inverse,
`npm run lexicon:v3:staging:refresh` reconstruit une chaîne EN-only entièrement
séparée sous `outputs/lexicon-v3/staging` et
`reports/lexicon-v3-staging`, exécute automatiquement
`npm run lexicon:v3:audit:tbesh`, puis exporte la file de revue, sans packets ni
génération FR. Il n'existe volontairement aucun raccourci
`lexicon:v3:staging:refresh:full` : la suite exige une clé de release unique et
des barrières explicites entre plan, candidate, vérification, promotion et
projection. Les étapes FR de production doivent donc recevoir des chemins
explicites liés à cette même release ; les valeurs par défaut de
`lexicon:v3:prepare:fr` restent réservées au développement local. Le raccourci
EN-only ne promeut aucune release et n'écrase pas les artefacts canoniques.

Les sorties complètes sous `outputs/` sont générées et ignorées par Git. Elles
ne doivent pas être ajoutées à un commit comme si elles étaient des sources.

## 1. Auditer et classifier l'anglais

Commande canonique :

```sh
npm run lexicon:v3:audit:en
```

Entrée par défaut :

```text
data/dictionaries/strong_lexicon.full.production.sqlite
```

Sorties par défaut :

```text
outputs/lexicon-v3/english-audit.jsonl
outputs/lexicon-v3/english-audit.summary.json
outputs/lexicon-v3/english-audit.summary.md
```

Options principales : `--db`, `--output`, `--summary-json`, `--report`,
`--only` et `--limit`.

Pour une investigation partielle, toujours utiliser des sorties séparées. Un
audit filtré ne doit pas écraser l'audit complet canonique :

```sh
npm run lexicon:v3:audit:en -- \
  --only G1633,G4776 \
  --output outputs/lexicon-v3/pilots/english-audit.jsonl \
  --summary-json outputs/lexicon-v3/pilots/english-audit.summary.json \
  --report outputs/lexicon-v3/pilots/english-audit.summary.md
```

### Classification des sources

| Décision d'audit  | Interprétation                                                                                                          | État aval                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `accepted`        | La notice courte est structurellement cohérente. TFLSJ peut compléter le grec ; le Meaning TBESH brut est conservé.     | `validated` sous réserve des gates hébraïques                    |
| `repaired`        | La notice courte est en quarantaine, mais TFLSJ fournit un candidat cohérent.                                           | `review_needed`, sauf réparation grecque curatée à preuve exacte |
| `source-conflict` | TFLSJ est incohérent ; la notice courte est conservée.                                                                  | `review_needed`, sauf rétention grecque curatée à preuve exacte  |
| `quarantined`     | Identité, contenu requis ou rattachement non résolu ; aucune source suffisamment attestée pour sélectionner le contenu. | `source_issue`; aucun appel FR utile                             |

L'audit compare notamment le headword original, le support du glossaire, les
relations déclarées, les citations et les occurrences TAGNT/TAHOT. Il échoue en
mode fermé : une incohérence inconnue n'est pas requalifiée en simple variante.

Toutes les exceptions grecques sont liées simultanément aux empreintes exactes
de TBESG, TFLSJ et des deux fichiers TAGNT. Une différence, un fichier TAGNT
supplémentaire ou manquant invalide l'exception et remet l'entrée en
quarantaine. Le record d'audit conserve aussi le `dStrong` exact attesté et son
nombre d'occurrences ; un Strong classique ou une sous-entrée sœur ne vaut pas
preuve.

Trois groupes bornés peuvent éviter une revue humaine :

- douze réparations TFLSJ à tête exacte, plus `G4571` relié explicitement à
  `G4771` ;
- six rétentions TBESG dont le TFLSJ contradictoire est mis en quarantaine ;
- trois notices groupées (`G2624`, `G3022`, `G4955`) dont TFLSJ a une tête
  exacte, un original mono-lexème et une occurrence TAGNT exacte.

`G4245H` est le seul cas supplémentaire borné : son sous-Strong exact est
attesté dans TAGNT et sa notice TBESG décrit bien `πρεσβύτερος`, tandis que le
TFLSJ rattaché décrit le nom distinct `πρεσβυτέριον` (`G4244`). La notice TBESG
reste donc publiable et ce seul supplément TFLSJ est mis en quarantaine. Cette
décision est soumise aux mêmes trois empreintes exactes que les groupes
ci-dessus.

Une simple ressemblance `morphological_variant` n'autorise jamais une
réparation. En particulier, `πρεσβύτερος` et `πρεσβυτέριον` sont deux lexèmes,
pas deux flexions. Huit cas restent explicitement en décision `quarantined`,
donc `source_issue` en aval : `G0001H`, `G1489`, `G1490`, `G2199H`, `G2424K`,
`G4245G`, `G5441` et `G6087`. `G2501O` reste également en quarantaine par le
prédicat générique décrit ci-dessous.

Trois cas supplémentaires sont désormais fermés automatiquement par des
règles de ligne épinglées et digérées. `G21370` reçoit le gloss `wanderer`,
extrait une seule fois de l'assertion TBESG exacte
`<b>= πλάνης, a wanderer</b>`. Pour `G4191` et `G5024`, le bref TBESG soutient
directement le gloss et reste canonique ; leurs TFLSJ décrivent respectivement
les autres lemmes `G4190` et `G3778` et sont mis en quarantaine. Chaque preuve
conserve l'empreinte de la ligne source complète, de la notice, de la règle et
de la décision dans le `recordDigest`. Toute modification échoue en mode fermé.

Cette prudence vaut aussi lorsque la notice courte a d'abord été classée comme
variante morphologique. Elle passe en `quarantined` si elle ne soutient pas le
gloss, si elle possède des citations résolues mais aucune citation de l'identité
STEP exacte, si ces citations attestent le propriétaire d'un autre headword et
si ni la relation STEP déclarée ni une inclusion structurée de l'original
n'expliquent l'écart. Sur le snapshot grec épinglé, ce prédicat générique isole
`G2501O` sans allowlist : le rapprochement graphique `Ἰωσήφ` / `Ἰωσῆς` ne peut
pas transformer une notice de Joses en notice canonique de Joseph.

Un TFLSJ secondaire dont la tête ne correspond pas à une notice TBESG déjà
cohérente est une anomalie de ressource, pas une raison de bloquer cette notice.
Il reste visible dans la provenance comme information, mais `extendedSource`
est supprimé et sa traduction `TFLSJ:fr` est exclue du packet et du prompt.
Cela évite qu'un témoin non sélectionné contamine la traduction française.
La même quarantaine limitée à la ressource s'applique à une tête TFLSJ classée
`morphological_variant` lorsque ses citations résolues n'atteignent jamais
l'identité STEP exacte. Un chevauchement de gloss ou une relation lexicale
générale peut rendre ce témoin utile à la revue, mais ne prouve pas qu'il décrit
le sous-STEP exact ; il ne suffit donc pas à l'envoyer au traducteur. Le snapshot
épinglé contient 30 de ces suppléments : TBESG reste `validated`, mais le TFLSJ
anglais et tout `TFLSJ:fr` correspondant sont exclus des packets français.

### Sous-STEP : différence légitime ou mauvais rattachement

Le numéro Strong classique ne suffit pas à identifier une sous-entrée STEP.
L'identité V3 est :

```text
<language>:<premier code dStrong exact>
```

Le préfixe `G`/`H` et le padding numérique sont normalisés, mais les suffixes et
leur casse sont conservés. Par exemple, `H2148V` et `H2148v` désignent deux
entrées distinctes. Une validation à partir du seul `eStrong` ne peut donc pas
valider une sous-entrée suffixée.

Une différence de headword n'est pas automatiquement une erreur : une relation
STEP explicite entre lemme, forme ou entrée incluse peut l'expliquer. L'audit
accepte cette différence seulement si la relation et les autres preuves sont
cohérentes. En revanche, une notice qui mélange plusieurs sous-entrées reste
une notice groupée à découper, pas un texte à traduire tel quel.

### Construire l'anglais hébreu publiable

Le propriétaire du projet a confirmé le 2026-07-13 les droits de réutilisation,
d'affichage et de traduction du champ TBESH `Meaning`. Le HTML brut de
`StepEntries.meaning` est donc la source canonique primaire de la notice
anglaise hébraïque. L'audit le conserve intégralement et l'authoring crée une
assertion directe `step-tbesh-meaning` liée à son digest et au manifeste de
droits.

Le `valueHtml` affichable reste identique à la source. La seule normalisation
admise concerne `H9001` : le marqueur littéral `<->`, qui ressemble à une
balise, devient `&lt;-&gt;`. Le HTML brut non normalisé reste dans l'assertion de
source ; aucune autre réécriture, simplification ou paraphrase n'est effectuée.

OpenScriptures et TIPNR restent obligatoires comme corroboration et
enrichissement indépendants. Leur rôle est celui d'un gate avant
auto-validation de TBESH :

```sh
npm run lexicon:v3:hebrew:fetch
npm run lexicon:v3:hebrew:build
```

Le fetch est épinglé au commit
`21c9add13bc727d3a951361778e97e3ff7afd1ce` d'OpenScriptures
HebrewLexicon. `AugIndex.xml`, `LexicalIndex.xml`, `HebrewStrong.xml`,
`BrownDriverBriggs.xml` et le README sont refusés si leur SHA-256 diffère.
La base d'entités n'est pas une confiance implicite : `EntityMeta.sourceDigests`
doit contenir exactement les snapshots épinglés de `TIPNR.txt`,
`tipnr-json/people.json` et `tipnr-json/places.json`. Les projections logiques
des colonnes réellement lues dans `StepEntries` et dans `Entities`/
`EntityNames` sont elles aussi épinglées (`6ed72a…` et `102e6f…`). Les 34 363
références structurées `EntityRefs`, utilisées par le gate de portée, ont leur
propre projection logique épinglée (`7868b2…`).

Le builder de corroboration ne lit volontairement pas `StepEntries.meaning`,
afin de rester un témoin indépendant du contenu canonique. Il utilise seulement
l'identité, le gloss STEP, TIPNR, AugIndex, LexicalIndex, HebrewStrong et les
identifiants BDB. L'authoring rapproche ensuite ce résultat indépendant du HTML
TBESH conservé par l'audit. Les règles principales sont :

- TIPNR est joint sur le `dStrong` exact et sensible à la casse. Plusieurs
  entités pour le même identifiant restent `source_issue`, sauf si le gloss STEP
  correspond à l'alias explicite d'une seule entité ; aucune concaténation ni
  correspondance floue n'est admise ;
- une correspondance TIPNR exacte portée par une morphologie qui n'est pas un
  nom propre reste `review_needed` avec
  `tipnr-non-proper-entity-link-not-lexical-definition` : TIPNR prouve ici
  l'identité de l'entité, pas à lui seul une définition lexicale publiable ;
- un `eStrong` augmenté tel que `H0122a` est résolu par AugIndex vers une entrée
  LexicalIndex précise, avec contrôle de la forme originale, de la morphologie
  et de la référence BDB ;
- une notice Strong classique ne valide jamais à elle seule un sous-STEP
  suffixé : elle reste un contexte familial et l'entrée reste en revue ;
- `§` et `&sect;` sont des séparateurs de provenance. Le brut est conservé, puis
  la section STEP spécifique et le contexte legacy sont attestés séparément ;
  la seule présence du séparateur n'impose plus de revue ;
- un Meaning TBESH suffixé sans citation ou preuve de portée vers le `dStrong`
  exact reste `review_needed` (`tbesh-suffixed-scope-unproven`). La preuve
  automatique exige cumulativement une section spécifique, un nom propre, une
  entité TIPNR unique, une occurrence TAHOT du dStrong exact et un recoupement
  de références avec `EntityRefs` ;
- si des citations résolues manquent l'identité exacte, elles restent en revue
  (`tbesh-citations-miss-exact-identity`) sauf si toutes les citations de la
  section spécifique appartiennent à cette même entité et que TAHOT la recoupe.
  Le contexte après `§` n'est jamais admis dans cette preuve ;
- les 65 cas sectionnés qui ne sont pas des noms propres utilisent un ledger
  exhaustif scellé par empreintes : `verified_context`, `foreign_sibling`,
  `source_conflict` ou `empty_tail`. Un préfixe dont la portée a été prouvée est
  publiable sans son tail étranger ; un conflit de source utilise seulement un
  fallback exact indépendamment prouvé, sinon il reste bloquant ;
- un fallback exact n'est jamais accepté sur le seul nom de sa méthode : TIPNR
  exige une entité unique, le dStrong exact sensible à la casse et une
  intersection entre occurrence TAHOT et `EntityRefs`; AugIndex/LexicalIndex
  exigent une identité et un index uniques avec occurrence TAHOT exacte ;
- le mismatch littéral du gloss peut être rétrogradé en advisory seulement pour
  une notice `both` de nom propre ayant une entité TIPNR unique et un gloss
  attesté par alias exact. Aucune distance d'édition n'est utilisée ;
- un même Meaning partagé par plusieurs siblings d'un même Strong classique
  ayant des gloss différents reste en revue
  (`tbesh-shared-sibling-meaning-scope-review-required`) ;
- l'absence de preuve que le Meaning soutient le gloss exact, ou un mismatch
  entre les deux, impose une revue. Un problème de source dans la corroboration
  OpenScriptures/TIPNR bloque le champ au lieu d'être ignoré ;
- les relations directes et transitives sont parcourues jusqu'à six arêtes ; le
  chemin exact et les lignes STEP intermédiaires sont conservés dans la
  provenance. Une relation multi-composants conserve un chemin indépendant par
  composante dans `relationPaths` ; elle n'est jamais aplatie en une fausse
  chaîne entre composantes ;
- une relation `combination of` n'est cohérente que si chaque composante STEP
  exacte est atteinte. Un chemin qui ne confirme que le Strong classique reste
  `review_needed`, même si la relation lexicale générale est plausible ;
- une cible suffixée utilisée par la preuve stricte doit être un self-anchor
  STEP exact et unique. AugIndex ou LexicalIndex doit fournir une unique entrée
  correspondant à l'original et au POS, et aucune autre ligne STEP du même
  `baseCode` ne peut partager cette attestation. Un root et ses siblings de
  sens qui ont la même forme et le même POS restent donc en revue ;
- `a Spelling of` et `a form of` exigent une source lexicale exacte et une
  liaison directe entre les deux entrées LexicalIndex : identifiant BDB commun
  ou arête `<etym>` directe. Aucun chemin étymologique transitif n'est accepté ;
- `in Aramaic of` exige en plus une entrée HebrewStrong `xml:lang="arc"` qui
  référence directement le Strong classique cible, une morphologie `A:` vers
  `H:`, ainsi qu'un original identique et un POS compatible ;
- pour chacune de ces preuves strictes, y compris les combinaisons, la relation
  peut être prouvée tout en laissant le contenu en revue : si tous les mots
  porteurs du gloss STEP ne sont pas attestés dans les définitions exactes
  source/cible, l'issue `step-gloss-open-source-mismatch` est ajoutée ;
- la preuve morphologique stricte d'une combinaison déduplique ses composants
  dans l'ordre déclaré dans `uStrong`, puis exige que leurs originaux concaténés
  reproduisent littéralement l'original source après retrait des signes
  diacritiques et séparateurs. Cet extracteur ordonné est local à cette preuve :
  le tri canonique historique du graphe et de ses chemins reste inchangé ;
- `H9001` à `H9049` sont des morphèmes techniques. Ils peuvent attester un
  composant littéral d'une concaténation exacte ; leur corroboration ouverte
  reste `source_issue` avec `technical-morpheme-no-lexical-content` tant qu'une
  preuve indépendante ne la résout pas. Cela ne supprime pas l'assertion TBESH ;
  pour `H9001`, seul le marqueur `<->` est échappé dans le HTML affichable ;
- les combinaisons conservent leurs branches dans `relationPaths` et les
  rendent séparément (`A → B; A → C`) ; elles ne sont jamais aplaties en une
  fausse chaîne `A → B → C` ;
- un conflit de type d'entité (par exemple nom propre Strong contre syntagme
  commun STEP) ou une relation araméenne incompatible bloque la source.

Le contrat `lexicon-v3-hebrew-english-candidate@5` évalue séparément `gloss` et
`meaning` dans `fieldAssessments`. Ces assessments sont des gates indépendants,
pas les champs anglais sélectionnés. Une corroboration peut donc valider le
Meaning TBESH et laisser le gloss en revue, ou l'inverse, sans copier l'état
d'un champ sur l'autre. Pour le gloss :

- l'auto-validation exige une preuve textuelle non circulaire : égalité avec un
  alias TIPNR de la ligne `EntityNames`, ou couverture déterministe par les
  `<def>` de LexicalIndex/BDB après résolution exacte forme/POS ; le long texte
  `brief` de BDB n'est jamais utilisé pour ce verdict ;
- `Entities.displayName` n'est pas un alias automatique. Il désigne l'entité
  canonique et peut masquer une différence entre deux noms ou sous-STEP ;
- une simple coïncidence de mot ne suffit pas : tous les termes significatifs
  du gloss doivent être attestés. Il n'y a ni fuzzy matching, ni distance
  d'édition, ni dérivation automatique de gentilé ;
- un match exact dans `<meaning><def>` de HebrewStrong est seulement
  `candidate_high`; un match limité à `usage` reste `review`. Aucun de ces deux
  cas ne devient `auto_validated` sans revue ;
- les suffixes alphabétiques, leur casse et les variantes underscore comme
  `H1234_b` restent des identités distinctes et ne peuvent pas alimenter le
  graphe relationnel du Strong classique.

Chaque assessment contient son statut, son tier, sa confiance, ses codes
d'issue et les attestations source exactes. Le vérificateur refuse un gloss
`auto` sans preuve ouverte référencée dans la provenance. Dans l'authoring,
`validated`, `review_needed` et `source_issue` deviennent respectivement
`auto_validated`, `candidate` et `blocked_source_issue` pour ce champ précis.

Les canaris de non-promotion incluent `H0381` : ses composants `H0376G` et
`H2428G` partagent forme et POS avec plusieurs siblings et ne sont donc pas
résolus indépendamment. `H8501` (`deceitful` contre `injury/oppression`) et
`H8568` (`dragon` contre `jackal`) ont une relation structurelle prouvable mais
restent en revue à cause du garde-fou de gloss.

Sorties :

```text
outputs/lexicon-v3/hebrew-english.candidates.jsonl
outputs/lexicon-v3/hebrew-english.candidates.summary.json
```

Construire ensuite l'authoring anglais préliminaire :

```sh
npm run lexicon:v3:authoring
```

L'authoring prend comme entrée canonique la base contenant
`StepEntries.meaning`, et comme gates obligatoires
`data/entities/bible_entities.production.sqlite` et le répertoire XML
OpenScriptures. Il reconstruit intégralement le JSONL hébreu depuis ces sources
et exige une égalité exacte de contenu et de digests avant tout import. Une
paire JSONL/résumé modifiée puis rehachée est donc refusée ; le digest physique
de la base d'entités entre également dans les fingerprints de lineage et de
source.

La paire de corroboration candidat/résumé `@4` est obligatoire et attestée.
L'assertion conserve le HTML TBESH brut ; le champ sélectionné porte le HTML
affichable, identique sauf pour l'échappement `H9001` décrit plus haut. Une
entrée ne devient traduisible que lorsque ses deux champs anglais actifs sont
validés et que l'authoring atteste leurs droits. Une issue
`hebrew-open-gloss-review-needed` ou `hebrew-open-gloss-source-issue` est liée
au `fieldVersionId` du gloss ; elle ne dégrade pas artificiellement la version
du Meaning TBESH, mais maintient l'entrée agrégée hors des appels modèles et de
la release jusqu'à résolution. Le JSONL d'audit brut, même complet, ne porte pas
cette attestation authoring et reste donc inéligible à la génération FR.

## 2. Construire les packets français

```sh
npm run lexicon:v3:packets:fr -- \
  --authoring outputs/lexicon-v3/authoring.sqlite
```

Sorties par défaut :

```text
outputs/lexicon-v3/french-packets.jsonl
outputs/lexicon-v3/french-packets.summary.json
reports/lexicon-v3-french-packets.md
```

Options principales : `--input`, `--db`, `--legacy-db`, `--sg1910`, `--darby`,
`--darby-r`, `--output`, `--summary-json`, `--report`, `--only`, `--offset` et
`--limit`. Pour une génération réelle, `--authoring` est requis : les packets
doivent provenir du snapshot anglais après application des décisions EN, et non
du seul audit brut.

État du rebuild au 2026-07-13 : aucun français n'est généré. La chaîne courante
s'arrête à l'authoring EN attesté ; un éventuel packet construit directement
depuis l'audit brut garde l'hébreu en `source_issue` avec
`authoring-rights-attestation-required:TBESH-meaning` et sans Meaning transmis
au modèle. La présence du texte brut prouve le contenu source, pas les droits ni
la validation de portée nécessaires à une traduction.

Chaque packet contient :

- l'identité STEP exacte et le hash du contenu anglais canonique ;
- l'empreinte du snapshot et de la lignée de l'authoring anglais revu ;
- le glossaire, la notice, le statut et les preuves anglaises ;
- les formes observées dans les concordances françaises ;
- les textes français existants dans la base full, ses ressources et la base
  legacy, uniquement comme candidats non fiables ;
- les tokens Strong, références et formes originales à protéger.

Les témoins ne sont pas comptés naïvement. Darby et DarbyR forment une seule
famille ; Sg1910 est une seconde famille indépendante. Une même tradition dans
deux fichiers ne devient donc pas artificiellement un consensus à deux voix.

Le résumé `@2` scelle le chemin et le SHA-256 de chaque source, le snapshot
anglais, la sélection et le digest de la sortie. La génération et l'authoring
final revérifient ce manifeste ; on ne peut pas remplacer un CSV, une base
legacy, l'authoring ou un packet après coup sans invalider la chaîne.

## 3. Budgéter, générer et reprendre le français

> **Section historique, désactivée pour la production actuelle.** Les commandes
> Gateway ci-dessous documentent l'ancien prototype et ne doivent plus être
> exécutées. Le chemin autorisé est exclusivement le pipeline Codex interne
> décrit dans
> [le contrat français actuel](./lexicon-v3-french-internal-pipeline.md). Cette
> section sera supprimée lorsque les empreintes de la release française auront
> été inscrites dans le runbook final.

Les commandes de cette section documentent un futur run explicitement décidé.
Elles n'ont pas été exécutées pour le rebuild du 2026-07-13. Pour vérifier le
budget sans produire de français, rester en `--dry-run`.

### Dry-run de budget

```sh
npm run lexicon:v3:translate:fr -- --dry-run
```

Le dry-run ne fait aucun appel modèle. Il écrit le résumé et le rapport avec :

- `plannedModelCalls` : trois appels par packet éligible, soit deux proposants
  et un arbitre ;
- `estimatedMinimumInputTokens` : borne basse calculée sur les deux prompts des
  proposants seulement.

Cette estimation exclut l'entrée de l'arbitre et tous les tokens de sortie. Le
coût réel doit être lu dans `totalUsage` après exécution. Les packets dont
l'anglais vaut `review_needed` ou `source_issue` n'appellent aucun modèle : ils
restent explicitement hors génération payante.

### Pilote borné

Un pilote ne doit jamais partager les sorties canoniques avec le run complet :

```sh
AI_GATEWAY_KEY='...' npm run lexicon:v3:translate:fr -- \
  --limit 100 \
  --output outputs/lexicon-v3/pilots/french-review-100.jsonl \
  --summary outputs/lexicon-v3/pilots/french-review-100.summary.json \
  --report reports/lexicon-v3-french-review-100.md
```

On peut aussi cibler `--only`, `--offset`, modifier `--concurrency` de 1 à 8 et
`--timeout-ms` de 1 000 à 600 000 ms.

### Run complet et reprise

Premier run, sans `--resume` :

```sh
AI_GATEWAY_KEY='...' npm run lexicon:v3:translate:fr -- \
  --max-model-calls 63666
```

La valeur doit venir du dry-run réellement inspecté. Sans
`--max-model-calls`, un run payant est limité à 300 appels ; au-delà, la
commande échoue avant le premier appel. La valeur est un plafond, pas une cible,
et peut être réutilisée lors d'une reprise où il reste moins d'appels.

Après une interruption, relancer exactement la même sélection et les mêmes
sorties avec :

```sh
AI_GATEWAY_KEY='...' npm run lexicon:v3:translate:fr -- \
  --resume \
  --max-model-calls 63666
```

Le fichier `<output>.journal` est append-only pendant le run. La reprise fusionne
la sortie et le journal, compacte la dernière ligne de chaque entrée, saute
seulement un résultat non échoué dont le `packetHash` et le
`generationConfigHash` sont toujours identiques, et rejoue les échecs, les
packets modifiés ou tout changement de modèles, reasoning ou version de prompt.
Chaque record `@2` et le résumé de run `@3` portent cette empreinte. À la fin,
la sortie compacte est renommée atomiquement et le journal est supprimé.

Ne jamais lancer deux agents ou processus sur le même couple sortie/journal.
Pour paralléliser, utiliser des shards et chemins distincts, puis ajouter un
outil de fusion contrôlée ; la pipeline ne fournit pas actuellement de fusion
production multi-writer.

### Modèles et porte automatique

Valeurs par défaut :

| Rôle        | Modèle demandé            | Reasoning |
| ----------- | ------------------------- | --------- |
| Proposant A | `openai/gpt-5.4-mini`     | `medium`  |
| Proposant B | `google/gemini-3.5-flash` | `low`     |
| Arbitre     | `openai/gpt-5.5`          | `medium`  |

Les options sont `--model-a`, `--model-b`, `--arbiter`, `--reasoning-a`,
`--reasoning-b` et `--reasoning-arbiter`. Changer un nom demandé ne suffit pas à
prouver un modèle distinct : chaque ligne enregistre le modèle et le provider
réellement retournés par la gateway. Une auto-validation exige trois identités
d'exécution vérifiées et distinctes. Le modèle qualifié par son provider que la
gateway retourne est conservé ; l'alias demandé ne constitue pas une preuve.

`auto_validated` n'est accordé que si toutes les conditions suivantes tiennent :

- anglais déjà validé ;
- preuves d'exécution valides pour les trois rôles ;
- accord exact, après normalisation, des deux propositions et de l'arbitre sur
  le glossaire et la notice ;
- HTML canonique et sûr, contenu protégé intact, aucun warning ni blocker ;
- verdict `accept` de l'arbitre, sans raison résiduelle, confiance au moins 0,9.

Le texte simple et le texte visible du HTML doivent contenir les mêmes mots
dans le même ordre. Seule la ponctuation aux frontières de paragraphes peut
différer ; une divergence de contenu ou un attribut HTML reste bloquant. Les
balises autorisées doivent aussi être fermées et correctement imbriquées ; un
HTML croisé, tronqué ou auto-fermé sur une balise non vide est bloqué.

Tout écart donne `review_needed`. Les autres statuts sont
`blocked_source_issue` et `failed`. Un consensus modèle réduit le bruit, mais ne
remplace pas une expertise éditoriale sur les cas ambigus.

### Termes d'alignement français

Les textes destinés à l'affichage et les termes servant d'indices d'alignement
sont deux objets distincts. Un terme n'est candidat que si les deux proposants
donnent exactement la même forme normalisée et si une concordance la prouve.
Il n'est `auto_safe` que si l'arbitre confirme aussi cette forme, avec deux
familles de témoins indépendantes et une forme globalement non ambiguë. Une
omission par l'arbitre force `review_only`. Sinon il reste `candidate` ou
`review_only`.

Dans la version actuelle, seuls les carriers `auto_safe` validés ont un chemin
complet jusqu'à la release. Ne jamais injecter manuellement un carrier dans la
base de production.

Lorsqu'une base antérieure à V3 est lue par les outils d'alignement, ses glosses
français restent disponibles comme indices `review_only`, mais ne peuvent plus
devenir une preuve directe ni enrichir automatiquement un alignement. Le chemin
automatique exige une projection V3 attestée et un carrier publié.

## 4. Construire la base d'authoring

Le cycle supporté comporte deux builds. Le premier crée l'anglais à revoir :

```sh
npm run lexicon:v3:authoring
```

Après export et rédaction des décisions EN, reconstruire un snapshot anglais
rejouable :

```sh
npm run lexicon:v3:authoring -- \
  --review-decisions outputs/lexicon-v3/review-decisions.jsonl \
  --output outputs/lexicon-v3/reviewed-english.sqlite \
  --summary-json outputs/lexicon-v3/reviewed-english.summary.json

npm run lexicon:v3:packets:fr -- \
  --authoring outputs/lexicon-v3/reviewed-english.sqlite
```

Lors d'un futur run FR autorisé, construire ensuite l'authoring final avec les
packets exacts :

```sh
npm run lexicon:v3:authoring -- \
  --review-decisions outputs/lexicon-v3/review-decisions.jsonl \
  --french-packets outputs/lexicon-v3/french-packets.jsonl \
  --french-packet-summary outputs/lexicon-v3/french-packets.summary.json \
  --french-review outputs/lexicon-v3/french-review.jsonl
```

Le build applique d'abord toutes les décisions EN, recalcule le snapshot
effectif, vérifie que chaque packet provient exactement de ce snapshot, insère
ensuite le FR avec ce parent EN précis, puis applique les décisions FR. Un
packet construit depuis l'audit brut ou un ancien authoring est refusé.

Le build vérifie la couverture complète, les digests, les empreintes source et
code, les `packetHash`, l'identité réelle des modèles, le HTML, les validations
et les carriers. Il construit un fichier temporaire puis le renomme : une erreur
ne doit pas laisser une demi-base à la place de l'artefact précédent.

Chaque champ FR conserve l'identifiant exact de la version EN dont il dérive.
Si une décision remplace l'anglais, la mutation invalide atomiquement tous les
descendants FR et carriers actifs. Il faut alors reconstruire un nouveau packet
et un nouveau FR ; la release refuse tout parent périmé même si le texte paraît
encore plausible.

De même, une décision `replace`, `reject`, `source_issue` ou `needs_review` sur
un gloss FR supersède dans la même transaction tous ses carriers actifs. Un
échec de vérification avant `COMMIT` annule l'ensemble de la mutation.

## 5. Revue humaine durable au format `@3`

### Exporter la file

```sh
npm run lexicon:v3:review -- export \
  --output outputs/lexicon-v3/review-queue.json \
  --limit 500
```

Options utiles : `--db`, `--only`, `--limit`, `--include-auto-glosses true` et
`--include-info-issues true`. Par défaut, une issue purement `info` reste
visible comme contexte d'une cible déjà actionnable, mais ne suffit pas à faire
entrer un champ validé dans la file. La file `lexicon-v3-review-queue@3` contient
l'identité, les assertions de source, les issues ouvertes et, pour chaque
champ, un `reviewTargetHash`. Un champ EN absent mais signalé par
`missing-english-gloss` ou `missing-english-meaning` apparaît comme une cible
virtuelle avec `id: null`, `state: "missing"` et `missing: true` ; il n'est donc
plus nécessaire de créer une ligne SQLite à la main.

### Écrire les décisions

Le fichier durable est, par convention :

```text
outputs/lexicon-v3/review-decisions.jsonl
```

Chaque nouvelle ligne suit `lexicon-v3-review-decision@3`. Les anciennes
décisions `@2` restent relisibles, mais seul `@3` permet une création. Exemple
d'acceptation à
adapter avec le hash exact exporté :

```json
{
  "schemaVersion": "lexicon-v3-review-decision@3",
  "entryKey": "greek:G1633",
  "locale": "fr",
  "field": "meaning",
  "expectedContentHash": "<reviewTargetHash exporté>",
  "verdict": "accept",
  "reviewer": "initiales-ou-id",
  "reason": "Traduction vérifiée contre l'anglais canonique et les témoins.",
  "resolveIssueCodes": [],
  "decidedAt": "2026-07-13T12:00:00.000Z"
}
```

Les verdicts possibles sont `accept`, `reject`, `needs_review`, `source_issue`,
`replace` et `create`. `fieldVersionId` est facultatif et seulement informatif
pour un champ existant ; il doit être absent pour `create`. La cible
stable est le quadruplet `entryKey`/`locale`/`field`/`expectedContentHash`, où
`expectedContentHash` doit être le `reviewTargetHash` de la file, pas le simple
`contentHash` SQLite. Pour le français, ce hash incorpore aussi le hash du parent
anglais. Pour `create`, le hash est celui de la cible virtuelle exportée.

Tout verdict `replace` doit fournir explicitement `replacement.evidenceMode`
avec exactement `inherit` ou `editorial_replacement`. Une valeur absente ou une
faute de frappe est rejetée ; il n'existe pas de valeur implicite. Le mode
`editorial_replacement` exige en plus un `sourceNote` non vide.

`create` est volontairement plus strict : il ne peut viser qu'un `gloss` ou un
`meaning` EN réellement absent, doit utiliser `editorial_replacement`, et doit
résoudre explicitement l'issue `missing-english-gloss` ou
`missing-english-meaning` correspondante. Exemple hypothétique (le gloss
`G21370`, ancien exemple réel de ce cas, est désormais réparé automatiquement
par la règle épinglée décrite plus haut) :

```json
{
  "schemaVersion": "lexicon-v3-review-decision@3",
  "entryKey": "greek:G9999",
  "locale": "en",
  "field": "gloss",
  "expectedContentHash": "<reviewTargetHash de la cible missing>",
  "verdict": "create",
  "reviewer": "initiales-ou-id",
  "reason": "Gloss anglais absent créé après examen des sources exactes.",
  "replacement": {
    "valueText": "<gloss anglais original>",
    "confidence": 1,
    "evidenceMode": "editorial_replacement",
    "sourceNote": "Sources grecques exactes et raisonnement éditorial documentés."
  },
  "resolveIssueCodes": ["missing-english-gloss"],
  "decidedAt": "2026-07-13T12:00:00.000Z"
}
```

Le même mécanisme couvre tout champ réellement absent. Sur le snapshot courant,
aucun `StepEntries.meaning` hébreu n'est vide : `create` ne s'applique donc pas
aux Meanings TBESH canoniques, y compris `H9001` à `H9049`. La décision vise
leur revue ou, si nécessaire, une modification éditoriale. Les autres blockers
de l'entrée ne sont jamais fermés implicitement : ils doivent être cités dans
`resolveIssueCodes` uniquement si la revue les résout réellement.

Les décisions obsolètes, ambiguës, dupliquées ou visant un champ terminal sont
rejetées transactionnellement. Les issues ne sont fermées que si leur code est
explicitement listé dans `resolveIssueCodes`. Un champ `human_validated` doit
conserver une revue humaine `accept` correspondante ; la release la vérifie.

### Valider puis rendre la revue reproductible

Une application directe est utile pour contrôler le fichier :

```sh
npm run lexicon:v3:review -- apply \
  --input outputs/lexicon-v3/review-decisions.jsonl
```

Elle modifie la base d'authoring courante, mais cette mutation n'est pas le
contrat reproductible final. Reconstruire ensuite la base depuis les artefacts
et le même JSONL :

```sh
npm run lexicon:v3:authoring -- \
  --french-review outputs/lexicon-v3/french-review.jsonl \
  --review-decisions outputs/lexicon-v3/review-decisions.jsonl
```

Sans `--review-decisions`, un rebuild perdrait les mutations faites par
`review apply`.

## 6. Droits TBESH, attestation et revue éditoriale

Le propriétaire du projet a confirmé le 2026-07-13 que le projet détient les
permissions nécessaires pour réutiliser, afficher et traduire le champ TBESH
`Meaning`. Cette confirmation est enregistrée séparément de la licence CC BY
4.0 des glosses et morphologies : les droits ne sont pas inférés de la présence
des données.

| Source logique                 | État et fondement                                     | Affichage | Traduction |
| ------------------------------ | ----------------------------------------------------- | --------: | ---------: |
| `step-tbesh-gloss`             | `cleared`, CC BY 4.0                                  |       oui |        oui |
| `step-tbesh-meaning`           | `cleared`, permission projet confirmée le 2026-07-13  |       oui |        oui |
| `artifact-hebrew-open-english` | sources ouvertes fixées, corroboration/enrichissement |       oui |        oui |

L'audit `@6` conserve le HTML brut `StepEntries.meaning` et les références des
occurrences dStrong exactes. L'authoring crée une
assertion directe sur ce brut et sélectionne TBESH comme source canonique
primaire du Meaning hébreu. Le HTML affichable est identique, sauf le marqueur
`<->` de `H9001` échappé en `&lt;-&gt;`; l'assertion demeure inchangée. Le
manifeste scelle le digest TBESH, le statut `cleared`, les permissions et la
date de confirmation.

OpenScriptures/TIPNR reste un témoin indépendant et un gate obligatoire. Un
Meaning suffixé sans preuve de portée exacte, un texte partagé entre des siblings
aux gloss différents, un tail identifié comme étranger ou un contenu incompatible
avec le gloss exact reste en revue. `§` seul n'est jamais un motif de revue. Une
citation qui ne touche pas l'identité exacte reste un signal de revue tant que la
preuve TIPNR + `EntityRefs` + TAHOT ne la réconcilie pas ; un problème de source
explicite bloque le champ. La revue porte donc sur la portée et le rattachement
du contenu canonique ; les décisions éditoriales restent strictement ciblées par
champ.

Une décision humaine `replace`, ou `create` si le champ est réellement absent,
reste possible au cas par cas avec `evidenceMode: "editorial_replacement"` et
un `sourceNote` documentant les assertions examinées. `inherit` conserve les
preuves existantes et ne ferme jamais une issue de portée ou de source.

Le cycle modification EN -> nouveau packet -> nouveau FR -> parent EN exact est
implémenté et testé, mais aucun FR n'a été généré dans le rebuild courant. Toute
retouche SQL manuelle reste exclue : elle contournerait les empreintes,
l'invalidation des descendants et la release.

## 7. Planifier, figer et promouvoir une release

Choisir une clé unique et conserver une étape d'inspection entre chaque
commande :

```sh
RELEASE_KEY='lexicon-v3-2026-07-13.1'

npm run lexicon:v3:release -- plan --verbose true

npm run lexicon:v3:release -- candidate \
  --release-key "$RELEASE_KEY" \
  --policy-version 'lexicon-v3-release-policy@1'

npm run lexicon:v3:release -- verify \
  --release-key "$RELEASE_KEY" \
  --current true

npm run lexicon:v3:release -- promote \
  --release-key "$RELEASE_KEY"

npm run lexicon:v3:release -- verify \
  --release-key "$RELEASE_KEY"
```

Pour figer l'anglais avant tout travail français, utiliser le profil distinct
`core-en` sur le plan et la candidate :

```sh
RELEASE_KEY='lexicon-v3-en-2026-07-13.1'

npm run lexicon:v3:release -- plan --profile core-en --verbose true
npm run lexicon:v3:release -- candidate \
  --profile core-en \
  --release-key "$RELEASE_KEY"
```

Des raccourcis équivalents existent :

```text
lexicon:v3:release:plan
lexicon:v3:release:candidate
lexicon:v3:release:verify-current
lexicon:v3:release:promote
lexicon:v3:release:project
```

Le plan doit avoir zéro erreur. Le profil bilingue exige exactement quatre
champs par entrée (glossaire et notice EN, glossaire et notice FR). `core-en`
exige exactement deux champs par entrée (`en:gloss` et `en:meaning`), ne dépend
d'aucun champ FR et ne scelle aucun carrier de traduction. Les autres portes
restent identiques :

- état `auto_validated` ou `human_validated` seulement ;
- parent EN exact pour chaque champ FR et hash de contenu courant ;
- revue humaine `accept` pour chaque champ `human_validated` ;
- aucun warning ou blocker ouvert ;
- droits d'affichage sur chaque preuve de support et droits de traduction sur
  les preuves anglaises dont le français dérive ;
- au moins une preuve `supports` admissible et rattachée au même champ : source
  `cleared`, affichage autorisé et, pour l'anglais, traduction autorisée ; le
  français exige une assertion FR de revue/traduction en plus de son parent EN ;
- confiance minimale de 0,90 pour tout champ `auto_validated` ; pour l'hébreu,
  assertion directe TBESH et droits attestés, plus artefact indépendant
  OpenScriptures/TIPNR épinglé et gate résolu avant publication ;
- carriers validés, liés au glossaire sélectionné et soutenus par une source
  autorisant cet usage ;
- empreintes source, code, politique et snapshot présentes et cohérentes.

`candidate` fige les identifiants des champs et carriers dans un snapshot
immuable. Son manifeste `@4` scelle le profil et la version de politique de la
release, l'inventaire des droits effectivement concernés, l'empreinte logique
du schéma et du contenu source à préserver, ainsi que l'empreinte de toutes les
identités authoring (`stepEntryId`, langue, Strong, original,
translittérations, morphologie et prononciation). Les manifestes `@2`/`@3`
restent lisibles pour diagnostic, mais l'absence de fingerprint logique scellé
leur interdit une nouvelle projection. La candidate vérifie
immédiatement qu'il correspond encore à la sélection courante. `verify
--current true` refait ce contrôle juste avant promotion et détecte toute
mutation ultérieure des droits ou des identités. `promote` refuse toute
candidate périmée et revalide le schéma. La vérification finale sans `--current`
contrôle le snapshot promu.

Il n'existe volontairement pas de commande production qui enchaîne sans arrêt
candidate, promotion et projection. L'inspection des erreurs et du manifeste
entre les étapes fait partie du protocole.

## 8. Projeter les profils `core`, `full` et `core-en`

Seule une release `promoted` peut être projetée :

```sh
npm run lexicon:v3:production -- \
  --release-key "$RELEASE_KEY"
```

Entrée source par défaut :

```text
data/dictionaries/strong_lexicon.full.production.sqlite
```

Sorties par défaut :

```text
outputs/lexicon-v3/strong_lexicon.core.candidate.sqlite
outputs/lexicon-v3/strong_lexicon.full.candidate.sqlite
```

Options : `--authoring`, `--source`, `--core-output`, `--full-output` et
`--write`. Si l'une des sorties existe, la commande refuse d'écraser sans
`--write`. Même avec `--write`, une sortie ne peut jamais être l'authoring, la
source, `data/dictionaries/strong_lexicon.core.production.sqlite` ou
`data/dictionaries/strong_lexicon.full.production.sqlite`. Le suffixe
`.candidate.sqlite` désigne ici un artefact de staging à
déployer ou renommer explicitement ; la release embarquée est déjà promue.

Une release `core-en` se projette vers un fichier séparé :

```sh
npm run lexicon:v3:production -- \
  --profile core-en \
  --release-key "$RELEASE_KEY"
```

La sortie par défaut est
`outputs/lexicon-v3/strong_lexicon.en.core.candidate.sqlite`; `--output` permet
de la changer. La commande refuse également d'écraser ce fichier sans
`--write` et n'écrit jamais les sorties bilingues pendant cette projection.

| Profil    | Contenu garanti V3                                              | Ressources et traductions historiques                                         |
| --------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `core`    | Quatre champs validés par entrée, statuts et carriers validés   | Tables `LexiconResources` et `LexiconResourceTranslations` supprimées         |
| `full`    | Les mêmes quatre champs, statuts et carriers                    | Tables conservées telles quelles ; traductions marquées `legacy-unvalidated`  |
| `core-en` | Deux champs EN validés par entrée, statuts EN, aucun carrier FR | Ressources supprimées ; tables de traduction lexicale et morphologique vidées |

La vérification `core-en` exige zéro ligne dans `LexiconTranslations`, zéro
ligne dans `MorphologyCodeTranslations`, zéro statut non anglais et zéro
carrier. Elle compare aussi chaque identité et chaque champ EN projetés au
snapshot scellé ; les corrections d'identité de l'authoring ne peuvent donc pas
être perdues au profit des anciennes colonnes de la base source. Le fingerprint
logique de cette source brute reste enregistré séparément. `secure_delete`, le
journal en mémoire et `VACUUM` retirent aussi les octets des anciennes
traductions et des valeurs remplacées de la copie SQLite avant publication.

Le profil recommandé pour promettre un lexique EN précis et un FR validé est
`core`. Le profil `full` sert aux consommateurs qui ont besoin des ressources
STEP historiques, mais ses traductions de ressources ne sont ni régénérées ni
validées par V3. Elles ne doivent jamais être présentées comme « parfaitement
traduites ». La métadonnée `lexiconV3ResourceTranslationStatus` vaut `excluded`
dans core et `legacy-unvalidated` dans full.

La projection revalide d'abord la sélection courante, les droits, le code et
les fingerprints contre la release promue. Elle lit ensuite le manifeste de
droits figé ; toute dérive après promotion bloque donc la projection.

La projection compare l'empreinte logique de la source avec celle de
l'authoring. Cette empreinte couvre les identités, originaux,
translittérations, morphologies, ressources et traductions de ressources qui
doivent être préservés ; elle exclut les champs d'affichage remplacés par la
release. Elle inclut volontairement les lignes de métadonnées et colonnes
techniques préservées : c'est une identité exacte de l'artefact source, pas une
simple équivalence lexicale. Une base ressemblante mais issue d'un autre
snapshot est refusée. Le fingerprint inclut aussi `sqlite_schema`; une table,
vue, trigger ou colonne supplémentaire change l'empreinte. Une allowlist finale
des tables et colonnes interdit en plus qu'un payload non prévu survive dans le
fichier `core-en`.

Core et full sont construits et publiés comme une paire atomique récupérable.
La projection active `secure_delete`, remplace les champs, compacte les deux
profils par `VACUUM`, exige une freelist vide et vérifie l'absence de journaux
SQLite résiduels. Un canari propre au build remplace d'abord toutes les
anciennes notices, puis est lui-même remplacé par les champs validés ; son
absence dans les octets UTF-8 et UTF-16 des fichiers produits atteste la purge
physique du cycle d'écriture.
La vérification finale contrôle l'intégrité SQLite, les clés étrangères, le
nombre d'entrées et de champs, les carriers et l'égalité exacte du contenu
projeté. Le résumé retourne, pour chaque fichier, le SHA-256 physique et une
empreinte logique. `DictionaryMeta` embarque la release, les empreintes source
et code, la politique, le profil, le snapshot et le manifeste de droits avec
son digest.

## Garanties obtenues

Une projection réussie garantit techniquement que :

- chaque entrée source exacte possède les quatre champs publiables attendus ;
- chaque français est lié à la version anglaise exacte sélectionnée ;
- aucun champ bloqué, candidat, rejeté ou portant une issue ouverte n'a franchi
  la release ;
- les auto-validations FR ont les preuves des trois exécutions réelles et ont
  passé la porte de consensus stricte ;
- les validations humaines sont auditées par une décision durable et stable ;
- les droits déclarés autorisent l'affichage et, quand nécessaire, la
  traduction ;
- la source projetée correspond logiquement à celle auditée ;
- le contenu final correspond exactement au snapshot promu et la paire SQLite
  a passé ses contrôles d'intégrité.

## Limites et règles de communication produit

- « Parfaitement traduit » reste une exigence éditoriale, pas une propriété que
  trois modèles peuvent démontrer. Les cas `review_needed`, les conflits de
  source et les nuances théologiques ou lexicographiques doivent être relus par
  une personne compétente.
- Le consensus peut reproduire une même erreur. Il est une porte conservatrice,
  pas une preuve sémantique absolue.
- Les notices TBESH sont le contenu canonique hébreu, mais ce choix ne valide
  pas automatiquement leur portée sous-STEP. La release reste bloquée tant que
  les `review_needed` et `source_issue` ouverts n'ont pas reçu de décision
  durable.
- Le profil `full` mélange volontairement le noyau V3 garanti et des ressources
  legacy non validées. Les interfaces doivent les distinguer.
- Les carriers ne sont pas des synonymes exhaustifs. Ils sont des clés
  d'alignement prouvées et doivent rester plus conservateurs que le texte
  affiché.
- Les comptes, coûts et modèles disponibles peuvent changer. Toujours conserver
  les résumés, preuves d'exécution, digests et manifestes du run réellement
  publié.

## Checklist opérateur avant livraison

- [ ] `npm run lexicon:v3:pipeline:check` est vert.
- [ ] L'audit EN couvre toutes les entrées et ses quarantaines sont expliquées.
- [ ] Le digest TBESH et l'attestation de droits confirmée le 2026-07-13 sont
      scellés ; le HTML brut est présent dans l'assertion et seul `<->` de
      `H9001` est échappé dans le HTML affichable.
- [ ] La corroboration OpenScriptures/TIPNR correspond au commit, aux SHA-256
      et aux projections logiques épinglés, et tous ses gates requis sont
      résolus.
- [ ] Le résumé des packets correspond au snapshot d'authoring EN revu et aux
      snapshots de source courants.
- [ ] Pour le rebuild EN-only courant, aucun run FR n'a été lancé ; tout contrôle
      éventuel est resté en dry-run avec zéro appel modèle et zéro traduction.
- [ ] Pour une future release bilingue, le dry-run de budget est validé avant
      les appels payants et le run FR complet est compact, sans journal résiduel
      ni `failed` ignoré.
- [ ] Tous les `review_needed`, `source_issue`, warnings et blockers ont une
      décision ou une résolution explicite.
- [ ] La base d'authoring finale a été reconstruite avec le JSONL de décisions.
- [ ] Le plan de release contient zéro erreur.
- [ ] La candidate a passé `verify --current true` avant promotion.
- [ ] La release promue passe `verify`.
- [ ] Core et full ont été projetés ensemble depuis la base source dont
      l'empreinte logique correspond.
- [ ] Les SHA-256, empreintes logiques, manifestes et rapports du run publié sont
      archivés avec la clé de release.
- [ ] Le produit promet la garantie V3 seulement sur les champs couverts, et
      marque les ressources FR du profil full comme legacy non validées.
