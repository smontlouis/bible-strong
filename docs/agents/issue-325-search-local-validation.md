# Issue 325 — validation locale de la recherche

## Périmètre livré

Cette étape reste strictement locale. Elle ne déploie ni migration, ni Worker, ni publication vers
la production.

La recherche prend en charge :

- les références bibliques directes avec le parser BCV existant ;
- les codes Strong exacts (`H430`, `G26`) ;
- une phrase lorsque toute la saisie est entre guillemets ;
- une recherche naturelle multi-mots avec `AND` implicite et préfixes automatiques ;
- la casse, les accents et les variantes d'apostrophes ;
- le grec avec ou sans accents/esprits et les deux formes du sigma ;
- l'hébreu avec ou sans niqqud/cantillation ;
- une correction de faute uniquement lorsqu'aucun résultat textuel normalisé n'existe ;
- les filtres version, canon, testament et livre.

Les syntaxes expertes `AND`, `OR`, `NOT` et `*` ne font pas partie du langage produit.

## PostgreSQL local

La migration `0022_bible_normalized_search.sql` installe une fonction immuable de normalisation,
un index GIN full-text et un index GIN trigramme. Elle a été appliquée au conteneur PostgreSQL 17
local avec :

```bash
yarn resources:db:up
yarn resources:migrate
```

Le repository classe les correspondances dans cet ordre : texte littéral, texte normalisé, puis
résultat trigramme. Une phrase n'utilise jamais la correction trigramme.

Validation effectuée le 23 août 2026 sur les 47 publications locales, soit environ 1,4 million de
versets :

| Requête | Versions | Temps HTTP local observé |
|---|---:|---:|
| `resurrection` | 47 | 308 ms |
| `resurection` | 47 | 244 ms |
| `"Dieu a tant aime"` | 47 | 15 ms |
| `αγαπη` | LXX | 18 ms |
| `אלהים` | BHS | 31 ms |

Ces chiffres sont des repères de développement, pas des objectifs de production.

## SQLite local

À l'ouverture, l'app ajoute `verses.normalized_text` si nécessaire, remplit les anciennes lignes par
lots et reconstruit atomiquement `verses_fts` avec le texte original et le texte normalisé. Les
nouvelles installations calculent la valeur normalisée pendant l'import.

Si la recherche exacte ne trouve rien, le vocabulaire FTS5 fournit des candidats proches et une
distance bornée sélectionne au maximum une correction par terme. Le texte affiché reste toujours le
texte biblique original.

## Commandes de validation

```bash
yarn test src/helpers/__tests__/bibleSearchInput-test.ts \
  src/helpers/__tests__/bibleSearchQuery-test.ts \
  src/helpers/__tests__/bcvParser-test.ts \
  src/features/resources/__tests__/bibleSearchAccess-test.ts \
  src/features/studyRelations/__tests__/targetSearch-test.ts --runInBand

RESOURCE_INTEGRATION=1 yarn tsx --test --test-concurrency=1 \
  resource-service/src/repositories/__tests__/bibleSearchRepository.integration.node-test.ts

yarn resources:smoke:bible-search
yarn resources:test
yarn resources:worker:check
yarn resources:architecture:check
yarn typecheck
yarn agents:styles:check
```

Résultat de la passe finale locale : 1 782 tests Jest, 143 tests Resource Service et les 2 tests
d'intégration PostgreSQL dédiés à la recherche passent. Le typecheck app/Worker, les frontières
d'architecture, le lint ciblé et le contrôle de styles passent également. React Doctor conserve un
score de 86/100 ; ses 12 avertissements restants concernent du code historique de l'écran de
recherche et deux séquences SQLite volontairement ordonnées, pas le nouveau chemin de recherche.

## Avant toute production

1. Rejouer la migration et les benchmarks sur l'environnement de staging.
2. Vérifier la durée et la taille des index sur le corpus staging complet.
3. Tester l'ouverture/migration d'une base SQLite existante sur iOS et Android physiques.
4. Faire valider qualitativement un jeu de requêtes FR, EN, grec et hébreu.
5. Décider explicitement de l'application de la migration et du déploiement Worker en production.
