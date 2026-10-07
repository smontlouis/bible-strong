"""Keep only explicit French inflection relations; no glosses, Strong or target data."""
import argparse,collections,hashlib,json,re,unicodedata
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);a=p.parse_args();r=a.root.resolve()
source=Path('data/external/french-lexical/kaikki/kaikki.org-dictionary-French.jsonl').resolve()
forms=collections.defaultdict(lambda:collections.defaultdict(set));h=hashlib.sha256();lines=0
def word(x):
 if not isinstance(x,str):return None
 x=unicodedata.normalize('NFC',x).lower()
 return x if len(x)>=3 and x.isalpha() else None
with source.open('rb') as f:
 for raw in f:
  h.update(raw);lines+=1;e=json.loads(raw);pos=e.get('pos');head=word(e.get('word'))
  if e.get('lang_code')!='fr' or pos not in ['noun','verb','adj'] or not head:continue
  senses=e.get('senses',[])
  roots={v for sense in senses for t in sense.get('form_of',[]) if (v:=word(t.get('word')))}
  if not roots or any(not sense.get('form_of') for sense in senses):roots.add(head)
  forms[head][pos].update(roots)
  for form in e.get('forms',[]):
   value=word(form.get('form'))
   if value:forms[value][pos].update(roots)
result={f:{pos:sorted(lemmas) for pos,lemmas in kinds.items()} for f,kinds in sorted(forms.items())}
target=r/'french-inflections.json';target.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
receipt={'source':str(source),'sourceSha256':h.hexdigest(),'inputLines':lines,'forms':len(result),'outputSha256':hashlib.sha256(target.read_bytes()).hexdigest(),'fieldsUsed':['lang_code','word','pos','forms.form','senses.form_of.word'],'noGlosses':True,'targetAnnotationsRead':False,'sourceDescription':'Existing local Kaikki French dictionary export; explicit inflection relations only, accents preserved; multiple lemmas remain ambiguous.'}
(r/'french-inflections-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
