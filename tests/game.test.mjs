import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, makeWave, isChallenge, entryPoint } from '../game.js';
const tick=(g,seconds,input={})=>{for(let i=0;i<Math.ceil(seconds*60);i++)g.update(1/60,input);};
const until=(g,predicate,limit=20)=>{for(let i=0;i<limit*60&&!predicate();i++)g.update(1/60);assert.ok(predicate(),'state reached before timeout');};
const start=()=>{const g=new Game();g.start();tick(g,2.1);return g;};
const formation=()=>{const g=start();g.enemies.forEach(e=>{e.mode='formation';e.x=e.homeX;e.y=e.homeY;e.clock=0;});g.nextBeam=999;g.nextAttack=999;return g;};

test('five ordered groups produce 4 bosses, 16 butterflies, 20 bees with unique slots',()=>{
  const wave=makeWave(1),counts={};for(const e of wave)counts[e.type]=(counts[e.type]||0)+1;
  assert.deepEqual(counts,{bee:20,butterfly:16,boss:4});
  assert.equal(new Set(wave.map(e=>`${e.col}:${e.row}`)).size,40);
  assert.deepEqual(wave,makeWave(1));assert.deepEqual(wave.slice(0,4).map(e=>e.type),Array(4).fill('bee'));
  for(let i=1;i<wave.length;i++)assert.ok(wave[i].at>wave[i-1].at);
});
test('entry paths are finite and terminate at the assigned formation slots',()=>{
  for(let stage=1;stage<=24;stage++)for(const e of makeWave(stage)){
    for(let i=0;i<=100;i++){const p=entryPoint(e,i/100);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));}
    const p=entryPoint(e,1);assert.ok(Math.hypot(p.x-e.homeX,p.y-e.homeY)<0.01);
  }
});
test('enemy deployment is staggered, not a simultaneous spawn',()=>{
  const g=start();assert.ok(g.enemies.filter(e=>e.mode==='entry').length<4);
  tick(g,1);assert.ok(g.enemies.some(e=>e.mode==='wait'));assert.ok(g.enemies.some(e=>e.mode==='entry'));
});
test('clearing the visible first squadron does not skip unspawned squadrons',()=>{
  const g=start();g.enemies.filter(e=>e.mode==='entry').forEach(e=>g.killEnemy(e));tick(g,0.1);assert.equal(g.stage,1);assert.equal(g.mode,'play');
});
test('single fighter has two on-screen volleys; dual fires two parallel shots per volley',()=>{
  const g=start();assert.ok(g.fire());g.player.cool=0;assert.ok(g.fire());g.player.cool=0;assert.equal(g.fire(),false);assert.equal(g.shots.length,2);
  g.shots=[];g.player.dual=true;assert.ok(g.fire());g.player.cool=0;assert.ok(g.fire());g.player.cool=0;assert.equal(g.fire(),false);
  assert.equal(g.shots.length,4);assert.equal(Math.abs(g.shots[0].x-g.shots[1].x),16);
});
test('boss changes armor after first hit and dies on second, with formation/dive scoring',()=>{
  const g=formation(),boss=g.enemies.find(e=>e.type==='boss');g.damageEnemy(boss);assert.equal(boss.hp,1);assert.equal(boss.dead,false);
  g.damageEnemy(boss);assert.equal(boss.dead,true);assert.equal(g.score,150);
  const bee=g.enemies.find(e=>e.type==='bee');g.killEnemy(bee);assert.equal(g.score,200);
});
test('capture uses a spare fighter, diving carrier rescue docks two fighters',()=>{
  const g=new Game();g.start(true);tick(g,2.1);const boss=g.enemies[0];
  // Natural simulation: first tractor approach -> beam -> capture -> return -> respawn.
  until(g,()=>g.player.active&&g.player.reserves===1);assert.equal(g.player.reserves,1);assert.ok(boss.captive);assert.equal(g.player.active,true);
  until(g,()=>boss.mode==='dive');assert.equal(boss.mode,'dive');
  g.damageEnemy(boss);g.damageEnemy(boss);assert.equal(g.mode,'rescue');assert.equal(g.player.dual,false);
  tick(g,2.8);assert.equal(g.player.dual,true);assert.equal(g.player.reserves,1);assert.equal(g.rescue,null);
});
test('destroying a carrier in formation does not grant an instant dual fighter',()=>{
  const g=formation(),boss=g.enemies.find(e=>e.type==='boss');boss.captive=true;g.killEnemy(boss);
  assert.equal(g.mode,'play');assert.equal(g.player.dual,false);assert.ok(g.enemies.some(e=>e.type==='fighter'&&e.mode==='rogue'));
  tick(g,3.8);assert.equal(g.carryOver,true);
  g.stage=2;g.beginStage();assert.ok(g.enemies.some(e=>e.type==='boss'&&e.captive));assert.equal(g.carryOver,false);
});
test('shooting the captive destroys it without docking or awarding a bonus',()=>{
  const g=formation(),boss=g.enemies.find(e=>e.type==='boss');boss.captive=true;
  // Place a shot between the boss and captive, pointing upwards.
  const pos=g.captivePosition(boss);g.shots=[{x:pos.x,y:pos.y+7,oldY:pos.y+7,volley:1,dead:false}];g.updateShots(1/30);
  assert.equal(boss.captive,false);assert.equal(g.player.dual,false);assert.equal(g.score,0);assert.equal(boss.hp,2);
});
test('last available fighter captured leads to game over',()=>{
  const g=formation(),boss=g.enemies.find(e=>e.type==='boss');g.player.reserves=0;boss.mode='beam';g.beginCapture(boss);tick(g,4.6);
  assert.equal(g.mode,'over');assert.equal(g.player.active,false);
});
test('dual fighter hit loses one side without consuming a reserve',()=>{
  const g=formation();g.player.dual=true;g.player.inv=0;const before=g.player.reserves;
  g.hitPlayer(-8);assert.equal(g.player.dual,false);assert.equal(g.player.active,true);assert.equal(g.player.reserves,before);assert.equal(g.player.x,120);
});
test('three fighter losses end the game and timers cannot resurrect a new game',()=>{
  const g=formation();for(let i=0;i<3;i++){g.player.inv=0;g.hitPlayer();tick(g,2.1);}
  assert.equal(g.mode,'over');g.start();tick(g,2.1);assert.equal(g.player.reserves,2);assert.equal(g.player.active,true);
});
test('pause freezes capture, projectile, entry and respawn timers',()=>{
  const g=formation(),boss=g.enemies.find(e=>e.type==='boss');g.beginCapture(boss);tick(g,0.5);g.pause(true);
  const before=JSON.stringify({snapshot:g.snapshot(),capture:g.capture,time:g.time});tick(g,30);
  assert.equal(JSON.stringify({snapshot:g.snapshot(),capture:g.capture,time:g.time}),before);g.pause(false);tick(g,5);assert.equal(g.player.active,true);
});
test('challenge occurs at 3,7,11 and has no player damage or enemy bullets',()=>{
  assert.deepEqual(Array.from({length:12},(_,i)=>i+1).filter(isChallenge),[3,7,11]);
  const g=new Game();g.start();g.stage=3;g.beginStage();tick(g,2.6);g.player.inv=0;g.hitPlayer();assert.equal(g.player.active,true);
  tick(g,18);assert.equal(g.bullets.length,0);assert.equal(g.mode,'results');assert.equal(g.bonus,0);assert.equal(g.player.reserves,2);
});
test('perfect challenge awards 10000 once, then advances to the next stage',()=>{
  const g=new Game();g.start();g.stage=3;g.beginStage();tick(g,2.6);
  g.enemies.forEach(e=>{e.mode='entry';g.killEnemy(e);});const before=g.score;tick(g,0.1);
  assert.equal(g.mode,'results');assert.equal(g.score,before+10000);tick(g,4.6);assert.equal(g.stage,4);assert.equal(g.score,before+10000);
});
test('20k/70k/every further 70k grant one spare fighter apiece',()=>{
  const g=start();g.addScore(20000);assert.equal(g.player.reserves,3);g.addScore(50000);assert.equal(g.player.reserves,4);
  g.addScore(70000);assert.equal(g.player.reserves,5);
});
test('fixed-step simulation stays finite and bounded through extended automated play',()=>{
  const g=start();
  for(let i=0;i<60*240;i++){
    if(g.mode==='over')g.start();
    g.update(1/60,{fire:true,left:Math.floor(i/180)%2===0,right:Math.floor(i/180)%2===1});
    assert.ok(Number.isFinite(g.player.x)&&g.player.x>=10&&g.player.x<=214);
    assert.ok(g.shots.length<=4);assert.ok(g.bullets.length<=9);
    for(const e of g.enemies)assert.ok(Number.isFinite(e.x)&&Number.isFinite(e.y));
  }
});
test('ordinary movement and projectiles can complete a natural capture/rescue cycle',()=>{
  const g=new Game();g.start(true);let lastX=112,lastY=61;
  for(let i=0;i<60*25&&!g.player.dual;i++){
    const e=g.enemies[0],vx=(e.x-lastX)*60,vy=(e.y-lastY)*60;lastX=e.x;lastY=e.y;
    const traveling=e.mode==='dive'&&e.captive;
    const lead=Math.max(0,(244-e.y)/(238+Math.max(0,vy)));
    g.update(1/60,traveling?{targetX:e.x+vx*Math.min(.3,lead),fire:e.y>185&&e.y<237}:{});
  }
  assert.equal(g.player.dual,true);assert.equal(g.player.reserves,1);assert.equal(g.score,400);
  assert.equal(g.totalHits,2);assert.ok(g.totalShots>=2);
});
test('destroying both escorts before their diving boss awards 1600 for the boss',()=>{
  const g=formation(),boss=g.enemies.find(e=>e.type==='boss'),escorts=g.enemies.filter(e=>e.type==='butterfly').slice(0,2);
  g.launchDive(boss,escorts);escorts.forEach(e=>g.killEnemy(e));const before=g.score;g.killEnemy(boss);
  assert.equal(g.score-before,1600);
});
test('an already dual fighter cannot be captured for an unintended triple fighter',()=>{
  const g=formation(),boss=g.enemies.find(e=>e.type==='boss');g.player.dual=true;g.player.x=boss.x;g.player.inv=0;
  boss.mode='beam';boss.clock=1;g.beginCapture(boss);tick(g,0.5);
  assert.equal(g.mode,'play');assert.equal(g.capture,null);assert.equal(g.player.dual,true);
});
