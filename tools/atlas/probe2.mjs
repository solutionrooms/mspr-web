import { PNG } from 'pngjs';
import fs from 'fs';
function bbox(path){
  const png = PNG.sync.read(fs.readFileSync(path));
  const {width:W,height:H,data}=png;
  let minX=W,minY=H,maxX=-1,maxY=-1;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if(data[(y*W+x)*4+3]>0){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
  }
  return {W,H,minX,minY,maxX,maxY,cw:maxX-minX+1,ch:maxY-minY+1};
}
for(const [name,dir,n] of [
  ['fx_nitro','tools/atlas/work/sprites/DefineSprite_1233_fx_nitro_fx_nitro',5],
  ['flames','tools/atlas/work/sprites/DefineSprite_1219_flames_flames',99],
  ['TurboPickup','tools/atlas/work/sprites/DefineSprite_1222_TurboPickup_TurboPickup',99],
]){
  if(!fs.existsSync(dir)){console.log(name,'(missing)');continue;}
  const files=fs.readdirSync(dir).filter(f=>f.endsWith('.png')).sort((a,b)=>parseInt(a)-parseInt(b));
  for(const f of files.slice(0,n)){
    const b=bbox(`${dir}/${f}`);
    console.log(`${name}/${f}: canvas ${b.W}x${b.H} content ${b.cw}x${b.ch} @(${b.minX},${b.minY})`);
  }
}
