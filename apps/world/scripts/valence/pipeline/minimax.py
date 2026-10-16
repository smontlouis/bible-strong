import json, subprocess, sys, os
from concurrent.futures import ThreadPoolExecutor
here = os.path.dirname(os.path.abspath(__file__))
jobs = json.load(open(os.path.join(here, 'config.json')))
only = sys.argv[1:]
def run(job):
    d = os.path.join(here, job['id'])
    still = os.path.join(d, 'still.png')
    if not os.path.exists(still): return f"{job['id']}: no still"
    if os.path.exists(os.path.join(d, 'video', 'output-0.mp4')): return f"{job['id']}: video exists"
    prompt = ("Fixed camera: completely static framing, no zoom, no pan, no camera movement at all. "
              "The buildings, ground, trees and objects stay perfectly still. Only the people move: " + job['motion'] +
              " The clip starts and ends on exactly the same pose so it loops seamlessly. Keep the hand-drawn sepia storybook illustration style, flat colours and ink lines; no new objects, no new people, no text.")
    inp = {"prompt": prompt, "duration": 10, "resolution": "768P", "prompt_expansion_mode": "disabled",
           "image_url": "file:" + still, "end_image_url": "file:" + still}
    p = os.path.join(d, 'video-input.json')
    json.dump(inp, open(p, 'w'), indent=2)
    r = subprocess.run(['node', os.path.join(here, '..', 'fal-run.mjs'), 'minimax/h3/image-to-video', p, os.path.join(d, 'video'), 'run'],
                       capture_output=True, text=True)
    return f"{job['id']}: {r.returncode} {r.stdout.strip()[-200:]} {r.stderr.strip()[-400:]}"
with ThreadPoolExecutor(10) as ex:
    for line in ex.map(run, [j for j in jobs if not only or j['id'] in only]):
        print(line, flush=True)
