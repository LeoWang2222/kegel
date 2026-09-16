// WebKit's default ambient session follows the iPhone silent switch.
// Select the media playback channel before creating/resuming an AudioContext.
export function configurePlayback(navigatorLike){
  try{if(navigatorLike?.audioSession){navigatorLike.audioSession.type='playback';return true;}}catch{}
  return false;
}

// Original ambient composition: overlapping warm chords and sparse bell notes.
// All oscillators have whole cycles per loop, including the wrapped envelopes.
export function composeAmbient(sampleRate=22050) {
  const duration=24, length=sampleRate*duration;
  const channels=[new Float32Array(length),new Float32Array(length)];
  const chords=[[50,57,61,64],[47,54,57,62],[43,55,59,62],[45,57,59,64]];
  const melody=[74,73,69,66,69,73,71,69];
  const frequency=midi=>Math.round(440*2**((midi-69)/12)*duration)/duration;
  for(let c=0;c<2;c++){
    const out=channels[c];
    chords.forEach((chord,k)=>chord.forEach((note,j)=>{
      const f=frequency(note),phase=c*.24+j*.37;
      for(let i=0;i<length;i++){
        const t=i/sampleRate,age=(t-k*6+duration)%duration;
        if(age>=12)continue;
        const envelope=Math.sin(Math.PI*age/12)**2;
        out[i]+=.045*envelope*(Math.sin(2*Math.PI*f*t+phase)+.12*Math.sin(4*Math.PI*f*t+phase));
      }
    }));
    melody.forEach((note,k)=>{
      const f=frequency(note);
      for(let i=0;i<length;i++){
        const t=i/sampleRate,age=(t-k*3+duration)%duration;
        if(age>=4.5)continue;
        const envelope=(1-Math.exp(-age*5))*Math.exp(-age*1.1)*Math.sin(Math.PI*age/4.5)**2;
        out[i]+=.11*envelope*Math.sin(2*Math.PI*f*t+c*.18);
      }
    });
  }
  return {channels,sampleRate,duration};
}

export class AmbientMusic {
  constructor(context){this.context=context;this.buffer=null;this.voice=null;this.voices=new Set();this.offset=0;}
  prepare(){
    if(this.buffer)return;
    const {channels,sampleRate}=composeAmbient();
    this.buffer=this.context.createBuffer(2,channels[0].length,sampleRate);
    channels.forEach((data,c)=>this.buffer.copyToChannel(data,c));
  }
  level(volume){return Math.max(0,Math.min(100,Number(volume)||0))/100*.65;}
  ramp(voice,value,seconds){
    const t=this.context.currentTime,p=voice.gain.gain;
    // Preserve the instantaneous value when reversing an unfinished fade.
    const a=voice.automation;
    const current=a ? a.from+(a.to-a.from)*Math.min(1,Math.max(0,(t-a.at)/a.seconds)) : 0;
    p.cancelScheduledValues(t);p.setValueAtTime(current,t);p.linearRampToValueAtTime(value,t+seconds);
    voice.automation={from:current,to:value,at:t,seconds};
  }
  start(volume){
    if(this.context.state!=='running')return false;
    if(this.voice)return true;
    this.prepare();
    const source=this.context.createBufferSource(),gain=this.context.createGain();
    const voice={source,gain,at:this.context.currentTime,offset:this.offset};
    source.buffer=this.buffer;source.loop=true;source.connect(gain);gain.connect(this.context.destination);
    gain.gain.setValueAtTime(0,this.context.currentTime);
    this.voice=voice;this.voices.add(voice);
    source.onended=()=>{source.disconnect();gain.disconnect();this.voices.delete(voice);};
    source.start(0,this.offset);this.ramp(voice,this.level(volume),.8);return true;
  }
  setVolume(volume){if(this.voice)this.ramp(this.voice,this.level(volume),.2);}
  stop({immediate=false,reset=false}={}){
    if(this.voice){
      this.offset=(this.voice.offset+this.context.currentTime-this.voice.at)%this.buffer.duration;
      const voice=this.voice;this.voice=null;
      this.ramp(voice,0,immediate?.015:.4);
      voice.source.stop(this.context.currentTime+(immediate?.02:.45));
    }
    if(immediate)for(const voice of this.voices){voice.gain.gain.cancelScheduledValues(this.context.currentTime);voice.gain.gain.setValueAtTime(0,this.context.currentTime);voice.source.stop(this.context.currentTime);}
    if(reset)this.offset=0;
  }
}
