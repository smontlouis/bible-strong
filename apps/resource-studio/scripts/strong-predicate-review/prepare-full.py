"""Keep both canonical texts and existing mappings; only add the predicate policy."""
import argparse,hashlib,json,shutil
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);a=p.parse_args();r=a.root.resolve();studio=Path.cwd();old=Path(json.loads((r/'baseline-origin.json').read_text())['experiment'])/'full';full=r/'full';full.mkdir(exist_ok=False)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
m=json.loads((old/'input-manifest.json').read_text())
for file,h in m['files'].items():
 source=old/'environment'/file;assert sha(source)==h;target=full/'environment'/file;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
m['concordancePredicates']=True
(full/'input-manifest.json').write_text(json.dumps(m,indent=2)+'\n');shutil.copytree(old/'correspondence',full/'correspondence')
for name in ['src','scripts','node_modules']:(full/'environment'/name).symlink_to(studio/name,target_is_directory=True)
print('Full inputs copied with unchanged S21/NEG79 texts and mappings.')
