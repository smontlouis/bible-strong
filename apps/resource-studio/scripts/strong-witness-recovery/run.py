"""Evaluate the isolated recovery policy without feeding labels to predictors."""
import argparse, json, subprocess
from pathlib import Path
CASES=[('SG21','target-excluded'),('NEG','target-excluded'),('SG21','family-excluded'),('NEG','family-excluded'),('Sg1910','control-segond'),('Darby','control-darby'),('DarbyR','control-darby')]
p=argparse.ArgumentParser();p.add_argument('split',choices=['development','test']);p.add_argument('--root',type=Path,required=True);a=p.parse_args();r=a.root.resolve()
for ed,sc in CASES:
 with (r/f'{a.split}-{ed}-{sc}-recovery.log').open('w') as f:
  subprocess.run(['node','--max-old-space-size=12288','--import','tsx','scripts/strong-witness-recovery/refine.ts',str(r),ed,sc,a.split],stdout=f,stderr=subprocess.STDOUT,check=True)
 for variant in ['baseline','lexicon','neighbors','compounds','all']:
  with (r/f'{a.split}-{ed}-{sc}-{variant}-evaluation.log').open('w') as f:
   subprocess.run(['node','--max-old-space-size=12288','--import','tsx','scripts/strong-source-context/evaluate.ts',str(r),ed,sc,a.split,variant],stdout=f,stderr=subprocess.STDOUT,check=True)
 print(ed,sc,a.split,'complete',flush=True)
