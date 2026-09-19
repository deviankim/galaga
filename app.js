import { Game, WIDTH, HEIGHT } from './game.js';
import { Renderer } from './render.js';
import { ArcadeAudio } from './audio.js';
const $=id=>document.getElementById(id), canvas=$('game');
const read=(key,fallback)=>{try{return localStorage.getItem(key)??fallback;}catch{return fallback;}};
const store=(key,value)=>{try{localStorage.setItem(key,String(value));}catch{/* Private browsing can disable storage. */}};
let hi=Math.max(20000,Number(read('galagaHi','20000'))||20000);
const audio=new ArcadeAudio();audio.setMuted(read('galagaMuted','0')==='1');
const game=new Game({sound:name=>audio.play(name),seed:Date.now()});
const renderer=new Renderer(canvas);
const keys=new Set(),touch={left:new Set(),right:new Set(),fire:new Set()};
let drag=null,targetX=null,previousMode='',previousPause=false,previousBeam=false;
function clearInput(){keys.clear();Object.values(touch).forEach(s=>s.clear());drag=null;targetX=null;document.querySelectorAll('.held').forEach(el=>el.classList.remove('held'));}
function input(){return {left:keys.has('ArrowLeft')||keys.has('KeyA')||touch.left.size>0,
  right:keys.has('ArrowRight')||keys.has('KeyD')||touch.right.size>0,
  fire:keys.has('Space')||keys.has('KeyZ')||touch.fire.size>0,targetX};}
function start(practice=false){audio.unlock();clearInput();game.start(practice);canvas.focus({preventScroll:true});sync();}
function pause(){audio.unlock();game.pause();clearInput();if(game.paused)audio.stop();else canvas.focus({preventScroll:true});sync();}
function sound(){audio.unlock();audio.setMuted(!audio.muted);store('galagaMuted',audio.muted?'1':'0');if(!audio.muted&&game.enemies.some(e=>!e.dead&&e.mode==='beam'))audio.play('beam');if(!['title','over'].includes(game.mode))canvas.focus({preventScroll:true});sync();}
$('start').addEventListener('click',()=>start());$('practice').addEventListener('click',()=>start(true));
$('pause').addEventListener('click',pause);$('sound').addEventListener('click',sound);
const controls=new Set(['ArrowLeft','ArrowRight','Space','KeyA','KeyD','KeyZ','KeyP','Escape','KeyM','Enter']);
addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey||!controls.has(e.code))return;
  // Preserve native keyboard activation of toolbar controls.
  if(e.target instanceof HTMLButtonElement&&['Enter','Space'].includes(e.code))return;
  e.preventDefault();audio.unlock();
  if(e.code==='KeyP'||e.code==='Escape'){if(!e.repeat)pause();return;}
  if(e.code==='KeyM'){if(!e.repeat)sound();return;}
  if(['Space','Enter','KeyZ'].includes(e.code)&&['title','over'].includes(game.mode)){
    if(!e.repeat&&(game.mode!=='over'||game.timer<=0))start();return;
  }
  keys.add(e.code);
});
addEventListener('keyup',e=>keys.delete(e.code));
for(const key of ['left','right','fire']) {
  const button=$(key);
  button.addEventListener('pointerdown',e=>{
    e.preventDefault();audio.unlock();button.setPointerCapture(e.pointerId);
    if(key==='fire'&&['title','over'].includes(game.mode)){start();return;}
    touch[key].add(e.pointerId);button.classList.add('held');
  });
  const release=e=>{touch[key].delete(e.pointerId);if(!touch[key].size)button.classList.remove('held');};
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>button.addEventListener(type,release));
  button.addEventListener('contextmenu',e=>e.preventDefault());
}
canvas.addEventListener('pointerdown',e=>{
  e.preventDefault();audio.unlock();canvas.focus({preventScroll:true});
  if(['title','over'].includes(game.mode)){start();return;}
  drag=e.pointerId;canvas.setPointerCapture(e.pointerId);
  const rect=canvas.getBoundingClientRect();targetX=(e.clientX-rect.left)/rect.width*WIDTH;
});
canvas.addEventListener('pointermove',e=>{if(e.pointerId!==drag)return;const rect=canvas.getBoundingClientRect();targetX=(e.clientX-rect.left)/rect.width*WIDTH;});
for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{if(e.pointerId===drag){drag=null;targetX=null;}});
function backgroundPause(){clearInput();game.pause(true);audio.stop();sync();}
addEventListener('blur',backgroundPause);
document.addEventListener('visibilitychange',()=>{if(document.hidden)backgroundPause();});
const messages={title:'START 또는 Space로 시작하세요.',ready:'편대가 정해진 순서로 진입합니다.',
  play:'← → 이동 · Space 발사 · P 일시정지',capture:'기체 포획! 다음 기체로 출격해 급강하하는 보스를 격추하세요.',
  respawn:'다음 기체 출격 준비 중',rescue:'구출 성공! 듀얼 파이터로 도킹합니다.',clear:'스테이지 클리어!',
  results:'챌린징 스테이지 결과',over:'게임 종료 · START 또는 Space로 다시 시작'};
function sync(){
  if(!game.practice&&game.score>hi){hi=game.score;store('galagaHi',hi);}
  const idle=['title','over'].includes(game.mode);
  $('start').disabled=!idle;$('practice').disabled=!idle;$('pause').disabled=idle;
  $('pause').textContent=game.paused?'RESUME':'PAUSE';$('pause').setAttribute('aria-label',game.paused?'게임 재개':'일시정지');
  $('sound').textContent=audio.muted?'SOUND OFF':'SOUND ON';$('sound').setAttribute('aria-pressed',String(audio.muted));
  $('sound').setAttribute('aria-label',audio.muted?'효과음 켜기':'효과음 끄기');
  const beam=game.enemies.some(e=>!e.dead&&e.mode==='beam')&&game.mode==='play'&&!game.paused;
  if(previousBeam&&!beam)audio.stop('beam');
  if(beam&&!previousBeam&&![...audio.voices].some(v=>v.tag==='beam'))audio.play('beam');
  if(game.mode!==previousMode||game.paused!==previousPause||beam!==previousBeam){
    $('status').textContent=game.paused?'일시정지 · P 또는 RESUME으로 계속':beam?'파란 빔에서 발사를 멈추면 포획됩니다.':game.practice&&game.mode==='play'?'도킹 연습 · 빔에 포획된 뒤 급강하하는 보스만 격추하세요.':messages[game.mode]||'';
    previousMode=game.mode;previousPause=game.paused;
  }
  previousBeam=beam;
}
function resize(){
  const coarse=matchMedia('(pointer:coarse), (max-width:720px)').matches;
  const viewWidth=document.documentElement.clientWidth;
  const side=viewWidth>=1000?350:coarse?24:32;
  const available=Math.min((viewWidth-side-8)/WIDTH,(innerHeight-(coarse?187:145))/HEIGHT,3);
  const scale=!coarse&&available>=2?Math.floor(available):Math.max(0.6,available);
  document.documentElement.style.setProperty('--screen-width',Math.floor(WIDTH*scale)+'px');
  document.documentElement.style.setProperty('--screen-height',Math.floor(HEIGHT*scale)+'px');
}
addEventListener('resize',resize);resize();sync();
let last=performance.now(),accumulator=0;
function frame(now){
  accumulator+=Math.min(0.1,(now-last)/1000);last=now;
  while(accumulator>=1/60){game.update(1/60,input());accumulator-=1/60;}
  sync();renderer.render(game,hi);requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// Explicit opt-in test hook; never enabled on the ordinary game URL.
if(new URLSearchParams(location.search).has('debug'))globalThis.__galaga={game,audio,renderer,
  snapshot:()=>game.snapshot(),step:(seconds,controls={})=>{for(let i=0;i<seconds*60;i++)game.update(1/60,controls);sync();renderer.render(game,hi);return game.snapshot();}};
