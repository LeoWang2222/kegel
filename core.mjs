export const KEY = 'kegel_helper_v1';
export const dateKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
const object = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const integer = (v, fallback, min, max) => Number.isFinite(v) ? Math.max(min, Math.min(max, Math.floor(v))) : fallback;
export function normalize(raw, now = new Date()) {
  const s = {...object(raw)};
  s.version = 5;
  s.kegelTarget = integer(s.kegelTarget, 3, 1, 10);
  s.holdSec = integer(s.holdSec, 3, 2, 10);
  s.restSec = integer(s.restSec, Math.max(6, s.holdSec), s.holdSec, 20);
  s.kegelGroups = integer(s.kegelGroups, 0, 0, 10000);
  s.totalGroups = integer(s.totalGroups, 0, 0, 1000000);
  s.checkins = {...object(s.checkins)};
  s.records = {...object(s.records)};
  s.planStart = /^\d{4}-\d{1,2}-\d{1,2}$/.test(s.planStart || '') ? s.planStart : dateKey(now);
  s.sound = s.sound === true;
  s.trainingMode = s.trainingMode === 'auto' ? 'auto' : 'hold';
  s.theme = ['light','dark','system'].includes(s.theme) ? s.theme : 'system';
  s.completedSessions = Array.isArray(s.completedSessions) ? s.completedSessions.filter(id=>typeof id==='string').slice(-100) : [];
  s.pendingSession = Session.restore(s.pendingSession)?.snapshot() || null;
  if(s.pendingSession && s.completedSessions.includes(s.pendingSession.id))s.pendingSession=null;
  if(s.day && s.kegelGroups > 0 && !s.records[s.day]) s.records[s.day] = {groups:s.kegelGroups};
  if(s.day !== dateKey(now)) { s.day = dateKey(now); s.kegelGroups = integer(s.records[s.day]?.groups, 0, 0, 10000); }
  return s;
}
export function completeGroup(state, seconds, now = new Date(), sessionId = null) {
  const s = normalize(state, now);
  if(sessionId && s.completedSessions.includes(sessionId))return s;
  s.kegelGroups++; s.totalGroups++;
  const old = object(s.records[s.day]);
  s.records[s.day] = {groups:s.kegelGroups, seconds:integer(old.seconds,0,0,1000000)+Math.round(seconds)};
  if(s.kegelGroups >= s.kegelTarget) s.checkins[s.day] = true;
  if(sessionId){s.completedSessions=[...s.completedSessions,sessionId].slice(-100);if(s.pendingSession?.id===sessionId)s.pendingSession=null;}
  return s;
}
export function streak(s, now = new Date()) {
  const d = new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);
  if(!s.checkins[dateKey(d)]) d.setDate(d.getDate()-1);
  let n=0;
  while(s.checkins[dateKey(d)] && n < 100000) {n++;d.setDate(d.getDate()-1);}
  return n;
}
export function planDay(s, now = new Date()) {
  const [y,m,d] = s.planStart.split('-').map(Number);
  return Math.max(1,Math.floor((Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())-Date.UTC(y,m-1,d))/86400000)+1);
}
// Clock-independent training state machine; UI supplies monotonic timestamps.
export class Session {
  constructor({holdSec=3,restSec=6,reps=10,trainingMode='hold',id}={}) {
    this.holdMs=holdSec*1000; this.restMs=restSec*1000; this.reps=reps;
    this.mode=trainingMode==='auto'?'auto':'hold';
    this.id=id || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.done=0; this.phase='ready'; this.progress=0; this.remaining=holdSec;
    this.startedAt=0; this.pausedFrom=null; this.credited=false; this.afterPrepare='ready';
  }
  begin(phase, now) {this.phase=phase;this.startedAt=now;this.progress=phase==='rest'?1:0;this.remaining=(phase==='prepare'?3000:phase==='rest'?this.restMs:this.holdMs)/1000;}
  prepare(now,next='ready'){this.afterPrepare=next;this.begin('prepare',now);}
  start(now){if(this.mode==='auto')this.prepare(now,'hold');}
  press(now) {if(this.mode==='hold'&&this.phase==='ready') {this.begin('hold',now);return true;}return false;}
  tick(now) {
    if(!['prepare','hold','rest'].includes(this.phase))return;
    const ms=this.phase==='prepare'?3000:this.phase==='hold'?this.holdMs:this.restMs;
    const elapsed=Math.max(0,now-this.startedAt), p=Math.min(1,elapsed/ms);
    this.progress=this.phase==='prepare'?0:this.phase==='rest'?1-p:p;
    this.remaining=Math.max(0,Math.ceil((ms-elapsed)/1000));
    if(p===1) {
      // Never catch up across multiple phases after a delayed frame.
      if(this.phase==='prepare')this.begin(this.afterPrepare,now);
      else if(this.phase==='hold'){
        if(this.mode==='auto'){this.done++;this.begin('rest',now);}else this.phase='release';
      }else if(this.done===this.reps)this.phase='complete';
      else if(this.mode==='auto')this.begin('hold',now);
      else {this.phase='ready';this.remaining=this.holdMs/1000;}
    }
  }
  release(now) {
    if(this.mode==='auto')return null;
    this.tick(now);
    if(this.phase==='hold') {this.phase='ready';this.progress=0;this.remaining=this.holdMs/1000;return 'early';}
    if(this.phase==='release') {this.done++;this.begin('rest',now);return 'rest';}
    return null;
  }
  pause(now) {
    if(['paused','complete'].includes(this.phase))return;
    // Auto mode must never award a repetition when a background event arrives late.
    if(this.mode==='hold')this.tick(now);
    if(this.phase==='complete')return;
    if(this.phase==='release') {this.done++;this.begin('rest',now);}
    this.pausedFrom=this.phase==='rest'?'rest':this.phase==='prepare'&&this.afterPrepare==='rest'?'rest':'ready';
    this.phase='paused';this.progress=0;
  }
  resume(now,withPreparation=false) {
    if(this.phase!=='paused')return;
    if(withPreparation){this.prepare(now,this.pausedFrom==='rest'?'rest':this.mode==='auto'?'hold':'ready');return;}
    if(this.pausedFrom==='rest')this.begin('rest',now);
    else {this.phase='ready';this.progress=0;this.remaining=this.holdMs/1000;}
  }
  snapshot(){
    if(this.phase==='complete'||this.credited)return null;
    const done=this.phase==='release'?this.done+1:this.done;
    const nextPhase=this.phase==='rest'||this.phase==='release'||this.phase==='paused'&&this.pausedFrom==='rest'||this.phase==='prepare'&&this.afterPrepare==='rest'?'rest':'ready';
    return {v:1,id:this.id,mode:this.mode,holdSec:this.holdMs/1000,restSec:this.restMs/1000,reps:this.reps,done,nextPhase};
  }
  static restore(raw){
    if(!raw||raw.v!==1||typeof raw.id!=='string'||!raw.id||raw.id.length>100||!['hold','auto'].includes(raw.mode)||raw.reps!==10)return null;
    if(!Number.isInteger(raw.holdSec)||raw.holdSec<2||raw.holdSec>10||!Number.isInteger(raw.restSec)||raw.restSec<raw.holdSec||raw.restSec>20)return null;
    if(!Number.isInteger(raw.done)||raw.done<0||raw.done>10||!['ready','rest'].includes(raw.nextPhase)||raw.done===10&&raw.nextPhase!=='rest')return null;
    const s=new Session({holdSec:raw.holdSec,restSec:raw.restSec,reps:10,trainingMode:raw.mode,id:raw.id});
    s.done=raw.done;s.phase='paused';s.pausedFrom=raw.nextPhase;return s;
  }
}
