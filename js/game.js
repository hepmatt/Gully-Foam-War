/* Gully Foam War: game logic, levels, enemies, shop. Graphics extras live in graphics.js. */
(() => {
const panel = document.getElementById('panel');
if (!window.THREE) { panel.innerHTML = '<p class="err">The 3D engine did not load. Check your connection and reload the page.</p>'; return; }
const $ = id => document.getElementById(id);
const stage = $('stage');

// ---------- constants ----------
const WATER = -0.8, EYE = 1.25, GRAV = 18, FIXED = 1/60;
const KIDS = {
  rosa:  {id:'rosa', name:'Rosa', gun:'Drizzle', blurb:'Full-auto foam hose. Holds the trigger, fills the air, moves fastest.',
          auto:true, rate:0.1, mag:30, reload:1.0, spread:0.03, pellets:1, speed:36, dmg:1, knock:1, move:5.4, zoom:false,
          stats:{'Fire rate':5, Power:2, Range:3, Speed:5}, shirt:'#e2557f', hair:'#3b2418', skin:'#c98a5e', gunCol:'#2ec4d6', hairStyle:'long'},
  dev:   {id:'dev', name:'Dev', gun:'Broadside', blurb:'Pump blaster that throws six darts at once. Up close it sends scouts flying.',
          auto:false, rate:0.75, mag:6, reload:1.3, spread:0.085, pellets:6, speed:30, dmg:1, knock:1.7, move:4.7, zoom:false,
          stats:{'Fire rate':2, Power:5, Range:2, Speed:3}, shirt:'#3f7fd6', hair:'#16110e', skin:'#8d5a3b', gunCol:'#f2c94c', hairStyle:'short'},
  tibbs: {id:'tibbs', name:'Tibbs', gun:'Pinpoint', blurb:'Long-barrel single shot with a scope. One clean hit tags any scout.',
          auto:false, rate:0.45, mag:8, reload:1.1, spread:0.018, zSpread:0.0015, pellets:1, speed:60, dmg:2, knock:1.3, move:4.9, zoom:true,
          stats:{'Fire rate':3, Power:4, Range:5, Speed:4}, shirt:'#f08a3c', hair:'#b5552b', skin:'#f1c7a0', gunCol:'#7a5bd6', hairStyle:'curly'}
};
const NAMES=['Hank','Dwight','Ollie','Mabel','Gus','Trudy','Percy','Winn','Lou','Bea','Cal','Iggy','Norm','Dot','Vern','Edie'];
let kidId='rosa', best=0;
try{best=parseInt(localStorage.getItem('gullyFoamBest')||'0',10)||0}catch(e){}

function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>a+Math.random()*(b-a);
// ---------- sound (synthesized, starts after the first click or key) ----------
let AC=null, master=null, muted=false, noiseB=null, drone=null;
try{muted=localStorage.getItem('gullyMute')==='1'}catch(e){}
function audioInit(){
  if(AC){if(AC.state==='suspended')AC.resume().catch(()=>{});return}
  try{AC=new (window.AudioContext||window.webkitAudioContext)();master=AC.createGain();master.gain.value=muted?0:0.55;master.connect(AC.destination);
    noiseB=AC.createBuffer(1,AC.sampleRate,AC.sampleRate);const d=noiseB.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}catch(e){AC=null}
}
addEventListener('pointerdown',audioInit); addEventListener('keydown',audioInit);
function setMute(m){muted=m;if(master)master.gain.value=m?0:0.55;try{localStorage.setItem('gullyMute',m?'1':'0')}catch(e){}}
function envG(g,t,a,peak,dec){g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(0.0002,peak),t+a);g.gain.exponentialRampToValueAtTime(0.0001,t+a+dec)}
function nz(t,dur,type,f0,f1,peak,q){const s=AC.createBufferSource();s.buffer=noiseB;const f=AC.createBiquadFilter();f.type=type;f.frequency.setValueAtTime(f0,t);if(f1)f.frequency.exponentialRampToValueAtTime(f1,t+dur);if(q)f.Q.value=q;const g=AC.createGain();envG(g,t,0.005,peak,dur);s.connect(f).connect(g).connect(master);s.start(t);s.stop(t+dur+0.05)}
function tn(t,type,f0,f1,dur,peak){const o=AC.createOscillator();o.type=type;o.frequency.setValueAtTime(f0,t);if(f1)o.frequency.exponentialRampToValueAtTime(f1,t+dur);const g=AC.createGain();envG(g,t,0.01,peak,dur);o.connect(g).connect(master);o.start(t);o.stop(t+dur+0.05)}
function sfx(k,vol,arg){
  if(!AC||muted) return; vol=vol==null?1:vol; if(vol<0.03) return; const t=AC.currentTime;
  try{switch(k){
    case 'shot': nz(t,0.06,'highpass',1800,0,0.16*vol); tn(t,'triangle',420,160,0.06,0.07*vol); break;
    case 'eshot': nz(t,0.05,'bandpass',1100,0,0.12*vol,1.5); break;
    case 'hit': tn(t,'sine',700,280,0.09,0.2*vol); break;
    case 'tag': { const up=Math.pow(2,(Math.min(arg||1,7)-1)*2/12);
      tn(t,'sine',170,45,0.25,0.6*vol); nz(t,0.14,'bandpass',800,2800,0.4*vol,0.8); nz(t+0.005,0.05,'highpass',5500,0,0.14*vol);
      [0,4,7,12].forEach((st,i)=>tn(t+0.04+i*0.05,'triangle',523.25*up*Math.pow(2,st/12),0,0.2,0.12*vol));
      tn(t+0.25,'sine',2093*up,0,0.4,0.07*vol); tn(t+0.25,'sine',2637*up,0,0.4,0.05*vol); break; }
    case 'headshot': nz(t,0.03,'highpass',7000,0,0.2*vol); tn(t,'square',1568,0,0.06,0.07*vol); tn(t+0.05,'square',2349,0,0.22,0.07*vol); break;
    case 'bossdown': tn(t,'sine',120,30,1.2,0.8*vol); nz(t,1.2,'lowpass',1600,80,0.8*vol); [523,659,784,1047,1319].forEach((f,i)=>{tn(t+0.15+i*0.12,'triangle',f,0,0.35,0.14*vol);tn(t+0.15+i*0.12,'square',f/2,0,0.3,0.05*vol)}); break;
    case 'clank': tn(t,'square',1300,900,0.07,0.07*vol); nz(t,0.05,'highpass',3000,0,0.08*vol); break;
    case 'hurt': tn(t,'square',200,90,0.16,0.13*vol); nz(t,0.12,'lowpass',900,0,0.12*vol); break;
    case 'boom': nz(t,0.9,'lowpass',1400,60,0.9*vol); tn(t,'sine',90,35,0.6,0.6*vol); break;
    case 'launch': nz(t,0.35,'bandpass',600,2400,0.3*vol,0.8); break;
    case 'break': nz(t,0.22,'bandpass',900,300,0.45*vol,1.2); tn(t,'triangle',180,90,0.12,0.15*vol); break;
    case 'glass': for(let i=0;i<4;i++)tn(t+i*0.03,'sine',2500+Math.random()*2500,1800,0.12,0.06*vol); nz(t,0.15,'highpass',4000,0,0.15*vol); break;
    case 'pickup': [660,880,1320].forEach((f,i)=>tn(t+i*0.07,'triangle',f,0,0.12,0.12*vol)); break;
    case 'pshot': nz(t,0.08,'lowpass',700,0,0.28*vol); tn(t,'sine',170,80,0.08,0.18*vol); break;
    case 'ashot': nz(t,0.03,'highpass',3500,0,0.2*vol); tn(t,'square',1800,1100,0.025,0.05*vol); break;
    case 'coin': tn(t,'square',988,0,0.06,0.07*vol); tn(t+0.06,'square',1319,0,0.16,0.07*vol); break;
    case 'splat': nz(t,0.09,'bandpass',500,250,0.25*vol,1); break;
    case 'slide': nz(t,0.45,'bandpass',300,1400,0.35*vol,0.7); break;
    case 'siren': { const o=AC.createOscillator(),l=AC.createOscillator(),lg=AC.createGain(),g=AC.createGain(),f=AC.createBiquadFilter();
      o.type='sawtooth'; o.frequency.value=650; l.frequency.value=0.9; lg.gain.value=260; l.connect(lg).connect(o.frequency); f.type='lowpass'; f.frequency.value=2200;
      g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.16*vol,t+0.25); g.gain.setValueAtTime(0.16*vol,t+2.1); g.gain.exponentialRampToValueAtTime(0.0001,t+2.6);
      o.connect(f).connect(g).connect(master); o.start(t); l.start(t); o.stop(t+2.7); l.stop(t+2.7); break; }
    case 'whistle': tn(t,'sine',2400,260,2.0,0.09*vol); break;
    case 'nuke': tn(t,'sine',80,22,3.2,1.0*vol); tn(t,'triangle',140,40,1.2,0.5*vol); nz(t,3.8,'lowpass',4000,50,1.0*vol); nz(t,1.0,'highpass',3000,0,0.35*vol); nz(t+0.9,3.4,'lowpass',260,60,0.6*vol);
      for(let i=0;i<8;i++) nz(t+0.2+i*0.18+Math.random()*0.1,0.12,'bandpass',600+Math.random()*900,0,0.25*vol,2); break;
    case 'switch': tn(t,'square',300,600,0.05,0.06*vol); break;
    case 'growl': {
      const base=arg||80, o1=AC.createOscillator(), o2=AC.createOscillator(), lfo=AC.createOscillator(), lg=AC.createGain(), f=AC.createBiquadFilter(), g=AC.createGain();
      o1.type=o2.type='sawtooth'; o1.frequency.setValueAtTime(base*1.25,t); o1.frequency.exponentialRampToValueAtTime(base*0.8,t+0.7); o2.frequency.value=base*1.03;
      f.type='lowpass'; f.frequency.value=base*5; lfo.frequency.value=17; lg.gain.value=base*2; lfo.connect(lg).connect(f.frequency);
      envG(g,t,0.06,0.32*Math.min(vol,1.6),0.7); o1.connect(f); o2.connect(f); f.connect(g).connect(master);
      [o1,o2,lfo].forEach(o=>{o.start(t);o.stop(t+0.85)}); break; }
  }}catch(e){}
}
function droneOn(on){
  if(!AC) return;
  if(on&&!drone){const g=AC.createGain();g.gain.value=0.0001;const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=220;
    const os=[49,49.6,73.4].map(fr=>{const o=AC.createOscillator();o.type='sawtooth';o.frequency.value=fr;o.connect(f);o.start();return o});
    f.connect(g).connect(master);g.gain.exponentialRampToValueAtTime(0.08,AC.currentTime+2.5);drone={g,os}}
  else if(!on&&drone){const d=drone;drone=null;d.g.gain.cancelScheduledValues(AC.currentTime);d.g.gain.setValueAtTime(Math.max(0.0002,d.g.gain.value),AC.currentTime);d.g.gain.exponentialRampToValueAtTime(0.0001,AC.currentTime+1.5);setTimeout(()=>d.os.forEach(o=>{try{o.stop()}catch(e){}}),1700)}
}
const distVol=(x,z)=>clamp(1-Math.hypot(x-P.x,z-P.z)/50,0,1);

// ---------- terrain ----------
const LV={city:false,kind:'ravine'};
let TP={a1:7,f1:0.07,p1:0,a2:2,f2:0.19,p2:0,c:0,h1:0.45,hf1:0.09,hf2:0.11,h2:0.25,hp:0,depth:1.6};
const creekX = z => TP.c+TP.a1*Math.sin(z*TP.f1+TP.p1)+TP.a2*Math.sin(z*TP.f2+TP.p2);
function GH(x,z){
  if(LV.kind!=='ravine') return 0;
  const dx=x-creekX(z);
  let h=TP.h1*Math.sin(x*TP.hf1+TP.hp)*Math.cos(z*TP.hf2)+TP.h2*Math.sin(x*0.23+z*0.17+TP.hp);
  h-=TP.depth*Math.exp(-(dx*dx)/26);
  const ex=Math.max(0,Math.abs(x)-34), ez=Math.max(0,Math.abs(z)-42);
  return h+ex*ex*0.12+ez*ez*0.12;
}

// ---------- renderer ----------
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
stage.insertBefore(renderer.domElement,stage.firstChild);
const scene=new THREE.Scene();
scene.background=new THREE.Color('#9cc8d4'); scene.fog=new THREE.Fog('#a9cfc9',30,95);
const camera=new THREE.PerspectiveCamera(72,16/9,0.05,200);
camera.rotation.order='YXZ'; scene.add(camera);
const hemi=new THREE.HemisphereLight('#dff0ff','#3d5a2a',0.75); scene.add(hemi);
const sun=new THREE.DirectionalLight('#fff3d6',0.9);
sun.position.set(25,40,15); sun.castShadow=true; sun.shadow.mapSize.set(1024,1024);
Object.assign(sun.shadow.camera,{left:-60,right:60,top:60,bottom:-60,near:1,far:120});
scene.add(sun);
function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();if(window.GFX)GFX.resize(w,h)}
new ResizeObserver(resize).observe(stage); resize();
if(window.GFX) GFX.init({renderer,scene,camera,sun,hemi});

let signTex=null, signCanvas=null;
const lam=c=>new THREE.MeshLambertMaterial({color:c});
const flat=c=>new THREE.MeshStandardMaterial({color:c,flatShading:true,roughness:0.95});
const boxes=[]; // collision AABBs
function addBox(x0,x1,y0,y1,z0,z1){boxes.push({x0,x1,y0,y1,z0,z1})}
function shadowy(m){m.castShadow=true;m.receiveShadow=true;return m}

const world=new THREE.Group(); scene.add(world);
let bushes=[], bridgeZ=0, destructs=[], debris=[], litMats=[], interiorSpots=[];
let startLevel='ravine', curLevel='ravine';
const WM={rust:lam('#c4622d'),dark:lam('#2f3e40'),trim:lam('#e0d2a8'),roof:lam('#a54c20'),stripe:lam('#8a3f1f'),tire:lam('#1d1d1b'),wood:lam('#5a4128'),
  plank:lam('#a67d4d'),plank2:lam('#8f6a3e'),crate:lam('#9a6b3a'),log:lam('#7a4f2a'),logEnd:lam('#c79a63'),rock:flat('#8a8f86'),rock2:flat('#7b8076'),
  trunk:lam('#5a4128'),leaf:[flat('#3f6e2e'),flat('#4b7f36'),flat('#5a8d3e')],pine:flat('#2f5a2a'),bush:[flat('#3d7330'),flat('#4f8a38'),flat('#5d9640')],
  reed:lam('#7d8f4a'),pad:lam('#6a9a40'),vine:flat('#4b8a3a'),window:lam('#e0a33c'),
  water:new THREE.MeshLambertMaterial({color:'#4f6b3a',transparent:true,opacity:0.86}),ground:new THREE.MeshLambertMaterial({vertexColors:true})};
function makeSign(){
  if(signTex) return;
  const cv=document.createElement('canvas'); cv.width=512; cv.height=128; signCanvas=cv.getContext('2d');
  signTex=new THREE.CanvasTexture(cv); drawSign();
}
function drawSign(){
  const c=signCanvas; c.fillStyle='#7a4f2a'; c.fillRect(0,0,512,128); c.strokeStyle='#4f3218'; c.lineWidth=10; c.strokeRect(5,5,502,118);
  c.fillStyle='#f2e3b8'; c.font='64px Lilita One, Arial Black, sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText('GULLY HQ',256,68); signTex.needsUpdate=true;
}
function wadd(m){world.add(m);return m}
function buildBus(){
  makeSign();
  const bz=37, by=GH(0,bz)-0.35, grp=new THREE.Group(); grp.position.set(0,by,bz); wadd(grp);
  const body=shadowy(new THREE.Mesh(new THREE.BoxGeometry(9.5,2.7,3),WM.rust)); body.position.y=1.65; grp.add(body);
  const roof=shadowy(new THREE.Mesh(new THREE.BoxGeometry(9.3,0.25,2.8),WM.roof)); roof.position.y=3.1; grp.add(roof);
  const winG=new THREE.BoxGeometry(0.95,0.85,0.06), frG=new THREE.BoxGeometry(1.1,1.0,0.04);
  for(let i=0;i<7;i++){for(const sd of[-1,1]){const wi=new THREE.Mesh(winG,i===3?WM.window:WM.dark);wi.position.set(-3.9+i*1.2,2.3,sd*1.52);grp.add(wi);const f=new THREE.Mesh(frG,WM.trim);f.position.set(-3.9+i*1.2,2.3,sd*1.51);grp.add(f)}}
  const stripe=new THREE.Mesh(new THREE.BoxGeometry(9.55,0.25,3.05),WM.stripe); stripe.position.y=1.15; grp.add(stripe);
  const wg=new THREE.CylinderGeometry(0.55,0.55,0.4,14); wg.rotateX(Math.PI/2);
  for(const[x,z]of[[-3,1.4],[3,1.4],[-3,-1.4],[3,-1.4]]){const wh=new THREE.Mesh(wg,WM.tire);wh.position.set(x,0.35,z);grp.add(wh)}
  const sign=new THREE.Mesh(new THREE.BoxGeometry(4.4,1.1,0.12),[WM.log,WM.log,WM.log,WM.log,WM.log,new THREE.MeshLambertMaterial({map:signTex})]);
  sign.rotation.y=Math.PI; sign.position.set(0,4.1,0); grp.add(sign);
  const postG=new THREE.BoxGeometry(0.15,1,0.15); for(const x of[-1.8,1.8]){const po=new THREE.Mesh(postG,WM.wood);po.position.set(x,3.5,0);grp.add(po)}
  const vG=new THREE.IcosahedronGeometry(0.35,0); for(let i=0;i<14;i++){const v=new THREE.Mesh(vG,WM.vine);v.position.set(-4.6+i*0.25,3.0-Math.abs(Math.sin(i))*0.8,1.5);grp.add(v)}
  addBox(-4.75,4.75,by,by+3.25,bz-1.5,bz+1.5);
}

function buildWorld(seed,kind){ buildWorldCore(seed,kind); if(window.GFX) GFX.setLevel(LV.kind,{WM,OM,dmat}); }
function buildWorldCore(seed,kind){
  freeObj(world,false); debris.forEach(d=>scene.remove(d.m));
  while(world.children.length) world.remove(world.children[0]);
  boxes.length=0; bushes=[]; destructs=[]; litMats=[]; interiorSpots=[]; debris.forEach(d=>scene.remove(d.m)); debris=[];
  const r=mulberry(seed);
  LV.kind=(kind==='city'||kind==='office')?kind:'ravine'; LV.city=LV.kind==='city'; curLevel=LV.kind; sun.castShadow=LV.kind!=='office';
  if(LV.kind==='city'){buildCity(r);return}
  if(LV.kind==='office'){buildOffice(r);return}
  for(let t=0;t<80;t++){
    TP={a1:4+r()*5,f1:0.05+r()*0.04,p1:r()*6.3,a2:1+r()*2.5,f2:0.14+r()*0.1,p2:r()*6.3,c:r()*24-12,h1:0.3+r()*0.6,hf1:0.06+r()*0.08,hf2:0.06+r()*0.08,h2:0.15+r()*0.3,hp:r()*6.3,depth:1.4+r()*0.4};
    if(Math.abs(creekX(37))>9&&Math.abs(creekX(31))>8&&Math.abs(creekX(24))>6) break;
  }
  // ground + water
  const g=new THREE.PlaneGeometry(130,130,96,96); g.rotateX(-Math.PI/2);
  const p=g.attributes.position, col=[], c=new THREE.Color();
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i),h=GH(x,z); p.setY(i,h);
    const dx=Math.abs(x-creekX(z)), n=Math.sin(x*0.7+TP.hp)*Math.cos(z*0.6);
    if(h>2) c.set('#6d7d4a'); else if(dx<5) c.set('#6a5236'); else if(dx<7) c.set('#7c8a3e'); else c.set(n>0.3?'#5a9439':n<-0.3?'#6aa646':'#62a040');
    col.push(c.r,c.g,c.b);
  }
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3)); g.computeVertexNormals();
  const gm=wadd(new THREE.Mesh(g,WM.ground)); gm.receiveShadow=true;
  const w=wadd(new THREE.Mesh(new THREE.PlaneGeometry(130,130),WM.water)); w.rotation.x=-Math.PI/2; w.position.y=WATER;
  const padG=new THREE.CircleGeometry(0.35,10,0.3,Math.PI*1.8);
  for(let i=0;i<50;i++){const z=r()*90-45,x=creekX(z)+r()*4-2;if(GH(x,z)>WATER-0.05)continue;const l=wadd(new THREE.Mesh(padG,WM.pad));l.rotation.x=-Math.PI/2;l.rotation.z=r()*6;l.position.set(x,WATER+0.02,z)}
  buildBus();
  // bridge
  bridgeZ=-22+r()*30; const bx=creekX(bridgeZ), bty=Math.max(0.12,GH(bx-6,bridgeZ),GH(bx+6,bridgeZ))-0.05;
  const plG=new THREE.BoxGeometry(0.58,0.1,2.2);
  for(let i=0;i<20;i++){const pl=shadowy(new THREE.Mesh(plG,i%2?WM.plank:WM.plank2));pl.position.set(bx-6+i*0.62,bty,bridgeZ);wadd(pl)}
  const railG=new THREE.BoxGeometry(12.4,0.08,0.08), rpG=new THREE.BoxGeometry(0.1,0.7,0.1);
  for(const dz of[-1.05,1.05]){const rl=wadd(new THREE.Mesh(railG,WM.wood));rl.position.set(bx,bty+0.58,bridgeZ+dz);for(let i=0;i<5;i++){const pp=wadd(new THREE.Mesh(rpG,WM.wood));pp.position.set(bx-6+i*3,bty+0.28,bridgeZ+dz)}}
  addBox(bx-6.2,bx+6.2,-2,bty+0.05,bridgeZ-1.1,bridgeZ+1.1);
  const clearSpot=(x,z,rad)=>{
    if(Math.abs(x-creekX(z))<5.2) return false;
    if(Math.abs(x)<7&&z>24) return false;
    if(Math.abs(z-bridgeZ)<3&&Math.abs(x-bx)<8) return false;
    return !boxes.some(b=>x>b.x0-rad&&x<b.x1+rad&&z>b.z0-rad&&z<b.z1+rad);
  };
  // junk pile
  let jx,jz; do{jx=r()*56-28;jz=r()*60-40}while(!clearSpot(jx,jz,4));
  const crG=new THREE.BoxGeometry(1,1,1);
  [[0,0],[1.1,0],[0,1.1],[3.5,-3],[-2,4],[2,3],[-1.2,-1.2]].forEach(([ox,oz])=>{const x=jx+ox,z=jz+oz;addDestruct('crate',x,GH(x,z)-0.05,z,1,1,1,false)});
  [[-3,0],[-3.8,0.8],[4,1]].forEach(([ox,oz])=>{const x=jx+ox,z=jz+oz;addDestruct('barrel',x,GH(x,z)-0.05,z,0.7,1.0,0.7,false)});
  const tg=new THREE.TorusGeometry(0.45,0.2,8,16); tg.rotateX(Math.PI/2);
  [[2.5,2],[2,-2],[-1.5,-2]].forEach(([ox,oz])=>{const x=jx+ox,z=jz+oz;for(let k=0;k<3;k++){const t=shadowy(new THREE.Mesh(tg,WM.tire));t.position.set(x,GH(x,z)+0.2+k*0.38,z);wadd(t)}const y=GH(x,z);addBox(x-0.65,x+0.65,y-0.5,y+1.2,z-0.65,z+0.65)});
  for(let n=0,t=0;n<7&&t<400;t++){const x=r()*60-30,z=r()*72-40;if(!clearSpot(x,z,2))continue;addDestruct('plywood',x,GH(x,z)-0.08,z,2.6,1.3,0.12,r()<0.5);n++}
  for(let n=0,t=0;n<4&&t<400;t++){const x=r()*58-29,z=r()*70-40,rot=r()<0.5;if(!clearSpot(x,z,4.5))continue;for(let k=0;k<3;k++){const fx=rot?x:x-2.6+k*2.6,fz=rot?z-2.6+k*2.6:z;addDestruct('fence',fx,GH(fx,fz)-0.05,fz,2.5,1.0,0.08,rot)}n++}
  for(let n=0,t=0;n<6&&t<400;t++){const x=r()*60-30,z=r()*72-40;if(!clearSpot(x,z,1.5))continue;const y=GH(x,z)-0.05;addDestruct('cardboard',x,y,z,0.8,0.6,0.7,false);addDestruct('cardboard',x+0.95,GH(x+0.95,z)-0.05,z+0.1,0.7,0.5,0.6,false);n++}
  // logs
  const lg=new THREE.CylinderGeometry(0.38,0.42,4.2,10);
  for(let n=0,t=0;n<14&&t<400;t++){const x=r()*62-31,z=r()*76-40;if(!clearSpot(x,z,2.5))continue;const along=r()<0.5,y=GH(x,z)+0.3;const l=shadowy(new THREE.Mesh(lg,[WM.log,WM.logEnd,WM.logEnd]));l.rotation[along?'z':'x']=Math.PI/2;l.position.set(x,y,z);wadd(l);
    if(along)addBox(x-2.1,x+2.1,y-0.6,y+0.4,z-0.42,z+0.42);else addBox(x-0.42,x+0.42,y-0.6,y+0.4,z-2.1,z+2.1);n++}
  // rocks
  for(let n=0,t=0;n<22&&t<400;t++){const z=r()*82-42,x=(r()<0.35?creekX(z)+r()*6-3:r()*66-33);if(Math.abs(x)<7&&z>24)continue;if(boxes.some(b=>x>b.x0-1.5&&x<b.x1+1.5&&z>b.z0-1.5&&z<b.z1+1.5))continue;
    const s=0.6+r()*1.0,y=GH(x,z);const rk=shadowy(new THREE.Mesh(new THREE.DodecahedronGeometry(s,0),r()<0.5?WM.rock:WM.rock2));rk.scale.y=0.75;rk.position.set(x,y+s*0.3,z);rk.rotation.set(r(),r()*6,r());wadd(rk);addBox(x-s*0.85,x+s*0.85,y-1,y+s*1.0,z-s*0.85,z+s*0.85);n++}
  // trees (instanced): round and pine
  const dm=new THREE.Object3D();
  const NT=150, trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22,0.32,1,7),WM.trunk,NT);
  const leafM=WM.leaf.map(m=>new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),m,NT));
  const pineM=new THREE.InstancedMesh(new THREE.ConeGeometry(1,1,7),WM.pine,NT*3);
  let nt=0,nl=[0,0,0],np=0;
  for(let t=0;nt<NT&&t<3000;t++){
    const x=r()*80-40,z=r()*96-48;if(!clearSpot(x,z,1.2))continue;
    const y=GH(x,z), ht=3.5+r()*2.5, pine=r()<0.35;
    dm.position.set(x,y+ht/2,z);dm.rotation.set(0,r()*6,0);dm.scale.set(1,ht,1);dm.updateMatrix();trunk.setMatrixAt(nt,dm.matrix);
    if(pine){for(let k=0;k<3;k++){const s=1.7-k*0.45;dm.position.set(x,y+ht*0.55+k*1.1+0.8,z);dm.scale.set(s,1.8,s);dm.updateMatrix();pineM.setMatrixAt(np++,dm.matrix)}}
    else{for(let k=0;k<3;k++){const ci=(nt+k)%3,s=1.4-k*0.25+r()*0.4;dm.position.set(x+r()-0.5,y+ht*0.8+k*0.9,z+r()-0.5);dm.scale.set(s,s*0.9,s);dm.rotation.set(r(),r(),r());dm.updateMatrix();leafM[ci].setMatrixAt(nl[ci]++,dm.matrix)}}
    addBox(x-0.32,x+0.32,y-1,y+ht,z-0.32,z+0.32); nt++;
  }
  trunk.count=nt; pineM.count=np; leafM.forEach((m,i)=>m.count=nl[i]);
  [trunk,pineM,...leafM].forEach(m=>{m.castShadow=true;m.receiveShadow=true;m.instanceMatrix.needsUpdate=true;wadd(m)});
  // bushes (instanced): no collision, but they hide you from scouts
  const NB=190, bushI=WM.bush.map(m=>new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),m,NB*3)); const nb=[0,0,0];
  for(let n=0,t=0;n<NB&&t<4000;t++){
    const x=r()*72-36,z=r()*88-44; if(Math.abs(x-creekX(z))<4.4||(Math.abs(x)<6&&z>26)||(Math.abs(z-bridgeZ)<2&&Math.abs(x-bx)<7))continue;
    if(boxes.some(b=>x>b.x0-0.6&&x<b.x1+0.6&&z>b.z0-0.6&&z<b.z1+0.6))continue;
    const y=GH(x,z), sz=0.55+r()*0.55;
    for(let k=0;k<3;k++){const ci=(n+k)%3;dm.position.set(x+(r()-0.5)*sz*1.4,y+sz*0.55+r()*0.2,z+(r()-0.5)*sz*1.4);const s=sz*(0.7+r()*0.5);dm.scale.set(s,s*0.85,s);dm.rotation.set(r(),r(),r());dm.updateMatrix();bushI[ci].setMatrixAt(nb[ci]++,dm.matrix)}
    bushes.push({x,z,y:y+sz*0.7,r:sz*1.15}); n++;
  }
  bushI.forEach((m,i)=>{m.count=nb[i];m.castShadow=false;m.receiveShadow=true;m.instanceMatrix.needsUpdate=true;wadd(m)});
  // reeds
  const reeds=new THREE.InstancedMesh(new THREE.ConeGeometry(0.04,0.9,4),WM.reed,240); let nr=0;
  for(let i=0;i<240;i++){const z=r()*90-45,x=creekX(z)+(r()<0.5?-1:1)*(3.8+r()*1.8);dm.position.set(x,GH(x,z)+0.4,z);dm.rotation.set(0,0,r()*0.4-0.2);dm.scale.set(1,1,1);dm.updateMatrix();reeds.setMatrixAt(nr++,dm.matrix)}
  reeds.instanceMatrix.needsUpdate=true; wadd(reeds);
}

// ---------- shared world bits ----------
Object.assign(WM,{roofC:lam('#4a4844'),ac:lam('#8d9196'),metal:lam('#3b3f45'),bulb:new THREE.MeshBasicMaterial({color:'#ffe9a8'}),glassDark:lam('#2b3440'),
  stone:lam('#a9a39a'),fountainW:new THREE.MeshLambertMaterial({color:'#5f9fc0',transparent:true,opacity:0.85}),lane:lam('#e6c34a'),white:lam('#e8e6e0'),
  dumpster:lam('#2f5d4a'),dumpLid:lam('#24473a'),under:lam('#1d1d1f'),benchW:lam('#8a5a2b'),
  bulbOff:lam('#3a3a36'),bulbFlick:new THREE.MeshBasicMaterial({color:'#ffe2a0'}),rubble:lam('#7f7a72'),interiorFloor:lam('#55504a')});
const G={carBody:new THREE.BoxGeometry(1.9,0.75,4.2),carCab:new THREE.BoxGeometry(1.7,0.6,2.2),carUnder:new THREE.BoxGeometry(1.7,0.35,3.6),
  pole:new THREE.CylinderGeometry(0.07,0.09,4.5,6),bulb:new THREE.SphereGeometry(0.2,8,6),dash:new THREE.BoxGeometry(0.16,0.02,1.8),
  bench:new THREE.BoxGeometry(1.8,0.12,0.55),benchLeg:new THREE.BoxGeometry(0.1,0.42,0.5),dump:new THREE.BoxGeometry(1.9,1.25,1.1),dumpLid:new THREE.BoxGeometry(1.95,0.1,1.15),
  ac:new THREE.BoxGeometry(1.4,0.8,1.2),unit:new THREE.BoxGeometry(1,1,1)};
for(const k in G) G[k].userData.keep=true;
// building facades: a daytime window map plus a lit-window glow map that comes up at night
let winTex=null, litTex=null, fenceTex=null;
function makeTextures(){
  if(winTex) return;
  const mk=lit=>{const cv=document.createElement('canvas');cv.width=cv.height=256;const c=cv.getContext('2d');
    c.fillStyle=lit?'#000':'#e9e5dc';c.fillRect(0,0,256,256);
    if(!lit){c.fillStyle='rgba(0,0,0,0.07)';for(let y=0;y<256;y+=16)c.fillRect(0,y,256,2)}
    for(let gy=0;gy<4;gy++)for(let gx=0;gx<4;gx++){const x=gx*64+16,y=gy*64+12;
      if(lit){if(Math.random()<0.08){c.fillStyle=Math.random()<0.5?'#ff8a3a':'#ffb35a';c.fillRect(x,y+10,32,30)}}
      else{const q=Math.random();
        if(q<0.3){c.fillStyle='#6e5236';c.fillRect(x-2,y,36,40);c.fillStyle='#4f3a24';for(let k=0;k<4;k++)c.fillRect(x-2,y+4+k*10,36,2)}
        else if(q<0.6){c.fillStyle='#121314';c.fillRect(x,y,32,40);c.fillStyle='#9fb0bc';c.beginPath();c.moveTo(x,y);c.lineTo(x+14,y);c.lineTo(x+4,y+16);c.fill();c.beginPath();c.moveTo(x+32,y+40);c.lineTo(x+20,y+40);c.lineTo(x+30,y+26);c.fill()}
        else{c.fillStyle='#2b343d';c.fillRect(x,y,32,40)}
        c.fillStyle='#bdb5a6';c.fillRect(x-3,y+40,38,4)}}
    if(!lit){for(let k=0;k<16;k++){c.fillStyle='rgba(50,38,26,0.13)';c.fillRect(Math.random()*256,Math.random()*120,6+Math.random()*10,80+Math.random()*120)}}
    const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t};
  winTex=mk(false); litTex=mk(true);
  const fc=document.createElement('canvas');fc.width=128;fc.height=64;const f=fc.getContext('2d');
  f.fillStyle='#ece6d6';for(let i=0;i<8;i++){f.beginPath();f.moveTo(i*16+2,64);f.lineTo(i*16+2,10);f.lineTo(i*16+7,2);f.lineTo(i*16+12,10);f.lineTo(i*16+12,64);f.fill()}
  f.fillRect(0,18,128,7);f.fillRect(0,46,128,7);
  fenceTex=new THREE.CanvasTexture(fc);fenceTex.wrapS=THREE.RepeatWrapping;
}
const FAC={};
function facadeMat(col){
  if(!FAC[col]){FAC[col]=new THREE.MeshLambertMaterial({color:col,map:winTex,emissive:'#ffcf7a',emissiveMap:litTex,emissiveIntensity:0.06});FAC[col].userData.keep=true}
  if(!litMats.includes(FAC[col])) litMats.push(FAC[col]); return FAC[col];
}
// one shared window texture; each box gets its UVs scaled so a window tile is 8 m wide
function facadeBox(w,h,d,col){
  const geo=new THREE.BoxGeometry(w,h,d), uv=geo.attributes.uv, sc=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
  for(let f=0;f<6;f++)for(let v=0;v<4;v++){const i=f*4+v;uv.setXY(i,uv.getX(i)*sc[f][0]/8,uv.getY(i)*sc[f][1]/8)}
  const fm=facadeMat(col); return shadowy(new THREE.Mesh(geo,[fm,fm,WM.roofC,WM.roofC,fm,fm]));
}
function freeObj(o,mats){ if(!o) return; o.traverse(m=>{ if(m.geometry&&!m.geometry.userData.keep) m.geometry.dispose(); if(mats&&m.material){(Array.isArray(m.material)?m.material:[m.material]).forEach(x=>{if(!x.userData.keep)x.dispose()})} }) }
function freeRig(rig){ if(!rig) return; scene.remove(rig.g); freeObj(rig.g,false); for(const k in rig.mats) rig.mats[k].dispose(); }
const LAMC={}; const lamC=c=>LAMC[c]||(LAMC[c]=lam(c));
// ---------- destructibles ----------
const DK={crate:{hp:8,col:'#9a6b3a'},cardboard:{hp:3,col:'#c8a26b'},plywood:{hp:10,col:'#c9a46e'},fence:{hp:5,col:'#ece6d6'},
  can:{hp:4,col:'#3f6b4a'},barrel:{hp:6,col:'#c2452d'},glass:{hp:2,col:'#bfe6f2'},stall:{hp:9,col:'#d9682b'},
  partition:{hp:6,col:'#5e6b7a'},board:{hp:6,col:'#f4f4f0'},drywall:{hp:16,col:'#e6e2da'},cooler:{hp:3,col:'#7fc7ea'}};
const DM={};
function dmat(k){
  if(DM[k]) return DM[k];
  makeTextures();
  if(k==='cooler') DM[k]=new THREE.MeshLambertMaterial({color:'#7fc7ea',transparent:true,opacity:0.7});
  else if(k==='glass') DM[k]=new THREE.MeshLambertMaterial({color:'#9fd3e6',transparent:true,opacity:0.45});
  else if(k==='fence') DM[k]=new THREE.MeshLambertMaterial({map:fenceTex,alphaTest:0.5,side:THREE.DoubleSide});
  else DM[k]=lam(DK[k].col);
  return DM[k];
}
const stripM=lam('#6e4a26'), braceM=lam('#8a6a3e'), postM=lam('#5a4128'), creamM=lam('#f2e3b8'), canLidM=lam('#2c4a35'), awnM=lam('#f2e3b8');
function addDestruct(kind,x,y0,z,w,h,d,rot){
  const g=new THREE.Group(); g.position.set(x,y0,z); g.rotation.y=rot?Math.PI/2:0; const m=dmat(kind);
  const box=(bw,bh,bd,bx,by,bz,mat)=>{const me=shadowy(new THREE.Mesh(new THREE.BoxGeometry(bw,bh,bd),mat||m));me.position.set(bx,by,bz);g.add(me);return me};
  if(kind==='crate'){box(w,h,d,0,h/2,0);box(w+0.03,0.1,d+0.03,0,h*0.18,0,stripM);box(w+0.03,0.1,d+0.03,0,h*0.82,0,stripM)}
  else if(kind==='cardboard'){box(w,h,d,0,h/2,0);box(0.12,0.02,d+0.01,0,h+0.005,0,braceM)}
  else if(kind==='plywood'){box(w,h,d,0,h/2,0);const L=Math.hypot(w,h)*0.9,a=Math.atan2(h,w);box(L,0.12,d+0.04,0,h/2,0,braceM).rotation.z=a;box(L,0.12,d+0.04,0,h/2,0,braceM).rotation.z=-a;box(0.1,h+0.3,0.1,-w/2+0.1,(h+0.3)/2,-0.1,postM);box(0.1,h+0.3,0.1,w/2-0.1,(h+0.3)/2,-0.1,postM)}
  else if(kind==='fence'){const me=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);me.position.y=h/2;me.castShadow=true;g.add(me)}
  else if(kind==='can'||kind==='barrel'){const me=shadowy(new THREE.Mesh(new THREE.CylinderGeometry(w/2,w/2*0.92,h,12),m));me.position.y=h/2;g.add(me);
    if(kind==='barrel'){box(w*1.02,0.06,w*1.02,0,h*0.3,0,creamM);box(w*1.02,0.06,w*1.02,0,h*0.7,0,creamM)}else box(w*1.05,0.06,w*1.05,0,h,0,canLidM)}
  else if(kind==='glass'){const me=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);me.position.y=h/2;g.add(me)}
  else if(kind==='stall'){box(w,h,d,0,h/2,0,braceM);const cn=new THREE.Mesh(new THREE.BoxGeometry(w+0.5,0.08,d+0.8),m);cn.position.set(0,2.2,0.1);g.add(cn);
    const cn2=new THREE.Mesh(new THREE.BoxGeometry(w+0.52,0.3,0.05),awnM);cn2.position.set(0,2.05,d/2+0.5);g.add(cn2);for(const sx of[-1,1])box(0.08,2.2,0.08,sx*(w/2),1.1,d/2+0.4,postM)}
  else if(kind==='partition'){box(w,h,d,0,h/2,0);box(w,0.05,d+0.03,0,h,0,WM.metal)}
  else if(kind==='drywall'){box(w,h,d,0,h/2,0)}
  else if(kind==='board'){box(w,h-0.55,d,0,0.55+(h-0.55)/2,0);box(0.05,0.55,0.45,-w/2+0.1,0.275,0,WM.metal);box(0.05,0.55,0.45,w/2-0.1,0.275,0,WM.metal)}
  else if(kind==='cooler'){box(0.45,0.95,0.45,0,0.475,0,OM.printer);const j=new THREE.Mesh(new THREE.CylinderGeometry(0.17,0.17,0.45,12),m);j.position.y=1.18;g.add(j)}
  wadd(g);
  const hw=(rot?d:w)/2, hd=(rot?w:d)/2, thin=0.09;
  const D={kind,g,x,y:y0,z,w,h,d,hp:DK[kind].hp*((kind==='crate'||kind==='cardboard')?Math.max(1,w*h*d):1),shake:0};
  D.box={x0:x-Math.max(hw,thin),x1:x+Math.max(hw,thin),y0:y0-0.1,y1:y0+h,z0:z-Math.max(hd,thin),z1:z+Math.max(hd,thin),dref:D};
  boxes.push(D.box); destructs.push(D); return D;
}
function damageDestruct(D,amt,dir,power){ if(D.dead) return; D.hp-=amt; D.shake=0.22; if(D.hp<=0) destroyDestruct(D,dir,power||1); }
function destroyDestruct(D,dir,power){
  D.dead=true; world.remove(D.g); freeObj(D.g,false); const bi=boxes.indexOf(D.box); if(bi>=0) boxes.splice(bi,1); const di=destructs.indexOf(D); if(di>=0) destructs.splice(di,1);
  const m=dmat(D.kind), b=D.box, glass=D.kind==='glass', n=glass?16:clamp(Math.round(6+D.w*D.h*D.d*5),6,16);
  for(let k=0;k<n;k++){
    const me=new THREE.Mesh(G.unit,m);
    const sc=glass?[rand(0.1,0.3),rand(0.1,0.35),0.02]:D.kind==='fence'?[0.14,rand(0.3,0.8),0.05]:[rand(0.12,0.4),rand(0.08,0.3),rand(0.1,0.35)];
    me.scale.set(sc[0],sc[1],sc[2]); me.position.set(rand(b.x0,b.x1),rand(b.y0+0.1,b.y1),rand(b.z0,b.z1)); me.rotation.set(rand(0,3),rand(0,3),rand(0,3)); me.castShadow=!glass;
    scene.add(me);
    const v=new THREE.Vector3(rand(-2,2),rand(2,5),rand(-2,2)); if(dir) v.addScaledVector(dir,rand(2,5)*(power||1));
    debris.push({m:me,v,av:new THREE.Vector3(rand(-9,9),rand(-9,9),rand(-9,9)),t:0,sy:sc[1]});
  }
  while(debris.length>240){const o=debris.shift();scene.remove(o.m)}
  const c=new THREE.Vector3((b.x0+b.x1)/2,(b.y0+b.y1)/2,(b.z0+b.z1)/2);
  burst(c,10,1.2); sfx(glass?'glass':'break',distVol(c.x,c.z));
  darts=darts.filter(d=>{if(d.stuck&&d.p.x>b.x0-0.15&&d.p.x<b.x1+0.15&&d.p.z>b.z0-0.15&&d.p.z<b.z1+0.15&&d.p.y<b.y1+0.15){scene.remove(d.g);return false}return true});
  if(mode==='play'){stats.smashed=(stats.smashed||0)+1; score+=5; if(Math.random()<(nukeS?0.03:0.18)) spawnPowerup(c)}
}
function updateDebris(dt){
  for(let i=debris.length-1;i>=0;i--){
    const d=debris[i]; d.t+=dt;
    if(!d.rest){
      d.v.y-=14*dt; d.m.position.addScaledVector(d.v,dt); d.m.rotation.x+=d.av.x*dt; d.m.rotation.y+=d.av.y*dt; d.m.rotation.z+=d.av.z*dt;
      const gy=GH(d.m.position.x,d.m.position.z)+d.sy*0.3;
      if(d.m.position.y<gy){d.m.position.y=gy;d.v.y*=-0.3;d.v.x*=0.6;d.v.z*=0.6;d.av.multiplyScalar(0.55);if(Math.abs(d.v.y)<0.7&&Math.hypot(d.v.x,d.v.z)<0.5)d.rest=true}
    }
    if(d.t>8){d.m.scale.multiplyScalar(0.92);if(d.t>9){scene.remove(d.m);debris.splice(i,1)}}
  }
  for(const D of destructs){if(D.shake>0){D.shake-=dt;const a=D.shake*0.2;D.g.position.set(D.x+rand(-a,a),D.y,D.z+rand(-a,a));if(D.shake<=0)D.g.position.set(D.x,D.y,D.z)}}
}
// ---------- city builder: Mill Street ----------
const CAR_COLS=['#4a3a30','#3a3632','#5e4636','#6b5a4a','#2f3a3a','#7a3f2e','#5a5048'];
const FACADES=['#7d6f63','#6e6a62','#8a7b68','#5f6468','#7a5f52','#6b6157','#757a7c','#80705e'];
function addCar(x,z,along,col){
  const g=new THREE.Group(); g.position.set(x,0,z); if(!along) g.rotation.y=Math.PI/2; g.rotation.z=rand(-0.09,0.09); if(Math.random()<0.4) g.position.y=-0.18; wadd(g);
  const body=shadowy(new THREE.Mesh(G.carBody,lam(col))); body.position.y=0.62; g.add(body);
  const cab=shadowy(new THREE.Mesh(G.carCab,WM.glassDark)); cab.position.set(0,1.29,-0.2); g.add(cab);
  const un=new THREE.Mesh(G.carUnder,WM.under); un.position.y=0.2; g.add(un);
  const hw=along?0.95:2.1, hd=along?2.1:0.95; addBox(x-hw,x+hw,-1,1.6,z-hd,z+hd);
}
function addLamp(x,z){const p=wadd(new THREE.Mesh(G.pole,WM.metal));p.position.set(x,2.25,z);const b=wadd(new THREE.Mesh(G.bulb,Math.random()<0.25?WM.bulbFlick:WM.bulbOff));b.position.set(x,4.55,z);addBox(x-0.12,x+0.12,-1,4.6,z-0.12,z+0.12)}
function addBench(x,z,along){const g=new THREE.Group();g.position.set(x,0,z);if(along)g.rotation.y=Math.PI/2;const s=new THREE.Mesh(G.bench,WM.benchW);s.position.y=0.45;g.add(s);for(const lx of[-0.75,0.75]){const l=new THREE.Mesh(G.benchLeg,WM.metal);l.position.set(lx,0.21,0);g.add(l)}wadd(g);const hw=along?0.3:0.9,hd=along?0.9:0.3;addBox(x-hw,x+hw,-1,0.5,z-hd,z+hd)}
function addDumpster(x,z,along){const g=new THREE.Group();g.position.set(x,0,z);if(along)g.rotation.y=Math.PI/2;const b=shadowy(new THREE.Mesh(G.dump,WM.dumpster));b.position.y=0.62;g.add(b);const l=new THREE.Mesh(G.dumpLid,WM.dumpLid);l.position.y=1.3;g.add(l);wadd(g);const hw=along?0.58:0.98,hd=along?0.98:0.58;addBox(x-hw,x+hw,-1,1.35,z-hd,z+hd)}
function addBuilding(x0,x1,z0,z1,h,col){
  const w=x1-x0,d=z1-z0;
  const b=facadeBox(w,h,d,col); b.position.set((x0+x1)/2,h/2,(z0+z1)/2); wadd(b);
  if(w>4&&d>4){const ac=wadd(new THREE.Mesh(G.ac,WM.ac));ac.position.set(x0+w*0.3,h+0.4,z0+d*0.6)}
  addBox(x0,x1,-1,h,z0,z1);
}
function addHollow(x0,x1,z0,z1,h,col,doorsZ){
  const t=0.35, dw=2.4, dh=2.8, ch=3.6, cx=(x0+x1)/2, cz=(z0+z1)/2;
  const piece=(px0,px1,pz0,pz1,y0,y1)=>{const w=px1-px0,d=pz1-pz0,hh=y1-y0;if(w<0.05||d<0.05||hh<0.05)return;
    const m=facadeBox(w,hh,d,col);m.position.set((px0+px1)/2,(y0+y1)/2,(pz0+pz1)/2);wadd(m);addBox(px0,px1,y0<0.1?-1:y0,y1,pz0,pz1)};
  if(doorsZ){
    for(const [za,zb] of [[z0,z0+t],[z1-t,z1]]){piece(x0,cx-dw/2,za,zb,0,h);piece(cx+dw/2,x1,za,zb,0,h);piece(cx-dw/2,cx+dw/2,za,zb,dh,h)}
    piece(x0,x0+t,z0+t,z1-t,0,h); piece(x1-t,x1,z0+t,z1-t,0,h);
  } else {
    for(const [xa,xb] of [[x0,x0+t],[x1-t,x1]]){piece(xa,xb,z0,cz-dw/2,0,h);piece(xa,xb,cz+dw/2,z1,0,h);piece(xa,xb,cz-dw/2,cz+dw/2,dh,h)}
    piece(x0+t,x1-t,z0,z0+t,0,h); piece(x0+t,x1-t,z1-t,z1,0,h);
  }
  const slab=shadowy(new THREE.Mesh(new THREE.BoxGeometry(x1-x0-2*t,h-ch,z1-z0-2*t),WM.roofC)); slab.position.set(cx,(ch+h)/2,cz); wadd(slab); addBox(x0+t,x1-t,ch,h,z0+t,z1-t);
  const fl=wadd(new THREE.Mesh(new THREE.PlaneGeometry(x1-x0-2*t,z1-z0-2*t),WM.interiorFloor)); fl.rotation.x=-Math.PI/2; fl.position.set(cx,0.015,cz); fl.receiveShadow=true;
  const iw=(x1-x0)/2-1.4, id=(z1-z0)/2-1.4;
  for(let k=0;k<5;k++){const px=cx+rand(-iw,iw), pz=cz+rand(-id,id); if(doorsZ?Math.abs(px-cx)<1.7:Math.abs(pz-cz)<1.7) continue; if(boxes.some(b=>px>b.x0-0.6&&px<b.x1+0.6&&pz>b.z0-0.6&&pz<b.z1+0.6&&b.y0<1)) continue;
    const q=Math.random(); addDestruct(q<0.4?'crate':q<0.8?'cardboard':'barrel',px,-0.05,pz,q<0.8?0.9:0.7,q<0.8?0.8:1.0,q<0.8?0.9:0.7,false)}
  if(doorsZ){const L=Math.min(4,z1-z0-3),sx=x0+t+0.4;const sh=wadd(new THREE.Mesh(new THREE.BoxGeometry(0.6,2,L),WM.metal));sh.position.set(sx,1,cz);addBox(sx-0.3,sx+0.3,-1,2,cz-L/2,cz+L/2)}
  else {const L=Math.min(4,x1-x0-3),sz=z0+t+0.4;const sh=wadd(new THREE.Mesh(new THREE.BoxGeometry(L,2,0.6),WM.metal));sh.position.set(cx,1,sz);addBox(cx-L/2,cx+L/2,-1,2,sz-0.3,sz+0.3)}
  interiorSpots.push([cx+(doorsZ?2:0),cz+(doorsZ?0:2)]);
}
function instTrees(spots){
  if(!spots.length) return; const dm=new THREE.Object3D();
  const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2,0.28,1,7),WM.trunk,spots.length), leaf=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),WM.leaf[1],spots.length*2);
  let k=0;
  spots.forEach(([x,z,ht],i)=>{const y=GH(x,z);dm.rotation.set(0,0,0);dm.position.set(x,y+ht/2,z);dm.scale.set(1,ht,1);dm.updateMatrix();trunk.setMatrixAt(i,dm.matrix);
    for(let j=0;j<2;j++){const s=1.5-j*0.35;dm.position.set(x,y+ht*0.85+j*0.9,z);dm.scale.set(s,s*0.85,s);dm.rotation.set(i,j,i*j);dm.updateMatrix();leaf.setMatrixAt(k++,dm.matrix)}
    addBox(x-0.3,x+0.3,y-1,y+ht,z-0.3,z+0.3)});
  [trunk,leaf].forEach(m=>{m.castShadow=true;m.receiveShadow=true;m.instanceMatrix.needsUpdate=true;wadd(m)});
}
function instBushes(spots){
  if(!spots.length) return; const dm=new THREE.Object3D(), m=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),WM.bush[1],spots.length*3); let k=0;
  spots.forEach(([x,z,sz],i)=>{const y=GH(x,z);for(let j=0;j<3;j++){dm.position.set(x+(j-1)*sz*0.55,y+sz*0.55,z+((i+j)%2-0.5)*sz*0.3);const s=sz*(0.75+0.1*j);dm.scale.set(s,s*0.85,s);dm.rotation.set(j,i,0);dm.updateMatrix();m.setMatrixAt(k++,dm.matrix)}
    bushes.push({x,z,y:y+sz*0.7,r:sz*1.2})});
  m.count=k; m.receiveShadow=true; m.instanceMatrix.needsUpdate=true; wadd(m);
}
const XS=[-14,14], ZS=[-28,-2,22], SW=4, WALK=2;
const BX=[[-44,-20],[-8,8],[20,44]], BZ=[[-52,-34],[-22,-8],[4,16],[28,52]];
function buildCity(r){
  makeTextures(); bridgeZ=999;
  const onStreet=(x,z)=>XS.some(c=>Math.abs(x-c)<SW)||ZS.some(c=>Math.abs(z-c)<SW);
  const onWalk=(x,z)=>!onStreet(x,z)&&(XS.some(c=>Math.abs(x-c)<SW+WALK)||ZS.some(c=>Math.abs(z-c)<SW+WALK));
  const nearSpawn=(x,z)=>Math.abs(x)<9&&z>19;
  const blocks=[]; BX.forEach((bx,i)=>BZ.forEach((bz,j)=>blocks.push({x0:bx[0],x1:bx[1],z0:bz[0],z1:bz[1],i,j,type:null})));
  blocks.forEach(b=>{if(b.i===1&&b.j===3)b.type='lot';else if(b.i===1&&b.j===2)b.type='plaza'});
  const rest=blocks.filter(b=>!b.type).sort(()=>r()-0.5);
  rest.forEach((b,k)=>b.type=k<2?'park':k<3?'plaza':'build');
  const blockAt=(x,z)=>blocks.find(b=>x>=b.x0&&x<=b.x1&&z>=b.z0&&z<=b.z1);
  // ground
  const g=new THREE.PlaneGeometry(130,130,130,130); g.rotateX(-Math.PI/2);
  const p=g.attributes.position, col=[], c=new THREE.Color();
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);
    const hn=Math.sin(x*1.7+z*0.9)*Math.cos(z*1.3-x*0.4);
    if(onStreet(x,z)) c.set(hn>0.72?'#4c5f37':hn<-0.8?'#2a2b2e':'#3a3c41'); else if(onWalk(x,z)) c.set(hn>0.6?'#5f7a3f':'#8f8a80');
    else {const b=blockAt(x,z);c.set(!b?'#5a5650':b.type==='park'?'#5f9a3e':b.type==='plaza'?'#b9a88a':b.type==='lot'?'#46484d':'#8c877d')}
    col.push(c.r,c.g,c.b)}
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3)); g.computeVertexNormals();
  const gm=wadd(new THREE.Mesh(g,WM.ground)); gm.receiveShadow=true;
  // lane dashes
  const dashes=[]; for(const cx of XS)for(let z=-46;z<=46;z+=4)if(!ZS.some(c=>Math.abs(z-c)<SW+1))dashes.push([cx,z,0]);
  for(const cz of ZS)for(let x=-40;x<=40;x+=4)if(!XS.some(c=>Math.abs(x-c)<SW+1))dashes.push([x,cz,1]);
  const di=new THREE.InstancedMesh(G.dash,WM.lane,dashes.length), dm=new THREE.Object3D();
  dashes.forEach(([x,z,rot],i)=>{dm.position.set(x,0.02,z);dm.rotation.set(0,rot?Math.PI/2:0,0);dm.scale.set(1,1,1);dm.updateMatrix();di.setMatrixAt(i,dm.matrix)}); di.instanceMatrix.needsUpdate=true; wadd(di);
  buildBus();
  const trees=[], hedges=[];
  for(const b of blocks){
    const w=b.x1-b.x0, d=b.z1-b.z0;
    if(b.type==='build'){
      const alongX=w>=d, n=1+Math.floor(r()*3), gap=3, L=(alongX?w:d), seg=(L-gap*(n-1))/n;
      for(let k=0;k<n;k++){
        const a0=(alongX?b.x0:b.z0)+k*(seg+gap), a1=a0+seg, ins=r()*1.2;
        const x0=alongX?a0:b.x0+ins, x1=alongX?a1:b.x1-ins, z0=alongX?b.z0+ins:a0, z1=alongX?b.z1-ins:a1;
        const bh=6+r()*15, bc=FACADES[(r()*FACADES.length)|0];
        if(r()<0.75&&x1-x0>=5.5&&z1-z0>=5.5&&Math.abs((x0+x1)/2)<36&&Math.abs((z0+z1)/2)<44) addHollow(x0,x1,z0,z1,bh,bc,alongX); else addBuilding(x0,x1,z0,z1,bh,bc);
        if(k<n-1){ // alley clutter
          const ax=alongX?a1+gap/2:(b.x0+b.x1)/2+rand(-3,3), az=alongX?(b.z0+b.z1)/2+rand(-3,3):a1+gap/2;
          if(Math.abs(ax)<37&&Math.abs(az)<45){
            if(r()<0.6) addDumpster(ax,az+(alongX?2.5:0),!alongX);
            addDestruct('cardboard',ax+rand(-0.3,0.3),-0.05,az-(alongX?1.5:0),0.8,0.6,0.7,false);
            if(r()<0.6) addDestruct('crate',ax,-0.05,az+(alongX?-3:2.5),1,1,1,false);
          }
        }
      }
    } else if(b.type==='park'){
      const cx=(b.x0+b.x1)/2, cz=(b.z0+b.z1)/2;
      for(let k=0;k<7;k++){const x=rand(b.x0+2.5,b.x1-2.5),z=rand(b.z0+2.5,b.z1-2.5);if(Math.abs(x)>37||Math.abs(z)>45)continue;trees.push([x,z,3.5+r()*2])}
      for(let k=0;k<6;k++){const x=rand(b.x0+2,b.x1-2),z=rand(b.z0+2,b.z1-2);if(Math.abs(x)>37||Math.abs(z)>45)continue;hedges.push([x,z,0.6+r()*0.4])}
      if(Math.abs(cx)<37&&Math.abs(cz)<45){addBench(cx,cz+2,false); addBench(cx-3,cz-2,true)}
      for(const az of[b.z0,b.z1]){ if(Math.abs(az)>45) continue; for(let x=b.x0+1.5;x<b.x1-1.5;x+=2.6){ if(Math.abs(x-cx)<2.2||Math.abs(x)>37) continue; addDestruct('fence',x,-0.02,az,2.5,1.0,0.06,false) } }
    } else if(b.type==='plaza'){
      const cx=(b.x0+b.x1)/2, cz=(b.z0+b.z1)/2;
      const bas=shadowy(wadd(new THREE.Mesh(new THREE.CylinderGeometry(2,2.1,0.6,20),WM.stone))); bas.position.set(cx,0.3,cz);
      const wtr=wadd(new THREE.Mesh(new THREE.CylinderGeometry(1.8,1.8,0.05,20),WM.fountainW)); wtr.position.set(cx,0.58,cz);
      const col2=shadowy(wadd(new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.4,1.8,10),WM.stone))); col2.position.set(cx,0.9,cz);
      const bowl=wadd(new THREE.Mesh(new THREE.CylinderGeometry(0.8,0.4,0.3,14),WM.stone)); bowl.position.set(cx,1.85,cz);
      addBox(cx-1.9,cx+1.9,-1,0.65,cz-1.9,cz+1.9); addBox(cx-0.4,cx+0.4,-1,2,cz-0.4,cz+0.4);
      for(let k=0;k<3;k++){const x=cx+(k-1)*4.5, z=cz+(r()<0.5?-4.5:4.5); if(Math.abs(z-cz)>d/2-1.2||Math.abs(x)>37) continue; addDestruct('stall',x,-0.05,z,2.2,1.0,0.9,false)}
      for(let k=0;k<4;k++){const x=rand(b.x0+1.5,b.x1-1.5),z=rand(b.z0+1.5,b.z1-1.5);if(Math.hypot(x-cx,z-cz)<3.2||Math.abs(x)>37||Math.abs(z)>45||boxes.some(bb=>x>bb.x0-0.8&&x<bb.x1+0.8&&z>bb.z0-0.8&&z<bb.z1+0.8))continue;addDestruct(r()<0.5?'crate':'barrel',x,-0.05,z,0.9,0.9,0.9,false)}
      hedges.push([b.x0+1.6,cz,0.7],[b.x1-1.6,cz,0.7]); if(Math.abs(cx)<37){addBench(cx-4,cz-3,false); addBench(cx+4,cz+3,false)}
    } else if(b.type==='lot'){
      const lines=new THREE.InstancedMesh(G.dash,WM.white,10); for(let k=0;k<10;k++){dm.position.set(-7.5+k*1.6+(k>4?3.5:0),0.02,44);dm.rotation.set(0,0,0);dm.scale.set(1,1,2);dm.updateMatrix();lines.setMatrixAt(k,dm.matrix)}
      lines.instanceMatrix.needsUpdate=true; wadd(lines);
      addCar(-6,44.5,true,CAR_COLS[(r()*7)|0]); addCar(5.5,44.5,true,CAR_COLS[(r()*7)|0]); addDumpster(7,40,true);
    }
  }
  // street furniture
  for(const cx of XS) for(const side of[-1,1]){
    const lx=cx+side*(SW+1), px=cx+side*(SW-1.2);
    for(let z=-44;z<=44;z+=16){ if(ZS.some(c=>Math.abs(z-c)<SW+2)) continue; addLamp(lx,z) }
    for(let z=-42;z<=42;z+=7){ if(ZS.some(c=>Math.abs(z-c)<SW+3)||nearSpawn(px,z)||r()>0.35) continue; addCar(px,z,true,CAR_COLS[(r()*7)|0]) }
    for(let z=-40;z<=40;z+=9){ if(ZS.some(c=>Math.abs(z-c)<SW+2)||nearSpawn(lx,z)||r()>0.3) continue; if(r()<0.5)addDestruct('can',lx+side*0.3,-0.05,z+2,0.6,0.95,0.6,false); else hedges.push([lx+side*0.4,z,0.65]) }
  }
  for(const cz of ZS) for(const side of[-1,1]){
    const lz=cz+side*(SW+1), pz=cz+side*(SW-1.2);
    for(let x=-36;x<=36;x+=16){ if(XS.some(c=>Math.abs(x-c)<SW+2)||nearSpawn(x,lz)) continue; addLamp(x,lz) }
    for(let x=-36;x<=36;x+=7){ if(XS.some(c=>Math.abs(x-c)<SW+3)||nearSpawn(x,pz)||r()>0.35) continue; addCar(x,pz,false,CAR_COLS[(r()*7)|0]) }
    for(let x=-34;x<=34;x+=9){ if(XS.some(c=>Math.abs(x-c)<SW+2)||nearSpawn(x,lz)||r()>0.35) continue; const q=r(); if(q<0.4)addDestruct('can',x+2,-0.05,lz+side*0.3,0.6,0.95,0.6,false); else if(q<0.7)trees.push([x,lz+side*0.4,3.6+r()]); else hedges.push([x,lz+side*0.4,0.65]) }
  }
  // bus shelters with glass backs
  let sh=0; for(let t=0;t<40&&sh<3;t++){
    const cz=ZS[(r()*3)|0], side=r()<0.5?-1:1, x=rand(-34,34), z=cz+side*(SW+1.2);
    if(XS.some(c=>Math.abs(x-c)<SW+3)||nearSpawn(x,z)||boxes.some(b=>x>b.x0-2&&x<b.x1+2&&z>b.z0-1&&z<b.z1+1)) continue;
    const roof=wadd(new THREE.Mesh(new THREE.BoxGeometry(3.2,0.1,1.5),WM.metal)); roof.position.set(x,2.45,z);
    for(const px of[-1.5,1.5]){const po=wadd(new THREE.Mesh(new THREE.BoxGeometry(0.08,2.4,0.08),WM.metal));po.position.set(x+px,1.2,z+side*0.6);addBox(x+px-0.06,x+px+0.06,-1,2.5,z+side*0.6-0.06,z+side*0.6+0.06)}
    addDestruct('glass',x,0,z+side*0.65,3.0,2.2,0.05,false); addBench(x,z,false); sh++;
  }
  // street barricades
  for(let n=0,t=0;n<6&&t<60;t++){
    const onX=r()<0.5, c0=onX?XS[(r()*2)|0]:ZS[(r()*3)|0], a=rand(-36,36), x=onX?c0+rand(-2,2):a, z=onX?a:c0+rand(-2,2);
    if(nearSpawn(x,z)||(onX?ZS:XS).some(c=>Math.abs((onX?z:x)-c)<SW+2)||boxes.some(b=>x>b.x0-1.5&&x<b.x1+1.5&&z>b.z0-1.5&&z<b.z1+1.5)) continue;
    addDestruct('plywood',x,-0.08,z,2.6,1.3,0.12,!onX); n++;
  }
  // rubble piles and weeds
  for(let n=0,t=0;n<10&&t<200;t++){const x=rand(-34,34),z=rand(-42,42);if(nearSpawn(x,z)||boxes.some(b=>x>b.x0-2&&x<b.x1+2&&z>b.z0-2&&z<b.z1+2))continue;
    for(let k=0;k<5;k++){const s=rand(0.4,1.1),m=wadd(new THREE.Mesh(G.unit,WM.rubble));m.scale.set(s,s*0.6,s*rand(0.7,1.3));m.position.set(x+rand(-1,1),s*0.25,z+rand(-1,1));m.rotation.set(rand(-0.3,0.3),rand(0,3),rand(-0.3,0.3));m.castShadow=true}
    addBox(x-1.2,x+1.2,-1,0.7,z-1.2,z+1.2); if(r()<0.6) addDestruct('crate',x+1.9,-0.05,z,1,1,1,false); n++}
  for(let k=0;k<45;k++){const x=rand(-36,36),z=rand(-44,44);if(nearSpawn(x,z)||!(onStreet(x,z)||onWalk(x,z)))continue;hedges.push([x,z,rand(0.35,0.6)])}
  instTrees(trees.filter(([x,z])=>!boxes.some(b=>x>b.x0-0.5&&x<b.x1+0.5&&z>b.z0-0.5&&z<b.z1+0.5)));
  instBushes(hedges.filter(([x,z])=>!boxes.some(b=>x>b.x0-0.4&&x<b.x1+0.4&&z>b.z0-0.4&&z<b.z1+0.4)));
}

// ---------- office level ----------
const OM={carpet:new THREE.MeshLambertMaterial({vertexColors:true}),wall:lam('#d9d6cf'),winBand:new THREE.MeshBasicMaterial({color:'#1c2533'}),ceil:new THREE.MeshBasicMaterial({color:'#c9c7c1',side:THREE.DoubleSide}),
  desk:lam('#b8a283'),mon:lam('#1f2126'),screen:new THREE.MeshBasicMaterial({color:'#8fc4ff'}),chair:lam('#2a2c31'),column:lam('#cfcac1'),couch:lam('#4b6a8a'),
  vend:lam('#b8352a'),vendFront:new THREE.MeshBasicMaterial({color:'#ffe6a8'}),cab:lam('#7b8189'),pot:lam('#a0583a'),elev:lam('#9aa1a8'),elevDoor:lam('#6d747c'),
  arrow:new THREE.MeshBasicMaterial({color:'#ffb347'}),table:lam('#6b4f35'),fort:lam('#c8a26b'),blanket:lam('#7a3f8a'),printer:lam('#e3e1dc'),
  rack:lam('#24272d'),led:new THREE.MeshBasicMaterial({color:'#5dff8a'}),ledR:new THREE.MeshBasicMaterial({color:'#ff5a4a'})};
const officeLight=new THREE.MeshBasicMaterial({color:'#f4f7ff'});
function solid(x,z,w,h,d,mat,y0){y0=y0||0;const m=wadd(new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat));m.position.set(x,y0+h/2,z);m.receiveShadow=true;addBox(x-w/2,x+w/2,-1,y0+h,z-d/2,z+d/2);return m}
function buildFort(){
  makeSign();
  const fz=37, g=new THREE.Group(); g.position.set(0,0,fz); wadd(g);
  for(const [x,y,z,w,h,d] of [[-2.2,0.6,0,1.6,1.2,2.8],[2.2,0.6,0,1.6,1.2,2.8],[0,0.6,1.1,2.8,1.2,0.6],[-2.2,1.7,0.2,1.4,1,2],[2.2,1.7,-0.2,1.4,1,2]]){
    const b=shadowy(new THREE.Mesh(new THREE.BoxGeometry(w,h,d),OM.fort)); b.position.set(x,y,z); g.add(b);
    const t=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.02,d+0.01),braceM); t.position.set(x,y+h/2+0.01,z); g.add(t);
  }
  const roof=new THREE.Mesh(new THREE.BoxGeometry(6.2,0.08,3.4),OM.blanket); roof.position.set(0,2.25,0); roof.rotation.z=0.04; g.add(roof);
  const sign=new THREE.Mesh(new THREE.BoxGeometry(3.4,0.85,0.08),[braceM,braceM,braceM,braceM,braceM,new THREE.MeshLambertMaterial({map:signTex})]);
  sign.rotation.y=Math.PI; sign.position.set(0,2.85,-0.4); g.add(sign);
  addBox(-3,3,-1,2.3,fz-1.6,fz+1.6);
}
// a long wall made of breakable drywall sections, with doorway gaps
const CEIL=6;
function drywallRun(axis,fixed,from,to,gaps,h){
  const cuts=[from,...gaps.flatMap(g=>[g-1.3,g+1.3]),to];
  for(let i=0;i<cuts.length;i+=2){const a=cuts[i],b=cuts[i+1];if(b-a<0.5)continue;const n=Math.max(1,Math.round((b-a)/4)),seg=(b-a)/n;
    for(let k=0;k<n;k++){const c=a+seg*(k+0.5); if(axis==='x') addDestruct('drywall',c,0,fixed,seg-0.04,h||CEIL,0.16,false); else addDestruct('drywall',fixed,0,c,seg-0.04,h||CEIL,0.16,true)}}
}
function buildOffice(r){
  makeTextures(); bridgeZ=999;
  const g=new THREE.PlaneGeometry(100,100,50,50); g.rotateX(-Math.PI/2);
  const p=g.attributes.position, col=[], c=new THREE.Color();
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);
    if(z>22&&Math.abs(x)<39) c.set(((Math.floor(x/2)+Math.floor(z/2))&1)?'#bdb6aa':'#b1aa9e');
    else if(z<-13&&z>-40) c.set(((Math.floor(x/3)+Math.floor(z/3))&1)?'#6b6f76':'#62666d');
    else c.set(((Math.floor(x/4)+Math.floor(z/4))&1)?'#5d6673':'#555e6a');
    col.push(c.r,c.g,c.b)}
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3)); g.computeVertexNormals();
  const fl=wadd(new THREE.Mesh(g,OM.carpet)); fl.receiveShadow=true;
  const ce=wadd(new THREE.Mesh(new THREE.PlaneGeometry(100,100),OM.ceil)); ce.rotation.x=Math.PI/2; ce.position.y=CEIL;
  addBox(-60,60,CEIL,CEIL+4,-60,60);
  solid(0,48.2,81,CEIL,0.4,OM.wall); solid(0,-48.2,81,CEIL,0.4,OM.wall); solid(40.2,0,0.4,CEIL,96.8,OM.wall); solid(-40.2,0,0.4,CEIL,96.8,OM.wall);
  for(const [x,z,w,d] of [[0,47.98,80,0.02],[0,-47.98,80,0.02],[39.98,0,0.02,96],[-39.98,0,0.02,96]]){const b=wadd(new THREE.Mesh(new THREE.BoxGeometry(w,1.3,d),OM.winBand));b.position.set(x,2.0,z)}
  const lp=[]; for(let x=-36;x<=36;x+=6)for(let z=-44;z<=44;z+=6)lp.push([x,z]);
  const li=new THREE.InstancedMesh(new THREE.BoxGeometry(1.4,0.04,0.6),officeLight,lp.length), dm=new THREE.Object3D();
  lp.forEach(([x,z],i)=>{dm.position.set(x,CEIL-0.02,z);dm.updateMatrix();li.setMatrixAt(i,dm.matrix)}); li.instanceMatrix.needsUpdate=true; wadd(li);
  buildFort();
  const desks=[], chairs=[], plants=[];
  // ---- break room (spawn) ----
  for(const [x,z] of [[-11,30],[11,30],[-11,42],[11,42]]){solid(x,z,3,0.8,1,OM.couch)}
  solid(-11,27,1.6,0.45,0.8,OM.table); solid(11,27,1.6,0.45,0.8,OM.table);
  for(const sx of[-1,1]){const v=solid(sx*16,45.5,1.3,2.1,0.9,OM.vend);const f=new THREE.Mesh(new THREE.BoxGeometry(0.9,1.3,0.02),OM.vendFront);f.position.set(0,0.15,-0.46);v.add(f)}
  solid(-27,44,10,1.0,1.2,OM.desk); solid(27,44,10,1.0,1.2,OM.desk); solid(-22,34,1.2,1.0,6,OM.desk); solid(22,34,1.2,1.0,6,OM.desk);
  for(const [x,z] of [[-33,30],[33,30],[-30,38],[30,38],[-17,26],[17,26]]) solid(x,z,2.2,0.75,2.2,OM.table);
  addDestruct('cooler',-19,0,40,0.5,1.4,0.5,false); addDestruct('cooler',19,0,40,0.5,1.4,0.5,false);
  plants.push([-6,24,0.55],[6,24,0.55],[-37,24,0.6],[37,24,0.6],[-37,46,0.6],[37,46,0.6]);
  drywallRun('x',22,-40,40,[-24,-1.6,1.6,24]);
  // ---- work floor ----
  const S=3.4;
  const farm=(x0,z0,cols,rows)=>{
    for(let j=0;j<rows;j++){
      const pairBase=Math.floor(j/2)*(2*S+2.4), even=j%2===0, zc=z0+pairBase+(even?S/2:S*1.5);
      for(let i=0;i<cols;i++){
        const xc=x0+i*S+S/2;
        if(even) addDestruct('partition',xc,0,z0+pairBase+S,S,1.35,0.08,false);
        addDestruct('partition',x0+i*S,0,zc,S-0.25,1.35,0.08,true);
        if(i===cols-1) addDestruct('partition',x0+cols*S,0,zc,S-0.25,1.35,0.08,true);
        const dz=even?zc+S/2-0.5:zc-S/2+0.5; desks.push([xc,dz,even?1:-1]); chairs.push([xc+rand(-0.3,0.3),dz+(even?-1:1)*0.95]);
      }
    }
  };
  farm(-38,-11,6,6); farm(17.6,-11,6,6);
  // desk pods in the middle: four desks around a cross of partitions
  for(const x of[-8,8]) for(const z of[-7,3,13]){
    addDestruct('partition',x,0,z,4,1.35,0.08,false); addDestruct('partition',x,0,z,4,1.35,0.08,true);
    for(const [ox,oz,f] of [[-1.1,-1.1,-1],[1.1,-1.1,-1],[-1.1,1.1,1],[1.1,1.1,1]]){desks.push([x+ox,z+oz*1.05,f]);chairs.push([x+ox,z+oz*1.05+f*0.95])}
  }
  // filing cabinet spine down the middle, with gaps
  for(const z of[-9,-1,7,15]) solid(0,z,0.7,1.3,3.2,OM.cab);
  for(const x of[-14.5,14.5]) for(const z of[-8,4,16]) solid(x,z,0.9,CEIL,0.9,OM.column);
  for(const [x,z] of [[-3.5,-4],[3.5,10],[-3.5,18],[3.5,-10],[-14.5,10],[14.5,-2]]) addDestruct('board',x,0,z,1.8,1.7,0.08,(x*z)%2>0);
  solid(-3,1,1.2,1.0,0.8,OM.printer); solid(3,19,1.2,1.0,0.8,OM.printer);
  for(const [x,z] of [[-14.5,-2],[14.5,10],[0,3],[-5,20],[5,-12]]) plants.push([x,z,0.55]);
  addDestruct('cooler',-14.5,0,16.9,0.5,1.4,0.5,false); addDestruct('cooler',14.5,0,-8.9,0.5,1.4,0.5,false);
  // corridor wall between the work floor and the back half
  drywallRun('x',-13,-40,40,[-30,-6,6,30]);
  // ---- back half: conference rooms, servers, storage, offices ----
  const room=(x0,x1,z0,z1)=>{
    const w=x1-x0, nx=Math.round(w/2.4), gw=w/nx;
    for(let k=0;k<nx;k++){const x=x0+gw*(k+0.5); if(k!==Math.floor(nx/2)) addDestruct('glass',x,0,z1,gw-0.05,2.4,0.05,false); addDestruct('glass',x,0,z0,gw-0.05,2.4,0.05,false)}
    const d=z1-z0, nz=Math.round(d/2.4), gd=d/nz;
    for(let k=0;k<nz;k++){const z=z0+gd*(k+0.5); addDestruct('glass',x0,0,z,gd-0.05,2.4,0.05,true); addDestruct('glass',x1,0,z,gd-0.05,2.4,0.05,true)}
    const cx=(x0+x1)/2, cz=(z0+z1)/2; solid(cx,cz,w*0.45,0.75,1.6,OM.table); interiorSpots.push([cx+w*0.35,cz]);
    for(let k=-1;k<=1;k++){chairs.push([cx+k*1.4,cz-1.3]);chairs.push([cx+k*1.4,cz+1.3])}
  };
  room(-37,-27,-26,-16); room(-25,-16,-26,-16); room(16,25,-26,-16); room(27,37,-26,-16);
  solid(0,-28,10,CEIL,8,OM.elev);
  for(const x of[-3,0,3]){const d=wadd(new THREE.Mesh(new THREE.BoxGeometry(1.8,2.4,0.05),OM.elevDoor));d.position.set(x,1.2,-23.97);const a=wadd(new THREE.Mesh(new THREE.BoxGeometry(0.25,0.12,0.02),OM.arrow));a.position.set(x,2.65,-23.95)}
  // server racks with blinking lights
  for(const x of[-12.5,-9.5,9.5,12.5]){const rk=solid(x,-20,0.9,2.2,5,OM.rack);for(let k=0;k<6;k++){const l=new THREE.Mesh(new THREE.BoxGeometry(0.02,0.05,0.05),k%3?OM.led:OM.ledR);l.position.set(x<0?0.46:-0.46,-0.6+k*0.25,-2+k*0.7);rk.add(l)}}
  // storage maze of boxes
  for(let n=0,t=0;n<26&&t<300;t++){const x=(r()<0.5?-1:1)*rand(8,37),z=rand(-38,-29);if(boxes.some(b=>x>b.x0-0.9&&x<b.x1+0.9&&z>b.z0-0.9&&z<b.z1+0.9))continue;
    const q=r(); if(q<0.5) addDestruct('cardboard',x,-0.05,z,0.9,0.7,0.8,false); else if(q<0.8) addDestruct('crate',x,-0.05,z,1,1,1,false); else solid(x,z,0.6,1.3,1.8,OM.cab); n++}
  interiorSpots.push([-30,-33],[30,-33],[0,-36]);
  // executive offices along the back wall
  const walls=[-38,-31,-24,-17,17,24,31,38];
  for(const x of walls) addDestruct('drywall',x,0,-44,7.8,CEIL,0.16,true);
  for(let k=0;k<walls.length-1;k++){const a=walls[k],b=walls[k+1]; if(b-a>8) continue; const gap=1.4, seg=(b-a-gap)/2;
    addDestruct('drywall',a+seg/2,0,-40,seg,CEIL,0.16,false); addDestruct('drywall',b-seg/2,0,-40,seg,CEIL,0.16,false);
    desks.push([(a+b)/2,-46,1]); chairs.push([(a+b)/2,-44.8]); plants.push([a+1,-47,0.5]); interiorSpots.push([(a+b)/2+2,-43])}
  for(const [x,z] of [[-8,-42],[8,-42],[-12,-36],[12,-36]]) solid(x,z,0.6,1.3,0.6,OM.cab);
  // desks, monitors and chairs, instanced
  const dI=new THREE.InstancedMesh(new THREE.BoxGeometry(1.8,0.75,0.7),OM.desk,desks.length), mI=new THREE.InstancedMesh(new THREE.BoxGeometry(0.6,0.38,0.05),OM.mon,desks.length), sI=new THREE.InstancedMesh(new THREE.BoxGeometry(0.52,0.3,0.01),OM.screen,desks.length);
  desks.forEach(([x,z,f],i)=>{dm.position.set(x,0.375,z);dm.updateMatrix();dI.setMatrixAt(i,dm.matrix);dm.position.set(x,0.98,z+f*0.1);dm.updateMatrix();mI.setMatrixAt(i,dm.matrix);dm.position.set(x,0.99,z+f*0.07);dm.updateMatrix();sI.setMatrixAt(i,dm.matrix);addBox(x-0.9,x+0.9,-1,0.75,z-0.35,z+0.35)});
  const cI=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.26,0.26,0.12,10),OM.chair,chairs.length), cbI=new THREE.InstancedMesh(new THREE.BoxGeometry(0.46,0.5,0.06),OM.chair,chairs.length);
  chairs.forEach(([x,z],i)=>{dm.position.set(x,0.48,z);dm.updateMatrix();cI.setMatrixAt(i,dm.matrix);dm.position.set(x,0.8,z+0.24);dm.updateMatrix();cbI.setMatrixAt(i,dm.matrix)});
  [dI,mI,sI,cI,cbI].forEach(m=>{m.instanceMatrix.needsUpdate=true;m.receiveShadow=true;wadd(m)});
  const ok=plants.filter(([x,z])=>!boxes.some(b=>x>b.x0-0.4&&x<b.x1+0.4&&z>b.z0-0.4&&z<b.z1+0.4));
  ok.forEach(([x,z])=>solid(x,z,0.6,0.45,0.6,OM.pot)); instBushes(ok);
}
buildWorld((Math.random()*1e9)|0,startLevel);

// ---------- people rigs ----------
const UP=new THREE.Vector3(0,1,0), tmpV=new THREE.Vector3(), tmpV2=new THREE.Vector3(), tmpV3=new THREE.Vector3(), tmpM=new THREE.Matrix4();
const cylG=new THREE.CylinderGeometry(1,1,1,8);
const headG=new THREE.SphereGeometry(0.15,12,10);
const SEGS=[[1,2,0.17,'shirt'],[1,3,0.06,'shirt'],[3,4,0.055,'skin'],[1,5,0.06,'shirt'],[5,6,0.055,'skin'],[2,7,0.085,'shorts'],[7,8,0.07,'skin'],[2,9,0.085,'shorts'],[9,10,0.07,'skin']];
const CONS=[[0,1],[1,2],[1,3],[3,4],[1,5],[5,6],[2,7],[7,8],[2,9],[9,10],[0,2],[7,9]];
const SKIN=lam('#e0b48a'), TIPM=lam('#ff7a1a'), DARKM=lam('#2a2a28'), PLATEM=lam('#8a929c'), SCARFM=lam('#3c8a4f');
const laserMat=new THREE.LineBasicMaterial({color:'#ff3b2f',transparent:true,opacity:0.75}); if(window.GFX) GFX.glow(laserMat,3);
const ETYPES={
  basic:{key:'basic',label:'Scout',s:1,hp:w=>2+Math.floor((w-1)/2),speed:3.2,spread:0.05,dmg:15,dSpeed:20,fire:[1.3,2.5],want:10,growl:85,
    shirt:'#4f4d3a',shorts:'#2b2f22',hat:'hat',hatCol:'#2c2a22',gun:'blaster',gunCol:'#2f4f2a',eye:'#ff3b2f',pts:100},
  runner:{key:'runner',label:'Runner',s:0.75,hp:w=>1+Math.floor((w-1)/3),speed:7.2,spread:0.28,dmg:10,dSpeed:18,fire:[0.7,1.3],want:7,growl:150,
    shirt:'#6e1b1b',shorts:'#1d1b1a',hat:'band',hatCol:'#c22a1a',gun:'small',gunCol:'#3a3a3a',eye:'#ffd23f',pts:125,intro:'Runners are small, fast and twitchy, but their aim is sloppy.'},
  sniper:{key:'sniper',label:'Sniper',s:1,hp:w=>2+Math.floor((w-1)/3),speed:2.3,spread:0.006,dmg:30,dSpeed:44,fire:[3.4,4.6],growl:110,
    shirt:'#25361f',shorts:'#1d2a18',hat:'hood',hatCol:'#1f2d1a',gun:'long',gunCol:'#1d1d1f',eye:'#8cff6a',pts:175,intro:'Snipers hide behind bushes and hit hard. Watch for the red laser before they fire.'},
  heavy:{key:'heavy',label:'Heavy',s:1.25,hp:w=>6+Math.floor(w/2),speed:2.0,dmg:25,melee:true,armor:0.25,growl:58,
    shirt:'#2e2321',shorts:'#232323',hat:'helmet',hatCol:'#4b5058',gun:'bat',gunCol:'#a8281a',eye:'#ff7a1a',pts:200,intro:'Heavies wear spiked armor on the front and swing foam bats. Go for the head or hit them from behind.'},
  boss:{key:'boss',label:'Scoutmaster Thorne',s:2,hp:w=>40*(w/5),speed:1.9,spread:0.07,dmg:15,dSpeed:22,fire:[2.0,2.7],burst:5,want:13,melee:true,meleeDmg:35,armor:0.4,growl:40,
    shirt:'#1c1416',shorts:'#121012',hat:'horns',hatCol:'#120e0c',gun:'blaster',gunCol:'#5a0f0f',eye:'#ff1e1e',pts:1000,boss:true}
};
const MASKM=lam('#121214'), EYEM={}, GLOWM={};
const eyeG=new THREE.SphereGeometry(0.028,8,6), glowG=new THREE.SphereGeometry(0.06,8,6), maskG=new THREE.BoxGeometry(0.27,0.2,0.07), spikeG=new THREE.ConeGeometry(0.035,0.14,6), hornG=new THREE.ConeGeometry(0.05,0.36,8);
function makeRig(tk){
  const T=ETYPES[tk||'basic'], g=new THREE.Group();
  const mats={shirt:lam(T.shirt),skin:SKIN.clone(),shorts:lam(T.shorts)};
  const segs=SEGS.map(([a,b,r,m])=>{const mesh=shadowy(new THREE.Mesh(cylG,mats[m]));mesh.userData={a,b,r};g.add(mesh);return mesh});
  const head=shadowy(new THREE.Mesh(headG,mats.skin)); g.add(head);
  const hm=lamC(T.hatCol);
  if(T.hat==='hat'){const brim=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.22,0.03,12),hm);brim.position.y=0.08;head.add(brim);const crown=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.13,0.12,10),hm);crown.position.y=0.15;head.add(crown)}
  else if(T.hat==='band'){const b=new THREE.Mesh(new THREE.TorusGeometry(0.15,0.03,6,14),hm);b.rotation.x=Math.PI/2;b.position.y=0.05;head.add(b)}
  else if(T.hat==='hood'){const h=new THREE.Mesh(new THREE.SphereGeometry(0.18,12,10,0,Math.PI*2,0,Math.PI*0.62),hm);h.rotation.x=-0.4;h.position.z=-0.02;head.add(h)}
  else if(T.hat==='helmet'){const h=new THREE.Mesh(new THREE.SphereGeometry(0.185,12,8,0,Math.PI*2,0,Math.PI/2),hm);h.position.y=0.02;head.add(h);const v=new THREE.Mesh(new THREE.BoxGeometry(0.24,0.035,0.04),DARKM);v.position.set(0,0,0.16);head.add(v)}
  else if(T.hat==='horns'){const h=new THREE.Mesh(new THREE.SphereGeometry(0.19,12,8,0,Math.PI*2,0,Math.PI/2),hm);h.position.y=0.02;head.add(h);
    for(const sx of[-1,1]){const hr=new THREE.Mesh(hornG,lamC('#d8cfb8'));hr.position.set(sx*0.15,0.2,0);hr.rotation.z=-sx*0.7;head.add(hr)}}
  if(T.hat==='helmet'){for(let k=0;k<3;k++){const sp=new THREE.Mesh(spikeG,PLATEM);sp.position.set(0,0.19,-0.08+k*0.08);head.add(sp)}}
  // dark mask with glowing eyes
  if(!EYEM[T.eye]){EYEM[T.eye]=new THREE.MeshBasicMaterial({color:T.eye});GLOWM[T.eye]=new THREE.MeshBasicMaterial({color:T.eye,transparent:true,opacity:0.35,blending:THREE.AdditiveBlending,depthWrite:false});if(window.GFX){GFX.glow(EYEM[T.eye],3.2);GFX.glow(GLOWM[T.eye],2.4)}}
  const mask=new THREE.Mesh(maskG,MASKM); mask.position.set(0,-0.01,0.115); head.add(mask);
  for(const sx of[-1,1]){const e1=new THREE.Mesh(eyeG,EYEM[T.eye]);e1.position.set(sx*0.058,0.015,0.155);head.add(e1);const e2=new THREE.Mesh(glowG,GLOWM[T.eye]);e2.position.copy(e1.position);head.add(e2)}
  let scarf=null; if(T.hat==='hat'){scarf=new THREE.Mesh(new THREE.ConeGeometry(0.1,0.18,3),SCARFM);g.add(scarf)}
  const gun=new THREE.Group(); gun.rotation.order='YXZ'; const gm=lamC(T.gunCol);
  const gadd=(geo,m,x,y,z,rx)=>{const me=new THREE.Mesh(geo,m);me.position.set(x,y,z);if(rx)me.rotation.x=rx;gun.add(me);return me};
  if(T.gun==='blaster'){gadd(new THREE.BoxGeometry(0.1,0.12,0.42),gm,0,0,0);gadd(new THREE.BoxGeometry(0.06,0.06,0.06),TIPM,0,0,0.24)}
  if(T.gun==='small'){gadd(new THREE.BoxGeometry(0.08,0.1,0.26),gm,0,0,0.02);gadd(new THREE.BoxGeometry(0.05,0.05,0.05),TIPM,0,0,0.17)}
  if(T.gun==='long'){gadd(new THREE.BoxGeometry(0.07,0.09,0.75),gm,0,0,0.12);gadd(new THREE.CylinderGeometry(0.03,0.03,0.2,8),DARKM,0,0.08,0.02,Math.PI/2);gadd(new THREE.BoxGeometry(0.04,0.04,0.04),TIPM,0,0,0.51)}
  if(T.gun==='bat'){gadd(new THREE.CylinderGeometry(0.03,0.03,0.25,8),DARKM,0,0,0.05,Math.PI/2);gadd(new THREE.CylinderGeometry(0.09,0.075,0.85,10),gm,0,0,0.6,Math.PI/2)}
  g.add(gun);
  let plate=null; if(T.armor){plate=shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.38,0.36,0.08),PLATEM));g.add(plate);
    for(const[px,py]of[[-0.12,0.1],[0.12,0.1],[0,-0.05],[-0.12,-0.12],[0.12,-0.12]]){const sp=new THREE.Mesh(spikeG,DARKM);sp.rotation.x=Math.PI/2;sp.position.set(px,py,0.1);plate.add(sp)}}
  scene.add(g);
  return {g,segs,head,scarf,gun,mats,plate,s:T.s};
}
function setFlash(rig,a){a=Math.max(0,a);for(const k in rig.mats)rig.mats[k].emissive.setRGB(a*1.0,a*0.45,a*0.1)}
function frontOf(P,out){ // facing direction of a body from its shoulders and spine
  tmpV.subVectors(P[5],P[3]); tmpV2.subVectors(P[1],P[2]).normalize();
  return out.crossVectors(tmpV,tmpV2).normalize();
}
function poseRig(rig,P,alive,yaw,gunPitch){
  const s=rig.s;
  rig.segs.forEach(m=>{const{a,b,r}=m.userData;tmpV.subVectors(P[b],P[a]);const L=tmpV.length()||0.001;m.position.addVectors(P[a],P[b]).multiplyScalar(0.5);m.quaternion.setFromUnitVectors(UP,tmpV.divideScalar(L));m.scale.set(r*s,L,r*s)});
  rig.head.position.copy(P[0]); rig.head.scale.setScalar(s);
  if(alive){rig.head.quaternion.setFromAxisAngle(UP,yaw)} else {tmpV.subVectors(P[0],P[1]).normalize();rig.head.quaternion.setFromUnitVectors(UP,tmpV)}
  if(rig.scarf){rig.scarf.position.copy(P[1]).lerp(P[0],0.25);rig.scarf.quaternion.copy(rig.head.quaternion);rig.scarf.rotateX(Math.PI);rig.scarf.scale.setScalar(s)}
  rig.gun.visible=alive;
  if(alive){rig.gun.position.addVectors(P[4],P[6]).multiplyScalar(0.5);rig.gun.rotation.set(gunPitch||0,yaw,0);rig.gun.scale.setScalar(s)}
  if(rig.plate){
    const f=frontOf(P,tmpV3), up=tmpV2.subVectors(P[1],P[2]).normalize(), rt=tmpV.crossVectors(up,f).normalize();
    tmpM.makeBasis(rt,up,f); rig.plate.quaternion.setFromRotationMatrix(tmpM);
    rig.plate.position.addVectors(P[1],P[2]).multiplyScalar(0.5).addScaledVector(f,0.15*s); rig.plate.scale.setScalar(s);
  }
}
const LOCAL=[[0,1.33,0],[0,1.1,0],[0,0.74,0],[-0.2,0.96,0.12],[-0.06,1.0,0.36],[0.2,0.95,0.08],[0.07,0.98,0.26],[-0.1,0.4,0],[-0.1,0.05,0],[0.1,0.4,0],[0.1,0.05,0]];
function standPose(out,x,y,z,yaw,phase,amp,sc){
  sc=sc||1;
  const c=Math.cos(yaw),s=Math.sin(yaw),sw=Math.sin(phase)*amp,bob=Math.abs(Math.cos(phase))*0.05*amp;
  LOCAL.forEach((l,i)=>{let lx=l[0],ly=l[1]+bob,lz=l[2]; if(i===0)lz+=0.09; if(i===1)lz+=0.05;
    if(i===7){lz+=sw*0.18}if(i===8){lz+=sw*0.36;ly+=Math.max(0,-sw)*0.12}
    if(i===9){lz-=sw*0.18}if(i===10){lz-=sw*0.36;ly+=Math.max(0,sw)*0.12}
    lx*=sc;ly*=sc;lz*=sc;
    out[i].set(x+lx*c+lz*s,y+ly,z-lx*s+lz*c)});
}

// ---------- game state ----------
let mode='menu', paused=false, inputMode='lock';
const P={x:0,y:0,z:31,vy:0,yaw:0,pitch:0,hp:100,onGround:true,lastHit:0,kx:0,kz:0};
let weapon, ammo=0, cool=0, reloadT=0, fireHeld=false, fireLatch=false, zoomed=false, recoil=0, gunKick=0;
let enemies=[], ragdolls=[], darts=[], turtles=[];
let wave=0, waveT=0, score=0, stats={tags:0,heads:0,shots:0,hits:0,turtle:0}, clock=0, deadT=0, enemySeq=0;
let roster=[], seenTypes=new Set(), envK=0, envTarget=0;
let rockets=[], puffs=[], flashes=[], special=null, hasScope=false, slot=0, shake=0;
let crouch=false, eyeH=EYE, modTier={}, golden=false, directorT=0, winFrom='play', slideT=0, sprinting=false, lastMv={x:0,z:-1};
let goldBuilt=0; try{goldBuilt=parseInt(localStorage.getItem('gullyGolden')||'0',10)||0}catch(e){}
const keys={};

// viewmodel
let viewGun=null;
function buildViewGun(k){
  if(viewGun){camera.remove(viewGun);freeObj(viewGun,true);viewGun=null}
  if(slot===1&&special){const g=new THREE.Group(),add=(geo,mat,x,y,z,rx)=>{const me=new THREE.Mesh(geo,mat);me.position.set(x,y,z);if(rx)me.rotation.x=rx;me.renderOrder=999;g.add(me);return me};
    add(new THREE.CylinderGeometry(0.075,0.075,0.7,14),lamD('#4f5b3a'),0,0.02,-0.12,Math.PI/2);add(new THREE.CylinderGeometry(0.085,0.085,0.06,14),lamD('#ff7a1a'),0,0.02,-0.48,Math.PI/2);
    add(new THREE.BoxGeometry(0.05,0.12,0.06),lamD('#2a2a28'),0,-0.09,0.02);add(new THREE.BoxGeometry(0.04,0.06,0.1),lamD('#2a2a28'),-0.06,0.1,-0.05);
    g.scale.setScalar(0.6);g.position.set(0.22,-0.2,-0.42);camera.add(g);viewGun=g;return}
  const g=new THREE.Group(), m=skinMaterial(), o=lamD('#ff7a1a'), d=lamD('#2a2a28'), w=lamD('#f4f1e6');
  const add=(geo,mat,x,y,z,rx)=>{const me=new THREE.Mesh(geo,mat);me.position.set(x,y,z);if(rx)me.rotation.x=rx;me.renderOrder=999;g.add(me);return me};
  add(new THREE.BoxGeometry(0.08,0.1,0.3),m,0,0,0);
  add(new THREE.BoxGeometry(0.05,0.12,0.06),d,0,-0.09,0.07);
  if(k.id==='rosa'){add(new THREE.CylinderGeometry(0.02,0.02,0.16,8),w,0,0.01,-0.22,Math.PI/2);add(new THREE.CylinderGeometry(0.065,0.065,0.06,14),o,0,-0.07,-0.04);add(new THREE.BoxGeometry(0.03,0.03,0.03),o,0,0.01,-0.31)}
  if(k.id==='dev'){for(const x of[-0.02,0.02])add(new THREE.CylinderGeometry(0.022,0.022,0.22,8),w,x,0.015,-0.24,Math.PI/2);add(new THREE.BoxGeometry(0.07,0.05,0.12),lamD('#8a5a2b'),0,-0.04,-0.2);add(new THREE.BoxGeometry(0.08,0.035,0.03),o,0,0.015,-0.36)}
  if(k.id==='tibbs'){add(new THREE.CylinderGeometry(0.018,0.018,0.42,8),w,0,0.01,-0.34,Math.PI/2);add(new THREE.CylinderGeometry(0.028,0.028,0.16,10),d,0,0.08,-0.02,Math.PI/2);add(new THREE.BoxGeometry(0.025,0.025,0.03),o,0,0.01,-0.56)}
  {const tc=key=>lamD(LV_COL[Math.max(0,tuneLv[key]-1)]), bz=k.id==='tibbs'?-0.56:k.id==='dev'?-0.37:-0.32;
    if(mods.dmg){add(new THREE.CylinderGeometry(0.034,0.03,0.07,12),tc('dmg'),0,0.012,bz-0.02,Math.PI/2)}
    if(mods.rate){for(let i=0;i<4;i++){add(new THREE.TorusGeometry(0.034,0.006,6,16),tc('rate'),0,0.012,bz+0.09+i*0.03)}}
    if(mods.mag){const h=0.08+Math.min(0.08,mods.mag*0.12);add(new THREE.BoxGeometry(0.07,h,0.11),tc('mag'),0,-0.05-h/2,-0.13)}
    if(mods.reload){add(new THREE.BoxGeometry(0.018,0.06,0.15),tc('reload'),-0.05,0.005,-0.03)}
    if(mods.speed){add(new THREE.CylinderGeometry(0.024,0.024,0.2,10),tc('speed'),0,-0.06,-0.25,Math.PI/2)}}
  if(ammoType==='paint') add(new THREE.SphereGeometry(0.06,12,10),lamD(paintCol()),0,0.1,0.03);
  else if(ammoType==='airsoft') add(new THREE.BoxGeometry(0.035,0.11,0.05),lamD('#2a2a28'),0,-0.1,-0.07);
  if(twinOn()) add(new THREE.CylinderGeometry(0.016,0.016,0.2,8),w,0,0.045,-0.24,Math.PI/2);
  if(owned.has('lucky')) add(new THREE.SphereGeometry(0.022,8,6),lamD('#5fae5a'),-0.03,-0.09,0.1);
  if(rares.has('laser')) add(new THREE.BoxGeometry(0.022,0.022,0.07),lamD('#c22a2a'),0.045,-0.035,-0.18);
  if(hasScope&&k.id!=='tibbs'){add(new THREE.CylinderGeometry(0.028,0.028,0.17,10),d,0,0.085,-0.03,Math.PI/2);add(new THREE.CylinderGeometry(0.03,0.03,0.01,10),lamD('#5fb6e0'),0,0.085,-0.12,Math.PI/2)}
  g.position.set(0.2,-0.19,-0.42); camera.add(g); viewGun=g;
}
function lamD(c){return new THREE.MeshLambertMaterial({color:c,depthTest:false,depthWrite:false,transparent:true,opacity:1})}

// darts
const dartG=new THREE.CylinderGeometry(0.02,0.02,0.16,6); dartG.translate(0,-0.02,0);
const dartTipG=new THREE.CylinderGeometry(0.024,0.024,0.04,6); dartTipG.translate(0,0.07,0);
const dartGold=lam('#f2c94c'), dartBody=lam('#3fa7d6'), dartBodyE=lam('#e8e1c4'), dartTip=lam('#ff7a1a'), dartTipE=lam('#d23b2a');
const paintG=new THREE.SphereGeometry(0.045,10,8), bbG=new THREE.SphereGeometry(0.016,6,4), bbM=lam('#f4f1e6'), paintMats={};
function spawnDart(pos,vel,owner,knock,dmg){
  const g=new THREE.Group(), at=owner==='p'?ammoType:'foam';
  if(at==='paint'){const c=paintCol();if(!paintMats[c])paintMats[c]=lam(c);g.add(new THREE.Mesh(paintG,paintMats[c]))}
  else if(at==='airsoft'){g.add(new THREE.Mesh(bbG,golden?dartGold:bbM))}
  else {g.add(new THREE.Mesh(dartG,owner==='p'?(golden?dartGold:dartBody):dartBodyE)); g.add(new THREE.Mesh(dartTipG,owner==='p'?dartTip:dartTipE))}
  g.position.copy(pos); scene.add(g);
  darts.push({g,p:pos.clone(),v:vel.clone(),owner,at,grav:owner==='p'?2.5*AMMO[at].grav:4,knock:knock||1,dmg:dmg||15,stuck:0,life:0,dist:0});
}

function hasLOS(a,b,ignoreR){
  const d=tmpV2.subVectors(b,a), L=d.length(), n=Math.ceil(L/0.5), ig=(ignoreR||0)**2;
  for(let i=1;i<n;i++){const t=i/n,x=a.x+d.x*t,y=a.y+d.y*t,z=a.z+d.z*t;if(y<GH(x,z))return false;for(const bx of boxes)if(x>bx.x0&&x<bx.x1&&y>bx.y0&&y<bx.y1&&z>bx.z0&&z<bx.z1)return false;
    for(const b of bushes)if(Math.abs(x-b.x)<b.r&&Math.abs(z-b.z)<b.r&&y<b.y+b.r*0.5&&(x-b.x)**2+(z-b.z)**2<b.r*b.r&&(a.x-b.x)**2+(a.z-b.z)**2>ig)return false}
  return true;
}
function segDist(p,a,b){const ab=tmpV.subVectors(b,a),t=clamp(tmpV2.subVectors(p,a).dot(ab)/(ab.lengthSq()||1),0,1);return p.distanceTo(tmpV2.copy(a).addScaledVector(ab,t))}

// ---------- enemies ----------
const groundBlocked=(x,z,pad)=>boxes.some(b=>b.y0<2&&b.y1>0.3&&x>b.x0-pad&&x<b.x1+pad&&z>b.z0-pad&&z<b.z1+pad);
function farSpotOld(minD){
  let best=null,bd=-1;
  for(let i=0;i<160;i++){
    const x=rand(-33,33),z=rand(-41,41);
    if(GH(x,z)<WATER+0.1||boxes.some(b=>x>b.x0-0.8&&x<b.x1+0.8&&z>b.z0-0.8&&z<b.z1+0.8)) continue;
    const d=Math.hypot(x-P.x,z-P.z); if(d>=minD) return [x,z];
    if(d>bd){bd=d;best=[x,z]}
  }
  return best||[0,-40];
}
function farSpot(minD){
  const office=LV.kind==='office'; if(office) minD=Math.min(minD,24);
  let best=null,bs=-1;
  for(let i=0;i<140;i++){
    const x=rand(-33,33),z=rand(-41,41);
    if(GH(x,z)<WATER+0.1||groundBlocked(x,z,0.8)) continue;
    if(office&&z>20) continue;
    if(Math.hypot(x-P.x,z-P.z)<minD) continue;
    let sep=99; for(const e of enemies) sep=Math.min(sep,Math.hypot(e.x-x,e.z-z));
    const sc=Math.min(sep,20)+Math.random()*2; if(sc>bs){bs=sc;best=[x,z]}
    if(sep>=16&&i>25) break;
  }
  return best||[rand(-20,20),-36];
}
function pickPerch(e){
  let pick=null;
  for(let i=0;i<40&&bushes.length;i++){const b=bushes[Math.random()*bushes.length|0],d=Math.hypot(b.x-P.x,b.z-P.z);if(d>20&&d<34&&GH(b.x,b.z)>WATER+0.2){pick=b;break}}
  if(!pick){const [x,z]=farSpot(22);return {x,z}}
  const ax=pick.x-P.x,az=pick.z-P.z,al=Math.hypot(ax,az)||1;
  return {x:clamp(pick.x+ax/al*(pick.r+0.45),-34,34),z:clamp(pick.z+az/al*(pick.r+0.45),-42,42)};
}
function spawnEnemy(tk){
  const T=ETYPES[tk], [x,z]=farSpot(T.boss?42:46), hp=T.hp(wave);
  const e={t:T,rig:makeRig(tk),pts:LOCAL.map(()=>new THREE.Vector3()),x,z,y:GH(x,z),yaw:Math.atan2(P.x-x,P.z-z),phase:Math.random()*6,hp,maxHp:hp,
    fireT:rand(2,4),ang:Math.random()*Math.PI*2,strafe:Math.random()<0.5?1:-1,strafeT:rand(1,3),name:T.boss?T.label:NAMES[enemySeq++%NAMES.length],
    vx:0,vz:0,flinch:0,jx:0,jz:0,jT:0,swing:0,swingHit:true,meleeCD:1,aim:0,perch:null,noLos:0};
  if(tk==='sniper'){e.laser=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),laserMat);e.laser.visible=false;e.laser.frustumCulled=false;scene.add(e.laser)}
  enemies.push(e); return e;
}
function disposeEnemy(e){freeRig(e.rig);if(e.mark){e.mark.remove();e.mark=null}if(e.laser){scene.remove(e.laser);e.laser.geometry.dispose();e.laser=null}}
function pushOutXZ(o,rad,feet,top){
  for(const b of boxes){
    if(feet>=b.y1-0.45||top<=b.y0) continue;
    const cx=clamp(o.x,b.x0,b.x1),cz=clamp(o.z,b.z0,b.z1),dx=o.x-cx,dz=o.z-cz,d=Math.hypot(dx,dz);
    if(d<rad){ if(d>0.0001){o.x=cx+dx/d*rad;o.z=cz+dz/d*rad} else {const l=o.x-b.x0,r=b.x1-o.x,f=o.z-b.z0,k=b.z1-o.z,m=Math.min(l,r,f,k);if(m===l)o.x=b.x0-rad;else if(m===r)o.x=b.x1+rad;else if(m===f)o.z=b.z0-rad;else o.z=b.z1+rad} }
  }
}
function supportY(x,z,feet,rad){
  let y=GH(x,z);
  for(const b of boxes){if(x>b.x0-rad*0.3&&x<b.x1+rad*0.3&&z>b.z0-rad*0.3&&z<b.z1+rad*0.3&&feet>=b.y1-0.45)y=Math.max(y,b.y1)}
  return y;
}
const BUILD=[['dmg','Damage','Heavy dart tips'],['rate','Fire rate','Turbo spring'],['mag','Capacity','Extended hopper'],['reload','Reload','Quick-load clip'],['speed','Dart speed','Air pump']];
let buildSig='', buildFlash=0, svgN=0;
const isGold=k=>tuneLv[k]>=5;
const goldCount=()=>BUILD.filter(b=>isGold(b[0])).length;
function goldMeter(){const n=progressN(),T=progressT();return `<div class="gm${golden?' done':''}"><span>${golden?'ULTIMATE WEAPON':'Ultimate weapon'}</span><span class="gmt"><i style="width:${n/T*100}%"></i></span><span>${n}/${T}</span></div>`}
function completeGolden(){
  if(golden||(mode!=='play'&&mode!=='break')) return; winFrom=mode;
  golden=true; weapon=computeWeapon(); if(slot===0) buildViewGun(weapon); buildFlash=1.5; score+=5000;
  goldBuilt++; try{localStorage.setItem('gullyGolden',String(goldBuilt))}catch(e){}
  sfx('bossdown',1.2); rumble(1,1,600); burst(new THREE.Vector3(P.x,P.y+1.2,P.z),60,2);
  mode='win'; paused=true; fireHeld=false; zoomed=false; for(const k in keys)keys[k]=false;
  try{document.exitPointerLock()}catch(e){} $('touch').hidden=true;
  $('brk').innerHTML=`<div class="brk-card win" role="dialog" aria-label="Ultimate weapon complete">
    <h2>You built the ultimate weapon!</h2>
    <p class="hint">You bought every item in the shop and finished with the Golden skin. The ${weapon.gun} now hits 25% harder, fires 25% faster, shoots straighter and fires gold. That is +5,000 points.</p>
    <div class="bigbuild">${blasterSVG(200)}<div>${goldMeter()}${buildBars(true)}</div></div>
    <dl class="blist"><dt>Score</dt><dd>${score}</dd><dt>Finished on</dt><dd>Wave ${wave}, ${LEVEL_NAME[curLevel]}</dd><dt>Scouts tagged</dt><dd>${stats.tags}</dd><dt>Ultimate weapons built</dt><dd>${goldBuilt}</dd></dl>
    <div class="row"><button class="btn" id="keepgo" type="button">Keep blasting</button><button class="btn ghost" id="winmenu" type="button">Back to HQ</button><span class="hint">${getPad()?'Cross to keep going':touchDevice?'':'Enter to keep going'}</span></div>
  </div>`;
  $('brk').hidden=false; $('keepgo').onclick=()=>keepPlaying(); $('winmenu').onclick=()=>{$('brk').hidden=true;paused=false;toMenu()}; $('keepgo').focus({preventScroll:true});
}
function keepPlaying(fromPad){
  if(mode!=='win') return; paused=false;
  if(winFrom==='break'){mode='break';nextWave(fromPad);return}
  $('brk').hidden=true; mode='play';
  if(fromPad===true||inputMode==='pad'&&getPad()){inputMode='pad'} else if(touchDevice){$('touch').hidden=false} else requestLock();
}
function blasterSVG(w){
  const k=weapon||KIDS[kidId], id='sk'+(svgN++), col=key=>LV_COL[Math.max(0,tuneLv[key]-1)], on=key=>tuneLv[key]>0, ghost='fill="none" stroke="rgba(255,255,255,.28)" stroke-dasharray="3 2" stroke-width="1.5"';
  const bl=k.id==='tibbs'?40:k.id==='dev'?28:22, scoped=owned.has('scope')||k.zoom, base=golden?'#f2c94c':(owned.has('color')?look.color:GREY);
  const dots=!golden&&owned.has('dots')&&look.dots, stripes=!golden&&owned.has('stripes')&&look.stripes;
  let g=`<svg viewBox="0 0 170 70" width="${w}" role="img" aria-label="Blaster build"><defs>`;
  g+=golden?`<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1b3"/><stop offset=".5" stop-color="#f2c94c"/><stop offset="1" stop-color="#a87a12"/></linearGradient>`
    :`<pattern id="${id}" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="${base}"/>${stripes?'<path d="M-2 10 L8 -2 M3 12 L13 0" stroke="rgba(255,255,255,.4)" stroke-width="3"/>':''}${dots?'<circle cx="5" cy="5" r="2.2" fill="rgba(255,255,255,.85)"/>':''}</pattern>`;
  g+=`</defs><rect x="10" y="24" width="24" height="12" rx="3" fill="#2a2a28"/>`;
  g+=`<rect x="34" y="20" width="76" height="20" rx="5" fill="url(#${id})" stroke="#141c12" stroke-width="2"/>`;
  g+=`<rect x="48" y="38" width="12" height="20" rx="3" fill="#2a2a28"/>`;
  g+=`<rect x="110" y="25" width="${bl}" height="8" rx="2" fill="#f4f1e6" stroke="#141c12" stroke-width="1.5"/>`;
  g+=twinOn()?`<rect x="110" y="16" width="${bl}" height="6" rx="2" fill="#f4f1e6" stroke="#141c12" stroke-width="1.5"/>`:'';
  g+=on('dmg')?`<circle cx="${112+bl}" cy="29" r="9" fill="${col('dmg')}" opacity=".35"/><rect x="${108+bl}" y="23" width="9" height="12" rx="2" fill="${col('dmg')}"/>`:`<rect x="${108+bl}" y="23" width="9" height="12" rx="2" ${ghost}/>`;
  g+=on('rate')?`<path d="M66 18 l4 -7 l4 7 l4 -7 l4 7 l4 -7 l4 7" fill="none" stroke="${col('rate')}" stroke-width="3" stroke-linejoin="round"/>`:`<path d="M66 18 l4 -7 l4 7 l4 -7 l4 7 l4 -7 l4 7" ${ghost}/>`;
  const mh=10+tuneLv.mag*2+(owned.has('mega')?6:0);
  g+=(on('mag')||owned.has('mega'))?`<rect x="72" y="40" width="18" height="${mh}" rx="3" fill="${on('mag')?col('mag'):'#9aa1a8'}" stroke="#141c12" stroke-width="1.5"/>`:`<rect x="72" y="40" width="18" height="10" rx="3" ${ghost}/>`;
  g+=on('reload')?`<rect x="38" y="13" width="18" height="6" rx="2" fill="${col('reload')}"/>`:`<rect x="38" y="13" width="18" height="6" rx="2" ${ghost}/>`;
  g+=on('speed')?`<rect x="104" y="40" width="30" height="8" rx="4" fill="${col('speed')}" stroke="#141c12" stroke-width="1.5"/>`:`<rect x="104" y="40" width="30" height="8" rx="4" ${ghost}/>`;
  g+=scoped?`<rect x="60" y="4" width="34" height="9" rx="4" fill="#2a2a28"/><rect x="92" y="5" width="4" height="7" fill="#5fb6e0"/>`:`<rect x="60" y="4" width="34" height="9" rx="4" ${ghost}/>`;
  g+=owned.has('laser')?`<rect x="96" y="40" width="7" height="5" rx="1" fill="#2a2a28"/><line x1="103" y1="42.5" x2="168" y2="42.5" stroke="#ff3b3b" stroke-width="1"/>`:'';
  g+=owned.has('lucky')?`<line x1="20" y1="36" x2="20" y2="46" stroke="#cfcac0" stroke-width="1"/><circle cx="20" cy="49" r="3.5" fill="#5fae5a"/>`:'';
  return g+`</svg>`;
}
function buildBars(full){
  return BUILD.map(([key,label,part])=>{const lv=tuneLv[key], pct=Math.round(lv*TUNE_STEP*100), c=LV_COL[Math.max(0,lv-1)];
    const val=lv?(key==='mag'?`${weapon.mag}`:`+${pct}%`):'stock';
    return `<div class="brow${lv?'':' off'}${lv>=5?' gold':''}"><span class="bn">${lv>=5?'★ ':''}${label}</span><span class="bt"><i style="width:${lv/5*100}%;background:${c}"></i></span><span class="bv">${val}</span>${full?`<span class="bp">${lv?`${part} Mk ${lv} of 5`:'Buy in the shop'}</span>`:''}</div>`}).join('');
}
function renderBuild(dt){
  const el=$('build'); if(!el||!weapon) return;
  const sig=JSON.stringify([tuneLv,[...owned],look,kidId,slot,golden,ammoType]);
  if(sig!==buildSig){buildSig=sig; const gear=Object.keys(GEAR).filter(g=>owned.has(g)).map(g=>GEAR[g].n);
    el.innerHTML=blasterSVG(150)+goldMeter()+`<div class="bars">${buildBars(false)}</div>`+(gear.length?`<div class="rr">${gear.join(' · ')}</div>`:''); el.classList.toggle('golden',golden); el.hidden=slot===1}
  if(buildFlash>0){buildFlash=Math.max(0,buildFlash-dt*1.2); el.style.boxShadow=`0 0 0 2px rgba(242,201,76,${buildFlash.toFixed(2)})`; el.style.transform=`scale(${1+buildFlash*0.06})`}
}
let comboN=0, comboT=-9, comboTimer=null;
function killSound(head,boss){
  comboN=clock-comboT<2.5?comboN+1:1; comboT=clock;
  sfx(boss?'bossdown':'tag',1,comboN); if(head) sfx('headshot',0.9);
  rumble(0.35,0.7,110);
  if(comboN>1){const el=$('combo');el.textContent=`x${comboN}`;el.classList.add('on');clearTimeout(comboTimer);comboTimer=setTimeout(()=>el.classList.remove('on'),900)}
}
function qmark(e){if(clock-(e.qT||-9)<3)return;e.qT=clock;addPop(new THREE.Vector3(e.pts[0].x,e.pts[0].y+0.55*e.t.s,e.pts[0].z),'?','alert q',0.9)}
function alertNoise(x,z,r){
  for(const e of enemies){ if(e.state==='chase') continue; const d=Math.hypot(e.x-x,e.z-z); if(d>r) continue;
    const n=d*0.18; e.state='search'; e.last={x:x+rand(-n,n),z:z+rand(-n,n)}; e.searchT=9; e.lookT=0; qmark(e) }
}
function spotEnemy(e){e.spotted=true;addPop(new THREE.Vector3(e.pts[0].x,e.pts[0].y+0.55*e.t.s,e.pts[0].z),'!','alert',1.1);sfx('growl',distVol(e.x,e.z)*(e.t.boss?1.6:1.1),e.t.growl)}
function hurtPlayer(amount,sx,sz,knock){
  if(mode!=='play') return;
  if(P.invuln&&clock<P.invuln) return;
  if(armorWave) amount=Math.round(amount*0.7);
  if(shield>0){const ab=Math.min(shield,amount); shield-=ab; amount-=ab; if(shield<=0) addFeed('Your <i>rain poncho</i> is soaked through'); if(amount<=0){sfx('clank',0.6); return}}
  P.hp-=amount; P.lastHit=clock; stats.soaked+=amount; sfx('hurt');
  const ang=Math.atan2(-(sx-P.x),-(sz-P.z))-P.yaw;
  const dm=$('dmg'); dm.style.transform=`rotate(${-ang}rad)`; dm.classList.add('on'); setTimeout(()=>dm.classList.remove('on'),60);
  const sp=$('splash'); sp.classList.add('on'); setTimeout(()=>sp.classList.remove('on'),70);
  rumble(knock?1:0.55,knock?0.8:0.35,knock?320:160);
  if(knock){const d=Math.hypot(P.x-sx,P.z-sz)||1;P.kx=(P.x-sx)/d*knock;P.kz=(P.z-sz)/d*knock;P.vy=Math.max(P.vy,knock*0.45)}
  if(P.hp<=0) playerOut();
}
function updateEnemy(e,dt){
  const T=e.t, s=T.s;
  const dx=P.x-e.x,dz=P.z-e.z,dist=Math.hypot(dx,dz);
  if(!e.state){e.state='patrol';e.last={x:e.x,z:e.z}}
  // senses: they only know where you are if they can see you (facing you, in range, clear line of sight)
  e.senseT=(e.senseT||0)-dt; e.spotCD=Math.max(0,(e.spotCD||0)-dt);
  if(e.senseT<=0&&mode==='play'){
    e.senseT=0.2;
    const range=(isCrouched()?22:40)*(T.key==='sniper'?1.25:1)*(T.boss?1.2:1);
    let can=dist<range;
    if(can&&dist>4.5){let da=Math.atan2(dx,dz)-e.yaw;while(da>Math.PI)da-=Math.PI*2;while(da<-Math.PI)da+=Math.PI*2;if(Math.abs(da)>(e.state==='chase'?2.4:1.2))can=false}
    if(can) can=hasLOS(new THREE.Vector3(e.x,e.y+1.2*s,e.z),new THREE.Vector3(P.x,P.y+eyeH*0.85,P.z),T.key==='sniper'?2.6:0);
    e.sees=can;
    if(can){ if(e.state!=='chase'){e.state='chase'; if(e.spotCD<=0){spotEnemy(e);e.spotCD=5}} e.last={x:P.x,z:P.z}; e.lostT=0 }
    else if(e.state==='chase'){ e.lostT=(e.lostT||0)+0.2; if(e.lostT>(T.key==='sniper'?7:1.6)){e.state='search';e.searchT=9;e.lookT=0;e.aim=0;if(e.laser)e.laser.visible=false;qmark(e)} }
  }
  e.strafeT-=dt; if(e.strafeT<0){e.strafe*=-1;e.strafeT=rand(1,3)}
  let sp=T.speed*(1+wave*0.03); if(GH(e.x,e.z)<WATER-0.1) sp*=0.55; if(e.flinch>0){sp*=(T.boss||T.key==='heavy')?0.7:0.2;e.flinch-=dt}
  let tx,tz,arrive=1.2,strafeW=0.6, faceP=false;
  if(e.state==='chase'){
    faceP=true;
    if(T.key==='sniper'){
      if(!e.perch||(dist<12&&!e.fled)||e.noLos>7){e.fled=dist<12;e.perch=pickPerch(e);e.noLos=0}
      if(dist>14) e.fled=false;
      tx=e.perch.x;tz=e.perch.z;arrive=0.5;strafeW=0;
    } else if(T.key==='heavy'){
      tx=P.x;tz=P.z;arrive=1.3*s;strafeW=0; if(dist<9) sp*=1.8;
    } else {
      const want=T.want+(e.ang%2);
      tx=P.x+Math.cos(e.ang)*want; tz=P.z+Math.sin(e.ang)*want;
    }
  } else if(e.state==='search'){
    tx=e.last.x; tz=e.last.z; arrive=1.6; strafeW=0; sp*=0.8;
    if(Math.hypot(tx-e.x,tz-e.z)<2.2){ e.searchT-=dt; e.lookT-=dt; if(e.lookT<=0){e.lookYaw=e.yaw+rand(-2.2,2.2);e.lookT=rand(0.9,1.6)} }
    else e.searchT-=dt*0.25;
    if(e.searchT<=0){e.state='patrol';e.wp=null}
  } else {
    if(!e.wp||e.wpT<=0||Math.hypot(e.wp.x-e.x,e.wp.z-e.z)<1.2){
      e.wp=null; e.wpT=rand(5,9);
      let bw=-1;
      for(let k=0;k<14;k++){const a=Math.random()*6.283,r=rand(8,22),x=clamp(e.x+Math.cos(a)*r,-34,34),z=clamp(e.z+Math.sin(a)*r,-42,42);
        if(GH(x,z)<WATER-0.2||groundBlocked(x,z,0.7)) continue;
        let sep=99; for(const o of enemies){if(o===e)continue;const ox=o.wp?o.wp.x:o.x,oz=o.wp?o.wp.z:o.z;sep=Math.min(sep,Math.hypot(ox-x,oz-z))}
        if(sep>bw){bw=sep;e.wp={x,z}}}
      if(!e.wp) e.wp={x:e.x,z:e.z};
    }
    e.wpT-=dt; tx=e.wp.x; tz=e.wp.z; arrive=1; strafeW=0; sp*=0.5;
  }
  if(e.detour){tx=e.detour.x;tz=e.detour.z;arrive=0.8;strafeW=0;e.detour.t-=dt;if(e.detour.t<=0||Math.hypot(tx-e.x,tz-e.z)<1)e.detour=null}
  let mx=tx-e.x, mz=tz-e.z; const ml=Math.hypot(mx,mz);
  let vx=0,vz=0;
  if(ml>arrive){vx=mx/ml;vz=mz/ml}
  if(strafeW){vx+=-dz/(dist||1)*e.strafe*strafeW; vz+=dx/(dist||1)*e.strafe*strafeW}
  if(T.key==='runner'&&e.state==='chase'){e.jT-=dt;if(e.jT<0){const a=Math.random()*6.283;e.jx=Math.cos(a);e.jz=Math.sin(a);e.jT=rand(0.12,0.4)}vx+=e.jx*1.5;vz+=e.jz*1.5}
  for(const o of enemies){if(o===e)continue;const ox=e.x-o.x,oz=e.z-o.z,d=Math.hypot(ox,oz),m=0.8*(s+o.t.s);if(d<m&&d>0){vx+=ox/d*1.2;vz+=oz/d*1.2}}
  const vl=Math.hypot(vx,vz); if(vl>1){vx/=vl;vz/=vl}
  if(e.swing>0&&!T.boss){vx*=0.3;vz*=0.3}
  e.vx=vx*sp; e.vz=vz*sp;
  const ox=e.x,oz=e.z; e.x+=e.vx*dt; e.z+=e.vz*dt; e.x=clamp(e.x,-36,36); e.z=clamp(e.z,-44,44);
  pushOutXZ(e,0.35*s,e.y,e.y+1.4*s);
  if(Math.hypot(e.x-ox,e.z-oz)<sp*dt*0.3&&ml>arrive){e.ang+=dt*1.5*e.strafe;e.stuckT=(e.stuckT||0)+dt;if(e.stuckT>0.6&&!e.detour){const a=Math.atan2(mz,mx)+(Math.random()<0.5?1:-1)*rand(1.2,2.0),dd=rand(5,9);e.detour={x:clamp(e.x+Math.cos(a)*dd,-35,35),z:clamp(e.z+Math.sin(a)*dd,-43,43),t:2};e.stuckT=0}} else e.stuckT=0;
  e.y=supportY(e.x,e.z,e.y,0.35*s);
  const moved=Math.hypot(e.x-ox,e.z-oz)/dt; e.phase+=moved*dt*5/s;
  {let want=e.yaw;
    if(faceP) want=Math.atan2(dx,dz);
    else if(e.state==='search'&&e.lookYaw!=null&&Math.hypot(e.last.x-e.x,e.last.z-e.z)<2.2) want=e.lookYaw;
    else if(Math.hypot(e.vx,e.vz)>0.3) want=Math.atan2(e.vx,e.vz);
    let dy=want-e.yaw; while(dy>Math.PI)dy-=Math.PI*2; while(dy<-Math.PI)dy+=Math.PI*2; e.yaw+=dy*Math.min(1,dt*(faceP?(T.key==='heavy'?3:6):3.5));}
  // melee
  let gunPitch=T.gun==='bat'?-1.1:0;
  if(T.melee){
    e.meleeCD-=dt; const reach=T.boss?3.4:2.0*s;
    if(e.swing>0){
      e.swing-=dt; const f=1-e.swing/0.5;
      if(T.gun==='bat') gunPitch=f<0.45?-1.1-f*1.2:-1.64+(f-0.45)*4.4; else gunPitch=f<0.5?-0.8*f*2:0.8*(1-f)*2-0.8;
      if(!e.swingHit&&f>0.5){e.swingHit=true;if(dist<reach+0.4&&mode==='play'){hurtPlayer(T.meleeDmg||T.dmg,e.x,e.z,T.boss?11:7);addPop(new THREE.Vector3(P.x,P.y+1.6,P.z),T.boss?'SLAM!':'BONK!','tag',0.8)} if(T.boss)burst(new THREE.Vector3(e.x+Math.sin(e.yaw)*1.5,e.y+0.2,e.z+Math.cos(e.yaw)*1.5),18,1.3)}
    } else if(e.state==='chase'&&dist<reach&&e.meleeCD<=0&&mode==='play'){e.swing=0.5;e.swingHit=false;e.meleeCD=T.boss?2.2:1.3}
  }
  // shooting
  if(T.key==='sniper'){
    const from=new THREE.Vector3(e.x,e.y+1.05,e.z), to=new THREE.Vector3(P.x,P.y+eyeH-0.25,P.z);
    if(e.aim>0){
      e.aim-=dt; const pa=e.laser.geometry.attributes.position; pa.setXYZ(0,from.x,from.y,from.z); pa.setXYZ(1,to.x,to.y,to.z); pa.needsUpdate=true;
      laserMat.opacity=0.35+0.4*Math.abs(Math.sin(clock*18));
      if(e.aim<=0){e.laser.visible=false;
        if(mode==='play'&&hasLOS(from,to,2.6)){const dir=to.sub(from).normalize();dir.x+=rand(-T.spread,T.spread);dir.y+=rand(-T.spread,T.spread)+dist*0.0022;dir.z+=rand(-T.spread,T.spread);dir.normalize();from.addScaledVector(dir,0.6);spawnDart(from,dir.multiplyScalar(T.dSpeed),'e',1,T.dmg);sfx('eshot',distVol(e.x,e.z))}
        e.fireT=rand(T.fire[0],T.fire[1]);}
    } else {
      e.fireT-=dt;
      if(e.fireT<=0&&mode==='play'){
        if(e.state==='chase'&&e.sees&&e.perch&&dist<48&&Math.hypot(e.x-e.perch.x,e.z-e.perch.z)<1.5&&hasLOS(from,to,2.6)){e.aim=0.95;e.laser.visible=true;e.noLos=0}
        else {e.fireT=0.6;e.noLos+=0.6}
      }
    }
  } else if(T.dSpeed){
    e.fireT-=dt;
    if(e.fireT<=0&&mode==='play'&&e.swing<=0){
      const from=new THREE.Vector3(e.x,e.y+1.05*s,e.z), to=new THREE.Vector3(P.x,P.y+eyeH-0.35,P.z);
      if(e.state==='chase'&&e.sees&&dist<38&&hasLOS(from,to)){
        const base=to.sub(from).normalize(), sprd=T.spread+dist*0.0015, n=T.burst||1;
        for(let k=0;k<n;k++){
          const dir=base.clone(); if(n>1){const a=(k-(n-1)/2)*0.09;const c=Math.cos(a),sn=Math.sin(a);const x=dir.x*c+dir.z*sn,z=-dir.x*sn+dir.z*c;dir.x=x;dir.z=z}
          dir.x+=rand(-sprd,sprd); dir.y+=rand(-sprd,sprd)*0.6+dist*0.004; dir.z+=rand(-sprd,sprd); dir.normalize();
          spawnDart(from.clone().addScaledVector(dir,0.5*s),dir.multiplyScalar(T.dSpeed),'e',1,T.dmg);
        }
        sfx('eshot',distVol(e.x,e.z)*0.6); e.fireT=rand(T.fire[0],T.fire[1])*Math.max(0.6,1-wave*0.04);
      } else e.fireT=0.5;
    }
  }
  standPose(e.pts,e.x,e.y,e.z,e.yaw,e.phase,Math.min(1,moved/2.5),s);
  poseRig(e.rig,e.pts,true,e.yaw,gunPitch);
  if(e.flash>0){e.flash-=dt*4;setFlash(e.rig,e.flash)}
  if(e.mark) placeEl(e.mark,tmpV.copy(e.pts[0]).setY(e.pts[0].y+0.45*s));
}

// ---------- ragdolls ----------
function killEnemy(e,dir,hitIdx,knock){
  const pts=e.pts.map(p=>p.clone()), prev=e.pts.map(p=>p.clone());
  const R={rig:e.rig,pts,prev,rest:CONS.map(([a,b])=>pts[a].distanceTo(pts[b])),age:0,turtled:false};
  const base=new THREE.Vector3(e.vx,0,e.vz);
  pts.forEach((p,i)=>{
    const dv=base.clone().addScaledVector(dir,(i===hitIdx?7.5:3.6)*knock); dv.y+=(i===hitIdx?3:2.4)*knock+Math.random();
    prev[i].addScaledVector(dv,-FIXED);
  });
  ragdolls.push(R); R.flash=1.2; setFlash(R.rig,1.2);
  if(e.mark){e.mark.remove();e.mark=null}
  if(e.laser){scene.remove(e.laser);e.laser.geometry.dispose();e.laser=null}
  if(ragdolls.length>12){const old=ragdolls.shift();freeRig(old.rig)}
  return R;
}
function stepRagdoll(R){
  const g=-14*FIXED*FIXED;
  R.pts.forEach((p,i)=>{
    const pv=R.prev[i]; let vx=p.x-pv.x,vy=p.y-pv.y,vz=p.z-pv.z;
    const wet=p.y<WATER; const damp=wet?0.94:0.995;
    pv.copy(p); p.x+=vx*damp; p.y+=vy*damp+g*(wet?0.25:1); p.z+=vz*damp;
  });
  for(let it=0;it<6;it++){
    CONS.forEach(([a,b],k)=>{const A=R.pts[a],B=R.pts[b];tmpV.subVectors(B,A);const d=tmpV.length()||0.0001,diff=(d-R.rest[k])/d*0.5;A.addScaledVector(tmpV,diff);B.addScaledVector(tmpV,-diff)});
    R.pts.forEach((p,i)=>{
      const r=i===0?0.15:0.08, pv=R.prev[i];
      const gh=GH(p.x,p.z)+r;
      if(p.y<gh){p.y=gh;const vy=p.y-pv.y;pv.y=p.y+vy*0.25;pv.x+= (p.x-pv.x)*0.35;pv.z+=(p.z-pv.z)*0.35}
      for(const b of boxes){
        if(p.x>b.x0-r&&p.x<b.x1+r&&p.y>b.y0-r&&p.y<b.y1+r&&p.z>b.z0-r&&p.z<b.z1+r){
          const pen=[p.x-(b.x0-r),(b.x1+r)-p.x,p.y-(b.y0-r),(b.y1+r)-p.y,p.z-(b.z0-r),(b.z1+r)-p.z];
          let m=0;for(let j=1;j<6;j++)if(pen[j]<pen[m])m=j;
          if(m===0)p.x=b.x0-r;else if(m===1)p.x=b.x1+r;else if(m===2)p.y=b.y0-r;else if(m===3){p.y=b.y1+r;pv.x+=(p.x-pv.x)*0.3;pv.z+=(p.z-pv.z)*0.3}else if(m===4)p.z=b.z0-r;else p.z=b.z1+r;
        }
      }
      p.x=clamp(p.x,-50,50);p.z=clamp(p.z,-55,55);
    });
  }
}
function updateRagdolls(dt){
  for(let i=ragdolls.length-1;i>=0;i--){
    const R=ragdolls[i]; R.age+=dt;
    if(!R.turtled&&R.age>0.9&&R.pts[2].y<WATER+0.12){R.turtled=true;spawnTurtle(R)}
    if(R.sinking){R.pts.forEach(p=>p.y-=dt*1.6);R.prev.forEach(p=>p.y-=dt*1.6)}
    poseRig(R.rig,R.pts,false,0);
    if(R.flash>0){R.flash-=dt*2.5;setFlash(R.rig,R.flash)}
    const fade=R.age>8?1-(R.age-8):1;
    if(fade<1) R.rig.g.scale.setScalar(Math.max(0.01,fade)),R.rig.g.position.set(R.pts[2].x*(1-fade),R.pts[2].y*(1-fade),R.pts[2].z*(1-fade));
    if(R.age>9||(R.sinking&&R.age-R.sinkAt>1.2)){freeRig(R.rig);ragdolls.splice(i,1)}
  }
}

// turtle
const shellG=new THREE.SphereGeometry(1,14,10), turtleHeadG=new THREE.SphereGeometry(0.32,10,8);
function spawnTurtle(R){
  const g=new THREE.Group();
  const sh=new THREE.Mesh(shellG,flat('#4a5a2c')); sh.scale.set(1.3,0.55,1.6); g.add(sh);
  const hd=new THREE.Mesh(turtleHeadG,flat('#6f7f3d')); hd.position.set(0,0.2,1.55); g.add(hd);
  const eye=new THREE.SphereGeometry(0.08,6,6);
  for(const x of[-0.14,0.14]){const e=new THREE.Mesh(eye,lam('#ffffff'));e.position.set(x,0.42,1.75);g.add(e)}
  const p=R.pts[2]; g.position.set(p.x,WATER-1.2,p.z); g.rotation.y=Math.atan2(P.x-p.x,P.z-p.z);
  scene.add(g); turtles.push({g,t:0,R});
  score+=25; stats.turtle++; addFeed(`<i>Bog turtle</i> snacked on a scout <i>+25</i>`);
}
function updateTurtles(dt){
  for(let i=turtles.length-1;i>=0;i--){
    const T=turtles[i]; T.t+=dt; const t=T.t;
    const y=t<0.4?WATER-1.2+t/0.4*1.35:t<1.4?WATER+0.15+Math.sin(t*12)*0.04:WATER+0.15-(t-1.4)*1.6;
    T.g.position.y=y;
    if(t>0.5&&!T.R.sinking){T.R.sinking=true;T.R.sinkAt=T.R.age}
    if(t>2.4){scene.remove(T.g);freeObj(T.g,false);turtles.splice(i,1)}
  }
}

// ---------- player ----------
let mods={dmg:0,rate:0,mag:0,reload:0,speed:0}, upLevel=0, pickups=[], waveSnap=null, waveFinds={ups:[],meds:0,weps:[],pw:[]}, waveSpawned=false;
function computeWeapon(){
  const b=KIDS[kidId];
  const w=Object.assign({},b,{dmg:b.dmg*(1+mods.dmg),rate:b.rate/(1+mods.rate),mag:Math.round(b.mag*(1+mods.mag)),reload:b.reload/(1+mods.reload),speed:b.speed*(1+mods.speed),knock:b.knock*(1+mods.dmg*0.5),zoom:b.zoom||hasScope,zSpread:b.zSpread!=null?b.zSpread:b.spread*0.3});
  const A=AMMO[ammoType]; w.dmg*=A.dmg; w.rate/=A.rate; w.spread*=A.spread; w.zSpread*=A.spread; w.speed*=A.speed; w.knock*=A.knock;
  if(rares.has('laser')){w.spread*=0.75;w.zSpread*=0.75} if(twinOn()) w.pellets+=b.pellets>1?2:1; if(rares.has('mega')) w.mag=Math.round(w.mag*1.5);
  w.gunCol=owned.has('color')?look.color:GREY; w.id=b.id;
  if(golden){w.dmg*=1.25;w.rate/=1.25;w.spread*=0.8;w.zSpread*=0.8;w.gunCol='#f2c94c';w.gun='Golden '+b.gun}
  return w;
}
function startGame(fromPad){
  audioInit(); clearTransient(); clearPickups();
  buildWorld((Math.random()*1e9)|0,levelFor(1));
  mods={dmg:0,rate:0,mag:0,reload:0,speed:0}; upLevel=0; special=null; hasScope=false; slot=0; shake=0; golden=false; modTier={}; resetEconomy(); slideT=0;
  mods={dmg:0,rate:0,mag:0,reload:0,speed:0};
  weapon=computeWeapon(); buildViewGun(weapon);
  Object.assign(P,{x:0,z:31,y:GH(0,31),vy:0,yaw:0,pitch:-0.05,hp:100,lastHit:-10,kx:0,kz:0}); seenTypes=new Set(); envTarget=0;
  ammo=weapon.mag; cool=0; reloadT=0; fireHeld=false; zoomed=false; score=0; wave=0; deadT=0; enemySeq=0;
  stats={tags:0,heads:0,shots:0,hits:0,turtle:0,soaked:0,ups:0,meds:0,smashed:0,weps:0};
  mode='play'; paused=false; feedItems=[]; $('brk').hidden=true; crouch=false; eyeH=EYE; modTier={};
  $('hud').hidden=false; $('t-zm').hidden=!weapon.zoom; $('t-swp').hidden=true;
  camera.fov=72; camera.updateProjectionMatrix();
  beginWave();
  renderPanel(); updateHud();
  if(fromPad===true){inputMode='pad'}
  else if(touchDevice){inputMode='touch';$('touch').hidden=false}
  else requestLock();
}
const LEVEL_NAME={ravine:'The Creek',city:'Abandoned City',office:'Office Tower'}, LEVELS=['ravine','city','office'];
function levelFor(w){return LEVELS[(LEVELS.indexOf(startLevel)+Math.floor((w-1)/5))%3]}
function clearTransient(){
  removeAlly(); clearNuke();
  enemies.forEach(disposeEnemy); ragdolls.forEach(r=>freeRig(r.rig)); darts.forEach(d=>scene.remove(d.g)); turtles.forEach(t=>{scene.remove(t.g);freeObj(t.g,false)});
  rockets.forEach(k=>scene.remove(k.g)); puffs.forEach(k=>scene.remove(k.m)); flashes.forEach(k=>scene.remove(k.m)); debris.forEach(k=>scene.remove(k.m));
  enemies=[];ragdolls=[];darts=[];turtles=[];rockets=[];puffs=[];flashes=[];debris=[]; clearFx();
}
function switchLevel(lvl){
  clearTransient(); clearPickups(); buildWorld((Math.random()*1e9)|0,lvl);
  Object.assign(P,{x:0,z:31,y:GH(0,31),vy:0,kx:0,kz:0,yaw:0,pitch:-0.05});
}
function setStartLevel(l){
  if(l===startLevel) return; startLevel=l; buildWorld((Math.random()*1e9)|0,l); renderPanel(); seedMenuScouts();
}
function makeRoster(w){
  const l=[];
  if(w%5===0){l.push('boss');for(let i=0;i<1+Math.floor(w/5);i++)l.push('basic');if(w>=10)l.push('runner','sniper');return l}
  for(let i=0;i<2+Math.floor(w/3);i++)l.push('basic');
  if(w>=2)for(let i=0;i<Math.min(4,1+Math.floor((w-2)/2));i++)l.push('runner');
  if(w>=3)for(let i=0;i<Math.min(3,1+Math.floor((w-3)/3));i++)l.push('sniper');
  if(w>=4)for(let i=0;i<Math.min(3,1+Math.floor((w-4)/3));i++)l.push('heavy');
  return l;
}
function rosterText(l){
  const c={};l.forEach(k=>c[k]=(c[k]||0)+1);
  return Object.entries(c).map(([k,n])=>ETYPES[k].boss?ETYPES[k].label:`${n} ${ETYPES[k].label}${n>1?'s':''}`).join(', ');
}
function beginWave(){
  wave++; P.hp=maxHP(); waveSpawned=false; waveT=9; directorT=0;
  const lvl=levelFor(wave), moved=lvl!==curLevel; if(moved) switchLevel(lvl);
  roster=makeRoster(wave);
  waveSnap={tags:stats.tags,heads:stats.heads,shots:stats.shots,hits:stats.hits,turtle:stats.turtle,soaked:stats.soaked,smashed:stats.smashed||0,cash:stats.cash||0,score}; waveFinds={ups:[],meds:0,weps:[],pw:[]};
  placePickups();
  const fresh=[...new Set(roster)].filter(k=>!seenTypes.has(k)&&ETYPES[k].intro); roster.forEach(k=>seenTypes.add(k));
  const boss=wave%5===0; envTarget=boss?1:0;
  const intro=fresh.map(k=>' New: '+ETYPES[k].intro).join('');
  if(boss) showBanner(`Boss wave ${wave}`,`Scoutmaster Thorne is on his way with ${rosterText(roster.slice(1))}. Armored up front, slams up close.${intro}`,5);
  else showBanner(moved?`${LEVEL_NAME[lvl]}: wave ${wave}`:`Wave ${wave}`,`${rosterText(roster)} arriving in ${Math.round(waveT)} seconds. Smash crates and boxes to find gear.${intro}`,fresh.length?5.5:3.5);
  if(fresh.length) fresh.forEach(k=>addFeed(`New enemy: <i>${ETYPES[k].label}</i>`));
}
function endWave(){
  const bonus=(wave%5===0?150:50)*wave; score+=bonus; envTarget=0; armorWave=false; removeAlly();
  { const cb=30+20*wave; cash+=cb; stats.cash=(stats.cash||0)+cb; }
  for(let i=pickups.length-1;i>=0;i--){const p=pickups[i];if(p.kind==='cash'&&p.drop){cash+=p.v;stats.cash=(stats.cash||0)+p.v;scene.remove(p.g);pickups.splice(i,1)}}
  mode='break'; fireHeld=false; zoomed=false; jumpHeld=false; for(const k in keys)keys[k]=false;
  darts=darts.filter(d=>{if(d.owner==='e'&&!d.stuck){scene.remove(d.g);return false}return true});
  try{document.exitPointerLock()}catch(e){} $('touch').hidden=true; hideBanner();
  const ws={tags:stats.tags-waveSnap.tags,heads:stats.heads-waveSnap.heads,shots:stats.shots-waveSnap.shots,hits:stats.hits-waveSnap.hits,turtle:stats.turtle-waveSnap.turtle,soaked:stats.soaked-waveSnap.soaked,smashed:(stats.smashed||0)-waveSnap.smashed,pts:score-waveSnap.score};
  const acc=ws.shots?Math.min(100,Math.round(ws.hits/ws.shots*100)):0;
  const pct=v=>Math.round(v*100);
  const blaster=[mods.dmg&&`Damage +${pct(mods.dmg)}%`,mods.rate&&`Fire rate +${pct(mods.rate)}%`,mods.mag&&`Capacity ${weapon.mag}`,mods.reload&&`Reload +${pct(mods.reload)}%`,mods.speed&&`Dart speed +${pct(mods.speed)}%`].filter(Boolean);
  $('brk').innerHTML=`<div class="brk-card wide" role="dialog" aria-label="Wave ${wave} cleared">
    <h2>Wave ${wave} cleared</h2>
    <div class="row"><button class="btn" id="nextw" type="button">Start wave ${wave+1}</button><span class="hint">Total: <b>${score}</b>${getPad()?' · or press <kbd>Cross</kbd>':touchDevice?'':' · or press <kbd>Enter</kbd>'}</span></div>
    <div class="brk-cols"><div class="brk-left">
    <div class="bgrid">
      <div class="cell"><div class="k">Points</div><div class="v">+${ws.pts}</div></div>
      <div class="cell"><div class="k">Tagged</div><div class="v">${ws.tags}</div></div>
      <div class="cell"><div class="k">Headshots</div><div class="v">${ws.heads}</div></div>
      <div class="cell"><div class="k">Accuracy</div><div class="v">${acc}%</div></div>
    </div>
    <dl class="blist">
      <dt>Soak taken</dt><dd>${ws.soaked}%</dd>
      <dt>Darts fired</dt><dd>${ws.shots}</dd>
      <dt>Med packs used</dt><dd>${waveFinds.meds} of 2</dd>
      <dt>Power-ups found</dt><dd>${waveFinds.pw&&waveFinds.pw.length?waveFinds.pw.join(', '):'None this wave'}</dd>
      <dt>Things smashed</dt><dd>${ws.smashed}</dd>
      ${ws.turtle?`<dt>Turtle snacks</dt><dd>${ws.turtle}</dd>`:''}
      <dt>Cash earned</dt><dd>$${(stats.cash||0)-waveSnap.cash}</dd>
      <dt>Wave bonus</dt><dd>+${bonus}</dd>
    </dl>
    <div class="bigbuild" id="buildwrap">${blasterSVG(200)}<div>${goldMeter()}${buildBars(true)}</div></div>
    <p class="hint">${levelFor(wave+1)!==curLevel?`<b>Next stop: ${LEVEL_NAME[levelFor(wave+1)]}.</b> Your blaster build comes with you. `:''}Your soak meter refills for wave ${wave+1}. Spend your cash in the supply shop. Buy every item to unlock the Golden skin and finish the ultimate weapon.</p>
    </div>
    <div class="shop" id="shopwrap"></div></div>
  </div>`;
  $('brk').hidden=false; $('nextw').onclick=nextWave; renderShop(); $('nextw').focus({preventScroll:true});
  updateHud();
}
function nextWave(fromPad){
  if(mode!=='break') return;
  audioInit(); $('brk').hidden=true; mode='play'; beginWave();
  if(fromPad===true||inputMode==='pad'&&getPad()){inputMode='pad'} else if(touchDevice){$('touch').hidden=false} else requestLock();
}

// ---------- pickups ----------
const TIER_COL=['#8fd16f','#3fa7d6','#b07cff','#f2c94c'], TIER_NM=['Mk I','Mk II','Mk III','Mk IV'], TIER_PCT=[0.12,0.22,0.35,0.55];
const MODS=[{k:'dmg',n:'Heavy dart tips',d:'damage'},{k:'rate',n:'Turbo spring',d:'fire rate'},{k:'mag',n:'Extended hopper',d:'capacity'},{k:'reload',n:'Quick-load clip',d:'reload speed'},{k:'speed',n:'Air pump',d:'dart speed'}];
function pickMod(){const open=MODS.filter(m=>!isGold(m.k));return (open.length?open:MODS)[Math.random()*(open.length||MODS.length)|0]}
const tierFor=(x,z)=>{const d=Math.hypot(x,z-31);return d<25?0:d<42?1:d<58?2:3};
const PG={crate:new THREE.BoxGeometry(0.6,0.45,0.6),band:new THREE.BoxGeometry(0.62,0.1,0.62),icon:new THREE.BoxGeometry(0.12,0.12,0.42),icon2:new THREE.CylinderGeometry(0.03,0.03,0.2,8),
  beam:new THREE.CylinderGeometry(0.07,0.18,7,8,1,true),med:new THREE.BoxGeometry(0.55,0.3,0.4),plusA:new THREE.BoxGeometry(0.3,0.04,0.09),plusB:new THREE.BoxGeometry(0.09,0.04,0.3)};
PG.beam.translate(0,3.5,0); PG.icon2.rotateX(Math.PI/2);
function findSpot(minD){
  for(let i=0;i<300;i++){
    let x,z;
    if(bushes.length&&Math.random()<0.75){const b=bushes[Math.random()*bushes.length|0],a=Math.random()*6.283,d=b.r+0.45;x=b.x+Math.cos(a)*d;z=b.z+Math.sin(a)*d}
    else {x=rand(-33,33);z=rand(-41,41)}
    if(Math.abs(x)>33||Math.abs(z)>41||Math.hypot(x,z-31)<minD||GH(x,z)<WATER+0.15) continue;
    if(groundBlocked(x,z,0.6)) continue;
    if(pickups.some(p=>Math.hypot(p.x-x,p.z-z)<10)) continue;
    return [x,z];
  }
  return [rand(-20,20),rand(-30,5)];
}
function clearPickups(){pickups.forEach(p=>{scene.remove(p.g);freeObj(p.g,false)});pickups=[]}
function placePickups(){
  clearPickups();
  for(let i=0;i<2;i++){
    const [x,z]=findSpot(12);
    const g=new THREE.Group(); g.position.set(x,GH(x,z),z);
    const bx=shadowy(new THREE.Mesh(PG.med,new THREE.MeshLambertMaterial({color:'#f4f1e6',emissive:'#ffffff',emissiveIntensity:0.15}))); bx.position.y=0.18; g.add(bx);
    const gm=lam('#2f9e57'); const a=new THREE.Mesh(PG.plusA,gm), b=new THREE.Mesh(PG.plusB,gm); a.position.y=b.position.y=0.35; g.add(a); g.add(b);
    const beam=new THREE.Mesh(PG.beam,new THREE.MeshBasicMaterial({color:'#8fe0a8',transparent:true,opacity:0.22,depthWrite:false,side:THREE.DoubleSide})); g.add(beam);
    scene.add(g); pickups.push({kind:'med',x,z,g,icon:bx,beam,t:Math.random()*6});
  }
}
function grantUpgrade(tier,mod,at,verb){
  const pct=TIER_PCT[tier], oldMag=weapon.mag;
  const wasGold=isGold(mod.k);
  mods[mod.k]+=pct; upLevel+=tier+1; modTier[mod.k]=Math.max(modTier[mod.k]??-1,tier); weapon=computeWeapon(); if(slot===0) buildViewGun(weapon); buildFlash=1;
  if(!wasGold&&isGold(mod.k)&&!golden){addFeed(`<i>${BUILD.find(b=>b[0]===mod.k)[1]}</i> part is now GOLD (${goldCount()}/5)`);sfx('headshot',1)}
  if(!golden&&goldCount()===5) setTimeout(completeGolden,600); ammo=Math.min(weapon.mag,ammo+Math.max(0,weapon.mag-oldMag));
  stats.ups++; waveFinds.ups.push(`${TIER_NM[tier]} ${mod.n}`);
  addPop(at,`<span style="color:${TIER_COL[tier]}">${TIER_NM[tier]} ${mod.n}</span><small>+${Math.round(pct*100)}% ${mod.d}</small>`,'tag',2);
  addFeed(`${verb||'Found '}<i>${TIER_NM[tier]} ${mod.n}</i> +${Math.round(pct*100)}% ${mod.d}`);
}
function updatePickups(dt){
  for(let i=pickups.length-1;i>=0;i--){
    const p=pickups[i]; p.t+=dt;
    if(p.kind!=='med'){p.icon.rotation.y+=dt*2;p.icon.position.y=(p.kind==='weapon'?1.0:0.95)+Math.sin(p.t*2.5)*0.1}
    const d=Math.hypot(P.x-p.x,P.z-p.z);
    if(p.kind==='cash'&&d<4){p.x+=(P.x-p.x)*Math.min(1,dt*6);p.z+=(P.z-p.z)*Math.min(1,dt*6);p.g.position.x=p.x;p.g.position.z=p.z}
    p.beam.visible=d<(p.kind==='pw'?15:20); p.beam.material.opacity=(p.kind==='up'?0.3:0.24)*(0.7+0.3*Math.sin(p.t*3));
    if(d<1.4&&Math.abs(P.y-p.g.position.y)<1.8){
      const at=new THREE.Vector3(p.x,p.g.position.y+1.2,p.z);
      if(p.kind==='up'){
        grantUpgrade(p.tier,p.mod,at,'Found ');
      } else if(p.kind==='cash'){
        giveCash(p.v,at); scene.remove(p.g); freeObj(p.g,false); pickups.splice(i,1); continue;
      } else if(p.kind==='pw'){
        grantPower(p.item,at);
      } else if(p.kind==='weapon'){
        grantWeapon(p.item,at);
      } else {
        if(P.hp>=maxHP()) continue;
        P.hp=maxHP(); stats.meds++; waveFinds.meds++;
        addPop(at,`DRIED OFF<small>Soak meter refilled</small>`,'tag',1.6);
        addFeed(`Grabbed a <i>med pack</i>, soak meter refilled`);
      }
      burst(at,16,1); sfx('pickup'); scene.remove(p.g); freeObj(p.g,false); pickups.splice(i,1);
    }
  }
}
// ---------- blaster types, cash, shop collection, power-ups, big brother ----------
const AMMO={
  foam:{n:'Foam blaster',short:'Foam',dmg:1,rate:1,spread:1,speed:1,grav:1,knock:1,desc:'Soft darts with a big shove. They stick to walls.'},
  paint:{n:'Paintball gun',short:'Paintball',dmg:1.3,rate:0.85,spread:1.1,speed:1.15,grav:1.8,knock:0.9,desc:'Heavier hits and messy splats, but slower to fire and the balls drop sooner.'},
  airsoft:{n:'Airsoft blaster',short:'Airsoft',dmg:0.75,rate:1.25,spread:0.7,speed:2.0,grav:0.4,knock:0.65,desc:'Fast, flat and accurate BBs. Lighter hits, quicker trigger.'}
};
const GREY='#8a8f96', TUNE_P=[50,80,120,170,230], TUNE_STEP=0.15, GOLD_P=1200;
const LV_COL=['#8fd16f','#3fa7d6','#b07cff','#ff8a3a','#f2c94c'];
const GEAR={scope:{n:'Scope',p:150,d:'Aim down sights'},boomtube:{n:'Boomtube',p:250,d:'Foam rocket launcher, 3 rockets'},laser:{n:'Laser sight',p:300,d:'25% tighter spread'},
  twin:{n:'Twin barrel',p:400,d:'Extra projectile every shot'},mega:{n:'Mega hopper',p:300,d:'50% more capacity'},lucky:{n:'Lucky charm',p:200,d:'Scouts drop double cash'}};
const LOOKS={color:{n:'Paint job',p:80,d:'Pick any color'},dots:{n:'Polka dots',p:150,d:'Dots over your color'},stripes:{n:'Racing stripes',p:200,d:'Stripes over your color'}};
const PALETTE=['#d8344a','#ff7a1a','#f2c94c','#7cff4f','#2ec4d6','#3f7fd6','#7a5bd6','#e2557f','#2b2f38','#f4f1e6'];
const CASH_DROP={basic:20,runner:25,sniper:35,heavy:50,boss:400};
let ammoType='foam'; try{ammoType=localStorage.getItem('gullyAmmo')||'foam'; if(!AMMO[ammoType]) ammoType='foam'}catch(e){}
let cash=0, tuneLv={dmg:0,rate:0,mag:0,reload:0,speed:0}, owned=new Set(), ammoOwned=new Set(), look={color:'#d8344a',dots:false,stripes:false}, armorWave=false, decals=[];
let shield=0, speedT=0, jumpT=0, phones=0, ally=null;
const rares={has:k=>owned.has(k)};
let twinAttached=true; const twinOn=()=>owned.has('twin')&&twinAttached;
function toggleTwin(){ if(!owned.has('twin')) return; twinAttached=!twinAttached; weapon=computeWeapon(); if(slot===0) buildViewGun(weapon); buildFlash=0.6; sfx('switch',0.7); if(mode==='play') addFeed(`Twin barrel <i>${twinAttached?'attached':'removed'}</i>`); if(mode==='break') renderShop() }
function resetEconomy(){
  cash=0; tuneLv={dmg:0,rate:0,mag:0,reload:0,speed:0}; owned=new Set(); ammoOwned=new Set([ammoType]); look={color:'#d8344a',dots:false,stripes:false}; armorWave=false;
  decals.forEach(d=>scene.remove(d)); decals=[]; shield=0; speedT=0; jumpT=0; phones=0; removeAlly();
  lives=3; livesBought=0; hpLv=0; nukes=0; clearNuke(); twinAttached=true;
}
function allItems(){
  const L=[]; BUILD.forEach(([k])=>{for(let i=0;i<5;i++)L.push('tune:'+k+':'+i)});
  Object.keys(GEAR).forEach(g=>{if(g==='scope'&&KIDS[kidId].zoom)return; L.push('gear:'+g)});
  Object.keys(AMMO).forEach(a=>L.push('ammo:'+a)); Object.keys(LOOKS).forEach(l=>L.push('look:'+l)); for(let i=0;i<5;i++)L.push('hp:'+i); return L;
}
function isOwnedItem(id){const [a,b,c]=id.split(':'); if(a==='hp')return hpLv>+b; if(a==='tune')return tuneLv[b]>+c; if(a==='gear'||a==='look')return owned.has(b); if(a==='ammo')return ammoOwned.has(b); return false}
const itemsLeft=()=>allItems().filter(i=>!isOwnedItem(i)).length;
const progressT=()=>allItems().length+1, progressN=()=>allItems().filter(isOwnedItem).length+(golden?1:0);
// cash
const coinG=new THREE.CylinderGeometry(0.16,0.16,0.04,14), billG=new THREE.BoxGeometry(0.36,0.04,0.2), coinM=new THREE.MeshLambertMaterial({color:'#f2c94c',emissive:'#7a5a10',emissiveIntensity:0.5}), billM=lam('#5fae5a'); if(window.GFX) GFX.glow(coinM,2.6);
function addCash(x,z,v,drop){
  const g=new THREE.Group(); g.position.set(x,supportY(x,z,9,0.3),z);
  const icon=new THREE.Group(); icon.position.y=0.45; g.add(icon);
  if(v>=30){for(let k=0;k<3;k++){const b=new THREE.Mesh(billG,billM);b.position.y=k*0.045;b.rotation.y=k*0.4;icon.add(b)}}
  else {const c=new THREE.Mesh(coinG,coinM);c.rotation.x=Math.PI/2;icon.add(c)}
  const beam=new THREE.Object3D(); beam.material={opacity:0}; g.add(beam);
  scene.add(g); pickups.push({kind:'cash',v,drop:!!drop,x,z,g,icon,beam,t:Math.random()*6});
}
function dropCash(e){ const v=Math.round(CASH_DROP[e.t.key]*(owned.has('lucky')?2:1)); addCash(e.pts[2].x+rand(-0.3,0.3),e.pts[2].z+rand(-0.3,0.3),v,true); }
function giveCash(v,at){cash+=v;stats.cash=(stats.cash||0)+v;addPop(at,`+$${v}`,'cashpop',0.9);sfx('coin')}
// paint splats
const splatG=new THREE.SphereGeometry(0.1,10,6); splatG.scale(1,1,0.15);
const DECM={}; const decalMat=c=>DECM[c]||(DECM[c]=new THREE.MeshBasicMaterial({color:c}));
function addDecal(p,v,colr){
  const m=new THREE.Mesh(splatG,decalMat(colr));
  m.position.copy(p); m.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),tmpV.copy(v).normalize()); m.scale.set(rand(0.8,1.4),rand(0.8,1.4),1);
  scene.add(m); decals.push(m); if(decals.length>160){scene.remove(decals.shift())}
}
const paintCol=()=>golden?'#f2c94c':(owned.has('color')?look.color:'#ff3fa4');
// blaster skin texture for the held blaster
const skinTexCache={};
function skinMaterial(){
  const base=golden?'#f2c94c':(owned.has('color')?look.color:GREY), dots=!golden&&owned.has('dots')&&look.dots, stripes=!golden&&owned.has('stripes')&&look.stripes, key=[base,dots,stripes,golden].join('|');
  if(!skinTexCache[key]){
    const cv=document.createElement('canvas'); cv.width=cv.height=64; const c=cv.getContext('2d');
    if(golden){const g=c.createLinearGradient(0,0,64,64);g.addColorStop(0,'#fff1b3');g.addColorStop(0.5,'#f2c94c');g.addColorStop(1,'#a87a12');c.fillStyle=g;c.fillRect(0,0,64,64);c.fillStyle='rgba(255,255,255,.7)';for(let i=0;i<8;i++)c.fillRect((i*23)%60,(i*37)%60,2,2)}
    else {c.fillStyle=base;c.fillRect(0,0,64,64);
      if(stripes){c.fillStyle='rgba(255,255,255,.38)';for(let x=-64;x<64;x+=16){c.beginPath();c.moveTo(x,64);c.lineTo(x+7,64);c.lineTo(x+71,0);c.lineTo(x+64,0);c.fill()}}
      if(dots){c.fillStyle='rgba(255,255,255,.85)';for(let y=8;y<64;y+=16)for(let x=((y/16)|0)%2?16:8;x<64;x+=16){c.beginPath();c.arc(x,y,4,0,7);c.fill()}}}
    const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; skinTexCache[key]=t;
  }
  return new THREE.MeshLambertMaterial({map:skinTexCache[key],emissive:golden?'#5a4208':'#000000',depthTest:false,depthWrite:false,transparent:true,opacity:1});
}
// ---- power-ups hidden inside breakable things ----
const PW={poncho:{n:'Rain poncho',col:'#f2d84c',d:'Soaks up the next 50 damage'},speed:{n:'Speed shoes',col:'#2ec4d6',d:'Run 50% faster for 45 s'},
  jump:{n:'Jump shoes',col:'#8fd16f',d:'Jump way higher for 45 s'},phone:{n:'Cell phone',col:'#c9c7c1',d:'Call your big brother'}};
function spawnPowerup(at){
  const pool=['poncho','poncho','poncho','speed','speed','jump','jump']; if(phones===0&&!ally) pool.push('phone','phone');
  const item=pool[Math.random()*pool.length|0], x=clamp(at.x,-36,36), z=clamp(at.z,-44,44);
  const g=new THREE.Group(); g.position.set(x,GH(x,z),z);
  const icon=new THREE.Group(); icon.position.y=0.8; g.add(icon); const m=lam(PW[item].col);
  if(item==='poncho'){const c=new THREE.Mesh(new THREE.ConeGeometry(0.26,0.45,10),m);icon.add(c);const h=new THREE.Mesh(new THREE.SphereGeometry(0.1,8,6),m);h.position.y=0.25;icon.add(h)}
  else if(item==='phone'){icon.add(new THREE.Mesh(new THREE.BoxGeometry(0.14,0.26,0.03),lam('#2a2a28')));const s=new THREE.Mesh(new THREE.BoxGeometry(0.11,0.2,0.005),new THREE.MeshBasicMaterial({color:'#7fd0ff'}));s.position.z=0.018;icon.add(s)}
  else {for(const sx of[-0.09,0.09]){const sh=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.1,0.28),m);sh.position.set(sx,0,0);icon.add(sh);const so=new THREE.Mesh(new THREE.BoxGeometry(0.13,0.04,0.3),lam('#f4f1e6'));so.position.set(sx,-0.06,0);icon.add(so)}
    if(item==='jump'){const sp=new THREE.Mesh(new THREE.TorusGeometry(0.06,0.015,6,12),lam('#9aa1a8'));sp.rotation.x=Math.PI/2;sp.position.y=-0.12;icon.add(sp)}}
  const ring=new THREE.Mesh(new THREE.TorusGeometry(0.4,0.025,6,24),new THREE.MeshBasicMaterial({color:PW[item].col})); ring.rotation.x=Math.PI/2; ring.position.y=-0.55; icon.add(ring);
  const beam=new THREE.Mesh(PG.beam,new THREE.MeshBasicMaterial({color:PW[item].col,transparent:true,opacity:0.25,depthWrite:false,side:THREE.DoubleSide})); g.add(beam);
  scene.add(g); pickups.push({kind:'pw',item,x,z,g,icon,beam,t:0});
  addPop(new THREE.Vector3(x,g.position.y+1.4,z),`${PW[item].n}!`,'',1.2); sfx('pickup',0.6);
}
function grantPower(item,at){
  if(item==='poncho') shield=Math.min(100,shield+50);
  if(item==='speed') speedT=45;
  if(item==='jump') jumpT=45;
  if(item==='phone'){ if(phones>0||ally){giveCash(30,at);return} phones=1; }
  addPop(at,`${PW[item].n.toUpperCase()}<small>${item==='phone'?(getPad()?'D-pad up to call':touchDevice?'Tap CALL':'Press G to call'):PW[item].d}</small>`,'tag',2);
  addFeed(`Found <i>${PW[item].n}</i>`); if(waveFinds.pw) waveFinds.pw.push(PW[item].n);
}
// ---- big brother teammate ----
ETYPES.ally={key:'ally',label:'Big brother',s:1.12,shirt:'#2f6fd6',shorts:'#2a2a2a',hat:'band',hatCol:'#ff7a1a',gun:'blaster',gunCol:'#ff7a1a',eye:'#ffffff'};
function callBrother(){
  if(mode!=='play'||phones<=0||ally) return; phones--;
  sfx('coin',0.8); setTimeout(()=>sfx('coin',0.8),350);
  showBanner('Ring ring...','Your big brother is on his way',1.6); addFeed('Calling <i>big brother</i>...');
  setTimeout(()=>{if(mode==='play'&&!ally)spawnAlly()},1600);
}
function spawnAlly(){
  const rig=makeRig('ally'), mark=document.createElement('div'); mark.className='mark ally'; mark.innerHTML='BIG BRO<i></i>'; $('pops').appendChild(mark);
  const bx=P.x-Math.sin(P.yaw)*-2, bz=P.z-Math.cos(P.yaw)*-2;
  ally={rig,mark,pts:LOCAL.map(()=>new THREE.Vector3()),x:bx,z:bz,y:supportY(bx,bz,P.y,0.4),yaw:P.yaw+Math.PI,phase:0,fireT:0.8,scanT:0,target:null,burst:0};
  burst(new THREE.Vector3(bx,ally.y+1,bz),30,1.4); addPop(new THREE.Vector3(bx,ally.y+2,bz),"BIG BRO'S HERE!",'tag',1.6); sfx('tag',1,3);
}
function removeAlly(){ if(!ally) return; freeRig(ally.rig); if(ally.mark) ally.mark.remove(); ally=null; }
function updateAlly(dt){
  const a=ally; if(!a) return;
  a.scanT-=dt;
  if(a.scanT<=0){a.scanT=0.3; let best=null,bd=38; const eye=new THREE.Vector3(a.x,a.y+1.35,a.z);
    for(const e of enemies){const d=Math.hypot(e.x-a.x,e.z-a.z); if(d<bd&&hasLOS(eye,new THREE.Vector3(e.x,e.y+1.0*e.t.s,e.z))){best=e;bd=d}} a.target=best}
  if(a.target&&!enemies.includes(a.target)) a.target=null;
  const rx=Math.cos(P.yaw), rz=-Math.sin(P.yaw), bx=Math.sin(P.yaw), bz=Math.cos(P.yaw);
  const tx=P.x+rx*2.4+bx*1.6, tz=P.z+rz*2.4+bz*1.6, dx=tx-a.x, dz=tz-a.z, dl=Math.hypot(dx,dz);
  const sp=dl>8?8:5.5, ox=a.x, oz=a.z;
  if(dl>1.2){a.x+=dx/dl*sp*dt; a.z+=dz/dl*sp*dt}
  if(dl>25){a.x=tx;a.z=tz}
  pushOutXZ(a,0.4,a.y,a.y+1.6); a.x=clamp(a.x,-37,37); a.z=clamp(a.z,-45,45); a.y=supportY(a.x,a.z,a.y,0.4);
  const moved=Math.hypot(a.x-ox,a.z-oz)/Math.max(dt,0.001); a.phase+=moved*dt*4.5;
  let want=a.yaw; if(a.target) want=Math.atan2(a.target.x-a.x,a.target.z-a.z); else if(moved>0.3) want=Math.atan2(a.x-ox,a.z-oz);
  let dy=want-a.yaw; while(dy>Math.PI)dy-=Math.PI*2; while(dy<-Math.PI)dy+=Math.PI*2; a.yaw+=dy*Math.min(1,dt*8);
  a.fireT-=dt;
  if(a.target&&a.fireT<=0&&Math.abs(dy)<0.35){
    const e=a.target, from=new THREE.Vector3(a.x,a.y+1.15*1.12,a.z), to=new THREE.Vector3(e.x,e.y+(Math.random()<0.25?1.33:1.0)*e.t.s,e.z);
    const dir=to.sub(from).normalize(); dir.x+=rand(-0.03,0.03); dir.y+=rand(-0.02,0.02)+0.004*Math.hypot(e.x-a.x,e.z-a.z); dir.z+=rand(-0.03,0.03); dir.normalize();
    spawnDart(from.addScaledVector(dir,0.6),dir.multiplyScalar(36),'p',1.1,1); const d=darts[darts.length-1]; d.ally=true; d.dmg=1.2*(1+wave*0.06);
    sfx('shot',distVol(a.x,a.z)*0.5); a.burst++; a.fireT=a.burst%3?0.16:0.7;
  }
  standPose(a.pts,a.x,a.y,a.z,a.yaw,a.phase,Math.min(1,moved/3),1.12);
  poseRig(a.rig,a.pts,true,a.yaw,0);
  placeEl(a.mark,tmpV.copy(a.pts[0]).setY(a.pts[0].y+0.55));
}
// ---- shop ----
function shopItems(){
  const it=[];
  BUILD.forEach(([k,l])=>{const lv=tuneLv[k];it.push({sec:'Tune-ups',id:'tune:'+k,t:lv>=5?`${l} maxed`:`${l} Mk ${lv+1}`,s:lv>=5?'Maxed':`$${TUNE_P[lv]}`,p:lv>=5?0:TUNE_P[lv],ok:lv<5,bar:lv})});
  it.push({sec:'Survival',id:'hp',t:hpLv>=5?'Soak meter maxed':`Soak meter +20 (Mk ${hpLv+1})`,s:hpLv>=5?'Maxed':`$${HP_P[hpLv]}`,p:hpLv>=5?0:HP_P[hpLv],ok:hpLv<5,bar:hpLv,sub:`Max soak ${maxHP()}`});
  it.push({sec:'Survival',id:'life',t:'+1 life',s:lives>=MAX_LIVES?'Max lives':`$${lifePrice()}`,p:lifePrice(),ok:lives<MAX_LIVES,sub:`You have ${lives}`});
  it.push({sec:'Survival',id:'nuke',t:'Foam Nuke',s:nukes>=3?'Carrying 3':`$${NUKE_P}`,p:NUKE_P,ok:nukes<3,sub:nukes?`Carrying ${nukes}. Wipes out every scout`:'Wipes out every scout on the map',nuke:true});
  Object.entries(GEAR).forEach(([k,g])=>{if(k==='scope'&&KIDS[kidId].zoom)return; if(k==='twin'&&owned.has(k)){it.push({sec:'Gear',id:'gear:twin',t:'Twin barrel',s:twinAttached?'Attached, tap to remove':'Removed, tap to attach',p:0,ok:true,sub:'Press T in a wave to swap'});return} it.push({sec:'Gear',id:'gear:'+k,t:g.n,s:owned.has(k)?'Owned':`$${g.p}`,p:g.p,ok:!owned.has(k),sub:g.d})});
  if(owned.has('boomtube')) it.push({sec:'Gear',id:'refill:rockets',t:'+3 rockets',s:'$90',p:90,ok:!!special&&special.ammo<ROCKET.max,sub:'Refill'});
  Object.entries(AMMO).forEach(([k,a])=>{const own=ammoOwned.has(k);it.push({sec:'Blaster type',id:'ammo:'+k,t:a.n,s:ammoType===k?'Equipped':own?'Owned, equip':'$150',p:own?0:150,ok:ammoType!==k})});
  Object.entries(LOOKS).forEach(([k,l])=>{const own=owned.has(k);it.push({sec:'Skin',id:'look:'+k,t:l.n,s:own?(k==='color'?'Owned':(look[k]?'On, tap to hide':'Off, tap to show')):`$${l.p}`,p:own?0:l.p,ok:!own||k!=='color',sub:own?'':l.d})});
  const left=itemsLeft(); it.push({sec:'Skin',id:'gold',t:'Golden skin',s:golden?'Owned':left?`Locked, ${left} item${left===1?'':'s'} left`:`$${GOLD_P}`,p:GOLD_P,ok:!golden&&left===0,gold:true});
  if(owned.has('color')) PALETTE.forEach(c=>it.push({sec:'Paint color',id:'col:'+c,t:'',s:'',p:0,ok:look.color!==c,sw:c,chip:true}));
  return it;
}
function shopHTML(){
  const it=shopItems(), secs=[...new Set(it.map(i=>i.sec))], n=progressN(), T=progressT();
  return `<div class="shophead"><h3>Supply shop</h3><span class="cashbig">$${cash}</span></div>
    <div class="gm${golden?' done':''}"><span>Ultimate weapon</span><span class="gmt"><i style="width:${n/T*100}%"></i></span><span>${n}/${T}</span></div>`+
    secs.map(sc=>`<div class="shopsec"><div class="k">${sc}</div><div class="shopgrid${sc==='Paint color'?' chips':''}">${it.filter(i=>i.sec===sc).map(i=>i.chip
      ?`<button class="chipbtn" type="button" data-buy="${i.id}" aria-label="Paint ${i.sw}" aria-pressed="${!i.ok}" style="background:${i.sw}"></button>`
      :`<button class="shopbtn${i.gold?' goldbtn':''}${i.nuke?' nukebtn':''}" type="button" data-buy="${i.id}" ${(!i.ok||i.p>cash)?'disabled':''}><b>${i.t}</b>${i.sub?`<em>${i.sub}</em>`:''}${i.bar!=null?`<span class="lvp">${[0,1,2,3,4].map(q=>`<i style="${q<i.bar?`background:${LV_COL[q]}`:''}"></i>`).join('')}</span>`:''}<span>${i.s}</span></button>`).join('')}</div></div>`).join('');
}
function renderShop(){
  const w=$('shopwrap'); if(!w) return;
  const focusId=document.activeElement&&document.activeElement.dataset?document.activeElement.dataset.buy:null;
  w.innerHTML=shopHTML();
  w.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>buy(b.dataset.buy));
  const bw=$('buildwrap'); if(bw) bw.innerHTML=`${blasterSVG(200)}<div>${goldMeter()}${buildBars(true)}</div>`;
  if(focusId){const f=w.querySelector(`[data-buy="${CSS.escape(focusId)}"]`); if(f&&!f.disabled) f.focus({preventScroll:true}); else $('nextw').focus({preventScroll:true})}
}
function buy(id){
  const item=shopItems().find(i=>i.id===id); if(!item||!item.ok||item.p>cash) return;
  const i0=id.indexOf(':'), kind=i0<0?id:id.slice(0,i0), key=i0<0?'':id.slice(i0+1);
  cash-=item.p; if(item.p) sfx('coin',1); else sfx('switch',0.6);
  if(kind==='tune'){tuneLv[key]++; mods[key]=tuneLv[key]*TUNE_STEP; upLevel++; stats.ups++}
  else if(kind==='gear'&&key==='twin'&&owned.has('twin')){toggleTwin();return}
  else if(kind==='gear'){owned.add(key); if(key==='scope'){hasScope=true;$('t-zm').hidden=false} if(key==='boomtube'){special={kind:'rocket',ammo:3};$('t-swp').hidden=false}}
  else if(kind==='hp'){hpLv++; P.hp=Math.min(maxHP(),P.hp+20)}
  else if(kind==='life'){lives++; livesBought++}
  else if(kind==='nuke'){nukes++; sfx('siren',0.3)}
  else if(kind==='refill'){special.ammo=Math.min(ROCKET.max,special.ammo+3)}
  else if(kind==='ammo'){ammoOwned.add(key); ammoType=key; try{localStorage.setItem('gullyAmmo',key)}catch(e){}}
  else if(kind==='look'){ if(!owned.has(key)){owned.add(key);look[key]=true} else look[key]=!look[key] }
  else if(kind==='col'){look.color=key}
  else if(kind==='gold'){renderShop(); completeGolden(); return}
  weapon=computeWeapon(); if(kind==='ammo') ammo=weapon.mag; if(kind==='tune'&&key==='mag') ammo=weapon.mag;
  if(slot===0) buildViewGun(weapon); buildFlash=1; renderShop();
}
// ---------- lives, soak upgrades, foam nuke ----------
const HP_P=[120,180,260,360,480], NUKE_P=1500, MAX_LIVES=9;
let lives=3, livesBought=0, hpLv=0, nukes=0, nukeS=null;
const maxHP=()=>100+20*hpLv;
const lifePrice=()=>250+100*livesBought;
function loseLife(){
  lives--; sfx('hurt',1); sfx('growl',0.7,60); rumble(1,0.8,500);
  const fl=$('nukeflash'); fl.classList.add('dark','on'); setTimeout(()=>fl.classList.remove('on'),160); setTimeout(()=>fl.classList.remove('dark'),2200);
  Object.assign(P,{x:0,z:31,vy:0,kx:0,kz:0}); P.y=supportY(0,31,9,0.35); P.hp=maxHP(); P.invuln=clock+3; P.yaw=0; slideT=0; crouch=false;
  enemies.forEach(e=>{if(e.state==='chase'){e.state='search';e.searchT=6;e.lookT=0}});
  darts=darts.filter(d=>{if(d.owner==='e'&&!d.stuck){scene.remove(d.g);return false}return true});
  showBanner('SOAKED!',`${lives} ${lives===1?'life':'lives'} left. Back to HQ.`,2.4); addFeed(`Lost a life, <i>${lives} left</i>`);
}
// --- the nuke ---
const NG={body:new THREE.CylinderGeometry(0.7,0.7,2.6,16),cap:new THREE.SphereGeometry(0.7,16,10),fin:new THREE.BoxGeometry(0.08,0.9,0.9),band:new THREE.CylinderGeometry(0.72,0.72,0.3,16),
  puff:new THREE.IcosahedronGeometry(1,1),ring:new THREE.TorusGeometry(1,0.12,8,48),dome:new THREE.SphereGeometry(1,24,16),stem:new THREE.CylinderGeometry(1,1.6,1,16,1,true)};
function useNuke(){
  if(mode!=='play'||nukes<=0||nukeS) return; nukes--;
  let tx=P.x-Math.sin(P.yaw)*24, tz=P.z-Math.cos(P.yaw)*24;
  if(enemies.length){tx=0;tz=0;enemies.forEach(e=>{tx+=e.x;tz+=e.z});tx/=enemies.length;tz/=enemies.length}
  tx=clamp(tx,-34,34); tz=clamp(tz,-42,42);
  if(Math.hypot(tx-P.x,tz-P.z)<12){const a=P.yaw;tx=clamp(P.x-Math.sin(a)*16,-34,34);tz=clamp(P.z-Math.cos(a)*16,-42,42)}
  const bomb=new THREE.Group(), om=new THREE.MeshLambertMaterial({color:'#ff7a1a',emissive:'#5a2200',emissiveIntensity:0.4}), ym=lam('#f2c94c'), dk=lam('#2a2a28');
  bomb.add(new THREE.Mesh(NG.body,om)); const c1=new THREE.Mesh(NG.cap,om); c1.position.y=-1.3; bomb.add(c1); const c2=new THREE.Mesh(NG.cap,ym); c2.position.y=1.3; c2.scale.y=0.5; bomb.add(c2);
  for(const y of[-0.5,0.5]){const b=new THREE.Mesh(NG.band,ym);b.position.y=y;bomb.add(b)}
  for(let k=0;k<4;k++){const f=new THREE.Mesh(NG.fin,dk);f.position.set(Math.cos(k*Math.PI/2)*0.7,1.4,Math.sin(k*Math.PI/2)*0.7);f.rotation.y=-k*Math.PI/2;bomb.add(f)}
  const ty=supportY(tx,tz,P.y+1,1), H=LV.kind==='office'?CEIL-2.2:70; bomb.position.set(tx,ty+H,tz); scene.add(bomb);
  nukeS={t:0,tx,tz,ty,bomb,phase:'fall',pt:0,H,cap:LV.kind==='office'?CEIL-2:99};
  $('nukewarn').classList.add('on'); showBanner('FOAM NUKE INBOUND','Take cover!',2.4); addFeed('<i>FOAM NUKE</i> launched');
  sfx('siren'); setTimeout(()=>sfx('whistle'),400); rumble(0.25,0.4,2400);
}
function detonate(N){
  N.phase='boom'; N.t0=N.t; scene.remove(N.bomb); $('nukewarn').classList.remove('on');
  const fl=$('nukeflash'); fl.classList.add('on'); setTimeout(()=>fl.classList.remove('on'),140);
  sfx('nuke'); rumble(1,1,1800); shake=Math.max(shake,1.7); hideBanner();
  const p=new THREE.Vector3(N.tx,N.ty,N.tz), cloud=new THREE.Group(); cloud.position.copy(p); scene.add(cloud);
  const mk=(col,em)=>new THREE.MeshLambertMaterial({color:col,emissive:em,emissiveIntensity:0.6,transparent:true,opacity:1});
  const dome=new THREE.Mesh(NG.dome,new THREE.MeshBasicMaterial({color:'#fff2c8',transparent:true,opacity:0.95,blending:THREE.AdditiveBlending,depthWrite:false})); cloud.add(dome); if(window.GFX){dome.material.color.multiplyScalar(GFX.b(3));}
  const ring=new THREE.Mesh(NG.ring,new THREE.MeshBasicMaterial({color:'#ffd9a0',transparent:true,opacity:0.9,depthWrite:false})); ring.rotation.x=Math.PI/2; ring.position.y=0.4; cloud.add(ring);
  const stemM=mk('#f4eee2','#ff7a1a'), stem=new THREE.Mesh(NG.stem,stemM); stem.position.y=0; cloud.add(stem);
  const capPuffs=[]; for(let k=0;k<26;k++){const a=k/26*Math.PI*2+Math.random(), r=k<10?rand(0,2):rand(2.5,5), m=new THREE.Mesh(NG.puff,mk(k%3?'#fff7ea':'#ffd2a0',k%2?'#ff5a1a':'#ff9a3a'));
    m.userData={ox:Math.cos(a)*r,oz:Math.sin(a)*r,oy:rand(-1.2,1.6),s:rand(1.6,3.2)}; m.scale.setScalar(0.01); cloud.add(m); capPuffs.push(m)}
  const basePuffs=[]; for(let k=0;k<16;k++){const a=k/16*Math.PI*2, m=new THREE.Mesh(NG.puff,mk('#efe8da','#ff8a3a')); m.userData={a,s:rand(1.2,2.2)}; m.scale.setScalar(0.01); cloud.add(m); basePuffs.push(m)}
  N.cloud={g:cloud,dome,ring,stem,capPuffs,basePuffs};
  // the damage
  let n=0;
  for(const e of [...enemies]){
    const dx=e.x-p.x, dz=e.z-p.z, d=Math.hypot(dx,dz)||1, dir=new THREE.Vector3(dx/d,0.9,dz/d).normalize();
    if(e.t.boss){e.hp-=e.maxHp*0.5; e.flash=1.5; e.flinch=2; e.x=clamp(e.x+dx/d*4,-36,36); e.z=clamp(e.z+dz/d*4,-44,44); if(e.hp>0) continue}
    killEnemy(e,dir,2,3.2+Math.random()*1.4); enemies.splice(enemies.indexOf(e),1);
    stats.tags++; score+=e.t.pts; dropCash(e); n++;
    addPop(new THREE.Vector3(e.pts[0].x,e.pts[0].y+0.6*e.t.s,e.pts[0].z),`NUKED!<small>+${e.t.pts}</small>`,'tag',1.6);
  }
  for(const R of ragdolls) for(let k=0;k<R.pts.length;k++){tmpV.subVectors(R.pts[k],p).setY(0).normalize();R.prev[k].addScaledVector(tmpV,-FIXED*14);R.prev[k].y-=FIXED*10;R.flash=1.2}
  for(const D of [...destructs]){const cx=(D.box.x0+D.box.x1)/2,cz=(D.box.z0+D.box.z1)/2,d=Math.hypot(cx-p.x,cz-p.z);if(d<48) destroyDestruct(D,new THREE.Vector3(cx-p.x,1.2,cz-p.z).normalize(),2.5)}
  if(n){const b=100*n;score+=b;addFeed(`<i>Foam nuke</i> tagged ${n} scout${n===1?'':'s'} +${b} bonus`)}
  hitMarker(true);
  const dP=Math.hypot(P.x-p.x,P.z-p.z)||1; P.kx+=(P.x-p.x)/dP*6; P.kz+=(P.z-p.z)/dP*6; P.vy=Math.max(P.vy,3);
}
function updateNuke(dt){
  const N=nukeS; if(!N) return; N.t+=dt;
  if(N.phase==='fall'){
    const f=Math.min(1,N.t/2.4); N.bomb.position.y=N.ty+N.H*(1-f*f)+1.3; N.bomb.rotation.y+=dt*4;
    N.pt+=dt; if(N.pt>0.03){N.pt=0;const m=new THREE.Mesh(RG.puff,RM.puff.clone());m.position.copy(N.bomb.position).y+=1.6;m.scale.setScalar(2);scene.add(m);puffs.push({m,t:0})}
    if(f>=1) detonate(N);
    return;
  }
  const t=N.t-N.t0, C=N.cloud, e=x=>1-Math.pow(1-Math.min(1,x),3);
  C.dome.scale.setScalar(1+e(t/0.6)*24); C.dome.material.opacity=Math.max(0,0.95-t*0.9);
  C.ring.scale.setScalar(1+e(t/1.4)*70); C.ring.material.opacity=Math.max(0,0.9-t*0.6);
  const rise=e(t/2.2), top=Math.min(N.cap,4+rise*20);
  C.stem.scale.set(1.2+rise*0.6,top,1.2+rise*0.6); C.stem.position.y=top/2;
  C.capPuffs.forEach(m=>{const u=m.userData,s=u.s*(0.3+e(t/1.6)*1.1)*(1+t*0.05);m.scale.setScalar(s);m.position.set(u.ox*(1+rise*0.9),top+u.oy*(1+rise),u.oz*(1+rise*0.9));m.rotation.y+=dt*0.3});
  C.basePuffs.forEach(m=>{const u=m.userData,r=3+e(t/1.2)*7;m.scale.setScalar(u.s*(0.35+e(t/1)*0.65));m.position.set(Math.cos(u.a)*r,0.8,Math.sin(u.a)*r)});
  if(t>5){const o=Math.max(0,1-(t-5)/2.5);C.g.traverse(m=>{if(m.material&&m!==C.dome&&m!==C.ring)m.material.opacity=o})}
  if(t>7.6){scene.remove(C.g);C.g.traverse(m=>{if(m.material)m.material.dispose()});nukeS=null}
}
function clearNuke(){if(!nukeS)return;scene.remove(nukeS.bomb);if(nukeS.cloud)scene.remove(nukeS.cloud.g);nukeS=null;$('nukewarn').classList.remove('on')}
function requestLock(){
  inputMode='lock';
  try{const r=renderer.domElement.requestPointerLock();if(r&&r.catch)r.catch(()=>fallbackDrag())}catch(e){fallbackDrag()}
  setTimeout(()=>{if(mode==='play'&&document.pointerLockElement!==renderer.domElement&&inputMode==='lock')fallbackDrag()},700);
}
function fallbackDrag(){if(inputMode==='touch')return;inputMode='drag';paused=false;showBanner('Drag to look',`Click to fire, or hold <b>F</b>. WASD to move.`,2.5)}
document.addEventListener('pointerlockchange',()=>{
  if(document.pointerLockElement===renderer.domElement){inputMode='lock';paused=false;hideBanner()}
  else if(mode==='play'&&inputMode==='lock'){paused=true;fireHeld=false;showBanner('Paused','Click the battlefield to jump back in',0)}
});

function fire(){
  if(slot===1){fireRocket();return}
  if(reloadT>0||cool>0) return;
  if(ammo<=0){startReload();return}
  ammo--; cool=weapon.rate; stats.shots++; sfx(ammoType==='paint'?'pshot':ammoType==='airsoft'?'ashot':'shot',0.8); alertNoise(P.x,P.z,isCrouched()?12:20); if(inputMode==='pad')rumble(KIDS[kidId].pellets>1?0.5:0,KIDS[kidId].pellets>1?0.4:0.2,KIDS[kidId].pellets>1?120:35);
  const eye=new THREE.Vector3(P.x,P.y+eyeH,P.z);
  const fwd=new THREE.Vector3(); camera.getWorldDirection(fwd);
  const right=new THREE.Vector3().crossVectors(fwd,UP).normalize(), up=new THREE.Vector3().crossVectors(right,fwd);
  const sp=(zoomed&&weapon.zSpread!=null?weapon.zSpread:weapon.spread)*(1+recoil*1.5)*(isCrouched()?0.65:1);
  const muzzle=eye.clone().addScaledVector(fwd,0.5).addScaledVector(right,0.13).addScaledVector(up,-0.12);
  for(let i=0;i<weapon.pellets;i++){
    const d=fwd.clone().addScaledVector(right,rand(-sp,sp)).addScaledVector(up,rand(-sp,sp)).normalize();
    const target=eye.clone().addScaledVector(d,40);
    const v=target.sub(muzzle).normalize().multiplyScalar(weapon.speed*rand(0.95,1.05));
    spawnDart(i===0?muzzle:muzzle.clone(),v,'p',weapon.knock);
  }
  const pump=KIDS[kidId].pellets>1;
  recoil=Math.min(1,recoil+(pump?0.9:weapon.id==='tibbs'?0.6:0.22)*(isCrouched()?0.65:1)); gunKick=pump?1:0.5;
  kickP+=pump?0.06:weapon.id==='tibbs'?0.04:0.012;
  if(ammo<=0) setTimeout(()=>{if(mode==='play')startReload()},180);
}
const isCrouched=()=>crouch||!!keys.ControlLeft;
let slideDir={x:0,z:-1};
function startSlide(){const l=Math.hypot(lastMv.x,lastMv.z)||1;slideDir={x:lastMv.x/l,z:lastMv.z/l};slideT=0.75;sfx('slide');kickP+=0.02;rumble(0.3,0.3,200)}
function toggleCrouch(){if(mode!=='play')return;if(!crouch&&sprinting)startSlide();else sfx('switch',0.5);crouch=!crouch}
function startReload(){if(slot===1||reloadT>0||ammo===weapon.mag)return;reloadT=weapon.reload;zoomed=false}
const ROCKET={speed:24,radius:4.2,dmg:9,cool:1.0,max:8};
const RG={body:new THREE.CylinderGeometry(0.07,0.07,0.45,10),nose:new THREE.ConeGeometry(0.07,0.16,10),fin:new THREE.BoxGeometry(0.02,0.12,0.16),puff:new THREE.SphereGeometry(0.2,8,6),flash:new THREE.SphereGeometry(1,16,12)};
RG.nose.translate(0,0.3,0);
const RM={body:lam('#ff7a1a'),nose:lam('#f2c94c'),fin:lam('#2a2a28'),puff:new THREE.MeshBasicMaterial({color:'#d8d3c8',transparent:true,opacity:0.5,depthWrite:false})};
function fireRocket(){
  if(cool>0||!special||special.ammo<=0) return;
  special.ammo--; cool=ROCKET.cool; stats.shots++;
  const eye=new THREE.Vector3(P.x,P.y+eyeH,P.z), fwd=new THREE.Vector3(); camera.getWorldDirection(fwd);
  const right=new THREE.Vector3().crossVectors(fwd,UP).normalize();
  const pos=eye.clone().addScaledVector(fwd,0.7).addScaledVector(right,0.18); pos.y-=0.08;
  const v=eye.clone().addScaledVector(fwd,40).sub(pos).normalize().multiplyScalar(ROCKET.speed);
  const g=new THREE.Group(); g.add(new THREE.Mesh(RG.body,RM.body)); g.add(new THREE.Mesh(RG.nose,RM.nose));
  for(let k=0;k<4;k++){const f=new THREE.Mesh(RG.fin,RM.fin);f.position.set(Math.cos(k*Math.PI/2)*0.08,-0.18,Math.sin(k*Math.PI/2)*0.08);f.rotation.y=k*Math.PI/2;g.add(f)}
  g.position.copy(pos); scene.add(g); rockets.push({g,p:pos,v,t:0,pt:0});
  kickP+=0.08; gunKick=1; shake=Math.max(shake,0.12); rumble(0.7,0.5,180); sfx('launch'); alertNoise(P.x,P.z,30);
  if(special.ammo<=0) setTimeout(()=>{if(special&&special.ammo<=0&&slot===1){slot=0;buildViewGun(weapon);addFeed('The <i>Boomtube</i> is out of rockets. Buy more in the shop')}},700);
}
function updateRockets(dt){
  for(let i=rockets.length-1;i>=0;i--){
    const k=rockets[i]; k.t+=dt; k.pt+=dt; k.v.y-=1.5*dt;
    const n=Math.ceil(k.v.length()*dt/0.25), h=dt/n; let boom=false;
    for(let s=0;s<n&&!boom;s++){
      k.p.addScaledVector(k.v,h); const p=k.p;
      if(p.y<GH(p.x,p.z)+0.05||k.t>4||Math.abs(p.x)>60||Math.abs(p.z)>60) boom=true;
      else if(boxes.some(b=>p.x>b.x0&&p.x<b.x1&&p.y>b.y0&&p.y<b.y1&&p.z>b.z0&&p.z<b.z1)) boom=true;
      else for(const e of enemies){const es=e.t.s;if(Math.abs(e.x-p.x)>1.4*es||Math.abs(e.z-p.z)>1.4*es)continue;
        const legs=tmpV3.addVectors(e.pts[8],e.pts[10]).multiplyScalar(0.5).clone();
        if(p.distanceTo(e.pts[0])<0.3*es||segDist(p,e.pts[1],e.pts[2])<0.35*es||segDist(p,e.pts[2],legs)<0.25*es){boom=true;break}}
    }
    k.g.position.copy(k.p); k.g.quaternion.setFromUnitVectors(UP,tmpV.copy(k.v).normalize());
    if(k.pt>0.025){k.pt=0;const m=new THREE.Mesh(RG.puff,RM.puff.clone());m.position.copy(k.p);scene.add(m);puffs.push({m,t:0})}
    if(boom){scene.remove(k.g);rockets.splice(i,1);explode(k.p.clone())}
  }
  for(let i=puffs.length-1;i>=0;i--){const f=puffs[i];f.t+=dt;f.m.scale.setScalar(0.6+f.t*2.4);f.m.material.opacity=0.45*(1-f.t/0.9);f.m.position.y+=dt*0.4;if(f.t>0.9){scene.remove(f.m);f.m.material.dispose();puffs.splice(i,1)}}
  for(let i=flashes.length-1;i>=0;i--){const f=flashes[i];f.t+=dt;f.m.scale.setScalar(0.4+f.t*16);f.m.material.opacity=0.85*Math.max(0,1-f.t/0.32);if(f.t>0.32){scene.remove(f.m);f.m.material.dispose();flashes.splice(i,1)}}
}
function explode(pos){
  const R=ROCKET.radius, dmgBase=ROCKET.dmg*(1+mods.dmg);
  burst(pos,40,2.2);
  const fm=new THREE.Mesh(RG.flash,new THREE.MeshBasicMaterial({color:'#ffb347',transparent:true,opacity:0.85,blending:THREE.AdditiveBlending,depthWrite:false})); if(window.GFX) fm.material.color.multiplyScalar(GFX.b(3)); fm.position.copy(pos); scene.add(fm); flashes.push({m:fm,t:0});
  const dP=Math.hypot(pos.x-P.x,pos.z-P.z); sfx('boom',clamp(1.2-dP/50,0.2,1.2)); shake=Math.max(shake,0.5*clamp(1-dP/30,0,1)); if(dP<20) rumble(1,1,350);
  let kills=0, hitAny=false;
  for(const e of [...enemies]){
    const c=e.pts[1], d=pos.distanceTo(c), reach=R+0.4*e.t.s; if(d>reach) continue;
    const f=1-d/reach, dir=new THREE.Vector3(c.x-pos.x,0,c.z-pos.z); if(dir.lengthSq()<0.0001) dir.set(0,0,1); dir.normalize(); dir.y=0.7; dir.normalize();
    e.hp-=dmgBase*Math.max(0.35,f); e.flash=1; e.flinch=0.8; hitAny=true;
    if(e.hp<=0){killEnemy(e,dir,1,(1.6+2.2*f)*(e.t.boss?0.35:1));enemies.splice(enemies.indexOf(e),1);creditKill(e);kills++}
    else {e.x=clamp(e.x+dir.x*1.8*f,-36,36);e.z=clamp(e.z+dir.z*1.8*f,-44,44);addPop(new THREE.Vector3(e.pts[0].x,e.pts[0].y+0.4*e.t.s,e.pts[0].z),'BOOM','',0.8)}
  }
  if(kills>1){const b=50*kills;score+=b;addFeed(`<i>Multi-tag x${kills}</i> +${b}`)}
  if(kills) hitMarker(true);
  if(hitAny) stats.hits++;
  for(const Rg of ragdolls) for(let k=0;k<Rg.pts.length;k++){const d=pos.distanceTo(Rg.pts[k]);if(d<R){const f=1-d/R;tmpV.subVectors(Rg.pts[k],pos).normalize();Rg.prev[k].addScaledVector(tmpV,-FIXED*10*f);Rg.prev[k].y-=FIXED*6*f;Rg.flash=1}}
  for(const D of [...destructs]){const cx=(D.box.x0+D.box.x1)/2,cy=(D.box.y0+D.box.y1)/2,cz=(D.box.z0+D.box.z1)/2,d=Math.hypot(cx-pos.x,cy-pos.y,cz-pos.z);if(d<R+0.8){const f=1-d/(R+0.8);damageDestruct(D,30*f+4,new THREE.Vector3(cx-pos.x,0.6,cz-pos.z).normalize(),1.6)}}
  const dc=Math.hypot(pos.x-P.x,pos.y-(P.y+0.9),pos.z-P.z);
  if(dc<R&&mode==='play'){const f=1-dc/R,dx=(P.x-pos.x)/(dP||1),dz=(P.z-pos.z)/(dP||1);P.kx+=dx*8*f;P.kz+=dz*8*f;P.vy=Math.max(P.vy,5*f)}
}
function creditKill(e){
  const pts=e.t.pts; stats.tags++; score+=pts; killSound(false,e.t.boss); dropCash(e);
  const at=new THREE.Vector3(e.pts[0].x,e.pts[0].y+0.6*e.t.s,e.pts[0].z);
  if(e.t.boss){addFeed(`<b>${weapon.name}</b> blew up <i>Scoutmaster Thorne</i> +${pts}`);addPop(at,`BOSS DOWN!<small>+${pts}</small>`,'tag',2.2);}
  else{addFeed(`<b>${weapon.name}</b> blasted ${e.t.label} ${e.name} +${pts}`);addPop(at,`KABOOM!<small>+${pts}</small>`,'tag',1.4)}
}
function switchSlot(n){
  if(n===1&&(!special||special.ammo<=0)) return; if(slot===n) return;
  slot=n; zoomed=false; cool=Math.max(cool,0.25); buildViewGun(weapon); sfx('switch');
}
const canZoom=()=>!!(weapon&&weapon.zoom&&reloadT<=0&&slot===0);
function grantWeapon(item,at){
  if(item==='scope'&&!hasScope){
    hasScope=true; weapon=computeWeapon(); if(slot===0) buildViewGun(weapon); $('t-zm').hidden=false;
    addPop(at,'SCOPE<small>Right-click, Q or L2 to aim</small>','tag',2.2); addFeed(`Found a <i>scope</i> for the ${weapon.gun}`); waveFinds.weps.push('Scope');
  } else if(!special){
    special={kind:'rocket',ammo:4}; $('t-swp').hidden=false;
    addPop(at,'BOOMTUBE<small>Foam rocket launcher. Press 2 or Triangle</small>','tag',2.4); addFeed('Found the <i>Boomtube</i> rocket launcher with 4 rockets'); waveFinds.weps.push('Boomtube');
  } else {
    special.ammo=Math.min(ROCKET.max,special.ammo+3); addPop(at,'+3 ROCKETS','tag',1.8); addFeed('Grabbed <i>3 foam rockets</i>'); waveFinds.weps.push('Rockets');
  }
  stats.weps=(stats.weps||0)+1;
}


let feedItems=[], kickP=0, pops=[], bits=[];
const projV=new THREE.Vector3();
function placeEl(el,pos){
  projV.copy(pos).project(camera);
  const vis=projV.z<1&&Math.abs(projV.x)<1.2&&Math.abs(projV.y)<1.2;
  el.style.display=vis?'':'none';
  if(vis) el.style.transform=`translate(${(projV.x*0.5+0.5)*stage.clientWidth}px,${(-projV.y*0.5+0.5)*stage.clientHeight}px) translate(-50%,-100%)`;
}
function addPop(pos,html,cls,dur){
  const el=document.createElement('div'); el.className='pop '+(cls||''); el.innerHTML=html; $('pops').appendChild(el);
  const q=pos.clone(); if(cls!=='tag'){q.x+=rand(-0.25,0.25);q.z+=rand(-0.25,0.25)} pops.push({el,pos:q,t:0,dur:dur||1}); placeEl(el,pos);
}
function updatePops(dt){
  for(let i=pops.length-1;i>=0;i--){const p=pops[i];p.t+=dt;p.pos.y+=dt*0.9;placeEl(p.el,p.pos);
    const f=p.t/p.dur; p.el.style.opacity=f<0.7?1:Math.max(0,1-(f-0.7)/0.3);
    if(p.t<0.12) p.el.style.transform+=` scale(${1.6-p.t/0.12*0.6})`;
    if(p.t>=p.dur){p.el.remove();pops.splice(i,1)}}
}
const bitG=new THREE.SphereGeometry(0.05,5,4), bitM=[lam('#ff7a1a'),lam('#fff4e0'),lam('#3fa7d6')];
function burst(pos,n,power){
  for(let i=0;i<n;i++){const m=new THREE.Mesh(bitG,bitM[i%3]);m.position.copy(pos);scene.add(m);
    bits.push({m,v:new THREE.Vector3(rand(-1,1),rand(0.3,1.4),rand(-1,1)).multiplyScalar(3*power),t:0,dur:rand(0.45,0.8)})}
}
function updateBits(dt){
  for(let i=bits.length-1;i>=0;i--){const b=bits[i];b.t+=dt;b.v.y-=12*dt;b.m.position.addScaledVector(b.v,dt);b.m.scale.setScalar(Math.max(0.01,1-b.t/b.dur));
    if(b.t>=b.dur){scene.remove(b.m);bits.splice(i,1)}}
}
function clearFx(){pops.forEach(p=>p.el.remove());pops=[];bits.forEach(b=>scene.remove(b.m));bits=[];$('pops').innerHTML=''}
function addFeed(html){feedItems.push({html,t:clock});if(feedItems.length>5)feedItems.shift();renderFeed()}
let feedHTML='';
function renderFeed(){const h=feedItems.filter(f=>clock-f.t<5).map(f=>`<div>${f.html}</div>`).join('');if(h!==feedHTML){feedHTML=h;$('feed').innerHTML=h}}
function TX(id,v){const el=$(id);if(el._v!==v){el._v=v;el.textContent=v}}
function HX(id,v){const el=$(id);if(el._h!==v){el._h=v;el.innerHTML=v}}
let hitTimer=null;
function hitMarker(kill){const h=$('hitm');h.classList.add('on');h.classList.toggle('kill',kill);clearTimeout(hitTimer);hitTimer=setTimeout(()=>h.classList.remove('on'),kill?260:120)}
let bannerT=0;
function showBanner(t,sub,dur){const b=$('banner');b.innerHTML=t+(sub?`<small>${sub}</small>`:'');b.classList.add('on');bannerT=dur||0}
function hideBanner(){$('banner').classList.remove('on');bannerT=0}

function updateDarts(dt){
  for(let i=darts.length-1;i>=0;i--){
    const d=darts[i];
    if(d.stuck){d.life+=dt;if(d.life>10||darts.length>140){scene.remove(d.g);darts.splice(i,1)}continue}
    d.life+=dt;
    const n=Math.max(1,Math.ceil(d.v.length()*dt/0.15)), h=dt/n; let done=false;
    for(let s=0;s<n&&!done;s++){
      d.v.y-=d.grav*h; d.p.addScaledVector(d.v,h); d.dist+=d.v.length()*h;
      const p=d.p;
      if(d.owner==='p'){
        for(const e of enemies){
          const es=e.t.s; if(Math.abs(e.x-p.x)>1.3*es||Math.abs(e.z-p.z)>1.3*es) continue;
          const head=p.distanceTo(e.pts[0])<0.2*es;
          const body=head||segDist(p,e.pts[1],e.pts[2])<0.24*es||segDist(p,e.pts[2],tmpV.addVectors(e.pts[8],e.pts[10]).multiplyScalar(0.5).clone())<0.17*es;
          if(body){
            const dir=d.v.clone().normalize(); const bd=d.ally?d.dmg:weapon.dmg; let dmg=head?bd*3:bd, clank=false;
            if(!head&&e.t.armor&&dir.dot(frontOf(e.pts,tmpV3))<-0.2){dmg*=e.t.armor;clank=true}
            if(!d.ally)stats.hits++; e.hp-=dmg; sfx(clank?'clank':'hit',0.9); e.flinch=0.35; if(e.state!=='chase'){e.state='search';e.last={x:P.x,z:P.z};e.searchT=9;e.yaw=Math.atan2(P.x-e.x,P.z-e.z);e.senseT=0} e.flash=clank?0.3:1; burst(p,e.hp<=0?(e.t.boss?60:24):9,e.hp<=0?(e.t.boss?2.4:1.6):1);
            if(e.hp<=0){
              const idx=head?0:(p.y<e.y+0.6?8:1);
              killEnemy(e,dir,idx,d.knock*(weapon.pellets>1?1.15:1)*(e.t.boss?0.6:1));
              enemies.splice(enemies.indexOf(e),1);
              let pts=e.t.pts; stats.tags++; let tag='';
              if(head){pts+=50;stats.heads++;tag+=' <i>HEADSHOT</i>'}
              if(d.dist>25){pts+=25;tag+=' <i>LONG SHOT</i>'}
              score+=pts; hitMarker(true); killSound(head,e.t.boss); dropCash(e);
              if(e.t.boss){addFeed(`<b>${d.ally?'Big bro':weapon.name}</b> took down <i>Scoutmaster Thorne</i>${tag} +${pts}`);addPop(tmpV.copy(e.pts[0]).setY(e.pts[0].y+0.8),`BOSS DOWN!<small>+${pts}</small>`,'tag',2.2);}
              else{addFeed(`<b>${d.ally?'Big bro':weapon.name}</b> tagged ${e.t.label} ${e.name}${tag} +${pts}`);addPop(tmpV.copy(e.pts[0]).setY(e.pts[0].y+0.5*e.t.s),`${head?'HEADSHOT!':'TAGGED!'}<small>+${pts}</small>`,'tag',1.4)}
            } else {
              hitMarker(false); addPop(tmpV.copy(e.pts[0]).setY(e.pts[0].y+0.35*e.t.s),clank?'CLANK':'HIT','',0.7);
              if(!e.t.boss&&!e.mark){e.mark=document.createElement('div');e.mark.className='mark';$('pops').appendChild(e.mark)}
              if(e.mark)e.mark.innerHTML=`${Math.ceil(e.hp/weapon.dmg-0.001)} MORE<i></i>`;
            }
            scene.remove(d.g); darts.splice(i,1); done=true; break;
          }
        }
        if(done) break;
        for(const R of ragdolls){ for(let k=0;k<R.pts.length;k++){ if(p.distanceTo(R.pts[k])<0.2){ R.prev[k].addScaledVector(d.v,-FIXED*0.25*d.knock); R.prev[k].y-=FIXED*2.5; R.flash=0.8; burst(p,6,0.8); addPop(tmpV.copy(R.pts[k]).setY(R.pts[k].y+0.4),'BOING','',0.6); scene.remove(d.g);darts.splice(i,1);done=true;hitMarker(false);break } } if(done)break }
        if(done) break;
      } else if(mode==='play') {
        if(Math.abs(P.x-p.x)<0.6&&Math.abs(P.z-p.z)<0.6&&p.y>P.y&&p.y<P.y+eyeH+0.15){
          scene.remove(d.g); darts.splice(i,1); done=true; hurtPlayer(d.dmg,p.x-d.v.x,p.z-d.v.z,0); break;
        }
      }
      // world
      if(p.y<WATER&&GH(p.x,p.z)<WATER){scene.remove(d.g);darts.splice(i,1);done=true;break}
      const under=p.y<GH(p.x,p.z), hb=under?null:boxes.find(b=>p.x>b.x0&&p.x<b.x1&&p.y>b.y0&&p.y<b.y1&&p.z>b.z0&&p.z<b.z1);
      if(hb&&hb.dref){damageDestruct(hb.dref,d.owner==='p'?weapon.dmg:0.5,d.v.clone().normalize(),0.6);burst(p,3,0.5);scene.remove(d.g);darts.splice(i,1);done=true;break}
      if((under||hb)&&d.owner==='p'&&d.at!=='foam'){if(d.at==='paint'){addDecal(p.clone().addScaledVector(d.v.clone().normalize(),-0.04),d.v,paintCol());sfx('splat',distVol(p.x,p.z)*0.6)}else burst(p,2,0.3);scene.remove(d.g);darts.splice(i,1);done=true;break}
      if(under||hb){d.stuck=true;d.life=0;p.addScaledVector(d.v.clone().normalize(),0.06);break}
      if(d.life>4||Math.abs(p.x)>60||Math.abs(p.z)>60){scene.remove(d.g);darts.splice(i,1);done=true;break}
    }
    if(!done){d.g.position.copy(d.p);if(!d.stuck||d.life===0)d.g.quaternion.setFromUnitVectors(UP,tmpV.copy(d.v).normalize())}
  }
}

function playerOut(){
  if(lives>1){loseLife();return} lives=0;
  mode='dead'; deadT=0; fireHeld=false; zoomed=false;
  try{document.exitPointerLock()}catch(e){}
  $('touch').hidden=true;
  if(score>best){best=score;try{localStorage.setItem('gullyFoamBest',String(best))}catch(e){}}
  showBanner('SOAKED!',`${weapon.name} is out. Wave ${wave}, ${score} points`,0);
  setTimeout(()=>{if(mode==='dead')renderPanel()},900);
}

function updatePlayer(dt){
  const k=weapon;
  let fx=0,fz=0;
  if(keys.KeyW||keys.ArrowUp)fz+=1; if(keys.KeyS||keys.ArrowDown)fz-=1; if(keys.KeyD||keys.ArrowRight)fx+=1; if(keys.KeyA||keys.ArrowLeft)fx-=1;
  if(stickVec.active){fx+=stickVec.x;fz+=-stickVec.y}
  fx+=pad.mx; fz-=pad.my;
  const fl=Math.hypot(fx,fz); if(fl>1){fx/=fl;fz/=fl}
  const crouching=crouch||keys.ControlLeft; eyeH+=((crouching?EYE*0.5:EYE)-eyeH)*Math.min(1,dt*12);
  let sp=k.move*(!crouching&&(keys.ShiftLeft||keys.ShiftRight||pad.sprint)?1.45:1)*(zoomed?0.5:1)*(crouching?0.5:1)*(speedT>0?1.5:1);
  if(speedT>0){speedT-=dt;if(speedT<=0)addFeed('Your <i>speed shoes</i> wore out')} if(jumpT>0){jumpT-=dt;if(jumpT<=0)addFeed('Your <i>jump shoes</i> wore out')}
  const feetWet=GH(P.x,P.z)<WATER-0.05&&P.y<WATER; if(feetWet) sp*=0.5;
  const sy=Math.sin(P.yaw),cy=Math.cos(P.yaw), mvx=fx*cy-fz*sy, mvz=-fx*sy-fz*cy;
  sprinting=!crouching&&(keys.ShiftLeft||keys.ShiftRight||pad.sprint)&&fl>0.3&&P.onGround; if(fl>0.3){lastMv.x=mvx;lastMv.z=mvz}
  if(slideT>0){slideT-=dt;const f=Math.max(0,slideT/0.75),ss=k.move*(0.5+2.4*f);P.x+=(slideDir.x*0.85+mvx*0.15)*ss*dt;P.z+=(slideDir.z*0.85+mvz*0.15)*ss*dt}
  else {P.x+=mvx*sp*dt; P.z+=mvz*sp*dt}
  P.x+=P.kx*dt; P.z+=P.kz*dt; const kd=Math.max(0,1-dt*5); P.kx*=kd; P.kz*=kd;
  P.x=clamp(P.x,-38,38); P.z=clamp(P.z,-46,46);
  pushOutXZ(P,0.35,P.y,P.y+eyeH+0.1);
  for(const e of enemies){const dx=P.x-e.x,dz=P.z-e.z,d=Math.hypot(dx,dz),m=0.35+0.3*e.t.s;if(d<m&&d>0){P.x=e.x+dx/d*m;P.z=e.z+dz/d*m}}
  P.vy-=GRAV*dt; P.y+=P.vy*dt;
  { let cy=1e9; for(const b of boxes){ if(b.y0>P.y+0.6&&b.y0<cy&&P.x>b.x0-0.3&&P.x<b.x1+0.3&&P.z>b.z0-0.3&&P.z<b.z1+0.3) cy=b.y0 }
    if(P.y+eyeH+0.15>cy){ P.y=cy-eyeH-0.15; if(P.vy>0){P.vy=0; if(jumpT>0) sfx('clank',0.4)} } }
  const ground=supportY(P.x,P.z,P.y,0.35);
  if(P.y<=ground){P.y=ground;P.vy=0;P.onGround=true}else if(P.y-ground>0.05)P.onGround=false;
  if((keys.Space||jumpHeld||pad.jump)&&P.onGround){crouch=false;slideT=0;P.vy=jumpT>0?10.5:6.2;if(jumpT>0)sfx('slide',0.5);P.onGround=false}
  // weapon
  cool=Math.max(0,cool-dt);
  if(reloadT>0){reloadT-=dt;if(reloadT<=0){reloadT=0;ammo=k.mag}}
  if(fireHeld){ if(k.auto) fire(); else if(!fireLatch){fire();fireLatch=true} }
  recoil=Math.max(0,recoil-dt*(k.pellets>1?1.5:3)); gunKick=Math.max(0,gunKick-dt*6);
  P.pitch=clamp(P.pitch,-1.45,1.45);
  // camera
  const bob=P.onGround&&fl>0?Math.sin(clock*sp*2.2)*0.035:0;
  kickP=Math.max(0,kickP-dt*kickP*8-dt*0.02); camera.position.set(P.x,P.y+eyeH+bob,P.z); camera.rotation.set(P.pitch+kickP,P.yaw,slideT>0?0.06*slideT/0.75:0);
  if(shake>0){camera.position.x+=rand(-shake,shake)*0.25;camera.position.y+=rand(-shake,shake)*0.25;shake=Math.max(0,shake-dt*1.4)}
  const fov=zoomed?28:72; if(Math.abs(camera.fov-fov)>0.1){camera.fov+=(fov-camera.fov)*Math.min(1,dt*14);camera.updateProjectionMatrix()}
  if(viewGun){viewGun.visible=!zoomed;viewGun.position.set(0.2+(fl>0?Math.sin(clock*sp*2.2)*0.008:0),-0.19+bob*0.3-(reloadT>0?0.12:0),-0.42+gunKick*0.06);viewGun.rotation.x=(reloadT>0?-0.6:0)+gunKick*0.18}
}

function updateWaves(dt){
  if(waveT>0){waveT-=dt;if(waveT<=0){roster.forEach(k=>spawnEnemy(k));waveSpawned=true;if(wave%5===0)sfx('growl',1.6,36);showBanner(wave%5===0?'Here comes Thorne':'Incoming!','',1.6)}}
  else if(waveSpawned&&enemies.length===0&&mode==='play'&&!nukeS) endWave();
  else if(waveSpawned&&mode==='play'){
    directorT+=dt;
    if(directorT>18){directorT=0;
      if(!enemies.some(e=>e.state==='chase'||e.state==='search')){
        enemies.slice().sort((a,b)=>Math.hypot(a.x-P.x,a.z-P.z)-Math.hypot(b.x-P.x,b.z-P.z)).slice(0,2).forEach(e=>{e.state='search';e.last={x:P.x+rand(-8,8),z:P.z+rand(-8,8)};e.searchT=10;e.lookT=0});
      }}
  }
}

function updateHud(){
  TX('score',score); const left=waveSpawned?enemies.length:roster.length; TX('wave',waveT>0?`${LEVEL_NAME[curLevel]} · Wave ${Math.max(1,wave)} · ${left} arriving in ${Math.ceil(waveT)}s`:`${LEVEL_NAME[curLevel]} · Wave ${Math.max(1,wave)} · ${left} left`);
  const boss=enemies.find(e=>e.t.boss); $('bossbar').hidden=!boss; if(boss)$('bossfill').style.width=Math.max(0,boss.hp/boss.maxHp*100)+'%';
  TX('finds',`Med packs ${waveFinds.meds}/2 · Ultimate ${progressN()}/${progressT()}`);
  $('shield').style.width=shield+'%';
  { const ch=[]; if(shield>0)ch.push(`<b style="color:#f2d84c">Poncho ${Math.ceil(shield)}</b>`); if(speedT>0)ch.push(`<b style="color:#2ec4d6">Speed ${Math.ceil(speedT)}s</b>`); if(jumpT>0)ch.push(`<b style="color:#8fd16f">Jump ${Math.ceil(jumpT)}s</b>`); if(phones>0)ch.push(`<b style="color:#7fd0ff">Phone: ${getPad()?'D-pad up':touchDevice?'CALL':'G'}</b>`); if(ally)ch.push('<b style="color:#7fb2ff">Big bro helping</b>'); if(nukes>0)ch.push(`<b style="color:#ff8a6a">Nuke x${nukes}: ${getPad()?'D-pad down':touchDevice?'NUKE':'N'}</b>`); if(P.invuln&&clock<P.invuln)ch.push('<b style="color:#fff">Safe</b>'); const h=ch.join(' '); if($('pwr').innerHTML!==h)HX('pwr',h); $('t-call').hidden=!(phones>0&&inputMode==='touch'); $('t-nuke').hidden=!(nukes>0&&inputMode==='touch'); }
  TX('gname',!weapon?'':slot===1?'Boomtube · 1 to swap':weapon.gun+(upLevel?` +${upLevel}`:'')+(special?' · 2 Boomtube':''));
  TX('cash','$'+cash); {const lh='Lives '+'<i></i>'.repeat(Math.max(0,lives)); if($('lives').innerHTML!==lh)HX('lives',lh);} $('cross').classList.toggle('laser',rares.has('laser'));
  $('soak').style.width=Math.max(0,P.hp/maxHP()*100)+'%';
  $('vig').style.opacity=(Math.max(0,1-P.hp/maxHP())*0.9).toFixed(2);
  HX('ammo',slot===1&&special?`${special.ammo} <small>rockets</small>`:`${reloadT>0?'--':ammo} <small>/ ${weapon?weapon.mag:0}</small>`);
  $('reload').classList.toggle('on',reloadT>0);
  $('scope').classList.toggle('on',zoomed);
  $('cross').style.setProperty('--gap',(zoomed?2:((weapon&&weapon.pellets>1?14:5)+recoil*14)*(isCrouched()?0.65:1))+'px');
  $('crouchtag').classList.toggle('on',isCrouched());
  $('cross').style.opacity=zoomed?0.9:1;
  renderFeed();
}

// ---------- input ----------
const touchDevice=matchMedia('(pointer:coarse)').matches;
let jumpHeld=false; const stickVec={active:false,x:0,y:0,id:null,ox:0,oy:0}; let lookTouch=null, dragLook=null;
addEventListener('keydown',e=>{
  if(e.code==='KeyM'){setMute(!muted);if(mode==='play')addFeed(muted?'Sound off':'Sound on');if(mode==='play'||mode==='menu')renderPanel()}
  if(mode==='break'&&(e.code==='Enter'||e.code==='NumpadEnter')){if(document.activeElement&&document.activeElement.dataset&&document.activeElement.dataset.buy)return;e.preventDefault();nextWave();return}
  if(mode==='win'&&(e.code==='Enter'||e.code==='NumpadEnter')){e.preventDefault();keepPlaying();return}
  if(mode!=='play')return;
  keys[e.code]=true;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  if(e.code==='KeyR')startReload();
  if(e.code==='KeyG')callBrother();
  if(e.code==='KeyN')useNuke();
  if(e.code==='KeyT')toggleTwin();
  if(e.code==='KeyC')toggleCrouch(); if(e.code==='ControlLeft'){e.preventDefault();if(!e.repeat&&sprinting)startSlide()}
  if(e.code==='Digit1')switchSlot(0); if(e.code==='Digit2')switchSlot(1); if(e.code==='KeyX')switchSlot(slot?0:1);
  if(e.code==='KeyF')fireHeld=true;
  if(e.code==='KeyQ'&&canZoom())zoomed=!zoomed;
});
addEventListener('keyup',e=>{keys[e.code]=false;if(e.code==='KeyF'){fireHeld=false;fireLatch=false}});
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;fireHeld=false});
const cvs=renderer.domElement;
cvs.addEventListener('contextmenu',e=>e.preventDefault());
cvs.addEventListener('mousedown',e=>{
  if(mode!=='play'||touchDevice)return;
  if((inputMode==='lock'||inputMode==='pad')&&document.pointerLockElement!==cvs){requestLock();return}
  if(e.button===2){if(canZoom())zoomed=true;return}
  if(inputMode==='lock'){fireHeld=true}
  else if(inputMode==='drag'){dragLook={x:e.clientX,y:e.clientY,moved:0}}
});
addEventListener('mouseup',e=>{
  if(e.button===2){zoomed=false;return}
  if(inputMode==='drag'&&dragLook){if(dragLook.moved<6&&mode==='play'){fire();}dragLook=null}
  fireHeld=keys.KeyF||false; fireLatch=false;
});
addEventListener('mousemove',e=>{
  if(mode!=='play'||paused)return;
  const sens=zoomed?0.0009:0.0022;
  if(inputMode==='lock'&&document.pointerLockElement===cvs){P.yaw-=e.movementX*sens;P.pitch-=e.movementY*sens}
  else if(inputMode==='drag'&&dragLook){const dx=e.clientX-dragLook.x,dy=e.clientY-dragLook.y;dragLook.moved+=Math.abs(dx)+Math.abs(dy);dragLook.x=e.clientX;dragLook.y=e.clientY;P.yaw-=dx*sens*1.6;P.pitch-=dy*sens*1.6}
});
// touch
cvs.addEventListener('pointerdown',e=>{
  if(e.pointerType!=='touch'||mode!=='play')return;
  const r=stage.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top;
  if(x<r.width*0.45&&!stickVec.active){Object.assign(stickVec,{active:true,id:e.pointerId,ox:x,oy:y,x:0,y:0});const s=$('stick');s.style.left=x+'px';s.style.top=y+'px';s.classList.add('on')}
  else if(!lookTouch) lookTouch={id:e.pointerId,x:e.clientX,y:e.clientY};
  cvs.setPointerCapture(e.pointerId);
});
cvs.addEventListener('pointermove',e=>{
  if(e.pointerType!=='touch')return;
  if(stickVec.active&&e.pointerId===stickVec.id){const r=stage.getBoundingClientRect();let dx=e.clientX-r.left-stickVec.ox,dy=e.clientY-r.top-stickVec.oy;const l=Math.hypot(dx,dy),m=40;if(l>m){dx*=m/l;dy*=m/l}stickVec.x=dx/m;stickVec.y=dy/m;$('knob').style.transform=`translate(${dx}px,${dy}px)`}
  else if(lookTouch&&e.pointerId===lookTouch.id){const s=zoomed?0.002:0.005;P.yaw-=(e.clientX-lookTouch.x)*s;P.pitch-=(e.clientY-lookTouch.y)*s;lookTouch.x=e.clientX;lookTouch.y=e.clientY}
});
function endTouch(e){if(stickVec.active&&e.pointerId===stickVec.id){stickVec.active=false;stickVec.x=stickVec.y=0;$('stick').classList.remove('on');$('knob').style.transform=''}if(lookTouch&&e.pointerId===lookTouch.id)lookTouch=null}
cvs.addEventListener('pointerup',endTouch); cvs.addEventListener('pointercancel',endTouch);
function holdBtn(id,down,up){const b=$(id);b.addEventListener('pointerdown',e=>{e.preventDefault();down()});b.addEventListener('pointerup',up||(()=>{}));b.addEventListener('pointercancel',up||(()=>{}));b.addEventListener('pointerleave',up||(()=>{}))}
holdBtn('t-fire',()=>{fireHeld=true},()=>{fireHeld=false;fireLatch=false});
holdBtn('t-jump',()=>{jumpHeld=true},()=>{jumpHeld=false});
holdBtn('t-rel',()=>startReload());
holdBtn('t-zm',()=>{if(canZoom())zoomed=!zoomed});
holdBtn('t-swp',()=>switchSlot(slot?0:1));
holdBtn('t-duck',()=>toggleCrouch());
holdBtn('t-call',()=>callBrother());
holdBtn('t-nuke',()=>useNuke());
addEventListener('wheel',e=>{if(mode==='play'&&special&&document.pointerLockElement===cvs)switchSlot(slot?0:1)},{passive:true});

// ---------- controller (PS5 DualSense, standard mapping) ----------
const pad={mx:0,my:0,jump:false,sprint:false,fire:false,zoom:false,name:''}; let padPrev=[], padBlocked=false;
try{ if(navigator.getGamepads) navigator.getGamepads(); else padBlocked=true; }catch(e){ padBlocked=true; }
function getPad(){ if(padBlocked) return null; try{ const ps=navigator.getGamepads(); for(const p of ps) if(p&&p.connected) return p; }catch(e){ padBlocked=true; } return null; }
function padName(id){ return /dualsense|054c.*0ce6|ps5/i.test(id)?'PS5 DualSense':/dualshock|054c/i.test(id)?'PlayStation controller':'Controller'; }
function padLine(){
  if(padBlocked) return 'Controller support is blocked in this view. Try opening the game in a regular browser tab.';
  const gp=getPad();
  return gp?`<b>${padName(gp.id)} connected.</b> Cross to drop in, D-pad left/right to pick a kid.`:'To use a PS5 controller, connect it by USB or Bluetooth, then press any button on it.';
}
function rumble(strong,weak,ms){ const gp=getPad(); try{ if(gp&&gp.vibrationActuator) gp.vibrationActuator.playEffect('dual-rumble',{duration:ms,strongMagnitude:strong,weakMagnitude:weak}); }catch(e){} }
addEventListener('gamepadconnected',e=>{ const n=padName(e.gamepad.id); if(mode==='menu'){const l=$('padline');if(l)l.innerHTML=padLine()} if(mode==='play'||mode==='break') addFeed(`<i>${n}</i> connected`); });
addEventListener('gamepaddisconnected',()=>{ pad.mx=pad.my=0; pad.jump=pad.sprint=false; if(pad.fire){fireHeld=false;fireLatch=false} pad.fire=false;
  if(mode==='play'&&inputMode==='pad'){paused=true;showBanner('Controller disconnected','Reconnect it, or click the battlefield to use mouse and keyboard',0)}
  if(mode==='menu'){const l=$('padline');if(l)l.innerHTML=padLine()} });
const KID_ORDER=['rosa','dev','tibbs'];
function pollPad(dt){
  const gp=getPad();
  if(!gp){pad.mx=pad.my=0;pad.jump=pad.sprint=false;return}
  const btn=i=>!!(gp.buttons[i]&&(gp.buttons[i].pressed||gp.buttons[i].value>0.4));
  const pressed=i=>btn(i)&&!padPrev[i];
  const dz=v=>Math.abs(v)<0.14?0:(v-Math.sign(v)*0.14)/0.86;
  const ax=i=>dz(gp.axes[i]||0);
  if(mode==='menu'){
    if(pressed(14)||pressed(15)){const i=KID_ORDER.indexOf(kidId);kidId=KID_ORDER[(i+(pressed(15)?1:2))%3];renderPanel()}
    if(pressed(3)){const ks=Object.keys(AMMO);ammoType=ks[(ks.indexOf(ammoType)+1)%3];try{localStorage.setItem('gullyAmmo',ammoType)}catch(e){}renderPanel()}
    if(pressed(4)||pressed(5)) setStartLevel(LEVELS[(LEVELS.indexOf(startLevel)+(pressed(5)?1:2))%3]);
    if(pressed(0)||pressed(9)) startGame(true);
  } else if(mode==='win'){
    if(pressed(0)||pressed(9)) keepPlaying(true);
  } else if(mode==='break'){
    const btns=[...$('brk').querySelectorAll('button:not([disabled])')], cur=btns.indexOf(document.activeElement);
    if(pressed(12)||pressed(14)) (btns[Math.max(0,cur-1)]||btns[0]).focus();
    if(pressed(13)||pressed(15)) (btns[Math.min(btns.length-1,cur+1)]||btns[0]).focus();
    if(pressed(9)) nextWave(true);
    else if(pressed(0)){ if(cur>=0&&document.activeElement.id!=='nextw') document.activeElement.click(); else nextWave(true) }
  } else if(mode==='dead'){
    if(pressed(0)){hideBanner();startGame(true)} else if(pressed(1)) toMenu();
  } else if(mode==='play'){
    const active=gp.axes.some(a=>Math.abs(a)>0.35)||gp.buttons.some(b=>b.pressed);
    if(active&&inputMode!=='pad'){
      inputMode='pad'; $('touch').hidden=true;
      if(paused){paused=false;hideBanner()}
      try{if(document.pointerLockElement)document.exitPointerLock()}catch(e){}
    }
    if(inputMode==='pad'){
      if(pressed(9)){paused=!paused;if(paused){fireHeld=false;showBanner('Paused','Press Options to resume',0)}else hideBanner()}
      if(!paused){
        pad.mx=ax(0); pad.my=ax(1);
        const lx=ax(2), ly=ax(3), rate=(zoomed?0.9:2.9)*dt;
        P.yaw-=Math.sign(lx)*lx*lx*rate; P.pitch-=Math.sign(ly)*ly*ly*rate*0.7;
        pad.jump=btn(0); pad.sprint=btn(10)||(pad.sprint&&Math.hypot(pad.mx,pad.my)>0.3);
        const f=btn(7); if(f&&!pad.fire)fireHeld=true; if(!f&&pad.fire){fireHeld=false;fireLatch=false} pad.fire=f;
        const z=btn(6); if(z!==pad.zoom)zoomed=z&&canZoom(); pad.zoom=z;
        if(pressed(3)) switchSlot(slot?0:1);
        if(pressed(12)) callBrother();
        if(pressed(13)) useNuke();
        if(pressed(1)||pressed(11)) toggleCrouch();
        if(pressed(2)||pressed(5)) startReload();
      } else {pad.mx=pad.my=0}
    }
  }
  padPrev=gp.buttons.map((b,i)=>btn(i));
}

// ---------- panel ----------
function drawPortrait(c,kid){
  const S=c.canvas.width/120; c.setTransform(S,0,0,S,0,0); c.clearRect(0,0,120,120);
  c.fillStyle='#33452b'; c.beginPath(); c.arc(60,60,58,0,7); c.fill();
  c.save(); c.beginPath(); c.arc(60,60,58,0,7); c.clip();
  c.fillStyle=kid.shirt; c.beginPath(); c.ellipse(60,118,34,30,0,0,7); c.fill();
  c.fillStyle=kid.skin; c.fillRect(54,76,12,12);
  c.fillStyle=kid.hair; if(kid.hairStyle==='long'){c.beginPath();c.ellipse(60,62,26,30,0,0,7);c.fill()}
  c.fillStyle=kid.skin; c.beginPath(); c.arc(60,56,22,0,7); c.fill();
  c.fillStyle=kid.hair;
  if(kid.hairStyle==='long'){c.beginPath();c.arc(60,52,23,Math.PI*1.02,Math.PI*1.98);c.fill()}
  if(kid.hairStyle==='short'){c.beginPath();c.arc(60,52,23,Math.PI*1.05,Math.PI*1.95);c.fill();c.fillRect(37,46,6,8);c.fillRect(77,46,6,8)}
  if(kid.hairStyle==='curly'){for(let i=0;i<9;i++){const a=Math.PI*(1.05+i*0.11);c.beginPath();c.arc(60+Math.cos(a)*20,54+Math.sin(a)*20,8,0,7);c.fill()}}
  // goggles
  c.fillStyle='#ff7a1a'; c.fillRect(38,52,44,5);
  c.fillStyle='#bfe9f5'; c.strokeStyle='#1d1612'; c.lineWidth=2.5; c.beginPath(); c.arc(51,57,7,0,7); c.fill(); c.stroke(); c.beginPath(); c.arc(69,57,7,0,7); c.fill(); c.stroke();
  c.strokeStyle='#1d1612'; c.lineWidth=2; c.beginPath(); c.arc(60,67,6,0.2,Math.PI-0.2); c.stroke();
  // blaster
  c.save(); c.translate(64,98); c.rotate(-0.12);
  c.fillStyle=kid.gunCol; c.fillRect(-30,-9,52,18);
  c.fillStyle='#2a2a28'; c.fillRect(-18,8,9,16);
  c.fillStyle='#f4f1e6';
  if(kid.id==='rosa'){c.fillRect(22,-5,18,8);c.fillStyle='#ff7a1a';c.beginPath();c.arc(-4,12,10,0,7);c.fill();c.fillRect(38,-6,5,10)}
  if(kid.id==='dev'){c.fillRect(22,-8,22,6);c.fillRect(22,0,22,6);c.fillStyle='#8a5a2b';c.fillRect(20,6,16,8);c.fillStyle='#ff7a1a';c.fillRect(42,-9,4,16)}
  if(kid.id==='tibbs'){c.fillRect(22,-4,40,6);c.fillStyle='#2a2a28';c.fillRect(-14,-17,24,8);c.fillStyle='#ff7a1a';c.fillRect(60,-5,4,8)}
  c.restore(); c.restore();
}
function renderPanel(){
  if(mode==='menu'){
    panel.innerHTML=`<h2>Choose your blaster</h2>
      <p class="lede">The rival scout troop has gone feral: masked, glowing-eyed and hunting you through The Creek, the Abandoned City and the Office Tower. Tag scouts to make them drop cash, and spend it in the supply shop between waves on tune-ups, gear, blaster types and skin features. <b>Your goal: buy everything in the shop, then the Golden skin, to build the ultimate weapon.</b> You start with 3 lives, and the shop sells more lives, a bigger soak meter and the absurdly expensive Foam Nuke. Smash crates, boxes and barrels to find hidden rain ponchos, speed shoes, jump shoes and a cell phone that calls your big brother in to help.</p>
      <div class="kids">${Object.values(KIDS).map(k=>`
        <button class="kid" type="button" id="kid-${k.id}" data-kid="${k.id}" aria-pressed="${k.id===kidId}">
          <canvas width="168" height="168" data-portrait="${k.id}" aria-hidden="true"></canvas>
          <span class="nm">${k.name}</span>
          <span class="gun">${k.gun}</span>
          <p class="bl2">${k.blurb}</p>
          <span class="stats">${Object.entries(k.stats).map(([n,v])=>`<span>${n}</span><span class="bar">${[1,2,3,4,5].map(i=>`<i class="${i<=v?'on':''}"></i>`).join('')}</span>`).join('')}</span>
        </button>`).join('')}
      </div>
      <div class="keys">${touchDevice?`<span>Left thumb: move</span><span>Right thumb: look</span><span>FIRE, JUMP, R and ZOOM buttons</span>`:`<span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move</span><span>Mouse: look</span><span>Click: fire</span><span><kbd>R</kbd> reload</span><span><kbd>Shift</kbd> sprint &nbsp;<kbd>Space</kbd> jump</span><span>Right-click or <kbd>Q</kbd>: scope</span><span><kbd>1</kbd> <kbd>2</kbd> or wheel: switch weapon</span><span><kbd>C</kbd> crouch (or hold <kbd>Ctrl</kbd>), while sprinting to slide</span><span><kbd>G</kbd> call big brother</span><span><kbd>N</kbd> foam nuke</span><span><kbd>T</kbd> attach or remove twin barrel</span><span><kbd>M</kbd> sound on/off</span>`}</div>
      <div class="keys"><span><kbd>L-stick</kbd> move, click to sprint</span><span><kbd>R-stick</kbd> look</span><span><kbd>R2</kbd> fire &nbsp;<kbd>L2</kbd> scope</span><span><kbd>Cross</kbd> jump &nbsp;<kbd>Square</kbd> reload</span><span><kbd>Options</kbd> pause</span><span><kbd>Triangle</kbd> switch weapon</span><span><kbd>D-pad up</kbd> call big brother</span><span><kbd>D-pad down</kbd> foam nuke</span><span><kbd>Circle</kbd> or <kbd>R3</kbd> crouch / slide</span><span><kbd>Triangle</kbd> blaster type (menu)</span><span><kbd>L1</kbd> <kbd>R1</kbd> pick map in menu</span></div>
      <div class="row"><span class="hint"><b>Start in</b></span>${LEVELS.map(l=>`<button class="btn ghost lvl" id="lvl-${l}" type="button" aria-pressed="${startLevel===l}">${LEVEL_NAME[l]}</button>`).join('')}</div>
      <div class="row"><span class="hint"><b>Blaster type</b></span>${Object.entries(AMMO).map(([k,a])=>`<button class="btn ghost lvl" id="am-${k}" type="button" aria-pressed="${ammoType===k}">${a.n}</button>`).join('')}<span class="hint">${AMMO[ammoType].desc}</span></div>
      ${window.GFX?`<div class="row"><span class="hint"><b>Graphics</b></span>${GFX.levels.map(k=>`<button class="btn ghost lvl" id="gq-${k}" type="button" aria-pressed="${GFX.quality()===k}">${GFX.labelOf(k)}</button>`).join('')}<span class="hint">High adds glow, sharper shadows and more particles. Pick Low if the game stutters.</span></div>`:''}
      <p class="hint" id="padline">${padLine()}</p>
      <div class="row"><button class="btn" id="go" type="button">Drop in as ${KIDS[kidId].name}</button><button class="btn ghost" id="fs" type="button">Fullscreen</button>${best?`<span class="hint">Best: <b>${best}</b></span>`:''}${goldBuilt?`<span class="hint">Golden Blasters built: <b>${goldBuilt}</b></span>`:''}</div>`;
    panel.querySelectorAll('canvas[data-portrait]').forEach(c=>drawPortrait(c.getContext('2d'),KIDS[c.dataset.portrait]));
    panel.querySelectorAll('.kid').forEach(b=>b.onclick=()=>{kidId=b.dataset.kid;renderPanel();$('kid-'+kidId).focus()});
    $('go').onclick=startGame; $('fs').onclick=goFull; LEVELS.forEach(l=>$('lvl-'+l).onclick=()=>setStartLevel(l)); if(window.GFX) GFX.levels.forEach(k=>$('gq-'+k).onclick=()=>{GFX.setQuality(k);renderPanel();$('gq-'+k).focus()}); Object.keys(AMMO).forEach(k=>$('am-'+k).onclick=()=>{ammoType=k;try{localStorage.setItem('gullyAmmo',k)}catch(e){}renderPanel();$('am-'+k).focus()});
    return;
  }
  if(mode==='play'){
    panel.innerHTML=`<div class="row"><span class="hint">Playing as <b>${weapon.name}</b> with the <b>${weapon.gun}</b> (${AMMO[ammoType].short}). ${touchDevice?'Use the on-screen controls.':'Press <kbd>Esc</kbd> to pause.'}</span></div>
      <div class="row"><button class="btn ghost" id="fs" type="button">Fullscreen</button><button class="btn ghost" id="snd" type="button">${muted?'Sound: off':'Sound: on'}</button>${window.GFX?`<button class="btn ghost" id="gfx" type="button">Graphics: ${GFX.label()}</button>`:''}<button class="btn ghost" id="quit" type="button">Back to HQ</button></div>`;
    $('fs').onclick=goFull; $('quit').onclick=toMenu; $('snd').onclick=()=>{audioInit();setMute(!muted);renderPanel()}; if(window.GFX) $('gfx').onclick=()=>{const L=GFX.levels;GFX.setQuality(L[(L.indexOf(GFX.quality())+1)%L.length]);renderPanel()}; return;
  }
  if(mode==='dead'){
    const acc=stats.shots?Math.min(100,Math.round(stats.hits/stats.shots*100)):0, isBest=score>=best&&score>0;
    panel.innerHTML=`<h2>Soaked on wave ${wave} ${isBest?'<span class="badge">New best</span>':''}</h2>
      <div class="statgrid">
        <div class="cell"><div class="k">Score</div><div class="v">${score}</div></div>
        <div class="cell"><div class="k">Scouts tagged</div><div class="v">${stats.tags}</div></div>
        <div class="cell"><div class="k">Headshots</div><div class="v">${stats.heads}</div></div>
        <div class="cell"><div class="k">Accuracy</div><div class="v">${acc}%</div></div>
      </div>
      <p class="hint">Upgrades found: <b>${stats.ups}</b> · Med packs used: <b>${stats.meds}</b> · Weapon caches: <b>${stats.weps||0}</b> · Things smashed: <b>${stats.smashed||0}</b>. ${stats.turtle?`The bog turtle ate ${stats.turtle} scout${stats.turtle===1?'':'s'}. `:''}Best: <b>${best}</b></p>
      <div class="row"><button class="btn" id="again" type="button">Go again as ${weapon.name}</button><button class="btn ghost" id="swap" type="button">Pick a different kid</button></div>`;
    $('again').onclick=()=>{hideBanner();startGame()}; $('swap').onclick=toMenu; $('again').focus({preventScroll:true});
  }
}
function toMenu(){
  mode='menu'; paused=false; hideBanner(); try{document.exitPointerLock()}catch(e){}
  $('hud').hidden=true; $('touch').hidden=true;
  if(viewGun){camera.remove(viewGun);freeObj(viewGun,true);viewGun=null}
  clearTransient(); clearPickups(); envTarget=0; slot=0; if(curLevel!==startLevel) buildWorld((Math.random()*1e9)|0,startLevel); $('brk').hidden=true; camera.fov=72; camera.updateProjectionMatrix();
  renderPanel(); seedMenuScouts();
}
function goFull(){try{const r=stage.requestFullscreen&&stage.requestFullscreen();if(r&&r.catch)r.catch(()=>{})}catch(e){}}

// idle scouts for the menu flyover
let menuScouts=[];
function seedMenuScouts(){menuScouts.forEach(m=>freeRig(m.rig));menuScouts=[];const ks=['basic','runner','sniper','heavy'];for(let i=0;i<4;i++){const x=-6+i*4,z=12-i*3;menuScouts.push({rig:makeRig(ks[i]),s:ETYPES[ks[i]].s,pts:LOCAL.map(()=>new THREE.Vector3()),x,z,ph:i})}}
seedMenuScouts();

const ENV={city:{bg:new THREE.Color('#8d9399'),fog:new THREE.Color('#8f959a'),near:16,far:72,hemi:0.62,sun:0.62,sunC:new THREE.Color('#f2e2c8'),sky:new THREE.Color('#c9cfd4')},
  office:{bg:new THREE.Color('#1b2129'),fog:new THREE.Color('#bcc2c8'),near:22,far:75,hemi:0.85,sun:0.3,sunC:new THREE.Color('#ffffff'),sky:new THREE.Color('#ffffff')},
  day:{bg:new THREE.Color('#9cc8d4'),fog:new THREE.Color('#a9cfc9'),near:30,far:95,hemi:0.75,sun:0.9,sunC:new THREE.Color('#fff3d6'),sky:new THREE.Color('#dff0ff')},
  boss:{bg:new THREE.Color('#231f30'),fog:new THREE.Color('#342c40'),near:8,far:58,hemi:0.3,sun:0.55,sunC:new THREE.Color('#ff7a4a'),sky:new THREE.Color('#8a7aa8')}};
function applyEnv(dt){
  envK+=(envTarget-envK)*Math.min(1,dt*0.9); const k=envK, A=LV.kind==='city'?ENV.city:LV.kind==='office'?ENV.office:ENV.day, B=ENV.boss;
  scene.background.copy(A.bg).lerp(B.bg,k); scene.fog.color.copy(A.fog).lerp(B.fog,k);
  scene.fog.near=A.near+(B.near-A.near)*k; scene.fog.far=A.far+(B.far-A.far)*k;
  hemi.groundColor.set(LV.kind==='office'?'#b5b0a6':LV.kind==='city'?'#5a5650':'#3d5a2a');
  hemi.intensity=A.hemi+(B.hemi-A.hemi)*k; hemi.color.copy(A.sky).lerp(B.sky,k);
  sun.intensity=A.sun+(B.sun-A.sun)*k; sun.color.copy(A.sunC).lerp(B.sunC,k);
  const gb=window.GFX?GFX.b:(()=>1);
  for(const m of litMats) m.emissiveIntensity=(0.06+k*1.1)*gb(1.6);
  if(LV.kind==='office'){officeLight.color.setRGB(1,1-k*0.82,1-k*0.86);if(k>0.5&&Math.random()<0.05)officeLight.color.multiplyScalar(0.2); officeLight.color.multiplyScalar(gb(1.8))}
  if(LV.kind==='city'){ WM.bulbFlick.color.setHex(Math.random()<0.12?0x2a2a28:0xffe2a0); WM.bulbFlick.color.multiplyScalar(gb(2.4)) }
  if(window.GFX) GFX.env(k);
  droneOn(envTarget>0.5&&(mode==='play'||mode==='break'));
}
// ---------- loop ----------
let last=performance.now(), acc=0;
let frameErrs=0, ctxLost=false;
function frame(now){
  try{ frameInner(now) }catch(err){ frameErrs++; console.error('frame error',err); if(frameErrs<=3&&mode==='play') addFeed('<i>Glitch caught</i>, game kept running') }
  requestAnimationFrame(frame);
}
function frameInner(now){
  const dt=Math.min(0.05,(now-last)/1000); last=now;
  if(mode==='menu'){
    pollPad(dt);
    clock+=dt; const a=clock*0.08;
    if(LV.kind==='office'){camera.position.set(Math.sin(a*2)*8,2.3,20+Math.cos(a*2)*4);camera.lookAt(0,1.2,8)}
    else{const rad=LV.city?30:26; camera.position.set(Math.sin(a)*rad,(LV.city?24:7)+Math.sin(clock*0.2)*1.5,Math.cos(a)*rad+6); camera.lookAt(0,1,LV.city?10:8);}
    menuScouts.forEach((m,i)=>{const r=3+i*0.5,t=clock*0.5+i*1.6,x=m.x+Math.cos(t)*r,z=m.z+Math.sin(t)*r;standPose(m.pts,x,GH(x,z),z,t+Math.PI,clock*6+i,1,m.s);poseRig(m.rig,m.pts,true,t+Math.PI,i===3?-1.1:0)});
  } else {
    if(menuScouts.length){menuScouts.forEach(m=>freeRig(m.rig));menuScouts=[]}
    pollPad(dt);
    if(!paused){
      clock+=dt; acc+=dt;
      while(acc>=FIXED){ragdolls.forEach(stepRagdoll);acc-=FIXED}
      if(mode==='play'){updatePlayer(dt);updateWaves(dt);updatePickups(dt)}
      if(mode==='dead'){deadT+=dt;const t=Math.min(1,deadT/0.9);camera.position.y=P.y+eyeH*(1-t*0.75);camera.rotation.z=t*0.9;if(viewGun)viewGun.visible=false}
      enemies.forEach(e=>updateEnemy(e,dt)); if(mode==='play') updateAlly(dt);
      updateDarts(dt); updateRockets(dt); updateNuke(dt); updateDebris(dt); updateRagdolls(dt); updateTurtles(dt); updateBits(dt); updatePops(dt);
      if(bannerT>0){bannerT-=dt;if(bannerT<=0)hideBanner()}
      if(weapon){updateHud();renderBuild(dt)}
    }
  }
  applyEnv(dt);
  if(!ctxLost){ if(window.GFX) GFX.frame(dt); else renderer.render(scene,camera); }
}
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();ctxLost=true;showBanner('Graphics reset','Hang tight, recovering...',0)},false);
renderer.domElement.addEventListener('webglcontextrestored',()=>{ctxLost=false;hideBanner();buildSig='';addFeed('Graphics recovered')},false);
[cylG,headG,eyeG,glowG,maskG,spikeG,hornG,dartG,dartTipG,paintG,bbG,splatG,coinG,billG,bitG,shellG,turtleHeadG,...Object.values(PG),...Object.values(RG),...Object.values(NG)].forEach(g=>{if(g)g.userData.keep=true});
renderPanel();
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{if(signCanvas)drawSign()});
requestAnimationFrame(frame);
})();
