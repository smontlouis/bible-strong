# Comparatif JEV / Laya pour les placements Strong

Date : 1er octobre 2026. Expérience locale, sans application en production.

**Limite découverte ensuite :** la préparation historique utilisant `stripTags`
conserve le contenu des notes éditoriales Darby/DarbyR. Ce rapport reste une
comparaison sur ses entrées archivées ; ce n’est pas une évaluation corrigée du
seul texte de lecture. Le [protocole d’arbitrage ultérieur](./strong-arbitration-experiment-2026-10-01.md)
retire les notes avant tokenisation, apprentissage et extraction des balises attendues.

**JEV est nettement meilleur que le checkpoint Laya multilingue testé pour
départager nos candidats Strong.** Laya est rapide et répétable, mais sa précision
et sa sensibilité à l'ordre des choix empêchent de lui confier ces décisions en
l'état. JEV apporte un gain mesurable, sans atteindre encore notre objectif de
fiabilité pour une application automatique.

## Échantillon et méthode

- 200 passages bibliques répartis sur les livres, chacun dans Sg1910, Darby et
  DarbyR : 600 textes de versets, et non 600 passages indépendants.
- Génération canonique avec annotations de la référence masquées, famille
  éditoriale évaluée exclue et corrections éditoriales désactivées.
- Jusqu'à 200 décisions résiduelles par édition : 600 requêtes identiques pour
  chaque modèle, portant sur les mêmes candidats lexicaux munis de preuves STEP.
- Les modèles voient le verset français, les positions des mots, le terme
  original et sa glose, quelques indices lexicaux français et les choix bornés.
  Ils ne voient ni l'annotation attendue, ni les réponses de l'autre modèle.
- Les instructions sont en anglais et le texte biblique en français. Cette
  expérience porte sur cette formulation et ces choix, sans adaptation du modèle.
- Aucune troncature de contexte, d'instructions ou de choix sur les 600 requêtes.
- 599 paires exploitables. Une réponse JEV incohérente a été rejetée : son choix
  annonçait une probabilité de 0,30 alors qu'une autre option avait 0,31.
- Séparation par chapitre, commune aux trois éditions : 113 décisions de
  calibration et 486 de test. Parmi ces dernières, 405 possèdent une occurrence
  unique dans STEP et dans la référence, permettant d'évaluer un choix sans
  ambiguïté d'appariement. Les occurrences multiples restent prises en compte
  dans les mesures de reconstruction.

La bonne réponse visible est disponible dans les candidats pour seulement
261 des 390 cas de test évaluables ayant une cible visible attendue (66,9 %).
Lorsque la référence possède une cible hors de la liste, le choix attendu est
UNSURE. L'absence d'un Strong dans la référence n'est jamais assimilée à NONE.
Une partie importante du travail restant concerne donc la proposition des
candidats, avant même leur classement par un modèle.

## Résultats

| Mesure                                                      | Laya multilingue MLX | JEV via AI Gateway |
| ----------------------------------------------------------- | -------------------: | -----------------: |
| Choix conformes à la référence, abstention correcte incluse |    73 / 405 (18,0 %) | 284 / 405 (70,1 %) |
| Décisions prises avec probabilité ≥ 0,95                    |                   24 |                110 |
| Décisions correctes dans ce groupe                          |      9 / 24 (37,5 %) | 102 / 110 (92,7 %) |
| Changements de choix après inversion des options            |             35 / 100 |            3 / 100 |
| Changements de choix sur requête identique répétée          |              0 / 100 |            1 / 100 |
| Latence médiane observée, hors chargement                   |              27,1 ms |           296,1 ms |

Les lignes au seuil de 0,95 comparent deux groupes de tailles différentes et des
probabilités non recalibrées sur notre domaine ; elles ne constituent pas une
comparaison à couverture égale. Le champ `confidence` des fournisseurs n'est pas
utilisé comme probabilité de justesse. Laya reproduit exactement ses distributions
sur les 100 répétitions identiques ; l'inversion des options révèle un autre
problème, distinct de la reproductibilité numérique.

Sur les 405 cas appariés, JEV seul est conforme à la référence 221 fois, Laya
seul 10 fois ; les deux sont conformes 63 fois et en désaccord avec la réponse
attendue 111 fois. Leur accord ne constitue pas une preuve : 39 de leurs
102 réponses identiques sont en désaccord avec la référence.

La simulation de reconstruction applique les choix aux annotations correspondantes
et bloque les nouveaux chevauchements. UNSURE conserve le placement initial ;
NONE peut retirer un placement visible sans inventer d'ancrage vide. Il ne s'agit
pas du chemin d'application de production, qui conserve ses exigences de
consensus et de preuve lexicale.

Sur les 474 textes de versets du groupe de test :

| Variante                          | Précision des placements visibles |  Rappel |      F1 |
| --------------------------------- | --------------------------------: | ------: | ------: |
| Moteur déterministe seul          |                           90,47 % | 78,25 % | 83,92 % |
| Moteur + Laya, probabilité ≥ 0,95 |                           90,40 % | 78,39 % | 83,97 % |
| Moteur + JEV, probabilité ≥ 0,95  |                           90,58 % | 79,77 % | 84,83 % |

JEV améliore le F1 dans chacune des trois éditions : Sg1910 de 85,56 à 86,14 %,
Darby de 83,40 à 84,48 %, DarbyR de 82,84 à 83,92 %. Sans seuil, son F1 global
atteint 85,61 %, mais sa précision baisse à 90,32 %. Maximiser le F1 ne suffit
donc pas à décider d'une promotion en production.

Le critère de calibration fixé avant lecture des résultats — au moins 30
décisions et 98 % de conformité observée — n'est atteint par aucun modèle sur
le groupe de calibration. Aucun seuil de production n'est retenu. Un échantillon
plus grand et une vérification éditoriale sont nécessaires pour estimer une
précision élevée avec une incertitude raisonnable.

## Audit qualitatif

Quelques désaccords ont été examinés directement dans les sources, sans modifier
les étiquettes ni les scores du test :

- Amos 5.15, Sg1910, H2603 : JEV choisit « pitié » avec 0,97, comme la
  référence ; Laya choisit « porte » avec 0,3425.
- 1 Rois 11.18, Sg1910, H3899 : JEV relie la glose de nourriture à
  « subsistance » avec 0,97 ; Laya choisit NONE.
- Proverbes 4.2, Sg1910, H3948 : JEV choisit « enseignement » avec 1,00,
  alors que la référence place H3948 sur « conseils » et H8451 sur
  « enseignement ». Une glose isolée ne suffit pas à distinguer ces deux
  expressions voisines ; le contexte des occurrences originales manque ici.
- Jérémie 4.5, Sg1910, H0622 : la référence annote « Rassemblez-vous », mais
  le générateur ne propose que « publiez ». JEV s'abstient correctement. Un
  meilleur classement ne peut pas réparer à lui seul cette omission de candidat.
- Josué 4.24, Sg1910, H3117 : la source CSV place le Strong sur `l’` devant
  « Éternel », tandis que JEV choisit « toujours ». Cette anomalie apparente
  de la référence mérite un audit éditorial. Le score reste calculé contre
  l'annotation existante, sans correction opportuniste du test.

Ce sont des observations techniques, pas une validation humaine ou philologique
du corpus. Les accords avec les références mesurent une convention éditoriale
imparfaite, et non une vérité sémantique absolue.

## Coût, environnement et provenance

- Machine : Apple M4 Pro, macOS 26.3.1, Python 3.11.1.
- Laya : `laya-mlx==0.2.0`, `mlx==0.32.3`, FP16, GPU, une question par lot.
- Poids : `aac6fef/laya-multilingual-mlx`, révision
  `f2b4faf51023039425946074e2cf1361d2db11d5`.
- JEV : alias `typesafe-ai/jev`, via l'endpoint d'évaluation Vercel ; routage
  effectif `typesafe-ai`. L'alias ne fournit pas ici une révision immuable.
- Coût rapporté par la passerelle : 0,016945 USD pour les 600 requêtes
  principales, 0,022595 USD en incluant les 200 requêtes de stabilité. Le petit
  essai préalable de connexion est séparé. Aucun appel génératif n'a été utilisé.
- Le timing principal a coexisté avec des vérifications du dépôt ; ces latences
  donnent un ordre de grandeur, pas un benchmark matériel isolé.
- Base Git : `5947a52322dca169302b698cb669fa1a2722d7cd`, avec les scripts de
  cette expérience et l'export explicite du générateur à dictionnaire fixé.

Le générateur par défaut refuse actuellement
`data/dictionaries/strong_lexicon.full.production.sqlite` avec
`unattested-v3-carrier-database`. Le pointeur attendu
`data/dictionaries/lexicon-v3-fr/current.json` est absent. Le benchmark utilise
explicitement `data/dictionaries/strong_lexicon.en-fr.full.production.sqlite`,
lisible avec les contrôles stricts du format legacy. Le dictionnaire est commun
aux trois variantes et fait partie de l'empreinte d'entrée. Les chiffres ne
valident ni le dictionnaire par défaut ni une génération de production actuelle.
Aucun contrôle n'a été désactivé et aucun pointeur de production n'a été changé.

## Décision proposée

Poursuivre avec JEV comme évaluateur de candidats en préparation hors ligne,
avec archivage des requêtes, réponses, versions et décisions validées. Le rendu
final peut ainsi être reconstruit à partir d'artefacts figés.

Ne pas intégrer ce checkpoint Laya sans adaptation dans la chaîne de décision,
ni considérer l'accord JEV/Laya comme une validation suffisante. Laya peut rester
un candidat pour une future expérience spécialisée, évaluée séparément.

Avant toute promotion : résoudre le dictionnaire de production, améliorer la
couverture des candidats et fournir un contexte original local autour de
l'occurrence, puis évaluer ces changements sur de nouveaux chapitres. Toute
adaptation des seuils doit rester séparée du prochain jeu de test.

## Artefacts et vérification

- [Scripts et reproduction](../scripts/strong-decision-benchmark/README.md).
- [Rapport généré](../outputs/strong-decision-benchmark/pilot-v1/report.md).
- [Mesures détaillées](../outputs/strong-decision-benchmark/pilot-v1/summary.json).
- [Désaccords et réponses brutes](../outputs/strong-decision-benchmark/pilot-v1/disagreements.json).

Les fichiers `outputs/` sont locaux et ignorés par Git. Les dépendances Python
sont figées dans le fichier `requirements.txt` de l'expérience ; Yarn et son
lockfile n'ont pas été modifiés.

Validation : 37 tests ciblés Strong/benchmark et 3 tests Python passent ;
typecheck du workspace réussi. Les contrôles globaux du workspace ne sont pas
verts : lint historique (variables non utilisées et globals non configurés),
build bloqué par des imports `scripts/` hors du `rootDir`, et tests lexicon V3
en échec sur des empreintes de sources ou artefacts locaux manquants. Les trois
fichiers JavaScript suivis que le build avait réémis ont été restaurés. Ces
problèmes ne sont pas corrigés dans cette expérience.
