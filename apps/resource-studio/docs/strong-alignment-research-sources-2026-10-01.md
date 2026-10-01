# Méthodes locales d’alignement Strong : recherche du 1er octobre 2026

Les pistes les plus intéressantes sont des aligneurs de mots entraînés sur le corpus biblique et des représentations explicites des occurrences, des groupes et de l’absence d’équivalent. Remplacer JEV par un autre classificateur généraliste ne traite pas nécessairement ces problèmes. Les méthodes ci-dessous constituent des expériences proposées ; aucune n’a été installée, entraînée ou évaluée dans cette recherche.

Cette note complète l’audit local et le [comparatif JEV/Laya](./strong-decision-benchmark-2026-10-01.md). Elle respecte la frontière Resource Studio : produire des candidats et des mesures, sans import ou activation en production. Le contrat texte/révision/sidecar reste celui de l’[ADR-0013](../../../docs/adr/0013-pair-canonical-bible-text-with-optional-strong-sidecars.md) ; la responsabilité d’authoring suit l’[ADR-0035](../../../docs/adr/0035-rename-lexicon-editor-to-resource-studio.md).

## Six ensembles de sources primaires

### 1. Eflomal et fast_align : apprendre du corpus parallèle

**Établi.** Eflomal apprend des alignements à partir de paires de phrases tokenisées. Il combine des composantes lexicales, de déplacement et de fertilité, accepte des a priori lexicaux et fournit des alignements dans les deux directions. Les a priori peuvent être exportés pour traiter ensuite d’autres phrases. Les liens NULL ne figurent pas dans sa sortie. [Dépôt officiel eflomal](https://github.com/robertostling/eflomal).

Fast_align est une réparamétrisation du modèle IBM 2 ; il reçoit le même type de corpus et fournit des liens entre positions. Son outil `atools` combine les deux directions par des heuristiques de symétrisation. C’est un comparateur simple utile. [Dépôt officiel fast_align](https://github.com/clab/fast_align).

**Hypothèse pour nous.** Une séquence d’identifiants Strong ou de lemmes, conservant séparément l’identifiant de chaque occurrence, peut servir de vocabulaire source. L’apprentissage exploiterait les répétitions sur des milliers de versets français sans exiger qu’un encodeur connaisse l’hébreu biblique. Cela reste à mesurer, notamment sur polysémie et formes rares. Le système possède déjà du lexique appris et des traitements globaux de répétitions : l’expérience porte sur l’apport d’un modèle d’alignement de corpus, pas sur l’invention de ces mécanismes.

**Limite de reproductibilité.** Eflomal initialise son générateur depuis `/dev/urandom`, avec repli sur l’heure. « Local » ne signifie donc pas « déterministe ». Il faudrait contrôler explicitement la graine et l’exécution, mesurer les répétitions, ou conserver les sorties comme artefacts gelés avant la génération déterministe. [Code `random.c`, révision vérifiée](https://github.com/robertostling/eflomal/blob/1fe06a8316eece1ac6ce6bb043e659a96b642a91/src/random.c#L67).

### 2. SimAlign : similarités contextualisées plutôt que décisions textuelles

**Établi.** SimAlign extrait des liens depuis les représentations multilingues contextualisées, sans corpus parallèle pour entraîner l’aligneur. Il propose ArgMax, IterMax et Match ; l’inférence est possible sur CPU. Ses évaluations publiées concernent notamment anglais–français, pas notre tâche hébreu biblique/grec ancien–français. Le dépôt prévoit des liens de référence « sûrs » et « possibles », distinction utile pour les alternatives linguistiquement acceptables. [Article EMNLP 2020](https://aclanthology.org/2020.findings-emnlp.147/), [code et protocole](https://github.com/cisnlp/simalign).

**Hypothèse pour nous.** Aligner une traduction anglaise déjà reliée aux occurrences source avec le français, puis composer les liens, donnerait une seconde preuve pour les candidats manquants. Il faut comparer cette projection à notre transfert existant et conserver les identités source exactes. Une suite de gloses anglaises isolées ne constitue pas automatiquement une phrase anglaise sur laquelle les résultats publiés seraient transférables.

### 3. Awesome-align : adapter un encodeur à nos traductions

**Établi.** Awesome-align extrait des liens de mBERT et permet une adaptation sur corpus parallèle, avec ou sans liens supervisés. Il peut exporter des scores de liens. Les auteurs signalent explicitement qu’une option favorisant le rappel peut réduire la précision. Les résultats publiés français–anglais ne constituent pas une validation biblique. [Article EACL 2021](https://aclanthology.org/2021.eacl-main.181/), [code et options officiels](https://github.com/neulab/awesome-align).

**Hypothèse pour nous.** Si SimAlign apporte une couverture utile mais insuffisamment précise, une adaptation sur les traductions bibliques peut être testée. Elle vient après une base de référence auditée : apprendre nos annotations actuelles puis les retrouver ne démontrerait pas une amélioration sémantique. Un score softmax de lien n’est pas, sans mesure de calibration, une probabilité de correction éditoriale.

### 4. Couverture de mBERT : ne pas confondre grec et grec ancien

**Établi.** La documentation de mBERT indique un entraînement sur des Wikipédias et liste français, grec et hébreu. Elle ne fournit pas de validation d’alignement pour le grec du Nouveau Testament ou l’hébreu biblique. [Documentation de Google Research](https://github.com/google-research/bert/blob/master/multilingual.md).

**Conséquence méthodologique.** La capacité à tokeniser un texte ancien ne prouve pas que ses représentations permettent un alignement fiable. Le chemin direct ancien→français doit être une ablation mesurée, pas l’hypothèse implicite. Un chemin anglais→français est mieux étayé par les évaluations des aligneurs, mais ajoute les erreurs de composition et de traduction du pivot.

### 5. Clear Bible / Scripture Burrito : aligner des occurrences et des groupes

**Établi.** Le modèle de `biblealignlib` associe des listes d’identifiants source et cible, avec provenance et statut. Il décrit explicitement les relations plusieurs-à-plusieurs et distingue notamment traduction, anaphore et morphologie. Sa documentation distingue aussi un simple interlinéaire par lemme d’un alignement identifiant les occurrences répétées. [Modèle d’alignement](https://github.com/Clear-Bible/biblealignlib/blob/main/docs/explanation/alignment-model.md), [formats et identifiants](https://github.com/Clear-Bible/Alignments/blob/main/docs/formats.md).

**Conséquence proposée.** Une expression discontinue ou un groupe source→groupe français doit pouvoir rester une relation sémantique explicite. Le choix d’un mot cliquable pour le lecteur est une projection d’affichage distincte. Interdire tout chevauchement peut être une règle d’affichage prudente ; ce n’est pas une loi générale de traduction. Une absence de lien ne distingue pas à elle seule omission réelle, expression grammaticale et travail inachevé.

Le dépôt publie des alignements bibliques automatiques et déclarés manuels. Cette déclaration n’assure ni l’intégrité d’une version donnée ni son indépendance de nos sources. [Dépôt Alignments](https://github.com/Clear-Bible/Alignments). L’inspection française ci-dessous le montre concrètement.

### 6. MACULA : ajouter le contexte linguistique source

**Établi.** MACULA grec contient morphologie, arbres syntaxiques, gloses anglaises, sens et rôles sémantiques ; MACULA hébreu rassemble WLC, morphologie, syntaxe, sens et gloses. Les sources et leurs droits sont distingués dans les dépôts. [MACULA Greek](https://github.com/Clear-Bible/macula-greek), [MACULA Hebrew](https://github.com/Clear-Bible/macula-hebrew).

**Hypothèse pour nous.** Les voisins source et leurs fonctions pourraient départager deux traductions françaises proches qui apparaissent dans le même verset. Commencer avec le contexte STEP déjà disponible permet d’isoler cet effet avant d’ajouter une source. MACULA nécessiterait une correspondance explicite entre éditions, versification, tokens et morphèmes ; l’égalité du numéro Strong ne suffit pas à joindre deux occurrences.

## Vérification du corpus français Clear Bible

Lecture des fichiers publics en mémoire, sans import dans nos données. Révision inspectée : `c99bd0ae6946775f932517656308ca19fc706921`.

Les [métadonnées NT LSG](https://github.com/Clear-Bible/Alignments/blob/c99bd0ae6946775f932517656308ca19fc706921/data/fra/alignments/LSG/SBLGNT-LSG-manual.toml) déclarent Louis Segond 1910, une origine manuelle, l’équipe Biblica et CC BY 4.0 pour les alignements. L’historique consulté fournit un ajout au 18 juillet 2024, sans explication établissant l’indépendance de Concordances et Traductions de la Bible ou de STEP. Cette indépendance reste **inconnue**.

Comptage direct du [JSON NT](https://github.com/Clear-Bible/Alignments/blob/c99bd0ae6946775f932517656308ca19fc706921/data/fra/alignments/LSG/SBLGNT-LSG-manual.json) et des [tokens français NT](https://github.com/Clear-Bible/Alignments/blob/c99bd0ae6946775f932517656308ca19fc706921/data/fra/targets/LSG/nt_LSG.tsv) :

| Mesure                                                      | Résultat |
| ----------------------------------------------------------- | -------: |
| Relations                                                   |  104 807 |
| Références distinctes de versets présentes dans les cibles  |    7 936 |
| Relations une occurrence→un token                           |  104 807 |
| Tokens du fichier cible                                     |  210 628 |
| Références cible de relations absentes du fichier de tokens |      996 |

Les deux relations suivantes sont directement incompatibles avec la lecture des fichiers associés en Matthieu 1.1 :

| Relation JSON                  | Source dans SBLGNT.tsv  | Cible dans nt_LSG.tsv |
| ------------------------------ | ----------------------- | --------------------- |
| `n40001001005` → `40001001005` | υἱοῦ, G5207, « son »    | Christ                |
| `n40001001006` → `40001001007` | Δαυὶδ, G1138, « David » | fils                  |

Les valeurs source ont été vérifiées dans le [TSV source épinglé](https://github.com/Clear-Bible/Alignments/blob/c99bd0ae6946775f932517656308ca19fc706921/data/sources/SBLGNT.tsv), ainsi que dans sa version au commit d’ajout français `bb901b7684b81b6bde50362f288bb76e2135097a` : ces positions y étaient déjà identiques. La cause exacte du décalage n’est pas établie. Il serait donc erroné d’attribuer sans preuve le problème à une modification récente de source.

Pour l’AT, le [fichier cible](https://github.com/Clear-Bible/Alignments/blob/c99bd0ae6946775f932517656308ca19fc706921/data/fra/targets/LSG/ot_LSG.tsv) ne contient que son en-tête. Le [TOML associé](https://github.com/Clear-Bible/Alignments/blob/c99bd0ae6946775f932517656308ca19fc706921/data/fra/alignments/LSG/WLCM-LSG-manual.toml) annonce LSG mais conserve l’identifiant `WLCM-IRVHin-manual`. Ces fichiers ne constituent pas un nouveau gold utilisable en l’état.

Empreintes des deux fichiers NT comptés :

- Alignements : `7b5f373c897198399325dce578f6834273e0b70284454ca51f658a294943a972`.
- Tokens cible : `77fba8cbf73678d1288436c038f6d4c98839049c5174d125ba68795360d95a89`.

## Quatre expériences proposées

| Expérience                                   | Comparaison contrôlée                                                                                                                                                                                                                                                 | Ce qui déciderait de son intérêt                                                                                                                                           |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Audit d’alignement et d’affichage**     | Sur un lot annoté à l’aveugle, distinguer occurrence exacte, équivalence de groupe, morphologie, absence réelle et abstention. Conserver séparément le score de reproduction du CSV et l’acceptabilité linguistique. Inclure répétitions et expressions discontinues. | Part des erreurs imputables au modèle, aux candidats, au gold ou à la projection d’affichage ; accord entre annotateurs, sans modifier le gold après avoir vu les sorties. |
| **2. Aligneur statistique de corpus**        | Fast_align et eflomal sur les mêmes paires source/français : surfaces, puis lemmes/Strong ; avec et sans a priori tirés des références autorisées. Comparer à nos méthodes existantes, pas seulement à JEV.                                                           | Rappel de candidats nouveaux et précision à couverture égale ; qualité des occurrences répétées ; stabilité sur plusieurs exécutions.                                      |
| **3. Projection contextuelle par pivot**     | SimAlign anglais→français sur une vraie traduction anglaise alignée aux sources, contre transfert actuel ; comparer ensuite au chemin direct ancien→français et, seulement si utile, à awesome-align adapté.                                                          | Gains lorsque le bon candidat manquait ; erreurs introduites par composition ; performances séparées AT/NT et poésie/prose.                                                |
| **4. Contexte source et décision conjointe** | Même liste de candidats : gloses isolées versus contexte des voisins STEP ; même score : choix indépendants versus résolution conjointe des occurrences avec groupes et NULL. Tester MACULA dans une seconde ablation.                                                | Réduction des échanges entre synonymes et occurrences, sans sacrifier les groupes légitimes ; précision à couverture égale et coût de revue.                               |

Pour ces expériences, réserver des chapitres ou livres entiers à l’évaluation, avec la même séparation dans toutes les traductions. Le transfert de références à l’inférence et les familles interdites doivent être déclarés séparément. Un entraînement non supervisé sur tous les textes, y compris les versets test sans leurs étiquettes, serait un protocole **transductif** : intéressant, mais à présenter séparément du test sur chapitres absents de l’entraînement. Éviter de traiter trois traductions des mêmes passages comme trois observations bibliques indépendantes.

Le critère principal proposé est la précision des liens acceptés à couverture donnée, accompagnée du rappel de candidats et d’une mesure des groupes/occurrences. Les seuils seraient choisis sur calibration, puis gelés. Un score élevé, un consensus entre modèles ou une structure valide restent des indices ; aucune de ces propriétés ne remplace une référence sémantique auditée.

Cette recherche ne conclut pas qu’un de ces outils bat notre pipeline. Elle établit des méthodes et données vérifiables qui méritent une expérience contrôlée, et identifie déjà un corpus externe qu’il ne faut pas adopter sans correction et clarification de provenance.
