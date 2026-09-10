# Placement des tags et des relations

Audit du 10 septembre 2026. Périmètre : application Expo (code partagé iOS, Android et Web), état local du workspace, y compris les modifications en cours. Analyse statique ; rendu sur appareils non vérifié. Aucune modification de l'interface dans cet audit.

## Ce que désigne « hors du header »

Le header est la barre de navigation, avec retour, titre, sous-titre et actions, ainsi que ses éventuelles lignes supplémentaires. Dans `common/Header.tsx`, les `children` sont rendus **à l'intérieur** du conteneur et au-dessus de sa bordure inférieure : une rangée sous le titre n'est donc pas nécessairement hors du header.

Une zone de métadonnées hors du header appartient au contenu et défile avec lui. Ajouter une deuxième barre fixe juste sous le header ne règle pas le problème de place occupée en permanence.

## Inventaire des pages de détail

Chemins ci-dessous relatifs à `apps/expo/src/`. Les numéros de ligne sont des repères au moment de l'audit.

| Surface | Position actuelle | Contenu et conditions | Source |
| --- | --- | --- | --- |
| Bible, passage ciblé (`hasFocusVerses`) | **Dans le header**, sous la référence/version, dans le même bloc que le titre | Tags des versets ciblés + compteur de relations ; limite initiale de 2 tags, extensible | `features/bible/BibleHeader.tsx:581–601` |
| Étude en lecture | **Bas du header**, rangée supplémentaire sous le titre | Tags + compteur ; seulement en lecture et si non vide. Marge haute négative de 10 px | `features/studies/EditStudyScreen.tsx:148–169`, `EditStudyHeader.tsx:117–139` |
| Étude en édition | Pas de chips affichées | La rangée est conditionnée par `isReadOnly` | `features/studies/EditStudyScreen.tsx:160` |
| Strong : fiche principale | **Bas du header**, rangée supplémentaire sous le titre/sous-titre | Tags + compteur de l'entrée Strong chargée. Marge haute négative de 8 px | `features/lexique/StrongEntryRouteScaffold.tsx:74–96` |
| Strong : concordance, dictionnaire, entrées apparentées, fiche d'entité | **Même bas de header**, hérité du scaffold | Les chips restent celles de l'entrée Strong d'origine, même si le titre concerne une autre sous-page | `StrongConcordanceRouteScreen.tsx`, `StrongDictionaryRouteScreen.tsx`, `StrongRelatedRouteScreen.tsx`, `StrongEntityRouteScreen.tsx` dans `features/lexique/` |
| Dictionnaire | **Hors header**, dans le contenu défilant | Après le sélecteur de sources s'il existe, avant la définition ; tags + compteur | `features/dictionnary/DictionaryDetailTabScreen.tsx:495–515` |
| Nave | **Hors header**, début du contenu défilant | Avant la description ; tags + compteur | `features/nave/NaveDetailTabScreen.tsx:315–329` |
| Note, dont note d'annotation | **Hors header**, début du contenu défilant | Avant le texte annoté / les références et le corps de note ; tags + compteur | `features/notes/NoteDetailTabScreen.tsx:465–514` |
| Lien externe / vidéo | **Hors header**, dans le contenu | En lecture, avant le média et le détail ; tags + compteur. Rangée absente en édition | `features/bible/BibleLinkScreen.tsx:361–379` |
| Modale des étiquettes d'un verset | **Hors header**, dans le contenu de la sheet | Listes de tags ; header séparé contenant titre et référence | `features/bible/VerseTagsModal.tsx:134,197` |

Résultat : **trois points d'implantation dans les headers**, couvrant sept écrans/composants consommateurs (Bible ciblée, étude et cinq routes Strong). Aucun de ces trois points ne place les chips au-dessus du titre : ils sont sous le titre ou dans une extension basse du header.

## Autres emplacements à préserver ou harmoniser

| Surface | Position actuelle | Sources |
| --- | --- | --- |
| Carte d'étude | Bas de carte, après titre/extrait ; 1 tag initialement + compteur, expansion possible | `features/studies/StudyItem.tsx:128` ; utilisé notamment par `AllStudiesTabScreen.tsx` |
| Carte de note | Sous titre/extrait ; tags + compteur fourni par la liste | `features/bible/BibleNoteItem.tsx:92` ; listes `AllNotesTabScreen.tsx`, `BibleVerseNotesScreen.tsx` |
| Carte de lien | Sous titre/URL ; tags + compteur | `features/bible/BibleLinkItem.tsx:117` ; `BibleVerseLinksScreen.tsx` |
| Résultats dans le détail d'un tag | Dans les éléments de liste, sous leur contenu ; note : tags seuls, lien : tags + compteur | `features/settings/tagDetailShared.tsx:164,240` |
| Versets et annotations dans les listes personnelles | Dans les cartes, sous leur contenu ; tags seuls aux points recensés | `features/settings/Verse.tsx:165`, `AnnotationItem.tsx:133` |
| Lecture biblique courante | Tags inline après le texte du verset, ou indicateur selon réglage ; relations inline après les tags ou compteurs selon réglage | `features/bible/BibleDOM/Verse.tsx:825,893–909` |
| Annotations de mots en lecture | Au voisinage du passage annoté ; relations avant tags dans le portail inline | `features/bible/BibleDOM/AnnotationInlineItems.tsx:95–125` |

Les relations inline de la Bible utilisent `RelationsText` et les réglages du lecteur ; elles ne sont pas simplement le compteur `EntityChipList`. Leur placement constitue une règle locale d'ancrage au texte, à conserver lors d'une migration des headers.

Les filtres de listes, sélecteurs de sources, boutons d'action « Éditer les tags/relations » et le titre de la page d'un tag ne sont pas des métadonnées de l'objet affiché. Ils ne doivent pas être déplacés mécaniquement avec les chips.

## Règle proposée

1. **Aucun tag ni chip de relations d'un objet dans le header de navigation**, y compris ses lignes basses. Header réservé à l'identification, la navigation et aux commandes.
2. **Sur une fiche, afficher les métadonnées au début du contenu défilant**, après les éventuels contrôles de source et avant le corps. Alignement et largeur identiques au contenu. Ordre : tags, puis chip de relations.
3. **Dans une liste, placer les chips sous le titre et l'extrait de chaque carte**, pour qu'elles restent clairement rattachées à cet objet.
4. **Dans le lecteur biblique, garder les métadonnées locales près du verset ou de l'annotation.** Pour un passage ciblé, déplacer la synthèse du header au début du contenu du passage ; vérifier les doublons avec l'affichage inline.
5. Une rangée vide ne réserve aucune hauteur. Sur une fiche, laisser les chips revenir à la ligne dans le contenu ; pour les cartes, conserver une présentation compacte avec expansion explicite.
6. Les commandes d'ajout et d'édition restent disponibles dans le menu d'actions du header, même lorsqu'il n'existe aucune chip. Cliquer un tag ouvre ce tag ; cliquer le compteur ouvre les relations.
7. Les chips doivent décrire **l'objet de la fiche affichée**. Pour les sous-pages Strong, recommandation : ne pas répéter automatiquement les métadonnées de l'entrée d'origine ; les conserver sur sa fiche principale. Si leur présence contextuelle est nécessaire, nommer explicitement l'entrée concernée dans le contenu.

Cette règle a été validée pour la migration décrite ci-dessous. La distinction Tag / Relation reste celle de `docs/adr/0003-study-relations-as-user-graph.md`.

## Changements à prévoir

- Bible ciblée : retirer `EntityChipList` du bloc titre et supprimer l'ajustement de hauteur lié aux chips (`focusedHeaderMinHeight`). Intégrer la rangée au défilement du passage.
- Étude : sortir la rangée des `children` d'`EditStudyHeader` ; l'intégrer au contenu de lecture de `StudiesDomWrapper`, pas à une nouvelle barre fixe devant l'éditeur.
- Strong : retirer la rangée du `Header` du scaffold ; l'insérer dans le contenu de la fiche principale et appliquer la règle de propriété aux quatre sous-pages.
- Dictionnaire, Nave, note, lien : conserver le placement actuel hors header ; harmoniser les espacements et la gestion des rangées vides.
- À traiter séparément si souhaité : différences de visibilité lecture/édition, compteurs absents de certaines cartes, ordre inversé relations/tags dans les annotations inline.

## Vérification lors de l'implémentation

Contrôler chaque famille sur petit écran natif et panneau Web : zéro chip, tags seuls, relations seules, nombreux tags et noms longs. Vérifier que la hauteur du header ne change plus avec les métadonnées, que les chips défilent avec le contenu et que leurs actions restent accessibles. Inclure lecture/édition, passage ciblé simple/multiple, retour depuis une sous-page Strong et respect des modes bibliques masquant les données personnelles.

## Mise en œuvre après validation

La règle ci-dessus a été validée dans la conversation. Les trois placements dans les headers sont migrés : Bible ciblée et étude en lecture dans leur document DOM défilant, Strong dans le contenu de sa fiche principale. Les sous-pages Strong ne répètent plus les chips de l'entrée d'origine. `EditStudyHeader` n'accepte plus de contenu supplémentaire.

Le composant `common/EntityChipsDOM.tsx` reçoit des chips sérialisables et transmet les clics à la navigation native. Il utilise les couleurs du thème fourni par chaque document et n'occupe aucune place à vide. Les cartes, écrans déjà conformes et métadonnées inline du lecteur conservent leur comportement. La synthèse du passage et ses tags inline peuvent donc apparaître ensemble, comme avant la migration.

### Placement autour des médias bibliques

Dans la Bible ciblée avec contexte, la rangée de métadonnées est placée **après le bloc de médias d'introduction et avant les versets**. Elle ne doit pas précéder les vignettes : leur marge négative et leur animation au défilement dépendent de leur position initiale. Conserver leurs dimensions, marges et calculs de défilement. En mode focalisé qui masque les médias d'introduction, la rangée précède directement les versets.
