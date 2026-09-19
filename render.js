import { WIDTH, HEIGHT, PLAYER_Y } from './game.js';

export const COLORS = { W:'#ffffff', R:'#ff2424', B:'#245bff', C:'#00dedb',
  Y:'#ffff00', O:'#ff9c00', G:'#00ae72', P:'#ba30ff', D:'#183c96',
  white:'#ffffff', red:'#ff2424', cyan:'#00dedb', yellow:'#ffff00' };
// Hand-authored pixel sprites; no ROM, ripped sprite sheet, or external assets.
const ART = {
  fighter: [
    '.......W.......','......WWW......','......WCW......','......WRW......',
    '..W...WRW...W..','..W..WWRWW..W..','..WW.WWRWW.WW..','..WWWWWRWWWWW..',
    '.WWWWWWRWWWWWW.','WWWWRRWRWRRWWWW','WWWWWWWRWWWWWWW','.WWW.WWRWW.WWW.',
    '.....WWWWW.....','....WWW.WWW....','....WW...WW....','....R.....R....'
  ],
  bee: [
    '.....R...R.....','......R.R......','......YYY......','.....YWWY......',
    '...B..YY..B....','...BB.YY.BB....','..BBBBYYBBBB...','.BBBBBYYBBBBB..',
    '.BBB..RR..BBB..','BBB...YY...BBB.','BB....YY....BB.', 'B.....RR.....B.',
    '......RR.......','......Y........','...............','...............'
  ],
  butterfly: [
    '..R...B.B...R..','..RR..B.B..RR..','..RRR.WWW.RRR..','..RRRRWCWRRRR..',
    '.RRRRRWCWRRRRR.','RRRRRRWCWRRRRRR','RRRRRRWCWRRRRRR','.RRRRWWCWWRRRR.',
    '..RRRWWCWWRRR..','..RR..WWW..RR..','.RRR...W...RRR.','RRR.........RRR',
    '.R...........R.','...............','...............','...............'
  ],
  boss: [
    '...O..C.C..O...','...GO.C.C.OG...','...GGCYCYCGG...','....GCYYYCG....',
    '....GGYYYGG....','...GGYYYYYGG...','..GGGYYYYYGGG..','.GGGCYYYYYCGGG.',
    '.GGC..YYY..CGG.','GGGC..YYY..CGGG','GGO....Y....OGG','GGO.........OGG',
    'GGO.........OGG','.GO.........OG.','.G...........G.','...............'
  ]
};
const FONT = {
  A:'01110/10001/10001/11111/10001/10001/10001', B:'11110/10001/10001/11110/10001/10001/11110',
  C:'01111/10000/10000/10000/10000/10000/01111', D:'11110/10001/10001/10001/10001/10001/11110',
  E:'11111/10000/10000/11110/10000/10000/11111', F:'11111/10000/10000/11110/10000/10000/10000',
  G:'01111/10000/10000/10111/10001/10001/01110', H:'10001/10001/10001/11111/10001/10001/10001',
  I:'11111/00100/00100/00100/00100/00100/11111', J:'00111/00010/00010/00010/10010/10010/01100',
  K:'10001/10010/10100/11000/10100/10010/10001', L:'10000/10000/10000/10000/10000/10000/11111',
  M:'10001/11011/10101/10101/10001/10001/10001', N:'10001/11001/10101/10011/10001/10001/10001',
  O:'01110/10001/10001/10001/10001/10001/01110', P:'11110/10001/10001/11110/10000/10000/10000',
  Q:'01110/10001/10001/10001/10101/10010/01101', R:'11110/10001/10001/11110/10100/10010/10001',
  S:'01111/10000/10000/01110/00001/00001/11110', T:'11111/00100/00100/00100/00100/00100/00100',
  U:'10001/10001/10001/10001/10001/10001/01110', V:'10001/10001/10001/10001/10001/01010/00100',
  W:'10001/10001/10001/10101/10101/10101/01010', X:'10001/10001/01010/00100/01010/10001/10001',
  Y:'10001/10001/01010/00100/00100/00100/00100', Z:'11111/00001/00010/00100/01000/10000/11111',
  0:'01110/10001/10011/10101/11001/10001/01110', 1:'00100/01100/00100/00100/00100/00100/01110',
  2:'01110/10001/00001/00010/00100/01000/11111', 3:'11110/00001/00001/01110/00001/00001/11110',
  4:'00010/00110/01010/10010/11111/00010/00010', 5:'11111/10000/10000/11110/00001/00001/11110',
  6:'01110/10000/10000/11110/10001/10001/01110', 7:'11111/00001/00010/00100/01000/01000/01000',
  8:'01110/10001/10001/01110/10001/10001/01110', 9:'01110/10001/10001/01111/00001/00001/01110',
  '-':'00000/00000/00000/11111/00000/00000/00000', '.':'00000/00000/00000/00000/00000/00110/00110',
  '/':'00001/00001/00010/00100/01000/10000/10000', ':':'00000/00110/00110/00000/00110/00110/00000',
  '%':'11001/11010/00010/00100/01000/01011/10011', '>':'10000/01000/00100/00010/00100/01000/10000',
  '!':'00100/00100/00100/00100/00100/00000/00100'
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas; canvas.width = WIDTH; canvas.height = HEIGHT;
    this.ctx = canvas.getContext('2d', { alpha:false }); this.ctx.imageSmoothingEnabled = false;
    this.cache = new Map(); this.stars = [];
    let seed = 1981;
    const rand = () => { seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
    const colors = ['#e74545','#46bbbb','#e1e14b','#a650dd','#4486cb','#d0d0d0'];
    for(let i=0;i<116;i++) this.stars.push({x:Math.floor(rand()*224),y:rand()*288,
      speed:4+rand()*13,color:colors[i%6],phase:rand()*6});
  }
  text(text, x, y, color='white', scale=1, center=false) {
    const c=this.ctx; c.fillStyle=COLORS[color]||color;
    if(center) x-=((text.length*6-1)*scale)/2;
    x=Math.round(x); y=Math.round(y);
    for(const ch of text.toUpperCase()) {
      const glyph=FONT[ch];
      if(glyph) glyph.split('/').forEach((row,dy)=> [...row].forEach((v,dx)=> {
        if(v==='1') c.fillRect(x+dx*scale,y+dy*scale,scale,scale);
      }));
      x+=6*scale;
    }
  }
  sprite(name,x,y,angle=0,frame=0,damaged=false,scale=1) {
    const key=[name,frame,damaged].join(':');
    if(!this.cache.has(key)) {
      const image=document.createElement('canvas'); image.width=16; image.height=16;
      const c=image.getContext('2d');
      const art=ART[name==='captive'?'fighter':name]||ART.fighter;
      art.forEach((row,dy)=>[...row].forEach((value,dx)=> {
        if(value==='.') return;
        let color=COLORS[value];
        if(name==='captive') color=value==='W'?COLORS.R:value==='R'?COLORS.W:COLORS.Y;
        if(damaged&&name==='boss') color=value==='G'?COLORS.P:value==='C'?COLORS.B:color;
        let drawX=dx;
        if(frame && name!=='fighter' && name!=='captive' && (dx<4||dx>10) && dy>4)
          drawX+=dx<7?1:-1;
        c.fillStyle=color; c.fillRect(drawX,dy,1,1);
      }));
      this.cache.set(key,image);
    }
    const c=this.ctx; c.save(); c.translate(Math.round(x),Math.round(y));
    c.rotate(Math.round(angle/(Math.PI/8))*(Math.PI/8)); c.scale(scale,scale);
    c.drawImage(this.cache.get(key),-7,-8); c.restore();
  }
  beam(e,g) {
    const c=this.ctx, top=e.y+8;
    const extend=g.mode==='capture'?1:Math.min(1,e.clock/0.8);
    const length=(PLAYER_Y+8-top)*extend;
    for(let dy=3+(Math.floor(g.time*28)%6);dy<length;dy+=6) {
      const half=4+dy/(PLAYER_Y+8-top)*28;
      c.fillStyle=Math.floor(dy/6)%3===0?'#116cba':'#00d6cf';
      for(let dx=-Math.floor(half);dx<=half;dx++)
        c.fillRect(Math.round(e.x+dx),Math.round(top+dy+3*Math.sqrt(Math.max(0,1-(dx/half)**2))),1,1);
    }
  }
  render(g,hi=20000) {
    const c=this.ctx; c.fillStyle='#000000'; c.fillRect(0,0,224,288);
    for(const star of this.stars) {
      if(Math.sin(g.time*1.5+star.phase)<-0.5) continue;
      c.fillStyle=star.color; c.fillRect(star.x,Math.floor((star.y+g.time*star.speed)%288),1,1);
    }
    if(g.mode==='title'||Math.floor(g.time*2)%2===0||g.mode==='over') this.text('1UP',18,3,'red');
    this.text(g.practice?'PRACTICE':'HIGH SCORE',136,3,'red',1,true);
    this.text(String(g.score).padStart(6,'0'),12,14);
    this.text(String(hi).padStart(6,'0'),136,14,'white',1,true);
    if(g.mode==='title') {
      this.text('GALAGA',112,72,'red',5,true);
      this.text('GALAGA',112,68,'#ff9c00',5,true);
      this.text('GALAGA',112,65,'yellow',5,true);
      this.text('1 PLAYER',112,119,'cyan',1,true);
      if(Math.floor(g.time*2)%2===0) this.text('PUSH SPACE / START',112,145,'yellow',1,true);
      this.sprite('boss',40,181); this.text('150 / 400-1600',64,178);
      this.sprite('butterfly',40,203); this.text(' 80 / 160',64,200);
      this.sprite('bee',40,225); this.text(' 50 / 100',64,222);
      this.text('FORMATION / DIVING',112,247,'cyan',1,true);
      this.text('CAPTURE > RESCUE > DUAL',112,270,'yellow',1,true);
      return;
    }
    c.save(); c.beginPath(); c.rect(0,28,WIDTH,241); c.clip();
    for(const e of g.enemies) {
      if(e.dead||e.mode==='wait') continue;
      if(e.mode==='beam') this.beam(e,g);
      this.sprite(e.type==='fighter'?'captive':e.type,e.x,e.y,e.angle,Math.floor(g.time*4)%2,e.hp===1);
      if(e.captive) {const pos=g.captivePosition(e);this.sprite('captive',pos.x,pos.y,e.mode==='dive'?e.angle:Math.PI);}
    }
    for(const s of g.shots) {
      c.fillStyle=COLORS.W;c.fillRect(Math.round(s.x),Math.round(s.y)-3,1,3);
      c.fillStyle=COLORS.R;c.fillRect(Math.round(s.x),Math.round(s.y),1,3);
    }
    for(const b of g.bullets) {
      c.fillStyle=COLORS.R;c.fillRect(Math.round(b.x),Math.round(b.y)-2,1,4);
      c.fillStyle=COLORS.W;c.fillRect(Math.round(b.x),Math.round(b.y)-2,1,1);
    }
    for(const effect of g.effects) {
      const progress=effect.age/effect.duration, radius=(effect.large?24:16)*progress;
      for(let i=0;i<18;i++) {
        const angle=i*Math.PI*2/18, r=radius*(0.6+(i%3)*0.2);
        c.fillStyle=[COLORS.W,COLORS.Y,COLORS.R,COLORS.C][(i+Math.floor(progress*4))%4];
        const size=progress<0.5?2:1;
        c.fillRect(Math.round(effect.x+Math.sin(angle)*r),Math.round(effect.y+Math.cos(angle)*r),size,size);
      }
      if(progress<0.35) {c.fillStyle=COLORS.W;c.fillRect(Math.round(effect.x)-2,Math.round(effect.y)-2,5,5);}
    }
    const p=g.player;
    if(p.active && (g.mode==='rescue'||p.inv<=0||Math.floor(g.time*9)%2===0))
      for(const offset of p.dual?[-8,8]:[0]) this.sprite('fighter',p.x+offset,p.y);
    if(g.capture) this.sprite(g.capture.clock>1.5?'captive':'fighter',g.capture.x,g.capture.y,g.capture.clock*9);
    if(g.rescue) this.sprite('fighter',g.rescue.x,g.rescue.y,g.rescue.clock<0.45?g.rescue.clock*14:0);
    for(const label of g.labels) this.text(label.text,label.x,label.y,label.color,1,true);
    c.restore();
    for(let i=0;i<Math.min(6,p.reserves);i++) this.sprite('fighter',11+i*15,280,0,0,false,0.8);
    if(p.reserves>6) this.text('+'+(p.reserves-6),98,280,'white');
    const flags=Math.min(9,g.stage);
    for(let i=0;i<flags;i++) {
      const fx=213-i*7;c.fillStyle=COLORS.Y;c.fillRect(fx,273,1,12);
      c.fillStyle=i%2?COLORS.B:COLORS.R;c.fillRect(fx-4,274,4,6);c.fillRect(fx-2,280,2,2);
    }
    if(g.stage>9) this.text(String(g.stage),204,260,'yellow');
    if(g.mode==='ready') {
      this.text(g.challenge?'CHALLENGING STAGE':g.practice?'DOCKING PRACTICE':'STAGE '+g.stage,112,176,'cyan',1,true);
      this.text('READY',112,200,'red',1,true);
    }
    if(g.mode==='capture') this.text('FIGHTER CAPTURED',112,213,'red',1,true);
    if(g.mode==='rescue') this.text('DUAL FIGHTER',112,194,'cyan',1,true);
    if(g.mode==='respawn') this.text(p.reserves?'READY':'GAME OVER',112,202,'red',1,true);
    if(g.mode==='clear') this.text('STAGE CLEAR',112,190,'cyan',1,true);
    if(g.mode==='results') {
      this.text(g.kills===40?'PERFECT!':'NUMBER OF HITS',112,171,'cyan',1,true);
      this.text(String(g.kills)+' / 40',112,189,'white',1,true);
      this.text('BONUS '+g.bonus,112,212,'yellow',1,true);
    }
    if(g.mode==='over') {
      c.fillStyle='#000';c.fillRect(21,158,182,83);
      this.text('GAME OVER',112,164,'red',2,true);
      this.text('SHOTS '+g.totalShots,112,187,'white',1,true);
      this.text('HIT RATIO '+(g.totalShots?Math.min(100,100*g.totalHits/g.totalShots).toFixed(1):'0.0')+'%',112,202,'cyan',1,true);
      this.text('PUSH SPACE / START',112,229,'yellow',1,true);
    }
    if(g.paused) {
      c.fillStyle='#000';c.fillRect(35,168,154,48);
      this.text('PAUSED',112,173,'yellow',2,true);
      this.text('P / RESUME',112,201,'white',1,true);
    }
  }
}
