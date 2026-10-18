import json, subprocess, sys, os
from concurrent.futures import ThreadPoolExecutor
here = os.path.dirname(os.path.abspath(__file__))
jobs = json.load(open(os.path.join(here, 'config.json')))
only = sys.argv[1:] 
style = os.path.join(here, '..', 'characters', 'style-sheet-v1.png')
def run(job):
    d = os.path.join(here, job['id'])
    out = os.path.join(d, 'still.png')
    if os.path.exists(out): return f"{job['id']} exists"
    scale = job.get('scale', 'an adult character is about as tall as a doorway, roughly one third of the image height.')
    prompt = f"""EDIT THE FIRST IMAGE, which is a crop of our hand-drawn game map of Valence in 1877. Keep EVERYTHING in it identical: same framing and camera, same buildings, ground, trees, objects and their positions, same scale, same warm sepia palette, same paper texture and nib-pen ink style. Do not move, redraw or restyle the scenery.

ADD ONLY the following, drawn exactly in the character style of the SECOND IMAGE (our character sheet: oversized heads, thin spindly limbs, small dot eyes, scratchy dark-brown ink outlines, flat sepia fills, gentle and charming): {job['who']}

SCALE: {scale} Characters stand firmly on the ground of the scene in the same three-quarter top-down perspective as the map, each with a small soft contact shadow. Keep them fully inside the image with some margin. Sepia only, no other colour. No text, no letters, no border."""
    open(os.path.join(d, 'still-prompt.txt'), 'w').write(prompt)
    r = subprocess.run(['codex-imagegen', 'edit', '--prompt', prompt, '--image', os.path.join(d, 'crop.png'), '--image', style,
                        '--out', out, '--size', '1536x1152', '--quality', 'high', '--timeout', '600'], capture_output=True, text=True)
    return f"{job['id']}: {r.returncode} {r.stdout.strip()[-120:]} {r.stderr.strip()[-300:]}"
with ThreadPoolExecutor(5) as ex:
    for line in ex.map(run, [j for j in jobs if not only or j['id'] in only]):
        print(line, flush=True)
