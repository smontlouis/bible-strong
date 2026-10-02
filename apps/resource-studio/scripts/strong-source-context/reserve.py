import argparse,subprocess,json,hashlib
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',required=True,type=Path);a=p.parse_args();r=a.root.resolve();freeze=json.loads((r/'candidate-freeze.json').read_text())
for f,h in freeze['code'].items():assert hashlib.sha256(Path(f).read_bytes()).hexdigest()==h,f
cases=[('SG21','target-excluded'),('NEG','target-excluded'),('SG21','family-excluded'),('NEG','family-excluded'),('Sg1910','control-segond'),('Darby','control-darby'),('DarbyR','control-darby')]
for ed,sc in cases:
 for variant in ['baseline','source','light','local','groups','all','common']:
  for script in (['refine','evaluate'] if variant not in ['baseline','source'] else ['evaluate']):
   with (r/f'test-{ed}-{sc}-{variant}-{script}.log').open('w') as f:subprocess.run(['node','--max-old-space-size=12288','--import','tsx',f'scripts/strong-source-context/{script}.ts',str(r),ed,sc,'test',variant],stdout=f,stderr=subprocess.STDOUT,check=True)
 print(ed,sc,'reserved evaluation complete',flush=True)
