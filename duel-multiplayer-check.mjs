import WebSocket from 'ws';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {catalog} from './duel-catalog.js';
const base=process.env.TEST_URL||'ws://localhost:3000';
let agent;if(process.env.TEST_PROXY){const {HttpsProxyAgent}=await import('../testdeps/node_modules/https-proxy-agent/dist/index.js');agent=new HttpsProxyAgent(process.env.HTTPS_PROXY);}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(fn,label){const end=Date.now()+20000;while(Date.now()<end){if(fn())return;await delay(25);}throw Error('Timeout '+label);}
async function client(kind,room,spectator=false,creds={id:randomUUID()}){const c={...creds,errors:[],ws:new WebSocket(base+'/duel-ws?game='+kind+'&room='+room,{agent})};c.ws.on('error',e=>c.errors.push(e.message));c.ws.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='state')c.state=m;if(m.type==='joined')c.token=m.token;if(m.type==='error')c.errors.push(m.error);});await wait(()=>c.ws.readyState===1,'socket open');c.send=m=>c.ws.send(JSON.stringify(m));c.send({type:'join',id:c.id,token:c.token,nick:'QA-'+c.id.slice(0,4),spectator});await wait(()=>c.state&&c.token,'join');return c;}
for(const kind of Object.keys(catalog)){
 const room=randomUUID(),cs=[];try{
 for(let i=0;i<Math.max(4,catalog[kind].players+1);i++)cs.push(await client(kind,room,i>=catalog[kind].players));
 const all=fn=>cs.every(fn),host=cs[0];await wait(()=>all(c=>c.state.members.length===cs.length),'members');assert.equal(host.state.host,host.id);
 host.send({type:'chat',text:'대기 중 채팅'});await wait(()=>all(c=>c.state.chat.some(m=>m.text==='대기 중 채팅')),'lobby chat');host.send({type:'start'});await wait(()=>all(c=>c.state.game),'start');const gid=host.state.game.id;
 const watcher=cs.at(-1);assert.equal(watcher.state.game.seat,-1);watcher.send({type:'action',gameId:gid,sequence:0,action:{op:'resign'}});await wait(()=>watcher.errors.length,'spectator rejected');assert.equal(host.state.game.finished,false);
 if(kind==='blackwhite'){const p=cs[host.state.game.turn];p.send({type:'action',gameId:gid,sequence:0,action:{op:'tile',value:8}});await wait(()=>all(c=>c.state.game.sequence===1),'tile');p.send({type:'action',gameId:gid,sequence:0,action:{op:'tile',value:7}});await wait(()=>p.errors.length,'stale rejected');assert.equal(watcher.state.game.hand.length,0);assert.equal(watcher.state.game.colors.filter(c=>c!==null).length,1);}
 const old=cs[1];old.ws.close();await wait(()=>host.state.game.paused,'pause');const seq=host.state.game.sequence;cs[1]=await client(kind,room,false,{id:old.id,token:old.token});await wait(()=>all(c=>!c.state.game.paused),'resume');assert.equal(cs[1].state.game.id,gid);assert.equal(cs[1].state.game.sequence,seq);
 if(kind==='strategyyut'){for(let s=0;s<4;s++)cs[s].send({type:'action',gameId:gid,sequence:seq,phase:'choose',round:1,action:{op:'stick',value:1}});await wait(()=>all(c=>c.state.game.sequence===seq+4),'simultaneous sticks');assert.equal(host.state.game.steps,4);assert.equal(watcher.state.game.mine,null);host.send({type:'action',gameId:gid,sequence:host.state.game.sequence,action:{op:'move',index:0}});await wait(()=>all(c=>c.state.game.pieces[0][0].pos===4),'move');}
 host.send({type:'action',gameId:gid,sequence:host.state.game.sequence,action:{op:'resign'}});await wait(()=>all(c=>c.state.game.finished),'finish');watcher.send({type:'chat',text:'종료 후 채팅'});await wait(()=>all(c=>c.state.chat.at(-1).text==='종료 후 채팅'),'end chat');host.send({type:'rematch'});await wait(()=>all(c=>c.state.game.id!==gid),'rematch');console.log('PASS',kind,cs.length+' clients: chat / privacy / spectator / reconnect / finish / rematch');
 }finally{for(const c of cs)c.ws.close();}
}
