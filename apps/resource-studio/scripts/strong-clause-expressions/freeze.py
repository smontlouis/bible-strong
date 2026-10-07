"""Freeze selection, code, resources and reserve before any reserved page acquisition."""
import argparse,datetime,gzip,hashlib,json,shutil
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);a=p.parse_args();r=a.root.resolve()
assert not (r/'candidate-freeze.json').exists()
assert not (r/'acquisition').exists(), 'reserve already acquired'
def sha(b):return hashlib.sha256(b).hexdigest()
def raw(p):return p.read_bytes() if p.exists() else gzip.decompress(Path(str(p)+'.gz').read_bytes())
results={}
for case in sorted((r/'evaluation/baseline').iterdir()):
 b=json.loads((case/'development.json').read_text());c=json.loads((r/f'evaluation/common-heads/{case.name}/development.json').read_text())
 bm=b['summary']['metrics']['exact'];cm=c['summary']['metrics']['exact']
 assert cm['precision']>=bm['precision'] and cm['recall']>=bm['recall'],case.name
 assert all(x['after']['tp']>=x['before']['tp'] for x in c['changed'])
 receipt=json.loads((r/f'predictions/common-heads/{case.name}/development-receipt.json').read_text())
 for file,h in receipt['codeHashes'].items():assert sha(Path(file).read_bytes())==h, f'development-code-drift:{file}'
 results[case.name]={'verses':b['summary']['verses'],'baseline':bm,'candidate':cm}
assert len(results)==7
selection={'selected':'common-heads','results':results,'reason':'Two witness families agree on one short expression, anchored in the same native verse with independently supported lexical content. Preserve prior placements, relations, empties and source identities; retain ambiguity. Same rule for all editions; display lexical head separately from full relation. One-family and shared-carrier variants remain research ablations.','promotionCriterion':'Independent exact precision and recall must not decline in either target or controls; positive independent gains and native-generator parity required. All new disagreements reviewed; no retuning on this reserve.','modelCalls':0}
(r/'development-selection.json').write_text(json.dumps(selection,indent=2)+'\n')
ui={'jsonlBibleViewer.ts','viewerServer.ts','strongCandidateReview.ts','strongCandidateReviewTypes.ts'}
files=[*[p for p in Path('src').rglob('*.ts') if p.name not in ui],*Path('scripts/strong-clause-expressions').glob('*.ts'),*Path('scripts/strong-clause-expressions').glob('*.py'),Path('scripts/strong-surface-recovery/io.ts'),Path('scripts/strong-concordance-night/score.ts'),Path('scripts/strong-concordance-night/contract.ts'),Path('scripts/strong-concordance-night/acquire.py'),Path('scripts/strong-witness-recovery/prepare.ts'),Path('scripts/strong-witness-recovery/acquire.py')]
for folder in ['src','scripts']:shutil.copytree(folder,r/'candidate-code'/folder,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
(r/'candidate-code/node_modules').symlink_to(Path('node_modules').resolve(),target_is_directory=True)
freeze={'frozenAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'code':{str(p):sha(p.read_bytes()) for p in files},'planSha256':sha((r/'plan.json').read_bytes()),'selectionSha256':sha((r/'development-selection.json').read_bytes()),'resources':{n:sha(raw(r/n)) for n in ['french-inflections.json','french-semantic-links.json','independent-meaning-bridge.json']},'testTargetAnnotationsConsulted':False,'selected':'common-heads','evaluationVariants':['literal-2','morph-2','reviewed-2','reciprocal-2','meaning-2','meaning-1','joint-2','joint-1','common-heads','joint-heads'],'modelCalls':0}
(r/'candidate-freeze.json').write_text(json.dumps(freeze,indent=2)+'\n')
print('Common clause policy frozen before reserve acquisition.')
