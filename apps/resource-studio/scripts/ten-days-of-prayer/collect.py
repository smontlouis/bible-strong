"""Acquire the six selected official campaigns, in French and English. No publication."""
import concurrent.futures,hashlib,io,json,pathlib,zipfile
import requests
ROOT=pathlib.Path(__file__).resolve().parents[4]
OUT=ROOT/'output/imports/ten-days-of-prayer-2026-09'
SOURCE=pathlib.Path(__file__).with_name('sources.json')
def acquire(entry):
    folder=OUT/'sources'/f'{entry["year"]}-{entry["lang"]}';folder.mkdir(parents=True,exist_ok=True)
    cached=next(iter(folder.glob('source.*')),None)
    if cached and cached.suffix not in ('.zip','.pdf'):cached=None
    if cached:data=cached.read_bytes()
    else:
        r=requests.get(entry['url'],timeout=90);r.raise_for_status();data=r.content
        (folder/('source.zip' if data[:2]==b'PK' else 'source.pdf')).write_bytes(data)
    files=[]
    def unzip(data,english=False):
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            nested=[n for n in z.namelist() if '__MACOSX' not in n and n.lower().endswith('.zip') and 'english' in n.lower()]
            if english and nested:
                assert len(nested)==1;unzip(z.read(nested[0]));return
            for n in z.namelist():
                if '__MACOSX' not in n and n.lower().endswith('.pdf'):
                    # No archive paths are used as filesystem destinations.
                    name=hashlib.sha256(n.encode()).hexdigest()[:8]+'-'+pathlib.PurePosixPath(n).name
                    path=folder/name;path.write_bytes(z.read(n));files.append(name)
    if data[:2]==b'PK':unzip(data,entry['lang']=='en')
    else:files=['source.pdf']
    if entry['lang']=='en' and entry['year']>=2023:
        url=f'https://www.tendaysofprayer.org/{entry["year"]}'
        r=requests.get(url,timeout=45);r.raise_for_status();(folder/'web.html').write_text(r.text)
    return {**entry,'sha256':hashlib.sha256(data).hexdigest(),'files':files}
def main():
    sources=json.loads(SOURCE.read_text());assert len(sources)==12
    with concurrent.futures.ThreadPoolExecutor(3) as pool:result=list(pool.map(acquire,sources))
    (OUT/'downloads.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print('Acquired',len(result),'official language editions')
if __name__=='__main__':main()
