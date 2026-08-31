# Renvois internes des dictionnaires

_Audit et enrichissement local exécutés le 31 août 2026. Aucune publication en production n’a été
effectuée._

## Modèle

Un **renvoi d’entrée de dictionnaire** est un lien attesté depuis le texte d’un article vers une
entrée exacte du même dictionnaire. Il ne signifie ni que les deux articles sont synonymes, ni que
leurs contenus doivent être fusionnés.

Chaque lien normalisé conserve :

- le titre canonique de la destination ;
- l’identifiant SQLite exact de la destination ;
- son origine, `source` pour une ancre préexistante, `cue` pour un renvoi éditorial explicite
  (`See`, `Voir`, etc.) ou `generated` pour un renvoi ajouté par rapprochement automatique.

## Nettoyage de Westphal

Les 71 224 renvois historiques ont été contrôlés contre les 5 436 entrées réelles :

- les copies strictement identiques d’une même entrée sont ramenées à un identifiant canonique ;
- les variantes explicites comme `Hérode` → `Hérodes (les)` sont résolues ;
- les variantes orthographiques attestées par un ancien lien sont tolérées seulement lorsqu’une
  destination unique existe ;
- les auto-liens, qui rechargeraient l’article courant, sont retirés ;
- aucun renvoi historique Westphal n’est abandonné faute de destination.

Après nettoyage, Westphal conserve 66 647 ancres éditoriales utiles, retire 4 577 auto-liens,
transforme 826 indications `Voir` explicites et reçoit 5 930 renvois sûrs supplémentaires.

## Renvois explicites See / Voir

Avant la génération conservatrice, le pipeline traite les consignes éditoriales `See`, `See also`,
`Voir`, `Voir aussi` et `Voyez`, sans exiger la casse exacte. Seuls les intitulés réellement présents
dans le même dictionnaire sont liés ; une mention bibliographique sans destination reste du texte.

Les listes séparées par un point-virgule sont prises en charge. Lorsqu’un renvoi comporte une
section, comme `See KEDESH, 3`, le numéro sert à lever une ambiguïté entre plusieurs entrées puis est
conservé dans `data-entry-section`. Le lecteur ouvre l’entrée exacte et se positionne sur la section
visée.

## Génération conservatrice

Le pipeline analyse toutes les définitions des huit dictionnaires, mais ne transforme pas chaque
mot qui ressemble vaguement à un titre. Une destination automatique doit :

1. appartenir à un sujet corroboré par au moins deux dictionnaires ;
2. correspondre exactement au texte et à sa casse ;
3. comporter une majuscule, sauf s’il s’agit d’un nom biblique attesté ;
4. ne pas être un verbe ambigu connu ni un terme très court non attesté ;
5. ne pas provenir d’un complément Webster généraliste ;
6. être différente de l’article courant.

Une seule occurrence automatique est liée par destination et par article. Les ancres bibliques,
les renvois éditoriaux, les blocs de code et les autres éléments HTML structurants sont préservés.
Cette règle élimine notamment le faux positif observé sur le mot courant français `juste`.

## Résultat

Le résultat courant contient 242 495 renvois internes : 76 684 ancres préexistantes validées,
6 050 renvois `See`/`Voir` et 159 761 renvois générés. Le rapport détaillé et reproductible est écrit dans
`.local/normalized/entry-links.report.json`.

La reconstruction complète exécute automatiquement cette étape. Elle peut également être rejouée
sur une bibliothèque déjà normalisée avec :

```bash
yarn resources:dictionaries:entry-links
```
