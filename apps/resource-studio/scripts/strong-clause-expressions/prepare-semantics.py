"""Snapshot independent French lexical links without target Bible annotations."""
import argparse,bz2,gzip,hashlib,json,re,unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path

p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);a=p.parse_args();root=a.root.resolve()
office=Path('data/external/french-lexical/openoffice/synonymes/handler/dictionary.go').resolve()
wolf=Path('data/external/french-lexical/wolf/wolf-1.0b4.xml.bz2').resolve()
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def norm(text):return ' '.join(unicodedata.normalize('NFC',text).lower().replace('’',"'").replace('_',' ').split())
text=office.read_text();body=text[text.index('return []byte(`')+len('return []byte(`'):text.rindex('`')];lines=body.splitlines();assert lines[0]=='UTF-8'
entries={};i=1
while i<len(lines):
 line=lines[i];i+=1
 if not line.strip():continue
 word,count=line.rsplit('|',1);groups=[]
 for offset in range(int(count)):
  parts=lines[i].split('|');i+=1
  groups.append({'rawPartOfSpeech':parts[0],'terms':sorted(set(norm(s) for s in parts[1:] if norm(s)))})
 entries[norm(word)]=groups
senses=[];verified=0;links=0
with bz2.open(wolf,'rb') as stream:
 for _,element in ET.iterparse(stream,events=['end']):
  if element.tag!='SYNSET':continue
  literals=[]
  for term in element.iter('LITERAL'):
   note=term.attrib.get('lnote','');manual=bool(re.search(r'(?:^|;)Man(?:Val|Add)\d{4}OK(?:;|$)',note))
   value=norm(term.text or '')
   if value:literals.append({'text':value,'reviewedInDictionary':manual,'provenance':note});verified+=manual
  if literals:
   senses.append({'id':element.findtext('ID'),'partOfSpeech':element.findtext('POS'),'definition':element.findtext('DEF'),'terms':literals})
   links+=len(literals)
  element.clear()
result={'schemaVersion':1,'openOffice':entries,'wolf':senses}
raw=(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n').encode();target=root/'french-semantic-links.json.gz';target.write_bytes(gzip.compress(raw,compresslevel=3,mtime=0))
receipt={'sources':{'openoffice':{'path':str(office),'sha256':sha(office)},'wolf':{'path':str(wolf),'sha256':sha(wolf)}},'openOfficeEntries':len(entries),'wolfSenses':len(senses),'wolfLiterals':links,'wolfReviewedLiterals':verified,'outputSha256':hashlib.sha256(raw).hexdigest(),'compressedSha256':sha(target),'targetAnnotationsRead':False,'modelCalls':0,'limitations':['OpenOffice lists conflate senses and include loose associations; they are proposals, not proof by themselves.','WOLF contains automatically translated entries; manual dictionary validation is retained per literal and does not certify any target Bible relation.','No transitive synonym closure is computed.']}
(root/'french-semantic-links-receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in receipt.items() if k not in ['sources','limitations']},indent=2))
