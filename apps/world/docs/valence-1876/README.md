# Valence 1876 : l’univers

Un univers à part entière sur le moteur de World, à l’adresse [`/valence-1876`](https://world.bible-strong.app/valence-1876). Le visiteur arrive en gare de Valence en octobre 1876 et traverse la ville : huit stations datées, des habitants animés qui racontent comment on étudiait la Bible en 1877, sept objets du pionnier à trouver, et un épilogue qui ouvre le livre d’or des cent cinquante ans.

Le décor, ses règles d’intégrité et ses choix sont dans [decor.md](./decor.md). Les dialogues, générés depuis le code, sont dans [dialogues.md](./dialogues.md). Les dossiers de recherche sont dans [recherche/](./recherche/README.md).

## Lancer

```sh
yarn dev:world
```

Puis ouvrir http://localhost:5186/valence-1876. `yarn dev:world` lance le site et le Worker local du multijoueur ; avec `dev:client` seul, la visite marche mais les autres visiteurs et les émoticônes restent hors ligne. Paramètres utiles :

- `?stand` : écran de stand. Grand QR code vers l’univers, et remise à zéro de la visite après deux minutes et demie sans geste.
- `?debug` (développement seulement) : zones de marche, rayons des stations, position et images par seconde. En développement, `window.valence` expose les contrôles de la scène (par exemple `valence.travelTo = { x, y }`).

La langue suit celle de World (`bible-strong.world.language.v1`). L’avatar est celui de tous les mondes (`bible-strong.world.profile.v1`, [ADR-0085](../../../../docs/adr/0085-travel-between-worlds-inside-one-world-application.md)) : un visiteur qui n’en a pas encore le choisit à la première visite, avant l’introduction, et le change depuis le carnet. L’ancien avatar propre à Valence est repris une fois s’il n’existe pas encore de profil World. La progression est gardée dans `bible-strong.valence-1876.progress.v1`.

## Le train vers l’archipel

On vient à Valence et on en repart par le train. Dans l’archipel, l’arche de pierre posée sur le cercle au sud de l’île des comparaisons (`src/world-portal.ts`) mène à Valence ; à Valence, le train de Lyon, au bout du quai de la gare, ramène à l’archipel. Le voyage se fait sans recharger la page : un voile couleur papier grandit depuis le portail, Valence se charge dessous, l’adresse devient `/valence-1876`, puis le voile s’ouvre sur le voyageur qui descend du train. Le quai (« Quai de la gare » dans `navigation.json`) et le point d’arrivée du train (`portal` et `portalLabel` dans `layout.json`) se règlent dans l’atelier, onglet Repères. Les liens « Retour à Bible Strong World » du titre et du carnet prennent le même train.

## Multijoueur

Valence a son propre salon, `valence-1876`, sur le même Worker et le même protocole que l’archipel (`server/index.ts`). On y voit les autres visiteurs avec leur nom, le nombre de présents, et on s’envoie des émoticônes ; il n’y a pas de jeux bibliques, et le serveur ignore les commandes de jeu dans ce salon. Les arrivées se font sur le parvis de la gare (`src/valence/valence-spawn.ts`), sauf pour un voyageur venu par le train : il reste sur le quai et ignore la première position que propose le serveur. En mode stand, cinq passants simulés se promènent sur la place des Clercs tant qu’il y a peu de vrais visiteurs ; ils répondent aux émoticônes.

Le salon dépend du Worker : il faut le redéployer (`yarn workspace @bible-strong/world deploy`) pour que le multijoueur de Valence fonctionne en production.

## L’atelier (développement seulement)

En local, le bouton « Atelier » ouvre les mêmes outils que « Éditer le monde » dans World. Chaque onglet sauvegarde directement dans un fichier du projet, à travers le serveur Vite ; rien de tout cela n’existe dans la version de production.

| Onglet | Ce qu’on règle | Fichier |
| --- | --- | --- |
| Accès | Zones vertes où l’on marche et obstacles rouges, avec l’éditeur de World. « Tester au joystick » rejoue la carte avec les zones visibles | `public/valence-1876/navigation.json` |
| Repères | Point d’arrivée, train vers l’archipel (le cercle est la portée du départ) et son étiquette, stations (le cercle est la portée d’écoute), étiquettes, objets, et le fil des dates (il n’est plus dessiné sur la carte depuis le 15 octobre 2026, la frise suffit ; ses tracés restent dans le document) : glisser les points, double-clic sur le fil pour en ajouter, Suppr pour retirer, « Redessiner » un tronçon point par point ou « Tracé automatique » | `public/valence-1876/layout.json` |
| Eau et effets | Contour du Rhône, zones sans effet (pile du pont…), reflets, traits de courant, feuilles, ombres de nuages, sources de fumée | `public/valence-1876/effects.json` |
| Rivages | Écume le long des quais, avec l’éditeur de rivages de World (écume crème sur l’eau sépia) | `public/valence-1876/shorelines.json` |
| Particules, Lueurs, Papillons, Libellules | Zones d’ambiance de World ; la poussière dorée des places ensoleillées est un jeu de zones Particules | `public/valence-1876/ambience.json` |

Les zones de marche sont stockées en quelques grands polygones pour rester faciles à retoucher ; au chargement, `src/valence/navigation-tiles.ts` les découpe en carreaux de 64 unités pour la marche et le calcul des chemins. Une fois `navigation.json` ou `layout.json` retouché dans l’atelier, c’est lui qui fait foi : `build_navigation.py` ne les réécrit plus, sauf avec `--reset-navigation` ou `--reset-layout`.

## Ce qui tourne dans le navigateur

| Fichier | Rôle |
| --- | --- |
| `src/valence/ValenceApp.tsx` | Interface : chargement, introduction, frise, objets, carnet, stand, dialogues |
| `src/valence/valence-game.ts` | Scène Phaser : tuiles HD, avatar, marche au clavier, au joystick et au clic, caméra, fil, objets, silhouette de l’avatar caché, autres visiteurs, émoticônes, passants du stand |
| `src/valence/valence-documents.ts` | Format et validation des documents de l’atelier (disposition, effets) ; partagé avec le serveur Vite et le Worker |
| `src/valence/ValenceWorkshop.tsx`, `workshop-model.ts`, `workshop-overlay.ts` | L’atelier : panneaux, état partagé et poignées sur la carte |
| `src/valence/valence-story.ts` | Le scénario, en français et en anglais, avec les sources. **Fait foi** pour les textes |
| `src/valence/StationScene.tsx` | La scène de dialogue, comme dans un jeu à histoire : une fenêtre sombre de 1200 × 800 au plus sur la carte floutée (plein écran sur téléphone), le premier personnage en buste à gauche et le second à droite, debout derrière le cadre de texte, une humeur par réplique, le texte qui s’écrit (Espace, Entrée ou → pour avancer, ← pour revenir), les notes historiques en cartons de film muet, les trois temps, la relecture et le panneau « aujourd’hui ». Sous le nom, un rôle qui se comprend seul (« Épouse de Daniel, 35 ans ») ; ni sources ni étiquette réel ou composite à l’écran |
| `src/valence/valence.css` | Le style de 1877 : chaque surface est une feuille carrée de papier ancien (`paper.webp`) dans un double filet d’encre, chaque bouton un bloc d’encre à l’ombre portée dure, les titres en Literata. Les jetons `--bs-*` y sont repeints en sépia, ce qui habille aussi l’éditeur d’avatar, les réactions et le livre d’or de World. Seul le panneau « aujourd’hui » garde les couleurs de Bible Strong |
| `src/valence/ObjectCard.tsx` | La carte « hier, aujourd’hui » et l’image de partage 1200 × 630 (valeurs du design system) |
| `src/valence/valence-ambience.ts` | Fumées, feuilles, poussière dorée, reflets et traits de courant du Rhône, ombres de nuages, gerbe d’objet trouvé. Le fleuve est animé par programme : deux essais MiniMax sur l’eau seule y ont ajouté des barques et des passagers en couleur, rejetés |
| `src/valence/valence-occluders.ts` | Découpes chargées à la demande pour passer derrière les arbres, toits et étals ; les arbustes et les haies basses frémissent et perdent quelques feuilles sépia quand un visiteur les traverse |
| `src/valence/generated/` | Manifestes générés : tuiles, découpes, scènes animées, points d’ancrage et fil |
| `public/valence-1876/` | Tuiles, scènes animées, découpes, objets, portraits, bustes de dialogue, papier, captures de l’app, navigation, QR code |

Le moteur partagé a reçu quelques paramètres, sans changer le comportement de l’archipel : `MapTileStreamer` accepte une autre source de tuiles, `loadReader` un autre dossier, `Pathfinder` un autre pas de grille, `findSafePosition` d’autres dimensions, et `BushRustle` une autre règle pour choisir les découpes qui frémissent et d’autres couleurs de feuilles.

## Comment les images ont été produites

Tout le travail intermédiaire reste dans `art-workbench/experiments/valence-1876/`, ignoré par Git. Les scripts qui l’exploitent sont versionnés dans `scripts/valence/`.

1. **La carte.** Concept retenu le 14 octobre 2026 ([concepts/carte-v1.webp](./concepts/carte-v1.webp), prompts dans [concepts/carte-v1-prompts.md](./concepts/carte-v1-prompts.md)), agrandi ×4 avec Topaz Redefine sur fal (créativité 2, texture 3) en 6688 × 3764. Le système de coordonnées est 1672 × 941.
   `node scripts/valence/build-map-tiles.mjs <hd.png>` écrit l’aperçu, les tuiles 2× et 4× et `generated/map-tiles.json`.
2. **Les personnages.** Une feuille de style de huit personnages (`characters/style-sheet-v1.png`, codex-imagegen) sert de référence. Pour chaque scène, une découpe HD de la carte est éditée avec codex-imagegen pour y ajouter les personnages, puis animée par MiniMax H3 sur fal (10 s, 768P, même image au début et à la fin, caméra fixe), puis détourée par SAM 3 vidéo. Les prompts sont dans `scenes/config.json` et `scenes/<id>/still-prompt.txt`.
   `art-workbench/.venv-tools/bin/python scripts/valence/build_scene_atlas.py [id…]` découpe 120 images à 12 images par seconde, écarte les fragments qui touchent le bord, referme la boucle sur la première pose et assemble des atlas WebP de 2048 pixels au plus. Le bateau à vapeur est un « patch » : toute la zone est remplacée avec des bords fondus, parce que le bateau dérive. La mémoire graphique décodée des dix scènes est de 94 Mio ; chaque scène n’est chargée qu’à l’approche de la caméra.
3. **La marche et les découpes.** SAM 3 image a d’abord donné le sol pavé (« paved ground ») et, sur 18 grandes portions de la carte, les arbres, cyprès, réverbères, bâtiments, étals, statue, kiosque, caisses, bancs et canons. Comme SAM ne rend que 32 objets par portion, les bosquets denses perdaient des arbres : une seconde passe, `scripts/valence/pipeline/detect-dense.py`, découpe la carte en 45 carrés qui se chevauchent et y cherche arbres, cyprès, buissons, réverbères, bancs et caisses, puis le sol (pavé, rues, quais, pontons, escaliers, tablier du pont, cours). Le sol retenu exclut le Rhône et les bâtiments, garde les pontons et le pont au-dessus de l’eau ; un arbre ou un buisson ne bloque que son tronc, comme dans l’archipel. Le résultat a été revu zone par zone sur des planches : sol, obstacles et découpes sur la carte, avec une grille en unités de carte.
   `art-workbench/.venv-tools/bin/python scripts/valence/build_navigation.py` rend praticables les feuillages et toits des objets posés au sol, ne bloque que leur pied, applique les retouches manuelles de `scripts/valence/navigation-edits.json` (cour des Faure, esplanade, parvis du temple, quai de la gare, pont suspendu, quai haut et quai bas, pontons, escalier et terrasse de la citadelle, champ à l’ouest du temple, abords du Pendentif ; tables, étendoirs et caisses du quai bas ; découpes dessinées à la main pour la rambarde avant du pont et les étendoirs (`occluders`) ; zones sans découpe automatique là où elle recouvrirait une scène animée (`noOccluders`)), garde le sol relié à la gare avec la marge de l’avatar, découpe la navigation en tuiles de 64 unités pour le pathfinder, calcule le fil par le milieu des rues, place stations et objets sur un sol accessible, et exporte les découpes avec leur ligne de sol (les grands bâtiments en bandes de 48 unités, chacune à sa profondeur).
4. **Objets et portraits.** Sept objets sur fond magenta et le crieur (codex-imagegen), détourés depuis les bords avec `art-workbench/experiments/valence-1876/prep-ui-art.py`. Les portraits viennent de la feuille de style.
5. **Bustes de dialogue.** Pour chacun des neuf personnages, codex-imagegen dessine un buste neutre à partir de son portrait et de la feuille de style (taille, cadrage tourné vers la droite, sépia), puis retouche seulement le visage pour quatre humeurs : joyeux, pensif, surpris, grave. Le script est `scripts/valence/pipeline/make-busts.py` (`master`, puis `moods`) ; les réponses arrivent détourées.
   `art-workbench/.venv-tools/bin/python scripts/valence/build_busts.py` cadre les cinq humeurs d’un personnage sur la même boîte, les ramène à 1100 pixels de haut en WebP dans `public/valence-1876/busts/` et écrit leurs proportions dans `generated/busts.json`. Chaque réplique de `valence-story.ts` porte son humeur.
6. **Papier.** Une texture de papier vergé des années 1870 (codex-imagegen), rendue raccordable par `scripts/valence/pipeline/paper.py`, donne `public/valence-1876/paper.webp`.
7. **Aujourd’hui.** Les captures sont de vraies captures de l’app, prises dans `docs/assets/app-flows/screenshots/`.
8. **Dialogues.** `node --experimental-strip-types scripts/valence/export-dialogues.mjs` régénère [dialogues.md](./dialogues.md).

## Vérifier

```sh
yarn workspace @bible-strong/world test
yarn workspace @bible-strong/world build
```

`src/valence/valence.test.ts` vérifie l’intégrité du récit (huit stations datées, des sources partout, seuls Daniel et Marion Bourdeau parlent en personnes réelles, une seule question au visiteur), l’accessibilité de chaque station et de chaque objet depuis la gare, la taille des polygones, les découpes, les arbustes qui frémissent et les atlas.

## Limites connues

- La cour de la caserne et les jardins clos au sud-est ne sont pas praticables : leurs accès ne sont pas lisibles sur la carte. Les soldats s’y voient depuis la rue. Les toits, les voies ferrées, l’autre rive et le fleuve restent fermés, comme les jardinières surélevées en pierre.
- Les saisons ne sont pas dessinées par des accessoires propres à chaque station : la carte est une seule fin d’après-midi.
- Les habitants jouent leur boucle sur place ; seuls les visiteurs et les passants du stand se déplacent.
- Les liens « aujourd’hui » ouvrent l’app web (`web.bible-strong.app`) ; ils n’ont pas été vérifiés un par un dans l’app installée.
- Les points à vérifier avec un relecteur de l’UFA restent ceux de [decor.md](./decor.md#9-ce-qui-reste-à-trancher-avec-un-relecteur).
