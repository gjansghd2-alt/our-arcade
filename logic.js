import {randomInt,randomUUID} from 'node:crypto';
import {dictionary,groups,prompts,initials} from './words.js';
export function newGame(players,seconds,now=Date.now()){
 const g={id:randomUUID(),players,seconds,lives:Object.fromEntries(players.map(id=>[id,3])),scores:Object.fromEntries(players.map(id=>[id,0])),turn:players[0],prompt:'',deadline:0,sequence:0,used:[],history:[],finished:false,winner:null,paused:false};setPrompt(g,now);return g;
}
function setPrompt(g,now){let pool=prompts.filter(k=>groups.get(k).some(w=>!g.used.includes(w)));if(!pool.length){g.used=[];pool=prompts;}const different=pool.filter(k=>k!==g.prompt);g.prompt=(different.length?different:pool)[randomInt((different.length?different:pool).length)];g.deadline=now+g.seconds*1000;}
function next(g,now){const alive=g.players.filter(id=>g.lives[id]>0);if(alive.length<=1){g.finished=true;g.winner=alive[0]||null;g.deadline=null;return;}const idx=g.players.indexOf(g.turn);for(let n=1;n<=g.players.length;n++){const id=g.players[(idx+n)%g.players.length];if(g.lives[id]>0){g.turn=id;break;}}g.sequence++;setPrompt(g,now);}
export function explode(g,now=Date.now(),reason='timeout'){if(g.finished||g.paused)return;g.lives[g.turn]--;g.history.push({player:g.turn,prompt:g.prompt,type:reason,example:groups.get(g.prompt).find(w=>!g.used.includes(w))||groups.get(g.prompt)[0]});next(g,now);}
export function tick(g,now=Date.now()){if(!g.finished&&!g.paused&&now>=g.deadline){explode(g,now);return true;}return false;}
export function submit(g,id,word,sequence,now=Date.now()){
 if(g.finished||g.paused)throw Error('진행 중인 차례가 아니에요.');
 if(now>=g.deadline){tick(g,now);throw Error('시간이 끝났어요. 다음 차례를 확인해주세요.');}
 if(g.turn!==id)throw Error('아직 내 차례가 아니에요.');
 if(sequence!==g.sequence)throw Error('차례가 바뀌었어요. 다시 확인해주세요.');
 const value=String(word||'').trim().normalize('NFC');
 if(!/^[가-힣]{2}$/.test(value))throw Error('한글 두 글자 단어를 입력해주세요.');
 if(initials(value)!==g.prompt)throw Error('제시된 초성과 맞지 않아요.');
 if(!dictionary.has(value))throw Error('게임 단어장에 없는 단어예요. 다른 단어를 입력해주세요.');
 if(g.used.includes(value))throw Error('이번 게임에서 이미 나온 단어예요.');
 g.used.push(value);g.scores[id]++;g.history.push({player:id,prompt:g.prompt,type:'word',word:value});next(g,now);return true;
}
