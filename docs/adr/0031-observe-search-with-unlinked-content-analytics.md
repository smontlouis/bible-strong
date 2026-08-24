# ADR 0031 — Observer la recherche avec des événements de contenu non rattachés

## Statut

Accepté pour implémentation. L'information utilisateur dédiée sera ajoutée séparément avant la validation produit finale.

## Contexte

Une recherche globale peut lancer plusieurs opérations techniques : résolution BCV, recherche de passages, Strong, dictionnaire et Nave. Journaliser chaque requête HTTP surestime donc le nombre de recherches réelles. Les formulations recherchées sont nécessaires pour repérer les thèmes importants, les recherches sans résultat et les défauts de classement.

## Décision

Deux datasets Cloudflare Analytics Engine sont utilisés :

- `bible_search_product_v1` reçoit au plus un `search_performed` et un premier `result_opened` par recherche stabilisée ;
- `bible_search_runtime_v1` reçoit les métriques des requêtes API et des embeddings sans le contenu recherché.

Les événements produit ne contiennent aucun identifiant de compte, d'installation, d'appareil ou de session. Les recherches limitées aux notes, études et liens personnels ne sont pas collectées. Le serveur normalise la requête et supprime les emails, téléphones, URL et secrets reconnaissables avant écriture.

Les recherches hors ligne ne sont ni collectées ni mises en attente. Les rapports de contenu n'affichent par défaut que les formulations observées au moins cinq fois.

AI Gateway est utilisé avec la journalisation active et `cf-aig-collect-log-payload: false`. Le Gateway conserve donc uniquement ses métadonnées natives (modèle, coût, tokens, statut et durée), jamais l'entrée ni la sortie de l'embedding. Les métriques d'inférence minimales sont aussi écrites dans le dataset Runtime pour corréler la santé du modèle avec celle de la route sans identifiant utilisateur.

## Conséquences

- Les statistiques représentent les interactions de recherche et non le nombre d'appels réseau.
- Les références et Strong résolus localement peuvent être mesurés lorsque l'appareil est en ligne.
- Les données Analytics Engine expirent selon sa rétention gérée par Cloudflare.
- L'absence d'identifiant durable empêche de reconstruire le parcours d'un utilisateur.
- Les taux d'ouverture mesurent uniquement le premier résultat ouvert pour chaque recherche affichée.
- L'échantillonnage Analytics Engine impose l'usage de `_sample_interval` dans tous les rapports.
