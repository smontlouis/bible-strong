"""Separate prediction/evaluation processes; compress unused ablation snapshots."""
import argparse,gzip,subprocess
from pathlib import Path
CASES=[('SG21','target-excluded'),('NEG','target-excluded'),('SG21','family-excluded'),('NEG','family-excluded'),('Sg1910','control-segond'),('Darby','control-darby'),('DarbyR','control-darby')]
p=argparse.ArgumentParser();p.add_argument('split',choices=['development','test']);p.add_argument('--root',type=Path,required=True);a=p.parse_args();r=a.root.resolve()
for ed,sc in CASES:
 with (r/f'{a.split}-{ed}-{sc}-refine.log').open('w') as f:subprocess.run(['node','--max-old-space-size=12288','--import','tsx','scripts/strong-predicate-review/refine.ts',str(r),ed,sc,a.split],stdout=f,stderr=subprocess.STDOUT,check=True)
 for variant in ['baseline','guard','expressions','all','common']:
  with (r/f'{a.split}-{ed}-{sc}-{variant}-evaluation.log').open('w') as f:subprocess.run(['node','--max-old-space-size=12288','--import','tsx','scripts/strong-source-context/evaluate.ts',str(r),ed,sc,a.split,variant],stdout=f,stderr=subprocess.STDOUT,check=True)
  if variant not in ['baseline','all']:
   source=r/f'predictions/{variant}/{ed}-{sc}/{a.split}.json'
   with gzip.open(str(source)+'.gz','wb',compresslevel=3) as f:f.write(source.read_bytes())
   source.unlink() # This command's scratch prediction, retained losslessly as gzip.
 print(ed,sc,a.split,'complete',flush=True)
