"""Render frozen measurements and regression accounting; does not change predictions."""
import argparse
from collections import Counter
import csv
import hashlib
import json
from pathlib import Path

def read(p):return json.loads(Path(p).read_text())
def write(p,v):Path(p).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
def key(ref,p,identity=False):
    support=('empty',p.get('insertAfterWordIndex')) if p['kind']=='empty' else tuple(p.get('targetWordIndices',range(p['startWordIndex'],p['endWordIndex']+1)))
    return (ref,p['strong'],p.get('originalOccurrenceId') if identity else '',support)
def correct(root,name):
    scored=read(root/'evaluation-followup'/name/'verses.json');eligible={v['ref'] for v in scored}
    c=Counter(key(v['ref'],p) for v in read(root/'followup'/name/'predictions.json') if v['ref'] in eligible for p in v['placements'])
    for row in scored:
        for p in row['unmatchedPredicted']:c[key(row['ref'],p)]-=1
    assert all(n>=0 for n in c.values())
    paired=Counter(key(v['ref'],p,True) for v in scored for p in v['conjoinCorrectCarriers'])
    return +c,paired
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--root',type=Path,default=Path('outputs/strong-concordance-reading-groups'));root=p.parse_args().root
    frozen=read(root/'followup-freeze.json');summaries=[read(p) for p in sorted((root/'evaluation-followup').glob('*/summary.json'))]
    flat=[];by_case={};regressions=[]
    for s in summaries:
        identity=(s['edition'],s['scenario'],s['split']);by_case.setdefault(identity,[]).append(s)
        strata=[('total','all',s['total'])]+[(g,k,v) for g in ['byTestament','byGenre','byDifficulty'] for k,v in s[g].items()]
        for group,label,t in strata:
            for metric,m in t['metrics'].items():flat.append({'edition':s['edition'],'scenario':s['scenario'],'split':s['split'],'variant':s['variant'],'stratum':group,'label':label,'metric':metric,'verses':t['verses'],**m,'sourceUnits':t['units'],'unresolved':t['unresolved'],'uncertaintyRate':t['uncertaintyRate'],'fullyAccountedVerses':t['fullyAccountedVerses'],'identityComparableVerses':t['identityComparableVerses'],'cardinalityError':t['cardinalityError']})
    for case,variants in by_case.items():
        for metric in ['identityExact','conjoinIdentityExact']:
            assert len({s['total']['metrics'][metric]['expected'] for s in variants})==1,(case,metric,'candidate-dependent-denominator')
        prefix='-'.join(case);before,pair_before=correct(root,prefix+'-legacy')
        for s in variants:
            if s['variant']=='legacy':continue
            after,pair_after=correct(root,prefix+'-'+s['variant'])
            entry={'edition':case[0],'scenario':case[1],'split':case[2],'variant':s['variant']}
            for label,a,b in [('carrier',before,after),('conjoinIdentity',pair_before,pair_after)]:
                lost=a-b;gained=b-a
                entry[label]={'gained':sum(gained.values()),'lost':sum(lost.values()),'lostCases':[{'ref':k[0],'strong':k[1],'owner':k[2],'support':k[3],'count':n} for k,n in sorted(lost.items(),key=str)],'gainedCases':[{'ref':k[0],'strong':k[1],'owner':k[2],'support':k[3],'count':n} for k,n in sorted(gained.items(),key=str)]}
            regressions.append(entry)
    with (root/'all-metrics.tsv').open('w') as f:
        w=csv.DictWriter(f,fieldnames=flat[0].keys(),delimiter='\t');w.writeheader();w.writerows(flat)
    write(root/'regressions.json',regressions)
    lines=['# Mesures du suivi Strong','',f'Politique sélectionnée avant réserve : `{frozen["selectedPolicy"]}`. Accord éditorial, sans certification sémantique indépendante.','',
        '| Édition | Scénario | Ensemble | Variante | Versets | Précision | Rappel | F1 exact | F1 chevauchant | Incertitude | Complets | Identités conjoin exactes / attendues |',
        '|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|']
    for s in summaries:
        t=s['total'];m=t['metrics']['exact'];i=t['metrics']['conjoinIdentityExact']
        lines.append(f'| {s["edition"]} | {s["scenario"]} | {s["split"]} | {s["variant"]} | {t["verses"]} | {m["precision"]:.4f} | {m["recall"]:.4f} | {m["f1"]:.4f} | {t["metrics"]["overlap"]["f1"]:.4f} | {t["uncertaintyRate"]:.4f} | {t["fullyAccountedVerses"]} | {i["tp"]} / {i["expected"]} |')
    (root/'resultats.md').write_text('\n'.join(lines)+'\n')
    # Deterministic, balanced audit sample, plus every newly lost exact carrier.
    sample=[]
    for case,variants in by_case.items():
        name='-'.join(case)+'-'+frozen['selectedPolicy'];rows=read(root/'evaluation-followup'/name/'verses.json');pred={v['ref']:v for v in read(root/'followup'/name/'predictions.json')}
        by_testament={}
        for row in rows:
            v=pred[row['ref']]
            for expected in row['unmatchedExpected']:
                entry={'id':name+':'+row['ref']+':'+expected['id'],'edition':case[0],'scenario':case[1],'split':case[2],'ref':row['ref'],'text':v['text'],'words':v['words'],'expected':expected,'proposed':[x for x in row['unmatchedPredicted'] if x['strong']==expected['strong']],'units':[u for u in v['units'] if expected['strong'] in u['strong']]}
                testament='OT' if expected['strong'].startswith('H') else 'NT'
                by_testament.setdefault(testament,[]).append(entry)
        if case[0] in ['SG21','NEG']:
            for entries in by_testament.values():sample.extend(sorted(entries,key=lambda x:hashlib.sha256(x['id'].encode()).hexdigest())[:2])
    write(root/'audit-sample.json',sample)
    write(root/'report-manifest.json',{'summaries':len(summaries),'metricRows':len(flat),'regressionComparisons':len(regressions),'auditSampleSize':len(sample),'identityDenominatorsInvariant':True})
    print(json.dumps({'summaries':len(summaries),'metricRows':len(flat),'auditSample':len(sample)}))

if __name__=='__main__':main()
