"""Prepare source-pixel occlusion sprites offline using SAM 2.1 ONNX.

Requires numpy, Pillow, opencv-python-headless and onnxruntime in a tools-only venv.
No inference dependency is installed in or shipped with the browser application.
"""
import argparse
import json
import math
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image, ImageDraw

parser = argparse.ArgumentParser()
parser.add_argument('--models', type=Path, required=True)
parser.add_argument('--only', default='')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
source = Image.open(root / 'scripts/assets/archipelago.png').convert('RGB')
output = root / 'public/assets/occlusion'
output.mkdir(exist_ok=True)
metadata = root / 'src/generated'
metadata.mkdir(exist_ok=True)
qa = root / 'segmentation-qa'
qa.mkdir(exist_ok=True)

targets = [
    dict(id='tree-west', name='Arbre ouest', box=[669,310,735,391], baseY=380, positive=[[702,340],[705,380]], negative=[[693,399],[735,354]], candidate=0),
    dict(id='central-table', name='Table et Bible', box=[742,386,932,520], baseY=489, positive=[[821,459],[834,423],[811,497]], negative=[[833,524],[737,451],[934,451]]),
    dict(id='tree-north-east', name='Arbre nord-est', box=[875,310,940,382], baseY=374, positive=[[909,341],[906,371]], negative=[[914,392],[941,350]], candidate=2),
    dict(id='cypress-east', name='Arbre du pont est', box=[1045,349,1100,438], baseY=427, positive=[[1072,388],[1074,425]], negative=[[1050,431],[1098,433]], candidate=2),
    dict(id='sign-west', name='Panneau ouest', box=[625,415,678,492], baseY=483, positive=[[642,465],[657,456],[654,437]], negative=[[630,457],[666,475]]),
    dict(id='sign-east', name='Panneau est', box=[1011,412,1057,488], baseY=480, positive=[[1028,470],[1043,455],[1040,436]], negative=[[1015,450],[1047,478]]),
    dict(id='dictionary-desk', name='Bureau dictionnaire', box=[232,222,405,330], baseY=308, positive=[[301,284],[329,248],[365,289]], negative=[[322,338],[225,273],[408,289]]),
    dict(id='lexicon-desk', name='Table lexique', box=[815,185,944,266], baseY=254, positive=[[878,234],[876,217],[855,249]], negative=[[947,232],[885,275]]),
    dict(id='themes-table', name='Table thèmes', box=[235,677,367,772], baseY=747, positive=[[298,710],[294,727],[302,754]], negative=[[285,775],[365,749]]),
    dict(id='comparison-left', name='Table comparaison gauche', box=[684,726,808,821], baseY=799, positive=[[745,764],[731,749],[735,802]], negative=[[742,825],[689,792]]),
    dict(id='comparison-right', name='Table comparaison droite', box=[874,737,992,833], baseY=812, positive=[[935,775],[935,757],[938,813]], negative=[[937,840],[991,811]]),
    dict(id='commentary-table', name='Table commentaires', box=[1282,679,1495,791], baseY=765, positive=[[1386,747],[1395,711],[1321,773]], negative=[[1410,790],[1286,778],[1499,738]]),
    dict(id='pergola-west-column', name='Pilier ouest de la pergola', box=[1207,522,1255,700], baseY=692, positive=[[1225,598],[1225,674],[1228,542]], negative=[[1259,615],[1200,615]]),
    dict(id='pergola-east-column', name='Pilier est de la pergola', box=[1498,581,1559,788], baseY=773, positive=[[1519,637],[1520,715],[1518,765]], negative=[[1570,666],[1556,705],[1574,750]]),
    dict(id='rail-west', name='Rambarde avant ouest', box=[478,302,595,391], baseY=410, always=True, positive=[[543,357],[517,339],[560,366],[488,316]], negative=[[531,326],[573,355],[604,400],[520,360]]),
    dict(id='rail-south-west', name='Rambarde avant sud-ouest', box=[545,510,678,607], baseY=610, always=True, positive=[[589,553],[633,534],[603,575],[555,581]], negative=[[589,535],[636,514],[595,591]]),
    dict(id='rail-east', name='Rambarde avant est', box=[1078,292,1187,384], baseY=409, always=True, positive=[[1116,362],[1150,335],[1170,320]], negative=[[1132,316],[1090,375],[1150,359]]),
    dict(id='rail-south-east', name='Rambarde avant sud-est', box=[993,502,1155,625], baseY=626, always=True, positive=[[1004,521],[1068,556],[1128,602],[1034,540],[1106,579]], negative=[[1040,523],[1100,556],[1150,587],[1060,589]]),
]
details = json.loads((root / 'scripts/detail-objects.json').read_text())
targets.extend(details)
# Separate ground footprints from the silhouette: tree canopies are not solid walls.
footprints = []
for target in details:
    for i, (x, y, rx, ry) in enumerate(target['feet']):
        footprints.append(dict(
            id=f"detail-{target['id']}-{i}", name=target['name'], kind='blocked',
            points=[[round(x + rx*math.cos(j*math.pi/8), 3),
                     round(y + ry*math.sin(j*math.pi/8), 3)] for j in range(16)]))
(metadata/'detail-footprints.json').write_text(json.dumps(footprints,indent=2)+'\n')
options = ort.SessionOptions()
options.intra_op_num_threads = 4
options.inter_op_num_threads = 1
encoder = ort.InferenceSession(str(args.models / 'vision_encoder.onnx'), sess_options=options, providers=['CPUExecutionProvider'])
decoder = ort.InferenceSession(str(args.models / 'prompt_encoder_mask_decoder.onnx'), sess_options=options, providers=['CPUExecutionProvider'])
manifest_path = metadata/'occlusion-manifest.json'
manifest = json.loads(manifest_path.read_text()) if args.only and manifest_path.exists() else []
panels = []

for target in targets:
    if args.only and target['id'] not in args.only.split(','):
        continue
    x0,y0,x1,y1 = target['box']
    pad = 32
    left,top,right,bottom = max(0,x0-pad),max(0,y0-pad),min(source.width,x1+pad),min(source.height,y1+pad)
    crop = source.crop((left,top,right,bottom))
    width,height = crop.size
    guide=crop.resize((width*3,height*3),Image.Resampling.NEAREST)
    drawing=ImageDraw.Draw(guide)
    for gx in range((left//20+1)*20,right,20):
        sx=(gx-left)*3
        drawing.line((sx,0,sx,height*3),fill='#ff009966',width=1)
        drawing.text((sx+1,4),str(gx),fill='#ffffff',stroke_width=1,stroke_fill='#000000')
    for gy in range((top//20+1)*20,bottom,20):
        sy=(gy-top)*3
        drawing.line((0,sy,width*3,sy),fill='#ff009966',width=1)
        drawing.text((2,sy+2),str(gy),fill='#ffffff',stroke_width=1,stroke_fill='#000000')
    guide.save(qa/f"{target['id']}-coordinates.png")
    image = np.asarray(crop.resize((1024,1024), Image.Resampling.BILINEAR), dtype=np.float32)/255
    image = (image - np.array([.485,.456,.406],np.float32))/np.array([.229,.224,.225],np.float32)
    pixels = np.transpose(image,(2,0,1))[None].copy()
    features = encoder.run(None, {'pixel_values': pixels})
    points = target['positive'] + target.get('negative', [])
    coords = np.array([[(x-left)*1024/width,(y-top)*1024/height] for x,y in points],np.float32)[None,None]
    labels = np.array([1]*len(target['positive']) + [0]*len(target.get('negative',[])),np.int64)[None,None]
    boxes = np.array([[[(x0-left)*1024/width,(y0-top)*1024/height,(x1-left)*1024/width,(y1-top)*1024/height]]],np.float32)
    feed = {'input_points':coords,'input_labels':labels,'input_boxes':boxes}
    feed.update(dict(zip([o.name for o in encoder.get_outputs()],features)))
    scores,masks,_ = decoder.run(None,feed)
    print(target['id'], 'scores',scores.tolist(),'shape',masks.shape,flush=True)
    chosen = target.get('candidate', int(np.argmax(scores[0,0])))
    # Visual QA takes precedence over the model confidence, especially on thin rails.
    chosen = {'lexicon-desk':0, 'pergola-east-column':0, 'rail-south-west':1, 'rail-east':1, 'rail-south-east':1}.get(target['id'],chosen)
    for index in range(3):
        logits = cv2.resize(masks[0,0,index],(width,height),interpolation=cv2.INTER_LINEAR)
        alpha = (np.clip(logits + 0.5, 0, 1)*255).astype(np.uint8)
        count,components,stats,_ = cv2.connectedComponentsWithStats((alpha>127).astype(np.uint8),8)
        if count > 1:
            largest = 1 + np.argmax(stats[1:,cv2.CC_STAT_AREA])
            neighborhood=cv2.dilate((components==largest).astype(np.uint8),np.ones((3,3),np.uint8))
            alpha[neighborhood==0]=0
        if target.get('fillHoles') or 'table' in target['id'] or 'desk' in target['id'] or 'comparison-' in target['id']:
            contours,_ = cv2.findContours((alpha>127).astype(np.uint8),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
            interior = np.zeros_like(alpha)
            cv2.drawContours(interior,contours,-1,255,cv2.FILLED)
            alpha = np.maximum(alpha,interior)
        sprite = crop.convert('RGBA')
        sprite.putalpha(Image.fromarray(alpha))
        sprite.save(qa/f"{target['id']}-candidate-{index}.png")
        if index == chosen:
            final = sprite
    bounds = final.getbbox()
    if bounds is None:
        raise ValueError(f"Empty mask for {target['id']}")
    final.crop(bounds).save(output/f"{target['id']}.png")
    manifest = [entry for entry in manifest if entry['id'] != target['id']]
    manifest.append(dict(id=target['id'],name=target['name'],x=left+bounds[0],y=top+bounds[1],width=bounds[2]-bounds[0],height=bounds[3]-bounds[1],baseY=target['baseY'],always=target.get('always',False),url=f"./assets/occlusion/{target['id']}.png"))
    panel = Image.new('RGB',(800,300),'#eef1f6')
    draw = ImageDraw.Draw(panel)
    draw.text((10,8),target['id']+f' / chosen {chosen}',fill='black')
    for index in range(4):
        tile = crop.convert('RGBA') if index==0 else Image.open(qa/f"{target['id']}-candidate-{index-1}.png")
        tile.thumbnail((190,250))
        bg = Image.new('RGBA',(190,250),'#d22f95' if index else '#ffffff')
        bg.alpha_composite(tile,((190-tile.width)//2,(250-tile.height)//2))
        panel.paste(bg.convert('RGB'),(index*200+5,30))
    panels.append(panel)
    panel.save(qa/f"{target['id']}-review.png")

manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
sheet = Image.new('RGB',(800,300*len(panels)),'white')
for i,panel in enumerate(panels):
    sheet.paste(panel,(0,i*300))
sheet.save(qa/'candidates.jpg')
for group in range((len(panels)+3)//4):
    sheet.crop((0,group*1200,800,min(sheet.height,(group+1)*1200))).save(qa/f'review-{group}.png')
