"""Losslessly compress only this experiment's rejected full-output scratch files."""
import argparse,gzip,hashlib,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);a=p.parse_args();r=a.root.resolve();assert (r/'retired.json').exists()
records=[]
for file in sorted((r/'full/generated').glob('*/*')):
 if file.suffix not in ['.sqlite','.tsv']:continue
 target=file.with_name(file.name+'.gz');temporary=target.with_name(target.name+'.tmp');digest=hashlib.sha256();size=0
 with file.open('rb') as source,gzip.open(temporary,'wb',compresslevel=1) as output:
  for chunk in iter(lambda:source.read(1024*1024),b''):digest.update(chunk);size+=len(chunk);output.write(chunk)
 check=hashlib.sha256()
 with gzip.open(temporary,'rb') as source:
  for chunk in iter(lambda:source.read(1024*1024),b''):check.update(chunk)
 assert digest.digest()==check.digest(),'compression-roundtrip-mismatch'
 temporary.replace(target);records.append({'original':str(file.relative_to(r)),'gzip':str(target.relative_to(r)),'sha256':digest.hexdigest(),'bytes':size});file.unlink()
 print('Archived rejected scratch:',file.name,flush=True)
(r/'archived-rejected-artifacts.json').write_text(json.dumps({'records':records,'restore':'gzip -dk <file>.gz','lossless':True},indent=2)+'\n')
