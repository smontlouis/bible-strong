import argparse,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('split',choices=['development','test']);p.add_argument('--root',type=Path,required=True);p.add_argument('--variants');a=p.parse_args();r=a.root.resolve()
cases=[('SG21','target-excluded'),('NEG','target-excluded'),('SG21','family-excluded'),('NEG','family-excluded'),('Sg1910','control-segond'),('Darby','control-darby'),('DarbyR','control-darby')]
for ed,sc in cases:
 for script in ['refine','evaluate']:
  with (r/f'{a.split}-{ed}-{sc}-{script}.log').open('w') as f:
   subprocess.run(['node','--max-old-space-size=8192','--import','tsx',f'scripts/strong-surface-recovery/{script}.ts',str(r),ed,sc,a.split]+([a.variants] if a.variants else []),stdout=f,stderr=subprocess.STDOUT,check=True)
 print(ed,sc,a.split,'complete',flush=True)
