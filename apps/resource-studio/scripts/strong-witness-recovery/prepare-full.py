"""Prepare two new candidates while preserving the previous immutable delivery."""
import argparse,hashlib,json,shutil
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);a=p.parse_args();r=a.root.resolve();studio=Path.cwd()
old=Path(json.loads((r/'baseline-origin.json').read_text())['experiment'])/'full';full=r/'full';full.mkdir(exist_ok=False)
manifest=json.loads((old/'input-manifest.json').read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
for relative,h in manifest['files'].items():
 source=old/'environment'/relative;assert sha(source)==h
 target=full/'environment'/relative;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
target=full/'environment/data/bibles/bible-neg79.json';target.rename(target.with_name('bible-neg79-original.json'))
shutil.copyfile(r/'text-repair/bible-neg79.json',target)
manifest['files']['data/bibles/bible-neg79.json']=sha(target)
manifest['files']['data/bibles/bible-neg79-original.json']=sha(target.with_name('bible-neg79-original.json'))
manifest['concordanceRecovery']=True
manifest['joinedTextRepair']={'receipt':str(r/'text-repair/repair.json'),'sha256':sha(r/'text-repair/repair.json'),'canonical':str(r/'text-repair/bible-neg79-canonical.json'),'canonicalSha256':sha(r/'text-repair/bible-neg79-canonical.json')}
(full/'input-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
shutil.copytree(old/'correspondence',full/'correspondence')
for folder in ['src','scripts','node_modules']:(full/'environment'/folder).symlink_to(studio/folder,target_is_directory=True)
print('Two candidate environments prepared; previous text and annotations preserved.')
