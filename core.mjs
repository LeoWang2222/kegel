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
  if(s.day && s.kegelGroups > 0 && !s.records[s.day]) s.records[s.day] = {groups:s.kegelGroups};
  if(s.day !== dateKey(now)) { s.day = dateKey(now); s.kegelGroups = integer(s.records[s.day]?.groups, 0, 0, 10000); }
  return s;
}
export function completeGroup(state, seconds, now = new Date()) {
  const s = normalize(state, now);
  s.kegelGroups++; s.totalGroups++;
  const old = object(s.records[s.day]);
  s.records[s.day] = {groups:s.kegelGroups, seconds:integer(old.seconds,0,0,1000000)+Math.round(seconds)};
  if(s.kegelGroups >= s.kegelTarget) s.checkins[s.day] = true;
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
  constructor({holdSec=3,restSec=6,reps=10}={}) {
    this.holdMs=holdSec*1000; this.restMs=restSec*1000; this.reps=reps;
    this.done=0; this.phase='ready'; this.progress=0; this.remaining=holdSec;
    this.startedAt=0; this.pausedFrom=null; this.credited=false;
  }
  begin(phase, now) {this.phase=phase;this.startedAt=now;this.progress=phase==='rest'?1:0;this.remaining=(phase==='rest'?this.restMs:this.holdMs)/1000;}
  press(now) {if(this.phase==='ready') {this.begin('hold',now);return true;}return false;}
  tick(now) {
    if(!['hold','rest'].includes(this.phase))return;
    const ms=this.phase==='hold'?this.holdMs:this.restMs;
    const elapsed=Math.max(0,now-this.startedAt), p=Math.min(1,elapsed/ms);
    this.progress=this.phase==='rest'?1-p:p;
    this.remaining=Math.max(0,Math.ceil((ms-elapsed)/1000));
    if(p===1) {
      if(this.phase==='hold')this.phase='release';
      else {this.phase=this.done===this.reps?'complete':'ready';this.remaining=this.holdMs/1000;}
    }
  }
  release(now) {
    this.tick(now);
    if(this.phase==='hold') {this.phase='ready';this.progress=0;this.remaining=this.holdMs/1000;return 'early';}
    if(this.phase==='release') {this.done++;this.begin('rest',now);return 'rest';}
    return null;
  }
  pause(now) {
    if(['paused','complete'].includes(this.phase))return;
    this.tick(now);
    if(this.phase==='complete')return;
    if(this.phase==='release') {this.done++;this.begin('rest',now);}
    this.pausedFrom=this.phase==='rest'?'rest':'ready';
    this.phase='paused';this.progress=0;
  }
  resume(now) {
    if(this.phase!=='paused')return;
    if(this.pausedFrom==='rest')this.begin('rest',now);
    else {this.phase='ready';this.progress=0;this.remaining=this.holdMs/1000;}
  }
}
