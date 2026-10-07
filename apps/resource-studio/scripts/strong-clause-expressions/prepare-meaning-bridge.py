"""Independent lexical meanings: STEP English senses and French dictionary senses.

No target Bible annotations, target editorial lemmas, verse links or models.
"""
import argparse,gzip,hashlib,html,json,re,unicodedata
from pathlib import Path

p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);a=p.parse_args();root=a.root.resolve()
step_sources=[Path('data/external/stepbible')/name for name in ['TBESH.txt','TBESG.txt']]
french_source=Path('data/external/french-lexical/kaikki/kaikki.org-dictionary-French.jsonl')
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for block in iter(lambda:f.read(1048576),b''):h.update(block)
 return h.hexdigest()
def plain(value):
 value=re.sub(r'<ref\b[^>]*>.*?</ref>',' ',value,flags=re.I|re.S)
 return ' '.join(html.unescape(re.sub(r'<[^>]*>',' ',value)).split())
def norm(value):return ' '.join(unicodedata.normalize('NFC',value).lower().replace('’',"'").split())
step={};rows=0
for source in step_sources:
 with source.open() as f:
  for line_number,line in enumerate(f,1):
   cols=line.rstrip('\n').split('\t')
   if len(cols)<8 or not re.fullmatch(r'[GH]\d{4}',cols[0]):continue
   identity=cols[1].split()[0]
   if not re.fullmatch(r'[GH]\d{4}[A-Za-z]*',identity):continue
   # Keep semantic suffix case. The broad classical code is not enough to
   # choose between homographs or sense-specific variants.
   step.setdefault(identity,[]).append({'identity':identity,'classicalStrong':cols[0],'rootIdentity':cols[2],'partOfSpeech':cols[5],'gloss':plain(cols[6]),'meaning':plain(cols[7]),'sourceFile':source.name,'sourceLine':line_number})
   rows+=1
french={};lines=0;senses_count=0
with french_source.open() as f:
 for line in f:
  lines+=1;entry=json.loads(line)
  if entry.get('lang_code')!='fr' or entry.get('pos') not in ['verb','noun','adj']:continue
  word=entry.get('word')
  if not isinstance(word,str):continue
  word=norm(word)
  if not word or len(word.split())>6:continue
  senses=[]
  for sense in entry.get('senses',[]):
   if sense.get('form_of') or sense.get('alt_of') or 'form-of' in sense.get('tags',[]):continue
   glosses=[plain(g) for g in sense.get('glosses',[]) if isinstance(g,str)]
   if not glosses:continue
   senses.append({'id':sense.get('id'),'glosses':glosses,'tags':sense.get('tags',[])})
  if senses:
   french.setdefault(word,[]).append({'partOfSpeech':entry['pos'],'senses':senses});senses_count+=len(senses)
result={'schemaVersion':1,'stepSenses':step,'frenchMeanings':french}
raw=(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n').encode();target=root/'independent-meaning-bridge.json.gz';target.write_bytes(gzip.compress(raw,compresslevel=3,mtime=0))
receipt={'sources':{str(s.resolve()):sha(s) for s in [*step_sources,french_source]},'stepRows':rows,'stepIdentities':len(step),'frenchLemmas':len(french),'frenchSenses':senses_count,'frenchInputRows':lines,'outputSha256':hashlib.sha256(raw).hexdigest(),'compressedSha256':sha(target),'verseCitationsRemoved':True,'targetAnnotationsRead':False,'targetEditorialLemmasRead':False,'modelCalls':0,'meaning':'Lexical evidence only; no automatic claim of equivalence or correct carrier from a shared definition token.'}
(root/'independent-meaning-bridge-receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in receipt.items() if k!='sources'},indent=2))
