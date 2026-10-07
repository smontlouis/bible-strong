"""Predict reserved masked text with the frozen baseline, then evaluate recoveries."""
import argparse,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);a=p.parse_args();r=a.root.resolve()
cases=[('SG21','target-excluded'),('NEG','target-excluded'),('SG21','family-excluded'),('NEG','family-excluded'),('Sg1910','control-segond'),('Darby','control-darby'),('DarbyR','control-darby')]
for ed,sc in cases:
 with (r/f'test-{ed}-{sc}-baseline.log').open('w') as f:
  subprocess.run(['node','--max-old-space-size=12288','--import','tsx','scripts/strong-witness-recovery/predict.ts',str(r),ed,sc,'baseline','test'],stdout=f,stderr=subprocess.STDOUT,check=True)
 print('Frozen baseline',ed,sc,'complete',flush=True)
subprocess.run(['python3','scripts/strong-witness-recovery/run.py','test','--root',str(r)],check=True)
