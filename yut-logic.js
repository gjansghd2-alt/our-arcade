import {randomInt,randomUUID} from 'node:crypto';
export const names={[-1]:'빽도',1:'도',2:'개',3:'걸',4:'윷',5:'모'};
export function result(mask,backdo=true){const sticks=Array.from({length:4},(_,i)=>(mask>>i)&1);const n=sticks.reduce((a,b)=>a+b,0);return {steps:backdo&&n===1&&sticks[0]?-1:n===0?5:n,name:names[backdo&&n===1&&sticks[0]?-1:n===0?5:n],sticks};}
export function createGame(players,mode='team',backdo=true){
 if(mode==='team'){if(players.length<4||players.length>8||players.length%2)throw Error('팀전은 2대2·3대3·4대4로 시작해주세요.');const a=players.filter(p=>p.team===0),b=players.filter(p=>p.team===1);if(a.length!==b.length)throw Error('두 팀의 인원을 같게 맞춰주세요.');}
 else if(players.length<2||players.length>4)throw Error('개인전은 2~4명이 필요해요.');
 const teams=mode==='team'?[0,1].map(t=>players.filter(p=>p.team===t).map(p=>p.id)):players.map(p=>[p.id]);
 return {id:randomUUID(),mode,backdo,teams,team:0,cursors:teams.map(()=>0),turn:teams[0][0],pieces:teams.map(()=>Array.from({length:4},()=>({pos:-1,trail:[]}))),throws:1,pending:[],lastThrow:null,sequence:0,finished:false,winner:null,log:[]};
}
function log(g,text){g.log.push(text);g.log=g.log.slice(-60);}
function next(g){g.cursors[g.team]=(g.cursors[g.team]+1)%g.teams[g.team].length;g.team=(g.team+1)%g.teams.length;g.turn=g.teams[g.team][g.cursors[g.team]];g.throws=1;g.pending=[];log(g,'다음 팀 차례');}
function guard(g,id,sequence){if(g.finished||g.turn!==id||g.sequence!==sequence)throw Error('현재 내 차례인지 확인해주세요.');}
function settle(g){if(g.throws===0&&g.pending.length&&g.pending.every(r=>r.steps===-1)&&!g.pieces[g.team].some(p=>p.pos>=1&&p.pos!==30)){g.pending=[];log(g,'움직일 말이 없는 빽도 · 차례 넘김');}if(!g.finished&&g.throws===0&&g.pending.length===0)next(g);}
export function roll(g,id,sequence,mask=randomInt(16)){guard(g,id,sequence);if(g.throws<1)throw Error('남은 결과로 말을 움직여주세요.');if(!Number.isInteger(mask)||mask<0||mask>15)throw Error('잘못된 윷 결과');g.throws--;const r={...result(mask,g.backdo),id:randomUUID()};g.pending.push(r);g.lastThrow={...r,team:g.team,player:id};if(r.steps>=4)g.throws++;g.sequence++;log(g,r.name+(r.steps>=4?'! 한 번 더 던져요.':''));settle(g);return r;}
export function destination(piece,steps,shortcut=true){
 if(piece.pos===30)return null;
 if(steps===-1){if(piece.pos<1)return null;const trail=[...piece.trail];trail.pop();return {pos:trail.at(-1)??-1,trail};}
 let pos=piece.pos,trail=[...piece.trail];for(let i=0;i<steps;i++){
 if(pos===-1)pos=1;
 else if(pos===20){pos=30;trail.push(pos);break;}
 else if(pos===5&&i===0&&shortcut)pos=21;
 else if(pos===10&&i===0&&shortcut)pos=26;
 else if(pos===23)pos=i===0||trail.at(-2)!==22?28:24;
 else if(pos===27)pos=23;
 else if(pos===25)pos=15;
 else if(pos===29)pos=20;
 else pos++;
 trail.push(pos);
 }return {pos,trail};
}
export function move(g,id,sequence,rollId,index,shortcut=true){
 guard(g,id,sequence);if(g.throws)throw Error('추가 던지기를 먼저 마쳐주세요.');const r=g.pending.find(r=>r.id===rollId);if(!r)throw Error('사용할 윷 결과를 선택해주세요.');if(!Number.isInteger(index)||index<0||index>3)throw Error('말을 선택해주세요.');const own=g.pieces[g.team],p=own[index],dest=destination(p,r.steps,shortcut);if(!dest)throw Error('이 말은 해당 결과로 움직일 수 없어요.');
 const moving=p.pos===-1?[index]:own.flatMap((q,i)=>q.pos===p.pos?[i]:[]);let captured=0;
 if(dest.pos!==30&&dest.pos!==-1)for(let t=0;t<g.pieces.length;t++)if(t!==g.team)for(const q of g.pieces[t])if(q.pos===dest.pos){q.pos=-1;q.trail=[];captured++;}
 for(const i of moving){own[i]={pos:dest.pos,trail:[...dest.trail]};}
 // A joined stack follows the arriving stack's route for a later back-do.
 if(dest.pos>=1&&dest.pos!==30)for(const q of own)if(q.pos===dest.pos)q.trail=[...dest.trail];
 g.pending=g.pending.filter(v=>v.id!==rollId);g.sequence++;log(g,r.name+' · '+moving.length+'개 이동'+(captured?' / 상대 말 '+captured+'개 잡기!':''));
 if(captured&&r.steps<4){g.throws++;log(g,'잡기 보너스 · 한 번 더 던져요.');}
 if(own.every(p=>p.pos===30)){g.finished=true;g.winner=g.team;g.throws=0;g.pending=[];log(g,'말 4개 완주!');return;}settle(g);
}
export function discard(g,id,sequence,rollId){guard(g,id,sequence);const r=g.pending.find(r=>r.id===rollId);if(g.throws||!r||r.steps!==-1||g.pieces[g.team].some(p=>destination(p,-1)))throw Error('움직일 수 없는 빽도만 넘길 수 있어요.');g.pending=g.pending.filter(p=>p.id!==rollId);g.sequence++;log(g,'움직일 말이 없는 빽도 사용 안 함');settle(g);}
export function skip(g){if(g.finished)throw Error('이미 끝난 경기입니다.');g.sequence++;log(g,'연결 끊김 · 남은 결과를 버리고 차례 넘김');next(g);}
