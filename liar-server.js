import {randomUUID} from 'node:crypto';
import {createGame,topics,hint,openVote,vote,finalGuess,resolveVotes,abandonGuess,turn,view} from './liar-logic.js';
const rooms=new Map();const send=(c,m)=>{if(c.readyState===1)c.send(JSON.stringify(m));};
const online=(r,id)=>[...r.clients].some(c=>c.pid===id&&c.readyState===1);
function canSkip(r,id,since=0){const p=r.members.get(id);return !!p&&!online(r,id)&&Date.now()-Math.max(p.offlineAt||Date.now(),since)>=30000;}
function broadcast(r){for(const c of r.clients)if(c.pid)send(c,{type:'state',host:r.host,category:r.category,rounds:r.rounds,categories:Object.keys(topics),members:[...r.members].map(([id,p])=>({id,nick:p.nick,online:online(r,id)})),chat:r.chat,game:view(r.game,c.pid),canSkipHint:!!r.game&&r.game.phase==='hint'&&canSkip(r,turn(r.game)),canFinishVote:!!r.game&&r.game.phase==='vote'&&r.game.players.filter(id=>!Object.hasOwn(r.game.votes,id)).every(id=>canSkip(r,id,r.game.voteStarted)),canFinishGuess:!!r.game&&r.game.phase==='guess'&&canSkip(r,r.game.liar,r.game.guessStarted)});}
export function attachLiar(ws,req){
 const url=new URL(req.url,'http://localhost');if(url.pathname!=='/liar-ws')return false;
 const id=url.searchParams.get('room');if(!id||!/^[\w-]{10,80}$/.test(id)){ws.close(1008);return true;}
 let r=rooms.get(id);if(!r){if(rooms.size>=1000){ws.close(1013);return true;}r={clients:new Set(),members:new Map(),host:null,category:'랜덤',rounds:2,game:null,chat:[],last:Date.now()};rooms.set(id,r);}r.clients.add(ws);
 ws.on('message',raw=>{try{
 const now=Date.now();if(now-(ws.window||0)>1000){ws.window=now;ws.count=0;}if(++ws.count>20)throw Error('잠시 후 다시 시도해주세요.');const m=JSON.parse(raw);if(m?.type==='heartbeat'){send(ws,{type:'heartbeat'});return;}
 if(m.type==='join'){
 if(ws.pid)throw Error('이미 입장했어요.');if(typeof m.id!=='string'||!/^[\w-]{16,80}$/.test(m.id))throw Error('잘못된 참가자입니다.');
 const existing=r.members.get(m.id);if(existing){if(existing.token!==m.token)throw Error('재접속 인증 실패');ws.pid=m.id;existing.offlineAt=null;for(const c of r.clients)if(c!==ws&&c.pid===m.id)c.close(1000,'Reconnected');}
 else{if(r.game)throw Error('진행 중인 방입니다. 대기실에서 입장해주세요.');if(r.members.size>=10){const absent=[...r.members.keys()].find(id=>!online(r,id));if(absent)r.members.delete(absent);}if(r.members.size>=10)throw Error('최대 10명까지 입장할 수 있어요.');r.members.set(m.id,{nick:String(m.nick||'플레이어').trim().slice(0,16)||'플레이어',token:randomUUID()});ws.pid=m.id;}
 if(!r.host)r.host=ws.pid;send(ws,{type:'joined',token:r.members.get(ws.pid).token});
 }else{
 if(!ws.pid)throw Error('먼저 입장해주세요.');const host=()=>{if(ws.pid!==r.host)throw Error('방장만 할 수 있어요.');};
 if(m.type==='config'){host();if(r.game)throw Error('대기실에서 설정해주세요.');if(!['랜덤',...Object.keys(topics)].includes(m.category)||![1,2].includes(m.rounds))throw Error('설정을 확인해주세요.');r.category=m.category;r.rounds=m.rounds;}
 else if(m.type==='start'||m.type==='rematch'){host();if(r.game&&r.game.phase!=='finished')throw Error('진행 중인 게임입니다.');const players=[...r.members.keys()].filter(id=>online(r,id));r.game=createGame(players,r.category,r.rounds);for(const id of r.members.keys())if(!online(r,id))r.members.delete(id);}
 else if(m.type==='lobby'){host();if(r.game?.phase!=='finished')throw Error('게임 종료 후 대기실로 돌아갈 수 있어요.');r.game=null;for(const id of r.members.keys())if(!online(r,id))r.members.delete(id);}
 else if(m.type==='chat'){const text=String(m.text||'').trim().slice(0,240);if(text){r.chat.push({nick:r.members.get(ws.pid).nick,text});r.chat=r.chat.slice(-100);}}
 else{
 const g=r.game;if(!g||m.gameId!==g.id)throw Error('현재 게임을 확인해주세요.');
 if(m.type==='hint')hint(g,ws.pid,m.text,m.sequence);
 else if(m.type==='openVote'){host();openVote(g);}
 else if(m.type==='vote')vote(g,ws.pid,m.target,m.voteRound);
 else if(m.type==='guess')finalGuess(g,ws.pid,m.text);
 else if(m.type==='skipHint'){host();if(!canSkip(r,turn(g)))throw Error('연결 끊김 후 30초 동안 복귀를 기다려주세요.');hint(g,turn(g),'',m.sequence,true);}
 else if(m.type==='finishVote'){host();if(g.phase!=='vote')throw Error('투표 중이 아니에요.');const pending=g.players.filter(id=>!Object.hasOwn(g.votes,id));if(!pending.every(id=>canSkip(r,id,g.voteStarted)))throw Error('미투표자의 복귀 또는 투표를 기다려주세요.');for(const id of pending)g.votes[id]=null;resolveVotes(g);}
 else if(m.type==='finishGuess'){host();if(g.phase!=='guess'||!canSkip(r,g.liar,g.guessStarted))throw Error('라이어의 복귀를 기다려주세요.');abandonGuess(g);}
 else throw Error('알 수 없는 요청입니다.');
 }
 }r.last=now;broadcast(r);
 }catch(e){send(ws,{type:'error',error:e.message});}});
 ws.on('close',()=>{r.clients.delete(ws);if(ws.pid&&!online(r,ws.pid)){const p=r.members.get(ws.pid);if(p)p.offlineAt=Date.now();if(r.host===ws.pid)r.host=[...r.members.keys()].find(id=>online(r,id))||null;}r.last=Date.now();broadcast(r);});return true;
}
setInterval(()=>{for(const[id,r]of rooms){if(!r.clients.size&&Date.now()-r.last>3600000)rooms.delete(id);else if(r.game)broadcast(r);}},1000).unref();
