import argparse,hashlib,json,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',required=True,type=Path);a=p.parse_args();r=a.root.resolve()
def sha(f):return hashlib.sha256(Path(f).read_bytes()).hexdigest()
frozen=json.loads((r/'candidate-freeze.json').read_text())
for f,h in frozen['code'].items():assert sha(f)==h,f
assert sha(r/'plan.json')==frozen['planSha256'];assert sha(r/'prepared-inputs.json')==frozen['preparedInputsSha256']
for f,h in json.loads((r/'prepared-inputs.json').read_text())['files'].items():assert sha(r/f)==h,f
for f,h in json.loads((r/'source-code/manifest.json').read_text()).items():assert sha(r/'source-code'/f)==h,f
case=r/'predictions/candidate/SG21-target-excluded';before={s:sha(case/f'{s}.json') for s in ['development','test']};hidden=[]
try:
 for name in ['evaluator-only','acquisition','evaluation','development-v1','development-v2','reserved-results.json','reserved-disagreement-review.json']:
  original=r/name
  if original.exists():target=r/(name+'.hidden-for-replay');original.rename(target);hidden.append((original,target))
 with (r/'blind-replay.log').open('w') as f:subprocess.run(['node','--max-old-space-size=12288','--import','tsx','scripts/strong-source-context/predict.ts',str(r),'SG21','target-excluded','candidate'],stdout=f,stderr=subprocess.STDOUT,check=True)
finally:
 for original,target in reversed(hidden):target.rename(original)
assert all(sha(case/f'{s}.json')==h for s,h in before.items()),'prediction-drift-without-label-stores'
(r/'blind-replay-verification.json').write_text(json.dumps({'frozenFilesVerified':True,'allPreparedInputsVerified':True,'sourceAblationSnapshotVerified':True,'samePredictionsWithoutTargetAnnotationStores':True,'hashes':before,'modelCalls':0},indent=2)+'\n')
print('Verified frozen bytes and identical predictions with target annotation stores hidden.')
