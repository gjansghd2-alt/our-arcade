import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {dictionary,initials} from './words.js';
const extras=JSON.parse(readFileSync(new URL('./dictionary-data.json',import.meta.url))).words.filter(w=>!dictionary.has(w));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(f){for(let i=0;i<1000;i++){if(f())return;await sleep(20);}throw Error('Timed out');}
const child=process.env.TEST_URL?null:spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3160'},stdio:['ignore','pipe','inherit']});
if(child)await once(child.stdout,'data');
let agent;
if(process.env.TEST_PROXY){const {HttpsProxyAgent}=await import('../testdeps/node_modules/https-proxy-agent/dist/index.js');agent=new HttpsProxyAgent(process.env.HTTPS_PROXY);}
const url=(process.env.TEST_URL||'ws://127.0.0.1:3160')+'/?room='+randomUUID(),all=[];
async function connect(creds={id:randomUUID()}){
 const c={creds,errors:[]};c.ws=new WebSocket(url,{agent});all.push(c);
 c.send=m=>c.ws.send(JSON.stringify(m));
 c.ws.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='joined')c.creds.token=m.token;if(m.type==='state')c.state=m;if(m.type==='error')c.errors.push(m.error);});
 await once(c.ws,'open');c.send({type:'join',...creds,nick:'사전검증'+all.length});await wait(()=>c.state);return c;
}
try{
 const players=[];for(let i=0;i<4;i++)players.push(await connect());
 await wait(()=>players.every(c=>c.state.members.length===4));
 assert.equal(players[0].state.dictionaryInfo.wordCount,97068);
 players[0].send({type:'start'});await wait(()=>players.every(c=>c.state.game));
 const accepted=[];
 for(let n=0;n<8;n++){
  const g=players[0].state.game,c=players.find(c=>c.creds.id===g.turn);
  const word=extras.find(w=>initials(w)===g.prompt&&!g.used.includes(w));assert.ok(word);
  if(n===0){c.send({type:'word',word:'abc',gameId:g.id,sequence:g.sequence});await wait(()=>c.errors.length);assert.equal(c.state.game.sequence,0);}
  c.send({type:'word',word,gameId:g.id,sequence:g.sequence});
  await wait(()=>players.every(p=>p.state.game.sequence===n+1));
  assert.ok(players.every(p=>p.state.game.used.includes(word)));accepted.push(word);
 }
 const previous=players[1];previous.ws.close();await once(previous.ws,'close');players[1]=await connect(previous.creds);
 assert.equal(players[1].state.game.sequence,8);assert.equal(players[1].state.game.scores[previous.creds.id],2);
 players[1].send({type:'chat',text:'사전 적용 재접속 확인'});await wait(()=>players.every(c=>c.state.chat.length===1));
 console.log('PASS: 4 players; 97,068 offline words; 8 new-word turns synchronized; invalid input; reconnect score/chat preserved. Words:',accepted.join(', '));
}finally{all.forEach(c=>c.ws.terminate());if(child){child.kill();await once(child,'exit');}}
