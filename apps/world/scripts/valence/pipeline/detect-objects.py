import json, os, subprocess, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
import cv2
here = os.path.dirname(os.path.abspath(__file__))
base = os.path.join(here, '..')
x2 = cv2.imread(os.path.join(base, 'map', 'x2.png'))
H, W = x2.shape[:2]
import sys as _sys
FINE = '--fine' in _sys.argv
crops = []
if FINE:
    for row, y in enumerate([0, 560, 1122]):
        for col, x in enumerate([0, 780, 1560, 2344]):
            crops.append((f'f{row}{col}', x, y, 1000, 760))
    prompts = ['tree', 'cypress tree', 'lamp post']
else:
    for row, y in enumerate([0, 874]):
        for col, x in enumerate([0, 1000, 2000]):
            crops.append((f'c{row}{col}', x, y, 1344, 1008))
    prompts = ['tree', 'building', 'street lamp', 'market stall', 'statue', 'bandstand', 'stone wall', 'steam locomotive', 'wooden crate', 'cannon', 'bench', 'staircase']
os.makedirs(os.path.join(here, 'crops'), exist_ok=True)
for cid, x, y, w, h in crops:
    p = os.path.join(here, 'crops', f'{cid}.png')
    if not os.path.exists(p): cv2.imwrite(p, x2[y:y+h, x:x+w])
jobs = [(c, q) for c in crops for q in prompts]
only = [a for a in sys.argv[1:] if not a.startswith('--')]
def run(job):
    (cid, x, y, w, h), prompt = job
    slug = prompt.replace(' ', '-')
    out = os.path.join(here, 'runs', f'{cid}-{slug}')
    if os.path.exists(os.path.join(out, 'masks.json')): return f'{cid} {prompt}: cached'
    os.makedirs(out, exist_ok=True)
    inp = {"image_url": "file:" + os.path.join(here, 'crops', f'{cid}.png'), "prompt": prompt, "apply_mask": False,
           "return_multiple_masks": True, "max_masks": 32, "include_scores": True, "include_boxes": True, "output_format": "png"}
    ip = os.path.join(out, 'input.json'); json.dump(inp, open(ip, 'w'))
    r = subprocess.run(['node', os.path.join(base, 'fal-run.mjs'), 'fal-ai/sam-3/image', ip, out, 'submit'], capture_output=True, text=True)
    r = subprocess.run(['node', os.path.join(base, 'fal-run.mjs'), 'fal-ai/sam-3/image', ip, out, 'run'], capture_output=True, text=True)
    try:
        data = json.load(open(os.path.join(out, 'result.json')))['data']
    except Exception as e:
        return f'{cid} {prompt}: FAILED {r.stderr[-300:]}'
    masks = data.get('masks') or []
    scores = data.get('scores') or []
    boxes = data.get('boxes') or []
    entries = []
    for i, m in enumerate(masks):
        path = os.path.join(out, f'mask-{i}.png')
        urllib.request.urlretrieve(m['url'], path)
        entries.append({'file': path, 'score': scores[i] if i < len(scores) else None, 'box': boxes[i] if i < len(boxes) else None})
    for f in os.listdir(out):
        if f.startswith('output-'): os.remove(os.path.join(out, f))
    json.dump({'crop': [x, y, w, h], 'prompt': prompt, 'masks': entries}, open(os.path.join(out, 'masks.json'), 'w'), indent=1)
    return f'{cid} {prompt}: {len(entries)} masks'
with ThreadPoolExecutor(12) as ex:
    for line in ex.map(run, jobs):
        print(line, flush=True)
