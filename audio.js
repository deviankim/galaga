// Original synthesized arcade-style effects. No recordings or ROM audio.
export class ArcadeAudio {
  constructor() { this.ctx=null; this.muted=false; this.voices=new Set(); }
  unlock() {
    try {
      if(!this.ctx) {
        const Context=globalThis.AudioContext||globalThis.webkitAudioContext;
        if(!Context) return;
        this.ctx=new Context(); this.master=this.ctx.createGain(); this.master.gain.value=this.muted?0:0.17;
        const limiter=this.ctx.createDynamicsCompressor(); limiter.threshold.value=-12;
        limiter.ratio.value=8; this.master.connect(limiter).connect(this.ctx.destination);
        const real=new Float32Array(17),imag=new Float32Array(17);
        // A short, quantized wavetable gives the bell-like sound of an early arcade voice.
        const samples=Array.from({length:32},(_,i)=>Math.round(7*(Math.sin(i*Math.PI/16)+0.2*Math.sin(i*Math.PI/4)))/8);
        for(let k=1;k<=16;k++) for(let i=0;i<32;i++) {
          real[k]+=samples[i]*Math.cos(2*Math.PI*k*i/32)/16;
          imag[k]+=samples[i]*Math.sin(2*Math.PI*k*i/32)/16;
        }
        this.wave=this.ctx.createPeriodicWave(real,imag);
      }
      this.ctx.resume().catch(()=>{});
    } catch { this.ctx=null; }
  }
  setMuted(value) { this.muted=value; if(this.master)this.master.gain.setValueAtTime(value?0:0.17,this.ctx.currentTime); }
  stop(tag) {
    for(const voice of [...this.voices]) if(!tag||voice.tag===tag) {
      try {voice.source.stop();}catch{}
      voice.source.disconnect();voice.gain.disconnect();this.voices.delete(voice);
    }
  }
  track(source,gain,tag) {
    const voice={source,gain,tag};this.voices.add(voice);
    source.onended=()=>{source.disconnect();gain.disconnect();this.voices.delete(voice);};
  }
  tone(freq,duration=0.1,delay=0,type='wave',end=freq,volume=0.25,tag='effect') {
    if(!this.ctx||this.muted||this.voices.size>=64)return;
    const ctx=this.ctx,t=ctx.currentTime+delay,osc=ctx.createOscillator(),gain=ctx.createGain();
    if(type==='wave')osc.setPeriodicWave(this.wave);else osc.type=type;
    osc.frequency.setValueAtTime(freq,t);
    // Discrete pitch stepping, instead of a modern smooth synthesizer sweep.
    for(let i=1;i<=12;i++)osc.frequency.setValueAtTime(freq*(end/freq)**(i/12),t+duration*i/12);
    gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(volume,t+0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001,t+duration);
    osc.connect(gain).connect(this.master);this.track(osc,gain,tag);osc.start(t);osc.stop(t+duration+0.015);
  }
  noise(duration,volume=0.45) {
    if(!this.ctx||this.muted)return;
    const ctx=this.ctx,buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),data=buffer.getChannelData(0);
    let lfsr=0x7fff,value=1;
    for(let i=0;i<data.length;i++) {if(i%6===0){lfsr=(lfsr>>1)|(((lfsr^(lfsr>>1))&1)<<14);value=(lfsr&1)?1:-1;}data[i]=value;}
    const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;
    gain.gain.setValueAtTime(volume,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+duration);
    source.connect(gain).connect(this.master);this.track(source,gain,'noise');source.start();
  }
  melody(notes,beat=0.095) {
    notes.forEach((note,i)=>{if(note){const f=440*2**((note-69)/12);
      this.tone(f,beat*0.9,i*beat,'wave',f,0.34,'music');
      if(i%2===0)this.tone(f/2,beat*1.7,i*beat,'triangle',f/2,0.15,'music');
    }});
  }
  play(name) {
    if(!this.ctx||this.muted)return;
    if(['captured','rescue','death','stage','over'].includes(name))this.stop('beam');
    if(name==='shot') {this.tone(1720,0.09,0,'square',390,0.13);this.tone(650,0.055,0.018,'wave',240,0.16);}
    else if(name==='enemy') {this.tone(550,0.12,0,'wave',95,0.38);this.tone(880,0.055,0,'square',220,0.08);}
    else if(name==='armor') {this.tone(280,0.07,0,'wave',560,0.4);this.tone(420,0.07,0.075,'wave',180,0.3);}
    else if(name==='boss') {this.tone(680,0.22,0,'wave',70,0.45);this.noise(0.13,0.2);}
    else if(name==='death') {this.noise(0.55);this.tone(150,0.45,0,'square',28,0.25);}
    else if(name==='entry') {this.tone(310,0.18,0,'wave',640,0.12);}
    else if(name==='dive') {this.tone(1050,0.32,0,'wave',155,0.22);this.tone(560,0.28,0.19,'wave',85,0.14);}
    else if(name==='beam') {
      this.stop('beam');
      for(let i=0;i<24;i++)this.tone(i%2?210:165,0.23,i*0.2,'wave',i%2?280:240,0.17,'beam');
    } else if(name==='captured') {this.melody([76,79,83,88,83,79,76,72,67,64,60],0.13);}
    else if(name==='rescue') {this.melody([67,72,76,79,0,74,77,81,0,79,84,88,91],0.115);}
    else if(name==='start') {this.stop();this.melody([60,67,72,76,74,67,71,74,72,76,79,84],0.12);}
    else if(name==='challenge') {this.melody([72,76,79,84,79,76,74,77,81,86,84],0.12);}
    else if(name==='perfect') {this.melody([72,76,79,84,0,84,86,88,91,88,84],0.11);}
    else if(name==='extra') {this.melody([84,88,91,96,91,96],0.075);}
    else if(name==='stage') {this.tone(660,0.15);this.tone(880,0.2,0.16);}
    else if(name==='bonus') {this.melody([72,76,79,84],0.11);}
    else if(name==='over') {this.melody([67,64,60,59,55,48],0.18);}
  }
}
