import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createSimulation } from './simulation.js';
import { PLAYER_SKINS } from '../../src/render/player-skins.js';
import { ORGANISM_SPRITE_SHEETS } from '../../src/render/organism-sprites.js';
import { BACILLUS_FRAMES } from './bacillus-frames.js';
import { MICROBE_MOTION_PROFILES, ROAMING_ORGANISM_SPRITE_SIZES } from '../../src/procgen/microbe-ecology.js';

// Presentation only. All collisions, inoculation and ecology run in the original simulator.
// Decorative roots never create colliders; native platform coordinates stay in pixels.
const $ = s => document.querySelector(s);
const P = 100;
let seed = 420031;
function random() { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; }
const loading = $('#loading');
const flags = { shadows:true, normals:true, parallax:true, particles:true, cinematic:true, paused:false, high:true };
const keys = {};
const metrics = { frameMs:[], ready:false, errors:[], renderer:'Three.js r186 / WebGL2', assetFiles:[], adapter:'original createSimulator / phase 4' };
window.addEventListener('error', e => metrics.errors.push(e.message));
window.addEventListener('unhandledrejection', e => { metrics.errors.push(String(e.reason)); loading.hidden=false; loading.textContent='Não foi possível abrir a cena. Consulte o console: '+e.reason; });

async function boot() {
  const simulation = createSimulation();
  let snapshot = simulation.snapshot();
  const origin = { x:snapshot.player.x / P, y:-snapshot.player.y / P };
  const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.setClearColor(0x071719);
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.15;
  $('#stage').appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog=new THREE.FogExp2(0x0c2324,.025);
  const camera=new THREE.PerspectiveCamera(36,1,.1,120);
  let viewX=origin.x+2.0, viewY=origin.y+1.9;
  const ambient=new THREE.HemisphereLight(0xc6dfc4,0x1d2530,1.5); scene.add(ambient);
  const key=new THREE.DirectionalLight(0xffd2a0,3.2);key.position.set(origin.x-4,origin.y+9,9);key.target.position.set(origin.x+2,origin.y,0);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-15,right:15,top:12,bottom:-12,near:1,far:45});key.shadow.bias=-.0004;key.shadow.normalBias=.025;
  scene.add(key,key.target);
  const cyan=new THREE.PointLight(0x75f6de,38,14,1.5);scene.add(cyan);
  const amber=new THREE.PointLight(0xffbc65,22,12,1.5);scene.add(amber);
  const playerLight=new THREE.PointLight(0xffe6b5,2.8,4,1.5);scene.add(playerLight);
  const composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  const bloom=new UnrealBloomPass(new THREE.Vector2(1280,720),.36,.6,1.06);composer.addPass(bloom);composer.addPass(new OutputPass());
  const loader=new THREE.TextureLoader();
  const standardMaterials=[];
  function normalTexture() {
    const n=128,h=new Float32Array(n*n),data=new Uint8Array(n*n*4);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++)h[y*n+x]=Math.sin(x*.31+Math.sin(y*.13)*2)*.5+Math.sin(x*.95+y*.17)*.14+Math.sin(y*.43)*.2+random()*.1;
    for(let y=0;y<n;y++)for(let x=0;x<n;x++) { const i=(y*n+x)*4;const a=h[y*n+(x+1)%n]-h[y*n+(x+n-1)%n],b=h[((y+1)%n)*n+x]-h[((y+n-1)%n)*n+x];const v=new THREE.Vector3(-a*1.8,-b*1.8,1).normalize();data[i]=(v.x*.5+.5)*255;data[i+1]=(v.y*.5+.5)*255;data[i+2]=(v.z*.5+.5)*255;data[i+3]=255; }
    const t=new THREE.DataTexture(data,n,n);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(3,1);t.needsUpdate=true;return t;
  }
  const normal=normalTexture();
  function barkTexture() {const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#b1a48e';ctx.fillRect(0,0,256,256);for(let i=0;i<2500;i++){const a=random();ctx.fillStyle=`rgba(${a>.5?'235,223,188':'62,65,48'},${random()*.04})`;ctx.fillRect(random()*256,random()*256,.3+random()*1.5,2+random()*16);}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(3,1);return t;}
  const bark=barkTexture();
  function mat(color,extra={}) {const m=new THREE.MeshStandardMaterial({color,roughness:.88,normalMap:normal,normalScale:new THREE.Vector2(.22,.22),...extra});m.userData.originalNormalScale=m.normalScale.clone();standardMaterials.push(m);return m;}
  const rootMat=mat(0xbba681,{map:bark,roughness:.58});
  const earthMat=mat(0x566957,{map:bark});
  const platformMat=mat(0x9c9c79,{map:bark,roughness:.67});
  const mossMat=mat(0x679875,{roughness:1});
  const rear=new THREE.Mesh(new THREE.PlaneGeometry(180,90),mat(0x143334,{roughness:1,normalScale:new THREE.Vector2(.3,.3)}));rear.position.set(origin.x,origin.y,-4);rear.receiveShadow=true;scene.add(rear);
  const background=await loader.loadAsync(new URL('../../assets/backgrounds/miguelito-rhizosphere.png',import.meta.url).href);background.colorSpace=THREE.SRGBColorSpace;
  const backPlane=new THREE.Mesh(new THREE.PlaneGeometry(84,15.8),new THREE.MeshStandardMaterial({map:background,color:0xa3cbc5,emissive:0x6a9b94,emissiveMap:background,emissiveIntensity:.55,transparent:true,opacity:.9,roughness:1}));backPlane.position.set(origin.x+6,origin.y+2,-3.8);backPlane.receiveShadow=true;scene.add(backPlane);

  const rootGroup=new THREE.Group();scene.add(rootGroup);const growing=[];
  const tubeCache=new THREE.SphereGeometry(1,12,9);
  function tube(points,radius,material,grow=false) {const curve=new THREE.CatmullRomCurve3(points.map(v=>new THREE.Vector3(...v))),segments=Math.max(12,points.length*8);const geo=new THREE.TubeGeometry(curve,segments,radius,7,false);const pos=geo.attributes.position;for(let ring=0;ring<=segments;ring++){const t=ring/segments,center=curve.getPointAt(t),taper=(1-t*.87)*(1+Math.sin(t*39)*.025);for(let v=0;v<=7;v++){const i=ring*8+v;pos.setXYZ(i,center.x+(pos.getX(i)-center.x)*taper,center.y+(pos.getY(i)-center.y)*taper,center.z+(pos.getZ(i)-center.z)*taper);}}geo.computeVertexNormals();const obj=new THREE.Mesh(geo,material);obj.castShadow=obj.receiveShadow=true;rootGroup.add(obj);if(grow)growing.push({obj,count:geo.index.count,delay:random()*2});return obj;}
  // Visual architecture, grown by drawRange: it never enters the simulation's collision arrays.
  for(let side=0;side<2;side++)for(let i=0;i<5;i++) {
    const x=origin.x+(side?9:-6)+i*.8;
    const y=origin.y+10+random()*2;
    const pts=[[x,y,-.8],[x+Math.sin(i)*.6,y-2,-.4],[x+(side?-1:1)*1.1,y-5,.05],[x+(side?-2.0:1.4),origin.y-1.2,.35],[x+(side?-3.6:3),origin.y-3.5,.15]];
    tube(pts,.13+random()*.24,rootMat,true);
    for(let j=0;j<3;j++){const pt=pts[j+1];const s=side?-1:1;tube([pt,[pt[0]+s*.5,pt[1]-.5,pt[2]+.1],[pt[0]+s*(1.3+random()),pt[1]-1.5,pt[2]+.15],[pt[0]+s*2.4,pt[1]-2.3,pt[2]+.1]],.035+random()*.045,rootMat,true);}
  }
  // Rear strata and foreground roots form physically separated layers, plus camera-relative parallax.
  const foreground=new THREE.Group();scene.add(foreground);
  for(let i=0;i<20;i++){const rock=new THREE.Mesh(tubeCache,earthMat);rock.position.set(origin.x-13+i*1.45,origin.y-3.3+random()*.6,1+random()*1.3);rock.scale.set(1.5,.7+random()*.9,.5+random());rock.rotation.z=random();rock.receiveShadow=rock.castShadow=true;foreground.add(rock);}
  const platformMeshes=new Map();
  function syncPlatforms(items) {
    const active=new Set();
    items.forEach((p,i)=>{
      if(p.active===false||p.recovery||p.mycorrhizaStructure||!Number.isFinite(p.x)||!p.w)return;
      if(Math.abs(p.x/P-viewX)>22)return;
      const id=p.id??i;active.add(id);let g=platformMeshes.get(id);
      if(!g) {
        g=new THREE.Group();const shape=new THREE.Shape();shape.moveTo(-.5,.48);shape.lineTo(.5,.48);shape.quadraticCurveTo(.52,-.07,.38,-.28);shape.bezierCurveTo(.15,-.57,-.17,-.59,-.37,-.35);shape.quadraticCurveTo(-.53,-.14,-.5,.48);const rockGeometry=new THREE.ExtrudeGeometry(shape,{depth:1,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.025,bevelThickness:.04});rockGeometry.translate(0,0,-.5);const block=new THREE.Mesh(rockGeometry,platformMat);block.castShadow=block.receiveShadow=true;g.add(block);
        const lip=new THREE.Mesh(new THREE.BoxGeometry(1,.055,1),mossMat);lip.castShadow=lip.receiveShadow=true;g.add(lip);scene.add(g);platformMeshes.set(id,g);
        for(let j=0;j<7;j++){const pebble=new THREE.Mesh(tubeCache,j%3===0?mossMat:rootMat);pebble.position.set((j/7-.45),-.02,.1+random()*.3);pebble.scale.set(.06,.035,.07);g.add(pebble);}
      }
      const w=p.w/P,h=Math.max(.15,(p.h||24)/P);g.position.set((p.x+p.w/2)/P,-p.y/P-h/2,.55);g.children[0].scale.set(w,h,.8);g.children[1].scale.set(w,1,.85);g.children[1].position.y=h/2;
      for(let j=2;j<g.children.length;j++){g.children[j].position.x=((j-2)/7-.43)*w;g.children[j].position.y=h/2+.01;}
      g.visible=true;
    });
    for(const [id,g] of platformMeshes)g.visible=active.has(id);
  }

  // Atlas re-packing copies source pixels 1:1. 7680 px sheets become 2560x1200,
  // below the 4096 texture limit on older mobile GPUs, without redrawing the art.
  async function sheet(path,frames) {
    metrics.assetFiles.push(path);
    const image=new Image();image.src=new URL('../../'+path,import.meta.url).href;await image.decode();
    const fw=image.naturalWidth/frames,fh=image.naturalHeight,columns=Math.max(1,Math.min(8,frames,Math.floor(renderer.capabilities.maxTextureSize/fw))),rows=Math.ceil(frames/columns);
    const c=document.createElement('canvas');c.width=columns*fw;c.height=rows*fh;const ctx=c.getContext('2d');
    for(let f=0;f<frames;f++)ctx.drawImage(image,f*fw,0,fw,fh,(f%columns)*fw,Math.floor(f/columns)*fh,fw,fh);
    if(Math.max(c.width,c.height)>renderer.capabilities.maxTextureSize)throw new Error('Atlas maior que MAX_TEXTURE_SIZE');
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.repeat.set(1/columns,1/rows);tex.minFilter=THREE.LinearMipmapLinearFilter;tex.magFilter=THREE.LinearFilter;tex.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
    return {tex,columns,rows,frames};
  }
  const playerSheets={};const microbeSheets={};
  await Promise.all(Object.entries(PLAYER_SKINS.miguelito.states).filter(([s])=>s!=='defeat').map(async([s,d])=>playerSheets[s]={...await sheet(d.src,d.frames),...d}));
  await Promise.all(Object.entries(ORGANISM_SPRITE_SHEETS).map(async([s,d])=>microbeSheets[s]={...await sheet(d.src,d.frameCount),...d}));
  const bacillusImage=new Image();bacillusImage.src=new URL('../../assets/bacillus/bacillus.png',import.meta.url).href;await bacillusImage.decode();metrics.assetFiles.push('assets/bacillus/bacillus.png');
  const bc=document.createElement('canvas');bc.width=640;bc.height=624;const bctx=bc.getContext('2d');BACILLUS_FRAMES.forEach((f,i)=>bctx.drawImage(bacillusImage,f.x,0,f.w,104,(i%8)*80+(80-f.w)/2,Math.floor(i/8)*104,f.w,104));
  const bt=new THREE.CanvasTexture(bc);bt.colorSpace=THREE.SRGBColorSpace;bt.repeat.set(1/8,1/6);microbeSheets.bacillus={tex:bt,columns:8,rows:6,frames:44,fps:12.5,height:58,aspect:80/104};
  const planeGeo=new THREE.PlaneGeometry(1,1);
  function sprite(s) {const texture=s.tex.clone();const material=new THREE.MeshStandardMaterial({map:texture,color:0xc0c0c0,transparent:false,alphaTest:.12,roughness:1,side:THREE.DoubleSide,emissive:0xffffff,emissiveMap:texture,emissiveIntensity:.25});const mesh=new THREE.Mesh(planeGeo,material);mesh.castShadow=mesh.receiveShadow=true;scene.add(mesh);return mesh;}
  const hero=sprite(playerSheets.idle);let heroState='idle',heroDefeat=false,animPhase=0;
  const microbes=new Map();
  function frame(sheet,index){const f=((index%sheet.frames)+sheet.frames)%sheet.frames;sheet.tex.offset.set((f%sheet.columns)/sheet.columns,1-(Math.floor(f/sheet.columns)+1)/sheet.rows);}
  function syncSprites(s,dt) {
    const p=s.player;
    let state=p.invuln>0?'hurt':Math.abs(p.vx)>12||!p.onGround?'run':'idle';
    const defeat=!p.alive||s.gameState==='respawning';if(defeat)state='hurt';
    if(s.gameState==='transition'||s.gameState==='end')state='celebrate';
    if(state!==heroState||defeat!==heroDefeat){animPhase=0;heroState=state;heroDefeat=defeat;}
    const sh=playerSheets[state];const rate=sh.speedFromMotion?Math.min(sh.fps,sh.motionBase+Math.abs(p.vx)*sh.motionFactor):sh.fps;
    animPhase+=dt*(defeat?24:rate);frame(sh,defeat?Math.min(4,Math.floor(animPhase)):sh.loop===false?Math.min(7,Math.floor(animPhase)):Math.floor(animPhase));hero.material.map=hero.material.emissiveMap=sh.tex;
    const height=PLAYER_SKINS.miguelito.characterHeight/P*400/sh.contentHeight;
    const sign=(p.facing<0||p.dir<0)?-1:1;hero.scale.set(height*.8*sign,height,1);
    hero.position.set((p.x+(p.w||32)/2)/P,-(p.y+(p.h||48)+2)/P+(sh.baseline-.5)*height,1.13);
    playerLight.position.copy(hero.position).add(new THREE.Vector3(.15,.3,.6));
    const seen=new Set();
    s.microbes.forEach((m,i)=>{const type=m.type==='myco'?'micorriza':m.type;if(!microbeSheets[type])return;const id=m.id??i;seen.add(id);let obj=microbes.get(id);if(!obj){obj=sprite(microbeSheets[type]);microbes.set(id,obj);}const sh=microbeSheets[type],f=Math.floor(s.time*sh.fps+Math.abs(m.phase||0)*3.7);frame({...sh,tex:obj.material.map},f);const base=(ROAMING_ORGANISM_SPRITE_SIZES[m.type]||sh.height)*(m.size||1)*(MICROBE_MOTION_PROFILES[m.type]?.scale||1)/P;let h=base,w=h*.8;if(type==='bacillus'){const rect=BACILLUS_FRAMES[f%44];h=base*104/rect.w;w=base*80/rect.w;}obj.scale.set(w*(m.facing<0?-1:1),h,1);obj.position.set(m.x/P,-m.y/P,1.04);obj.visible=Math.abs(m.x/P-viewX)<18;});
    for(const [id,obj] of microbes)obj.visible=seen.has(id)&&Math.abs(obj.position.x-viewX)<18;
  }

  const hyphaPositions=new Float32Array(100000*3);const hyphaGeo=new THREE.BufferGeometry();hyphaGeo.setAttribute('position',new THREE.BufferAttribute(hyphaPositions,3).setUsage(THREE.DynamicDrawUsage));hyphaGeo.setDrawRange(0,0);
  const hyphaMat=new THREE.LineBasicMaterial({color:0xd8afff,transparent:true,opacity:.95,toneMapped:false});
  const hypha=new THREE.LineSegments(hyphaGeo,hyphaMat);hypha.frustumCulled=false;scene.add(hypha);
  const bridgeData=new Float32Array(3000*3),bridgeGeo=new THREE.BufferGeometry();bridgeGeo.setAttribute('position',new THREE.BufferAttribute(bridgeData,3).setUsage(THREE.DynamicDrawUsage));bridgeGeo.setDrawRange(0,0);const bridgeMat=mat(0x9e819f,{emissive:0x3f2146,emissiveIntensity:.35,roughness:.7,side:THREE.DoubleSide});const bridgeMesh=new THREE.Mesh(bridgeGeo,bridgeMat);bridgeMesh.castShadow=bridgeMesh.receiveShadow=true;bridgeMesh.frustumCulled=false;scene.add(bridgeMesh);
  const tipGeo=new THREE.BufferGeometry();const tipPositions=new Float32Array(400*3);tipGeo.setAttribute('position',new THREE.BufferAttribute(tipPositions,3).setUsage(THREE.DynamicDrawUsage));tipGeo.setDrawRange(0,0);
  function glowTexture() {const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d');const g=ctx.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.13,'rgba(255,255,255,.9)');g.addColorStop(.4,'rgba(255,255,255,.12)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);}
  const glow=glowTexture();
  const tips=new THREE.Points(tipGeo,new THREE.PointsMaterial({color:0xe6c9ff,map:glow,size:.25,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));tips.frustumCulled=false;scene.add(tips);
  function syncHyphae(s) {let n=0,nt=0;for(const network of s.hyphae||[])for(const path of network.paths||[]){for(let j=1;j<path.length&&n<99998;j++){for(const p of [path[j-1],path[j]]){hyphaPositions[n*3]=p.x/P;hyphaPositions[n*3+1]=-p.y/P;hyphaPositions[n*3+2]=1.0;n++;}}const end=path.at(-1);if(end&&nt<400){tipPositions[nt*3]=end.x/P;tipPositions[nt*3+1]=-end.y/P;tipPositions[nt*3+2]=1.03;nt++;}}
    // Native bridge progress adds its collision-aligned visual strand.
    let nb=0;for(const st of s.structures||[]){const all=st.points||[],pts=all.slice(0,Math.max(2,Math.ceil(st.progress*(all.length-1))+1)),w=st.mature?.07:.025;for(let j=1;j<pts.length&&n<99998;j++){const a=pts[j-1],b=pts[j];for(const p of [a,b]){hyphaPositions[n*3]=p.x/P;hyphaPositions[n*3+1]=-p.y/P;hyphaPositions[n*3+2]=1.0;n++;}if(nb<2994){for(const [p,off] of [[a,-w],[a,w],[b,w],[a,-w],[b,w],[b,-w]]){bridgeData[nb*3]=p.x/P;bridgeData[nb*3+1]=-p.y/P+off;bridgeData[nb*3+2]=.98;nb++;}}}}bridgeGeo.setDrawRange(0,nb);bridgeGeo.attributes.position.needsUpdate=true;bridgeGeo.computeVertexNormals();
    hyphaGeo.setDrawRange(0,n);hyphaGeo.attributes.position.needsUpdate=true;tipGeo.setDrawRange(0,nt);tipGeo.attributes.position.needsUpdate=true;$('#growth-readout').textContent=`${nt} pontas · ${Math.floor(n/2)} segmentos vivos`;
  }
  // A single batched cloud: no per-particle objects / draw calls.
  const dustN=500,dustData=new Float32Array(dustN*3),dustBase=new Float32Array(dustN*3),dustColors=new Float32Array(dustN*3);
  for(let i=0;i<dustN;i++){dustBase[i*3]=(random()-.5)*32;dustBase[i*3+1]=(random()-.5)*18;dustBase[i*3+2]=(random()-.5)*10;const c=new THREE.Color(i%5?0x96d9bd:0xffc47d);dustColors.set([c.r,c.g,c.b],i*3);}
  const dustGeo=new THREE.BufferGeometry();dustGeo.setAttribute('position',new THREE.BufferAttribute(dustData,3));dustGeo.setAttribute('color',new THREE.BufferAttribute(dustColors,3));
  const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({map:glow,size:.11,vertexColors:true,opacity:.7,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));dust.frustumCulled=false;scene.add(dust);
  const rays=new THREE.Group();scene.add(rays);
  for(let i=0;i<5;i++){const c=document.createElement('canvas');c.width=128;c.height=256;const ctx=c.getContext('2d'),gr=ctx.createLinearGradient(0,0,128,0);gr.addColorStop(0,'transparent');gr.addColorStop(.5,'rgba(226,243,192,.1)');gr.addColorStop(1,'transparent');ctx.fillStyle=gr;ctx.fillRect(0,0,128,256);const mesh=new THREE.Mesh(new THREE.PlaneGeometry(.7+random()*1,14),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.3}));mesh.position.set(origin.x-3+i*2.3,origin.y+4,-1.3);mesh.rotation.z=-.26; rays.add(mesh);}
  const exudateGeo=new THREE.BufferGeometry();const exudatePos=new Float32Array(500*3);exudateGeo.setAttribute('position',new THREE.BufferAttribute(exudatePos,3));exudateGeo.setDrawRange(0,0);const exudatePoints=new THREE.Points(exudateGeo,new THREE.PointsMaterial({color:0xffd58f,map:glow,size:.23,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));scene.add(exudatePoints);exudatePoints.frustumCulled=false;
  function syncExudates(s){let n=0;for(const e of s.exudates||[]){if(e.taken||n>=500)continue;exudatePos[n*3]=e.x/P;exudatePos[n*3+1]=-e.y/P;exudatePos[n*3+2]=1.1;n++;}exudateGeo.setDrawRange(0,n);exudateGeo.attributes.position.needsUpdate=true;}

  let growthTime=18,lightScale=1,preset='cinema';
  function applyLight(){const presets={cinema:[0xffd0a1,0x71eedb,3.2],moon:[0xb4d7ff,0x9bcfff,2.6],bio:[0xc0ffcf,0x72ffd5,2.4]},c=presets[preset];key.color.set(c[0]);cyan.color.set(c[1]);key.intensity=flags.cinematic?c[2]*lightScale:0;cyan.intensity=flags.cinematic?38*lightScale:0;amber.intensity=flags.cinematic?22*lightScale:0;playerLight.intensity=flags.cinematic?2.8:0;ambient.intensity=flags.cinematic?1.5:2.7;bloom.enabled=flags.cinematic&&flags.high;rays.visible=flags.cinematic&&flags.particles;}
  function regrow(){simulation.regrow?.();growthTime=0;}
  $('#growth').onclick=regrow;
  for(const b of document.querySelectorAll('[data-preset]'))b.onclick=()=>{preset=b.dataset.preset;document.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('active',b.dataset.preset===preset));applyLight();};
  $('#light').oninput=e=>{lightScale=Number(e.target.value);applyLight();};
  for(const name of ['shadows','normals','parallax','particles'])$('#'+name).onchange=e=>{flags[name]=e.target.checked;if(name==='normals')for(const m of standardMaterials){m.normalScale.copy(m.userData.originalNormalScale).multiplyScalar(flags.normals?1:0);}if(name==='shadows')key.castShadow=flags.shadows;if(name==='particles'){dust.visible=tips.visible=flags.particles;applyLight();}};
  function pause(){flags.paused=!flags.paused;$('#pause').innerHTML=`<kbd>P</kbd> ${flags.paused?'continuar':'pausar'}`;}
  function compare(){flags.cinematic=!flags.cinematic;$('#compare').innerHTML=`<kbd>B</kbd> ${flags.cinematic?'comparar luz':'voltar à luz'}`;applyLight();}
  function quality(){flags.high=!flags.high;renderer.setPixelRatio(Math.min(devicePixelRatio,flags.high?1.5:1));composer.setPixelRatio(renderer.getPixelRatio());key.shadow.mapSize.set(flags.high?2048:1024,flags.high?2048:1024);key.shadow.map?.dispose();key.shadow.map=null;$('#quality').textContent=flags.high?'QUALIDADE ALTA ▾':'QUALIDADE LEVE ▴';dustGeo.setDrawRange(0,flags.high?500:180);applyLight();resize();}
  function clean(){document.body.classList.toggle('clean');}
  $('#pause').onclick=pause;$('#compare').onclick=compare;$('#quality').onclick=quality;$('#clean').onclick=clean;
  document.addEventListener('keydown',e=>{const hotkey=({KeyP:pause,KeyR:regrow,KeyB:compare,KeyH:clean})[e.code];if(hotkey){e.preventDefault();if(!e.repeat)hotkey();return;}if(e.target.tagName==='TEXTAREA'||e.target.isContentEditable||(e.target.tagName==='INPUT'&&!['range','checkbox'].includes(e.target.type)))return;if(e.target.matches('input[type=range]')&&e.code.startsWith('Arrow'))return;if(['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();keys[e.code]=true;});
  document.addEventListener('keyup',e=>keys[e.code]=false);window.addEventListener('blur',()=>Object.keys(keys).forEach(k=>keys[k]=false));
  for(const b of document.querySelectorAll('[data-key]')){b.onpointerdown=e=>{b.setPointerCapture(e.pointerId);keys[b.dataset.key]=true;e.preventDefault();};b.onpointerup=b.onpointercancel=()=>keys[b.dataset.key]=false;}
  let pointer={x:0,y:0};document.addEventListener('pointermove',e=>{pointer.x=e.clientX/innerWidth-.5;pointer.y=.5-e.clientY/innerHeight;});
  function resize(){const w=$('#stage').clientWidth,h=$('#stage').clientHeight;renderer.setSize(w,h);composer.setSize(w,h);camera.aspect=w/h;camera.fov=w<700?44:36;camera.updateProjectionMatrix();}
  window.addEventListener('resize',resize);resize();applyLight();
  metrics.ready=true;metrics.maxTextureSize=renderer.capabilities.maxTextureSize;metrics.viewport={width:innerWidth,height:innerHeight,pixelRatio:renderer.getPixelRatio()};const gl=renderer.getContext(),dbg=gl.getExtension('WEBGL_debug_renderer_info');metrics.gpu=dbg?gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL):'Unavailable';loading.hidden=true;
  let last=performance.now(),statsLast=last,syncLast=0,visualTime=0;
  function animate(now){const rawDelta=(now-last)/1000,dt=Math.min(.1,rawDelta);last=now;metrics.frameMs.push(rawDelta*1000);if(metrics.frameMs.length>600)metrics.frameMs.shift();if(!flags.paused){snapshot=simulation.update(dt,keys);visualTime+=dt;growthTime+=dt;}const p=snapshot.player;
    // Camera does not write back into simulation or change collisions.
    const tx=p.x/P+1.8,ty=-p.y/P+1.7;viewX+=(tx-viewX)*(1-Math.exp(-dt*2.4));viewY+=(ty-viewY)*(1-Math.exp(-dt*1.8));
    const px=flags.parallax?pointer.x*.45:0,py=flags.parallax?pointer.y*.22:0;
    camera.position.set(viewX+px,viewY+py,18);camera.lookAt(viewX,viewY,.0);
    backPlane.position.x=origin.x+6+(flags.parallax?(viewX-origin.x)*.18:0);foreground.position.x=flags.parallax?-(viewX-origin.x)*.045:0;
    key.position.x=viewX-4+Math.sin(visualTime*.13)*1.4;key.position.y=viewY+7;key.target.position.set(viewX,viewY-2,0);cyan.position.set(viewX+1.5+Math.sin(visualTime*.2)*1.8,viewY-1.6,3);amber.position.set(viewX-4,viewY+.7,3.5);
    for(const g of growing){const t=THREE.MathUtils.clamp((growthTime-g.delay)/12,0,1);g.obj.geometry.setDrawRange(0,Math.floor(g.count*t/42)*42);}
    syncSprites(snapshot,flags.paused?0:dt);
    if(now-syncLast>100){syncPlatforms(snapshot.platforms);syncHyphae(snapshot);syncExudates(snapshot);syncLast=now;}
    if(flags.particles){for(let i=0;i<dustN;i++){dustData[i*3]=viewX+dustBase[i*3]+Math.sin(visualTime*.13+i)*.15;dustData[i*3+1]=viewY+((dustBase[i*3+1]+visualTime*.055+9)%18)-9;dustData[i*3+2]=dustBase[i*3+2];}dustGeo.attributes.position.needsUpdate=true;}
    renderer.info.autoReset=false;renderer.info.reset();composer.render();
    if(now-statsLast>700){const arr=metrics.frameMs.slice(-60);const avg=arr.reduce((a,b)=>a+b,0)/arr.length;$('#fps').textContent=`${Math.round(1000/avg)} FPS`;$('#draws').textContent=`${renderer.info.render.calls} draws`;metrics.drawCalls=renderer.info.render.calls;metrics.triangles=renderer.info.render.triangles;metrics.gpuMemory={...renderer.info.memory};statsLast=now;}
    requestAnimationFrame(animate);
  }
  window.miguelitoDemo={metrics,flags,snapshot:()=>simulation.snapshot(),regrow,pause,compare,quality,renderer,scene,camera,simulation,getReport(){const a=[...metrics.frameMs].sort((a,b)=>a-b),mean=a.reduce((x,y)=>x+y,0)/a.length;return {...metrics,frameMs:undefined,meanFrameMs:mean,p95FrameMs:a[Math.floor(a.length*.95)],meanFps:1000/mean,quality:flags.high?'high':'low',cinematic:flags.cinematic,webgl:renderer.getContext().getParameter(renderer.getContext().VERSION),userAgent:navigator.userAgent};}};
  requestAnimationFrame(animate);
}
boot().catch(error=>{metrics.errors.push(String(error.stack||error));loading.hidden=false;loading.textContent='Não foi possível iniciar WebGL2: '+error.message;console.error(error);});
