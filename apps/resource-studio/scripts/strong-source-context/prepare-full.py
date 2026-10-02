"""Prepare the next local candidates from pinned witnesses and reviewed coordinates."""
import argparse,hashlib,json,shutil,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',required=True,type=Path);p.add_argument('--previous',required=True,type=Path);a=p.parse_args();r=a.root.resolve();old=a.previous.resolve();full=r/'full'
assert not (full/'input-manifest.json').exists(),'fresh-full-root-required'
subprocess.run(['python3','scripts/strong-candidates/run.py','prepare','--root',str(full)],check=True)
def sha(f):return hashlib.sha256(f.read_bytes()).hexdigest()
text=r/'text-repair';original=full/'environment/data/bibles/bible-s21.json';original.rename(original.with_name('bible-s21-original.json'));shutil.copyfile(text/'bible-s21.json',original)
m=json.loads((full/'input-manifest.json').read_text());m['files']['data/bibles/bible-s21.json']=sha(original);m['files']['data/bibles/bible-s21-original.json']=sha(original.with_name('bible-s21-original.json'));m['concordanceContext']=True
m['textRepair']={'receipt':str(text/'repair.json'),'sha256':sha(text/'repair.json'),'canonical':str(text/'bible-s21-canonical.json'),'canonicalSha256':sha(text/'bible-s21-canonical.json')}
(full/'input-manifest.json').write_text(json.dumps(m,indent=2)+'\n');(full/'correspondence').mkdir()
for ed in ['s21','neg79']:
 f=old/f'correspondence/{ed}.json';manifest=json.loads(f.read_text());changes=[]
 if ed=='s21':
  for block in manifest['blocks']:
   if block['targetRefs']==['Jer.23.18']:
    assert block['canonicalRefs']==['Jer.23.18','Jer.23.19'];changes.append(block)
  assert len(changes)==1
  manifest['blocks']=[new for b in manifest['blocks'] for new in ([{'kind':'identity','targetRefs':[ref],'canonicalRefs':[ref],'reason':'explicit-numbered-verse-split-s21-jeremiah-v1'} for ref in ['Jer.23.18','Jer.23.19']] if b is changes[0] else [b])];manifest.pop('detection',None)
 (full/f'correspondence/{ed}.json').write_text(json.dumps(manifest,indent=2)+'\n')
 (full/f'correspondence/{ed}-provenance.json').write_text(json.dumps({'source':str(f),'sourceSha256':sha(f),'changes':changes,'repair':m['textRepair'] if changes else None},indent=2)+'\n')
print(full)
