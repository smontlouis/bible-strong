import subprocess, os
from concurrent.futures import ThreadPoolExecutor
here=os.path.dirname(os.path.abspath(__file__))
style=os.path.join(here,'..','characters','style-sheet-v1.png')
objs={
 'ostervald':'a thick old leather-bound family Bible from the 1870s, closed, with worn corners, a ribbon bookmark and a small brass clasp',
 'signes':'a folded large-format 19th-century newspaper, eight pages, slightly crumpled, with dense columns suggested by fine lines only (no readable letters)',
 'concordance':'a thick heavy octavo reference book lying open, pages fanning, with a pencil resting on it',
 'bost':'two matching old cloth-bound dictionary volumes stacked on top of each other',
 'sander':'a small old dictionary with a plain embossed geometric border on its cover, slightly open, its pages showing tiny abstract square marks suggesting Hebrew script (no readable letters, no symbol on the cover)',
 'lampe':'a 19th-century glass kerosene oil lamp with a round brass base and a tall glass chimney, its small flame lit and glowing softly',
 'lettre':'a folded handwritten letter with a red wax seal and an envelope, tied with a thin string (no readable writing)',
}
def run(item):
    k,desc=item
    out=os.path.join(here,f'{k}.png')
    if os.path.exists(out): return k+' exists'
    prompt=f"""A single small game collectible item icon: {desc}. Drawn exactly in the hand-drawn style of the reference image: scratchy dark-brown nib-pen ink outlines, flat warm sepia fills, light crosshatching, gentle storybook charm. Three-quarter top-down view, centered, occupying the middle 70% of the canvas. Sepia only, no other colour. Place it on a perfectly flat, uniform, solid pure magenta background (#FF00FF) filling the whole canvas, with no gradient, no ground, no shadow, no frame, no text and no letters. Do not use magenta anywhere in the object."""
    r=subprocess.run(['codex-imagegen','edit','--prompt',prompt,'--image',style,'--out',out,'--size','1024x1024','--quality','high','--timeout','600'],capture_output=True,text=True)
    return f"{k}: {r.returncode} {r.stderr.strip()[-200:]}"
def crier():
    out=os.path.join(here,'..','characters','crier.png')
    if os.path.exists(out): return 'crier exists'
    prompt="""One full-body character in exactly the style of the reference character sheet (oversized head, thin spindly limbs, small dot eyes, scratchy dark-brown ink, flat sepia fills): a 12-year-old newspaper boy of 1877 in a flat cap, short jacket, short trousers and boots, holding up a folded newspaper in one raised hand and a small stack of newspapers under the other arm, mouth open as if calling out. Three-quarter front view, standing, on a plain flat cream parchment background like the reference, centered with margin. Sepia only. No text."""
    r=subprocess.run(['codex-imagegen','edit','--prompt',prompt,'--image',style,'--out',out,'--size','1024x1024','--quality','high','--timeout','600'],capture_output=True,text=True)
    return f"crier: {r.returncode} {r.stderr.strip()[-200:]}"
with ThreadPoolExecutor(8) as ex:
    futs=[ex.submit(run,i) for i in objs.items()]+[ex.submit(crier)]
    for f in futs: print(f.result(),flush=True)
