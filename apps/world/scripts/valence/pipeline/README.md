# Valence 1876 : chaîne de production des images

Copies versionnées des scripts qui ont produit les images de Valence 1876. Ils s’exécutent depuis l’atelier ignoré `art-workbench/experiments/valence-1876/`, où ils ont été écrits : leurs chemins sont relatifs à cet atelier.

| Fichier | Rôle | Place dans l’atelier |
| --- | --- | --- |
| `fal-run.mjs` | Soumet et récupère une tâche fal (Topaz, MiniMax H3, SAM 3) ; les entrées `file:` sont téléversées | `fal-run.mjs` |
| `style-sheet-prompt.txt` | Prompt de la feuille de huit personnages | `characters/style-sheet.txt` |
| `scenes-config.json` | Les dix scènes animées : découpe, personnages, mouvement, prompt du masque | `scenes/config.json` |
| `make-stills.py` | Ajoute les personnages aux découpes HD (codex-imagegen) | `scenes/make-stills.py` |
| `minimax.py` | Anime chaque image fixe (MiniMax H3, 10 s, 768P, boucle) | `scenes/minimax.py` |
| `sam-video.py` | Passe à 12 images par seconde et détoure (SAM 3 vidéo) | `scenes/sam-video.py` |
| `detect-objects.py` | Détecte arbres, bâtiments, étals… sur la carte (SAM 3 image, `--fine` pour le second passage) | `objects/detect.py` |
| `make-objects.py` | Les sept objets sur fond magenta et le crieur | `objects-art/make.py` |
| `prep-ui-art.py` | Détoure objets et portraits vers `public/valence-1876/` | `prep-ui-art.py` |
| `make-busts.py` | Bustes de dialogue : un buste neutre par personnage (`master`), puis quatre humeurs par retouche du visage (`moods`) | `busts/make.py` |
| `paper.py` | Texture de papier ancien : prompt d’origine, puis raccord des bords par décalage d’une demi-tuile | `paper/` |

Ensuite, depuis `apps/world` : `build-map-tiles.mjs`, `build_scene_atlas.py`, `build_navigation.py`, `build_busts.py` et `export-dialogues.mjs` (voir `docs/valence-1876/README.md`). La clé `FAL_KEY` est lue dans le `.env` à la racine du dépôt ; codex-imagegen utilise la session Codex locale.
