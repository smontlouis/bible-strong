import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const root = resolve(import.meta.dirname, '..')
const work = resolve(root, 'art-workbench/experiments/ambient-cat-tile-v1')
const output = resolve(root, 'public/assets/ambience/cat-tile')
await mkdir(output, {recursive:true})
const count=120
const meta=await sharp(resolve(work,'frames/001.png')).metadata()
const vw=meta.width,vh=meta.height
const masks=[]
let left=vw,top=vh,right=0,bottom=0
for(let f=1;f<=count;f++){
 const mask=await sharp(resolve(work,`masks/${String(f).padStart(3,'0')}.png`)).greyscale().raw().toBuffer()
 if(mask.length!==vw*vh)throw Error('Mask and video dimensions differ')
 let area=0
 for(let i=0;i<mask.length;i++){
  const x=i%vw,y=Math.floor(i/vw)
  mask[i]=mask[i]>127?255:0
  if(!mask[i])continue
  if(x<vw*.70||x>vw*.89||y<vh*.47||y>vh*.61)throw Error('Cat mask escaped bench region')
  left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);area++
 }
 if(area<250||area>vw*vh*.035)throw Error(`Unexpected cat mask area ${area}`)
 masks.push(mask)
}
left-=8;top-=8;right+=8;bottom+=8
const sw=right-left+1,sh=bottom-top+1
const fw=Math.round(sw*516/vw),fh=Math.round(sh*516/vh)
const sprites=[]
for(let f=0;f<count;f++){
 const alpha=await sharp(masks[f],{raw:{width:vw,height:vh,channels:1}}).blur(.5).greyscale().raw().toBuffer()
 const rgb=await sharp(resolve(work,`frames/${String(f+1).padStart(3,'0')}.png`)).removeAlpha().raw().toBuffer()
 const rgba=Buffer.alloc(vw*vh*4)
 for(let i=0;i<vw*vh;i++){rgba[i*4]=rgb[i*3];rgba[i*4+1]=rgb[i*3+1];rgba[i*4+2]=rgb[i*3+2];rgba[i*4+3]=alpha[i]}
 const frame=await sharp(rgba,{raw:{width:vw,height:vh,channels:4}}).extract({left,top,width:sw,height:sh}).resize(fw,fh).raw().toBuffer()
 for(let y=0;y<fh;y++)for(let x=0;x<fw;x++)if(x<2||y<2||x>=fw-2||y>=fh-2)frame[(y*fw+x)*4+3]=0
 sprites.push(frame)
}
for(let f=114;f<120;f++){
 const t=(f-113)/6
 for(let i=0;i<sprites[f].length;i++)sprites[f][i]=Math.round(sprites[f][i]*(1-t)+sprites[0][i]*t)
}
const cw=fw+4,ch=fh+4,cols=Math.min(12,Math.floor(2048/cw)),width=cols*cw,height=Math.ceil(count/cols)*ch
if(height>2048)throw Error('Atlas too tall')
const frames={},composites=[]
for(let f=0;f<count;f++){
 const input=await sharp(sprites[f],{raw:{width:fw,height:fh,channels:4}}).png().toBuffer()
 const x=f%cols*cw+2,y=Math.floor(f/cols)*ch+2
 composites.push({input,left:x,top:y})
 frames[`ambient-${f}`]={frame:{x,y,w:fw,h:fh},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:fw,h:fh},sourceSize:{w:fw,h:fh}}
 if([0,30,60,90,119].includes(f))await writeFile(resolve(work,`cutout-${f}.png`),input)
}
await sharp({create:{width,height,channels:4,background:'#00000000'}}).composite(composites).webp({lossless:true}).toFile(resolve(output,'atlas.webp'))
await writeFile(resolve(output,'atlas.json'),JSON.stringify({frames,meta:{image:'atlas.webp',size:{w:width,h:height}}}))
const manifest={id:'cat-tile',x:511+left/vw*258,y:255+top/vh*258,width:sw/vw*258,height:sh/vh*258,frameCount:count,frameRate:12,sourceTile:'2/2-1',depth:405.1}
await writeFile(resolve(root,'src/generated/cat-tile.json'),JSON.stringify(manifest,null,2)+'\n')
console.log(JSON.stringify({manifest,atlas:{width,height},sourceCrop:{left,top,sw,sh,vw,vh}}))
