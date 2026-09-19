// Deterministic, DOM-independent arcade simulation. All timers use simulation time.
export const WIDTH = 224, HEIGHT = 288, PLAYER_Y = 254;
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const TAU = Math.PI * 2;
export const isChallenge = stage => stage >= 3 && (stage - 3) % 4 === 0;

// Five eight-ship squadrons. Slots are assigned in advance, not randomized.
// 4 Boss Galagas, 16 red butterflies, 20 blue/yellow bees.
export function makeWave(stage = 1) {
  const slots = { boss: [], butterfly: [], bee: [] };
  for (let col = 3; col < 7; col++) slots.boss.push({ col, row: 0 });
  for (let row = 1; row <= 2; row++)
    for (let col = 1; col < 9; col++) slots.butterfly.push({ col, row });
  for (let row = 3; row <= 4; row++)
    for (let col = 0; col < 10; col++) slots.bee.push({ col, row });
  // Fill the middle of each row first, then expand symmetrically.
  for (const list of Object.values(slots)) list.sort((a, b) =>
    Math.abs(a.col - 4.5) - Math.abs(b.col - 4.5) || a.row - b.row || a.col - b.col);
  const groups = [
    ['bee', 'bee', 'bee', 'bee', 'butterfly', 'butterfly', 'butterfly', 'butterfly'],
    ['boss', 'butterfly', 'boss', 'butterfly', 'boss', 'butterfly', 'boss', 'butterfly'],
    Array(8).fill('bee'), Array(8).fill('butterfly'), Array(8).fill('bee')
  ];
  const pace = Math.max(0.78, 1 - (stage - 1) * 0.018);
  return groups.flatMap((types, group) => types.map((type, i) => {
    const slot = slots[type].shift();
    return { id: group * 8 + i, type, ...slot, group,
      at: (group * 3.25 + i * 0.17) * pace,
      side: ((group + Math.floor((stage - 1) / 2)) % 2 ? 1 : -1),
      pathKind: (group + stage - 1) % 3,
      duration: 3.55 * pace,
      homeX: 22 + slot.col * 20, homeY: 61 + slot.row * 17,
      x: -30, y: -30, angle: 0, hp: type === 'boss' && !isChallenge(stage) ? 2 : 1,
      mode: 'wait', clock: 0, captive: false, escortKills: 0, dead: false };
  }));
}

function bezier(p, t) {
  const u = 1 - t;
  return { x: u*u*u*p[0].x + 3*u*u*t*p[1].x + 3*u*t*t*p[2].x + t*t*t*p[3].x,
    y: u*u*u*p[0].y + 3*u*u*t*p[1].y + 3*u*t*t*p[2].y + t*t*t*p[3].y };
}
const pt = (x, y) => ({ x, y });
function route(segments, p) {
  const s = clamp(p, 0, 0.999999) * segments.length;
  return bezier(segments[Math.floor(s)], s % 1);
}
function pose(e, point, next) {
  e.x = point.x; e.y = point.y;
  if (next) e.angle = Math.atan2(next.x - point.x, -(next.y - point.y));
}
export function entryPoint(e, progress, challenge = false) {
  const mirror = p => pt(e.side < 0 ? p.x : WIDTH - p.x, p.y);
  let segments;
  if (e.pathKind === 0) segments = [
    [pt(104,-18),pt(100,48),pt(6,73),pt(38,149)],
    [pt(38,149),pt(73,220),pt(140,130),pt(69,110)],
    [pt(69,110),pt(11,75),pt(40,54),pt(74,59)]
  ];
  else if (e.pathKind === 1) segments = [
    [pt(-18,170),pt(72,178),pt(154,96),pt(110,70)],
    [pt(110,70),pt(33,8),pt(16,122),pt(77,133)],
    [pt(77,133),pt(137,145),pt(145,77),pt(100,55)]
  ];
  else segments = [
    [pt(25,-18),pt(16,96),pt(162,73),pt(164,151)],
    [pt(164,151),pt(162,224),pt(49,199),pt(49,129)],
    [pt(49,129),pt(49,84),pt(110,79),pt(130,57)]
  ];
  segments = segments.map(seg => seg.map(mirror));
  const last = segments[2][3];
  const end = challenge ? pt(e.side < 0 ? 245 : -21, 22) : pt(e.homeX, e.homeY);
  segments.push([last, pt(last.x, 23), pt(end.x, challenge ? -10 : 35), end]);
  return route(segments, progress);
}

export class Game {
  constructor({ sound = () => {}, seed = 1981 } = {}) {
    this.sound = sound; this.seed = seed >>> 0; this.mode = 'title'; this.time = 0;
    this.paused = false; this.score = 0; this.stage = 1; this.practice = false;
    this.player = { x: 112, y: PLAYER_Y, active: false, dual: false, reserves: 2, inv: 0, cool: 0 };
    this.enemies = []; this.shots = []; this.bullets = []; this.effects = []; this.labels = [];
    this.volley = 0; this.totalShots = 0; this.totalHits = 0;
  }
  random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  start(practice = false) {
    this.practice = practice; this.score = 0; this.stage = 1; this.time = 0;
    this.paused = false; this.extraAt = 20000; this.totalShots = 0; this.totalHits = 0;
    this.player = { x: 112, y: PLAYER_Y, active: true, dual: false, reserves: 2, inv: 0, cool: 0 };
    this.effects = []; this.labels = []; this.carryOver = false; this.capture = null; this.rescue = null;
    this.beginStage(); this.sound('start');
  }
  beginStage() {
    this.challenge = !this.practice && isChallenge(this.stage);
    this.enemies = makeWave(this.stage);
    if (this.practice) {
      this.enemies = this.enemies.filter(e => e.type === 'boss').slice(0, 1);
      Object.assign(this.enemies[0], { homeX: 112, x: 112, y: 61, mode: 'formation', clock: 0 });
    }
    if (this.carryOver && !this.challenge) {
      this.enemies.find(e => e.type === 'boss').captive = true;
      this.carryOver = false;
    }
    this.shots = []; this.bullets = []; this.capture = null; this.rescue = null;
    this.stageClock = 0; this.kills = 0; this.nextAttack = 1.2;
    this.nextBeam = this.practice ? 0.7 : 1.8;
    this.mode = 'ready'; this.timer = this.challenge ? 2.5 : 2;
    this.player.x = clamp(this.player.x, this.player.dual ? 20 : 10, this.player.dual ? 204 : 214);
    this.player.inv = 1.3; this.player.cool = 0;
    if (this.challenge) this.sound('challenge');
    else if (this.stage > 1) this.sound('stage');
  }
  pause(value = !this.paused) {
    if (!['title', 'over'].includes(this.mode)) this.paused = value;
  }
  addScore(points) {
    this.score += points;
    while (this.score >= this.extraAt) {
      this.player.reserves++; this.sound('extra');
      this.extraAt = this.extraAt === 20000 ? 70000 : this.extraAt + 70000;
    }
  }
  formation(e) {
    const breath = 1 + Math.sin(this.stageClock * 1.3) * 0.055;
    return pt(112 + (e.homeX - 112) * breath + Math.sin(this.stageClock * 0.7) * 5,
      e.homeY + Math.sin(this.stageClock * 1.3) * 2);
  }
  fire() {
    const p = this.player;
    if (this.mode !== 'play' || this.paused || !p.active || p.cool > 0) return false;
    if (new Set(this.shots.filter(s => !s.dead).map(s => s.volley)).size >= 2) return false;
    const volley = ++this.volley;
    for (const offset of p.dual ? [-8, 8] : [0]) {
      this.shots.push({ x: p.x + offset, y: p.y - 10, oldY: p.y - 10, volley, dead: false });
      this.totalShots++;
    }
    p.cool = 0.12; this.sound('shot'); return true;
  }
  explode(x, y, large = false) {
    this.effects.push({ x, y, age: 0, duration: large ? 0.65 : 0.4, large });
  }
  hitPlayer(side = 0) {
    const p = this.player;
    if (!p.active || p.inv > 0 || this.mode !== 'play' || this.challenge) return;
    this.explode(p.x + (p.dual ? (side < 0 ? -8 : 8) : 0), p.y, true);
    this.sound('death'); this.bullets = [];
    if (p.dual) {
      p.x += side < 0 ? 8 : -8; p.dual = false; p.inv = 2;
      return;
    }
    p.active = false; this.shots = []; this.mode = 'respawn'; this.timer = 2;
  }
  spawnPlayer() {
    const p = this.player;
    if (p.reserves <= 0) { this.mode = 'over'; this.timer = 1; this.sound('over'); return; }
    p.reserves--; p.active = true; p.dual = false; p.x = 112; p.inv = 2.5; p.cool = 0;
    this.bullets = []; this.shots = []; this.mode = 'play'; this.nextAttack = 2;
    this.labels.push({ text: 'READY', x: 112, y: 208, life: 1.1, color: 'cyan' });
  }
  returnEnemy(e) {
    e.mode = 'return'; e.clock = 0; e.from = pt(e.x, e.y); e.durationReturn = e.y < 0 ? 1 : 1.5;
  }
  launchDive(e, escorts = []) {
    const target = clamp(this.player.x, 32, 192), sign = e.homeX < 112 ? -1 : 1;
    const duration = Math.max(2.4, 4.1 - this.stage * 0.09);
    const make = (unit, offset) => {
      unit.mode = 'dive'; unit.clock = 0; unit.diveDuration = duration;
      unit.path = [
        [pt(unit.x,unit.y),pt(unit.x-sign*36,unit.y-38),pt(unit.x-sign*46,145),pt(unit.x,150)],
        [pt(unit.x,150),pt(unit.x+sign*52,173),pt(target+offset,205),pt(target+offset,245)],
        [pt(target+offset,245),pt(target+offset,275),pt(target-sign*60+offset,300),pt(target-sign*60+offset,320)]
      ];
      unit.shotTimes = new Set();
    };
    e.escortKills = 0; make(e, 0);
    escorts.forEach((escort, i) => { make(escort, i ? 17 : -17); escort.leader = e.id; });
    this.sound('dive');
  }
  launchBeam(e) {
    e.mode = 'beamApproach'; e.clock = 0; e.from = pt(e.x, e.y);
    e.beamX = clamp(this.player.x, 38, 186); e.lock = 0; this.sound('dive');
  }
  beginCapture(e) {
    if (this.mode !== 'play' || this.player.dual || !this.player.active) return;
    this.capture = { id: e.id, from: pt(this.player.x, this.player.y), x: this.player.x,
      y: this.player.y, clock: 0 };
    this.player.active = false; this.shots = []; this.bullets = [];
    this.mode = 'capture'; this.sound('captured');
  }
  captivePosition(e) {
    if (e.mode === 'dive') return pt(e.x - Math.sin(e.angle)*18, e.y + Math.cos(e.angle)*18);
    return pt(e.x, e.y - 18);
  }
  beginRescue(pos) {
    this.rescue = { from: pos, x: pos.x, y: pos.y, clock: 0, startX: this.player.x };
    this.shots = []; this.bullets = []; this.mode = 'rescue'; this.sound('rescue');
  }
  killEnemy(e, shot = true) {
    if (e.dead) return;
    const flying = e.mode !== 'formation', pos = this.captivePosition(e);
    e.dead = true; this.kills++; this.explode(e.x, e.y);
    if (e.leader !== undefined && shot) {
      const leader = this.enemies.find(unit => unit.id === e.leader && !unit.dead);
      if (leader) leader.escortKills++;
    }
    if (shot) {
      const points = e.type === 'boss' ? (flying ? 400 * 2 ** Math.min(2, e.escortKills) : 150)
        : e.type === 'butterfly' ? (flying ? 160 : 80) : (flying ? 100 : 50);
      this.addScore(points); this.sound(e.type === 'boss' ? 'boss' : 'enemy');
      if (e.type === 'boss' && flying) this.labels.push({ text: String(points), x: e.x, y: e.y, life: 0.9, color: 'cyan' });
    }
    if (e.captive) {
      e.captive = false;
      // Only a diving carrier yields a dual fighter. A formation kill releases a hostile fighter.
      if (shot && e.mode === 'dive' && this.player.active) this.beginRescue(pos);
      else if (shot) {
        this.enemies.push({ id: 1000 + e.id, type: 'fighter', hp: 1, x: pos.x, y: pos.y,
          from: pos, mode: 'rogue', clock: 0, angle: Math.PI, dead: false, captive: false });
      } else this.explode(pos.x, pos.y);
    }
  }
  damageEnemy(e) {
    if (e.dead) return;
    this.totalHits++; e.hp--;
    if (e.hp <= 0) this.killEnemy(e);
    else { this.sound('armor'); e.flash = 0.1; }
  }
  shootEnemy(e) {
    if (this.challenge || this.practice || !this.player.active || this.mode !== 'play' || e.y > 214) return;
    const max = Math.min(9, 3 + Math.floor(this.stage / 2));
    if (this.bullets.length >= max) return;
    const dx = this.player.x - e.x, dy = this.player.y - e.y;
    const length = Math.hypot(dx, dy), speed = Math.min(138, 76 + this.stage * 3);
    this.bullets.push({ x: e.x, y: e.y + 6, vx: dx / length * speed * 0.65,
      vy: Math.max(55, dy / length * speed), dead: false });
  }
  updateEnemy(e, dt) {
    if (e.dead) return;
    e.clock += dt; e.flash = Math.max(0, (e.flash || 0) - dt);
    if (e.mode === 'wait') {
      if (this.stageClock < e.at) return;
      e.mode = 'entry'; e.clock = this.stageClock - e.at;
      if (e.id % 8 === 0) this.sound('entry');
    }
    if (e.mode === 'entry') {
      const p = e.clock / e.duration;
      pose(e, entryPoint(e, p, this.challenge), entryPoint(e, p + 0.002, this.challenge));
      if (this.stage > 1 && p > 0.57 && !e.entryShot) { e.entryShot = true; if (e.id % 6 === 0) this.shootEnemy(e); }
      if (p >= 1) {
        if (this.challenge) e.dead = true;
        else { e.mode = 'formation'; e.clock = 0; e.angle = 0; }
      }
    } else if (e.mode === 'formation') {
      pose(e, this.formation(e)); e.angle = 0;
    } else if (e.mode === 'dive') {
      const p = e.clock / e.diveDuration;
      pose(e, route(e.path, p), route(e.path, p + 0.001));
      for (const threshold of [0.28, 0.52]) if (p >= threshold && !e.shotTimes.has(threshold)) {
        e.shotTimes.add(threshold); this.shootEnemy(e);
      }
      if (p >= 1) { e.y = -20; e.x = clamp(e.x, 16, 208); this.returnEnemy(e); }
    } else if (e.mode === 'return') {
      const p = clamp(e.clock / e.durationReturn, 0, 1), home = this.formation(e);
      const path = [e.from, pt(e.from.x, e.from.y - 65), pt(home.x, home.y - 32), home];
      pose(e, bezier(path, smooth(p)), bezier(path, smooth(Math.min(1, p + 0.001))));
      if (p >= 1) { e.mode = 'formation'; e.clock = 0; e.angle = 0; }
    } else if (e.mode === 'beamApproach') {
      const p = clamp(e.clock / 1.9, 0, 1);
      const path = [e.from, pt(e.from.x - 40, 115), pt(e.beamX + 40, 135), pt(e.beamX, 164)];
      pose(e, bezier(path, p), bezier(path, Math.min(1, p + 0.001)));
      if (p >= 1) { e.mode = 'beam'; e.clock = 0; e.angle = Math.PI; this.sound('beam'); }
    } else if (e.mode === 'beam') {
      e.angle = Math.PI;
      if (e.clock > 0.9 && e.clock < 4.4 && this.player.active && this.player.inv <= 0 && !this.player.dual) {
        e.lock = Math.abs(this.player.x - e.x) < 19 ? e.lock + dt : 0;
        if (e.lock >= 0.16) this.beginCapture(e);
      }
      if (e.clock >= 4.8) { this.returnEnemy(e); this.nextBeam = 7; }
    } else if (e.mode === 'rogue') {
      const p = e.clock / 3.6;
      const path = [e.from, pt(220,180),pt(-20,255),pt(112,-24)];
      pose(e, bezier(path, clamp(p, 0, 1)), bezier(path, clamp(p + 0.001, 0, 1)));
      if (p >= 1) { e.dead = true; this.carryOver = true; }
    }
  }
  updateAttacks(dt) {
    if (this.challenge || !this.player.active || this.enemies.some(e => !e.dead && ['wait','entry'].includes(e.mode))) return;
    this.nextBeam -= dt; this.nextAttack -= dt;
    const fleet = this.enemies.filter(e => !e.dead && e.mode === 'formation');
    const busy = this.enemies.some(e => !e.dead && ['beam','beamApproach'].includes(e.mode));
    const captive = this.enemies.find(e => !e.dead && e.captive);
    if (!busy && !captive && !this.player.dual && this.nextBeam <= 0) {
      const boss = fleet.find(e => e.type === 'boss');
      if (boss) { this.launchBeam(boss); this.nextBeam = 12; this.nextAttack = 3; return; }
    }
    if (this.nextAttack > 0 || busy) return;
    const diving = this.enemies.filter(e => !e.dead && e.mode === 'dive').length;
    if (diving >= Math.min(7, 2 + this.stage)) return;
    const readyCarrier = captive && captive.mode === 'formation' && captive.clock > 2;
    const pool = fleet.filter(e => !e.captive);
    const e = readyCarrier ? captive : pool[Math.floor(this.random() * pool.length)];
    if (e && !(this.practice && !e.captive)) {
      const escorts = e.type === 'boss' && !e.captive ? fleet.filter(u => u.type === 'butterfly')
        .sort((a,b) => Math.abs(a.x-e.x)-Math.abs(b.x-e.x)).slice(0,2) : [];
      this.launchDive(e, escorts);
    }
    this.nextAttack = Math.max(0.65, 2.3 - this.stage * 0.08);
  }
  updateShots(dt) {
    for (const shot of this.shots) {
      if (this.mode !== 'play') break;
      shot.oldY = shot.y; shot.y -= 238 * dt;
      const hits = [];
      for (const e of this.enemies) {
        if (e.dead || e.mode === 'wait') continue;
        const test = (pos, radius, captive) => {
          if (Math.abs(shot.x - pos.x) <= radius && shot.y <= pos.y + radius && shot.oldY >= pos.y - radius)
            hits.push({ e, y: pos.y, captive });
        };
        test(e, e.type === 'boss' ? 6 : 5, false);
        if (e.captive) test(this.captivePosition(e), 5, true);
      }
      if (hits.length) {
        hits.sort((a,b) => b.y - a.y);
        const hit = hits[0]; shot.dead = true;
        if (hit.captive) {
          hit.e.captive = false; const pos = this.captivePosition(hit.e);
          this.explode(pos.x, pos.y, true); this.sound('death');
          this.labels.push({ text: 'FIGHTER LOST', x: 112, y: 205, life: 1.5, color: 'red' });
        } else this.damageEnemy(hit.e);
      }
    }
    this.shots = this.shots.filter(s => !s.dead && s.y > 25);
    for (const b of this.bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (this.mode !== 'play' || !this.player.active || this.challenge) continue;
      for (const offset of this.player.dual ? [-8,8] : [0]) {
        if (Math.abs(b.x-this.player.x-offset)<5 && Math.abs(b.y-this.player.y)<7) {
          b.dead = true; this.hitPlayer(offset); break;
        }
      }
    }
    this.bullets = this.bullets.filter(b => !b.dead && b.y < HEIGHT && b.x > -8 && b.x < WIDTH+8);
  }
  update(dt, input = {}) {
    if (!Number.isFinite(dt) || dt <= 0 || this.paused) return;
    dt = Math.min(dt, 1/30); this.time += dt;
    for (const effect of this.effects) effect.age += dt;
    this.effects = this.effects.filter(e => e.age < e.duration);
    for (const label of this.labels) label.life -= dt;
    this.labels = this.labels.filter(e => e.life > 0);
    if (this.mode === 'title') return;
    if (this.mode === 'over') { this.timer -= dt; return; }
    const p = this.player;
    p.cool = Math.max(0, p.cool-dt); p.inv = Math.max(0, p.inv-dt);
    if (this.mode === 'ready') {
      this.timer -= dt; if (this.timer <= 0) this.mode = 'play'; return;
    }
    if (this.mode === 'clear' || this.mode === 'results') {
      this.timer -= dt;
      if (this.timer <= 0) { if (!this.practice) this.stage++; this.beginStage(); }
      return;
    }
    if (this.mode === 'capture') {
      const c = this.capture, e = this.enemies.find(e => e.id === c.id);
      c.clock += dt;
      const progress = smooth(clamp(c.clock/2.2,0,1));
      c.x = mix(c.from.x,e.x,progress); c.y = mix(c.from.y,e.y-18,progress);
      if (c.clock >= 2.8) {
        e.captive = true; this.returnEnemy(e); this.capture = null;
        this.mode = 'respawn'; this.timer = 1.6;
      }
      return;
    }
    if (this.mode === 'rescue') {
      const r = this.rescue; r.clock += dt;
      const progress = smooth(clamp((r.clock-0.45)/1.8,0,1));
      const center = clamp(r.startX, 22, 202);
      p.x = mix(r.startX, center - 8, progress);
      r.x = mix(r.from.x, center+8, progress); r.y = mix(r.from.y,p.y,progress);
      if (r.clock >= 2.7) {
        p.x = center; p.dual = true; p.inv = 2; p.cool = 0;
        this.rescue = null; this.mode = 'play'; this.nextAttack = 2;
      }
      return;
    }
    this.stageClock += dt;
    if (this.mode === 'respawn') {
      for (const e of this.enemies) this.updateEnemy(e,dt);
      this.timer -= dt; if (this.timer <= 0) this.spawnPlayer(); return;
    }
    const edge = p.dual ? 20 : 10;
    if (p.active) {
      if (Number.isFinite(input.targetX)) p.x += clamp(input.targetX-p.x,-105*dt,105*dt);
      else p.x += ((input.right?1:0)-(input.left?1:0))*105*dt;
      p.x = clamp(p.x,edge,WIDTH-edge);
      if (input.fire) this.fire();
    }
    for (const e of this.enemies) {
      this.updateEnemy(e,dt);
      if (this.mode !== 'play') break;
      if (!this.challenge && !e.dead && e.mode !== 'wait' && p.active && p.inv <= 0) {
        for (const offset of p.dual ? [-8,8] : [0])
          if (Math.abs(e.x-p.x-offset)<10 && Math.abs(e.y-p.y)<10) {
            this.hitPlayer(offset); this.killEnemy(e,false); break;
          }
      }
    }
    if (this.mode !== 'play') return;
    this.updateShots(dt);
    if (this.mode !== 'play') return;
    this.updateAttacks(dt);
    if (this.enemies.every(e => e.dead)) {
      this.shots = []; this.bullets = [];
      this.mode = this.challenge ? 'results' : 'clear'; this.timer = this.challenge ? 4.5 : 1.5;
      if (this.challenge) {
        this.bonus = this.kills === 40 ? 10000 : this.kills*100;
        this.addScore(this.bonus); this.sound(this.kills === 40 ? 'perfect' : 'bonus');
      } else this.sound('stage');
    }
  }
  snapshot() {
    return { mode: this.mode, paused: this.paused, stage: this.stage, score: this.score,
      practice: this.practice, challenge: this.challenge, player: { ...this.player },
      shots: this.shots.length, bullets: this.bullets.length,
      enemies: this.enemies.filter(e => !e.dead).map(e => ({ id:e.id,type:e.type,mode:e.mode,hp:e.hp,
        x:e.x,y:e.y,captive:e.captive })), capture: !!this.capture, rescue: !!this.rescue };
  }
}
