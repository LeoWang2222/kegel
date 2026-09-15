import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize,completeGroup,streak,planDay,Session} from '../core.mjs';
const now=new Date(2026,8,15,12);
test('migrate old records, keep settings and lifetime totals',()=>{
 const old={day:'2026-9-15',kegelGroups:2,kegelTarget:3,holdSec:5,totalGroups:42,checkins:{'2026-9-14':true}};
 const s=normalize(old,now);
 assert.equal(s.kegelGroups,2);assert.equal(s.totalGroups,42);assert.equal(s.holdSec,5);assert.equal(s.restSec,6);assert.equal(s.records['2026-9-15'].groups,2);assert.equal(streak(s,now),1);assert.equal(old.version,undefined);
});
test('midnight keeps yesterday and credits completion to new day',()=>{
 const s=normalize({day:'2026-9-14',kegelGroups:2,totalGroups:7,kegelTarget:3},new Date(2026,8,14,23,59));
 const next=completeGroup(s,90,now);
 assert.equal(next.kegelGroups,1);assert.equal(next.totalGroups,8);assert.equal(next.records['2026-9-14'].groups,2);assert.equal(next.records['2026-9-15'].groups,1);
});
test('target completion and local date streak cross month boundaries',()=>{
 const today=new Date(2026,2,1,12);
 let s=normalize({day:'2026-3-1',kegelTarget:1,checkins:{'2026-2-28':true,'2026-2-27':true}},today);
 s=completeGroup(s,90,today);assert.equal(streak(s,today),3);assert.equal(s.checkins['2026-3-1'],true);
});
test('plan start is stable and day counter crosses month boundary',()=>{
 const s=normalize({},new Date(2026,7,31,12));const next=normalize(s,now);
 assert.equal(next.planStart,'2026-8-31');assert.equal(planDay(next,now),16);
});
test('settings are bounded and relaxation is never shorter than contraction',()=>{
 const s=normalize({holdSec:10,restSec:2,kegelTarget:999,checkins:[],records:null},now);
 assert.equal(s.restSec,10);assert.equal(s.kegelTarget,10);assert.deepEqual(s.checkins,{});assert.deepEqual(s.records,{});
});
test('early release does not count and repeat press cannot reset clock',()=>{
 const x=new Session();x.press(100);assert.equal(x.press(1100),false);x.tick(1500);assert.equal(x.remaining,2);
 assert.equal(x.release(2000),'early');assert.equal(x.done,0);assert.equal(x.phase,'ready');assert.equal(x.progress,0);
});
test('release at exact deadline counts even before next animation frame',()=>{
 const x=new Session();x.press(0);assert.equal(x.release(3000),'rest');assert.equal(x.done,1);assert.equal(x.phase,'rest');assert.equal(x.progress,1);
 x.tick(6000);assert.equal(x.progress,.5);assert.equal(x.press(6000),false);x.tick(9000);assert.equal(x.phase,'ready');
});
test('holding past deadline waits for release without extra repetitions',()=>{
 const x=new Session();x.press(0);x.tick(3000);assert.equal(x.phase,'release');assert.equal(x.progress,1);x.tick(60000);assert.equal(x.done,0);
 x.release(60001);x.release(60002);assert.equal(x.done,1);
});
test('pause interrupts current contraction and preserves completed reps',()=>{
 const x=new Session();x.press(0);x.release(3000);x.tick(9000);x.press(10000);x.pause(11000);
 assert.equal(x.phase,'paused');assert.equal(x.done,1);x.tick(999999);assert.equal(x.phase,'paused');x.resume(1000000);assert.equal(x.phase,'ready');assert.equal(x.remaining,3);
});
test('pause after hold deadline counts once and resumes full relaxation',()=>{
 const x=new Session();x.press(0);x.pause(3000);assert.equal(x.done,1);x.resume(6000);assert.equal(x.phase,'rest');assert.equal(x.remaining,6);x.tick(12000);assert.equal(x.phase,'ready');assert.equal(x.done,1);
});
test('final repetition must include its relaxation before completion',()=>{
 const x=new Session();let t=0;
 for(let n=0;n<10;n++){assert.equal(x.press(t),true);x.release(t+3000);assert.equal(x.phase,'rest');x.tick(t+9000);t+=9000;}
 assert.equal(x.done,10);assert.equal(x.phase,'complete');x.release(t);x.press(t);x.pause(t);assert.equal(x.done,10);assert.equal(x.phase,'complete');
});
