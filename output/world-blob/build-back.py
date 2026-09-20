from pathlib import Path
import numpy as np
from PIL import Image
root=Path('apps/world/public/assets/avatars/blob')
edit=Image.open('/Users/stephane/.codex/generated_images/01a0bfcb-0ac9-7672-bac9-03331986b056/exec-24305b73-c2c7-4406-bc93-cde080c7c186.png').convert('RGB').resize((2048,768))
def remove_eyes(original,patch):
 a=np.array(original);p=np.asarray(patch);dark=(a[:,:,:3].max(2)<100)&(a[:,:,3]>200)
 seen=np.zeros((256,256),bool);eyes=[]
 for y,x in zip(*np.where(dark)):
  if seen[y,x]:continue
  todo=[(y,x)];seen[y,x]=1;pts=[]
  while todo:
   yy,xx=todo.pop();pts.append((yy,xx))
   for Y,X in ((yy-1,xx),(yy+1,xx),(yy,xx-1),(yy,xx+1)):
    if 0<=Y<256 and 0<=X<256 and dark[Y,X] and not seen[Y,X]:seen[Y,X]=1;todo.append((Y,X))
  if len(pts)>50:
   q=np.array(pts);y0,x0=q.min(0);y1,x1=q.max(0)+1
   if x1-x0<35 and y1-y0<65 and 70<x0<170:eyes.append((x0,y0,x1,y1))
 assert len(eyes)==2,eyes
 for x0,y0,x1,y1 in eyes:
  x0-=3;y0-=3;x1+=3;y1+=3
  replacement=p[y0:y1,x0:x1]
  white=replacement[replacement.min(axis=2)>235]
  assert len(white)>20
  ring=a[max(0,y0-3):min(256,y1+3),max(0,x0-3):min(256,x1+3),:3]
  body=ring[ring.min(axis=2)>230]
  fill=np.median(body,axis=0).astype("uint8")
  a[y0:y1,x0:x1,:3]=fill
 assert np.array_equal(a[:,:,3],np.asarray(original)[:,:,3])
 return Image.fromarray(a)
down=Image.open(root/'down.png').convert('RGBA');up=down.copy();previews=[]
for i in range(24):
 x,y=i%8*256,i//8*256;box=(x,y,x+256,y+256)
 frame=remove_eyes(down.crop(box),edit.crop(box));up.paste(frame,(x,y))
 bg=Image.new('RGB',(256,256),'#dce4ec');bg.paste(frame,mask=frame.getchannel('A'));previews.append(bg)
up.save(root/'up.png',optimize=True)
# The generated blank-body center also covers the idle eye positions.
idle=Image.open(root/'idle-down.png').convert('RGBA')
blank=Image.new('RGB',(256,256),(250,250,250))
# Use the generated body's white fill for the idle patch, too.
color=tuple(int(v) for v in np.median(np.asarray(edit.crop((100,185,155,210))).reshape(-1,3),axis=0))
blank.paste(color,(0,0,256,256))
remove_eyes(idle,blank).save(root/'idle-up.png',optimize=True)
previews[0].save('output/world-blob/back-preview.gif',save_all=True,append_images=previews[1:],duration=[40,40,40,40,40,50]*4,loop=0,disposal=2)
print('24 back frames and idle exported; original alpha preserved exactly.')
