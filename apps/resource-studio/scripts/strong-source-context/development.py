import subprocess,argparse
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',required=True,type=Path);a=p.parse_args();r=a.root.resolve()
cases=[('SG21','target-excluded'),('NEG','target-excluded'),('SG21','family-excluded'),('NEG','family-excluded'),('Sg1910','control-segond'),('Darby','control-darby'),('DarbyR','control-darby')]
for ed,sc in cases:
 for variant in ['baseline','source','light','local','groups','all','common']:
  for script in (['refine','evaluate'] if variant not in ['baseline','source'] else ['evaluate']):
   with (r/f'development-{ed}-{sc}-{variant}-{script}.log').open('w') as f:subprocess.run(['node','--max-old-space-size=12288','--import','tsx',f'scripts/strong-source-context/{script}.ts',str(r),ed,sc,'development',variant],stdout=f,stderr=subprocess.STDOUT,check=True)
 print(ed,sc,'development complete',flush=True)
