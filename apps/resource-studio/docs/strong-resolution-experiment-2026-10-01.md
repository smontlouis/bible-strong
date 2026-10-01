# Résoudre les occurrences, y compris les Strong vides

Les trois hypothèses du [goal](./strong-resolution-goal-2026-10-01.md) ont été
testées : séparer les preuves d'absence et d'ancrage, ancrer à partir des témoins,
puis contrôler par l'ordre source. Le résultat utile livré au générateur est une
provenance explicite des vides. Les nouvelles politiques d'ancrage restent des
propositions auditables ; leurs résultats ne justifient pas un nouveau défaut
automatique. Aucun score distant ni nouvelle annotation sémantique n'a été utilisé.

## Changement concret dans le générateur

Un vide généré porte maintenant `emptyEvidence`, avec deux parties indépendantes :

- **Absence** : `unresolved` si le passage complet n'a trouvé aucun porteur ;
  `witness-supported` si des familles de témoins possèdent explicitement un vide.
  Ce second état décrit un appui documentaire, pas une absence établie dans la cible.
- **Ancrage** : `heuristic`, avec la méthode, l'indice d'insertion et sa limite.
  Les deux méthodes existantes sont la proportion de longueur des témoins et le
  repli sur les placements d'occurrences source antérieures.

Ces données passent dans les annotations du ledger et son stockage SQLite. Elles
sont effacées lorsqu'un vide reçoit un porteur lexical ou est absorbé comme
doublon d'une occurrence déjà placée. L'empreinte du pipeline inclut le nouveau
module. Les anciens ledgers nécessitent une régénération pour recevoir ces champs.
Les placements rendus, les règles de visibilité et les anciens scores numériques
restent identiques ; ces scores ne deviennent pas des probabilités d'absence.

Le module [strongResolution.ts](../src/strongResolution.ts) représente séparément :

1. une relation visible existante, avec l'assurance limitée `existing-generator` ;
2. une décision revue, visible ou vide, liée au texte cible exact, à la référence
   et à l'identité/provenance source par empreintes ;
3. une occurrence non résolue, avec les raisons et les indices disponibles.

Une absence revue reste établie même si son ancrage est incertain. À l'inverse,
un ancrage géométriquement unique n'établit jamais l'absence. Les tests couvrent
les deux directions. Valider le contrat d'une revue ne vérifie pas le jugement
philologique du réviseur ; aucune revue fictive n'a été ajoutée au corpus.

## Expérience locale

**720 textes, 240 références, 10 248 unités source d'édition.** Le corpus est
celui déjà exploré, nettoyé des notes d'éditeur. Les 100 références de réserve
sont exclues. Les décisions sont figées avant les mesures sur les labels cible,
rejouées identiquement et liées aux empreintes des entrées et du code.

La Bible cible et sa famille éditoriale sont exclues des témoins de chaque
prédiction. Darby et DarbyR représentent une seule famille : dans cette évaluation
masquée, il reste donc **une seule famille indépendante**, pas deux. Le contrôle
par ratio compare une formule d'ancrage sur les cas proposés ; il ne simule pas
une activation de la règle de production exigeant deux familles.

Le diagnostic conserve **8 195 unités avec porteur visible existant** et signale
**2 053 unités non résolues** :

| Motif principal                                          | Unités d'édition |
| -------------------------------------------------------- | ---------------: |
| Pas de porteur ; aucune preuve suffisante d'absence      |            1 699 |
| Vide dans les témoins, absence dans la cible non établie |              108 |
| Plusieurs porteurs existants concurrents                 |               24 |
| Lecture source non résolue                               |              222 |

**99 textes** couvrent toutes leurs unités avec les porteurs existants selon ce
diagnostic structurel. **Zéro texte est déclaré intégralement revu sémantiquement** :
la couverture ne constitue pas une mesure de certitude. Aucune nouvelle absence
n'est certifiée automatiquement dans ce cycle.

## Un vide témoin n'est pas automatiquement un vide cible

Le sous-ensemble testable de propositions exige un seul code source, une occurrence
identifiable, aucun porteur visible déjà présent et un tag explicitement vide dans
un témoin. Il comporte **42 propositions** :

- **23** sont également vides dans les annotations cible ;
- **19** ont un porteur visible dans les annotations cible.

Les 19 contradictions suffisent à rejeter la règle naïve « vide témoin + aucun
placement trouvé = absence certaine ». Ce sont des accords/désaccords éditoriaux
sur un petit échantillon sélectionné, pas une estimation générale de la précision
sémantique des vides.

Exemple concret : **Lévitique 22.12, Darby, H3588**. Darby dit « **si** elle est
[mariée] à un étranger », tandis que LSG dit « mariée à un étranger ». Le Strong
vide de LSG ne doit pas effacer la réalisation explicite dans Darby. Le résolveur
conserve l'incertitude tant que le porteur cible n'a pas été établi.

**2 Pierre 1.20, LSG, G1096** fournit un autre contraste : « ne peut **être** un
objet d'interprétation particulière » face à « ne s'interprète elle-même » dans
les Darby. Le statut d'un même élément dépend bien de la traduction cible.

## Les ancrages donnent souvent une zone plutôt qu'un point

Chaque témoin cherche des porteurs Strong voisins identifiables dans la cible.
La borne gauche est après le porteur précédent ; la borne droite est avant le
suivant. Répétitions sans correspondance d'occurrence, voisins réordonnés,
identités concurrentes et désaccords restent explicites. Les éditions Darby ne
sont pas comptées comme deux confirmations indépendantes.

Sur les **10 propositions explicitement vides du sous-ensemble test** :

| Méthode                     | Points proposés | Points identiques à la référence | Intervalles produits | Intervalles contenant l'ancre de référence | Largeur moyenne en positions |
| --------------------------- | --------------: | -------------------------------: | -------------------: | -----------------------------------------: | ---------------------------: |
| Ratio des longueurs         |              10 |                                2 |                   10 |                                          2 |                          1,0 |
| Voisins dans les témoins    |               2 |                                0 |                   10 |                                          7 |                          3,9 |
| Voisins dans la source      |               4 |                                1 |                    9 |                                          6 |                         1,78 |
| Intersection témoins/source |               2 |                                0 |                    7 |                                          5 |                          2,0 |

Sur les **13 cas de calibration**, les intervalles des témoins contiennent l'ancre
de référence dans 12 cas, ceux de l'intersection dans 11 cas sur 12 intervalles
produits. Aucun de ces deux procédés ne propose de point unique sur ces 13 cas.
Le ratio donne quatre points exacts sur treize.

Ces colonnes ne sont pas interchangeables : une zone de quatre positions est
moins précise qu'un point. Une différence avec l'ancre CSV n'est pas, à elle seule,
une erreur sémantique. Aucun gain de placement automatique n'est revendiqué.

Exemples auditables :

- **Genèse 44.15, LSG, H2088** : le ratio propose après le mot 5. Témoins et source
  situent le vide entre les porteurs H4639 (« action ») et H6213 (« faite »),
  soit après le mot 4 ou 5. La référence choisit 4. La proposition conserve les
  deux positions possibles et leurs voisins au lieu de prétendre avoir tranché.
- **Lévitique 17.10, LSG, H0834** : les témoins donnent l'intervalle 13–19 ; l'ordre
  source le réduit à 13–14. La référence choisit 14. Cette réduction est utile
  pour la revue, sans convertir l'appui des témoins en preuve d'absence.
- **Deutéronome 22.2, LSG, H8432** : les témoins donnent 16–19 ; la source réduit
  à 18–19. La référence choisit 18. La limite restante est explicitement visible.

## Bilan du goal borné

La séparation des preuves est intégrée au générateur et persiste dans le ledger.
Le résolveur et le banc local permettent de vérifier les trois états et de fournir
des propositions d'ancrage expliquées. Les trois hypothèses ont été examinées ;
aucune règle nouvelle d'absence ou d'ancrage automatique n'est promue.

La limite restante est identifiée : nous n'avons pas encore de référence
indépendante validant les absences et les ancrages sémantiques de ces textes.
Le dossier actuel expose les décisions à examiner et leur provenance, sans
assimiler ce manque de validation à des absences certaines. Ce résultat clôt
l'expérience bornée ; il ne prétend pas avoir certifié une Bible entière.

Validation : **73 tests ciblés**, dont les alignements lecteur/complet, les
occurrences répétées, les conflits d'ancrage, les revues périmées, le nettoyage des
preuves après remplacement et la persistance SQLite. Typecheck du workspace,
TypeScript strict du runner et lint des fichiers concernés.

[Commandes et protocole reproductible](../scripts/strong-resolution-benchmark/README.md) ·
[Résultats](../outputs/strong-resolution-benchmark/v1-verified/summary.json) ·
[Toutes les propositions et leurs preuves](../outputs/strong-resolution-benchmark/v1-verified/empty-proposals-for-audit.json) ·
[Décisions par verset](../outputs/strong-resolution-benchmark/v1-verified/predictions.json)
