"""Explicit rollback only; refuses to remove documents modified since this import."""
from import_firestore import ROOT,PROJECT,BASE,request
import json,sys
assert sys.argv[1:]==['--confirm-delete-import'], 'Explicit rollback argument required'
receipt=json.loads((ROOT/'receipt.json').read_text());assert receipt['projectId']==PROJECT
writes=[{'delete':f'projects/{PROJECT}/databases/(default)/documents/'+d['path'],'currentDocument':{'updateTime':d['updateTime']}} for d in receipt['documents']]
request(BASE+':commit',{'writes':writes});print('Rolled back only unchanged documents created by this import')
