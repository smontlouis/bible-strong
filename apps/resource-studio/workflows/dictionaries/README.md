# Dictionnaires — lecteur local

Preview HTML locale des dictionnaires configurés dans Resource Studio. Le lecteur ouvre directement
les SQLite de travail : il ne copie pas les corpus, ne contacte aucun service distant et n’effectue
aucune publication.

## Ouvrir le lecteur

Depuis la racine du dépôt :

```bash
yarn resources:dictionaries:test
yarn resources:dictionaries:normalize
yarn resources:dictionaries:correspondences
yarn resources:dictionaries:entry-links
yarn resources:dictionaries:directory
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
- les articles correspondants dans les autres dictionnaires, sans fusionner leurs contenus ;
- les références bibliques reconnues par le BCV parser, rendues sous forme de liens `bible://` ;
- les numéros Strong de Translation Words, rendus sous forme de liens canoniques `strong://` ;
- les métadonnées éditoriales, compteurs, provenance, attribution et droits de chaque ressource.

La normalisation complète produit également `dictionary-directory.sqlite`. Ce répertoire global ne
contient aucune définition : il projette les identités des œuvres et articles, l’index alphabétique,
les correspondances et les ancres passage–article exactes nécessaires aux surfaces de découverte.

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
Elle crée aussi `dictionary_passage_anchors`, qui relie chaque verset à l’identifiant exact de
l’article qui le cite avec la preuve `source-citation`. La table historique `verses` reste présente
pour les lecteurs existants, mais elle ne constitue plus le contrat cible de découverte.
Elle régénère ensuite `.local/normalized/correspondences.json`. Cette étape peut aussi être lancée
seule avec `yarn resources:dictionaries:correspondences`.

Les correspondances sont déterministes et conservatrices : intitulés normalisés dans une même
langue, variantes explicitement écrites dans les intitulés (`;`, `or`, `ou`) et translittérations
français/anglais de noms bibliques attestés par la liste `bible/names` de Translation Words. Tous
les articles sont analysés, mais un article n’est relié que si une correspondance suffisamment sûre
est trouvée. Les homographes génériques entre langues ne sont pas rapprochés automatiquement. Le
lecteur préfère automatiquement les copies normalisées lorsqu’elles existent. Le serveur et le
pipeline de normalisation nécessitent la commande système `sqlite3`.

Translation Words est le seul corpus de cette bibliothèque qui fournisse un inventaire Strong
structuré. Ses codes hébreux sont conservés tels quels. Sa convention grecque Door43 à cinq chiffres
est reliée à l’entrée classique correspondante (`G00020` → `strong://G0002`) tout en conservant le
libellé source visible et traçable. Les chaînes courtes d’ISBE comme `H2` ou `G2`, qui désignent des
sections ou des manuscrits, ne sont pas interprétées comme des Strong.

Après la construction des correspondances, le pipeline contrôle également les renvois internes des
définitions. Les anciens liens sont résolus vers l’identifiant exact de leur destination ; les
auto-liens et les destinations invérifiables sont retirés. Pour les corpus qui ne possèdent pas ces
renvois, les indications éditoriales explicites `See`, `See also`, `Voir`, `Voir aussi` et `Voyez`
sont reliées en priorité, sans contrainte de casse. Un numéro comme dans `See KEDESH, 3` permet de
lever une ambiguïté entre plusieurs articles et d’ouvrir directement la section visée. Le pipeline
lie ensuite au maximum la première occurrence d’un sujet par article, uniquement si le
sujet est corroboré par plusieurs dictionnaires. La casse doit correspondre, les verbes ambigus et
les termes très courts sont écartés, et les compléments Webster ne servent pas de destinations
automatiques. Cette étape peut être relancée seule avec
`yarn resources:dictionaries:entry-links`.

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
