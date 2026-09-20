from pathlib import Path
import json, subprocess
import numpy as np
from PIL import Image,ImageDraw
out=Path(__file__).resolve().parent
raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(out/'blob-front-hop-minimax.mp4'),'-f','rawvideo','-pix_fmt','rgb24','-'])
video=np.frombuffer(raw,np.uint8).reshape(-1,768,768,3)
indices=[]
for i in range(8,29):
 indices.append(i)
 if i in (14,15,25): indices.append(i)
frames=[]
(out/'frames').mkdir(exist_ok=True)
for n,i in enumerate(indices):
 rgb=video[i].astype(np.float32)
 spill=rgb[:,:,1]-np.maximum(rgb[:,:,0],rgb[:,:,2])
 alpha=np.clip((110-spill)/85,0,1)
 gray=np.clip((rgb[:,:,0]+rgb[:,:,2])/2/np.maximum(alpha,.001),0,255)
 rgba=np.stack([gray,gray,gray,alpha*255],axis=-1).astype(np.uint8)
 rgba[alpha==0]=0
 frame=Image.fromarray(rgba).crop((96,48,672,624)).resize((256,256),Image.Resampling.LANCZOS)
 frame.save(out/'frames'/f'blob-down-{n:02d}.png')
 frames.append(frame)
sheet=Image.new('RGBA',(8*256,3*256))
for n,frame in enumerate(frames): sheet.paste(frame,((n%8)*256,(n//8)*256))
sheet.save(out/'blob-down-spritesheet.png')
previews=[]
for f in frames:
 bg=Image.new('RGB',f.size,'#dce4ec');bg.paste(f,mask=f.getchannel('A'));previews.append(bg)
previews[0].save(out/'blob-down-preview.webp',save_all=True,append_images=previews[1:],duration=[83,83,84]*8,loop=0,lossless=True)
previews[0].save(out/'blob-down-preview.gif',save_all=True,append_images=previews[1:],duration=[80,80,90]*8,loop=0,disposal=2)
meta={'image':'blob-down-spritesheet.png','frameWidth':256,'frameHeight':256,'columns':8,'rows':3,'frameCount':24,'frameRate':12,'durationSeconds':2,'repeat':-1,'sourceFrames':indices,'sourceFrameRate':24,'sourceCrop':{'x':96,'y':48,'width':576,'height':576},'origin':{'x':0.5,'y':(604-48)/576},'notes':'Two distinct hops; three held apex frames. Shared crop preserves vertical movement. Transparent grayscale frames for tinting.'}
(out/'blob-down.json').write_text(json.dumps(meta,indent=2)+'\n')
(out/'phaser-example.js').write_text('''// preload\nthis.load.spritesheet('blob-down', 'blob-down-spritesheet.png', {\n  frameWidth: 256, frameHeight: 256\n});\n\n// create\nthis.anims.create({\n  key: 'blob-walk-down',\n  frames: this.anims.generateFrameNumbers('blob-down', { start: 0, end: 23 }),\n  frameRate: 12,\n  repeat: -1\n});\nconst blob = this.add.sprite(x, y, 'blob-down')\n  .setOrigin(0.5, 0.9652777778)\n  .setTint(0x6486ff)\n  .play('blob-walk-down');\n''')
print('Created 24 transparent frames, 2048x768 sheet, animated previews and metadata.')
print('Alpha extrema:',frames[0].getchannel('A').getextrema())
