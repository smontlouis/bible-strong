# Correspondances entre dictionnaires

_Index local généré le 31 août 2026. Aucune publication en production n’a été effectuée._

## Modèle

Une **correspondance d’entrée de dictionnaire** relie plusieurs articles qui traitent du même sujet
sans fusionner leur texte. Un **groupe de correspondance** contient les identités exactes des
articles, leurs intitulés réels, leur langue et les stratégies qui ont justifié le rapprochement.

Le fichier généré est
`workflows/dictionaries/.local/normalized/correspondences.json`. Il est reconstruit après chaque
normalisation complète, ou séparément avec :

```bash
yarn resources:dictionaries:correspondences
```

## Règles de rapprochement

Le générateur applique, dans cet ordre, des règles déterministes :

1. même intitulé normalisé dans une même langue ;
2. variantes explicitement déclarées dans un intitulé, par exemple `Nebuchadnezzar; Nebuchadrezzar`,
   `Nebuchadnezzar, or Nebuchadrezzar` ou une forme française avec `ou` ;
3. translittération prudente entre le français et l’anglais pour les noms bibliques attestés par
   les 355 sujets de `bible/names` issus de Translation Words.

La translittération neutralise notamment les accents, certaines variantes de consonnes et les
lettres doublées. Elle n’est appliquée qu’à partir d’un nom canonique anglais attesté vers les
entrées d’une autre langue. Cette asymétrie évite des faux rapprochements anglais comme
`Baal`/`Ball`, `Cain`/`Chain`, `Seth`/`Sheet` ou `Shem`/`Seem`.

Les homographes génériques français/anglais ne sont pas liés automatiquement : `pain`, par exemple,
ne suffit pas à démontrer qu’un article français et un article anglais parlent du même concept.
Les concepts traduits dont les mots sont très différents devront être ajoutés ultérieurement à un
lexique bilingue contrôlé plutôt que devinés.

## Résultat actuel

- 36 526 entrées analysées dans huit dictionnaires ;
- 8 069 groupes reliant au moins deux œuvres ;
- 21 785 entrées reliées ;
- 125 groupes bilingues français/anglais.

Le cas `Nébucadnetsar` relie huit articles : les formes `Nébucadnetsar`, `Nebucadnetsar`,
`Nebuchadnezar`, `Nebuchadnezzar`, `Nebuchadrezzar` et les deux intitulés anglais qui déclarent
explicitement les variantes. La preview affiche ces articles comme destinations séparées et permet
de passer de l’un à l’autre.

## Limites assumées

Le résultat est un _best effort_ à haute précision, pas une traduction automatique du dictionnaire.
Les titres composés peuvent encore créer une ambiguïté éditoriale réelle ; ils restent auditables
parce que chaque groupe conserve sa stratégie et ses membres. L’index est aujourd’hui un artefact
du pipeline local et de la preview : son transport dans les paquets publiés et son exposition dans
l’application mobile constituent une étape distincte.
