"""Valence 1876 dialogue busts: one master per character, then one edit per mood."""
import json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
here = os.path.dirname(os.path.abspath(__file__))
STYLE = os.path.join(here, '..', 'characters', 'style-sheet-v1.png')
CAST = {
    'bourdeau': 'a 41-year-old Protestant preacher with a short dark beard and moustache, wearing a long dark frock coat, a waistcoat and a dark cravat (no white preaching bands), holding a closed Bible against his chest with one hand',
    'marion': 'a 35-year-old woman in a long dark dress with a patterned shawl, hair in a bun, holding her one-year-old little boy on her hip; the child looks calm and stays the same',
    'employee': 'a young railway employee of the PLM company in a peaked cap and a short buttoned uniform jacket, holding a parcel wrapped in brown paper and string',
    'pastor': 'a village Protestant pastor in a black gown with two small white preaching bands at the neck, short dark hair, holding a large closed Bible against his chest',
    'elise': 'a 16-year-old girl with long braided hair, a simple dress and an apron, holding an open book in both hands',
    'jeanne': 'a 42-year-old mother wearing a bonnet tied under the chin and a shawl, holding a small notebook and a pencil',
    'jacques': 'a very old man of 84, thin, slightly bent, with white hair and white side whiskers, wearing an old-fashioned long coat, both hands resting on the knob of a walking cane',
    'crier': 'a 12-year-old newspaper boy in a flat cap and a short jacket, holding a folded newspaper in one hand and a small stack of newspapers under the other arm',
    'peddler': 'a Bible peddler with a wide-brimmed hat and a short beard, a heavy leather bag strap across his chest, holding a small book in one hand',
}
MOODS = {
    'happy': 'happy and warm: a broad open smile, cheeks raised, eyes slightly narrowed with joy, eyebrows lifted a little',
    'thinking': 'thoughtful and questioning: one eyebrow raised higher than the other, eyes glancing up and to the side, lips pressed together in a small pensive line',
    'surprised': 'surprised: eyebrows raised high, eyes wide open, a small round open mouth',
    'grave': 'grave and solemn, a little sad: inner eyebrows lifted and drawn together, eyes softly lowered, mouth a small downturned line',
}
BACKGROUND = 'Background: a perfectly flat, uniform, solid pure magenta (#FF00FF) filling the whole canvas around the character, with no gradient, no shadow, no ground, no frame, no text. Never use magenta in the character.'

def run(args, out):
    if os.path.exists(out):
        return f'{os.path.basename(out)} exists'
    r = subprocess.run(['codex-imagegen', 'edit', *args, '--out', out, '--size', '1024x1536', '--quality', 'high', '--timeout', '600'], capture_output=True, text=True)
    return f"{os.path.relpath(out, here)}: {r.returncode} {r.stderr.strip()[-160:]}"

def master(cid):
    os.makedirs(os.path.join(here, cid), exist_ok=True)
    prompt = f"""Draw a large dialogue portrait for a story-driven video game, of the SAME character as in the FIRST image ({CAST[cid]}). Keep exactly the same person: face shape, hair, beard, age, clothes and their patterns, props and proportions, and exactly the same hand-drawn storybook style as the reference images: oversized head, small dot eyes, scratchy dark-brown nib-pen ink outlines, flat warm sepia fills, light crosshatching, gentle charm. Framing: from the waist up, three-quarter view, body and face turned toward the RIGHT side of the image, centered horizontally, the top of the head 4% below the top edge, the character filling the full height down to the bottom edge. Expression: calm and friendly, a slight closed-mouth smile. Sepia only, no other colour. {BACKGROUND}"""
    open(os.path.join(here, cid, 'neutral-prompt.txt'), 'w').write(prompt)
    return run(['--prompt', prompt, '--image', os.path.join(here, 'refs', f'{cid}.png'), '--image', STYLE], os.path.join(here, cid, 'neutral.png'))

def mood(cid, key):
    base = os.path.join(here, cid, 'neutral.png')
    if not os.path.exists(base):
        return f'{cid}/{key}: no master'
    prompt = f"""EDIT THE IMAGE. Change ONLY the facial expression to: {MOODS[key]}. Everything else must stay exactly identical: same character, same pose, same head position and size, same framing, same clothes, same hands and props, same line style and sepia colours, same transparent background with nothing behind the character. Do not move, redraw or recolour anything except the face. No text."""
    open(os.path.join(here, cid, f'{key}-prompt.txt'), 'w').write(prompt)
    return run(['--prompt', prompt, '--image', base], os.path.join(here, cid, f'{key}.png'))

if __name__ == '__main__':
    stage = sys.argv[1]
    only = sys.argv[2:] or list(CAST)
    jobs = [(master, (c,)) for c in only] if stage == 'master' else [(mood, (c, k)) for c in only for k in MOODS]
    with ThreadPoolExecutor(8) as ex:
        for line in ex.map(lambda j: j[0](*j[1]), jobs):
            print(line, flush=True)
