from pathlib import Path
from collections import deque
import subprocess,json,shutil
import numpy as np
from PIL import Image,ImageFilter
out=Path('apps/world/public/assets/avatars/blob')
source='/Users/stephane/Downloads/magnific_animate-this-exact-white-_P3VWhu742C.mp4'
raw=subprocess.check_output(['ffmpeg','-v','error','-i',source,'-f','rawvideo','-pix_fmt','rgb24','-'])
video=np.frombuffer(raw,np.uint8).reshape(-1,768,768,3)
def cut(i):
 rgb=video[i].astype(float)
 # Green dominance separates the flat key background from the neutral sprite.
 spill=rgb[:,:,1]-np.maximum(rgb[:,:,0],rgb[:,:,2])
 alpha=np.clip((90-spill)/65,0,1)
 gray=((rgb[:,:,0]+rgb[:,:,2])/2).clip(0,255)
 rgba=np.stack([gray,gray,gray,alpha*255],axis=-1).astype('uint8')
 rgba[alpha==0]=0
 return Image.fromarray(rgba).crop((96,32,672,608)).resize((256,256),Image.Resampling.LANCZOS)
indices=[16+int(i*36/24) for i in range(24)]
frames=[cut(i) for i in indices]
sheet=Image.new('RGBA',(2048,768))
for i,f in enumerate(frames):sheet.paste(f,((i%8)*256,(i//8)*256))
sheet.save(out/'down.png',optimize=True)
idle=cut(8);idle.save(out/'idle-down.png',optimize=True)
# Tight thumbnail is independent of the shared animation anchor.
b=idle.getchannel('A').getbbox();idle.crop(b).save(out/'thumbnail.png',optimize=True)
right=Path('output/world-blob/right/final')
shutil.copy2(right/'blob-right-spritesheet.png',out/'right.png')
r=Image.open(right/'frames/blob-right-01.png').convert('RGBA');bbox=r.getchannel('A').getbbox()
ri=Image.new('RGBA',(256,256));ri.paste(r,(0,249-bbox[3]));ri.save(out/'idle-right.png',optimize=True)
preview=[]
for f in frames:
 bg=Image.new('RGB',f.size,'#dce4ec');bg.paste(f,mask=f.getchannel('A'));preview.append(bg)
preview[0].save('output/world-blob/user-front-preview.gif',save_all=True,append_images=preview[1:],duration=[80,80,90]*8,loop=0,disposal=2)
(out/'provenance.json').write_text(json.dumps({'frameWidth':256,'frameHeight':256,'frames':24,'frameRate':12,'down':{'source':Path(source).name,'sourceFrames':indices,'crop':[96,32,672,608],'originY':550/576},'right':{'source':'MiniMax Hailuo 2.3 v3, six poses corrected with imagegen','sourceFrames':list(range(12,36)),'originY':218/224,'cropFrom256Frame':[16,16,240,240]},'left':'Mirror right; up temporarily uses down'},indent=2)+'\n')
print('Exported down/right sheets and idle textures.')
