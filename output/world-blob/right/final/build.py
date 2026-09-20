from pathlib import Path
from collections import deque
import json
import numpy as np
from PIL import Image,ImageFilter
out=Path(__file__).resolve().parent
raw=Image.open(out/'right-24-raw.png').convert('RGB')
fixed=Image.open(out/'right-24-corrected-source.png').convert('RGB')
assert raw.size==fixed.size==(1536,1024)
corrected={3,4,5,15,16,17}
frames=[]
(out/'frames').mkdir(exist_ok=True)
for i in range(24):
 x,y=i%6*256,i//6*256
 rgb=np.asarray((fixed if i in corrected else raw).crop((x,y,x+256,y+256))).astype(float)
 # The continuous black outline encloses the sprite. Flood the exterior to
 # remove even desaturated green halos without deleting the black eyes.
 barrier=(rgb.max(axis=2)<115)&((rgb.max(axis=2)-rgb.min(axis=2))<35)
 outside=np.zeros((256,256),bool);q=deque()
 for n in range(256):
  for a,b in ((0,n),(255,n),(n,0),(n,255)):
   if not outside[a,b]:outside[a,b]=True;q.append((a,b))
 while q:
  a,b=q.popleft()
  for c,d in ((a-1,b),(a+1,b),(a,b-1),(a,b+1)):
   if 0<=c<256 and 0<=d<256 and not outside[c,d] and not barrier[c,d]:
    outside[c,d]=True;q.append((c,d))
 mask=Image.fromarray((~outside).astype('uint8')*255)
 assert np.count_nonzero(~outside)>2500,(i,'open outline')
 # Small edge coverage for antialiasing; RGB is neutral for Phaser tinting.
 alpha=np.asarray(mask.filter(ImageFilter.GaussianBlur(.35)))
 gray=np.clip((rgb[:,:,0]+rgb[:,:,2])/2,0,255).astype('uint8')
 gray[outside]=0
 rgba=np.dstack((gray,gray,gray,alpha))
 f=Image.fromarray(rgba).crop((16,16,240,240)).resize((256,256),Image.Resampling.LANCZOS)
 f.save(out/'frames'/f'blob-right-{i:02}.png');frames.append(f)
sheet=Image.new('RGBA',(2048,768))
previews=[]
for i,f in enumerate(frames):
 sheet.paste(f,((i%8)*256,(i//8)*256))
 bg=Image.new('RGB',(256,256),'#dce4ec');bg.paste(f,mask=f.getchannel('A'));previews.append(bg)
sheet.save(out/'blob-right-spritesheet.png')
previews[0].save(out/'blob-right-preview.gif',save_all=True,append_images=previews[1:],duration=[80,80,90]*8,loop=0,disposal=2)
previews[0].save(out/'blob-right-preview.webp',save_all=True,append_images=previews[1:],duration=[83,83,84]*8,loop=0,lossless=True)
check=Image.new('RGB',(6*256,4*256),'#dce4ec')
for i,p in enumerate(previews):check.paste(p,((i%6)*256,(i//6)*256))
check.save(out/'verification.jpg')
meta={'image':'blob-right-spritesheet.png','frameWidth':256,'frameHeight':256,'columns':8,'rows':3,'frameCount':24,'frameRate':12,'durationSeconds':2,'repeat':-1,'sourceVideo':'../v3/blob-right-hop-minimax-v3.mp4','sourceFrames':list(range(12,36)),'correctedFrameIndices':sorted(corrected),'origin':{'x':.5,'y':218/224},'notes':'Two extracted cycles slowed from 24 to 12 fps. Six lower-lobe corrections via imagegen; other poses from video. Shared crop and grayscale transparent output.'}
(out/'blob-right.json').write_text(json.dumps(meta,indent=2)+'\n')
(out/'phaser-example.js').write_text("""// preload
this.load.spritesheet('blob-right', 'blob-right-spritesheet.png', {
  frameWidth: 256, frameHeight: 256
});
// create
this.anims.create({
  key: 'blob-walk-right',
  frames: this.anims.generateFrameNumbers('blob-right', {start: 0, end: 23}),
  frameRate: 12, repeat: -1
});
const blob = this.add.sprite(x, y, 'blob-right')
  .setOrigin(0.5, 0.9732142857)
  .setTint(0x6486ff)
  .play('blob-walk-right');
// For leftward movement: blob.setFlipX(true);
""")
print('24 frames saved; six corrected poses; 2048x768 transparent sheet; 2-second previews.')
