import { PNG } from 'pngjs';
import fs from 'fs';
function bbox(path){
  const png = PNG.sync.read(fs.readFileSync(path));
  const {width:W,height:H,data}=png;
  let minX=W,minY=H,maxX=-1,maxY=-1;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const a=data[(y*W+x)*4+3];
    if(a>0){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
  }
  return {W,H,minX,minY,maxX,maxY,cw:maxX-minX+1,ch:maxY-minY+1};
}
const offs=JSON.parse(fs.readFileSync('data/caroffsets.json'));
const dir='tools/atlas/work/sprites/DefineSprite_1030_Cars_Cars';
for(let i=0;i<12;i++){
  const b=bbox(`${dir}/${i+1}.png`);
  const o=offs[i];
  console.log(`f${i}: canvas ${b.W}x${b.H} content ${b.cw}x${b.ch} @(${b.minX},${b.minY})  | caroffsets w=${o.width} xoff=${o.xoff} yoff=${o.yoff} xoffxf=${o.xoffxf}`);
}
