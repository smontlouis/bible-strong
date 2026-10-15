import json, subprocess, sys, os
from concurrent.futures import ThreadPoolExecutor
here = os.path.dirname(os.path.abspath(__file__))
jobs = json.load(open(os.path.join(here, 'config.json')))
only = sys.argv[1:]
def run(job):
    d = os.path.join(here, job['id'])
    video = os.path.join(d, 'video', 'output-0.mp4')
    if not os.path.exists(video): return f"{job['id']}: no video yet"
    inp12 = os.path.join(d, 'input-12fps.mp4')
    if not os.path.exists(inp12):
        subprocess.run(['ffmpeg','-v','error','-y','-i',video,'-an','-vf','fps=12','-c:v','libx264','-crf','14','-pix_fmt','yuv420p',inp12],check=True)
    if os.path.exists(os.path.join(d, 'mask', 'output-0.mp4')): return f"{job['id']}: mask exists"
    inp = {"video_url": "file:" + inp12, "prompt": job['maskPrompt'], "apply_mask": False, "video_output_type": "X264 (.mp4)", "detection_threshold": job.get("maskThreshold", 0.4)}
    p = os.path.join(d, 'mask-input.json'); json.dump(inp, open(p, 'w'), indent=2)
    r = subprocess.run(['node', os.path.join(here, '..', 'fal-run.mjs'), 'fal-ai/sam-3/video', p, os.path.join(d, 'mask'), 'run'], capture_output=True, text=True)
    return f"{job['id']}: {r.returncode} {r.stdout.strip()[-160:]} {r.stderr.strip()[-400:]}"
with ThreadPoolExecutor(10) as ex:
    for line in ex.map(run, [j for j in jobs if not only or j['id'] in only]):
        print(line, flush=True)
