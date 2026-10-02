"""Run one immutable baseline or candidate across the seven blind scenarios."""
import argparse,json,subprocess
from pathlib import Path
CASES=[('SG21','target-excluded'),('NEG','target-excluded'),('SG21','family-excluded'),('NEG','family-excluded'),('Sg1910','control-segond'),('Darby','control-darby'),('DarbyR','control-darby')]
p=argparse.ArgumentParser();p.add_argument('variant',choices=['baseline','source','candidate','common']);p.add_argument('--root',required=True,type=Path);a=p.parse_args();r=a.root.resolve()
for edition,scenario in CASES:
 with (r/f'{a.variant}-{edition}-{scenario}.log').open('w') as f:
  subprocess.run(['node','--max-old-space-size=12288','--import','tsx','scripts/strong-source-context/predict.ts',str(r),edition,scenario,a.variant],stdout=f,stderr=subprocess.STDOUT,check=True)
 print(a.variant,edition,scenario,'complete',flush=True)
