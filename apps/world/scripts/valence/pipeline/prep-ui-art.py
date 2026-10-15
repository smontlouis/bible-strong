import os, cv2, numpy as np
from PIL import Image
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..','..'))
PUB=os.path.join(ROOT,'public','valence-1876')
def key_out(img, tol):
    """Flood-fill the background from every border pixel; returns alpha."""
    h,w=img.shape[:2]
    lab=cv2.cvtColor(img,cv2.COLOR_BGR2LAB).astype(np.int16)
    border=np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])
    bg=np.median(border,axis=0)
    dist=np.sqrt(((lab-bg)**2).sum(-1))
    cand=(dist<tol).astype(np.uint8)
    mask=np.zeros((h+2,w+2),np.uint8)
    flood=cand.copy()
    seeds=[(x,0) for x in range(0,w,4)]+[(x,h-1) for x in range(0,w,4)]+[(0,y) for y in range(0,h,4)]+[(w-1,y) for y in range(0,h,4)]
    bgmask=np.zeros((h,w),np.uint8)
    num,labels=cv2.connectedComponents(cand)
    touching=set(labels[y,x] for x,y in seeds if cand[y,x])
    for t in touching: bgmask[labels==t]=1
    alpha=(1-bgmask)*255
    # soften: pixels near bg color at the boundary get partial alpha
    edge=cv2.dilate(bgmask,np.ones((3,3),np.uint8))-bgmask
    soft=np.clip((dist-tol*0.6)/(tol*0.4),0,1)
    alpha=np.where(edge>0,(soft*255).astype(np.uint8),alpha).astype(np.uint8)
    alpha=cv2.GaussianBlur(alpha,(3,3),0.6)
    return alpha
def save(img, alpha, path, size):
    rgba=np.dstack([cv2.cvtColor(img,cv2.COLOR_BGR2RGB),alpha])
    ys,xs=np.nonzero(alpha>10)
    y0,y1,x0,x1=ys.min(),ys.max()+1,xs.min(),xs.max()+1
    pad=int(max(y1-y0,x1-x0)*0.04)
    crop=rgba[max(0,y0-pad):y1+pad,max(0,x0-pad):x1+pad]
    im=Image.fromarray(crop)
    side=max(im.size); canvas=Image.new('RGBA',(side,side),(0,0,0,0)); canvas.paste(im,((side-im.width)//2,(side-im.height)//2))
    canvas.resize((size,size),Image.LANCZOS).save(path,'WEBP',quality=92,method=6)
os.makedirs(os.path.join(PUB,'objects'),exist_ok=True)
for name in ['ostervald','signes','concordance','bost','sander','lampe','lettre']:
    img=cv2.imread(f'objects-art/{name}.png')
    a=key_out(img,70)
    save(img,a,os.path.join(PUB,'objects',f'{name}.webp'),256)
    save(img,a,f'objects-art/{name}-cut.png',512)
# Portraits: head and shoulders from the character sheet.
os.makedirs(os.path.join(PUB,'portraits'),exist_ok=True)
sheet=cv2.imread('characters/style-sheet-v1.png')
h,w=sheet.shape[:2]
alpha=key_out(sheet,22)
cols={'bourdeau':(0.0,0.135),'marion':(0.13,0.26),'elise':(0.26,0.37),'jeanne':(0.37,0.495),'jacques':(0.495,0.615),'pastor':(0.625,0.745),'peddler':(0.745,0.885),'employee':(0.885,1.0)}
for name,(a0,a1) in cols.items():
    x0,x1=int(a0*w),int(a1*w)
    sub=alpha[:,x0:x1]
    ys,xs=np.nonzero(sub>40)
    top=ys.min()
    cx=x0+int(np.median(xs[ys<top+int(h*0.18)]))
    side=int(h*0.36)
    y0=max(0,top-int(side*0.06)); X0=max(0,cx-side//2)
    img=sheet[y0:y0+side,X0:X0+side]; al=alpha[y0:y0+side,X0:X0+side].copy()
    # keep only the character at the centre of the crop
    n,lab=cv2.connectedComponents((al>40).astype(np.uint8))
    centre=lab[:, al.shape[1]//2-6:al.shape[1]//2+6]
    keep=set(np.unique(centre))-{0}
    al=np.where(np.isin(lab,list(keep)),al,0).astype(np.uint8)
    # fade the bottom edge so the bust ends softly
    ramp=np.clip((side-np.arange(al.shape[0]))/(side*0.18),0,1)[:,None]
    al=(al*ramp).astype(np.uint8)
    Image.fromarray(np.dstack([cv2.cvtColor(img,cv2.COLOR_BGR2RGB),al])).resize((240,240),Image.LANCZOS).save(os.path.join(PUB,'portraits',f'{name}.webp'),'WEBP',quality=92,method=6)
crier=cv2.imread('characters/crier.png'); ca=key_out(crier,22)
ys,xs=np.nonzero(ca>40); top=ys.min(); hh=ys.max()-top; cx=int(np.median(xs[ys<top+hh*0.2])); side=int(hh*0.5)
y0=max(0,top-int(side*0.06)); X0=max(0,cx-side//2)
img=crier[y0:y0+side,X0:X0+side]; al=ca[y0:y0+side,X0:X0+side].copy()
ramp=np.clip((side-np.arange(al.shape[0]))/(side*0.18),0,1)[:,None]; al=(al*ramp).astype(np.uint8)
Image.fromarray(np.dstack([cv2.cvtColor(img,cv2.COLOR_BGR2RGB),al])).resize((240,240),Image.LANCZOS).save(os.path.join(PUB,'portraits','crier.webp'),'WEBP',quality=92,method=6)
print('ok')
