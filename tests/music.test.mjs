import test from 'node:test';
import assert from 'node:assert/strict';
import {AmbientMusic,composeAmbient,configurePlayback} from '../music.mjs';
import {normalize} from '../core.mjs';

function context(){
 const nodes=[];
 return {state:'running',currentTime:0,destination:{},nodes,
  createBuffer(channels,length,sampleRate){return {duration:length/sampleRate,copyToChannel(){}};},
  createGain(){return {disconnect(){this.disconnected=true;},connect(){},gain:{events:[],cancelScheduledValues(t){this.events.push(['cancel',t]);},setValueAtTime(v,t){this.events.push(['set',v,t]);},linearRampToValueAtTime(v,t){this.events.push(['ramp',v,t]);}}};},
  createBufferSource(){const node={connect(){},disconnect(){this.disconnected=true;},start(t,offset){this.offset=offset;},stop(t){this.stopAt=t;}};nodes.push(node);return node;}
 };
}
function player(){const ctx=context(),music=new AmbientMusic(ctx);music.buffer={duration:24};return {ctx,music};}

test('music defaults off and volume preferences preserve workout and cue settings',()=>{
 const s=normalize({sound:true,holdSec:5,restSec:8,kegelTarget:4});
 assert.equal(s.music,false);assert.equal(s.musicVolume,35);assert.equal(s.sound,true);
 const updated=normalize({...s,music:true,musicVolume:80});
 assert.equal(updated.holdSec,5);assert.equal(updated.restSec,8);assert.equal(updated.kegelTarget,4);assert.equal(updated.musicVolume,80);
 assert.equal(normalize({musicVolume:Infinity}).musicVolume,35);assert.equal(normalize({musicVolume:-5}).musicVolume,0);
});
test('original loop is finite, quiet, stereo and continuous at its seam',()=>{
 const {channels,sampleRate,duration}=composeAmbient(22050);
 assert.equal(duration,24);assert.equal(channels[0].length,sampleRate*duration);
 for(const channel of channels){let peak=0,power=0,maxJump=0;for(let i=0;i<channel.length;i++){assert.ok(Number.isFinite(channel[i]));peak=Math.max(peak,Math.abs(channel[i]));power+=channel[i]**2;maxJump=Math.max(maxJump,Math.abs(channel[i]-channel[(i+1)%channel.length]));}
 assert.ok(peak<.3);assert.ok(Math.sqrt(power/channel.length)>.03);assert.ok(maxJump<.06);assert.ok(Math.abs(channel[0]-channel.at(-1))<.025);}
 assert.notDeepEqual(channels[0],channels[1]);
});
test('starting repeatedly never stacks active loops and suspended audio cannot start',()=>{
 const {ctx,music}=player();ctx.state='suspended';assert.equal(music.start(35),false);assert.equal(ctx.nodes.length,0);
 ctx.state='running';music.start(35);music.start(35);assert.equal(ctx.nodes.length,1);assert.equal(music.voice.source.loop,true);
 assert.deepEqual(music.voice.gain.gain.events.at(-1),['ramp',.35*.65,.8]);
});
test('pause fades from current gain, resumes position, exit resets and releases nodes',()=>{
 const {ctx,music}=player();music.start(35);ctx.currentTime=.4;const old=music.voice;music.stop();
 assert.equal(music.voice,null);assert.ok(Math.abs(old.automation.from-.35*.65/2)<1e-9);assert.equal(old.automation.to,0);
 ctx.currentTime=3;music.start(35);assert.equal(music.voice.source.offset,.4);assert.equal(ctx.nodes.length,2);
 old.source.onended();assert.ok(old.source.disconnected&&old.gain.disconnected);assert.equal(music.voices.size,1);
 music.stop({immediate:true,reset:true});assert.equal(music.offset,0);assert.equal(ctx.nodes[1].stopAt,3);assert.equal(music.voice,null);
});
test('volume changes ramp separately and immediate background stop silences fading tails',()=>{
 const {ctx,music}=player();music.start(35);ctx.currentTime=2;music.setVolume(80);assert.equal(music.voice.automation.to,.8*.65);
 music.stop();music.stop({immediate:true});assert.equal(ctx.nodes[0].stopAt,2);
 const voice=[...music.voices][0];assert.deepEqual(voice.gain.gain.events.at(-1),['set',0,2]);
});

test('iPhone playback channel is selected with safe fallback on unsupported browsers',()=>{
 const safari={audioSession:{type:'auto'}};
 assert.equal(configurePlayback(safari),true);assert.equal(safari.audioSession.type,'playback');
 assert.equal(configurePlayback({}),false);
 assert.equal(configurePlayback({get audioSession(){throw new Error('unsupported');}}),false);
 assert.equal(configurePlayback({audioSession:{set type(value){throw new Error('unsupported');}}}),false);
});
