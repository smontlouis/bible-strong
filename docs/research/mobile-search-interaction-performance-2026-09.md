# Recherche mobile : saisie, soumission et résultats en attente

Date : 15 septembre 2026. Recherche documentaire ; aucune décision d'architecture ni modification de code dans cette note.

Décision produit ultérieure : après essai, l'utilisateur a préféré revenir à la
recherche automatique avec un debounce de 800 ms, sans bouton supplémentaire ni
libellé « Résultats pour ». Le spinner centré, le brouillon local et la conservation
des résultats sont maintenus. Les recommandations de soumission ci-dessous
documentent l'option étudiée, pas le comportement final retenu ; voir le README
de la feature Search pour l'implémentation actuelle.

## Conclusion pour Bible Strong

Pour la **recherche complète multisource**, je recommande de tester une interaction hybride : saisie libre avec aperçu léger (référence reconnue, quelques suggestions), puis **Rechercher** au clavier ou bouton pour lancer les résultats complets, dont le sémantique. Les recherches locales de catégorie peuvent conserver un debounce court. Cette proposition est propre à notre recherche de phrases, aux nombreuses sources et aux problèmes de rendu observés ; aucune source ci-dessous ne prouve qu'un bouton est universellement meilleur.

Une solution moins disruptive reste valable : résultats lexicaux après un debounce court, touche Rechercher pour soumettre immédiatement, sémantique déclenché séparément. Elle préserve la découverte incrémentale, mais demande que le rendu et les requêtes soient réellement isolés de chaque frappe. La soumission explicite réduit le travail inutile ; elle ne corrige pas à elle seule un écran coûteux.

## Ce que disent les sources primaires

- **Apple** recommande une entrée de recherche identifiable, un périmètre visible, des recherches récentes et des suggestions pendant la saisie. Ces recommandations ne prescrivent pas de recalculer une liste exhaustive multisource à chaque caractère. [Searching](https://developer.apple.com/design/human-interface-guidelines/searching)
- **Android** distingue `onQueryChange` et `onSearch`, et présente des suggestions ainsi qu'une liste filtrée. Son exemple soumet la recherche et referme la vue étendue via `onSearch`. Cela documente la coexistence saisie/soumission ; pas une étude comparative établissant un optimum. [Search bar](https://developer.android.com/develop/ui/compose/components/search-bar)
- **IBM Carbon, guide des patterns**, recommande la recherche soumise lorsque les requêtes sont coûteuses ou lentes, la recherche active pour les catalogues limités et un hybride avec périmètre actif restreint puis recherche élargie. C’est le critère documentaire le plus directement applicable à notre arbitrage. Son pattern basique prévoit une page de résultats distincte : notre maintien dans le même écran reste une adaptation produit. [Search pattern](https://carbondesignsystem.com/patterns/search-pattern/)
- **IBM Carbon** prévoit Entrée pour soumettre un terme de recherche. Son contexte est principalement web/entreprise, donc il démontre un pattern reconnu plutôt qu'une supériorité pour une application biblique mobile. [Search usage](https://carbondesignsystem.com/components/search/usage/)
- **Algolia InstantSearch** utilise un indicateur quand la recherche tarde, et propose un debounce pour réduire les requêtes inutiles. Sa documentation préfère environ 200 ms et avertit qu'un délai dépassant 300 ms dégrade son expérience de recherche instantanée. Ce sont ses recommandations produit : elles ne constituent pas un seuil universel pour les recherches sémantiques ou notre moteur. [Improve performance](https://www.algolia.com/doc/guides/building-search-ui/going-further/improve-performance/react)
- **React** montre comment conserver les anciens résultats pendant le chargement des nouveaux, en signalant visuellement leur obsolescence. `useDeferredValue` diffère l'affichage, sans limiter les requêtes réseau ; ce n'est pas un remplacement du debounce. [useDeferredValue](https://react.dev/reference/react/useDeferredValue)
- **Apple Core Spotlight** recommande d'annuler la requête précédente quand le texte change et de créer la suivante. Transposé à nos requêtes asynchrones, il faut aussi empêcher une réponse tardive de remplacer les résultats d'une recherche plus récente. [Building a search interface](https://developer.apple.com/documentation/corespotlight/building-a-search-interface-for-your-app)
- **React Native** explique que les calculs et rendus React mobilisent généralement le thread JavaScript, et qu'un gros sous-arbre recalculé peut bloquer les interactions. Un délai avant recherche réduit sa fréquence, pas le coût d'un rendu. La mesure doit inclure un build de production, le mode développement dégradant les performances JS. [Performance overview](https://reactnative.dev/docs/performance)

## Comportement proposé, à valider dans l'application

| Situation | Affichage et action proposés |
| --- | --- |
| L'utilisateur supprime « cependant » | Le texte suit immédiatement le clavier. Les résultats complets déjà affichés restent stables. L'aperçu léger peut évoluer. |
| Texte modifié mais pas soumis | Garder un libellé « Résultats pour “Dieu parle tantôt cependant” » et rendre Rechercher disponible. Ne pas annoncer « recherche en cours » puisqu'aucune nouvelle recherche complète n'a démarré. |
| Nouvelle recherche soumise, ancienne liste disponible | Garder la liste, annoncer discrètement la nouvelle recherche près du champ si l'attente dure ; conserver le libellé de l'ancienne requête jusqu'au remplacement. Pas de grand état de chargement qui démonte la liste. |
| Première recherche sans liste | État de chargement dans la zone résultats. Un délai d'apparition court évite le clignotement pour les réponses rapides ; valeur à tester, pas seuil normatif. |
| Lexical terminé, sémantique encore en cours | Afficher les correspondances lexicales. Indicateur éventuel propre à la section sémantique. Éviter un état global laissant croire que rien n'est prêt. |
| Une source échoue | Conserver les autres résultats et proposer une relance ciblée. Ne pas convertir une panne en « aucun résultat ». |
| Ancienne réponse reçue en retard | Ignorer la réponse si sa requête et son périmètre ne correspondent plus à la recherche soumise. |

Conserver les objets résultats avec leur requête, filtres et version : conserver seulement les clés de lignes ne suffit pas si les objets disparaissent. Le surlignage doit utiliser la requête associée aux résultats visibles. Une ancienne liste peut rester consultable si sa provenance est explicite ; elle ne doit pas être présentée comme le résultat de la nouvelle saisie.

L'aperçu pendant la saisie doit rester limité. Relancer toutes les sources pour afficher des « suggestions » reviendrait à conserver le même problème sous un autre nom. Pour le sémantique, partir d'une soumission explicite est une proposition produit raisonnable ici ; les sources consultées ne prescrivent pas ce déclencheur.

## Éléments techniques recueillis en parallèle

Le diagnostic du 15 septembre sur le code courant a reproduit dix exécutions de la recherche floue des notes avec **l’ancienne phrase** pendant dix suppressions, avant stabilisation du debounce. Le mécanisme observé vide aussi les résultats de passages dès que le texte brut diffère du texte temporisé ; conserver seulement les clés ne conserve pas les objets et conduit à des remontages. Ces constats motivent des corrections même si la recherche complète passe sur soumission explicite. Ils proviennent du diagnostic local, pas des sources web.

## Contraintes du dépôt et validation

L'[ADR 0045](../adr/0045-search-before-opening-content-tabs.md) conserve un point de recherche complet et des recherches de catégorie ; la proposition n'ajoute pas de formulaire indépendant par source. L'[ADR 0031](../adr/0031-observe-search-with-unlinked-content-analytics.md) compte des recherches stabilisées et sépare produit/runtime : si la soumission change, adapter la frontière de cet événement sans journaliser chaque frappe ni ajouter d'identifiant utilisateur.

Comparer les deux variantes sur le même appareil et build, avec le même scénario « Dieu parle tantôt cependant » → suppressions → « Dieu parle tantôt ». Mesurer séparément latence clavier, coût des commits/rendus, nombre d'appels, premier résultat utile et fin du sémantique. Vérifier hors ligne, cache chaud/froid, changements rapides de filtres, réponses désordonnées, absence de résultats et lecteurs d'écran. Le choix final dépend du temps pour ouvrir le passage voulu et du confort de reformulation, pas seulement du nombre de requêtes.

## Diagnostic du profil fourni à 17:25:45

Source locale : `profiling-data.15-09-2026.17-25-45.json`, export React DevTools fourni par l'utilisateur. Pas de trace CPU ni de mesure réseau dans cet export : il ne permet pas d'attribuer un coût au serveur, au clavier natif ou au calcul d'embeddings.

| Mesure | Profil 17:11:17 | Profil 17:25:45 |
| --- | ---: | ---: |
| Commits React | 50 | 37 |
| Commits > 16 ms | 28 | 21 |
| Commit maximal | 76,51 ms | 158,08 ms |
| Rendus de SQLiteSearchScreen | 28 | 20 |
| Temps propre cumulé de SQLiteSearchScreen | 237,5 ms | 222,9 ms |
| Rendus de SearchSourceFiltersSheet | 28 | 20 |

Ces captures ne sont pas un benchmark contrôlé : ne pas convertir ces écarts en pourcentage d'amélioration. Le nouveau profil établit néanmoins que le problème de rendu persiste. Le commit 30 dure 158,08 ms et contient 445 premières montées de nœuds React ; le commit 21 en contient 545. Ce ne sont pas des nombres de résultats bibliques.

### Causes vérifiées et prochaines corrections

1. **Les passages disparaissent pendant la saisie.** Dans `SQLiteSearchScreen.tsx`, `shouldSearchPassages` exige l'égalité entre texte brut et texte debouncé ; `results` devient `null` et `semanticResults` devient `[]` dès la première suppression. `useAppendOnlySearchResults` conserve l'ordre des clés, mais ne conserve pas les objets absents. La liste est donc vidée puis reconstruite. Conserver un instantané des résultats avec la requête et les filtres auxquels ils correspondent évitera ce cycle. Le remplacer lorsque la nouvelle recherche est prête, y compris lorsqu'elle est vide.
2. **Le debounce ne protège pas les recherches personnelles.** Les trois effets notes/études/liens dépendent du texte brut. En recherche multisource, ils peuvent relancer la recherche de l'ancienne valeur debouncée pour chaque caractère. Un harnais ponctuel exécutant le véritable callback de l'effet Notes, extrait via Babel, avec dix suppressions et une valeur debouncée inchangée reproduit dix appels à `searchWithMatches`, tous sur « Dieu parle tantôt cependant ». Ce test valide la fréquence des appels, pas leur durée avec les données de l'utilisateur. Dépendre uniquement de la requête réellement exécutée évitera ce travail obsolète.
3. **La saisie reste globale.** `SearchTabScreen` écrit le texte et le titre dans l'atome d'onglet à chaque caractère. Le nouveau profil montre encore les mises à jour de `TabGroupPager`, `TabPreview`, boutons et fournisseur du sélecteur d'onglets. Garder le brouillon dans le champ et publier la requête à la soumission découple ce travail du clavier. Préserver explicitement le brouillon lors des changements d'onglet ou de fermeture de l'écran.
4. **Les filtres restent instables.** Les 20 rendus de `SearchSourceFiltersSheet` sont associés aux nouvelles fonctions `onToggle`, `onReset`, `onOpenPassageFilters`, sans changement d'options. Les choix et callbacks de `PassageSearchFiltersSheet` changent également. Isoler leur état et leurs commandes du champ et des résultats ; vérifier dans un nouveau profil que la saisie ne les réveille plus. React Compiler activé ne garantit pas la stabilité de tous les sous-arbres.

La validation attendue porte d'abord sur des invariants : pas de recherche complète sur un brouillon non soumis, pas de travail Fuse sur une ancienne saisie, pas de démontage des résultats pendant les suppressions, pas de rendu des filtres inchangés. Mesurer ensuite la latence clavier et le temps au premier résultat utile sur un appareil/build identiques. Aucun changement d'interaction n'a été implémenté pendant cette recherche documentaire.
