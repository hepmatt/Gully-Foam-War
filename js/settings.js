/* Gully Foam War: player settings (defaults, saving, key names). Loaded before game.js. */
(function(){
'use strict';
const STORE='gullySettings';
const DEF={
  fullscreen:false, scale:1, fov:72, showFps:false, fpsCap:0,
  vol:0.8, sfx:1, amb:1,
  sens:1, padSens:1, invertY:false,
  shake:1, cross:'#ffffff',
  keys:{fwd:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD',jump:'Space',sprint:'ShiftLeft',crouch:'KeyC',reload:'KeyR',
        fire:'KeyF',scope:'KeyQ',wpn1:'Digit1',wpn2:'Digit2',swap:'KeyX',call:'KeyG',nuke:'KeyN',twin:'KeyT',mute:'KeyM',pause:'KeyP'}
};
const ACTIONS=[['fwd','Move forward'],['back','Move back'],['left','Move left'],['right','Move right'],['jump','Jump'],['sprint','Sprint'],
  ['crouch','Crouch / slide'],['reload','Reload'],['fire','Fire (keyboard)'],['scope','Scope'],['wpn1','Blaster'],['wpn2','Boomtube'],['swap','Swap weapon'],
  ['call','Call big brother'],['nuke','Foam nuke'],['twin','Twin barrel on/off'],['mute','Mute'],['pause','Pause']];
const clone=o=>JSON.parse(JSON.stringify(o));
function load(){
  let s={}; try{s=JSON.parse(localStorage.getItem(STORE)||'{}')||{}}catch(e){}
  const out=Object.assign(clone(DEF),s); out.keys=Object.assign(clone(DEF.keys),s.keys||{});
  return out;
}
function save(s){try{localStorage.setItem(STORE,JSON.stringify(s))}catch(e){}}
const NAMES={Space:'Space',ShiftLeft:'Left Shift',ShiftRight:'Right Shift',ControlLeft:'Left Ctrl',ControlRight:'Right Ctrl',AltLeft:'Left Alt',AltRight:'Right Alt',
  Tab:'Tab',CapsLock:'Caps Lock',Enter:'Enter',Backspace:'Backspace',Backquote:'`',Minus:'-',Equal:'=',BracketLeft:'[',BracketRight:']',Semicolon:';',Quote:"'",
  Comma:',',Period:'.',Slash:'/',Backslash:'\\',ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→'};
function keyLabel(code){
  if(!code) return 'Unbound';
  if(NAMES[code]) return NAMES[code];
  if(code.startsWith('Key')) return code.slice(3);
  if(code.startsWith('Digit')) return code.slice(5);
  if(code.startsWith('Numpad')) return 'Num '+code.slice(6);
  return code;
}
window.GullySettings={DEF:clone(DEF),ACTIONS,load,save,keyLabel,defaults:()=>clone(DEF)};
})();
