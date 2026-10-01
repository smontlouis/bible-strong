# NEG79 : rétablissement des sauts de ligne perdus

Correction préparée le 1er octobre 2026 à la suite de la
[reconstruction S21](./strong-concordance-reconstruction-2026-10-01.md), qui
avait montré que l'adaptation nécessaire à NEG79 porte sur son texte, pas sur
le moteur Strong. Rien n'a été publié ni activé.

## Défaut

La conversion de la source NEG79 (`bible-neg79.json`) a supprimé les sauts de
ligne internes des versets poétiques et des citations, sans les remplacer par
une espace : « écoutez ma voix!Femmes de Lémec », « du cielEt de la graisse ».
Les autres Bibles françaises (NBS, BDS, S21, NVS78P) gardent ces sauts sous la
forme « \n ». Conséquences :

- le lecteur affiche la poésie en un bloc et certaines vues collent les mots ;
- la segmentation fusionne deux mots, ce qui fausse l'alignement Strong ;
- 13 versets NEG de l'expérience S21 n'étaient pas comparables à
  Concordance.bible, dont 7 à cause de ces soudures.

## Réparation

Une ligne poétique NEG79 commence par une majuscule. Une soudure est donc une
majuscule collée à une ponctuation de fin de ligne (`, ; : . ! ? … )`) ou à une
minuscule. La prose qui reprend après une citation commence en minuscule juste
après une ponctuation. À chaque soudure, l'outil insère « \n ». Le lecteur
(`white-space: pre-line`) l'affiche comme un saut de ligne, et les vues qui
retirent les « \n » gardent une espace.

| Règle                                 | Sauts rétablis |
| ------------------------------------- | -------------: |
| ponctuation puis majuscule            |          4 939 |
| minuscule puis majuscule (« cielEt ») |            243 |
| ponctuation puis minuscule            |              5 |
| **total**                             |      **5 187** |

Les sauts rétablis touchent 3 982 versets, surtout les Psaumes (3 074) et les
Proverbes (966). Aucune soudure entre deux minuscules n'a été trouvée : les mots
NEG79 absents des autres Bibles et décomposables en deux mots connus sont des
formes rares légitimes.

Laissés tels quels et signalés pour relecture :

- Nombres 21.14, « : …Vaheb » : les points de suspension ouvrent la citation ;
- 2 Chroniques 30.20, « L ‘Eternel » : coquille d'apostrophe, pas un saut de
  ligne ;
- Ésaïe 41.15, « collinesa » : appel de note collé, invisible pour ces règles.

## Paroles de Jésus

Les décisions sont ancrées par l'empreinte du texte du verset et par des
positions UTF-16. Les 26 décisions dont le verset change sont réancrées : leurs
plages sont déplacées (un saut inséré au bord d'une plage reste à l'extérieur)
et leur texte, séparateurs retirés, reste identique. Avant et après la
réparation, 2 028 versets et 2 062 plages s'appliquent sans dérive.

## Vérifications

- Retirer les séparateurs insérés redonne la source à l'identique, verset par
  verset ; le fichier réparé garde le même JSON compact.
- Paquet NEG79 reconstruit localement avec le texte réparé et les décisions
  réancrées : 31 169 versets et 1 146 titres inchangés ; 3 982 versets ne
  diffèrent que par les séparateurs ; révision de texte `neg79-b85d4965811458a60836`
  → `neg79-5d88218c83a02a008f88`.
- Comparaison avec Concordance.bible sur les 48 chapitres NEG de l'expérience :
  13 versets non comparables avant, 6 après. Cinq tiennent à des limites de
  versets traditionnelles (Rm 1.29 et 1.31, Jr 38.28, Mt 13.3, Ac 28.26), un à
  une variante de texte (Mi 7.14, « au jour » contre « aux jours »).
- Aucune limite de verset ne bouge : le manifeste de correspondance NEG79 reste
  valable. NEG79 n'a pas de fichier Strong publié à réapparier ; une génération
  Strong future devra partir du texte réparé.

## Reproduction

Depuis `apps/resource-studio` :

```sh
yarn exec tsx scripts/neg79-line-breaks/run.ts \
  --output-dir outputs/neg79-line-breaks/<date>
```

La commande lit `data/bibles/bible-neg79.json` et
`workflows/words-of-jesus/data/neg79.jsonl`, puis écrit sous le dossier de sortie
(ignoré par Git) :

- le texte réparé `bible-neg79.json` et `report.json` (comptes, empreintes,
  soudures non réparées) ;
- `review.md`, le contexte de chaque saut pour une relecture locale ;
- le jeu de décisions réancré `neg79.jsonl` ;
- `source-overrides.json` pour la mise en paquet et
  `words-of-jesus-text-overrides.json` pour `resources:words-of-jesus`.

## Reste à faire (publication)

La publication reste une décision manuelle. Le texte réparé et les décisions
réancrées doivent changer ensemble :

1. Publier le texte réparé comme source NEG79. Un nouveau nom d'asset évite le
   cache local, qui ne retélécharge jamais une URL déjà connue
   (`outputs/bible-sources/cache`), et laisse l'ancien fichier aux versions
   anciennes de l'app.
2. Dans le même changement, pointer `config/ordinary-bible-sources.json` vers ce
   nouvel asset et remplacer `workflows/words-of-jesus/data/neg79.jsonl` par le
   fichier réancré.
3. Vérifier (`yarn resources:words-of-jesus check --version NEG79`), mettre NEG79
   en paquet (`--version NEG79`), puis l'activer.
