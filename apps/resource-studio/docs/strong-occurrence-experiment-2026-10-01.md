# Occurrences source, identités Strong et porteurs français

Le prototype confirme l'intérêt de séparer **occurrence source**, **relation de
traduction** et **numéro/porteur affiché**. Il invalide deux raccourcis : considérer
toute alternative STEP comme un synonyme, et garder systématiquement le numéro
principal de STEP. Les deux projections testées font moins bien que le rejeu
archivé sur les références exactes. Aucune n'est intégrée au générateur.

Le résultat le plus utile est structurel : des identités non placées correspondent
à une occurrence déjà représentée, et certains « alias » couvrent plusieurs mots.
Ce problème précède le choix d'un meilleur modèle de score.

## Périmètre et reproductibilité

- Les mêmes **240 références, 720 textes d'édition** (Sg1910, Darby, DarbyR),
  débarrassés des notes d'éditeur, et les mêmes **900 décisions échantillonnées**.
- Réponses JEV `context` archivées ; seuil **0,95** hérité de l'expérience précédente.
  Aucun nouvel appel, aucune moyenne de probabilités entre questions différentes.
- Empreintes des sources, requêtes, réponses et données vérifiées. Prédictions
  enregistrées avant lecture des labels. Rejeu double identique, entrées immuables.
- Les **100 références de réserve** ne sont ni évaluées ni annotées. Les chapitres
  de test actuels ont déjà été examinés : comparaison exploratoire, non aveugle.
- La métrique historique reste l'égalité du **numéro Strong et des frontières**.
  Les désaccords sémantiques ne sont pas requalifiés en succès après coup.

Code et commandes : [README du prototype](../scripts/strong-occurrence-prototype/README.md).
Résultats : [summary.json](../outputs/strong-occurrence-prototype/v1-verified/summary.json),
[manifest.json](../outputs/strong-occurrence-prototype/v1-verified/manifest.json),
[changes.json](../outputs/strong-occurrence-prototype/v1-verified/changes.json).
Le premier répertoire `v1` est conservé ; le rejeu vérifié reproduit exactement
ses prédictions et ajoute la vérification de types et les preuves du lexique.

## Ce que le modèle distingue

Les **3 595 occurrences logiques Strong** d'une édition correspondent à
**3 416 lignes source distinctes**. Parmi elles, **172 portent plusieurs identités**.
Une ligne STEP reste une unité de provenance : elle peut elle-même contenir des
lectures concurrentes. Le prototype ne prétend pas reconstruire tout le graphe
des manuscrits à partir de son seul identifiant.

Les colonnes originales restent disponibles avec fichier et numéro de ligne.
Une répétition à deux positions donne deux unités. Les alternatives de tagging
sont des ensembles de codes, pas une liste de nouveaux mots à traduire. Une
relation peut associer plusieurs unités source à plusieurs mots français,
y compris discontinus, sans imposer un numéro d'affichage.

L'audit complémentaire du **TBESG local** répartit les 172 groupes ainsi :

| Preuve disponible                           | Groupes source |
| ------------------------------------------- | -------------: |
| Famille de formes ou de graphies documentée |             76 |
| Variante de lecture à conserver distincte   |             22 |
| Décomposition explicitement documentée      |              3 |
| Relation non résolue                        |             71 |

Exemples vérifiés dans les métadonnées du lexique :

- **G2258 → G1510** et **G1700 → G1473** : formes documentées. Cela ne choisit
  toujours pas la convention de numérotation de l'édition française.
- **G3363 = G2443 + G3361** : combinaison. Dans Apocalypse 20.3, les deux composants
  sont présents sur deux lignes consécutives. Dans Jean 11.50 et 2 Corinthiens
  11.7, la simple présence de G3363 dans les alternatives ne suffit pas à retrouver
  ce groupe complet. L'hypothèse reste non résolue dans ces deux passages.
- **G0846 / G3778** : correspondance locale dans STEP, sans preuve TBESG d'une
  même famille de formes. Ne pas en déduire une synonymie globale.
- **G4275** : libellé « Combination » vers G4308, sans expression de composants.
  Le parseur n'invente pas une décomposition à partir de ce seul mot.

Sources : [en-tête TAGNT](../data/external/stepbible/amalgamated/TAGNT%20Mat-Jhn.txt),
[TBESG](../data/external/stepbible/TBESG.txt), et
[preuves extraites avec lignes](../outputs/strong-occurrence-prototype/v1-verified/identity-evidence.json).
Cet audit enrichit le modèle après le premier rejeu ; il ne modifie pas les
règles expérimentales pour améliorer rétrospectivement leur résultat.

## Doublons et « manquants »

Sur les trois éditions, les 172 groupes donnent **516 groupes d'édition** :

- **45** ont plusieurs porteurs visibles ; **20** ont exactement les mêmes frontières.
- **387 identités** n'ont aucun porteur alors qu'une autre identité de leur ligne
  source est déjà placée. Parmi elles, **183** appartiennent à une famille de
  formes/graphies documentée ; les autres comprennent des variantes et des cas
  non résolus. Ce ne sont donc pas 387 erreurs démontrées.
- **62 des 900 cas échantillonnés**, classés « manquants », concernent une ligne
  déjà placée ; **31** ont une famille de formes/graphies documentée. Le nombre
  de Strong non placés surestime ainsi le nombre de mots source sans relation,
  sans nous dire si les placements existants sont sémantiquement corrects.

Voir [l'audit des placements par unité source](../outputs/strong-occurrence-prototype/v1-verified/ownership-audit.json).

## Comparaison des projections

Le contrôle `archive` reprend les placements JEV de l'expérience précédente.
`guard` réunit les propositions concordantes d'une ligne comportant un seul
code alternatif, conserve l'identité déjà placée et diffère les nouvelles
identités non résolues. Une identité existante peut néanmoins changer de porteur.
`primary` ajoute le choix du numéro principal STEP et la suppression des doublons
de frontières identiques. Les variantes déclarées, listes ambiguës et racines
hébraïques alternatives restent hors de cette transformation.

La forme « un code principal + un alternatif » est ici une **hypothèse testée**,
pas un critère d'équivalence validé. L'exemple G3363 en montre la limite.

Résultats sur les **128 références de test × 3 éditions** :

| Projection             |    TP |  FP |    FN | F1 exact | Porteurs auparavant corrects perdus |
| ---------------------- | ----: | --: | ----: | -------: | ----------------------------------: |
| Générateur de départ   | 4 179 | 426 | 1 132 | 84,288 % |                                   — |
| Arbitrage archivé      | 4 232 | 428 | 1 079 | 84,886 % |                                   0 |
| Regroupement `guard`   | 4 228 | 427 | 1 083 | 84,848 % |                                   2 |
| Regroupement `primary` | 4 225 | 429 | 1 086 | 84,797 % |                                   8 |

Précision des ajouts/déplacements : **53/59** pour le contrôle, **51/56** pour
`guard`, **54/61** pour `primary`. Les suppressions sont comptées séparément.
`primary` retire six annotations de test attendues par le CSV. Avec les quatre
de calibration, ses **dix suppressions de doublons** retirent toutes un numéro
attendu. La relation française peut rester au bon endroit, mais le code conservé
n'est pas celui de la référence : dédupliquer ne règle pas la convention d'identité.

Sur la calibration, `guard` obtient **51/57 = 89,47 %** de modifications exactes
et **+3 FP** ; `primary`, **55/64 = 85,94 %**, **+6 FP**, et quatre porteurs corrects
perdus. Aucune politique ne satisfait la porte précédente : au moins 30
modifications, 98 % de précision observée, sans hausse des faux positifs.

Deux régressions de `guard` expliquent pourquoi conserver le numéro ne suffit pas :

- **1 Corinthiens 10.5, Sg1910** : un choix archivé pour G3778 fait passer le
  porteur G0846 de « eux » à « eux ne ». Le mot de négation n'appartient pas au pronom.
- **Apocalypse 20.3, Sg1910** : un choix pour le composé G3363 élargit G2443 de
  « afin » à « afin qu'il ». Une décision prise pour une autre identité ne valide
  ni le même périmètre source ni la même frontière éditoriale.

## Inspection ciblée de 15 passages

Inspection effectuée par l'assistant, après observation des sorties. **Ce n'est
pas une annotation indépendante ni un nouveau gold.** Les relations restent des
propositions ; l'absence discutée reste non résolue. Aucun label n'a été changé.

| Passage / édition           | Constat principal                                                                |
| --------------------------- | -------------------------------------------------------------------------------- |
| Luc 4.33 / Darby            | Bon « avait », identité G2258/G1510 à décider séparément                         |
| Actes 2.31 / DarbyR         | Bon « prévoyant », G4308 n'est pas le code G4275 du CSV                          |
| Actes 8.2 / DarbyR          | Bon « lui », correspondance locale G0846/G3778 non globale                       |
| Ecclésiaste 9.10 / Sg1910   | Expression « séjour des morts », porteur CSV « morts »                           |
| Romains 8.32 / Sg1910       | Construction « Lui, qui », porteur CSV « Lui »                                   |
| 1 Chroniques 26.26 / DarbyR | Relation « responsables de », porteur « responsables »                           |
| Matthieu 26.40 / Sg1910     | Un « moi » ; choisir G1473 supprime le G1700 attendu                             |
| Jean 2.4 / Sg1910           | Deux pronoms distincts ; doublon exact et frontières concurrentes                |
| Luc 14.5 / Sg1910           | « fils » et « âne » sont des lectures concurrentes                               |
| Luc 7.41 / Sg1910           | Une occurrence, trois numéros, décisions archivées divergentes                   |
| Jonas 3.3 / Sg1910          | La source de « alla » réutilisée sur « marche » ; une autre source H4109 existe  |
| Genèse 40.21 / Sg1910       | Deux occurrences H4945 légitimes, à conserver distinctes                         |
| Nombres 7.89 / Sg1910       | Marqueur d'objet : absence lexicale plausible, fonction grammaticale persistante |
| Genèse 2.24 / Sg1910        | Deux mots source forment la relation « C'est pourquoi »                          |
| Apocalypse 20.3 / Sg1910    | G3363 couvre potentiellement deux occurrences, dont la négation                  |

[Dossier complet : texte, sources, propositions et raisons](../outputs/strong-occurrence-prototype/v1-verified/review-15.json).

## Conséquence pour le système

Le critère « plus petite expression exprimant le sens lexical » peut servir à
proposer une relation. Il ne suffit pas à choisir simultanément les lectures
source, les numéros et les porteurs. Les cas d'Ecclésiaste, Romains et Chroniques
montrent des divergences éditoriales qui ne sont pas résolues par un meilleur score.

La prochaine implémentation devrait donc commencer par une **politique d'identité
explicite pour chaque édition**, avec conservation des identifiants établis et
abstention documentée lorsque l'identité ou la lecture manque. Elle doit utiliser
les preuves lexicales et les compositions, protéger les porteurs existants contre
le transfert implicite d'une décision d'alias, et proposer séparément les relations
et leur projection d'affichage. Le présent prototype ne résout pas cette politique
par des règles apprises sur les CSV de test.

L'évaluation doit distinguer fidélité du numéro, relation source-traduction,
frontières d'affichage et absence explicite. Le dossier des 15 passages rend ces
choix concrets ; les revues indépendantes du corpus sémantique restent à faire.

Validation : **26 tests** du prototype et du banc d'arbitrage réussis, vérification
TypeScript stricte des scripts, lint et typecheck du workspace Resource Studio.
Les prédictions vérifiées reproduisent le premier essai à l'identique. Aucun
générateur de production, paramètre de publication ou jeu de réserve n'a changé.
