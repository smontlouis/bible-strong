"""Fetch only preselected reserved pages, after the prediction policy is frozen."""
import argparse, hashlib, importlib.util, json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);a=p.parse_args();r=a.root.resolve()
freeze=json.loads((r/'candidate-freeze.json').read_text())
for f,h in freeze['code'].items():assert hashlib.sha256(Path(f).read_bytes()).hexdigest()==h,f
plan=json.loads((r/'plan.json').read_text());assert hashlib.sha256((r/'plan.json').read_bytes()).hexdigest()==freeze['planSha256']
spec=importlib.util.spec_from_file_location('acquire','scripts/strong-concordance-night/acquire.py');acq=importlib.util.module_from_spec(spec);spec.loader.exec_module(acq)
for edition in plan['editions']:
 for chapter in [c for c in plan['chapters'] if c['split']=='test']:
  book,number=chapter['ref'].split('.');url=f'https://concordance.bible/{edition}/{book}/{number}/'
  data=acq.acquire(url,r/'acquisition'/f'{edition}-{book}-{number}.html',1.5)
  parsed=acq.parse_chapter(data.decode());assert '<div class="clearfix">' in data.decode()
  acq.save_json(r/'evaluator-only'/f'{edition}-{chapter["ref"]}.json',{'edition':edition,**chapter,'sourceUrl':url,'htmlSha256':acq.digest(data),**parsed})
  print(edition,chapter['ref'],len(parsed['verses']),flush=True)
