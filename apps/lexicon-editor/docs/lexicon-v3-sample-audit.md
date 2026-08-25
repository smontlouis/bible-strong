# Audit de 100 candidats hébreux Lexicon V3

Audit initial : 2026-07-12  
Politique de source mise à jour : 2026-07-13

## Portée

L'échantillon est constitué des 100 premières entrées hébraïques
`review_needed`, triées sur `entryKey` avec une collation binaire. Il cible donc
volontairement les cas difficiles du début du lexique ; ce n'est pas un tirage
aléatoire et ses pourcentages ne doivent pas être extrapolés à tout le corpus.

Trois revues indépendantes ont couvert respectivement 34, 33 et 33 entrées. La
comparaison portait sur l'identité STEP exacte, le suffixe, la morphologie, le
gloss, le Meaning TBESH brut, la corroboration indépendante
OpenScriptures/TIPNR, LexicalIndex/BDB et les relations directes ou transitives.

Le propriétaire du projet a confirmé le 2026-07-13 les droits de réutilisation,
d'affichage et de traduction du Meaning TBESH. `StepEntries.meaning` est donc le
contenu canonique primaire ; les résultats chiffrés ci-dessous mesurent la
qualité du témoin OpenScriptures/TIPNR et du rattachement exact.

## Résultat agrégé

| Classe                   |  Nombre | Interprétation                                                                                     |
| ------------------------ | ------: | -------------------------------------------------------------------------------------------------- |
| `new_precise`            |      41 | La corroboration reconstruite décrit correctement l'entrée exacte.                                 |
| `acceptable_but_generic` |      38 | Le contenu familial est vrai mais ne prouve pas le sous-sens suffixé.                              |
| `missing_context`        |      14 | Le sens de base est présent, mais une relation, une construction ou une nuance essentielle manque. |
| `wrong_entity`           |       4 | La notice vise une autre entité ou fusionne plusieurs entités.                                     |
| `wrong_relation`         |       3 | La relation déclarée est incompatible ou sérieusement contestée.                                   |
| **Total**                | **100** |                                                                                                    |

Conclusion : la corroboration indépendante est précise dans 41 cas, mais une
notice Strong classique précédée d'un bandeau « STEP sense » ne prouve pas pour
autant la portée d'un sous-STEP. Les 59 cas non précis restent en revue ou
bloqués avant toute traduction, même si le Meaning TBESH canonique est présent.

## Clôture exhaustive de la phase anglaise

Cette file intermédiaire a ensuite été résolue sans extrapoler les pourcentages
du premier échantillon. Les 65 glosses résiduels et les 208 meanings résiduels
ont été relus exhaustivement, contre-audités et encodés dans des registres
scellés. La partition finale des meanings est : 132 raws STEP, 18 sections STEP
spécifiques, un contexte legacy exact, 14 companions exacts et 43
reconstructions éditoriales. Dix identités hébraïques ont en outre reçu 13
corrections certaines sans modifier leurs identifiants Strong.

Le staging final ne contient plus aucune revue, aucun warning ni blocker. Un
nouvel échantillon indépendant de release a validé 120/120 entrées, dont les
cinq classes de publication et 31 sous-STEP. Le résultat publié est documenté
dans [la fiche de release `core-en`](./lexicon-v3-core-en-release.md).

## Complément exhaustif sur le séparateur `§`

Les 4 094 notices sectionnées ont ensuite été auditées structurellement, et les
65 cas dont la morphologie n'est pas un nom propre ont été relus exhaustivement :

| Classe du ledger  | Nombre | Effet automatique                             |
| ----------------- | -----: | --------------------------------------------- |
| contexte vérifié  |     43 | raw publiable avec portées distinctes         |
| tail d'un sibling |     17 | préfixe exact publié si présent ; tail exclu  |
| conflit de source |      4 | fallback exact requis ; trois restent bloqués |
| tail vide         |      1 | section STEP publiée, tail ignoré             |

Pour les noms propres, 171 écarts de citation et 42 portées suffixées ont été
réconciliés par une preuve stricte commune à TIPNR, `EntityRefs` et TAHOT. Cette
preuve ne reçoit jamais la section après `§`. L'audit reproductible obtient
4 094 raws sur 4 094, 3 332 sections STEP sur 3 332, 4 093 contexts legacy sur
4 093, aucun contenu français et aucune violation. Après sélection, 4 029
meanings sectionnés sont validés automatiquement, 62 restent candidats et trois
sont bloqués ; 750 utilisent une notice exacte indépendante et 15 uniquement le
préfixe STEP prouvé.

## Ce que les sous-STEP changent

Une divergence de référence n'est pas nécessairement une incohérence. Les
chaînes suivantes sont cohérentes quand on parcourt le graphe complet :

```text
H0153 -> H1872 -> H2220
H0318 -> H0317 -> H0311 -> H0310A
H0321 -> H0317 -> H0312
H0363 -> H0356 -> H0352D
H0459 -> H0412 -> H0411
H0479 -> H0412 -> H0411
```

Une comparaison chaîne-à-chaîne aurait produit de faux positifs. Le pipeline
conserve désormais le chemin transitif exact dans la provenance, y compris les
lignes STEP intermédiaires lorsqu'elles sont nécessaires.

## Anomalies confirmées

- `H0011` : deux entités TIPNR homonymes étaient concaténées. Une jointure
  ambiguë donne maintenant `source_issue` avec une corroboration vide, sans
  supprimer l'assertion TBESH.
- `H0159` : la notice Strong ouverte cite une dérivation vers `H156` qui ne
  correspond pas à la famille sémantique de l'amour, tout en citant aussi
  `H158`. Cette étymologie est écartée du témoin de corroboration ; le Meaning
  TBESH reste canonique mais ne franchit le gate qu'avec un rattachement exact.
- `H0173H` et `H0173I` : le fallback Strong recycle l'identité correspondant à
  un autre sibling suffixé. Aucune auto-validation.
- `H0230` : le gloss STEP « gone » et la relation vers `H0235` ne concordent pas
  avec la définition ouverte « firm » et les occurrences araméennes. L'entrée
  reste en conflit/revue.
- `H0381` : STEP décrit un syntagme commun « homme de valeur / héros », tandis
  que la notice Strong le traite surtout comme le nom propre Ishchail. Le
  témoin indépendant écarte ce contexte de nom propre et retrouve dans
  LexicalIndex/BDB « a valiant man ». Le Meaning TBESH canonique reste néanmoins
  `review_needed` : la relation `combination of H0376G + H2428G` exige les deux
  sous-STEP exacts, pas le seul chemin classique vers `H2428`.
- `H0431` : STEP relie l'araméen « behold » à `H0480`, alors que la source
  ouverte le rattache à `H0412`, sans chemin transitif convaincant. Le conflit
  est bloqué.

## Cas génériques typiques

Les familles `H0047*`, `H0068*`, `H0127*`, `H0176*`, `H0193*`, `H0217*`,
`H0251*`, `H0349*`, `H0352*` et `H0441*` montrent le même défaut : plusieurs
suffixes reçoivent la notice générale du Strong classique. Le gloss exact aide
à comprendre l'entrée, mais le corps mélange encore des siblings. Il faut une
sélection exacte AugIndex/LexicalIndex/BDB, TIPNR ou une décision humaine avant
promotion.

## TBESH canonique, gate indépendant et français existant

Le statut canonique de TBESH ne transforme pas chaque rattachement en gold
standard. Le HTML brut est toujours conservé comme assertion. Le HTML affiché
reste identique quand le raw franchit ses gates, sauf pour `H9001`, où le
marqueur `<->` est échappé en `&lt;-&gt;`. Quand le tail est générique, étranger ou
en conflit, le champ publié utilise uniquement le préfixe prouvé ou une notice
exacte TIPNR/OpenScriptures ; le raw reste consultable en provenance. `§` est
maintenant une frontière de
provenance : la section STEP exacte et le contexte legacy sont conservés et
attestés séparément. Le symbole seul ne déclenche plus une revue. Restent en
revue les meanings suffixés sans preuve de portée, les textes partagés entre des
siblings aux gloss différents, les tails identifiés comme étrangers et les
mismatches non expliqués par un alias exact. Une citation manquant l'identité
STEP exacte n'est levée que par le recoupement strict section spécifique +
entité TIPNR + `EntityRefs` + occurrence TAHOT exacte ; un problème de source
explicite du témoin indépendant bloque le champ.

OpenScriptures/TIPNR demeure une corroboration et un enrichissement indépendants
obligatoires. Les textes français de STEP, de la base courante et de
`strong.legacy.sqlite` restent des témoins de comparaison : ils peuvent inspirer
ou signaler une divergence, mais ne valident jamais seuls le français final.

## Changements de pipeline issus de l'audit

- identité `dStrong` exacte, suffixe et casse préservés ;
- TIPNR essayé avant l'heuristique de nom propre, sans concaténation ambiguë ;
- ajout d'AugIndex épinglé et vérifié pour les Strong augmentés ;
- contrôle forme originale + morphologie + identifiant BDB ;
- notice Strong familiale insuffisante comme preuve automatique d'un sous-STEP ;
- relation rendue explicitement dans la notice et chemin transitif borné,
  attesté et reproductible ;
- relations de combinaison validées seulement si toutes leurs composantes STEP
  exactes sont prouvées ;
- garde-fou nom propre Strong contre lexème/syntagme commun STEP ;
- Meaning TBESH brut toujours conservé comme assertion de provenance, avec
  sélection distincte du contenu exact publiable ;
- gate OpenScriptures/TIPNR indépendant obligatoire pour valider le rattachement
  et la portée ;
- segmentation de tous les meanings groupés par `§`, avec assertions distinctes
  pour la section STEP et le contexte legacy ; revue seulement quand la portée,
  le sibling propriétaire ou les sources restent contestés ;
- ledger exhaustif et scellé des 65 cas sectionnés non-noms-propres, plus preuve
  de portée sensible à la casse par TIPNR, `EntityRefs` et TAHOT ;
- `review_needed` et `source_issue` exclus de tout appel de traduction ;
- audit brut insuffisant pour le FR : seuls les packets issus d'un authoring
  attestant les droits et les gates peuvent devenir éligibles ;
- décisions EN appliquées avant construction des packets FR, avec invalidation
  et re-parenting exact du français après toute modification anglaise.

## Smoke test français historique, hors rebuild

Aucun français n'a été généré dans le rebuild du 2026-07-13. Le test borné
ci-dessous est antérieur et reste documenté uniquement comme vérification du
comportement des gates ; son résultat n'appartient pas à l'authoring courant.

`hebrew:H0122A` a été exécuté avec deux proposants et un arbitre réels. Les trois
identités d'exécution ont été attestées. Les deux proposants ont choisi le gloss
« rouge », leurs sorties ont passé la validation HTML et l'arbitre a rendu
`accept`. Comme les notices longues n'étaient pas identiques, le résultat final
est resté `review_needed`. Cela confirme que l'arbitre ne contourne pas la porte
de consensus et qu'une traduction plausible n'est pas promue comme parfaite
sans preuve suffisante.
