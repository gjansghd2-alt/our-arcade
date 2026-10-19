import test from 'node:test';
import assert from 'node:assert/strict';
import {createDictionary} from './dictionary.js';
import {newGame,submitChecked,tick,explode} from './logic.js';
const response=(items,total=items.length)=>({ok:true,json:async()=>({channel:{total,item:items}})});
test('exact dictionary entries, separators, negative cache, credentials stay server-side',async()=>{
 let calls=0;const lookup=createDictionary({key:'test-key',fetchImpl:async url=>{calls++;assert.equal(url.origin,'https://opendict.korean.go.kr');assert.equal(url.searchParams.get('method'),'exact');assert.equal(url.searchParams.get('pos'),'0');return response([{word:'가-긱'},{word:'가긱거리다'}]);}});
 assert.equal(await lookup('가긱'),true);assert.equal(await lookup('가긱'),true);assert.equal(calls,1);
 assert.equal(await lookup('가걱'),false);assert.equal(await lookup('가걱'),false);assert.equal(calls,2);
 assert.equal(await lookup('abc'),false);
});
test('API failures and missing key are not mistaken for unknown words',async()=>{
 await assert.rejects(createDictionary()('가긱'),/인증키/);
 for(const result of [{ok:false},{ok:true,json:async()=>({error:{error_code:20}})},{ok:true,json:async()=>({})}]){
  let count=0;const lookup=createDictionary({key:'secret',fetchImpl:async()=>{count++;return result;}});
  await assert.rejects(lookup('가긱'),/연결하지/);await assert.rejects(lookup('가긱'),/연결하지/);assert.equal(count,2);
 }
 const lookup=createDictionary({key:'secret',timeout:5,fetchImpl:async(_url,{signal})=>new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(signal.reason));setTimeout(resolve,20);})});
 await assert.rejects(lookup('가긱'),/연결하지/);
});
test('four-player lookup freezes clock, prevents races, then advances exactly once',async()=>{
 const g=newGame(['a','b','c','d'],15,1000);g.prompt='ㄱㄱ';let now=2000,resolve;
 const task=submitChecked(g,'a','가긱',0,()=>new Promise(r=>resolve=r),()=>{},()=>now);
 assert.equal(g.checking,true);assert.equal(tick(g,999999),false);explode(g,999999);assert.equal(g.lives.a,3);
 await assert.rejects(submitChecked(g,'a','가긱',0,async()=>true,()=>{},()=>now),/확인 중/);
 now=6000;resolve(true);await task;assert.equal(g.turn,'b');assert.equal(g.sequence,1);assert.equal(g.scores.a,1);assert.equal(g.history.length,1);assert.equal(g.deadline,21000);
});
test('rejection and outage preserve remaining time; disconnected game cannot be advanced',async()=>{
 for(const mode of ['unknown','outage','disconnect']){
  const g=newGame(['a','b'],15,1000);g.prompt='ㄱㄱ';let now=2000;
  const lookup=async()=>{now=5000;if(mode==='disconnect'){g.paused=true;g.deadline=null;return true;}if(mode==='outage')throw Error('network');return false;};
  await assert.rejects(submitChecked(g,'a','가긱',0,lookup,()=>{},()=>now));
  assert.equal(g.checking,false);assert.equal(g.sequence,0);assert.equal(g.lives.a,3);assert.equal(g.deadline,mode==='disconnect'?null:19000);
 }
});
