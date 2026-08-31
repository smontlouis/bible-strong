# Dictionnaires — lecteur local

Preview HTML locale des dictionnaires configurés dans Resource Studio. Le lecteur ouvre directement
les SQLite de travail : il ne copie pas les corpus, ne contacte aucun service distant et n’effectue
aucune publication.

## Ouvrir le lecteur

Depuis la racine du dépôt :

```bash
yarn resources:dictionaries:test
yarn resources:dictionaries:normalize
yarn resources:dictionaries:audit
yarn resources:dictionaries:audit-smith
yarn resources:dictionaries:acquire-smith
yarn resources:dictionaries:acquire-isbe
yarn resources:dictionaries:acquire-unfoldingword-tw
yarn resources:dictionaries:serve
```

Puis ouvrir <http://127.0.0.1:4178>. Le port peut être changé avec
`DICTIONARY_READER_PORT`.

Le lecteur propose :

- les huit œuvres Westphal, Easton + Webster 1828, Smith, ISBE 1915, Translation Words, Bost,
  Calmet et Lelièvre ;
- un filtre français/anglais et un index alphabétique ;
- une recherche dans les intitulés et les formes normalisées ;
- la pagination et le rendu HTML complet de chaque article ;
- la navigation entre les liens de mots présents dans les définitions ;
- les références bibliques reconnues par le BCV parser, rendues sous forme de liens `bible://` ;
- les métadonnées éditoriales, compteurs, provenance, attribution et droits de chaque ressource.

La configuration canonique reste
`apps/resource-studio/config/resource-publications/dictionary.json`. Une œuvre dont le SQLite est
absent apparaît indisponible. Pour régénérer Bost, Calmet et Lelièvre :

```bash
yarn workspace @bible-strong/resource-studio resources:dictionary:acquire-levangile \
  --work bost --output-dir outputs/dictionary-sources/bost
yarn workspace @bible-strong/resource-studio resources:dictionary:acquire-levangile \
  --work calmet --output-dir outputs/dictionary-sources/calmet
yarn workspace @bible-strong/resource-studio resources:dictionary:acquire-levangile \
  --work lelievre --output-dir outputs/dictionary-sources/lelievre
```

Westphal et Easton + Webster utilisent les SQLite issus du pipeline de publication dictionnaire.
La normalisation travaille sur des copies locales sous `.local/normalized`, sans modifier les SQLite
sources. Elle convertit les anciens liens, détecte les références non liées, supprime les liens
bibliques invalides et reconstruit la table `verses` uniquement à partir des citations contrôlées.
Le lecteur préfère automatiquement ces copies lorsqu’elles existent. Le serveur et le pipeline de
normalisation nécessitent la commande système `sqlite3`.

L’audit Smith télécharge le module SWORD public-domain épinglé, l’extrait dans `.local/smith` et
compare ses intitulés et son contenu à Easton + Webster. Il nécessite également `unzip` et un
exécutable `mod2imp`, configurable avec `--mod2imp`. L’acquisition Smith utilise exactement la
même source épinglée, conserve les enrichissements de la transcription numérique et produit
`outputs/dictionary-sources/smith/smith.sqlite`. Elle corrige uniquement l’intitulé source
manifestement corrompu de l’article « High Priest », fusionne sans perte les notices qui partagent
un même intitulé et consigne ces opérations dans son manifeste de provenance.

ISBE suit le même mécanisme CrossWire épinglé et conserve le texte historique de 1915 sans le
moderniser. Les balises TEI deviennent du HTML sûr, les renvois d’articles deviennent des liens de
mots et les `osisRef` passent par le contrôle BCV.

Translation Words est acquis depuis la release stable `unfoldingWord/en_tw` épinglée. Cette
adaptation CC BY-SA 4.0 convertit le Markdown et les liens `rc://`, regroupe les rares intitulés
identiques et retire la marque déposée du titre du produit dérivé, conformément au fichier de
licence source. Son manifeste conserve la liste précise des transformations et l’attribution exigée.
