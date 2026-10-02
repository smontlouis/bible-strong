"""Restore the protocol without exposing reserved annotation bodies to the predictor."""
import argparse,hashlib,json,shutil,subprocess,tarfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',required=True,type=Path);p.add_argument('--cache',required=True,type=Path);a=p.parse_args();r=a.root.resolve();r.mkdir(parents=True,exist_ok=True)
assert not (r/'plan.json').exists(),'fresh-root-required';shutil.copyfile('scripts/strong-source-context/plan.json',r/'plan.json')
commit=json.loads((r/'plan.json').read_text())['baseCommit']
with (r/'initial-code.tar').open('wb')as f:subprocess.run(['git','archive',commit,'apps/resource-studio','packages/resource-domain','package.json','yarn.lock'],cwd='../..',stdout=f,check=True)
with tarfile.open(r/'initial-code.tar')as f:f.extractall(r/'initial-code',filter='data')
shutil.copytree(a.cache,r/'acquisition')
subprocess.run(['python3','scripts/strong-concordance-night/acquire.py','--root',str(r)],check=True)
subprocess.run(['node','--import','tsx','scripts/strong-concordance-night/prepare.ts',str(r)],check=True)
for name in ['src','scripts']:shutil.copytree(name,r/'source-code'/name,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
(r/'source-code/manifest.json').write_text(json.dumps({str(f.relative_to(r/'source-code')):hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted((r/'source-code').rglob('*')) if f.is_file()},indent=2)+'\n')
print('Prepared source-only ablation (context flag off), old baseline, and separate masked/evaluator files.')
