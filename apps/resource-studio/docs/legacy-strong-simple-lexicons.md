# Lexiques Strong simples issus des bases historiques

Extraction effectuée le 28 septembre 2026. Les sources extraites alimentent deux
publications autonomes, `strong-lexicon:simple-fr` et `strong-lexicon:simple-en`,
pour l'accès en ligne et les copies hors ligne.

## Produit visé

- **Définition simple** : définition historique française ou anglaise.
- **Définition avancée** : définition STEP actuelle et dictionnaire grec détaillé.

Une même définition simple peut servir plusieurs variantes STEP. Les identités et
les définitions avancées de ces variantes restent distinctes. En l'absence de
définition historique, afficher son indisponibilité et permettre de consulter le
niveau avancé ; ne pas présenter silencieusement STEP comme une définition simple.

## Sources et extraction

- Français : <https://storage.googleapis.com/bible-strong-app.appspot.com/databases/strong.sqlite>
- Anglais : <https://storage.googleapis.com/bible-strong-app.appspot.com/databases/en/strong.sqlite>

Les originaux sont conservés dans `outputs/legacy-strong/sources/`. Les sorties
locales sont dans `outputs/legacy-strong/extracted-v1/`. Ces répertoires sont ignorés
par Git ; le générateur et ses tests sont versionnés.

Depuis `apps/resource-studio`, après téléchargement des deux sources :

```bash
yarn exec tsx src/extractLegacyStrongLexicons.ts \
  outputs/legacy-strong/sources/strong-fr.sqlite \
  outputs/legacy-strong/sources/strong-en.sqlite \
  data/dictionaries/strong_lexicon.en-fr.core.production.sqlite \
  outputs/legacy-strong/extracted-v1
```

Le répertoire de sortie doit être nouveau. Les bases sources sont ouvertes en
lecture seule. Le générateur crée :

- `strong-simple-fr.sqlite` et `strong-simple-en.sqlite` : entrées lexicales,
  correspondances STEP et métadonnées d'extraction ; aucune table biblique.
- `mapping-fr.jsonl` et `mapping-en.jsonl` : toutes les entrées STEP, avec le Strong
  classique cible et l'état du rapprochement.
- `excluded-fr.jsonl` et `excluded-en.jsonl` : anciennes entrées techniques
  exclues, avec leur contenu intégral pour audit.
- `report.json` : comptages, exceptions, absences et empreintes SHA-256 des sources
  et des sorties.

Les champs historiques sont préservés tels quels : mot, forme originale,
prononciation, origine, type grammatical, résumé des traductions et définition
HTML. Le rendu de l'application convertit les anciens liens Strong en liens
internes. Aucun texte biblique n'est recopié.

Les seules plages lexicales retenues sont `G0001–G5624` et `H0001–H8674`.
Le code zéro et les entrées françaises de grammaire, variantes de lecture et
synonymes hors de ces plages ne sont pas des définitions lexicales classiques.

## Correspondance avec STEP

Utiliser la ligne STEP résolue, puis sa paire `language + baseCode`, validée contre
`eStrong`. Ne pas déduire la correspondance en retirant simplement un suffixe de
`dStrong`, et ne pas suivre `uStrong` qui peut pointer vers une autre entrée ou
même une autre langue.

Deux exceptions du jeu STEP local démontrent cette distinction :

| Identité STEP | Strong classique explicite |
| ------------- | -------------------------- |
| `G2491K`      | `G2495`                    |
| `H7156H`      | `H7178`                    |

La casse des suffixes est conservée (`H2148V` et `H2148v` sont distincts).
`StepStrongLinks` conserve les identités exactes et le numéro classique cible.
Ses identifiants numériques STEP sont liés à l'empreinte du fichier STEP utilisé ;
il faut régénérer les liens si ce fichier change, et ne pas réutiliser ses IDs
aveuglément avec une autre publication. Pour l'intégration, résoudre d'abord
l'entrée STEP exacte et lui associer la définition classique dans la langue
d'interface.

## Résultat vérifié

| Mesure                                                        | Français | Anglais |
| ------------------------------------------------------------- | -------: | ------: |
| Entrées grecques conservées                                   |    5 521 |   5 519 |
| Entrées hébraïques conservées                                 |    8 674 |   8 674 |
| Total d'entrées conservées                                    |   14 195 |  14 193 |
| Définitions non vides                                         |   14 194 |  14 193 |
| Entrées techniques exclues                                    |      434 |       0 |
| Entrées STEP reliées à une définition non vide                |   17 339 |  17 338 |
| Dont identités STEP avec suffixe                              |    4 642 |   4 642 |
| Entrées STEP hors des plages classiques                       |    5 375 |   5 375 |
| Entrées STEP classiques sans définition historique disponible |        3 |       4 |

Le lexique STEP de référence contient 22 717 entrées. Toutes les définitions
historiques non vides ont au moins une correspondance STEP. `H3966` existe dans
la source française mais son champ de définition est vide ; il est conservé et
signalé, sans contenu inventé.

La vérification compare les huit champs de chaque entrée extraite à l'original,
contrôle l'intégrité SQLite et les clés étrangères. Les tests couvrent les
variantes suffixées et leur casse, les alias `uStrong`, les familles exceptionnelles,
les définitions manquantes, l'exclusion des tables bibliques et techniques, ainsi
que la préservation des sources.

## Génération des publications

Après projection du lexique courant avec `packageModularLexicon.ts`, utiliser son
fichier `strong_lexicon.core.sqlite` pour conserver exactement les identités STEP :

```bash
yarn exec tsx src/packageSimpleStrongLexicons.ts fr \
  outputs/legacy-strong/identity-projection/strong_lexicon.core.sqlite \
  outputs/legacy-strong/extracted-v1/strong-simple-fr.sqlite \
  outputs/legacy-strong/publications-v2/simple-fr
```

Répéter avec `en`. Chaque bundle conserve le répertoire d'identités, les libellés
localisés et la morphologie, puis remplace les définitions par le texte historique.
Il retire les définitions STEP, relations lexicales et sens des noms du niveau simple.
La correspondance est recalculée depuis `language + baseCode` pour chaque identité.
Les entrées sans définition restent navigables, mais sont exclues du tirage aléatoire.

Le Resource service valide la parité canonique/SQLite et importe chaque publication
sans dépendance à `core`. L'API utilise `level=simple` et la langue demandée ; son
comportement détaillé par défaut reste compatible avec les anciennes applications.
Le client réunit les deux niveaux, affiche d'abord la définition simple et déplie
STEP et le dictionnaire grec dans le niveau avancé. Les deux copies simples sont
indépendantes dans les téléchargements et l'onboarding.

Le test `completeSimpleStrongPublications.integration.node-test.ts`, avec
`RESOURCE_SIMPLE_STRONG_BUNDLES_ROOT` et un PostgreSQL local, compare chaque entrée
canonique à sa projection en base et vérifie les lectures, variantes, recherche
et tirage aléatoire. La publication différentielle suit le skill
`resource-publication` et l'ADR-0027 ; les autres identités du catalogue restent inchangées.
