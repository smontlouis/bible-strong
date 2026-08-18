# Audit des requêtes locales et Resource API

Date de validation : 18 août 2026

## Résultat

L'audit a couvert les recherches bibliques, les concordances Strong, le lexique Strong, le dictionnaire, Nave, la timeline et les écrans qui les consomment. Les listes non bornées ont été remplacées par des pages à curseur, les écrans principaux chargent réellement les pages suivantes, et les chemins qui lisaient ou triaient un corpus entier ont été supprimés.

| Domaine | Problème observé | Correction |
| --- | --- | --- |
| Recherche biblique | Résultats et total obtenus par deux parcours, jusqu'à 200 lignes préchargées | Une requête bornée avec total fenêtré, pages de 20 et pagination infinie |
| Concordances Strong | Pagination profonde par décalage et index incomplets | Curseur `(book, chapter, verse, ordinal)`, `LIMIT + 1` et index couvrants |
| Lexique Strong | Construction et tri du corpus côté JavaScript, limite silencieuse de 200/500 | Filtrage SQL avant fenêtrage, curseur `(gloss, baseCode, id)`, pages de 50 |
| Dictionnaire | Chargement complet par lettre/recherche et une requête par définition d'un verset | Curseur `(normalizedWord, id)`, pages infinies et chargement groupé par `IN (...)` |
| Nave | Chargement complet, `ORDER BY RANDOM()` et quatre requêtes séquentielles par verset | Curseur `(name, normalizedName)`, clé aléatoire indexée et deux requêtes groupées |
| Recherche globale | « Voir plus » découpait seulement les tableaux déjà chargés | Pages de 20 par section ; le défilement charge la page suivante en mode dédié |
| Entités Strong | Préchargement de chaque fiche reliée et limite silencieuse de 60 relations | Suppression du préchargement en éventail et chargement à l'ouverture ; relations non tronquées |
| Timeline | La liste transférait et parsait les articles complets | DTO de résumé, détail chargé à la demande, recherche serveur bornée et cache local invalidé par révision du fichier |

Les anciens widgets de résultats Dictionnaire, Nave et Strong n'étaient plus référencés et ont été supprimés au lieu de conserver leur fausse pagination.

## Index ajoutés

PostgreSQL reçoit les index suivants par les migrations `0014` à `0017` et `0021` :

- trigrammes pour le texte biblique, le dictionnaire, Nave et le texte de recherche Strong ;
- index de curseur pour les occurrences et spans des concordances ;
- index de parcours, de tirage aléatoire, de relations, de ressources, de traductions et de morphologie Strong ;
- extension `unaccent` pour la recherche Timeline insensible aux accents.

SQLite crée les index de parcours Dictionnaire/Nave à l'ouverture de la base. Les artefacts Strong exigent désormais les index de concordance attendus lors de leur validation, ce qui empêche de publier une copie hors-ligne lente ou incomplète.

Les recherches SQLite arbitraires de type `%terme%` restent des parcours du petit index local : SQLite standard ne peut pas accélérer efficacement ce motif sans ajouter un artefact FTS. Leur coût est désormais borné par `LIMIT + 1` et elles ne matérialisent plus tout le résultat. Les parcours alphabétiques, qui constituent le chemin fréquent, utilisent les nouveaux index et les curseurs.

## Mesures avant/après

Mesures réalisées sur les données locales de développement, après échauffement lorsqu'indiqué :

| Requête | Avant | Après |
| --- | ---: | ---: |
| Lexique Strong PostgreSQL, préfixe, 50 résultats | 3,41–3,71 s | 21–25 ms à chaud, 69 ms à froid |
| Concordance Strong SQLite, page profonde vers 4 500 | 1 459,6 ms | 0,60 ms |
| Recherche biblique PostgreSQL, résultats + total | environ 49 ms SQL / 82 ms API | environ 8 ms SQL / 14–30 ms API à chaud |
| Index Timeline distant | 1,52 Mo | 395 Ko, environ 56 ms |

Le parcours des deux premières pages Strong a également été vérifié sans chevauchement. Les endpoints bornés Dictionnaire, Nave et Strong répondent en quelques millisecondes à quelques dizaines de millisecondes sur cette base de développement.

## Validation reproductible

```bash
yarn typecheck
yarn test --runInBand
yarn resources:test
yarn resources:test:integration
yarn agents:styles:check
yarn format:check
```

Les migrations ont en plus été appliquées sur une base PostgreSQL vierge. Les extensions `pg_trgm` et `unaccent`, ainsi que les index trigrammes, de concordance, de parcours et de tirage aléatoire, ont été vérifiés dans `pg_indexes`.
