import datetime as dt, json, pathlib, urllib.request, time, hashlib, re, concurrent.futures
from html.parser import HTMLParser
ROOT=pathlib.Path(__file__).parent
(ROOT/'sources').mkdir(exist_ok=True)
class Node:
 def __init__(self,tag='',attrs=()):self.tag=tag;self.attrs=dict(attrs);self.children=[]
 def text(self):return ''.join(c if isinstance(c,str) else ('\n\n'+c.text()+'\n\n' if c.tag in ['p','li'] else '\n' if c.tag=='br' else c.text()) for c in self.children).strip()
 def find(self,p):
  out=[self] if p(self) else []
  for c in self.children:
   if isinstance(c,Node):out+=c.find(p)
  return out
class Parser(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=True);self.root=Node();self.stack=[self.root]
 def handle_starttag(self,t,a):
  n=Node(t,a);self.stack[-1].children.append(n)
  if t not in ['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']:self.stack.append(n)
 def handle_endtag(self,t):
  for i in range(len(self.stack)-1,0,-1):
   if self.stack[i].tag==t:self.stack=self.stack[:i];break
 def handle_data(self,d):self.stack[-1].children.append(d)
def fetch(date):
 url='https://editeurbpc.com/calendriers/la-bonne-semence/'+date.strftime('%Y%m%d');path=ROOT/'sources'/(date.isoformat()+'.html')
 if path.exists():data=path.read_bytes()
 else:
  for attempt in range(5):
   try:
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'BibleStrong authorized archive import; contact via editeurbpc.com'}),timeout=40) as r:
     assert r.url.rstrip('/')==url,('redirect',r.url)
     data=r.read()
    path.write_bytes(data);time.sleep(.15);break
   except Exception:
    if attempt==4:raise
    time.sleep(2**attempt)
 p=Parser();p.feed(data.decode('utf-8'))
 blocks=p.root.find(lambda n:n.attrs.get('id')=='html');assert len(blocks)==1,(date,'main block')
 assert date.strftime('%d/%m/%Y') in p.root.find(lambda n:n.tag=='title')[0].text(),(date,'wrong date')
 main=blocks[0];texts=lambda cls:[n.text() for n in main.find(lambda n:cls in n.attrs.get('class','').split())]
 titles=texts('titre');bodies=texts('texte');verses=texts('verset-texte');refs=texts('verset-reference')
 assert len(titles)==1 and titles[0] and bodies and all(bodies) and verses and len(verses)==len(refs),(date,'invalid content',len(titles),len(bodies),len(verses),len(refs))
 body=re.sub(r'\n[\s\n]*\n','\n\n','\n\n'.join(bodies)).strip()
 return {'date':date.isoformat(),'title':titles[0],'opening':'\n\n'.join(v+'\n'+r for v,r in zip(verses,refs)),'body':body,'source':url,'sourceSha256':hashlib.sha256(data).hexdigest()}
if __name__=='__main__':
 start=dt.date(2021,1,1);end=dt.date(2027,1,1);dates=[start+dt.timedelta(days=i) for i in range((end-start).days)];rows=[];errors=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
  futures={pool.submit(fetch,d):d for d in dates}
  for f in concurrent.futures.as_completed(futures):
   try:rows.append(f.result())
   except Exception as e:errors.append({'date':futures[f].isoformat(),'error':str(e)})
   if (len(rows)+len(errors))%100==0:print('Processed',len(rows),'valid;',len(errors),'errors',flush=True)
 rows.sort(key=lambda r:r['date']);(ROOT/'readings.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2));(ROOT/'errors.json').write_text(json.dumps(errors,ensure_ascii=False,indent=2));print('DONE',len(rows),'valid;',len(errors),'errors',flush=True)
