# Mentions courtes de copyright des commentaires

Recherche du 30 août 2026. L'objectif est un libellé utilisateur bref : titulaire ou éditeur seulement lorsqu'il est établi, licence le cas échéant, sans historique d'acquisition ni détail d'autorisation interne.

## Recommandation

| Ressource | Libellé court recommandé | Confiance | Motif synthétique |
| --- | --- | --- | --- |
| `mhy-fr` | `© Éditions CLÉ et Dominique Osché · tous droits réservés` | Moyenne | La notice de l'édition française publiée attribue le copyright 2010 à ces deux titulaires. Le corpus local nomme Dominique Osché, mais son identité exacte avec l'édition CLÉ reste à archiver formellement. |
| `aquifer-fr` | `© Mission Mutual / Tyndale House Publishers · CC BY-SA 4.0` | Élevée | Le dépôt officiel attribue l'adaptation Aquifer à Mission Mutual et l'œuvre adaptée à Tyndale House Publishers, sous la même licence. |
| `rashi-en` | `Metsudah Publications / Judaica Press · CC BY` | Élevée pour l'édition et la licence | Le corpus assemble des traductions de ces deux éditeurs. Le titulaire juridique exact n'étant pas déclaré, le symbole `©` est volontairement omis. |
| `king-comments` | `© Ger de Koning · tous droits réservés` | Élevée | Le site officiel de l'auteur porte une notice de copyright à son nom et « All rights reserved ». |
| `mhm` | `STEPBible · CC BY 4.0` | Élevée | STEPBible demande que l'adaptation moderne soit attribuée à son dépôt de données et la publie sous CC BY 4.0. |
| `rwp` | `Domaine public` | Élevée pour le texte | Le manifeste source CrossWire précise que les copyrights renouvelés des volumes 5 et 6 ont expiré fin 2006 et fin 2007 ; les volumes 1 à 4 y sont déjà déclarés dans le domaine public. |
| `douay-rheims-notes` | `CC0 1.0` | Élevée | Le dépôt source place explicitement le jeu de données et ses annotations sous CC0, sans attribution requise. |
| `bible-annotee` | `Tous droits réservés` | Moyenne | Le manifeste local confirme l'autorisation et ThéoTeX comme fournisseur, mais ne nomme pas un titulaire. Ne pas afficher `© ThéoTeX` sans pièce établissant cette titularité. |
| `sdabc` | `Tous droits réservés` | Moyenne | Review and Herald est l'éditeur et titulaire historique de l'édition, mais les sources consultées n'établissent pas avec assez de certitude le titulaire actuel après les changements institutionnels de l'éditeur. |

## Sources et réserves

### `mhy-fr`

La [notice numérique de l'édition française](https://biblia.com/books/ec-ldpmhecomconcis) donne la traduction à Yvon L'Hermitte et Dominique Osché, l'éditeur Éditions CLÉ, et un copyright 2010 détenu par Éditions CLÉ et Dominique Osché. Le [manifeste local](../../apps/resource-studio/outputs/resource-publications/editorial/mhy-fr/manifest.json) attribue bien la traduction française à Dominique Osché, mais qualifie par erreur ou raccourci l'ensemble de « Public domain ». En l'absence d'un identifiant éditorial ou d'un hash reliant formellement le fichier reçu à l'édition CLÉ, la mention proposée est solide pour l'édition publiée mais reste à confirmer pour le fichier exact.

### `aquifer-fr`

Le [README officiel Aquifer Open Study Notes](https://github.com/BibleAquifer/AquiferOpenStudyNotes#license) indique : adaptation Aquifer © 2026 Mission Mutual, adaptée de Tyndale Open Study Notes © 2023 Tyndale House Publishers, les deux sous CC BY-SA 4.0. La [page officielle Tyndale Open Resources](https://tyndaleopenresources.com/) confirme la licence CC BY-SA 4.0 de Tyndale Open Study Notes. `Tyndale House Cambridge` désigne une autre organisation et ne convient pas à cette ressource.

### `rashi-en`

La [page officielle Sefaria des sources et licences](https://lite.sefaria.org/sources-and-licenses) et les fiches de texte Sefaria, par exemple [Rashi on Isaiah](https://www.sefaria.org/Rashi_on_Isaiah.48.16.2?lang=bi&ven=english%7CThe_Judaica_Press_complete_Tanach_with_Rashi&with=About), déclarent les traductions Metsudah Publications ou Judaica Press/A. J. Rosenberg sous CC-BY. L'[audit local des éditions](../../apps/resource-studio/workflows/commentaries/data/audit/waves-1-2.json) confirme que les 39 livres importés proviennent de ces deux familles éditoriales. Sefaria est le fournisseur et numériseur, pas un titulaire de copyright établi pour ces traductions.

### `king-comments`

La [page d'information officielle de Ger de Koning](https://www.kingcomments.com/en/Information) porte une notice de copyright au nom de l'auteur et réserve tous les droits. Le [manifeste CrossWire local](../../apps/resource-studio/workflows/commentaries/.local/sources/wave-3/installed/mods.d/kingcomments.conf) déclare en outre `Copyrighted; Free non-commercial distribution` et donne l'auteur comme source. La permission particulière de Bible Strong reste une donnée interne et n'a pas à apparaître dans l'application.

### `mhm`

La [fiche officielle STEPBible MHM](https://www.stepbible.org/version.jsp?version=MHM) indique que le commentaire original est dans le domaine public, que le réarrangement moderne a été réalisé par STEPBible en 2025, qu'il est sous CC BY 4.0 et qu'il faut attribuer `stepbible.github.io/STEPBible-Data/`. Le libellé `STEPBible · CC BY 4.0` satisfait cette attribution en restant court.

### `rwp`

Le [manifeste CrossWire livré avec le module](../../apps/resource-studio/workflows/commentaries/.local/sources/wave-3/installed/mods.d/rwp.conf) est plus précis que son champ générique `DistributionLicense` : volumes 1 à 4 dans le domaine public, copyright du volume 5 expiré le 31 décembre 2006 et celui du volume 6 le 31 décembre 2007. La mention actuelle « tous droits réservés » est donc contredite par la notice détaillée de la source. La recommandation porte sur le texte ; d'éventuels éléments éditoriaux ajoutés séparément devraient être examinés à part.

### `douay-rheims-notes`

Le [dépôt source au commit importé](https://github.com/janvier-s/original-douay-rheims/tree/0bf4218b9b46b5b00d29a703b5b74226051b97a5) déclare le jeu de données sous [CC0 1.0](https://github.com/janvier-s/original-douay-rheims/blob/0bf4218b9b46b5b00d29a703b5b74226051b97a5/LICENSE), sans attribution requise. Le [manifeste d'import local](../../apps/resource-studio/workflows/commentaries/.local/douay-rheims-export/manifest.json) épingle ce même commit et `CC0-1.0`.

### `bible-annotee`

Le [manifeste local](../../apps/resource-studio/workflows/commentaries/.local/bible-annotee-export/manifest.json) identifie ThéoTeX comme fournisseur et confirme une autorisation d'usage, de transformation et de redistribution. Ni ce manifeste ni les pages sources [Ancien Testament](https://theotex.org/ba/) et [Nouveau Testament](https://theotex.org/nta/) ne fournissent une notice suffisamment explicite pour identifier le titulaire actuel du corpus numérique. La formulation générique est donc la plus sûre.

### `sdabc`

Le [manifeste local](../../apps/resource-studio/workflows/commentaries/.local/sdabc-export/manifest.json) identifie F. D. Nichol, la Seventh-day Adventist Church et l'édition 1978. Les archives adventistes confirment que le commentaire a été produit et publié par Review and Herald Publishing Association, notamment dans cette [annonce historique officielle](https://documents.adventistarchives.org/Periodicals/RH/RH19570919-V134-38.pdf). Cela établit l'éditeur historique, pas de façon suffisante le titulaire actuel. L'autorisation de Bible Strong est confirmée localement mais doit rester hors du libellé public.

## Règle d'affichage suggérée

Afficher uniquement le libellé de la colonne « Libellé court recommandé ». Conserver les preuves, permissions, dates, sources techniques et réserves dans les manifests ou audits internes. Ne jamais déduire un titulaire du seul champ `author`, `provider` ou `source`.
