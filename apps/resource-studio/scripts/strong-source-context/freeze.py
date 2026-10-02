import argparse,hashlib,json,shutil,datetime
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',required=True,type=Path);a=p.parse_args();r=a.root.resolve()
assert not (r/'candidate-freeze.json').exists(),'reserve-already-frozen'
selection=json.loads((r/'development-selection.json').read_text());assert len(selection['results'])==7 and all(not x['losses'] for x in selection['results'].values())
files=sorted([*Path('src').rglob('*'),*Path('scripts/strong-source-context').glob('*'),*Path('scripts/strong-candidates').glob('*'),Path('scripts/strong-concordance-night/score.ts'),Path('scripts/strong-concordance-night/contract.ts')]);files=[f for f in files if f.is_file() and f.suffix in ['.ts','.json','.py','.js']]
def sha(f):return hashlib.sha256(Path(f).read_bytes()).hexdigest()
for name in ['src','scripts']:shutil.copytree(name,r/'candidate-code'/name,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
frozen={'frozenAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'baselineCommit':'34e3949ec7f5273b5cdba1ecd90d877847dc4400','code':{str(f):sha(f) for f in files},'sourceCodeManifestSha256':sha(r/'source-code/manifest.json'),'planSha256':sha(r/'plan.json'),'preparedInputsSha256':sha(r/'prepared-inputs.json'),'selectionSha256':sha(r/'development-selection.json'),'selected':'all','testTargetAnnotationsConsulted':False,'identityEligibility':'fixed from baseline, matched by physical source file/line','publication':False,'modelCalls':0}
(r/'candidate-freeze.json').write_text(json.dumps(frozen,indent=2)+'\n');print('Frozen candidate policy before reserved evaluation.')
