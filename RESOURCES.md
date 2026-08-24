# Recherche sémantique — ressources

## Knowledge

- [Qwen3 Embedding — publication officielle de l'équipe Qwen](https://qwenlm.github.io/blog/qwen3-embedding/)
  Présente la famille Qwen3 Embedding, son fonctionnement multilingue, ses dimensions et son association possible avec un reranker. À consulter pour comprendre la conversion du sens en vecteurs.
- [pgvector — documentation officielle](https://github.com/pgvector/pgvector)
  Référence pour le stockage de vecteurs dans PostgreSQL, la similarité cosinus, les index HNSW et la recherche hybride. À consulter pour comprendre comment les voisins sont retrouvés.
- [PostgreSQL — contrôle de la recherche textuelle](https://www.postgresql.org/docs/current/textsearch-controls.html)
  Documentation primaire sur `tsvector`, les requêtes textuelles et le classement lexical. À consulter pour distinguer recherche par mots et recherche vectorielle.
- [PostgreSQL — dictionnaires de recherche textuelle](https://www.postgresql.org/docs/current/textsearch-dictionaries.html)
  Explique la normalisation, les lexèmes et le stemming. À consulter pour comprendre les recherches françaises et anglaises tolérantes aux formes grammaticales.

## Wisdom (Communities)

- [Discussions pgvector](https://github.com/pgvector/pgvector/discussions)
  Communauté technique centrée sur les compromis de rappel, de performance et d'indexation. Utile lorsqu'une mesure de production révèle un problème précis.

## Gaps

- Un corpus d'évaluation Bible Strong, validé humainement en français et en anglais, reste nécessaire pour comparer objectivement embedding, seuils et reranking.
