import {execFileSync} from 'node:child_process'
import {mkdir,readdir,readFile,writeFile,rm} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import sharp from 'sharp'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const id=process.argv[2]
if(!['duck','fish','butterfly','bird'].includes(id))throw Error('Expected duck, fish, butterfly or bird')
const dir=resolve(root,'art-workbench/experiments/ambient-fauna-v1',id)
const config=JSON.parse(await readFile(resolve(dir,'config.json')))
const count=config.duration*12
for(const name of ['frames','masks']){
 const output=resolve(dir,name);await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true})
 execFileSync('ffmpeg',['-v','error','-i',resolve(dir,name==='frames'?'input.mp4':'mask.mp4'),'-vf','fps=12','-frames:v',String(count),'-y',resolve(output,'%03d.png')])
}
const files=(await readdir(resolve(dir,'frames'))).filter(x=>x.endsWith('.png')).sort()
const masks=(await readdir(resolve(dir,'masks'))).filter(x=>x.endsWith('.png')).sort()
if(files.length!==count||masks.length!==count)throw Error('Unaligned frame count')
const {width,height}=await sharp(resolve(dir,'frames',files[0])).metadata()
let left=width,top=height,right=0,bottom=0
const alphaFrames=[]
for(const file of masks){
 const {data,info}=await sharp(resolve(dir,'masks',file)).greyscale().raw().toBuffer({resolveWithObject:true})
 if(info.width!==width||info.height!==height||info.channels!==1)throw Error('Mask dimensions mismatch')
 let area=0
 for(let i=0;i<data.length;i++){
 data[i]=data[i]>127?255:0;if(!data[i])continue
 const x=i%width,y=Math.floor(i/width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);area++
 }
 if(area<80||area>width*height*.9)throw Error('Unexpected segmentation area')
 alphaFrames.push(data)
}
left=Math.max(0,left-3);top=Math.max(0,top-3);right=Math.min(width-1,right+3);bottom=Math.min(height-1,bottom+3)
const size={duck:192,fish:128,butterfly:144,bird:160}[id],cell=size+4,cols=Math.floor(2048/cell)
const rows=Math.ceil(count/cols),atlasWidth=cols*cell,atlasHeight=rows*cell
if(atlasHeight>2048)throw Error('Atlas too large')
const frames={},composites=[]
for(let i=0;i<count;i++){
 const rgb=await sharp(resolve(dir,'frames',files[i])).removeAlpha().raw().toBuffer()
 const alpha=await sharp(alphaFrames[i],{raw:{width,height,channels:1}}).blur(.5).greyscale().raw().toBuffer()
 const rgba=await sharp(rgb,{raw:{width,height,channels:3}}).joinChannel(alpha,{raw:{width,height,channels:1}}).png().toBuffer()
 const sprite=await sharp(rgba).extract({left,top,width:right-left+1,height:bottom-top+1}).resize(size,size,{fit:'contain',background:'#00000000'}).png().toBuffer()
 const x=i%cols*cell+2,y=Math.floor(i/cols)*cell+2
 composites.push({input:sprite,left:x,top:y})
 frames[`${id}-${String(i).padStart(3,'0')}`]={frame:{x,y,w:size,h:size},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:size,h:size},sourceSize:{w:size,h:size}}
 if([0,Math.floor(count/2),count-1].includes(i))await sharp(sprite).flatten({background:'#59bdd5'}).png().toFile(resolve(dir,`preview-${i}.png`))
}
const output=resolve(root,'public/assets/ambience');await mkdir(output,{recursive:true})
await sharp({create:{width:atlasWidth,height:atlasHeight,channels:4,background:'#00000000'}}).composite(composites).webp({quality:92,alphaQuality:100}).toFile(resolve(output,`${id}.webp`))
await writeFile(resolve(output,`${id}.json`),JSON.stringify({frames,meta:{image:`${id}.webp`,size:{w:atlasWidth,h:atlasHeight},scale:'1'}}))
await writeFile(resolve(dir,'atlas-result.json'),JSON.stringify({id,frames:count,size,atlasWidth,atlasHeight,crop:{left,top,right,bottom}},null,2))
console.log(id,count,'transparent frames',atlasWidth,atlasHeight)
