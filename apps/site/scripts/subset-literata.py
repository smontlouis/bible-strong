#!/usr/bin/env python3
"""Cuts the serif of the site into the files a browser asks for.

`public/fonts/LiterataBook.otf` holds the Latin, Greek and Cyrillic letters of Literata Book.
This writes two WOFF2 files beside it: the letters the site shows, and the Cyrillic ones,
which no page has shown yet. Each is declared with the `unicode-range` printed at the end,
so a browser leaves the second file alone.

Greek stays with Latin on purpose. The reading pages declare the serif `optional`, and a
browser draws such a face only when it is there at the first paint, which means preloaded:
Greek words in a file of their own would be drawn in the fallback on every first visit.

Every letter but one of the private area, and every OpenType feature of the original, is
kept (small capitals, figures, kerning); only the split is new. The original stays where it is: the share images are set in
it, and their renderer does not read WOFF2 (`features/share/shareCardFonts.ts`).

Literata is under the SIL Open Font License 1.1, which allows this; its copyright and licence
notices are kept in each file.

Run from `apps/site` after changing the original, then copy the ranges into
`src/styles.css` and `src/resource-pages.css` if they moved:

    python3 -m venv /tmp/fonts && /tmp/fonts/bin/pip install fonttools brotli
    /tmp/fonts/bin/python scripts/subset-literata.py
"""

from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

FONTS = Path(__file__).resolve().parent.parent / "public" / "fonts"
SOURCE = FONTS / "LiterataBook.otf"

# The blocks of Unicode each file answers for. The first takes everything that is not
# Cyrillic: Latin and Greek letters, accents, transliteration marks, punctuation, figures
# and symbols.
RANGES = {
    "cyrillic": [(0x0400, 0x052F), (0x1C80, 0x1C8F), (0x2DE0, 0x2DFF), (0xA640, 0xA69F)],
    "latin-greek": [
        (0x0000, 0x03FF),
        (0x1D00, 0x1FFF),
        (0x2000, 0x2BFF),
        (0x2C60, 0x2C7F),
        (0xA700, 0xA7FF),
        (0xFB00, 0xFB06),
        (0xFEFF, 0xFEFF),
        (0xFFFD, 0xFFFD),
    ],
}

# Copyright, names, and the licence with its address: the notices the licence asks to keep.
KEPT_NAMES = [0, 1, 2, 3, 4, 5, 6, 13, 14]


def within(codepoint: int, ranges: list[tuple[int, int]]) -> bool:
    return any(low <= codepoint <= high for low, high in ranges)


def css_range(ranges: list[tuple[int, int]]) -> str:
    return ", ".join(
        f"U+{low:04X}" if low == high else f"U+{low:04X}-{high:04X}" for low, high in ranges
    )


def main() -> None:
    letters = set(TTFont(SOURCE).getBestCmap())
    # A letter of the private area has no meaning outside the font that drew it.
    letters = {codepoint for codepoint in letters if not 0xE000 <= codepoint <= 0xF8FF}
    claimed: set[int] = set()

    for script, ranges in RANGES.items():
        chosen = {codepoint for codepoint in letters if within(codepoint, ranges)}
        if chosen & claimed:
            raise SystemExit(f"{script} overlaps another file")
        claimed |= chosen

        options = subset.Options()
        options.flavor = "woff2"
        options.layout_features = ["*"]
        options.name_IDs = KEPT_NAMES
        options.notdef_outline = True
        font = TTFont(SOURCE)
        subsetter = subset.Subsetter(options)
        subsetter.populate(unicodes=sorted(chosen))
        subsetter.subset(font)
        target = FONTS / f"Literata-Book-{script}.woff2"
        subset.save_font(font, str(target), options)
        print(f"{target.name}: {len(chosen)} letters, {target.stat().st_size / 1024:.1f} kB")
        print(f"  unicode-range: {css_range(ranges)};")

    left_out = sorted(letters - claimed)
    if left_out:
        raise SystemExit("in no file: " + " ".join(f"U+{codepoint:04X}" for codepoint in left_out))


if __name__ == "__main__":
    main()
