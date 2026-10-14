# Valence 1876 : l’univers

Un univers à part entière sur le moteur de World, à l’adresse [`/valence-1876`](https://world.bible-strong.app/valence-1876). Le visiteur arrive en gare de Valence en octobre 1876 et traverse la ville : huit stations datées, des habitants animés qui racontent comment on étudiait la Bible en 1877, sept objets du pionnier à trouver, un fil pointillé qui suit l’ordre des dates, et un épilogue qui ouvre le livre d’or des cent cinquante ans.

Le décor, ses règles d’intégrité et ses choix sont dans [decor.md](./decor.md). Les dialogues, générés depuis le code, sont dans [dialogues.md](./dialogues.md). Les dossiers de recherche sont dans [recherche/](./recherche/README.md).

## Lancer

```sh
yarn workspace @bible-strong/world dev:client
```

Puis ouvrir http://localhost:5186/valence-1876. Paramètres utiles :

- `?stand` : écran de stand. Grand QR code vers l’univers, et remise à zéro de la visite après deux minutes et demie sans geste.
- `?debug` (développement seulement) : zones de marche, rayons des stations, position et images par seconde. En développement, `window.valence` expose les contrôles de la scène (par exemple `valence.travelTo = { x, y }`).

La langue suit celle de World (`bible-strong.world.language.v1`), l’avatar aussi (`bible-strong.world.profile.v1`). La progression est gardée dans `bible-strong.valence-1876.progress.v1`.

## Ce qui tourne dans le navigateur

| Fichier | Rôle |
| --- | --- |
| `src/valence/ValenceApp.tsx` | Interface : chargement, introduction, frise, objets, carnet, stand, dialogues |
| `src/valence/valence-game.ts` | Scène Phaser : tuiles HD, avatar, marche au clavier, au joystick et au clic, caméra, fil, objets, silhouette de l’avatar caché |
| `src/valence/valence-story.ts` | Le scénario, en français et en anglais, avec les sources. **Fait foi** pour les textes |
| `src/valence/StationDialog.tsx` | Le dialogue en trois temps, les étiquettes réel ou composite, les sources, le panneau « aujourd’hui » |
| `src/valence/ObjectCard.tsx` | La carte « hier, aujourd’hui » et l’image de partage 1200 × 630 (valeurs du design system) |
| `src/valence/valence-ambience.ts` | Fumées, feuilles, poussière dorée, reflets et traits de courant du Rhône, ombres de nuages, gerbe d’objet trouvé. Le fleuve est animé par programme : deux essais MiniMax sur l’eau seule y ont ajouté des barques et des passagers en couleur, rejetés |
| `src/valence/valence-occluders.ts` | Découpes chargées à la demande pour passer derrière les arbres, toits et étals |
| `src/valence/generated/` | Manifestes générés : tuiles, découpes, scènes animées, points d’ancrage et fil |
| `public/valence-1876/` | Tuiles, scènes animées, découpes, objets, portraits, captures de l’app, navigation, QR code |

Le moteur partagé a reçu trois paramètres, sans changer le comportement de l’archipel : `MapTileStreamer` accepte une autre source de tuiles, `loadReader` un autre dossier, `Pathfinder` un autre pas de grille, et `findSafePosition` d’autres dimensions.

## Comment les images ont été produites

Tout le travail intermédiaire reste dans `art-workbench/experiments/valence-1876/`, ignoré par Git. Les scripts qui l’exploitent sont versionnés dans `scripts/valence/`.

1. **La carte.** Concept retenu le 14 octobre 2026 ([concepts/carte-v1.webp](./concepts/carte-v1.webp), prompts dans [concepts/carte-v1-prompts.md](./concepts/carte-v1-prompts.md)), agrandi ×4 avec Topaz Redefine sur fal (créativité 2, texture 3) en 6688 × 3764. Le système de coordonnées est 1672 × 941.
   `node scripts/valence/build-map-tiles.mjs <hd.png>` écrit l’aperçu, les tuiles 2× et 4× et `generated/map-tiles.json`.
2. **Les personnages.** Une feuille de style de huit personnages (`characters/style-sheet-v1.png`, codex-imagegen) sert de référence. Pour chaque scène, une découpe HD de la carte est éditée avec codex-imagegen pour y ajouter les personnages, puis animée par MiniMax H3 sur fal (10 s, 768P, même image au début et à la fin, caméra fixe), puis détourée par SAM 3 vidéo. Les prompts sont dans `scenes/config.json` et `scenes/<id>/still-prompt.txt`.
   `art-workbench/.venv-tools/bin/python scripts/valence/build_scene_atlas.py [id…]` découpe 120 images à 12 images par seconde, écarte les fragments qui touchent le bord, referme la boucle sur la première pose et assemble des atlas WebP de 2048 pixels au plus. Le bateau à vapeur est un « patch » : toute la zone est remplacée avec des bords fondus, parce que le bateau dérive. La mémoire graphique décodée des dix scènes est de 94 Mio ; chaque scène n’est chargée qu’à l’approche de la caméra.
3. **La marche et les découpes.** SAM 3 image donne le sol pavé (« paved ground ») et, sur 18 portions de la carte, les arbres, cyprès, réverbères, bâtiments, étals, statue, kiosque, caisses, bancs et canons.
   `art-workbench/.venv-tools/bin/python scripts/valence/build_navigation.py` rend praticables les feuillages et toits des objets posés au sol, ne bloque que leur pied, applique les retouches manuelles de `scripts/valence/navigation-edits.json` (cour des Faure, esplanade, parvis du temple, table), garde le sol relié à la gare avec la marge de l’avatar, découpe la navigation en tuiles de 64 unités pour le pathfinder, calcule le fil par le milieu des rues, place stations et objets sur un sol accessible, et exporte les découpes avec leur ligne de sol (les grands bâtiments en bandes de 48 unités, chacune à sa profondeur).
4. **Objets et portraits.** Sept objets sur fond magenta et le crieur (codex-imagegen), détourés depuis les bords avec `art-workbench/experiments/valence-1876/prep-ui-art.py`. Les portraits viennent de la feuille de style.
5. **Aujourd’hui.** Les captures sont de vraies captures de l’app, prises dans `docs/assets/app-flows/screenshots/`.
6. **Dialogues.** `node --experimental-strip-types scripts/valence/export-dialogues.mjs` régénère [dialogues.md](./dialogues.md).

## Vérifier

```sh
yarn workspace @bible-strong/world test
yarn workspace @bible-strong/world build
```

`src/valence/valence.test.ts` vérifie l’intégrité du récit (huit stations datées, des sources partout, seuls Daniel et Marion Bourdeau parlent en personnes réelles, une seule question au visiteur), l’accessibilité de chaque station et de chaque objet depuis la gare, la taille des polygones, les découpes et les atlas.

## Limites connues

- Le quai bas, la cour de la caserne et le parvis du Pendentif ne sont pas praticables : leurs accès ne sont pas lisibles sur la carte. Les lavandières et les soldats s’y voient depuis l’esplanade et la rue.
- Les saisons ne sont pas dessinées par des accessoires propres à chaque station : la carte est une seule fin d’après-midi.
- Pas de multijoueur, ni d’habitants qui marchent : les habitants jouent leur boucle sur place.
- Les liens « aujourd’hui » ouvrent l’app web (`web.bible-strong.app`) ; ils n’ont pas été vérifiés un par un dans l’app installée.
- Les points à vérifier avec un relecteur de l’UFA restent ceux de [decor.md](./decor.md#9-ce-qui-reste-à-trancher-avec-un-relecteur).
