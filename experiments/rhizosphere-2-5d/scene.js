import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createSimulation } from './simulation.js';
import { PLAYER_SKINS } from '../../src/render/player-skins.js';
import { ORGANISM_SPRITE_SHEETS } from '../../src/render/organism-sprites.js';
import { BACILLUS_FRAMES } from './bacillus-frames.js';
import { renderPlatformArtwork } from './platform-art.js';
import { buildRootLayers } from './root-art.js';
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
const metrics = { frameMs:[], ready:false, errors:[], renderer:'Three.js r186 / WebGL2', assetFiles:[], adapter:'original createSimulator / phase 4', revision:2 };
window.addEventListener('error', e => metrics.errors.push(e.message));
window.addEventListener('unhandledrejection', e => { metrics.errors.push(String(e.reason)); loading.hidden=false; loading.textContent='Não foi possível abrir a cena. Consulte o console: '+e.reason; });

async function boot() {
  const simulation = createSimulation();
  let snapshot = simulation.snapshot();
  const origin = { x:snapshot.player.x / P, y:-snapshot.player.y / P };
  const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.setClearColor(0x02080b);
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.NoToneMapping;
  renderer.toneMappingExposure=1;
  $('#stage').appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog=new THREE.Fog(0x02080b,18.5,33);
  const camera=new THREE.OrthographicCamera(-5,5,2.55,-2.55,.1,120);
  let visibleHeight=5.1, visibleWidth=9.06;
  let viewX=origin.x+2.0, viewY=origin.y+1.9;
  const ambient=new THREE.HemisphereLight(0xc6d7df,0x11151b,.65); scene.add(ambient);
  const key=new THREE.DirectionalLight(0xd8e8f0,.9);key.position.set(origin.x-4,origin.y+9,9);key.target.position.set(origin.x+2,origin.y,0);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-15,right:15,top:12,bottom:-12,near:1,far:45});key.shadow.bias=-.0004;key.shadow.normalBias=.025;
  scene.add(key,key.target);
  const cyan=new THREE.PointLight(0x91bad5,3.0,8,2);scene.add(cyan);
  const amber=new THREE.PointLight(0xe3c491,1.2,5,2);scene.add(amber);
  const playerLight=new THREE.PointLight(0xf5e3bd,.25,2,2);scene.add(playerLight);
  const composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  const bloom=new UnrealBloomPass(new THREE.Vector2(1280,720),.1,.45,1.35);composer.addPass(bloom);composer.addPass(new OutputPass());
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
  const sideMaterial=mat(0x363829,{roughness:.93});
  const background=await loader.loadAsync(new URL('../../assets/backgrounds/miguelito-rhizosphere.png',import.meta.url).href);
  background.colorSpace=THREE.SRGBColorSpace;
  const backPlane=new THREE.Mesh(new THREE.PlaneGeometry(41.46,7.8),new THREE.MeshBasicMaterial({map:background,color:0x617a81}));
  backPlane.position.set(origin.x+3,origin.y+.2,-6.5);scene.add(backPlane);
  const rear=new THREE.Mesh(new THREE.PlaneGeometry(120,60),new THREE.ShadowMaterial({color:0x000000,opacity:.28,transparent:true,depthWrite:false}));
  rear.position.set(origin.x,origin.y,-4.5);rear.receiveShadow=true;scene.add(rear);
  const rootArt=buildRootLayers(THREE,{origin});scene.add(rootArt.group);
  for(const m of rootArt.materials)if(m.normalScale)standardMaterials.push(m);
  metrics.rootArchitecture=rootArt.stats;
  const growing=rootArt.growing;
  const platformMeshes=new Map();
  function syncPlatforms(items) {
    const active=new Set();
    items.forEach((p,i)=>{
      if(p.active===false||p.recovery||p.mycorrhizaStructure||!Number.isFinite(p.x)||!p.w)return;
      if(Math.abs(p.x/P-viewX)>12)return;
      const id=p.id??i;active.add(id);let g=platformMeshes.get(id);
      if(!g){
        const art=renderPlatformArtwork(p);
        const tex=new THREE.CanvasTexture(art.canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;
        const normals=new THREE.CanvasTexture(art.normalCanvas);
        const faceMaterial=mat(0xffffff,{map:tex,normalMap:normals,normalScale:new THREE.Vector2(.35,.35),roughness:.95,emissive:0xffffff,emissiveMap:tex,emissiveIntensity:.28,transparent:true,alphaTest:.02,depthWrite:false,side:THREE.DoubleSide});
        g=new THREE.Group();g.userData.art=art;
        const body=new THREE.Mesh(new THREE.BoxGeometry(p.w/P,art.bodyHeightPx/P,art.depthPx/P),sideMaterial);
        body.position.set(p.w/(2*P),-art.bodyHeightPx/(2*P),-.065);body.castShadow=body.receiveShadow=true;g.add(body);
        const face=new THREE.Mesh(new THREE.PlaneGeometry(art.widthPx/P,art.heightPx/P),faceMaterial);
        face.position.set((-art.anchorLeftPx+art.widthPx/2)/P,(art.anchorTopPx-art.heightPx/2)/P,.025);face.castShadow=face.receiveShadow=true;g.add(face);
        scene.add(g);platformMeshes.set(id,g);
      }
      g.position.set(p.x/P,-p.y/P,0);g.visible=true;
    });
    for(const[id,g]of platformMeshes)g.visible=active.has(id);
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
  // The original illustrated albedo stays intact. A bounded 8% light response
  // adds position-dependent shading without letting PBR or tone mapping bleach it.
  const artLight={value:key.position},artDim={value:1};
  function sprite(s){
    const texture=s.tex.clone();
    const material=new THREE.MeshBasicMaterial({map:texture,alphaTest:.1,side:THREE.DoubleSide,fog:false});
    material.onBeforeCompile=shader=>{
      shader.uniforms.uArtLight=artLight;shader.uniforms.uArtDim=artDim;
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vArtWorld;');
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvArtWorld=(modelMatrix*vec4(position,1.0)).xyz;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vArtWorld; uniform vec3 uArtLight; uniform float uArtDim;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat artFacing=max(0.0,normalize(uArtLight-vArtWorld).z); diffuseColor.rgb*=mix(1.0,0.92+0.08*artFacing,uArtDim);');
    };
    material.customProgramCacheKey=()=> 'preserve-original-albedo-v2';
    const mesh=new THREE.Mesh(planeGeo,material);mesh.castShadow=true;mesh.receiveShadow=false;scene.add(mesh);return mesh;
  }
  const hero=sprite(playerSheets.idle);hero.name='Miguelito / original sprite';let heroState='idle',heroDefeat=false,animPhase=0;
  const microbes=new Map();
  function frame(sheet,index){const f=((index%sheet.frames)+sheet.frames)%sheet.frames;sheet.tex.offset.set((f%sheet.columns)/sheet.columns,1-(Math.floor(f/sheet.columns)+1)/sheet.rows);}
  function syncSprites(s,dt) {
    const p=s.player;
    let state=p.invuln>0?'hurt':Math.abs(p.vx)>12||!p.onGround?'run':'idle';
    const defeat=!p.alive||s.gameState==='respawning';if(defeat)state='hurt';
    if(s.gameState==='transition'||s.gameState==='end')state='celebrate';
    if(state!==heroState||defeat!==heroDefeat){animPhase=0;heroState=state;heroDefeat=defeat;}
    const sh=playerSheets[state];const rate=sh.speedFromMotion?Math.min(sh.fps,sh.motionBase+Math.abs(p.vx)*sh.motionFactor):sh.fps;
    animPhase+=dt*(defeat?24:rate);frame(sh,defeat?Math.min(4,Math.floor(animPhase)):sh.loop===false?Math.min(7,Math.floor(animPhase)):Math.floor(animPhase));hero.material.map=sh.tex;
    const height=PLAYER_SKINS.miguelito.characterHeight/P*400/sh.contentHeight;
    const sign=(p.facing<0||p.dir<0)?-1:1;hero.scale.set(height*.8*sign,height,1);
    hero.position.set((p.x+(p.w||32)/2)/P,-(p.y+(p.h||48)+2)/P+(sh.baseline-.5)*height,.16);
    playerLight.position.copy(hero.position).add(new THREE.Vector3(.15,.3,.6));
    const seen=new Set();
    s.microbes.forEach((m,i)=>{const type=m.type==='myco'?'micorriza':m.type;if(!microbeSheets[type])return;const id=m.id??i;seen.add(id);let obj=microbes.get(id);if(!obj){obj=sprite(microbeSheets[type]);microbes.set(id,obj);}const sh=microbeSheets[type],f=Math.floor(s.time*sh.fps+Math.abs(m.phase||0)*3.7);frame({...sh,tex:obj.material.map},f);const base=(ROAMING_ORGANISM_SPRITE_SIZES[m.type]||sh.height)*(m.size||1)*(MICROBE_MOTION_PROFILES[m.type]?.scale||1)/P;let h=base,w=h*.8;if(type==='bacillus'){const rect=BACILLUS_FRAMES[f%44];h=base*104/rect.w;w=base*80/rect.w;}obj.scale.set(w*(m.facing<0?-1:1),h,1);obj.position.set(m.x/P,-m.y/P,.14);obj.visible=Math.abs(m.x/P-viewX)<18;});
    for(const [id,obj] of microbes)obj.visible=seen.has(id)&&Math.abs(obj.position.x-viewX)<18;
  }

  const hyphaPositions=new Float32Array(100000*3);const hyphaGeo=new THREE.BufferGeometry();hyphaGeo.setAttribute('position',new THREE.BufferAttribute(hyphaPositions,3).setUsage(THREE.DynamicDrawUsage));hyphaGeo.setDrawRange(0,0);
  const hyphaMat=new THREE.LineBasicMaterial({color:0xc5a5e8,transparent:true,opacity:.42,toneMapped:false});
  const hypha=new THREE.LineSegments(hyphaGeo,hyphaMat);hypha.frustumCulled=false;scene.add(hypha);
  const bridgeData=new Float32Array(3000*3),bridgeGeo=new THREE.BufferGeometry();bridgeGeo.setAttribute('position',new THREE.BufferAttribute(bridgeData,3).setUsage(THREE.DynamicDrawUsage));bridgeGeo.setDrawRange(0,0);const bridgeMat=mat(0x9e819f,{emissive:0x3f2146,emissiveIntensity:.08,roughness:.95,side:THREE.DoubleSide});const bridgeMesh=new THREE.Mesh(bridgeGeo,bridgeMat);bridgeMesh.castShadow=bridgeMesh.receiveShadow=true;bridgeMesh.frustumCulled=false;scene.add(bridgeMesh);
  const tipGeo=new THREE.BufferGeometry();const tipPositions=new Float32Array(400*3);tipGeo.setAttribute('position',new THREE.BufferAttribute(tipPositions,3).setUsage(THREE.DynamicDrawUsage));tipGeo.setDrawRange(0,0);
  function glowTexture() {const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d');const g=ctx.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.13,'rgba(255,255,255,.9)');g.addColorStop(.4,'rgba(255,255,255,.12)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);}
  const glow=glowTexture();
  const tips=new THREE.Points(tipGeo,new THREE.PointsMaterial({color:0xe6c9ff,map:glow,size:8,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));tips.frustumCulled=false;scene.add(tips);
  function syncHyphae(s) {let n=0,nt=0;for(const network of s.hyphae||[])for(const path of network.paths||[]){for(let j=1;j<path.length&&n<99998;j++){for(const p of [path[j-1],path[j]]){hyphaPositions[n*3]=p.x/P;hyphaPositions[n*3+1]=-p.y/P;hyphaPositions[n*3+2]=.09;n++;}}const end=path.at(-1);if(end&&nt<400){tipPositions[nt*3]=end.x/P;tipPositions[nt*3+1]=-end.y/P;tipPositions[nt*3+2]=.1;nt++;}}
    // Native bridge progress adds its collision-aligned visual strand.
    let nb=0;for(const st of s.structures||[]){const all=st.points||[],pts=all.slice(0,Math.max(2,Math.ceil(st.progress*(all.length-1))+1)),w=st.mature?.07:.025;for(let j=1;j<pts.length&&n<99998;j++){const a=pts[j-1],b=pts[j];for(const p of [a,b]){hyphaPositions[n*3]=p.x/P;hyphaPositions[n*3+1]=-p.y/P;hyphaPositions[n*3+2]=.09;n++;}if(nb<2994){for(const [p,off] of [[a,-w],[a,w],[b,w],[a,-w],[b,w],[b,-w]]){bridgeData[nb*3]=p.x/P;bridgeData[nb*3+1]=-p.y/P+off;bridgeData[nb*3+2]=.08;nb++;}}}}bridgeGeo.setDrawRange(0,nb);bridgeGeo.attributes.position.needsUpdate=true;bridgeGeo.computeVertexNormals();
    hyphaGeo.setDrawRange(0,n);hyphaGeo.attributes.position.needsUpdate=true;tipGeo.setDrawRange(0,nt);tipGeo.attributes.position.needsUpdate=true;$('#growth-readout').textContent=`${nt} pontas · ${Math.floor(n/2)} segmentos vivos`;
  }
  // A single batched cloud: no per-particle objects / draw calls.
  const dustN=260,dustData=new Float32Array(dustN*3),dustBase=new Float32Array(dustN*3),dustColors=new Float32Array(dustN*3);
  for(let i=0;i<dustN;i++){dustBase[i*3]=(random()-.5)*19;dustBase[i*3+1]=(random()-.5)*10;dustBase[i*3+2]=(random()-.5)*10;const c=new THREE.Color(i%4?0xd4cba6:0x78afc2);dustColors.set([c.r,c.g,c.b],i*3);}
  const dustGeo=new THREE.BufferGeometry();dustGeo.setAttribute('position',new THREE.BufferAttribute(dustData,3));dustGeo.setAttribute('color',new THREE.BufferAttribute(dustColors,3));
  const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({map:glow,size:5,vertexColors:true,opacity:.48,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));dust.frustumCulled=false;scene.add(dust);
  const rays=new THREE.Group();scene.add(rays);
  const beamMaterial=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:{color:{value:new THREE.Color(0x6cabc7)},opacity:{value:.14}},
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'varying vec2 vUv;uniform vec3 color;uniform float opacity;void main(){float width=mix(.48,.13,vUv.y);float x=abs(vUv.x-.5)/width;float alpha=exp(-x*x*5.0)*pow(sin(vUv.y*3.14159265),.8);gl_FragColor=vec4(color,alpha*opacity);}'
  });
  const beam=new THREE.Mesh(new THREE.PlaneGeometry(4.5,8.6),beamMaterial);
  beam.position.set(origin.x+.8,origin.y+.4,-.5);beam.rotation.z=-.06;rays.add(beam);
  const exudateGeo=new THREE.BufferGeometry();const exudatePos=new Float32Array(500*3);exudateGeo.setAttribute('position',new THREE.BufferAttribute(exudatePos,3));exudateGeo.setDrawRange(0,0);const exudatePoints=new THREE.Points(exudateGeo,new THREE.PointsMaterial({color:0xffd58f,map:glow,size:9,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));scene.add(exudatePoints);exudatePoints.frustumCulled=false;
  function syncExudates(s){let n=0;for(const e of s.exudates||[]){if(e.taken||n>=500)continue;exudatePos[n*3]=e.x/P;exudatePos[n*3+1]=-e.y/P;exudatePos[n*3+2]=.12;n++;}exudateGeo.setDrawRange(0,n);exudateGeo.attributes.position.needsUpdate=true;}

  let growthTime=18,lightScale=1,preset='cinema';
  function applyLight(){
    const presets={cinema:[0xdbe7ec,0x91bad5,.9],moon:[0xc3d8f4,0x91bedf,.85],bio:[0xd4e3d9,0x95d7bf,.8]},c=presets[preset];
    key.color.set(c[0]);cyan.color.set(c[1]);key.intensity=flags.cinematic?c[2]*lightScale:0;
    cyan.intensity=flags.cinematic?3*lightScale:0;amber.intensity=flags.cinematic?1.2*lightScale:0;
    playerLight.intensity=flags.cinematic?.25:0;ambient.intensity=flags.cinematic?.65:1.15;
    artDim.value=flags.cinematic?1:0;bloom.enabled=flags.cinematic&&flags.high;
    rays.visible=flags.cinematic&&flags.particles;
  }
  $('#settings').onclick=()=>{const open=$('#visual-settings').hidden;$('#visual-settings').hidden=!open;$('#settings').setAttribute('aria-expanded',String(open));};
  function regrow(){simulation.regrow?.();growthTime=0;rootArt.updateGrowth(0);}
  $('#growth').onclick=regrow;
  for(const b of document.querySelectorAll('[data-preset]'))b.onclick=()=>{preset=b.dataset.preset;document.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('active',b.dataset.preset===preset));applyLight();};
  $('#light').oninput=e=>{lightScale=Number(e.target.value);applyLight();};
  for(const name of ['shadows','normals','parallax','particles'])$('#'+name).onchange=e=>{flags[name]=e.target.checked;if(name==='normals')for(const m of standardMaterials){m.normalScale.copy(m.userData.originalNormalScale).multiplyScalar(flags.normals?1:0);}if(name==='shadows')key.castShadow=flags.shadows;if(name==='particles'){dust.visible=tips.visible=flags.particles;applyLight();}};
  function pause(){flags.paused=!flags.paused;$('#pause').innerHTML=`<kbd>P</kbd> ${flags.paused?'continuar':'pausar'}`;}
  function compare(){flags.cinematic=!flags.cinematic;$('#compare').innerHTML=`<kbd>B</kbd> ${flags.cinematic?'comparar luz':'voltar à luz'}`;applyLight();}
  function quality(){flags.high=!flags.high;renderer.setPixelRatio(Math.min(devicePixelRatio,flags.high?1.5:1));composer.setPixelRatio(renderer.getPixelRatio());key.shadow.mapSize.set(flags.high?2048:1024,flags.high?2048:1024);key.shadow.map?.dispose();key.shadow.map=null;$('#quality').textContent=flags.high?'QUALIDADE ALTA ▾':'QUALIDADE LEVE ▴';dustGeo.setDrawRange(0,flags.high?260:120);applyLight();resize();}
  function clean(){document.body.classList.toggle('clean');}
  $('#pause').onclick=pause;$('#compare').onclick=compare;$('#quality').onclick=quality;$('#clean').onclick=clean;
  document.addEventListener('keydown',e=>{const hotkey=({KeyP:pause,KeyR:regrow,KeyB:compare,KeyH:clean})[e.code];if(hotkey){e.preventDefault();if(!e.repeat)hotkey();return;}if(e.target.tagName==='TEXTAREA'||e.target.isContentEditable||(e.target.tagName==='INPUT'&&!['range','checkbox'].includes(e.target.type)))return;if(e.target.matches('input[type=range]')&&e.code.startsWith('Arrow'))return;if(['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();keys[e.code]=true;});
  document.addEventListener('keyup',e=>keys[e.code]=false);window.addEventListener('blur',()=>Object.keys(keys).forEach(k=>keys[k]=false));
  for(const b of document.querySelectorAll('[data-key]')){b.onpointerdown=e=>{b.setPointerCapture(e.pointerId);keys[b.dataset.key]=true;e.preventDefault();};b.onpointerup=b.onpointercancel=()=>keys[b.dataset.key]=false;}
  let pointer={x:0,y:0};document.addEventListener('pointermove',e=>{pointer.x=e.clientX/innerWidth-.5;pointer.y=.5-e.clientY/innerHeight;});
  function resize(){
    const w=$('#stage').clientWidth,h=$('#stage').clientHeight;
    renderer.setSize(w,h);composer.setSize(w,h);
    visibleHeight=w<700?5.8:5.1;visibleWidth=visibleHeight*w/h;
    camera.left=-visibleWidth/2;camera.right=visibleWidth/2;camera.top=visibleHeight/2;camera.bottom=-visibleHeight/2;camera.updateProjectionMatrix();
  }
  window.addEventListener('resize',resize);resize();applyLight();
  metrics.ready=true;metrics.maxTextureSize=renderer.capabilities.maxTextureSize;metrics.viewport={width:innerWidth,height:innerHeight,pixelRatio:renderer.getPixelRatio()};const gl=renderer.getContext(),dbg=gl.getExtension('WEBGL_debug_renderer_info');metrics.gpu=dbg?gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL):'Unavailable';loading.hidden=true;
  let last=performance.now(),statsLast=last,syncLast=0,visualTime=0;
  function animate(now){const rawDelta=(now-last)/1000,dt=Math.min(.1,rawDelta);last=now;metrics.frameMs.push(rawDelta*1000);if(metrics.frameMs.length>600)metrics.frameMs.shift();if(!flags.paused){snapshot=simulation.update(dt,keys);visualTime+=dt;growthTime+=dt;}const p=snapshot.player;
    // Camera does not write back into simulation or change collisions.
    const tx=(p.x+(p.w||32)/2)/P+visibleWidth*.09,ty=-(p.y+(p.h||48))/P+visibleHeight*.12;viewX+=(tx-viewX)*(1-Math.exp(-dt*2.4));viewY+=(ty-viewY)*(1-Math.exp(-dt*1.8));
    const px=flags.parallax?pointer.x*.12:0,py=flags.parallax?pointer.y*.06:0;
    camera.position.set(viewX+px,viewY+py,18);camera.lookAt(viewX,viewY,0);
    backPlane.position.x=origin.x+3+(flags.parallax?(viewX-origin.x)*.025:0);
    for(const l of rootArt.layers)l.group.position.x=flags.parallax?(viewX-origin.x)*l.parallaxFactor:0;
    key.position.set(viewX-1.5+Math.sin(visualTime*.13)*.35,viewY+3.2,5.5);key.target.position.set(viewX,viewY-.6,0);
    cyan.position.set(viewX+.3,viewY+.3,2.5);amber.position.set(viewX-3,viewY-1,1.8);
    beam.position.x=viewX-.1;
    for(const g of growing){const t=THREE.MathUtils.clamp((growthTime-g.delay)/12,0,1);g.obj.geometry.setDrawRange(0,Math.floor(g.count*t/42)*42);}
    syncSprites(snapshot,flags.paused?0:dt);
    if(now-syncLast>100){syncPlatforms(snapshot.platforms);syncHyphae(snapshot);syncExudates(snapshot);rootArt.updateGrowth(growthTime);syncLast=now;}
    if(flags.particles){for(let i=0;i<dustN;i++){dustData[i*3]=viewX+dustBase[i*3]+Math.sin(visualTime*.13+i)*.15;dustData[i*3+1]=viewY+((dustBase[i*3+1]+visualTime*.03+5)%10)-5;dustData[i*3+2]=dustBase[i*3+2];}dustGeo.attributes.position.needsUpdate=true;}
    renderer.info.autoReset=false;renderer.info.reset();composer.render();
    if(now-statsLast>700){const arr=metrics.frameMs.slice(-60);const avg=arr.reduce((a,b)=>a+b,0)/arr.length;$('#fps').textContent=`${Math.round(1000/avg)} FPS`;$('#draws').textContent=`${renderer.info.render.calls} draws`;metrics.drawCalls=renderer.info.render.calls;metrics.triangles=renderer.info.render.triangles;metrics.gpuMemory={...renderer.info.memory};statsLast=now;}
    requestAnimationFrame(animate);
  }
  function framing(){const p=snapshot.player;const foot=new THREE.Vector3((p.x+(p.w||32)/2)/P,-(p.y+(p.h||48)+2)/P,hero.position.z).project(camera);return{visibleHeight,visibleWidth,characterHeightFraction:.64/visibleHeight,heroScreenX:foot.x*.5+.5,footScreenY:.5-foot.y*.5};}
  window.miguelitoDemo={framing,metrics,flags,snapshot:()=>simulation.snapshot(),regrow,pause,compare,quality,renderer,scene,camera,simulation,getReport(){const a=[...metrics.frameMs].sort((a,b)=>a-b),mean=a.reduce((x,y)=>x+y,0)/a.length;return {...metrics,frameMs:undefined,framing:framing(),meanFrameMs:mean,p95FrameMs:a[Math.floor(a.length*.95)],meanFps:1000/mean,quality:flags.high?'high':'low',cinematic:flags.cinematic,webgl:renderer.getContext().getParameter(renderer.getContext().VERSION),userAgent:navigator.userAgent};}};
  requestAnimationFrame(animate);
}
boot().catch(error=>{metrics.errors.push(String(error.stack||error));loading.hidden=false;loading.textContent='Não foi possível iniciar WebGL2: '+error.message;console.error(error);});
