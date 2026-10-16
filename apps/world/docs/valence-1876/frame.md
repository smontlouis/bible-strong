# Le cadre de Valence

Valence est accrochée comme un tableau : en dézoomant, on découvre le cadre doré, puis le tableau entier sur un mur bordeaux, avec son cartel « Valence, 1876 ». À zoom normal, la caméra reste sur la carte ; le cadre n'apparaît qu'au moment où la vue devient plus grande que la carte. Le dessin est fait par `src/world-frame.ts`, réglé dans `src/valence/valence-game.ts` (`FRAME`).

## L'image

Cadre généré avec codex-imagegen (`generate`, 1024 × 1024, qualité haute ; le service a rendu 1254 × 1254), variante 2 sur 2. Les essais restent dans `art-workbench/experiments/valence-1876/frame/`.

> A single empty antique picture frame seen perfectly straight on, front view, no perspective, for a museum painting: a 19th-century carved giltwood frame, warm aged gold leaf slightly worn with soft brown patina in the recesses, an inner bead-and-reel lip, a wide concave cove, and an outer carved acanthus-leaf ridge. The four corners carry matching carved acanthus ornaments. Along each straight side between the corners the moulding is perfectly uniform and continuous, with the same profile all along, no central cartouche, no ornament in the middle of the sides. All four sides have exactly the same width, about 11% of the image width. The frame is a perfect square and fills the whole canvas edge to edge. The opening inside the frame and nothing else: perfectly flat, uniform, solid pure magenta (#FF00FF), no canvas, no picture, no glass, no shadow inside. Even soft gallery lighting from the top left, subtle, no harsh highlights. No text, no letters, no signature, no background outside the frame.

`scripts/build-world-frame.py` l'ajuste à la carte : les coins sont gardés, chaque côté répète sa partie centrale avec un fondu aux raccords et se termine contre la sculpture du coin suivant, l'ouverture devient transparente. La bordure (`--border`) et la partie posée sur la carte (`--lip`) doivent être les mêmes que dans `FRAME`.

```bash
art-workbench/.venv-tools/bin/python -I scripts/build-world-frame.py art-workbench/experiments/valence-1876/frame/frame-2.png public/valence-1876/frame/frame.webp --width 1672 --height 941 --border 72 --lip 10 --scale 2
```

Le mur, sa lumière, l'ombre du tableau et le cartel sont dessinés dans le jeu, sans image.
