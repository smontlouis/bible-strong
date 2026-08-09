# Bible Strong — Brief de passation pour l’onboarding « Abel »

Date : 6 août 2026

## 1. Mission de l’agent spécialisé

Concevoir le storyboard, la direction artistique et éventuellement le prototype animé du nouvel onboarding de Bible Strong.

L’onboarding ne doit pas énumérer les fonctionnalités. Il doit montrer, par un parcours concret, comment une personne part d’un verset, approfondit un mot, suit des pistes, conserve ses questions, organise ses découvertes et construit une étude.

Le parcours retenu est celui d’Abel, à partir de Genèse 4.2.

## 2. Décisions déjà prises

- L’application est actuellement gratuite. Une offre Premium centrée sur l’IA viendra plus tard ; elle ne doit pas être vendue comme disponible dans cet onboarding.
- Bible Strong est **offline first**. Les données nécessaires doivent être téléchargées avant l’usage réel.
- Le récit d’onboarding vient **avant** la sélection et le téléchargement des packs.
- À la fin du récit, le bouton `Continuer` ouvre la préparation de la bibliothèque hors ligne.
- Pendant le téléchargement, afficher des cartes courtes de type « Le saviez-vous ? » liées aux ressources installées.
- L’onboarding peut comporter plus de trois scènes si chaque scène reste légère et utile.
- Le ton n’est ni publicitaire ni poétique : on observe concrètement le raisonnement d’une personne qui étudie.
- Chaque écran doit rester très peu verbal : une illustration dominante, **une seule phrase**, puis un grand bouton `Continuer`.
- Direction actuelle : light mode, composition libre et ouverte, beaucoup d’espace, interactions lisibles et animations fluides.

## 3. Structure visuelle commune

Chaque scène utilise la même ossature :

1. retour discret et progression en haut ;
2. grande illustration interactive occupant environ 65 à 75 % de l’espace ;
3. une seule phrase forte sous l’illustration ;
4. un grand bouton pleine largeur `Continuer` en bas.

À éviter : sous-titre explicatif, surtitre « Étape… », liste de fonctions, légende technique, plusieurs CTA, écran surchargé ou reproduction littérale d’un écran de l’application.

Palette light réelle de Bible Strong :

- fond : `#F4F7FF` ;
- bleu principal : `#5983F0` ;
- bleu très clair : `#E9F3FC` ;
- jaune secondaire : `#FFBC00` ;
- couleurs d’annotation : `#81ECEC`, `#FF7675`, `#FDCB6E`, `#74B9FF`, `#95AFC0` ;
- texte principal : noir.

Les cartes peuvent flotter, pivoter légèrement et sortir du cadre. Les connexions peuvent être courbes et organiques. L’ensemble doit sembler plus libre qu’un tutoriel classique, tout en conservant la clarté d’une interface mobile de production.

## 4. Concept narratif

Promesse : **un verset peut devenir une étude complète sans jamais perdre son point de départ.**

Le canevas s’enrichit au fil des scènes. L’élément actif est grand et net ; les découvertes précédentes restent en arrière-plan. À la fin, tout se replie vers « Abel » dans Genèse 4.2.

Fil principal :

```text
Genèse 4.2
  → Abel · H1893
  → hevel · H1892 · vapeur/souffle
  → Ecclésiaste 1.2
  → question personnelle
  → tags + relations
  → autres passages sur Abel
  → entité et contexte
  → étude assemblée
  → retour à Genèse 4.2
```

## 5. Storyboard proposé

Le nombre final de scènes peut être condensé après prototypage. Les scènes ci-dessous constituent la matière narrative complète.

### Scène 1 — Lire et annoter

**Illustration** : une carte légère de Genèse 4.2 flotte au centre. Le mot « Abel » est sélectionné. Une palette de couleurs se déploie et un surlignage corail est appliqué.

**Phrase unique** : `Lisez. Surlignez. Découvrez.`

**Fonctions montrées** : lecteur biblique, sélection d’un mot ou passage, couleurs, annotations.

**Animation** : le texte arrive doucement ; un geste implicite sélectionne « Abel » ; la palette rebondit légèrement ; le surlignage se peint.

### Scène 2 — Ouvrir les ressources du verset

**Illustration** : la carte du verset se décentre. Autour apparaissent des satellites sobres : Strong, dictionnaire, références, commentaires, thèmes, traductions. Strong devient la piste active ; les autres restent disponibles en périphérie.

**Phrase unique** : `Chaque verset peut devenir un point de départ.`

**Fonctions montrées** : ressources contextuelles du verset, comparaison, navigation sans perdre la lecture.

**Animation** : les satellites émergent du mot sélectionné ; la caméra suit Strong.

### Scène 3 — Retrouver le mot original

**Illustration** : une fiche Strong s’ouvre depuis « Abel » : `הֶבֶל`, `Hevel`, `Abel`, `H1893`. Montrer seulement quelques informations fortes, pas une fiche exhaustive.

**Phrase unique** : `Retrouvez le mot derrière la traduction.`

**Fonctions montrées** : Strong hébreu/grec, écriture originale, translittération, prononciation et données lexicales selon les ressources installées.

**Animation** : « Abel » se retourne ou se dédouble pour révéler l’hébreu.

### Scène 4 — Découvrir le mot apparenté

**Illustration** : `Abel · H1893` et `hevel · H1892` se placent côte à côte. Une connexion lexicale indique qu’ils ont la même forme hébraïque, tout en restant deux identités Strong distinctes. Une vapeur très légère peut matérialiser le sens sans devenir poétique.

**Phrase unique** : `Un mot peut en révéler un autre.`

**Fonctions montrées** : familles et relations lexicales, nuances, identités Strong enrichies.

**Animation** : les mêmes lettres hébraïques s’alignent ; les codes H1893 et H1892 restent distincts.

### Scène 5 — Parcourir les occurrences

**Illustration** : le mot `הֶבֶל` reste fixe tandis que plusieurs traductions passent autour de lui. Ecclésiaste 1.2 devient la nouvelle carte active : « Vanité des vanités… ». Le mot original demeure visuellement stable.

**Phrase unique** : `Suivez un mot à travers toute la Bible.`

**Fonctions montrées** : concordance, occurrences, traductions différentes, navigation entre passages.

**Animation** : les traductions glissent ; l’hébreu reste ancré ; Ecclésiaste 1.2 se fixe.

### Scène 6 — Conserver une question

**Illustration** : une note manuscrite apparaît : `Abel s’écrit comme hevel, souffle ou vapeur. Pourquoi ce nom ?` Elle se place près des cartes sources.

**Phrase unique** : `Gardez vos questions avec leurs sources.`

**Fonctions montrées** : création de note, annotation personnelle, provenance conservée.

**Animation** : la question s’écrit en quelques traits ; les cartes sources se rapprochent sans encore être toutes connectées.

Important : cette question appartient à l’utilisateur. Bible Strong ne doit pas affirmer qu’Ève considérait Abel comme inutile ni prétendre connaître son intention.

### Scène 7 — Organiser avec des tags

**Illustration** : un tag `Abel` apparaît comme une étiquette ou un halo. Il est appliqué successivement au verset/surlignage, à H1893, à H1892, à la note et à la future étude. Les éléments se regroupent visuellement sans créer de lignes entre eux.

**Phrase unique** : `Regroupez tout ce qui nourrit une même recherche.`

**Fonctions montrées** : tags transversaux et consultation d’un ensemble thématique.

**Animation** : le tag se duplique sur plusieurs objets ; les objets partagent alors un halo discret de même couleur.

### Scène 8 — Créer des relations

**Illustration** : l’utilisateur relie explicitement la note à Genèse 4.2, H1893, H1892 et Ecclésiaste 1.2. Chaque ligne peut porter une relation courte : `explique`, `référence`, `mentionne` ou simplement `lié à`.

**Phrase unique** : `Reliez vos découvertes, pas seulement vos pages.`

**Fonctions montrées** : relations manuelles, types de relations, direction éventuelle, navigation entre objets.

**Animation** : un fil part de la note vers un objet choisi ; la relation reçoit son verbe ; une impulsion parcourt ensuite la ligne.

### Scène 9 — Poursuivre une idée dans les Écritures

**Illustration** : quelques cartes bibliques prolongent la recherche : Genèse 4.10, Matthieu 23.35, Hébreux 11.4 et Hébreux 12.24. Deux cartes sont pleinement visibles, les autres restent en satellites ou dans un agrégat `+2`.

**Phrase unique** : `Suivez une idée à travers les Écritures.`

**Fonctions montrées** : références croisées, recherche, commentaires, thèmes, ouverture de nouveaux passages.

**Animation** : l’onde du « sang qui crie » relie les passages ; chaque carte rejoint le canevas au lieu de remplacer la précédente.

### Scène 10 — Explorer l’entité Abel

**Illustration** : la fiche d’Abel devient une entité. Adam, Ève et Caïn apparaissent autour ; Seth est libellé « donné à la place d’Abel ». Un ruban chronologique situe Abel dans l’époque des origines sans afficher une durée de vie certaine.

**Phrase unique** : `Replacez chaque personne dans son contexte.`

**Fonctions montrées** : entités bibliques, relations entre personnes, références, événements, lieux et chronologie.

**Animation** : la fiche se déploie en réseau familial puis glisse sur un axe chronologique.

### Scène 11 — Construire une étude

**Illustration** : une étude intitulée `Abel — une vie comme un souffle` se compose avec Genèse 4.2, la note, H1892/H1893, Ecclésiaste 1.2, Genèse 4.10, Hébreux 11.4 et une source clairement attribuée.

**Phrase unique** : `Transformez vos découvertes en étude.`

**Fonctions montrées** : études, éditeur riche, insertion de versets et de Strong, organisation, sauvegarde, partage/export.

**Animation** : les éléments choisis quittent le canevas et s’assemblent dans une page, tout en conservant leurs liens.

### Scène 12 — Revenir au verset

**Illustration** : la caméra recule brièvement pour montrer tout le graphe, puis les cartes et connexions se replient dans « Abel » au sein de Genèse 4.2. Le lecteur redevient calme ; un petit indicateur signale que les notes, tags et relations restent accessibles.

**Phrase unique** : `Lisez simplement. Explorez aussi loin que vous le souhaitez.`

**Fonctions montrées** : continuité du parcours, multi-onglets/historique de navigation, retour au texte.

**Animation** : repli fluide du graphe vers le mot initial. Le bouton final reste `Continuer` et ouvre ensuite la préparation de la bibliothèque hors ligne.

## 6. Tags et relations — distinction produit à respecter

Cette distinction corrige une erreur d’une version précédente du storyboard.

### Tags

Un tag sert à **classer et retrouver ensemble** des contenus partageant un thème. Il n’exprime pas une proposition sémantique entre deux objets.

Le modèle actuel permet de taguer :

- des surlignages et, du point de vue utilisateur, des versets/passages sélectionnés ;
- des notes ;
- des liens externes enregistrés ;
- des études ;
- des Strong hébreux ;
- des Strong grecs ;
- des mots/entrées de dictionnaire ;
- des entrées Nave ;
- des annotations de mots.

Dans l’illustration, un tag doit donc être représenté comme une étiquette, une couleur commune, un halo ou un regroupement. Il peut s’appliquer à « un peu de tout ».

### Relations

Une relation sert à **connecter explicitement deux éléments ouvrables**. Elle peut porter un sens et parfois une direction.

Points de connexion pris en charge :

- passage ou groupe de versets ;
- note ;
- étude ;
- Strong ;
- entrée Nave ;
- entrée de dictionnaire ;
- lien externe ;
- mot.

Types actuels : `lié à`, `référence`, `explique`, `contraste`, `mentionne`, `annote`, `lien externe`.

Les relations manuelles et les relations système doivent être distinguables visuellement. Les tags ne sont pas des nœuds du graphe et les relations ne sont pas des dossiers thématiques.

Exemple dans le parcours Abel :

- le tag `Abel` regroupe H1893, H1892, la note, des passages et l’étude ;
- la relation `la note explique Genèse 4.2` relie précisément deux objets ;
- la relation `la note référence H1892` conserve le chemin intellectuel ;
- une relation système peut indiquer qu’une note annote un passage.

## 7. Inventaire des fonctionnalités de Bible Strong

Cet inventaire aide à choisir les fonctionnalités visibles dans l’onboarding et celles qui resteront sous forme de pistes annexes.

### Lecture biblique

- plus de 40 traductions françaises, anglaises, hébraïques et grecques ;
- lecture par livre, chapitre et verset ;
- versions avec numéros Strong et ressources interlinéaires ;
- comparaison de traductions ;
- sélection d’un mot, d’un verset ou d’un passage ;
- couleurs, surlignages, annotations de mots et signets ;
- partage de passages ;
- réglages de lecture et plusieurs thèmes ;
- plusieurs onglets de Bible ouverts simultanément.

### Étude du texte

- lexiques Strong hébreu et grec ;
- formes originales, translittérations, identités Strong et concordance ;
- occurrences d’un mot dans la Bible ;
- familles, sous-entrées et relations lexicales selon les bases installées ;
- dictionnaire biblique Westphal ;
- Nave’s Topical Bible ;
- commentaires bibliques ;
- références croisées ;
- recherche locale dans les textes et ressources.

### Entités et contexte

- entités bibliques enrichies : personnes, lieux, groupes et autres catégories ;
- descriptions, articles, références bibliques et relations entre entités ;
- données contextuelles et localisation quand elles existent ;
- chronologie biblique avec plus de 850 entrées interconnectées, événements et personnages ;
- médias ou illustrations associés à certains passages/événements.

### Travail personnel

- notes ;
- surlignages ;
- annotations ciblées sur des mots ;
- signets ;
- liens externes enregistrés ;
- tags transversaux ;
- relations typées entre contenus ;
- listes, recherche, filtres et tri de ces contenus.

### Études

- création d’études structurées ;
- éditeur riche ;
- insertion de liens ou blocs de versets ;
- insertion de liens ou blocs Strong ;
- tags et relations ;
- sauvegarde automatique ;
- plusieurs études ouvertes dans les onglets ;
- publication, partage natif et export PDF.

### Lecture accompagnée et média

- plans de lecture avec progression ;
- Bible audio avec lecture en arrière-plan ;
- bibliothèque de médias liée à certains passages.

### Offline, compte et continuité

- fonctionnement offline pour les ressources téléchargées ;
- téléchargement de Bibles et bases SQLite ;
- choix de packs et gestion du stockage ;
- récupération en cas de ressource manquante ou corrompue ;
- authentification et synchronisation cloud des données personnelles ;
- sauvegarde, import et export ;
- interface en français et en anglais.

## 8. Fonctionnalités à montrer ou seulement suggérer

### Fil principal

- lecture et annotation ;
- ressources du verset ;
- Strong et texte original ;
- occurrences ;
- note ;
- tags ;
- relations ;
- entité/contexte ;
- étude finale.

### Satellites visuels, sans scène dédiée obligatoire

- dictionnaire ;
- commentaires ;
- Nave/thèmes ;
- comparaison de traductions ;
- recherche ;
- signets ;
- audio ;
- plans ;
- partage/export ;
- médias.

Le scénario ne doit pas chercher à démontrer chaque fonction. Sa réussite se mesure à la compréhension de la boucle : **lire → approfondir → conserver → organiser → relier → construire**.

## 9. Garde-fous éditoriaux sur Abel

- Le nom propre Abel `הֶבֶל` correspond à la même forme hébraïque que le nom commun souvent rendu par souffle, vapeur, fugacité ou vanité.
- Le nom propre et le nom commun ont deux identités Strong distinctes : H1893 et H1892.
- Genèse n’explique pas pourquoi Abel reçoit ce nom et ne dit pas ce qu’Ève pensait. Toute hypothèse doit apparaître comme une question personnelle.
- Ne jamais affirmer qu’Ève considérait Abel comme inutile.
- La Bible ne donne ni âge, ni durée de vie, ni épouse, ni enfant à Abel.
- Abel n’appartient pas à la généalogie de Jésus ; celle-ci passe par Seth.
- Le rapprochement solide avec Jésus est textuel : Matthieu 23.35, Hébreux 11.4 et Hébreux 12.24.
- Si la timeline est montrée, parler de contexte ou de datation reconstruite, jamais d’une durée de vie bibliquement attestée.

## 10. Transition vers l’offline

Le récit d’Abel doit fonctionner avec un petit jeu de données embarqué afin de ne pas dépendre de ressources encore absentes.

Après la scène finale :

1. `Continuer` ouvre la sélection/préparation des ressources ;
2. l’utilisateur choisit ou confirme les packs nécessaires ;
3. le téléchargement obligatoire démarre avec progression, taille et récupération d’erreur ;
4. des cartes « Le saviez-vous ? » occupent utilement l’attente ;
5. une fois les données prêtes, l’application ouvre un vrai passage ou propose de reprendre Genèse 4.2.

Le brouillon d’étude simulé ne doit pas polluer les données personnelles. Il doit être supprimé à la fin ou proposé explicitement comme étude d’exemple à conserver.

## 11. Attendus pour la prochaine intervention

L’agent spécialisé devrait produire :

- une recommandation sur le nombre final de scènes et les regroupements possibles ;
- un storyboard visuel précis, écran par écran ;
- une grammaire d’animation commune ;
- au moins trois directions graphiques réellement différentes avant convergence ;
- une version statique pour « Réduire les animations » ;
- les états retour, swipe, interruption et reprise ;
- la transition complète vers le téléchargement offline ;
- idéalement un prototype mobile léger permettant de juger le rythme, pas seulement des images isolées.

## 12. Suggested skills

- `frontend-design` pour établir une direction d’interface mobile cohérente et distinctive ;
- `make-interfaces-feel-better` pour la hiérarchie, les détails d’interaction et la sensation de qualité ;
- `creating-reanimated-animations` pour transformer le storyboard en animations React Native/Reanimated ;
- `reanimated-skia-performance` si le canevas de nœuds ou les tracés deviennent graphiquement complexes ;
- `prototype` pour tester rapidement le rythme, les transitions et la densité avant intégration ;
- `imagegen` pour explorer des directions visuelles, mais pas comme substitut au prototype final.

## 13. Références disponibles dans le dépôt

- `docs/agents/research/onboarding-biblical-journey-candidates.md` : storyboard long, variantes bibliques et garde-fous ;
- `docs/agents/research/onboarding-biblical-narrative-paths.md` : audit biblique du parcours Abel ;
- `docs/agents/research/mobile-onboarding-best-practices-2026.md` : pratiques d’onboarding, accessibilité, instrumentation et futur premium IA ;
- `src/themes/colors.ts` : palette light exacte ;
- `src/redux/modules/user/tags.ts` et `tagAssignments.ts` : types d’objets taguables ;
- `src/features/studyRelations/domain.ts` : modèle des relations ;
- `src/features/onboarding/` : onboarding actuel et téléchargement des ressources.

## 14. Résumé en une phrase

Faire vivre à l’utilisateur une mini-étude d’Abel, visuellement légère et presque sans texte, pour lui montrer que Bible Strong permet de partir d’un mot, d’explorer profondément, de taguer largement, de créer des relations précises et de transformer ses découvertes en étude — avant de préparer sa bibliothèque offline.
