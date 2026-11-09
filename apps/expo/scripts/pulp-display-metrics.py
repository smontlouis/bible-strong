#!/usr/bin/env python3
"""Gives the kit of Pulp Display back the metrics of its originals, then writes the app's files.

The kit (Transfonter's export of 2021) lost two things the original OTF files of the site
(`apps/site/public/fonts/UpType - Pulp Display *.otf`) carry:

- Its vertical metrics. For macOS and iOS (the `hhea` table) it declares an ascender of
  0.754 em over capitals of 0.713 em and a line gap of 0.2 em, which sets the text about
  0.1 em too high in every pill and button. The originals declare 1 em above the baseline,
  0.2 em below and no gap, which places it as the site and the system sans do. This writes
  those into `hhea` and the `OS/2` typographic metrics (with USE_TYPO_METRICS); the `OS/2`
  Windows metrics, which only bound what a letter may paint, cover the lowest letter of
  every weight. The line keeps its height of 1.2 em and every weight shares one baseline.
- Its weights and italics. Every file declares weight 400 and none is italic, so iOS, which
  picks a face by weight and by the italic flag, could draw upright text in an italic file.
  This declares each file's weight (400 to 800) and marks the italic files italic.

The outlines, names and features are untouched. The project owner approved these changes to
the files on 2026-11-09.

Run from `apps/expo` with the folder of the kit (the TTF files of Transfonter's export):

    python3 -m venv /tmp/fonts && /tmp/fonts/bin/pip install fonttools brotli
    /tmp/fonts/bin/python scripts/pulp-display-metrics.py ~/Downloads/pulp-display

It writes `src/assets/fonts/PulpDisplay-*.ttf` for the native apps and
`public/fonts/PulpDisplay-*.woff2` for the web.
"""

import sys
from pathlib import Path

from fontTools.ttLib import TTFont

WEIGHTS = {'Regular': 400, 'Medium': 500, 'SemiBold': 600, 'Bold': 700, 'ExtraBold': 800}
STYLES = [(name, weight, italic) for name, weight in WEIGHTS.items() for italic in (False, True)]

# The originals' metrics, in units of 1000 per em.
ASCENT = 1000
DESCENT = 200
# What a letter may paint below the baseline: ExtraBold reaches 256.
WIN_DESCENT = 264

ITALIC = 1 << 0  # OS/2 fsSelection
REGULAR = 1 << 6
USE_TYPO_METRICS = 1 << 7
MAC_ITALIC = 1 << 1  # head macStyle

APP = Path(__file__).resolve().parent.parent
TTF_DIR = APP / 'src' / 'assets' / 'fonts'
WOFF2_DIR = APP / 'public' / 'fonts'


def restore(font: TTFont, name: str, weight: int, italic: bool) -> None:
    head, hhea, os2 = font['head'], font['hhea'], font['OS/2']
    if head.unitsPerEm != 1000:
        raise SystemExit(f'{name}: {head.unitsPerEm} units per em, the metrics assume 1000')
    if head.yMax > ASCENT or -head.yMin > WIN_DESCENT:
        raise SystemExit(f'{name}: letters reach {head.yMax} and {head.yMin}, beyond the metrics')

    hhea.ascent, hhea.descent, hhea.lineGap = ASCENT, -DESCENT, 0
    os2.sTypoAscender, os2.sTypoDescender, os2.sTypoLineGap = ASCENT, -DESCENT, 0
    os2.usWinAscent, os2.usWinDescent = ASCENT, WIN_DESCENT
    if os2.version < 4:
        os2.version = 4
    os2.fsSelection |= USE_TYPO_METRICS

    # The originals set no style bit but italic; the kit's ExtraBold also says « extended ».
    os2.usWeightClass = weight
    if italic:
        os2.fsSelection = (os2.fsSelection | ITALIC) & ~REGULAR
        head.macStyle = MAC_ITALIC
    else:
        os2.fsSelection = (os2.fsSelection | REGULAR) & ~ITALIC
        head.macStyle = 0


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    kit = Path(sys.argv[1]).expanduser()
    TTF_DIR.mkdir(parents=True, exist_ok=True)
    WOFF2_DIR.mkdir(parents=True, exist_ok=True)

    for style, weight, italic in STYLES:
        name = f'PulpDisplay-{style}{"Italic" if italic else ""}'
        font = TTFont(kit / f'{name}.ttf', recalcTimestamp=False)
        restore(font, name, weight, italic)
        font.save(TTF_DIR / f'{name}.ttf')
        font.flavor = 'woff2'
        font.save(WOFF2_DIR / f'{name}.woff2')
        print(f'{name}: {ASCENT}/{DESCENT}, no line gap, weight {weight}{", italic" if italic else ""}')


if __name__ == '__main__':
    main()
