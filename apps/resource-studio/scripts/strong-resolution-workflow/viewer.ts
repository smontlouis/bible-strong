import {
  anchorContextHash,
  reviewKey,
  type ResolutionDossier,
  type ResolutionReview,
  type resolveDossier
} from "../../src/strongResolutionWorkflow.js";
import {
  resolutionSourceHash,
  resolutionTextHash
} from "../../src/strongResolution.js";

export function buildResolutionReviewHtml(
  dossiers: ResolutionDossier[],
  predictions: ReturnType<typeof resolveDossier>[]
) {
  const payload = dossiers.map((d, i) => ({
    ...d,
    prediction: predictions[i],
    contextSha256: anchorContextHash(d),
    textSha256: resolutionTextHash(d.text),
    units: d.units.map((u) => ({ ...u, sha256: resolutionSourceHash(u.unit) }))
  }));
  const reviews: Record<string, ResolutionReview> = {};
  for (const p of predictions)
    for (const r of p.decisions)
      if (r.review) reviews[reviewKey(r.review)] = r.review;
  const data = JSON.stringify({ dossiers: payload, reviews }).replace(
    /</gu,
    "\\u003c"
  );
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'"><title>Strong · Décisions par occurrence</title>
<style>
:root{font:16px system-ui;color:#182e35;background:#f4f5f1}*{box-sizing:border-box}body{margin:0}header{padding:26px 32px;background:#183a42;color:#f8faf5}h1{font-size:26px;margin:0 0 10px}header p{max-width:1050px;line-height:1.5;margin:4px 0}.toolbar{display:flex;gap:12px;flex-wrap:wrap;padding:18px 32px;background:#e6ece5;position:sticky;top:0;z-index:2}input,select,textarea,button{font:inherit;border:1px solid #b7c8c5;border-radius:6px;padding:8px;background:white;color:#183a42}button{cursor:pointer;background:#e8f3ef}button:hover{background:#d4e8df}main{display:grid;grid-template-columns:260px 1fr;max-width:1600px;margin:auto;gap:20px;padding:24px}nav{max-height:80vh;overflow:auto}nav button{display:block;text-align:left;width:100%;margin-bottom:8px}nav button.selected{background:#183a42;color:white}section{min-width:0}.panel{background:white;border:1px solid #d4ded7;border-radius:12px;padding:22px;margin-bottom:18px}.text{font:22px/1.8 Georgia,serif}.small{font-size:13px;color:#567071}.chips{display:flex;gap:5px;flex-wrap:wrap;margin:12px 0}.token{padding:7px 10px;background:#f2f5ef;cursor:pointer}.token.selected{background:#b8dacd}.token sup{font:10px system-ui;color:#567071;margin-right:5px}.units{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px}.unit{border:1px solid #d4ded7;border-radius:8px;padding:15px;background:#fff}.unit.selected{outline:2px solid #448875}.badge{font-size:12px;border-radius:16px;padding:4px 8px;background:#e4ece6;display:inline-block;margin:2px}.unresolved{background:#fff0cf}.empty{background:#e5e0f5}h2{font-size:21px;margin:0 0 12px}h3{margin:8px 0}details{margin:10px 0}summary{cursor:pointer}pre{white-space:pre-wrap;word-break:break-word;font-size:12px}label{display:block;margin:12px 0 5px}textarea{width:100%;min-height:85px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.note{border-left:3px solid #cf9d38;padding-left:12px;line-height:1.5}.muted{color:#657a7a}#message{padding:0 32px;color:#194d38}a{color:#255d61}@media(max-width:800px){main{grid-template-columns:1fr;padding:12px}nav{max-height:180px}.grid{grid-template-columns:1fr}.toolbar{position:static}}
</style><header><h1>Strong · Chaque occurrence a une décision</h1><p>Un mot placé, une absence explicite ou une incertitude. L’absence et son emplacement sont examinés séparément.</p><p class="small" style="color:#d4e3dc">Dossier local • aucun envoi réseau • les propositions automatiques et les revues assistées ne sont pas une validation humaine.</p></header>
<div class="toolbar"><input id="search" aria-label="Chercher une référence" placeholder="Référence : Gen.2.24…"><select id="edition"><option value="">Toutes les éditions</option><option>Sg1910</option><option>Darby</option><option>DarbyR</option></select><select id="filter"><option value="all">Tous les versets</option><option value="unresolved">Avec incertitudes</option><option value="proposal">Avec proposition exacte</option><option value="review">Avec revue enregistrée</option></select><button id="export">Exporter les décisions</button><label style="margin:0">Importer <input id="import" type="file" accept="application/json" style="width:200px"></label></div><p id="message" role="status"></p><main><nav id="list" aria-label="Versets"></nav><section id="content"></section></main>
<script type="application/json" id="data">${data}</script><script>
${String.raw`
const data=JSON.parse(document.getElementById('data').textContent), dossiers=data.dossiers;
let records=data.reviews, current=0, unitId=null, chosen=[];
const el=id=>document.getElementById(id), key=(d,id)=>d.edition+':'+d.ref+':'+id;
const labels={visible:'Visible',empty:'Vide',unresolved:'Incertain'};
function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function button(text,fn){const b=node('button',text);b.type='button';b.onclick=fn;return b;}
function say(t){el('message').textContent=t;}
function formatAnchor(a){return a?.interval ? 'Après les mots '+a.interval[0]+' à '+a.interval[1]+' (indices 0 ; −1 = début)' : 'Aucun intervalle compatible';}
function list(){const target=el('list');target.replaceChildren();const q=el('search').value.toLowerCase(),edition=el('edition').value,f=el('filter').value;let count=0;
dossiers.forEach((d,i)=>{if((q&&!d.ref.toLowerCase().includes(q))||(edition&&edition!==d.edition))return;
if(f==='unresolved'&&!d.prediction.summary.unresolved)return;if(f==='proposal'&&!d.prediction.decisions.some(r=>r.proposal))return;if(f==='review'&&!d.units.some(u=>records[key(d,u.unit.id)]))return;
count++;const b=button(d.edition+' · '+d.ref+'\n'+d.prediction.summary.unresolved+' incertitude(s)',()=>{current=i;unitId=null;render();list();});if(i===current)b.className='selected';target.append(b);});target.prepend(node('p',count+' textes','small'));}
function render(){const d=dossiers[current],p=d.prediction,c=el('content');c.replaceChildren();const top=node('div',undefined,'panel');top.append(node('h2',d.edition+' · '+d.ref),node('p',d.text,'text'));
const s=p.summary;top.append(node('p',s.visible+' visibles · '+s.empty+' vides · '+s.unresolved+' incertitudes · '+s.assisted+' revues assistées · '+s.humanReviewed+' revues humaines','small'));
top.append(node('p','Ces compteurs décrivent le dernier calcul. Les nouvelles décisions sont exportées, puis validées et réappliquées par le programme local.','note small'));
const witness=node('details');witness.append(node('summary','Consulter les témoins et les porteurs actuels'));
d.witnesses.forEach(w=>witness.append(node('h3',w.name+' · '+w.family),node('p',w.text)));
witness.append(node('pre',JSON.stringify(d.placements,null,2)));top.append(witness);c.append(top);
const grid=node('div',undefined,'units');d.units.forEach(u=>{const r=p.decisions.find(r=>r.sourceUnitId===u.unit.id),saved=records[key(d,u.unit.id)],box=node('div',undefined,'unit'+(unitId===u.unit.id?' selected':''));
box.append(node('span',saved?'Revue : '+labels[saved.state]:labels[r.state],'badge '+r.state),node('h3',u.unit.strong.join(' / ')+' · '+u.surface),node('p',u.gloss,'small'),node('p',r.targetWordIndices.map(i=>d.words[i]).join(' ')||(r.state==='empty'?'Absence de porteur lexical distinct':'Relation à établir')));
if(r.assurance==='linguistic-rule')box.append(node('span','Règle linguistique','badge'));
if(r.assurance==='linguistic-rule'&&r.display)box.append(node('p',r.display.insertAfterWordIndex<0?'Ancrage : début du verset':'Ancrage : après « '+d.words[r.display.insertAfterWordIndex]+' »','small'));
if(saved?.anchor)box.append(node('p',saved.anchor.insertAfterWordIndex<0?'Ancrage : début du verset':'Ancrage : après « '+d.words[saved.anchor.insertAfterWordIndex]+' »','small'));
if(saved)box.append(node('span',saved.reviewer.kind==='assistant'?'Revue assistée':'Revue humaine','badge'));
if(r.proposal)box.append(node('p','Proposition : '+d.words.slice(r.proposal.startWordIndex,r.proposal.endWordIndex+1).join(' '),'note'));
box.append(button('Examiner',()=>{unitId=u.unit.id;chosen=[...(saved?.targetWordIndices??[])];render();el('editor').scrollIntoView({block:'start',behavior:'smooth'});}));grid.append(box);});c.append(grid);
if(!unitId)return;const u=d.units.find(u=>u.unit.id===unitId),r=p.decisions.find(r=>r.sourceUnitId===unitId),saved=records[key(d,unitId)],editor=node('div',undefined,'panel');editor.id='editor';editor.style.marginTop='20px';editor.append(node('h2','Revue · '+u.unit.strong.join(' / ')+' · '+u.surface),node('p',u.gloss+' — '+u.morphology),node('p',u.sourceFile+':'+u.sourceLine,'small'));
const proof=node('details');proof.append(node('summary','Propositions et justification du générateur'),node('pre',JSON.stringify({baseline:r.baseline,source:r.sourceAnchor,witness:r.witnessAnchor,combined:r.anchor,grammaticalRule:r.grammaticalDecision},null,2)));editor.append(proof,node('p','Source : '+formatAnchor(r.sourceAnchor)+'\nTémoins : '+formatAnchor(r.witnessAnchor),'small'));
const fields={};function field(id,label,tag='input',options){const labelNode=node('label',label);labelNode.htmlFor=id;editor.append(labelNode);const f=node(tag);f.id=id;if(options)options.forEach(([value,text])=>{const o=node('option',text);o.value=value;f.append(o);});fields[id]=f;editor.append(f);return f;}
field('reviewer','Identité du réviseur').value=saved?.reviewer.id??'';
field('kind','Origine de la revue','select',[['human','Humaine'],['assistant','Assistée par un modèle']]).value=saved?.reviewer.kind??'human';
field('state','Décision','select',[['unresolved','Encore incertain'],['visible','Équivalent explicite'],['empty','Sans équivalent explicite']]).value=saved?.state??'unresolved';
field('relation','Type de relation','select',[['uncertain','Incertaine'],['lexical','Lexicale'],['grammatical','Grammaticale'],['idiomatic','Expression / idiome'],['no-explicit-equivalent','Absence explicite']]).value=saved?.relation??'uncertain';
editor.append(node('label','Mots de la relation — cliquer pour sélectionner (les groupes discontinus sont conservés)'));
const tokens=node('div',undefined,'chips');d.words.forEach((word,i)=>{const b=button(i+' · '+word,()=>{chosen=chosen.includes(i)?chosen.filter(j=>j!==i):[...chosen,i].sort((a,b)=>a-b);b.className='token'+(chosen.includes(i)?' selected':'');});b.className='token'+(chosen.includes(i)?' selected':'');tokens.append(b);});editor.append(tokens);
field('carrier','Support affiché : indices consécutifs séparés par des virgules (optionnel)').value=(saved?.carrierWordIndices??[]).join(',');
field('rationale','Justification de la relation ou de l’absence','textarea').value=saved?.rationale??'';
field('sources','Sources effectivement consultées, une par ligne','textarea').value=(saved?.sources??[u.sourceFile+':'+u.sourceLine]).join('\n');
field('after','Ancrage du vide : après quel indice ? −1 = début ; vide = non décidé').value=saved?.anchor?.insertAfterWordIndex??'';
field('anchorReason','Justification distincte de l’ancrage','textarea').value=saved?.anchor?.rationale??'';
editor.append(button('Enregistrer dans ce dossier',()=>{try{
const state=fields.state.value,relation=fields.relation.value,carrier=fields.carrier.value.trim()?fields.carrier.value.split(',').map(v=>Number(v.trim())):[];
if(!fields.reviewer.value.trim()||!fields.rationale.value.trim())throw Error('Indiquer le réviseur et la justification.');
if((state==='visible')!==(chosen.length>0))throw Error('Seule une relation visible possède des mots sélectionnés.');
if((state==='empty')!==(relation==='no-explicit-equivalent')||(state==='unresolved')!==(relation==='uncertain'))throw Error('La relation doit correspondre à la décision.');
if(carrier.some((v,i)=>!Number.isInteger(v)||!chosen.includes(v)||(i&&v!==carrier[i-1]+1)))throw Error('Le support doit être un sous-ensemble consécutif de la relation.');
const review={edition:d.edition,ref:d.ref,sourceUnitId:unitId,sourceUnitSha256:u.sha256,targetTextSha256:d.textSha256,reviewer:{id:fields.reviewer.value.trim(),kind:fields.kind.value,exposure:'exposed'},state,relation,targetWordIndices:[...chosen],carrierWordIndices:carrier,rationale:fields.rationale.value.trim(),sources:fields.sources.value.split('\n').map(s=>s.trim()).filter(Boolean)};
if(!review.sources.length)throw Error('Indiquer les sources consultées.');
if(fields.after.value.trim()!==''){const after=Number(fields.after.value);if(state!=='empty'||!Number.isInteger(after)||after< -1||after>=d.words.length||!fields.anchorReason.value.trim())throw Error('Ancrage réservé aux vides, dans le verset et avec justification.');review.anchor={insertAfterWordIndex:after,rationale:fields.anchorReason.value.trim(),contextSha256:d.contextSha256};}
records[key(d,unitId)]=review;say('Décision enregistrée en mémoire. Exporter pour la conserver ; le programme local contrôlera toutes les liaisons.');list();render();
}catch(e){say(e.message);}}));c.append(editor);}
el('export').onclick=()=>{const blob=new Blob([JSON.stringify(Object.values(records),null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download='strong-resolution-reviews.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);say(Object.keys(records).length+' décisions exportées.');};
el('import').onchange=async()=>{try{const value=JSON.parse(await el('import').files[0].text());if(!Array.isArray(value))throw Error('Une liste de décisions est attendue.');const next={...records};for(const r of value){const d=dossiers.find(d=>d.edition===r.edition&&d.ref===r.ref),u=d?.units.find(u=>u.unit.id===r.sourceUnitId);if(!u||r.targetTextSha256!==d.textSha256||r.sourceUnitSha256!==u.sha256)throw Error('Décision inconnue ou périmée.');next[key(d,r.sourceUnitId)]=r;}records=next;list();render();say(value.length+' décisions importées pour inspection. Validation complète lors du rejeu local.');}catch(e){say(e.message);}};
['search','edition','filter'].forEach(id=>el(id).oninput=list);list();render();
`}
</script></html>`;
}
