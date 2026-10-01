# Repenser l’alignement Strong : diagnostic et expériences

Date : 1er octobre 2026. Recherche et diagnostic hors ligne ; aucune modification
du comportement de production. Les propositions ci-dessous ne remplacent pas les
contrats et contrôles actuels.

## Conclusion

Le prochain gain ne viendra probablement pas seulement d’un meilleur arbitre
entre cinq candidats. Il faut étendre les candidats, vérifier les placements
déjà présents et mesurer l’alignement des occurrences originales, au-delà de la
reproduction des balises d’une édition.

L’architecture possède déjà des éléments solides : références évaluées masquées,
exclusion des familles corrélées, lexiques appris dans les deux sens,
appariement global des formes répétées, séparation reader/advanced, preuves STEP,
transactions et empreintes. Il ne serait pas justifié de tout remplacer.

## Diagnostic exécuté sur le premier benchmark

Recalcul reproductible à partir des réponses archivées, sans nouvel appel modèle :

```sh
cd apps/resource-studio
yarn exec tsx scripts/strong-decision-benchmark/audit.ts \
  outputs/strong-decision-benchmark/pilot-v1
```

Le script écrit `system-audit.json` dans ce répertoire local ignoré par Git. Il
vérifie les empreintes des requêtes, réutilise le scoreur et les règles
d’application du benchmark, puis contrôle la concordance de ses décomptes.

| Observation                                                                          |                        Résultat | Interprétation                                                                                                                                            |
| ------------------------------------------------------------------------------------ | ------------------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Textes de versets de test                                                            | 474, sur 158 passages distincts | Les trois éditions ne sont pas trois observations indépendantes.                                                                                          |
| Placements visibles non conformes à la référence dans la baseline                    |                             538 | Désaccords avec les balises, pas 538 erreurs sémantiques démontrées.                                                                                      |
| Parmi eux, placements ciblés par un cas sélectionné du benchmark                     |                              10 | L’expérience couvre surtout les manques ; elle évalue peu la réparation des placements existants. Le plafonnement et la sélection des cas comptent aussi. |
| Bonne cible visible parmi les choix                                                  |          261 / 390, soit 66,9 % | Un tiers des cas visibles évaluables ne peut pas être résolu par le classement des choix actuels.                                                         |
| Occurrences visibles de référence recouvrant une autre occurrence                    |         328 / 6 525, soit 5,0 % | Le chevauchement n’est pas intrinsèquement une erreur. Ce chiffre compte des occurrences, pas des paires ni des versets.                                  |
| F1 visible exact / avec chevauchement                                                |               83,92 % / 86,04 % | Le découpage joue un rôle, sans expliquer à lui seul les désaccords. Le chevauchement est une mesure permissive.                                          |
| Simulation avec les réponses de référence sur les cas uniques et les choix existants |                F1 exact 86,11 % | Même un arbitre parfait sur ce sous-ensemble laisse l’essentiel des faux positifs existants intact.                                                       |

Cette dernière simulation est un **oracle de diagnostic** : elle utilise les
réponses attendues, s’abstient sur les cas ambigus/hors choix et conserve les
règles d’application. Elle n’est ni un modèle, ni une borne théorique de toute
la chaîne. Elle applique 234 placements, en bloque 13 et ne retire aucun des
538 faux positifs initiaux. Douze blocages viennent d’un placement existant
lui-même non conforme à la référence ; le treizième correspond à deux Strong
partageant réellement un support dans la référence. Il faut donc étudier les
déplacements conjoints, pas simplement supprimer le filtre anti-chevauchement.

Les chiffres réutilisent le pilote déjà examiné : c’est un diagnostic après
lecture des résultats, pas une nouvelle validation indépendante. Ils héritent
aussi du dictionnaire legacy explicite du
[comparatif initial](strong-decision-benchmark-2026-10-01.md). Le dictionnaire
par défaut reste refusé pour attestation V3 absente/invalide.

## Les critères que je conserverais

- Une identité lexicale doit être justifiée par une occurrence source, et les
  variantes textuelles doivent rester explicites.
- Aucun changement du texte biblique pour faciliter l’annotation ; positions
  liées à une révision exacte du texte.
- Possibilité de s’abstenir et conservation des occurrences originales sans
  forcer un support français.
- Évaluation sans la Bible testée ni sa famille comme témoin de transfert.
- Preuves et décisions archivées, contrôles structurels, application atomique.

Ces règles traitent la provenance et l’intégrité. Elles ne démontrent pas à elles
seules que le support français est sémantiquement correct.

## Les critères à remettre en question

### 1. La référence exacte ne doit pas être l’unique vérité

`scoreCarrierAwareVerse` distingue déjà placement exact, chevauchement,
visibilité et inventaire. C’est utile. Mais son unité est actuellement
`Strong classique + intervalle français` ; elle ne vérifie ni le `dStrong`
contextuel ni l’identité précise de l’occurrence source. Une permutation entre
deux occurrences du même Strong peut ainsi échapper au score si l’ensemble des
supports reste identique.

Il faut garder ce test de non-régression et lui ajouter une petite référence
sémantique annotée à partir du texte original. Elle devrait distinguer les liens
**certains** des liens **acceptables**, et les conventions de mise en évidence.
Cette distinction vient de la littérature sur l’alignement ; elle permet de ne
pas pénaliser une variante légitime comme une erreur certaine.
[Och et Ney, section 5](https://aclanthology.org/J03-1002.pdf).

Un simple chevauchement ne suffit pas : entourer tout le verset ferait remonter
artificiellement ce score. Les expressions acceptables doivent être annotées
explicitement. Les corrections du gold doivent être versionnées et arbitrées
sans favoriser les sorties du modèle testé.

### 2. Séparer relation sémantique et support d’affichage

Une relation de traduction peut unir plusieurs occurrences originales à une
expression française, éventuellement discontinue. Le mot choisi pour afficher
le numéro n’est qu’une projection de cette relation.

Le système sait déjà représenter des phrases et plusieurs Strong. En revanche,
`StrongLedgerAnnotation` porte un seul `originalOccurrenceId` et un intervalle
continu. Le rattachement des répétitions dans
`linkReaderAnnotationsToOriginalOccurrences` repose sur un appariement global
par position relative : il est déterministe, mais n’établit pas à lui seul une
correspondance syntaxique ou un sens contextuel.

Expérience proposée : représenter, dans un format expérimental, des groupes
d’occurrences source reliés à des groupes de tokens français. Déduire ensuite
le support de lecture. Mesurer séparément qualité des liens et qualité de la
projection. Ne pas imposer une relation un-à-un ou un ordre monotone strict à
tous les phénomènes de traduction.

### 3. Distinguer trois absences

« Non traduit explicitement », « alignement inconnu » et « absent de l’édition
source choisie » sont des états différents. `NONE` et `UNSURE` sont un bon
début, mais le gold CSV et l’ancrage d’un Strong vide ne prouvent pas toujours
la première catégorie. Il faut tester explicitement les omissions, les éléments
grammaticaux exprimés par flexion et les variantes textuelles.

### 4. Réexaminer les placements établis

Une revue centrée sur les trous ne traite pas suffisamment les faux positifs.
Un emplacement occupé peut être mal attribué ; corriger A puis B séparément
peut être interdit alors que leur échange simultané serait correct.

Le filtre de simulation du pilote interdit tout nouveau chevauchement. La
production a déjà des exceptions plus fines pour certains placements multiples ;
ne pas confondre les deux. Il faut comparer des révisions conjointes du verset
aux règles existantes, avec cardinalités et preuves explicites.

Autre tension concrète : `assertApprovalMetricsGates` refuse une baisse de
couverture des références. C’est un bon détecteur de régression, mais supprimer
un lien erroné peut réduire cette couverture. Une correction sémantique validée
devrait pouvoir justifier une baisse ciblée, tout en préservant l’inventaire
source et les garanties d’intégrité. Cela demanderait un contrat explicite,
pas le contournement des contrôles actuels.

### 5. La confiance doit être mesurée sur les erreurs acceptées

Un score de 0,99 ne vaut pas 99 % de justesse. Le critère exploratoire actuel
« au moins 30 décisions, 98 % observés » serait trop faible pour certifier une
publication, même s’il avait été atteint.

Illustration calculée : pour une politique fixée et des décisions indépendantes,
30 réussites sur 30 donnent une borne inférieure unilatérale à 95 % d’environ
90,5 %. Il faut au moins 149 réussites sans erreur pour dépasser 98 % avec cette
même borne. Nos éditions et chapitres sont corrélés ; ces nombres ne sont donc
pas un calcul de taille d’échantillon directement applicable à notre corpus.

Tracer précision/couverture, inclure l’incertitude et choisir les seuils hors du
test. Les approches de classification avec abstention et de « Learn then Test »
fournissent des méthodes, sous leurs hypothèses statistiques. Une garantie sur
la couverture d’un ensemble de candidats ne garantit pas automatiquement la
précision des décisions unitaires retenues.
[Geifman et El-Yaniv](https://arxiv.org/abs/1705.08500),
[Angelopoulos et al.](https://arxiv.org/abs/2110.01052).

## Expériences proposées, dans cet ordre

Les méthodes et sources externes sont détaillées dans la
[note de recherche](strong-alignment-research-sources-2026-10-01.md).

| Expérience                          | Modification isolée                                                                                                                                       | Mesure décisive                                                                                         |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| A. Référence et diagnostic élargis  | Nouveaux passages, cas correctement et incorrectement déjà placés, revue de groupes source/cible, liens certains/acceptables                              | Désaccords de convention séparés des erreurs de sens ; erreurs par occurrence source et par support     |
| B. Candidats plus complets          | Unir candidats actuels, tous les mots plausibles, groupes syntaxiques courts et propositions d’alignement local ; comparer top 5, top 10, ensemble élargi | Présence de la bonne cible avant classement, par type de cas ; précision finale à couverture comparable |
| C. Alignement statistique local     | Entraîner eflomal sur versets parallèles, tester surfaces, lemmes puis séquences de Strong/identités ; initialisation lexicale si utile                   | Gain sur les bons candidats absents, performance par fréquence et livre ; stabilité entre entraînements |
| D. Alignement contextuel via témoin | SimAlign ou awesome-align sur témoin moderne anglais/français vers français cible, puis projection des occurrences attestées                              | Nouveaux liens corrects et erreurs introduites par le pivot, comparés au transfert actuel               |
| E. Contexte et décision conjointe   | Ajouter à JEV les occurrences originales voisines et concurrents ; ensuite, séparément, résoudre les placements ensemble                                  | Corrections nettes des placements existants, confusions entre occurrences et faux positifs nouveaux     |

Eflomal est intéressant parce qu’il apprend sur le corpus parallèle local, sans
modèle génératif. SimAlign et awesome-align utilisent des encodeurs contextuels :
leur intérêt pour une paire moderne ne prouve pas leur qualité sur l’hébreu
biblique ou le grec ancien. La composition via un témoin doit conserver les
identités et variantes de l’édition source ; un chemin composé n’est pas une
preuve indépendante de ses composants.

Un petit modèle local de classement spécialisé est aussi envisageable après
amélioration des données : caractéristiques lexicales/contextuelles, exemples
positifs et négatifs difficiles, séparation par chapitres/livres. Il faudrait
le comparer à une régression logistique simple avant de spécialiser Laya. Le
résultat du checkpoint Laya actuel ne permet ni de valider ni d’écarter cette
approche entraînée pour notre tâche.

## Protocole de la prochaine campagne

1. Garder le pilote actuel comme jeu de développement. Réserver de nouveaux
   chapitres pour la prochaine comparaison et un test final jamais utilisé pour
   ajuster candidats, prompts, seuils ou annotations.
2. Stratifier AT/NT, genres, noms propres, mots fréquents, polysémie, répétitions,
   expressions et variantes textuelles. Prévoir aussi la traduction réellement
   visée, par exemple NBS : les trois témoins actuels ne couvrent pas tous les
   styles de traduction.
3. Distinguer données de transfert disponibles en production et données de
   supervision. Déclarer explicitement si un entraînement statistique voit les
   textes non annotés du test ; ne pas mélanger test transductif et test sur
   nouveaux passages. Auditer la provenance des lexiques dérivés et des sources
   externes, sans présumer leur indépendance.
4. Comparer une modification à la fois, puis leurs combinaisons. Publier
   précision/couverture, candidats manquants, bonnes corrections, nouvelles
   erreurs, coût et taux d’abstention. Rapporter les résultats par livre et
   famille ; calculer les incertitudes par groupes adaptés aux dépendances.
5. Figer les données, poids, versions, décisions et règles de projection.
   Distinguer reproductibilité d’une génération depuis des artefacts figés et
   répétabilité d’un nouvel entraînement ou d’un nouvel appel fournisseur.

La première action utile serait A + B, puis une baseline eflomal locale. JEV
reste un comparateur pertinent pour E. Le choix d’un moteur final vient après
la mesure des candidats et des erreurs réellement corrigées.

## État des vérifications

L’audit a été exécuté avec assertions et réutilisation des fonctions du pilote.
Il n’écrit que son JSON de diagnostic. Aucun appel payant, changement de
dépendance ou application en production n’est nécessaire pour ces résultats.
Le typecheck du workspace, le contrôle TypeScript explicite du script avec
les options strictes du workspace et son lint passent.
Les limites de validation globale du dépôt restent celles du comparatif initial.
