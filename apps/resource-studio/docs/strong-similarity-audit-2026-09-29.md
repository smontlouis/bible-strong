# Audit des ressemblances entre lexique historique et STEP — 29 septembre 2026

Audit en lecture seule des trois publications actives dans Neon. Aucun changement
d’affichage, aucune suppression, aucun import ni publication R2 pendant cet audit.

## Résultat principal

En français, **1 601 Strong classiques distincts** ont au moins une notice STEP
présentant une ressemblance textuelle globale d’au moins 70 % avec l’historique.
Cela représente **1 674 notices STEP**, car un Strong classique peut avoir plusieurs
variantes suffixées. Avec un seuil de 60 %, le nombre devient **2 393 Strong
classiques / 2 545 notices STEP**.

En ajoutant les reprises partielles d’un texte par l’autre (au moins cinq mots dans
le texte court), on obtient **2 342 Strong classiques / 2 534 notices STEP** en FR.
Ce deuxième ensemble mélange des notices proches et des notices de périmètres
partiellement communs : ce n’est pas une liste de définitions supprimables.

## Périmètre et décompte

Une paire compare une notice STEP à son entrée historique, dans la même langue
éditoriale. Rapprochement par `language + baseCode`, et non en supprimant les lettres
d’un identifiant. Les suffixes conservent leur casse. Les IDs numériques propres aux
publications ne servent pas à joindre l’historique à STEP.

Une famille classique est comptée une seule fois si au moins une variante satisfait
le critère. Deux variantes d’une famille peuvent avoir des résultats très différents.
Les familles ne doivent donc pas être additionnées entre les catégories : elles
peuvent se chevaucher, même si les catégories de paires sont disjointes.

| Corpus | Paires comparables | Strong classiques comparables | Notices ≥70 % | Strong classiques ≥70 % |
|---|---:|---:|---:|---:|
| FR hébreu | 11 632 | 8 673 | 1 673 | 1 600 |
| FR grec | 5 707 | 5 521 | 1 | 1 |
| EN hébreu | 11 633 | 8 674 | 4 | 4 |
| EN grec | 5 705 | 5 519 | 0 | 0 |

Le répertoire STEP contient 22 717 entrées par langue éditoriale. Sont comparables
17 339 paires FR et 17 338 EN. Les autres n’ont pas deux définitions textuelles
exploitables et ne sont pas classées comme « différentes ». Une entrée historique
ne disposant pas d’une variante comparable n’entre pas dans les dénominateurs.

## Sensibilité au seuil — nombres de Strong classiques distincts

| Corpus | ≥60 % | ≥70 % | ≥80 % | ≥90 % | Mêmes mots dans le même ordre |
|---|---:|---:|---:|---:|---:|
| FR hébreu | 2 390 | 1 600 | 1 145 | 771 | 686 |
| FR grec | 3 | 1 | 1 | 1 | 0 |
| EN hébreu | 23 | 4 | 1 | 0 | 0 |
| EN grec | 1 | 0 | 0 | 0 | 0 |

## Reprises partielles, hors notices globalement similaires à 70 %

Ces paires ont moins de 70 % de ressemblance globale, mais au moins 70 % des mots du
texte court se retrouvent dans le texte long, dans le même ordre. Cela détecte
notamment une définition spécifique contenue dans une notice historique générale.

| Corpus | Notices partielles (texte court ≥5 mots) | Strong classiques concernés | Cas courts (1–4 mots), à part |
|---|---:|---:|---:|
| FR hébreu | 735 | 635 | 800 |
| FR grec | 125 | 122 | 383 |
| EN hébreu | 52 | 49 | 623 |
| EN grec | 8 | 8 | 3 |

Les reprises très courtes restent à part pour ne pas qualifier deux notices de
semblables sur la seule présence de mots courants. Elles comprennent toutefois de
vrais cas utiles, comme H7819B. Une reprise partielle ne prouve pas que le surplus
concerne le sens sélectionné.

## Exemples fournis par l’utilisateur

| Notice FR | Ressemblance globale | Part du texte court retrouvée | Lecture |
|---|---:|---:|---|
| H7819B | 20.0 % | 100.0 % | 4 mots sur 4 repris ; la notice historique couvre davantage de sens. |
| H5662H | 11.6 % | 26.3 % | Notice historique regroupant des homonymes ; STEP décrit un personnage précis. |
| H4601K | 12.7 % | 16.1 % | Même différence de périmètre entre plusieurs Maaca et une personne précise. |
| H0030 | 14.7 % | 19.2 % | Informations biographiques et relations familiales complémentaires. |
| H5175 | 70.6 % | 75.0 % | Deux notices brèves avec une variation volant/fuyard. |
| H4191 | 72.5 % | 82.5 % | Ressemblance globale forte malgré une notice STEP plus longue. |
| H8064 | 59.3 % | 64.0 % | Reformulations et équivalent araméen ; le score lexical sous-estime la proximité de sens. |
| H3605 | 37.8 % | 53.8 % | Reformulations importantes et équivalent araméen ; score lexical bas malgré le sujet commun. |

## Méthode et limites

- HTML retiré et entités HTML décodées ; casse, ponctuation et numérotation des sens
  ignorées, y compris les niveaux `1a1`, `1d1a`, etc. Diacritiques conservés.
- Le libellé initial `: gloss` est retiré uniquement lorsqu’il répète le libellé
  visible. La définition elle-même n’est pas résumée ni traduite.
- Score global : `2 × LCS / (mots historiques + mots STEP)`, où LCS est le nombre
  de mots de la plus longue sous-séquence commune. Les répétitions comptent et
  l’ordre est conservé.
- Reprise partielle : `LCS / nombre de mots du texte court`.
- Toutes les paires sont calculées, sans limite de longueur de la notice avancée ni
  veto sur les liens. Les différences de liens sont consignées dans le CSV.
- Ce sont des **ressemblances textuelles**, pas un jugement de qualité, une preuve
  d’équivalence sémantique ou une validation d’effacement. Les synonymes et les
  traductions reformulées sont sous-détectés. Un nombre exact de notices de même
  sens nécessiterait une annotation éditoriale distincte.

L’audit est plus large que le masquage actuel : celui-ci conserve les notices trop
longues ou ayant des liens différents, et son nettoyage des anciennes numérotations
est légèrement moins complet. Ses 1 476 cas FR masqués ne sont donc pas le nombre
total de ressemblances trouvées ici.

## Variantes suffixées

En hébreu FR, 4 350 des 11 632 notices comparables portent un suffixe. Parmi les
1 673 notices atteignant 70 %, 181 sont suffixées. Parmi les 1 600 familles classiques
ayant une variante ≥70 %, 1 515 ont toutes leurs variantes comparables ≥70 % ;
85 ont un résultat mixte. Une règle globale par numéro classique serait donc déjà
inexacte pour ces 85 familles.

## Reproductibilité

Snapshot et résultats locaux dans `outputs/legacy-strong/audit-2026-09-29/` :
`read-production.cjs`, `production.json`, `audit.ts`, `results.json`, `comparisons.csv`.
Le CSV contient les deux textes, le Strong classique, la variante, la langue, les
scores, les longueurs et l’état du masquage courant pour chaque paire comparable.
Le script de lecture ne fait que des SELECT dans une transaction READ ONLY.

Depuis la racine :

```sh
node apps/resource-studio/outputs/legacy-strong/audit-2026-09-29/read-production.cjs
apps/expo/node_modules/.bin/tsx --tsconfig apps/expo/tsconfig.json \
  apps/resource-studio/outputs/legacy-strong/audit-2026-09-29/audit.ts
```

Révisions actives examinées :

- `strong-lexicon:core` : `strong-lexicon-core-fe91da3f72fe28da25c60833`
- `strong-lexicon:simple-en` : `strong-lexicon-simple-en-784af9ff9fc29bf892cb0b55`
- `strong-lexicon:simple-fr` : `strong-lexicon-simple-fr-944bd06dc903ffaf83df9b51`
