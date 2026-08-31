# Smith / Easton + Webster — audit de chevauchement

_Audit reproductible exécuté le 31 août 2026 avec `yarn resources:dictionaries:audit-smith`._

## Décision

**Smith mérite une ressource anglaise séparée.** Le chevauchement des intitulés est important, mais
les textes ne sont généralement pas des copies d’Easton et Smith apporte encore un noyau substantiel
d’articles absents de la base actuelle. Il ne faut ni fusionner silencieusement Smith dans
Easton + Webster, ni présenter le module CrossWire comme une transcription pure de 1884.

**Décision mise en œuvre : solution 1.** Bible Strong conserve la transcription numérique CrossWire
et ses enrichissements, en les déclarant dans l’édition et le manifeste de provenance.

## Source contrôlée

- Module : `Smith`, version 1.3 du 15 décembre 2001.
- Fournisseur : CrossWire.
- Licence déclarée : `Public Domain`.
- Archive : [Smith.zip](https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/Smith.zip).
- SHA-256 épinglé : `88a2c2d11f70b2484fa39d61a8e821849dca799d51e1593e8a2839f6313a8f9a`.
- Format : SWORD RawLD / ThML, texte Windows-1252.

L’extraction produit 4 639 notices, représentant 4 561 intitulés normalisés distincts. Les 78 notices
supplémentaires correspondent principalement à des homonymes partageant un même intitulé.

## Chevauchement des intitulés

La comparaison porte sur la ressource Bible Strong actuelle `Easton + Webster 1828`, soit 8 620
entrées. Elle applique deux niveaux conservateurs : intitulé normalisé exact, puis variantes uniques
de ponctuation, d’alternatives « or » et d’ordre des mots fonctionnels.

| Mesure                                               |       Résultat |
| ---------------------------------------------------- | -------------: |
| Intitulés Smith distincts                            |          4 561 |
| Correspondances exactes                              | 2 765 (60,6 %) |
| Correspondances de variante non ambiguës             |    116 (2,5 %) |
| Correspondances totales                              | 2 881 (63,2 %) |
| Correspondances portant réellement une notice Easton |          2 669 |
| Correspondances avec Webster seulement               |             96 |
| Intitulés encore propres à Smith                     | 1 680 (36,8 %) |

Parmi les 1 680 intitulés non retrouvés, 730 définitions dépassent 200 caractères et 173 dépassent
1 000 caractères. Il ne s’agit donc pas seulement d’une longue traîne de variantes et de renvois.
On trouve notamment des articles développés sur la Palestine, les poids et mesures, les versions
bibliques, les Psaumes, Jésus-Christ, les Lévites, la poésie hébraïque et les miracles.

## Chevauchement textuel

Pour les 2 669 intitulés communs avec Easton, l’audit compare les ensembles de trigrammes de mots,
après retrait du HTML et de la section Webster :

- similarité médiane : **2,1 %** ;
- 23 notices atteignent 25 % ;
- une seule atteint 50 % ;
- aucune n’atteint 75 %.

Cette mesure n’est pas une évaluation théologique : elle indique seulement que Smith et Easton
traitent souvent les mêmes sujets avec des rédactions réellement différentes. Une fusion article par
article ferait perdre la provenance et rendrait les divergences éditoriales difficiles à comprendre.

## Anomalies de transcription

Le module ne peut pas être présenté comme une transcription pure de l’édition 1884. L’article
`BIBLE` mentionne explicitement l’American Standard Version de 1901 et la Revised Standard Version
de 1946. Il contient donc au moins un enrichissement du XXe siècle non identifié dans le manifeste.

L’échantillon révèle également des défauts d’index ou de transcription, par exemple
`HIGH PLACES6813 PRIEST`, ainsi que de nombreuses graphies alternatives et quelques coquilles.
L’encodage Windows-1252 doit être décodé explicitement pour préserver les apostrophes et tirets.

## Intégration réalisée

- Smith est une œuvre autonome `smith:en`, attribuée à Smith, F. N. Peloubet, M. A. Peloubet et
  CrossWire.
- Les 4 639 notices source donnent 4 561 articles ; 78 doublons d’intitulé sont regroupés en
  conservant chaque texte dans l’ordre source.
- L’intitulé corrompu `HIGH PLACES6813 PRIEST` est réparé en `High Priest`. Aucune autre correction
  substantielle du texte source n’est appliquée.
- Les abréviations bibliques SWORD sont normalisées avant le BCV parser. Le corpus final contient
  15 820 liens `bible://` contrôlés, 1 352 liens internes et un index couvrant 18 398 versets.
- Les références source impossibles sont rendues comme texte non cliquable ; aucun lien biblique
  invalide ne subsiste dans l’audit final.
- Le paquet local complet des six dictionnaires passe la validation de manifeste, de contenu SQLite,
  d’archive et de sommes de contrôle. Sa révision Smith est
  `dictionary-smith-en-75550875353ee7228722`.

Les données téléchargées, l’export IMP, les entrées JSON et le rapport exhaustif restent sous
`apps/resource-studio/workflows/dictionaries/.local/smith/` et ne sont pas versionnés.
