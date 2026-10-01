# Reconstruction masquée de S21 face à Concordance.bible

Expérience autonome du 1er octobre 2026, menée depuis le commit `dec602f8d`
sur la branche `claude/strong-s21-concordance-rebuild-e5fefb`, selon le
[protocole](./strong-concordance-night-experiment-prompt-2026-10-01.md) et après
le [checkpoint](./strong-concordance-checkpoint-2026-10-01.md). Goal associé :
[`goals/strong-concordance-reconstruction-2026-10-01.md`](../goals/strong-concordance-reconstruction-2026-10-01.md).
Outil rejouable : [`scripts/strong-concordance-rebuild/`](../scripts/strong-concordance-rebuild/README.md).
Toutes les données et sorties complètes sont sous `outputs/strong-concordance-night/`
(ignoré par Git). Une autre session menait en parallèle le même protocole dans le
checkout principal ; cette expérience en est indépendante (plan, acquisition,
code et analyses propres, aucun de ses résultats consulté).

## Résumé

- **Contrôle externe réel.** Concordance.bible publie, dans le HTML de chaque
  chapitre, les Strong SG21 et NEG avec la position du mot source. 48 chapitres
  par édition ont été acquis (débit lent, cache figé, empreintes). Le texte SG21
  coïncide mot pour mot avec notre texte local (1 073 versets sur 1 075, un autre
  aligné malgré une différence) et ses positions source avec les numéros de mots
  STEP : l'identité de chaque occurrence est donc mesurable, pas seulement son
  numéro Strong.
- **Référence initiale.** Sur le test réservé, le moteur initial reconstruit S21
  avec un F1 porteur exact de **0,848** (précision 0,913) quand LSG, Darby et
  DarbyR sont disponibles, et **0,786** sans la famille Segond. Environ un cinquième
  des occurrences source restent explicitement incertaines ; aucun des 390 mots
  non traduits marqués ◎ par Concordance n'est reproduit comme vide établi.
- **Améliorations communes.** Quatre règles du moteur commun, mesurées une à une
  sur le développement puis figées, apportent sur le test **+0,3 à +0,5 point de
  F1 porteur**, **+1 point de F1 par occurrence**, **−1,5 à −1,8 point
  d'incertitude** et **+2,4 points de versets entièrement comptabilisés** pour
  S21, sans régression sur NEG, LSG, Darby, DarbyR ni sur les canaris historiques.
  Elles sont actives par défaut depuis, B départageant d'abord par l'identifiant
  des témoins (section 11).
- **Pas d'adaptation de moteur par Bible.** Le profil S21 est identique au profil
  commun ; les calibrations formelle et dynamique ne font pas mieux. L'adaptation
  nécessaire pour NEG79 porte sur son texte local (sauts de ligne perdus : 201
  mots soudés et environ 4 900 ponctuations collées ; limites de versets).
- **Limites principales.** Identité des occurrences répétées (articles grecs),
  convention de locution de Concordance, absence de vides justifiés, vocabulaire
  moderne sans candidat. L'accord mesure une compatibilité éditoriale : la revue
  assistée trouve aussi des erreurs dans la référence.

## 1. Contrôle externe acquis

Concordance.bible expose les annotations SG21 et NEG dans le HTML public de
chaque chapitre : pour chaque mot français, la position du mot source dans le
verset BHS/NA (`data-pa`), son Strong (`data-ns`) et le lemme français ; les mots
source non traduits apparaissent comme marqueurs ◎ avec leur position. Aucune
exportation n'est proposée. L'acquisition a donc porté sur un échantillon borné de
pages publiques, par une commande séparée (`run.ts acquire`) : une requête
séquentielle toutes les 6 secondes, sans paramètre de requête ni connexion,
conformément au `robots.txt` conservé avec son empreinte.

| Édition                               | Pages | Versets | Mots porteurs de Strong | Marqueurs ◎ |
| ------------------------------------- | ----: | ------: | ----------------------: | ----------: |
| SG21 (Segond 21, 2007)                |    48 |   1 075 |                  16 308 |         707 |
| NEG (Nouvelle Édition de Genève 1979) |    48 |   1 075 |                  16 140 |         563 |
| Sg1910 (contrôle de provenance)       |     4 |     114 |                   1 844 |          47 |
| Darby (contrôle de provenance)        |     2 |      77 |                   1 275 |          13 |

Les 102 pages ont répondu HTTP 200 le 1er octobre entre 18 h 40 et 18 h 52 UTC
(une page Darby, en échec réseau transitoire, a été redemandée une fois) ; chaque
reçu conserve l'URL, les dates, les en-têtes de cache, l'empreinte SHA-256 et le
comptage des annotations effectivement livrées. Le sceau
`acquisition-seal-v1.json` (empreinte `db4deff6…eb82f`) fige le cache. Le pied de
page indique que les Strong SG21 ont été **affectés en 2026** par l'association
Concordances et Traductions de la Bible. Les mentions légales du site réservent
l'utilisation et la reproduction de ses données à l'autorisation de l'éditeur :
le cache reste strictement local et non publié, et toute utilisation au-delà de
cette évaluation interne demande l'accord de l'association.

Par erreur, l'en-tête User-Agent de ces requêtes contenait l'adresse e-mail de
contact de Stéphane. Elle a été retirée du code après l'évaluation du test, sans
effet sur les mesures : les 14 évaluations du test, refaites sous le gel corrigé
`freeze-v1b.json`, sont identiques à l'octet (`freeze-v1-addendum.json`).

## 2. Alignement des unités

Concordance numérote les versets selon la BHS et le NA. Le texte local S21 suit
la même numérotation ; NEG79 local suit une numérotation traditionnelle, reliée
par son manifeste de correspondance. Chaque verset Concordance est reconstruit
sans titres, numéros, notes d'éditeur ni marqueurs ◎, puis aligné mot à mot sur
le texte local exact (apostrophes typographiques neutralisées). Les notes
d'éditeur, présentes sous forme de fenêtres surgissantes, sont conservées à part
et n'entrent jamais dans le texte comparé.

- **SG21** : 1 073 versets sur 1 075 identiques au texte local ; un verset du
  test diffère légèrement mais reste aligné sans perte de porteur ; le seul verset
  non comparable (Matthieu 13.3) relève d'une limite de verset NA différente. Les
  positions source coïncident avec les numéros de mots STEP (`#NN`), y compris
  pour les versets que STEP étiquette par leur référence anglaise
  (« Osée 1.10(2.1) »).
- **NEG** : 864 versets identiques, 195 qui ne diffèrent que par la graphie
  (accents, apostrophes), 3 alignés malgré une différence et 13 non comparables
  sur 1 075 (7 en développement, 6 en test). Les cas non comparables révèlent
  des défauts du texte local NEG79 : limites de versets déplacées par
  rapport au NA (« Ils sont dépourvus d'intelligence » ouvre Romains 1.31 chez
  Concordance) et mots soudés par l'extraction des lignes poétiques
  (« travailEst », « quiFournit »). Le texte local NEG79 contient environ 201
  soudures de ce type sur toute la Bible, contre une seule pour S21.
- **NT** : l'ordre ou le nombre de mots peut différer entre NA et TAGNT ;
  l'évaluateur accepte alors la même identité Strong à trois positions près, ou à
  toute distance si ce Strong est unique de part et d'autre, et compte ces cas à
  part (`source-position-shift`, 5 % des occurrences du test SG21).

Un Strong porté par une ponctuation (« je vous le dis, si… » pour ὅτι) est traité
comme un vide ancré après le mot précédent, comme dans nos CSV historiques. Les
locutions (« gros bétail », « afin que ») forment une seule occurrence portée par
plusieurs mots. Les marqueurs ◎ placés à l'intérieur d'un mot élidé (« l'◎Égypte »)
sont ancrés avant ce mot.

## 3. Absence de fuite

Les annotations cibles ne sont lues que par l'évaluateur.

- `predict.ts` n'importe aucun module d'évaluation ; un test vérifie le graphe
  d'import et une garde refuse tout chemin du cache ou du dossier évaluateur.
- Les prédictions sont scellées (SHA-256 du JSON canonique) avant toute
  évaluation ; l'évaluateur refuse une prédiction modifiée.
- **Rejeu sans accès** : avec le cache Concordance rendu illisible (`chmod 000`),
  la prédiction SG21 famille exclue est identique, octet pour octet, à la
  prédiction scellée.
- Les corrections éditoriales (`curated overrides`) restent désactivées. Elles
  contiennent deux entrées S21 pour Genèse 1.4 explicitement issues de
  Concordance.bible : activées, elles contamineraient toute évaluation S21.
- Le dictionnaire utilisé (`strong_lexicon.en-fr.full.production.sqlite`) ne
  contient aucune donnée S21, NEG ou Concordance. Ses gloses de **noms propres**
  ont toutefois été validées contre Sg1910 et Darby lors de leur rédaction : le
  scénario « famille Segond exclue » n'est donc pas totalement indépendant de LSG
  par ce canal, limité à des preuves de revue qui ne placent pas seules un porteur.
- Le lexique de phrases dérivé est indexé par l'empreinte des témoins utilisés :
  un témoin exclu force sa reconstruction sans lui. Les sources lexicales
  françaises (Kaikki, WOLF, OpenOffice) sont générales.

Les témoins LSG, Darby et DarbyR proviennent eux-mêmes de Concordance. Comparés
aux pages actuelles du site, les CSV locaux concordent à 97,6 % (F1 porteur exact
Sg1910, 114 versets) et 97,7 % (Darby, 77 versets) : ce sont des instantanés plus
anciens des annotations de la même équipe, avec ses conventions.

## 4. Proximité éditoriale LSG, S21 et NEG79

| Paire de textes (1 075 versets) | Similarité moyenne des mots | Versets identiques |
| ------------------------------- | --------------------------: | -----------------: |
| NEG79 ~ Sg1910                  |                       0,991 |                940 |
| S21 ~ Sg1910                    |                       0,762 |                 63 |
| S21 ~ NEG79                     |                       0,766 |                 64 |
| Darby ~ DarbyR                  |                       0,917 |                369 |
| Sg1910 ~ Darby                  |                       0,675 |                 20 |

Part des porteurs visibles de la référence retrouvés tels quels dans un témoin
(même Strong sur un mot de même forme) :

| Référence           |    LSG |  Darby | DarbyR | Vides ◎ aussi vides dans LSG |
| ------------------- | -----: | -----: | -----: | ---------------------------: |
| SG21, développement | 76,8 % | 63,0 % | 65,8 % |                       43,6 % |
| SG21, test          | 79,5 % | 66,5 % | 69,0 % |                       58,7 % |
| NEG, développement  | 98,8 % | 71,9 % | 72,2 % |                       72,5 % |
| NEG, test           | 98,9 % | 74,3 % | 74,6 % |                       85,6 % |

NEG79 est donc presque un transfert de LSG : son scénario « cible exclue » mesure
surtout la mécanique de transfert, et seul le scénario sans LSG teste une
généralisation. S21 s'écarte nettement plus de LSG, mais reste annotée par la même
équipe et avec les mêmes conventions. Darby et DarbyR ne sont jamais comptés comme
deux votes indépendants.

## 5. Plan expérimental

Le plan (`plan.json`) a été figé avant toute lecture des annotations des
chapitres choisis, par un tirage déterministe (SHA-256 d'une graine et du
chapitre), stratifié par genre et testament, une seule fois par livre et par
genre avant répétition, entre 4 et 60 versets par chapitre.

- **Développement** (24 chapitres, 560 versets) : Exode 10, 29 ; Deutéronome 20 ;
  1 Samuel 28 ; 1 Rois 3 ; 2 Chroniques 1 ; Néhémie 4 ; Job 30 ; Psaume 43 ;
  Proverbes 18 ; Ecclésiaste 11 ; Ésaïe 58 ; Jérémie 18 ; Ézéchiel 5 ; Osée 2 ;
  Michée 7 ; Matthieu 5 ; Jean 17 ; Actes 28 ; Romains 1 ; 2 Corinthiens 9 ;
  1 Timothée 1 ; Hébreux 13 ; Apocalypse 4. Exode 10 y figure d'office : ses
  annotations avaient été consultées pour comprendre le format.
- **Test réservé** (24 chapitres, 515 versets) : Genèse 16 ; Exode 20 ;
  Lévitique 24 ; Juges 12 ; 2 Samuel 4 ; 1 Chroniques 17 ; 2 Chroniques 27 ;
  Job 7 ; Psaume 42 ; Proverbes 9 ; Ecclésiaste 1 ; Ésaïe 35 ; Jérémie 38 ;
  Ézéchiel 6 ; Amos 9 ; Zacharie 1 ; Matthieu 13 ; Luc 11 ; Jean 14 ; Romains 6 ;
  1 Corinthiens 1 ; 2 Corinthiens 13 ; Hébreux 8 ; Apocalypse 10.

Chaque genre (loi, histoire, poésie et sagesse, grands et petits prophètes,
évangiles et Actes, Paul, épîtres générales et Apocalypse) a la même part dans
les deux ensembles (16 chapitres AT et 8 NT chacun). Les chapitres de test
n'apparaissent dans aucune sélection d'évaluation antérieure (740 chapitres
recensés dans les plans, gels et cas des expériences du 1er octobre, plus les
échantillons canaris recalculés), ni parmi les chapitres SG21 déjà consultés par
un outil historique (`compareS21Concordance.ts`) ou par la FAQ du site.

Deux scénarios sont mesurés : **cible exclue** (les trois témoins restent
disponibles pour S21 et NEG ; pour un témoin évalué, sa propre famille est
retirée) et **famille exclue** (Sg1910 retiré pour S21 et NEG). Les contrôles
LSG, Darby et DarbyR utilisent les mêmes chapitres, leurs CSV comme référence et
leur famille exclue des témoins.

Les mesures porteur comparent Strong et portée (mot, groupe ou ancrage d'un
vide), comme les canaris historiques. Les mesures **par occurrence** rapprochent
chaque occurrence de référence de la décision prise pour le même mot source :
porteur visible exact ou chevauchant, mauvais porteur, occurrence répétée
échangée, vide de référence reproduit ou non, ancrage, abstention. L'incertitude
est la part des occurrences source laissées incertaines ; un verset est
« entièrement comptabilisé » quand aucune de ses occurrences ne l'est.

## 6. Référence initiale (développement)

Prédictions du moteur initial, scellées avant toute modification du code
(`initial-predictions.json`, une seule empreinte de code pour les 14 exécutions).

| Édition | Scénario       | F1 exact | P exact | R exact | F1 chevauch. | Occ. P | Occ. R | Occ. F1 | Incertitude | Versets comptabilisés |
| ------- | -------------- | -------: | ------: | ------: | -----------: | -----: | -----: | ------: | ----------: | --------------------: |
| SG21    | cible exclue   |    0,835 |   0,904 |   0,776 |        0,858 |  0,901 |  0,764 |   0,827 |      21,8 % |                 8,8 % |
| SG21    | famille exclue |    0,766 |   0,893 |   0,671 |        0,793 |  0,891 |  0,668 |   0,763 |      30,8 % |                 2,1 % |
| NEG     | cible exclue   |    0,927 |   0,938 |   0,917 |        0,944 |  0,936 |  0,896 |   0,915 |      11,1 % |                35,3 % |
| NEG     | famille exclue |    0,823 |   0,912 |   0,750 |        0,845 |  0,910 |  0,738 |   0,815 |      24,5 % |                 5,6 % |
| Sg1910  | famille exclue |    0,844 |   0,932 |   0,772 |        0,853 |      — |      — |       — |      23,8 % |                 6,2 % |
| Darby   | famille exclue |    0,838 |   0,893 |   0,788 |        0,869 |      — |      — |       — |      18,4 % |                13,8 % |
| DarbyR  | famille exclue |    0,837 |   0,896 |   0,784 |        0,866 |      — |      — |       — |      19,2 % |                12,7 % |

Sans LSG, le rappel S21 chute de dix points pour une précision presque inchangée :
le moteur s'abstient plutôt que de se tromper. Le scénario NEG avec LSG atteint
0,927, ce qui reflète surtout la quasi-identité de NEG79 et de LSG. La précision
du NT (0,884) est plus basse que celle de l'AT (0,921) ; les grands prophètes et la
poésie ont le rappel le plus faible.

## 7. Analyse des désaccords

Chaque occurrence de référence est rapprochée de la décision prise pour le même
mot source et classée selon les catégories du protocole. Les abstentions ne sont
pas des erreurs affichées : elles réduisent le rappel et laissent une incertitude
explicite.

| Catégorie (SG21, cible exclue)                                | Dév. initial | Dév. figé | Test initial | Test figé |
| ------------------------------------------------------------- | -----------: | --------: | -----------: | --------: |
| Abstention (référence visible ou vide, prédiction incertaine) |        1 535 |     1 414 |        1 487 |     1 346 |
| Mauvaise occurrence répétée                                   |          194 |       199 |          191 |       194 |
| Mauvais porteur                                               |          176 |       177 |          134 |       136 |
| Expression (portée différente, surtout locutions)             |          171 |       174 |          131 |       137 |
| Porteur sur un mot que Concordance dit non traduit            |           78 |        80 |           74 |        76 |
| Convention éditoriale (silence de la référence, ponctuation)  |           74 |        78 |           65 |        66 |
| Variante ou numérotation source                               |           44 |        44 |           63 |        63 |
| Vide injustifié (vide prédit, porteur visible de référence)   |            0 |         0 |            0 |         0 |
| Découpage (verset non comparable)                             |            0 |         0 |            1 |         1 |

Aucun vide n'est jamais établi contre un porteur visible de Concordance ; à
l'inverse, aucun des ◎ de Concordance n'est établi comme vide (ancrage non
mesurable). Les quelques erreurs supplémentaires du moteur figé viennent
d'unités autrefois incertaines devenues décidées : sur le test, les 141
abstentions en moins deviennent 128 porteurs exacts, 6 porteurs chevauchants,
6 mauvais porteurs, 2 porteurs sur un mot que Concordance dit non traduit et un
porteur là où la référence se tait (un échange d'occurrence disparaît).

### Revue assistée d'échantillons

Deux échantillons déterministes et stratifiés de désaccords SG21 ont été examinés
avec la ligne STEP, le texte S21 et les porteurs des trois témoins : 49 dossiers
du développement (moteur initial) et, après le gel, 21 dossiers du test (moteur
figé). Ce jugement est **assisté et exposé** : l'assistant voyait la prédiction et
la référence ; ce n'est ni une validation humaine ni une adjudication
indépendante. Les dossiers et justifications sont conservés dans
`outputs/strong-concordance-night/evaluator-only/review/`.

| Verdict                                                              | Développement | Test |
| -------------------------------------------------------------------- | ------------: | ---: |
| Référence Concordance plus juste                                     |            20 |   11 |
| Notre prédiction plus juste (référence probablement erronée)         |             3 |    1 |
| Les deux défendables (convention, locution, répétition française)    |            17 |    5 |
| Aucune des deux satisfaisante                                        |             2 |    1 |
| Convention de numérotation Strong (G1510/G1511, G3440/G3441, G6063…) |             3 |    3 |
| Artefact de numérotation NA/TAGNT dans l'évaluation                  |             4 |    0 |

Exemples représentatifs, cités brièvement :

- **Locutions** : Concordance porte ἵνα sur « afin que », ὅτι sur « parce que »,
  כִּי sur « En effet », בָּקָר sur « gros bétail » ; notre moteur ne marque que la
  tête (« afin », « effet », « bétail »). Ces chevauchements sont presque tous des
  différences de portée. Les témoins locaux, instantanés plus anciens, n'ont pas
  cette convention de locution : l'apprendre de la cible serait une fuite.
- **Marqueur d'objet** H0853 nu : notre moteur établit un vide grammatical ancré
  (règle `fr-bare-object-marker-v1`) ; Concordance n'annote pas les marqueurs non
  traduits. Les deux comptabilités sont défendables.
- **Erreurs réelles du moteur** : surtout l'**article grec** posé sur l'article
  d'un autre nom (6 des 21 dossiers du test ; « la » de « la mort » au lieu de
  « leur » fin pour τὸ τέλος), puis l'occurrence répétée inversée (les deux
  εὐλογία de 2 Corinthiens 9.5), des traductions apprises fautives (ποιοῦσιν posé
  sur « agissent », qui rend πράσσουσιν) et la recopie d'étiquetages douteux des
  témoins (H1961 posé sur « portes » en Deutéronome 20.11).
- **Référence douteuse** : לֹא porté par « s'accordent » plutôt que « ne »
  (Job 30.17), ἓν porté par « sont » (Apocalypse 4.8), ὅσῳ porté par « qu'il »
  plutôt que « d'autant » (Hébreux 8.6). Concordance précise que son affectation
  est d'abord automatique puis corrigée : ces cas sont attendus.

L'article grec G3588 représente 78 des 664 porteurs visibles discordants du
moteur initial (SG21, cible exclue, développement) ; ἵνα, כִּי, καί, לֹא et אֲשֶׁר
suivent. Les erreurs se concentrent sur les mots grammaticaux.

### Pistes examinées et rejetées

- **Connecteur non réalisé** (καί, δέ, γάρ, οὖν, τε sans mot de liaison libre
  entre les porteurs voisins) : sur le développement, la règle se déclencherait
  93 fois, mais 23 fois sur un connecteur pourtant traduit selon Concordance
  (25 % de fausses absences) et avec seulement 12 ancrages identiques sur 67 vides
  concordants. Une absence ainsi établie ne serait pas justifiée : la règle n'est
  pas retenue.
- **Seuil plus strict pour les traductions apprises** : leur exactitude varie de
  57 % à 80 % selon la confiance, sans coupure nette ; un seuil plus haut retirerait
  davantage de porteurs justes que de faux.
- **Réordonner les occurrences répétées** : l'attribution est déjà monotone dans
  672 cas sur 675 ; les erreurs viennent du choix de l'occurrence réalisée quand
  le français a moins de porteurs que la source, que l'ordre ne peut pas trancher.

## 8. Améliorations retenues

Les critères d'adoption ont été enregistrés avant l'examen des résultats
d'ablation (`adoption-criteria.json`) : aucune baisse de précision porteur de plus
de 0,002 ni de F1 de plus de 0,001 sur aucune configuration, aucune baisse du F1
d'occurrence ni hausse de l'incertitude pour SG21 et NEG, et un gain réel sur
SG21. Chaque famille est une option explicite du moteur commun
(`experimentalPolicy`), désactivée par défaut pendant l'expérience (elles sont
actives par défaut depuis, voir section 11) ; options désactivées, le code
modifié reproduit à l'octet près les prédictions initiales scellées.

- **A — variante de lecture sans effet sur l'identité.** Une variante STEP
  (Qere/Ketiv, N(k)O…) bloquait toute décision, même quand un porteur était déjà
  affiché. Elle ne bloque plus si le mot appartient au texte de base (NA pour le
  NT, texte de Leningrad ou Qere pour l'AT), si aucune lecture ne porte un autre
  Strong et si l'unité n'a qu'une identité. Les mots absents du NA (codes K) et les
  variantes qui changent de Strong restent incertains. La lecture reste signalée
  (`readingVariant: identity-invariant`) ; l'affichage ne change pas.
- **B — un seul porteur par mot source à identifiants alternatifs.** Quand les
  identifiants alternatifs d'un même mot (H0582/H0376 pour אֲנָשִׁים) étaient posés
  sur deux mots français, l'occurrence apparaissait deux fois. Le porteur le mieux
  étayé (transfert exact, puis lexique validé, puis traduction apprise ; puis
  confiance) est conservé, les autres deviennent des doublons cachés. Une égalité
  n'est pas arbitrée. Sur le développement, ce choix retrouve le porteur de
  Concordance dans 34 cas résolubles sur 35 (SG21) ; l'identité principale STEP
  n'aurait été la bonne que 5 fois sur 47.
- **C — hôte d'un enclitique.** Le découpage français soude « dit-il »,
  « vois-tu », « jour-là » : un mot témoin « dit » peut désormais porter l'hôte du
  mot cible, sans attribuer de Strong au pronom.
- **D — nombre écrit en chiffres.** S21 écrit « 3 », « 7 », « 40 » là où les
  témoins écrivent « trois », « sept », « quarante » ; seuls les numéraux d'un
  seul mot sont rapprochés (pas « vingt et un » ni « deux cents »).

Effet de chaque famille seule puis de leur combinaison, sur le développement
(écarts au moteur initial) :

| Édition | Scénario       | Moteur   |  Δ F1 exact |   Δ P exact |   Δ R exact |   Δ F1 occ. | Δ incertitude |
| ------- | -------------- | -------- | ----------: | ----------: | ----------: | ----------: | ------------: |
| SG21    | cible exclue   | A        |     +0,0000 |     +0,0000 |     +0,0000 |     +0,0035 |      −0,67 pt |
| SG21    | cible exclue   | B        |     +0,0027 |     +0,0064 |     +0,0000 |     +0,0023 |      −0,45 pt |
| SG21    | cible exclue   | C        |     +0,0011 |     +0,0002 |     +0,0018 |     +0,0012 |      −0,17 pt |
| SG21    | cible exclue   | D        |     +0,0008 |     +0,0001 |     +0,0014 |     +0,0008 |      −0,14 pt |
| SG21    | cible exclue   | **ABCD** | **+0,0046** | **+0,0066** | **+0,0032** | **+0,0078** |  **−1,44 pt** |
| SG21    | famille exclue | ABCD     |     +0,0033 |     +0,0047 |     +0,0024 |     +0,0073 |      −1,20 pt |
| NEG     | cible exclue   | ABCD     |     +0,0042 |     +0,0062 |     +0,0023 |     +0,0073 |      −1,41 pt |
| NEG     | famille exclue | ABCD     |     +0,0031 |     +0,0050 |     +0,0018 |     +0,0067 |      −1,12 pt |
| Sg1910  | famille exclue | ABCD     |     +0,0032 |     +0,0050 |     +0,0020 |           — |      −1,15 pt |
| Darby   | famille exclue | ABCD     |     +0,0032 |     +0,0059 |     +0,0011 |           — |      −1,38 pt |
| DarbyR  | famille exclue | ABCD     |     +0,0034 |     +0,0060 |     +0,0013 |           — |      −1,40 pt |

A, B et C améliorent toutes les configurations. D n'agit que sur S21 (+0,08 point
de F1) ; il est neutre sur NEG et LSG, qui écrivent les nombres en lettres, et ôte
un seul verset Darby (« 12 » décomposé en deux Strong, −0,01 point). Les quatre
familles respectent les critères ; la combinaison ABCD a été figée
(`freeze-v1.json`, 1er octobre, 19 h 27 UTC, empreintes de 215 fichiers de code de
prédiction et des 4 modules d'évaluation).

## 9. Moteur commun ou adaptation par édition

| Profil appliqué à S21 (développement)       | Δ F1, cible exclue | Δ F1, famille exclue |
| ------------------------------------------- | -----------------: | -------------------: |
| `nbs` (profil commun Segond formel-lisible) |             0,0000 |               0,0000 |
| `fmar` (calibration formelle)               |            −0,0004 |              +0,0001 |
| `bds` (calibration dynamique)               |             0,0000 |              −0,0007 |

Écarts mesurés avec la politique figée, par rapport au profil `s21`. Le profil
`s21` a les mêmes paramètres que le profil commun et produit **exactement les
mêmes prédictions**. La calibration dynamique gagne un peu de précision et perd
autant de rappel ; la formelle l'inverse. Aucune ne dépasse le seuil fixé
d'avance (+0,003 de F1 dans les deux scénarios) : aucune adaptation de moteur
propre à S21 n'est justifiée. La seule convention propre à S21 rencontrée (nombres
en chiffres) est mieux traitée par la règle commune D, neutre ailleurs. La
convention de locution de Concordance est une convention d'affichage de la
référence, pas une propriété de S21.

## 10. Test réservé

Le test n'a été ouvert qu'après le gel. Les prédictions initiales du test avaient
été scellées avant toute modification ; celles du moteur figé ont été produites
ensuite, et l'évaluateur vérifie l'empreinte de chacune contre le gel.

| Édition | Scénario       | Moteur  | Versets |  F1 exact |   P exact |   R exact |   Occ. F1 | Incertitude | Versets comptabilisés |
| ------- | -------------- | ------- | ------: | --------: | --------: | --------: | --------: | ----------: | --------------------: |
| SG21    | cible exclue   | initial |     514 |     0,848 |     0,913 |     0,792 |     0,837 |      21,2 % |                 9,7 % |
| SG21    | cible exclue   | figé    |     514 | **0,852** | **0,919** | **0,794** | **0,847** |  **19,5 %** |            **12,1 %** |
| SG21    | famille exclue | initial |     514 |     0,786 |     0,908 |     0,694 |     0,777 |      29,5 % |                 3,1 % |
| SG21    | famille exclue | figé    |     514 | **0,790** | **0,913** | **0,696** | **0,787** |  **28,1 %** |             **4,3 %** |
| NEG     | cible exclue   | initial |     509 |     0,926 |     0,942 |     0,910 |     0,913 |      12,1 % |                32,8 % |
| NEG     | cible exclue   | figé    |     509 |     0,930 |     0,948 |     0,913 |     0,923 |      10,3 % |                38,3 % |
| NEG     | famille exclue | initial |     509 |     0,834 |     0,923 |     0,761 |     0,824 |      23,7 % |                 6,1 % |
| NEG     | famille exclue | figé    |     509 |     0,837 |     0,928 |     0,762 |     0,834 |      22,2 % |                 8,5 % |
| Sg1910  | famille exclue | initial |     515 |     0,852 |     0,938 |     0,780 |         — |      23,1 % |                 7,0 % |
| Sg1910  | famille exclue | figé    |     515 |     0,855 |     0,943 |     0,781 |         — |      21,6 % |                 9,3 % |
| Darby   | famille exclue | initial |     515 |     0,853 |     0,906 |     0,806 |         — |      17,8 % |                15,2 % |
| Darby   | famille exclue | figé    |     515 |     0,858 |     0,912 |     0,810 |         — |      15,7 % |                18,8 % |
| DarbyR  | famille exclue | initial |     515 |     0,850 |     0,909 |     0,798 |         — |      19,1 % |                14,4 % |
| DarbyR  | famille exclue | figé    |     515 |     0,855 |     0,916 |     0,802 |         — |      17,0 % |                17,9 % |

Les gains du test reproduisent ceux du développement : +0,0042 et +0,0033 de F1
porteur pour S21, environ +1 point de F1 par occurrence, et la même amélioration
sur NEG et sur les trois contrôles. La précision par occurrence reste stable
(0,910 pour S21 cible exclue) : les décisions supplémentaires sont justes au même
taux que les autres.

Détail S21, cible exclue, initial → figé :

| Groupe                          | Versets | F1 exact      | Précision     | F1 occurrence | Incertitude     |
| ------------------------------- | ------: | ------------- | ------------- | ------------- | --------------- |
| AT                              |     281 | 0,852 → 0,855 | 0,934 → 0,936 | 0,849 → 0,860 | 20,1 % → 18,3 % |
| NT                              |     233 | 0,845 → 0,850 | 0,895 → 0,905 | 0,827 → 0,835 | 21,7 % → 20,0 % |
| Loi                             |      65 | 0,871 → 0,876 | 0,939 → 0,941 | 0,840 → 0,876 | 22,9 % → 16,8 % |
| Histoire                        |      63 | 0,853 → 0,859 | 0,930 → 0,933 | 0,862 → 0,869 | 18,6 % → 17,7 % |
| Poésie et sagesse               |      69 | 0,859 → 0,861 | 0,936 → 0,940 | 0,858 → 0,863 | 16,6 % → 16,1 % |
| Grands prophètes                |      52 | 0,817 → 0,817 | 0,914 → 0,915 | 0,818 → 0,819 | 21,6 % → 21,2 % |
| Petits prophètes                |      32 | 0,871 → 0,872 | 0,963 → 0,963 | 0,877 → 0,882 | 20,2 % → 19,5 % |
| Évangiles et Actes              |     142 | 0,849 → 0,855 | 0,895 → 0,905 | 0,834 → 0,842 | 21,5 % → 19,8 % |
| Paul                            |      67 | 0,842 → 0,843 | 0,908 → 0,911 | 0,820 → 0,823 | 20,3 % → 19,6 % |
| Épîtres générales et Apocalypse |      24 | 0,827 → 0,834 | 0,876 → 0,890 | 0,804 → 0,827 | 25,0 % → 21,6 % |

Par type de difficulté (S21, cible exclue, moteur figé) : précision 0,990 sur les
noms propres, 0,945 sur les mots pleins, 0,883 sur les mots grammaticaux et 0,846
sur les Strong répétés dans le verset ; les locutions (168 occurrences) ne sont
presque jamais reproduites à l'identique (précision 0,087), et aucun des 373 mots
non traduits ◎ ni des 17 porteurs de ponctuation n'est établi comme vide.
L'identité de l'occurrence est juste dans 98,5 % des porteurs exacts.

**Déterminisme.** Rejeux identiques à l'octet : options désactivées après la
modification du moteur (trois configurations de développement, puis une après
formatage du code), politique figée après formatage (une configuration de
développement et deux du test), et prédiction sans accès au cache Concordance.

**Canaris historiques LSG, Darby, DarbyR.** Ces échantillons de 200 versets ont
déjà été consultés : ils servent seulement de non-régression. Le moteur initial
reproduit exactement les valeurs du checkpoint, et le moteur figé les améliore.

| Canari (200 versets, famille exclue) | F1 initial | F1 figé | Précision initiale | Précision figée |
| ------------------------------------ | ---------: | ------: | -----------------: | --------------: |
| Sg1910                               |     0,8476 |  0,8499 |             0,9408 |          0,9442 |
| Darby                                |     0,8428 |  0,8455 |             0,9064 |          0,9093 |
| DarbyR                               |     0,8376 |  0,8403 |             0,9037 |          0,9066 |

## 11. Activation par défaut (suite du 1er octobre)

Après ce rapport, deux décisions ont été appliquées. Les quatre options deviennent
le comportement par défaut du générateur canonique. Les deux corrections
éditoriales S21 tirées de Concordance (`Gen.1.4`) sont retirées : les annotations
S21 de Concordance servent seulement de comparaison.

- **Activation.** `generateStrongLedger` applique A, B, C et D sauf avis contraire
  (`enginePolicy`). `--engine-policy initial` rejoue l'ancien moteur dans
  `strong:evaluate` et `strong:audit:run`. Les canaris masqués du moteur par
  défaut sont ceux d'ABCD (tableau ci-dessus) et `--engine-policy initial` redonne
  exactement les valeurs initiales. L'outil de reconstruction garde ses options
  explicites : sans `--policy`, il rejoue toujours le moteur initial.
- **B avant la mesure de référence du lecteur.** Placée dans la résolution, B
  modifiait le lecteur après sa mesure de référence et violait l'invariant
  `reader-regression` de la génération autonome. Elle s'applique désormais
  avant cette mesure, comme une correction d'affichage. Les prédictions SG21,
  Darby et NEG sont identiques à l'octet. La première génération intégrale de
  NBS a pourtant échoué sur cet invariant : les métriques des versets touchés
  par B n'étaient pas recalculées, et la mesure de référence comptait encore
  les 1 192 porteurs masqués. Elles le sont désormais ; prédictions et audit
  10×5 restent identiques à l'octet.
- **Retouche de B.** Avec A–D, l'audit NBS 10×5 a révélé 3 rétrogradations
  fautives sur 75. B gardait le porteur le plus confiant même quand les trois
  témoins utilisent l'autre identifiant : 1 Tm 2.1 (G4412, « premier lieu »),
  Ap 2.6 (G2504, « moi-même ») et Ap 3.3 (G4571, « te », un « tu » appris
  l'emportait). Entre porteurs d'identifiants alternatifs d'un même mot source,
  l'ordre est désormais : identifiant utilisé par les témoins réutilisables du
  verset (LSG, Darby, DarbyR), puis rang de preuve, puis confiance. Une égalité
  sur les trois critères n'est toujours pas arbitrée.

La retouche est postérieure au gel. Elle a été décidée sur le développement
(`development-decision-v4.json`) et figée (`freeze-v2.json`). Le réservé n'a été
rouvert qu'une fois, en addendum, sans réglage ultérieur.

| Mesure (ABCD, B première version → retouchée) | Développement                   | Réservé (addendum)          |
| --------------------------------------------- | ------------------------------- | --------------------------- |
| SG21 cible exclue, F1 exact                   | 0,8396 → 0,8397                 | 0,8521 → 0,8521             |
| SG21 famille exclue, F1 exact                 | 0,7694 → 0,7694                 | 0,7897 → 0,7897             |
| NEG cible / famille exclue, F1 exact          | inchangés (0,9315 ; 0,8261)     | inchangés (0,9297 ; 0,8370) |
| Précision par occurrence SG21 et NEG          | −0,0002 au plus                 | −0,0002 au plus             |
| Témoins Sg1910, Darby, DarbyR, F1 exact       | inchangés                       | +0,0001 à +0,0002           |
| Occurrences modifiées                         | 1 S 28.8 gagnée, Mt 5.33 perdue | —                           |

En Mt 5.33 (famille exclue), le porteur retenu pour σου est « ton » (« ton
serment ») alors que S21 rend « tes serments » par « ce que tu as promis » : la
préférence pour l'identifiant des témoins n'indique pas la position.

**Audit NBS 10×5** (1 227 versets, dictionnaire en-fr de production) :

| Moteur                    | Strong lecteur | Vides | Risques de placement | Qualité | Couverture des porteurs de réf. | Strong de réf. absents |
| ------------------------- | -------------: | ----: | -------------------: | ------: | ------------------------------: | ---------------------: |
| initial (dec602f8d)       |         15 669 | 3 018 |                  277 |  0,9807 |                          0,8606 |                      2 |
| A–D, B première version   |         15 644 | 2 965 |                  276 |  0,9807 |                          0,8628 |                      5 |
| A–D, B retouchée (défaut) |         15 642 | 2 965 |                  275 |  0,9808 |                          0,8629 |                      2 |

Sur les 75 porteurs que B masque, 72 sont des doublons, surtout des « tu »
étiquetés σύ par traduction apprise alors que le grec n'a que la forme verbale.
La retouche corrige les trois autres et Jn 5.17, où « moi » portait à la fois
G2504 et G1473. La référence versionnée de l'audit datait d'avant dec602f8d
(15 850 Strong lecteur, 3 964 vides, 325 risques, qualité 0,978). Elle est
remplacée par celle du moteur par défaut, et le test qui la fige est mis à jour.

**Régénération intégrale de NBS** (`outputs/strong-autonomous/v3`), avec les
contrôles structurels habituels et l'invariant `reader-regression` vérifiés. Le
lot v2 de référence vient d'un code et d'une politique de résolution plus
anciens : l'écart cumule toutes les évolutions depuis, pas seulement A–D.

| Mesure (31 169 versets, 441 276 unités source) |              v2 |     v3 (défaut) |
| ---------------------------------------------- | --------------: | --------------: |
| Unités visibles                                |         345 064 |         348 999 |
| Vides établis                                  |           1 589 |           1 596 |
| Unités incertaines                             | 94 623 (21,4 %) | 90 681 (20,5 %) |
| Versets entièrement comptabilisés              |           3 372 |           3 585 |
| Strong lecteur                                 |         360 091 |         359 785 |
| Risques de placement                           |           6 147 |           6 063 |
| Couverture des porteurs de référence           |          0,8557 |          0,8576 |
| Strong de référence absents                    |              73 |              90 |

Les versets signalés pour la source passent de 49 à 95 à cause d'un diagnostic
ajouté par dec602f8d (46 versets où la correspondance retombe sur la
numérotation native) ; les blocs de correspondance sont identiques.

Les 17 Strong de référence absents en plus viennent tous de B, dans 16 versets :
B masque un identifiant que les témoins attendent, soit une partie d'un composé
(Lc 2.48, κἀγώ : « moi » perd G2504 ; Lc 15.8, « jusqu'à » perd G2193), soit
le bon identifiant quand les deux sont attestés (Lv 24.10, H3482). Une variante
qui garde tout identifiant encore attendu par les témoins corrige ces cas, mais
elle masque sur le développement S21 des porteurs justes transférés exactement
(Ec 11.8, Ac 28.4, Ap 4.11) et n'améliore pas les mesures S21 : elle n'est pas
retenue (`replay/b-need/`). La correction de fond est en amont : rattacher un
porteur transféré au mot source dont l'identité principale correspond, avant
l'identifiant alternatif d'un autre mot.

**Régénération intégrale de NFC**, Bible libre choisie pour ce premier passage,
depuis sa publication canonique complète (73 livres) et vérifiée de la même
façon. Sur 441 053 unités source : 267 388 visibles, 642 vides établis et
173 023 incertaines (39,2 %, contre 20,5 % pour NBS). Comme prévu pour une
traduction dynamique, le moteur s'abstient deux fois plus souvent plutôt que de
placer au hasard : qualité de placement 0,979, couverture des porteurs de
référence 0,686. Sur les 4 325 versets signalés pour la source, 4 048 sont
deutérocanoniques, hors du corpus source STEP : aucun Strong n'y est inventé.

## Limites

- **Accord éditorial, pas vérité.** Concordance est une référence humaine
  corrigée après une affectation automatique ; la revue assistée y trouve des
  erreurs. L'accord mesure la compatibilité avec ses conventions (locutions,
  marqueurs d'objet non annotés, articles), pas une justesse sémantique.
- **Proximité des témoins.** LSG, Darby et DarbyR viennent de la même équipe :
  le scénario « cible exclue » bénéficie de conventions partagées. NEG79 est
  presque un transfert de LSG ; seul le scénario sans LSG teste une généralisation,
  et le dictionnaire garde une dépendance indirecte à LSG pour les noms propres.
- **Échantillon borné.** 48 chapitres par édition, une seule acquisition datée ;
  les annotations du site évoluent (les CSV témoins en diffèrent déjà d'environ
  2,4 %). Les intervalles d'incertitude ne sont pas calculés ; les écarts des
  améliorations sont petits mais de même signe sur les sept configurations, au
  développement comme au test.
- **Positions NT.** NA et TAGNT ne numérotent pas toujours les mots de la même
  façon ; l'évaluateur rapproche le même Strong voisin, ce qui peut rarement
  apparier deux mots différents de même Strong.
- **Abstention et vides.** Environ un cinquième des occurrences source restent
  incertaines, et aucun vide de Concordance n'est établi comme tel. Une
  incertitude n'est pas une absence ; elle n'est pas comptée comme un succès, et
  la proportion de versets entièrement comptabilisés reste faible (12 %).
- **Revue non indépendante.** Les jugements des échantillons sont ceux de
  l'assistant, exposé aux prédictions et à la référence.
- **Laya local** n'a pas été intégré : le comparatif du 1er octobre le mesurait à
  18 % de choix conformes avec une forte sensibilité à l'ordre des options, et la
  présente analyse montre que le premier verrou est la génération de candidats
  (807 abstentions SG21 de développement sans aucun candidat) plutôt que leur
  classement. Aucun modèle distant n'a été appelé.

## Recommandations

1. **Moteur commun.** Fait : A, B (retouchée) C et D sont actives par défaut
   pour toutes les Bibles, sans branchement par édition (section 11). La
   génération des neuf Bibles n'a pas été relancée.
2. **Adaptations par Bible.** Aucune adaptation de moteur n'est justifiée pour
   S21 ni, au vu de ses résultats, pour NEG79. L'adaptation nécessaire pour NEG79
   concerne **les données** : rétablir les sauts de ligne perdus (201 mots soudés
   et environ 4 900 ponctuations collées au mot suivant) et vérifier les limites
   de versets du texte local avant toute génération.
3. **Identité des occurrences répétées.** C'est la principale source d'erreurs
   visibles restantes (articles grecs, occurrences inversées) et d'une partie des
   abstentions. Les CSV témoins n'ont pas de positions source, alors que les pages
   Concordance actuelles de LSG et Darby en portent. Un export autorisé des témoins
   avec positions BHS/NA permettrait de transférer l'identité de l'occurrence, pas
   seulement le Strong, et d'actualiser des instantanés déjà dérivés d'environ 2,4 %.
4. **Locutions.** Décision : locution complète. Elle doit venir des témoins
   autorisés qui la portent (groupes de l'export OSIS de Concordance), jamais de
   la cible évaluée.
5. **Candidats lexicaux modernes.** Les abstentions sans candidat
   (« recouvriront », « végétation », « monstruosités », « pièges ») demandent un
   apport lexical validé (gloses françaises vérifiées, morphologie) plutôt qu'un
   classement par modèle local, qui n'a rien à classer dans ces cas.
6. **Évaluations futures.** Garder les corrections éditoriales désactivées dans
   toute évaluation S21 ou NEG (les deux entrées S21 venues de Concordance sont
   retirées), et ne plus présenter les chapitres de développement ni de test de
   cette expérience comme une réserve vierge : le test a été rouvert une seconde
   fois pour l'addendum de la section 11.

## Validation logicielle

- 24 nouveaux tests : outil (parseur, alignement, plan, garde de fuite, graphe
  d'import, classement des occurrences, renumérotation), moteur (enclitiques,
  numéraux, variantes invariantes, identifiants alternatifs, préférence des
  témoins, options par défaut) et réparation NEG79 (sauts de ligne, plages des
  paroles de Jésus).
- Suite du workspace : **1 135 tests, 1 112 réussis, 22 échecs, 1 ignoré**. Les
  22 échecs sont exactement les échecs préexistants du lexique V3 consignés au
  checkpoint ; aucun nouvel échec.
- `yarn typecheck` réussi ; typage strict des nouveaux scripts et tests réussi ;
  ESLint et Prettier sans erreur sur les fichiers modifiés.
- `yarn build` : les 6 erreurs TS6059 préexistantes (imports de scripts hors de
  `rootDir: src`), identiques au checkpoint. Le build réécrit au passage trois
  fichiers `.js` suivis sous `scripts/` ; ils ont été restaurés.

## Reproduction et artefacts

Commandes complètes : [README de l'outil](../scripts/strong-concordance-rebuild/README.md).
Scripts de lot conservés sous `outputs/strong-concordance-night/` :
`run-initial-predictions.sh`, `run-development-ablation.sh`,
`rescore-development.sh`, `run-test.sh`, `run-canary.sh`, puis pour la section
11 `run-b-witness.sh`, `run-test-v2.sh` et `run-canary-v3.sh`.

Les générations intégrales (`src/strongAutonomous.ts <racine> <bible>`)
demandent un tas Node d'environ 12 Go
(`NODE_OPTIONS="--max-old-space-size=12288"`) : avec les 4 Go par défaut, NBS
échoue faute de mémoire pendant la génération.

| Artefact (sous `outputs/strong-concordance-night/`)            | Contenu                                             |
| -------------------------------------------------------------- | --------------------------------------------------- |
| `plan.json`                                                    | découpage figé et sélections antérieures exclues    |
| `acquisition/`, `acquisition-seal-v1.json`                     | pages brutes, reçus, sceau                          |
| `initial-state.json`, `initial-code/`                          | empreintes des entrées et code initial              |
| `initial-predictions.json`, `predictions/`                     | prédictions scellées et manifestes                  |
| `adoption-criteria.json`, `development-decision-v3.json`       | critères puis décision                              |
| `freeze-v1.json`, `freeze-v1b.json`, `freeze-v1-addendum.json` | gel, gel corrigé (User-Agent seul) et justification |
| `scores/strong-concordance-rebuild-score-v3/`, `reports/`      | évaluations et synthèses                            |
| `provenance/`                                                  | instantanés des témoins, proximité, transférabilité |
| `evaluator-only/review/`                                       | dossiers et verdicts de la revue assistée           |
| `replay/`, `canary/`, `logs/`                                  | rejeux, canaris historiques, journaux               |
| `development-decision-v4.json`, `freeze-v2.json`               | retouche de B : décision et gel                     |
| `replay/b-witness/`                                            | B retouchée : développement et addendum du réservé  |
| `../strong-audit/nbs-initial`, `nbs-default`, `nbs-default-b2` | audits NBS 10×5 de la section 11                    |
