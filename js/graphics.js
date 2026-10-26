/* Gully Foam War: graphics layer.
   Loaded before game.js. The game runs without this file, and the Low preset turns most of it off.
   What it adds: HDR bloom, color grading, FXAA, an animated sky with clouds, procedural surface
   textures, sharper shadows that follow the player, and ambient particles per level. */
(function(){
'use strict';
const Q_KEY='gullyGfx';
const QUAL={
  low:   {label:'Low',   post:false,bloom:false,fxaa:false,particles:0,  shadow:1024,follow:false,pr:1,   textures:false,clouds:0},
  medium:{label:'Medium',post:true, bloom:false,fxaa:true, particles:350,shadow:2048,follow:true, pr:1.25,textures:true, clouds:1},
  high:  {label:'High',  post:true, bloom:true, fxaa:true, particles:700,shadow:2048,follow:true, pr:1.5, textures:true, clouds:1}
};
let q=null; try{q=localStorage.getItem(Q_KEY)}catch(e){}
if(!QUAL[q]) q=matchMedia('(pointer:coarse)').matches?'medium':'high';

let scale=1; try{const st=JSON.parse(localStorage.getItem('gullySettings')||'{}');if(st.scale)scale=+st.scale}catch(e){}
let R,S,C,SUN,HEMI,W=800,H=450, composer=null, bloomPass=null, gradePass=null, fxaaPass=null, sky=null, parts=null, level='ravine', mats=null, bossK=0, time=0;
const glowList=[], textured=[];
const hasPost=()=>!!(window.THREE&&THREE.EffectComposer&&THREE.RenderPass&&THREE.ShaderPass);
const bloomOn=()=>!!(QUAL[q].bloom&&composer&&bloomPass);

// ---------------- procedural textures ----------------
function rng(seed){let s=seed>>>0||1;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}
function canvasTex(size,draw,rx,ry){
  const cv=document.createElement('canvas'); cv.width=cv.height=size; const c=cv.getContext('2d'); draw(c,size);
  const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rx||1,ry||rx||1);
  if(R) t.anisotropy=Math.min(8,R.capabilities.getMaxAnisotropy()); return t;
}
function speckle(c,s,r,n,col,min,max){for(let i=0;i<n;i++){c.fillStyle=col(r());const w=min+r()*(max-min);c.fillRect(r()*s,r()*s,w,w)}}
const grey=v=>`rgb(${v|0},${v|0},${v|0})`;
const TEX={};
function tex(name){
  if(TEX[name]) return TEX[name];
  const r=rng(name.length*977+name.charCodeAt(0)*31);
  let t;
  switch(name){
    case 'grass': t=canvasTex(512,(c,s)=>{c.fillStyle=grey(232);c.fillRect(0,0,s,s);
      for(let i=0;i<60;i++){c.fillStyle=`rgba(${r()<.5?0:255},${r()<.5?0:255},0,0.05)`;c.beginPath();c.arc(r()*s,r()*s,20+r()*60,0,7);c.fill()}
      c.lineWidth=1.4;for(let i=0;i<5200;i++){const x=r()*s,y=r()*s,l=4+r()*8,a=-Math.PI/2+(r()-.5)*.8,v=170+r()*85;c.strokeStyle=grey(v);c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);c.stroke()}},40); break;
    case 'asphalt': t=canvasTex(512,(c,s)=>{c.fillStyle=grey(220);c.fillRect(0,0,s,s);
      speckle(c,s,r,9000,()=>grey(150+r()*105),1,2.4);
      c.strokeStyle='rgba(40,40,40,.55)';c.lineWidth=1.3;for(let k=0;k<9;k++){let x=r()*s,y=r()*s;c.beginPath();c.moveTo(x,y);for(let j=0;j<8;j++){x+=(r()-.5)*44;y+=(r()-.5)*44;c.lineTo(x,y)}c.stroke()}},36); break;
    case 'carpet': t=canvasTex(256,(c,s)=>{c.fillStyle=grey(226);c.fillRect(0,0,s,s);
      for(let y=0;y<s;y+=4)for(let x=0;x<s;x+=4){c.fillStyle=grey(((x+y)/4)%2?212:240);c.fillRect(x,y,3,3)}
      speckle(c,s,r,1800,()=>grey(170+r()*60),1,2)},50); break;
    case 'bark': t=canvasTex(256,(c,s)=>{c.fillStyle=grey(215);c.fillRect(0,0,s,s);
      for(let i=0;i<110;i++){const x=r()*s,w=2+r()*5;c.fillStyle=grey(110+r()*70);c.fillRect(x,0,w,s)}
      for(let i=0;i<90;i++){c.fillStyle=grey(90+r()*40);c.fillRect(r()*s,r()*s,3+r()*8,2)}},1,2); break;
    case 'logbark': t=canvasTex(256,(c,s)=>{c.drawImage(tex('bark').image,0,0)},2,1); break;
    case 'planks': t=canvasTex(256,(c,s)=>{const n=4;for(let i=0;i<n;i++){const y=i*s/n;c.fillStyle=grey(200+r()*40);c.fillRect(0,y,s,s/n);
        c.strokeStyle='rgba(60,40,20,.25)';for(let k=0;k<14;k++){c.lineWidth=0.6+r();c.beginPath();const yy=y+r()*s/n;c.moveTo(0,yy);c.bezierCurveTo(s*.3,yy+(r()-.5)*8,s*.7,yy+(r()-.5)*8,s,yy);c.stroke()}
        c.fillStyle='rgba(40,25,10,.6)';c.fillRect(0,y,s,2);c.fillRect(r()*s,y,2,s/n);c.fillStyle='rgba(30,20,10,.7)';for(const xx of[14,s-14]){c.beginPath();c.arc(xx,y+s/n/2,2.2,0,7);c.fill()}}},1); break;
    case 'crate': t=canvasTex(256,(c,s)=>{c.drawImage(tex('planks').image,0,0);c.strokeStyle='rgba(50,30,12,.85)';c.lineWidth=16;c.strokeRect(8,8,s-16,s-16);c.lineWidth=12;c.beginPath();c.moveTo(16,16);c.lineTo(s-16,s-16);c.stroke()},1); break;
    case 'plywood': t=canvasTex(256,(c,s)=>{c.fillStyle=grey(230);c.fillRect(0,0,s,s);c.strokeStyle='rgba(120,80,40,.22)';
      for(let k=0;k<26;k++){c.lineWidth=1+r()*2;c.beginPath();const cx=r()*s,cy=r()*s;c.ellipse(cx,cy,40+r()*120,6+r()*14,r()*.2,0,7);c.stroke()}
      c.fillStyle='rgba(30,20,10,.5)';for(let i=0;i<8;i++){c.beginPath();c.arc(8+(i%4)*(s-16)/3,i<4?8:s-8,2.5,0,7);c.fill()}},1); break;
    case 'cardboard': t=canvasTex(128,(c,s)=>{c.fillStyle=grey(232);c.fillRect(0,0,s,s);for(let x=0;x<s;x+=6){c.fillStyle=grey(212);c.fillRect(x,0,2,s)}
      c.fillStyle='rgba(60,40,20,.25)';c.fillRect(0,s/2-5,s,10);speckle(c,s,r,300,()=>grey(190+r()*40),1,2)},1); break;
    case 'fabric': t=canvasTex(128,(c,s)=>{c.fillStyle=grey(228);c.fillRect(0,0,s,s);for(let y=0;y<s;y+=2)for(let x=0;x<s;x+=2){c.fillStyle=grey(((x^y)&2)?206:244);c.fillRect(x,y,1,1)}},2,1); break;
    case 'plaster': t=canvasTex(256,(c,s)=>{c.fillStyle=grey(238);c.fillRect(0,0,s,s);speckle(c,s,r,2200,()=>`rgba(0,0,0,${0.03+r()*0.05})`,1,4)},2,2); break;
    case 'deskwood': t=canvasTex(256,(c,s)=>{c.fillStyle=grey(230);c.fillRect(0,0,s,s);c.strokeStyle='rgba(90,60,30,.2)';for(let k=0;k<40;k++){c.lineWidth=0.6+r()*1.4;c.beginPath();const y=r()*s;c.moveTo(0,y);c.bezierCurveTo(s*.3,y+(r()-.5)*10,s*.7,y+(r()-.5)*10,s,y);c.stroke()}},1); break;
    case 'water': t=canvasTex(256,(c,s)=>{c.fillStyle=grey(205);c.fillRect(0,0,s,s);c.strokeStyle='rgba(255,255,255,.35)';
      for(let k=0;k<70;k++){c.lineWidth=1+r()*1.6;c.beginPath();const x=r()*s,y=r()*s,w=12+r()*30;c.moveTo(x,y);c.quadraticCurveTo(x+w/2,y-4-r()*4,x+w,y);c.stroke()}},14); break;
    case 'dot': t=canvasTex(64,(c,s)=>{const g=c.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(0.35,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,s,s)},1); break;
  }
  TEX[name]=t; return t;
}
function setMap(m,name){ if(!m) return; const want=QUAL[q].textures?tex(name):null; if(m.map!==want){m.map=want;m.needsUpdate=true} if(!textured.includes(m)) textured.push(m) }

// ---------------- sky dome ----------------
function makeSky(){
  const mat=new THREE.ShaderMaterial({
    uniforms:{top:{value:new THREE.Color('#5d8fc8')},horizon:{value:new THREE.Color('#a9cfc9')},sunCol:{value:new THREE.Color('#fff3d6')},sunDir:{value:new THREE.Vector3(0.5,0.75,0.3)},time:{value:0},cloud:{value:1},boost:{value:1}},
    vertexShader:'varying vec3 vDir; void main(){ vDir=normalize(position); vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position=p.xyww; }',
    fragmentShader:`uniform vec3 top,horizon,sunCol,sunDir; uniform float time,cloud,boost; varying vec3 vDir;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);}
      float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<5;i++){v+=a*noise(p);p*=2.03;a*=0.5;}return v;}
      void main(){ vec3 d=normalize(vDir); float h=max(d.y,0.0);
        vec3 col=mix(horizon,top,pow(h,0.55));
        float s=max(dot(d,normalize(sunDir)),0.0);
        col+=sunCol*(pow(s,700.0)*2.6*boost+pow(s,14.0)*0.22);
        if(d.y>0.0&&cloud>0.0){ vec2 uv=d.xz/(d.y+0.18)*1.4+vec2(time*0.012,time*0.005);
          float c=smoothstep(0.48,0.78,fbm(uv)); vec3 cc=mix(horizon*1.05,vec3(1.0),0.55)*(0.82+0.35*s);
          col=mix(col,cc,c*cloud*smoothstep(0.0,0.22,d.y)*0.85); }
        if(d.y<0.0) col=horizon;
        gl_FragColor=vec4(col,1.0); }`,
    side:THREE.BackSide, depthWrite:false, fog:false
  });
  const m=new THREE.Mesh(new THREE.SphereGeometry(150,32,16),mat); m.renderOrder=-10; m.frustumCulled=false; m.geometry.userData.keep=true; return m;
}

// ---------------- ambient particles ----------------
const PMODES={
  ravine:{col:'#fff0a0',size:0.13,add:true,  op:0.9, rise:0.05, drift:0.25,boost:2.4},
  city:  {col:'#bdb8b0',size:0.09,add:false, op:0.6, rise:-0.35,drift:0.4, boost:1},
  office:{col:'#ffffff',size:0.05,add:false, op:0.35,rise:0.01, drift:0.08,boost:1},
  boss:  {col:'#ff7a3a',size:0.12,add:true,  op:0.95,rise:0.6,  drift:0.3, boost:3}
};
let pMode='';
function makeParticles(){
  const N=700, pos=new Float32Array(N*3), ph=new Float32Array(N);
  for(let i=0;i<N;i++){pos[i*3]=(Math.random()-.5)*40;pos[i*3+1]=Math.random()*12;pos[i*3+2]=(Math.random()-.5)*40;ph[i]=Math.random()*6.283}
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.userData.keep=true;
  const m=new THREE.PointsMaterial({map:tex('dot'),size:0.1,transparent:true,depthWrite:false,sizeAttenuation:true,color:'#ffffff'});
  const p=new THREE.Points(g,m); p.frustumCulled=false; p.userData.ph=ph; return p;
}
function setParticleMode(k){
  if(!parts||k===pMode) return; pMode=k; const M=PMODES[k]; const m=parts.material;
  m.size=M.size; m.opacity=M.op; m.blending=M.add?THREE.AdditiveBlending:THREE.NormalBlending; m.color.set(M.col);
  if(bloomOn()) m.color.multiplyScalar(M.boost); m.needsUpdate=true;
}
function updateParticles(dt){
  if(!parts) return; const n=QUAL[q].particles; parts.visible=n>0; if(!n) return;
  parts.geometry.setDrawRange(0,n);
  const M=PMODES[pMode]||PMODES.ravine, a=parts.geometry.attributes.position.array, ph=parts.userData.ph, cx=C.position.x, cy=C.position.y, cz=C.position.z;
  const top=level==='office'?5.6:12;
  for(let i=0;i<n;i++){const j=i*3;
    a[j]+=Math.sin(time*0.7+ph[i])*M.drift*dt; a[j+2]+=Math.cos(time*0.6+ph[i]*1.3)*M.drift*dt; a[j+1]+=M.rise*dt+Math.sin(time*1.3+ph[i])*0.08*dt;
    let dx=a[j]-cx, dz=a[j+2]-cz; if(dx>20)a[j]-=40; else if(dx<-20)a[j]+=40; if(dz>20)a[j+2]-=40; else if(dz<-20)a[j+2]+=40;
    if(a[j+1]>top) a[j+1]=0.1; else if(a[j+1]<0.05) a[j+1]=top;
  }
  parts.geometry.attributes.position.needsUpdate=true;
}

// ---------------- post-processing ----------------
const GradeShader={
  uniforms:{tDiffuse:{value:null},sat:{value:1.1},contrast:{value:1.05},vig:{value:0.35},exposure:{value:1},tint:{value:new THREE.Color(1,1,1)}},
  vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader:`uniform sampler2D tDiffuse; uniform float sat,contrast,vig,exposure; uniform vec3 tint; varying vec2 vUv;
    void main(){ vec3 c=texture2D(tDiffuse,vUv).rgb*exposure;
      vec3 hi=0.8+0.2*(1.0-exp(-max(c-0.8,0.0)/0.2)); c=mix(c,hi,step(0.8,c));
      float l=dot(c,vec3(0.299,0.587,0.114)); c=mix(vec3(l),c,sat); c=(c-0.5)*contrast+0.5; c*=tint;
      vec2 d=vUv-0.5; c*=1.0-vig*dot(d,d)*1.6;
      gl_FragColor=vec4(clamp(c,0.0,1.0),1.0); }`
};
const GRADE={ravine:{sat:1.14,contrast:1.06,tint:[1.03,1.0,0.95],vig:0.32},city:{sat:0.86,contrast:1.1,tint:[0.97,0.99,1.04],vig:0.42},office:{sat:0.96,contrast:1.05,tint:[1.0,1.0,1.02],vig:0.3},boss:{sat:0.78,contrast:1.12,tint:[1.07,0.9,0.95],vig:0.6}};
function disposePost(){
  if(!composer) return;
  composer.renderTarget1.dispose(); composer.renderTarget2.dispose();
  composer.passes.forEach(p=>{if(p.dispose)p.dispose()}); composer=null; bloomPass=gradePass=fxaaPass=null;
}
function buildPost(){
  disposePost(); const Q=QUAL[q]; if(!Q.post||!hasPost()) return;
  const pr=R.getPixelRatio(), hdr=R.capabilities.isWebGL2;
  const rt=new THREE.WebGLRenderTarget(Math.max(1,W*pr),Math.max(1,H*pr),{type:hdr?THREE.HalfFloatType:THREE.UnsignedByteType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat});
  composer=new THREE.EffectComposer(R,rt);
  composer.addPass(new THREE.RenderPass(S,C));
  if(Q.bloom&&THREE.UnrealBloomPass&&hdr){bloomPass=new THREE.UnrealBloomPass(new THREE.Vector2(W,H),0.6,0.5,1.0);composer.addPass(bloomPass)}
  gradePass=new THREE.ShaderPass(GradeShader); composer.addPass(gradePass);
  if(Q.fxaa&&THREE.FXAAShader){fxaaPass=new THREE.ShaderPass(THREE.FXAAShader);composer.addPass(fxaaPass)}
  resize(W,H);
}

// ---------------- glow (HDR emissive that blooms) ----------------
function applyGlow(m){
  const k=bloomOn()?m.userData.gfxBoost:1;
  if(m.isMeshLambertMaterial||m.isMeshStandardMaterial){ m.emissiveIntensity=m.userData.gfxEm*k }
  else if(m.color&&m.userData.gfxCol){ m.color.copy(m.userData.gfxCol).multiplyScalar(k) }
}
function glow(m,boost){
  if(!m||m.userData.gfxBoost) return m;
  m.userData.gfxBoost=boost||2; m.userData.gfxCol=m.color?m.color.clone():null; m.userData.gfxEm=m.emissiveIntensity!=null?m.emissiveIntensity:1;
  glowList.push(m); applyGlow(m); return m;
}

// ---------------- shadows ----------------
function applyShadow(){
  const Q=QUAL[q], cam=SUN.shadow.camera, b=Q.follow?32:60;
  if(SUN.shadow.mapSize.x!==Q.shadow){SUN.shadow.mapSize.set(Q.shadow,Q.shadow); if(SUN.shadow.map){SUN.shadow.map.dispose();SUN.shadow.map=null}}
  Object.assign(cam,{left:-b,right:b,top:b,bottom:-b,near:1,far:Q.follow?110:120}); cam.updateProjectionMatrix(); SUN.shadow.bias=-0.0006; SUN.shadow.normalBias=0.02;
  if(!Q.follow){SUN.position.set(25,40,15);SUN.target.position.set(0,0,0);SUN.target.updateMatrixWorld()}
}
function followSun(){
  if(!QUAL[q].follow) return; const snap=v=>Math.round(v/0.5)*0.5, x=snap(C.position.x), z=snap(C.position.z);
  SUN.position.set(x+25,40,z+15); SUN.target.position.set(x,0,z); SUN.target.updateMatrixWorld();
}

// ---------------- public API used by game.js ----------------
function init(o){
  R=o.renderer; S=o.scene; C=o.camera; SUN=o.sun; HEMI=o.hemi;
  const v=new THREE.Vector2(); R.getSize(v); W=v.x||W; H=v.y||H;
  if(!SUN.target.parent) S.add(SUN.target);
  sky=makeSky(); S.add(sky); parts=makeParticles(); S.add(parts);
  setQuality(q,true);
}
function setQuality(nq,first){
  if(!QUAL[nq]) return; q=nq; try{localStorage.setItem(Q_KEY,q)}catch(e){}
  R.setPixelRatio(Math.min(window.devicePixelRatio||1,QUAL[q].pr)*scale); R.setSize(W,H,false);
  buildPost(); applyShadow(); glowList.forEach(applyGlow); textured.forEach(m=>{const n=m.userData.gfxTex;if(n)setMap(m,n)});
  const k=pMode; pMode=''; setParticleMode(k||'ravine');
  if(!first&&mats) applyLevel();
}
function resize(w,h){
  W=w; H=h; if(!composer) return; composer.setSize(w,h);
  if(bloomPass) bloomPass.setSize(w*R.getPixelRatio(),h*R.getPixelRatio());
  if(fxaaPass){const pr=R.getPixelRatio();fxaaPass.material.uniforms.resolution.value.set(1/(w*pr),1/(h*pr))}
}
function tag(m,name){ if(!m) return; m.userData.gfxTex=name; setMap(m,name) }
function applyLevel(){
  const {WM,OM,dmat}=mats;
  tag(WM.ground,level==='city'?'asphalt':'grass');
  tag(WM.trunk,'bark'); tag(WM.log,'logbark'); tag(WM.plank,'planks'); tag(WM.plank2,'planks'); tag(WM.water,'water');
  if(OM){tag(OM.carpet,'carpet'); tag(OM.wall,'plaster'); tag(OM.desk,'deskwood'); tag(OM.table,'deskwood'); glow(OM.screen,1.7); glow(OM.vendFront,1.6); glow(OM.led,3); glow(OM.ledR,3)}
  if(dmat){tag(dmat('crate'),'crate'); tag(dmat('plywood'),'plywood'); tag(dmat('cardboard'),'cardboard'); tag(dmat('partition'),'fabric'); tag(dmat('drywall'),'plaster'); tag(dmat('stall'),'fabric')}
  if(WM.bulb) glow(WM.bulb,2.5);
  sky.visible=level!=='office';
}
function setLevel(kind,m){ level=kind; mats=m; applyLevel(); setParticleMode(kind) }
function env(k){
  bossK=k;
  const bg=S.background, fog=S.fog?S.fog.color:bg, U=sky.material.uniforms;
  U.horizon.value.copy(fog); U.top.value.copy(bg).lerp(new THREE.Color(level==='city'?'#6f7c8a':'#4f86c6'),0.55*(1-k)).multiplyScalar(0.92);
  U.sunCol.value.copy(SUN.color).multiplyScalar(1-0.6*k); U.cloud.value=QUAL[q].clouds*(1-0.5*k); U.boost.value=bloomOn()?1:0.4;
  U.sunDir.value.copy(SUN.position).sub(SUN.target.position).normalize();
  if(gradePass){const A=GRADE[level]||GRADE.ravine,B=GRADE.boss,u=gradePass.uniforms;
    u.sat.value=A.sat+(B.sat-A.sat)*k; u.contrast.value=A.contrast+(B.contrast-A.contrast)*k; u.vig.value=A.vig+(B.vig-A.vig)*k;
    u.tint.value.setRGB(A.tint[0]+(B.tint[0]-A.tint[0])*k,A.tint[1]+(B.tint[1]-A.tint[1])*k,A.tint[2]+(B.tint[2]-A.tint[2])*k)}
  setParticleMode(k>0.5?'boss':level);
}
function frame(dt){
  time+=dt; sky.position.copy(C.position); sky.material.uniforms.time.value=time;
  if(WM_WATER()) WM_WATER().offset.set(time*0.02,time*0.013);
  followSun(); updateParticles(dt);
  if(composer) composer.render(dt); else R.render(S,C);
}
const WM_WATER=()=>mats&&mats.WM.water&&mats.WM.water.map;
function setScale(s){scale=Math.max(0.5,Math.min(1,+s||1)); setQuality(q)}
window.GFX={init,setQuality,setScale,resize,setLevel,env,frame,glow,
  quality:()=>q, label:()=>QUAL[q].label, levels:Object.keys(QUAL), labelOf:k=>QUAL[k].label,
  b:x=>bloomOn()?x:1, tex};
})();
