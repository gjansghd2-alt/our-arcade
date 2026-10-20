import {randomInt,randomUUID} from 'node:crypto';
import {catalog} from './duel-catalog.js';
import {destination} from './yut-logic.js';
export const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
const range=n=>Array.from({length:n},(_,i)=>i),need=(ok,msg='선택과 현재 차례를 확인해주세요.')=>{if(!ok)throw Error(msg);};
const note=(g,t)=>{g.log.push(t);g.log=g.log.slice(-80);};
export function finishDuel(g,winner,reason){g.finished=true;g.winner=winner;g.reason=reason;g.deadline=null;g.phase='finished';}
function scoreEnd(g){finishDuel(g,g.scores[0]===g.scores[1]?null:g.scores[0]>g.scores[1]?0:1,'점수 합산');}
const turn=(g,s)=>need(g.turn===s,'상대 차례예요.');
export function createDuel(kind,players,now=Date.now()){
 need(Object.hasOwn(catalog,kind)&&players.length===catalog[kind].players);
 const g={id:randomUUID(),kind,players,sequence:0,turn:randomInt(2),first:0,round:1,scores:[0,0],finished:false,winner:null,phase:'play',deadline:null,log:[]};g.first=g.turn;
 if(kind==='blackwhite'){g.hands=[range(9),range(9)];g.picks=[null,null];g.history=[];}
 if(kind==='indian'||kind==='doublepoker'){g.chips=kind==='indian'?[30,30]:[40,40];g.pot=0;g.deck=[];dealPoker(g);}
 if(kind==='gyulhap')newHap(g,now);
 if(kind==='twelve'){g.board=Array(12).fill(null);for(const[s,ps]of [[0,[[9,'E'],[10,'K'],[11,'R'],[7,'P']]],[1,[[0,'R'],[1,'K'],[2,'E'],[4,'P']]]])for(const[i,t]of ps)g.board[i]={s,t};g.captured=[[],[]];g.deadline=now+30000;g.reps={};}
 if(kind==='pictures'){g.hidden=shuffle(range(16));g.belts=[shuffle([...range(16),...range(16),...range(16)]).slice(0,20),shuffle([...range(16),...range(16),...range(16)]).slice(0,20)];g.positions=[2,2];g.reveal=null;}
 if(kind==='numbers'){g.hidden=shuffle([...range(12).map(n=>n+1),'+','×','÷','√']);g.targets=shuffle(numberTargets());g.target=null;g.phase='memorize';g.deadline=now+5000;g.reveal=null;g.peek=0;}
 if(kind==='monorail'){g.tiles=[{x:0,y:0,d:[1,3]},{x:1,y:0,d:[1,3]}];g.left=16;g.challenge=null;}
 if(kind==='quattro'){g.deck=shuffle([...range(4).flatMap(c=>range(6).map(n=>({c,n:n+1}))),{c:4,n:0},{c:4,n:0}]);g.hands=[g.deck.splice(0,4),g.deck.splice(0,4)];g.open=[[],[]];g.mulligans=[0,0];g.ready=[false,false];g.used=[[],[]];g.phase='mulligan';g.pass=[false,false];}
 if(kind==='rpsbet'){g.chips=[1,1];g.opponent=randomInt(3);g.phase='role';g.fighter=null;g.secret=null;}
 if(kind==='strategyyut'){g.turn=0;g.pieces=range(4).map(()=>range(2).map(()=>({pos:-1,trail:[]})));g.choices=Array(4).fill(null);g.phase='choose';g.steps=null;g.extra=false;}
 return g;
}
function dealPoker(g){
 if(g.chips.some(n=>n===0)&&g.pot===0){finishDuel(g,g.chips[0]>g.chips[1]?0:1,'칩 소진');return;}
 if(g.deck.length<2)g.deck=shuffle(g.kind==='indian'?[...range(10),...range(10)].map(n=>n+1):range(4).flatMap(()=>range(10).flatMap(a=>range(10).filter(b=>(a+b)%2===1).map(b=>[a+1,b+1]))));
 g.cards=[g.deck.pop(),g.deck.pop()];g.bet=[0,0];g.sides=[null,null];g.phase='play';g.turn=g.first;g.ready=[false,false];
 for(let s=0;s<2;s++){const n=Math.min(1,g.chips[s]);g.chips[s]-=n;g.bet[s]=n;g.pot+=n;}
}
function pokerResult(g,w,reason,bonus=0){
 g.lastCards=g.cards;g.lastSides=g.sides;g.lastWinner=w;
 if(w!==null){g.chips[w]+=g.pot;g.pot=0;const pay=Math.min(bonus,g.chips[1-w]);g.chips[1-w]-=pay;g.chips[w]+=pay;g.first=w;}
 note(g,reason+(w===null?' · 무승부, 팟 이월':' · '+(w+1)+'번 승리'));
 if(g.chips.some(n=>n===0)&&w!==null){finishDuel(g,w,'칩 소진');return;}g.phase='between';g.ready=[false,false];
}
function poker(g,s,a){turn(g,s);const o=1-s;
 if(g.kind==='doublepoker'&&g.sides[s]===null&&a.op!=='double'){need([0,1].includes(a.side),'앞면 또는 뒷면을 선택해주세요.');}
 const side=g.sides[s]??a.side;
 need(['call','raise','fold','double'].includes(a.op));
 if(a.op==='double'){
  need(g.kind==='doublepoker'&&g.sides[o]!==null,'상대의 베팅 면이 정해진 뒤 양면 승부가 가능해요.');const pay=2*g.bet[o]-g.bet[s];need(pay>=0&&pay<=g.chips[s],'양면 승부에 필요한 칩이 부족해요.');g.chips[s]-=pay;g.bet[s]+=pay;g.pot+=pay;g.sides[s]=2;
  const w=g.cards[s].every(n=>n>g.cards[o][g.sides[o]])?s:o;pokerResult(g,w,'양면 승부',w===s?10:0);return;
 }
 if(a.op==='fold'){if(g.kind==='doublepoker')g.sides[s]=side;pokerResult(g,o,'폴드',g.kind==='indian'&&g.cards[s]===10?10:0);return;}
 let pay;if(a.op==='raise'){need(Number.isInteger(a.amount)&&a.amount>g.bet[o]&&a.amount>g.bet[s],'레이즈는 상대의 총 베팅보다 커야 해요.');pay=a.amount-g.bet[s];need(pay<=g.chips[s]&&a.amount<=g.bet[o]+g.chips[o],'두 선수의 보유 칩 범위에서 베팅해주세요.');}else pay=Math.min(g.chips[s],Math.max(0,g.bet[o]-g.bet[s]));
 if(g.kind==='doublepoker')g.sides[s]=side;g.chips[s]-=pay;g.bet[s]+=pay;g.pot+=pay;
 if(a.op==='raise'){g.turn=o;return;}
 const excess=g.bet[o]-g.bet[s];if(excess>0){g.bet[o]-=excess;g.chips[o]+=excess;g.pot-=excess;}
 if(g.kind==='doublepoker'&&g.sides[o]===null){g.turn=o;return;}
 const values=g.kind==='indian'?g.cards:g.cards.map((c,i)=>c[g.sides[i]]);pokerResult(g,values[0]===values[1]?null:values[0]>values[1]?0:1,'카드 공개');
}
export function isHap(cards){return cards.length===3&&[0,1,2].every(i=>{const n=new Set(cards.map(c=>c[i])).size;return n===1||n===3;});}
export function hapSolutions(cards){const out=[];for(let a=0;a<7;a++)for(let b=a+1;b<8;b++)for(let c=b+1;c<9;c++)if(isHap([cards[a],cards[b],cards[c]]))out.push([a,b,c].join(','));return out;}
function newHap(g,now){g.cards=shuffle(range(27).map(n=>[Math.floor(n/9),Math.floor(n/3)%3,n%3])).slice(0,9);g.found=[];g.phase='play';g.passes=0;g.deadline=now+10000;}
function hapNext(g,now){g.turn=1-g.turn;g.phase='play';g.deadline=now+10000;if(g.passes>=6)hapRound(g,now);}
function hapRound(g,now){if(g.round>=10)scoreEnd(g);else{g.round++;newHap(g,now);}}
function hap(g,s,a,now){turn(g,s);
 if(a.op==='claim'){need(g.phase==='play');g.phase='answer';g.deadline=now+5000;return;}
 if(a.op==='pass'){if(g.phase==='answer')g.scores[s]--;g.passes++;hapNext(g,now);return;}
 if(a.op==='gyul'){need(['play','bonus'].includes(g.phase));const left=hapSolutions(g.cards).filter(k=>!g.found.includes(k));if(!left.length){g.scores[s]+=3;note(g,'결 성공 +3');hapRound(g,now);}else{g.scores[s]--;note(g,'아직 합이 남아 있어요 −1');hapNext(g,now);}return;}
 need(a.op==='hap'&&g.phase==='answer');const ids=a.ids;need(Array.isArray(ids)&&ids.length===3&&new Set(ids).size===3&&ids.every(i=>Number.isInteger(i)&&i>=0&&i<9));const k=[...ids].sort((a,b)=>a-b).join(',');g.passes=0;
 if(!g.found.includes(k)&&isHap(ids.map(i=>g.cards[i]))){g.scores[s]++;g.found.push(k);g.phase='bonus';g.deadline=now+5000;note(g,'합 '+ids.map(i=>i+1).join('·')+' +1');}else{g.scores[s]--;note(g,'합 오답 또는 중복 −1');hapNext(g,now);}
}
export function twelveMoves(board,s,from){const p=board[from];if(!p||p.s!==s)return [];const r=Math.floor(from/3),c=from%3,dir=s===0?-1:1;return range(12).filter(to=>{const dr=Math.floor(to/3)-r,dc=to%3-c;if(board[to]?.s===s||Math.max(Math.abs(dr),Math.abs(dc))!==1)return false;return p.t==='K'||p.t==='R'&&(dr===0||dc===0)||p.t==='E'&&Math.abs(dr)===1&&Math.abs(dc)===1||p.t==='P'&&dr===dir&&dc===0||p.t==='H'&&!(dr===-dir&&dc!==0);});}
function twelve(g,s,a,now){turn(g,s);const to=a.to;need(Number.isInteger(to)&&to>=0&&to<12);
 if(a.op==='drop'){need(Number.isInteger(a.index)&&a.index>=0&&a.index<g.captured[s].length&&!g.board[to]&&Math.floor(to/3)!==(s===0?0:3));g.board[to]={s,t:g.captured[s].splice(a.index,1)[0]};}
 else{need(a.op==='move'&&twelveMoves(g.board,s,a.from).includes(to));const p=g.board[a.from],victim=g.board[to];g.board[a.from]=null;g.board[to]=p;if(victim?.t==='K'){finishDuel(g,s,'왕 포획');return;}if(victim)g.captured[s].push(victim.t==='H'?'P':victim.t);if(p.t==='P'&&Math.floor(to/3)===(s===0?0:3))p.t='H';}
 g.turn=1-s;const king=g.board.findIndex(p=>p?.s===g.turn&&p.t==='K');if(king>=0&&Math.floor(king/3)===(g.turn===0?0:3)){finishDuel(g,g.turn,'왕 진영 진입 유지');return;}
 const key=JSON.stringify([g.board,g.captured.map(a=>[...a].sort()),g.turn]);g.reps[key]=(g.reps[key]||0)+1;if(g.reps[key]>=3)finishDuel(g,null,'동일 국면 3회');else g.deadline=now+30000;
}
export function calculate(a,op,b){return op==='+'?a+b:op==='×'?a*b:op==='÷'?a/b:op==='√'?Math.sqrt(a)+Math.sqrt(b):NaN;}
function numberTargets(){const out=new Set();for(let a=1;a<=12;a++)for(let b=1;b<=12;b++)if(a!==b)for(const op of ['+','×','÷','√']){const n=calculate(a,op,b);if(Number.isInteger(n)&&n>0)out.add(n);}return [...out];}
function nextNumber(g){if(!g.targets.length){scoreEnd(g);return;}g.target=g.targets.pop();g.phase='buzz';g.turn=-1;g.deadline=null;g.reveal=null;}
function numbers(g,s,a,now){
 if(a.op==='buzz'){need(g.phase==='buzz');g.turn=s;g.phase='answer';g.deadline=now+5000;return;}turn(g,s);need(g.phase==='answer');
 if(a.op==='pass'){g.turn=1-s;g.deadline=null;return;}
 need(a.op==='formula'&&Array.isArray(a.ids)&&a.ids.length===3&&new Set(a.ids).size===3&&a.ids.every(i=>Number.isInteger(i)&&i>=0&&i<16));
 const [x,op,y]=a.ids.map(i=>g.hidden[i]);g.reveal=a.ids;g.phase='reveal';g.deadline=now+2500;const valid=typeof x==='number'&&typeof y==='number'&&typeof op==='string'&&Math.abs(calculate(x,op,y)-g.target)<1e-9;g.correct=valid;
 if(valid){g.scores[s]+=op==='√'?2:1;note(g,x+op+y+' = '+g.target);if(g.scores[s]>=10)finishDuel(g,s,'10점 달성');}else note(g,'수식 불일치 · 상대에게 기회');
}
const dirs=[[0,-1],[1,0],[0,1],[-1,0]];
export function railComplete(tiles){const map=new Map(tiles.map(t=>[t.x+','+t.y,t]));for(const t of tiles)for(const d of t.d){const [dx,dy]=dirs[d],q=map.get((t.x+dx)+','+(t.y+dy));if(!q||!q.d.includes((d+2)%4))return false;}
 const seen=new Set(),stack=[tiles[0]];while(stack.length){const t=stack.pop(),k=t.x+','+t.y;if(seen.has(k))continue;seen.add(k);for(const d of t.d){const [dx,dy]=dirs[d];stack.push(map.get((t.x+dx)+','+(t.y+dy)));}}return seen.size===tiles.length;
}
function rail(g,s,a){turn(g,s);if(a.op==='impossible'){need(g.challenge===null);g.challenge=s;g.turn=1-s;note(g,(s+1)+'번 불가능 선언 · 상대 단독 완성 도전');return;}if(a.op==='concede'){need(g.challenge!==null);finishDuel(g,g.challenge,'불가능 인정');return;}
 need(a.op==='lay'&&Array.isArray(a.tiles)&&a.tiles.length>=1&&a.tiles.length<=Math.min(3,g.left));const tiles=a.tiles.map(t=>({x:t.x,y:t.y,d:t.d}));
 for(const t of tiles)need(Number.isInteger(t.x)&&Number.isInteger(t.y)&&Math.abs(t.x)<=18&&Math.abs(t.y)<=18&&Array.isArray(t.d)&&t.d.length===2&&t.d[0]!==t.d[1]&&t.d.every(d=>Number.isInteger(d)&&d>=0&&d<4));
 if(tiles.length>1){const xs=tiles.map(t=>t.x),ys=tiles.map(t=>t.y);need((new Set(xs).size===1&&Math.max(...ys)-Math.min(...ys)===tiles.length-1)||(new Set(ys).size===1&&Math.max(...xs)-Math.min(...xs)===tiles.length-1),'여러 타일은 연속된 일렬이어야 해요.');}
 const board=[...g.tiles];for(const t of tiles){need(!board.some(q=>q.x===t.x&&q.y===t.y),'이미 타일이 있어요.');need(board.some(q=>Math.abs(q.x-t.x)+Math.abs(q.y-t.y)===1),'기존 타일 옆에 놓아주세요.');board.push(t);}g.tiles=board;g.left-=tiles.length;
 if(railComplete(board))finishDuel(g,s,'철로 완성');else if(!g.left)finishDuel(g,g.challenge??null,g.challenge===null?'타일 소진 · 미완성 무승부':'완성 도전 실패');else if(g.challenge===null)g.turn=1-s;
}
function quattroRank(hand){const valid=new Set(hand.map(c=>c.c)).size===4&&new Set(hand.map(c=>c.n)).size===4;return Number(valid)*1000+hand.reduce((a,c)=>a+c.n,0)*10+Math.max(...hand.map(c=>c.n));}
function quattro(g,s,a){
 if(g.phase==='mulligan'){need(!g.ready[s]);if(a.op==='mulligan'){need(g.mulligans[s]<2);g.deck=shuffle([...g.deck,...g.hands[s]]);g.hands[s]=g.deck.splice(0,4);g.mulligans[s]++;}else{need(a.op==='ready');g.ready[s]=true;if(g.ready.every(Boolean)){g.shops=range(6).map(()=>g.deck.splice(0,3));g.phase='open';}}return;}
 if(g.phase==='open'){need(a.op==='open'&&g.open[s].length===g.round-1&&Number.isInteger(a.index)&&a.index>=0&&a.index<4&&!g.open[s].includes(a.index));if(g.round===4)need(g.used[s].length===6,'6개 교환소와 모두 교환해야 마지막 카드를 열 수 있어요.');g.open[s].push(a.index);if(g.open.every(o=>o.length===g.round)){if(g.round===4){const r=g.hands.map(quattroRank);finishDuel(g,r[0]===r[1]?null:r[0]>r[1]?0:1,'콰트로 판정');}else{g.phase='exchange';g.pass=[false,false];g.turn=g.first;}}return;}
 turn(g,s);need(g.phase==='exchange');if(a.op==='pass'){need(g.round<3||g.used[s].length===6,'마지막 공개 전 모든 교환소와 교환해주세요.');g.pass[s]=true;if(g.pass.every(Boolean)){g.phase='open';g.round++;}else g.turn=1-s;return;}
 need(a.op==='exchange'&&Number.isInteger(a.shop)&&a.shop>=0&&a.shop<6&&!g.used[s].includes(a.shop)&&Number.isInteger(a.index)&&a.index>=0&&a.index<4&&!g.open[s].includes(a.index));
 const shown=g.open[s].map(i=>g.hands[s][i]),shop=g.shops[a.shop];const priority=c=>c.n===0?10000:(!shown.some(q=>q.n===c.n||q.c===c.c)?1000:0)+c.n*10+(4-c.c);
 let best=0;for(let i=1;i<shop.length;i++)if(priority(shop[i])>priority(shop[best]))best=i;
 const sent=g.hands[s][a.index];[g.hands[s][a.index],shop[best]]=[shop[best],sent];g.used[s].push(a.shop);g.pass[s]=false;note(g,(s+1)+'번 → 교환소 '+(a.shop+1)+'에 '+['빨강','파랑','노랑','초록','무색'][sent.c]+' '+sent.n+' 전달');g.turn=g.pass[1-s]?s:1-s;
}
function rps(g,s,a){
 if(g.phase==='role'){turn(g,s);need(['fight','predict'].includes(a.op));g.fighter=a.op==='fight'?s:1-s;g.phase='fight';g.turn=g.fighter;return;}
 if(g.phase==='fight'){turn(g,s);need(a.op==='hand'&&[0,1,2].includes(a.value));g.secret=a.value;g.phase='bet';g.turn=1-s;return;}
 turn(g,s);need(g.phase==='bet'&&a.op==='predict'&&['win','draw','lose'].includes(a.value)&&Number.isInteger(a.amount)&&a.amount>=(g.chips[s]?1:0)&&a.amount<=g.chips[s]);
 const d=(g.secret-g.opponent+3)%3,result=d===0?'draw':d===1?'win':'lose';g.chips[s]-=a.amount;if(a.value===result)g.chips[s]+=a.amount*(result==='draw'?3:2);else if(result==='draw'&&a.value!=='draw')g.chips[s]+=a.amount;if(result==='win')g.chips[g.fighter]+=Math.min(4,Math.ceil(g.round/3));
 note(g,'표식 '+g.secret+' / '+g.opponent+' · '+{win:'승',draw:'무',lose:'패'}[result]);g.scores=[...g.chips];if(g.round>=11&&g.round%2===1&&g.chips[0]!==g.chips[1])scoreEnd(g);else{g.round++;g.turn=1-g.first;g.first=g.turn;g.opponent=randomInt(3);g.secret=null;g.phase='role';}
}
function strategy(g,s,a){
 if(g.phase==='choose'){need(a.op==='stick'&&[0,1].includes(a.value)&&g.choices[s]===null);g.choices[s]=a.value;if(g.choices.every(v=>v!==null)){const n=g.choices.reduce((a,b)=>a+b,0);g.steps=n===0?5:n===1?-1:n;g.extra=g.steps>=4;g.lastChoices=[...g.choices];g.phase='move';if(g.steps===-1&&!g.pieces[g.turn].some(p=>p.pos>=1&&p.pos!==30)){strategyNext(g);}}return;}
 turn(g,s);need(a.op==='move'&&[0,1].includes(a.index));const p=g.pieces[s][a.index];let d=destination(p,g.steps,a.shortcut!==false);need(d,'이 말은 움직일 수 없어요.');if(g.steps===-1&&p.pos===1)d={pos:30,trail:[...p.trail,30]};const moving=p.pos===-1?[a.index]:g.pieces[s].flatMap((q,i)=>q.pos===p.pos?[i]:[]);let caught=false;
 if(d.pos>=1&&d.pos!==30)for(let t=0;t<4;t++)if(t!==s)for(const q of g.pieces[t])if(q.pos===d.pos){q.pos=-1;q.trail=[];caught=true;}
 for(const i of moving)g.pieces[s][i]=structuredClone(d);if(d.pos>=1&&d.pos!==30)for(const q of g.pieces[s])if(q.pos===d.pos)q.trail=[...d.trail];if(s<2&&g.pieces[s].every(p=>p.pos===30)){finishDuel(g,s,'대결 선수 말 2개 완주');return;}g.extra ||= caught;strategyNext(g);
}
function strategyNext(g){if(!g.extra){const order=[0,2,1,3];g.turn=order[(order.indexOf(g.turn)+1)%4];}for(let i=0;i<4&&g.pieces[g.turn].every(p=>p.pos===30);i++){const order=[0,2,1,3];g.turn=order[(order.indexOf(g.turn)+1)%4];}g.extra=false;g.choices=Array(4).fill(null);g.steps=null;g.phase='choose';}
export function actDuel(g,s,a,now=Date.now()){
 need(!g.finished&&Number.isInteger(s)&&s>=0&&s<g.players.length);need(a&&typeof a==='object');
 if(a.op==='resign'){finishDuel(g,s%2===0?1:0,'기권');g.sequence++;return;}
 if(['indian','doublepoker'].includes(g.kind)&&g.phase==='between'){need(a.op==='ready');g.ready[s]=true;if(g.ready.every(Boolean)){g.round++;dealPoker(g);}g.sequence++;return;}
 if(g.kind==='blackwhite'){turn(g,s);need(a.op==='tile'&&g.hands[s].includes(a.value));g.hands[s]=g.hands[s].filter(v=>v!==a.value);g.picks[s]=a.value;if(g.picks.every(v=>v!==null)){const w=g.picks[0]===g.picks[1]?null:g.picks[0]>g.picks[1]?0:1;g.history.push({colors:g.picks.map(n=>n%2),values:[...g.picks],winner:w});if(w!==null){g.scores[w]++;g.first=w;}note(g,'대결 '+g.round+' · '+(w===null?'무승부':(w+1)+'번 승리'));g.picks=[null,null];if(g.round===9)scoreEnd(g);else{g.round++;g.turn=g.first;}}else g.turn=1-s;}
 else if(['indian','doublepoker'].includes(g.kind))poker(g,s,a);
 else if(g.kind==='gyulhap')hap(g,s,a,now);
 else if(g.kind==='twelve')twelve(g,s,a,now);
 else if(g.kind==='pictures'){turn(g,s);need(g.phase==='play'&&a.op==='picture'&&Number.isInteger(a.index)&&a.index>=0&&a.index<16);g.reveal=[a.index];const correct=g.hidden[a.index]===g.belts[s][g.positions[s]];if(correct){g.positions[s]++;if(g.positions[s]>=20)finishDuel(g,s,'결승점 도착');}else{g.belts[s].splice(18,1);g.belts[s].unshift(randomInt(16));g.positions[s]--;if(g.positions[s]<0)finishDuel(g,1-s,'경로 이탈');else g.turn=1-s;}if(!g.finished){g.phase='reveal';g.deadline=now+2000;}}
 else if(g.kind==='numbers')numbers(g,s,a,now);
 else if(g.kind==='monorail')rail(g,s,a);
 else if(g.kind==='quattro')quattro(g,s,a);
 else if(g.kind==='rpsbet')rps(g,s,a);
 else if(g.kind==='strategyyut')strategy(g,s,a);
 g.sequence++;
}
export function tickDuel(g,now=Date.now()){
 if(g.finished||g.paused||!g.deadline||now<g.deadline)return false;
 if(g.kind==='twelve')finishDuel(g,1-g.turn,'시간 초과');
 else if(g.kind==='gyulhap'){if(g.phase==='answer'){g.scores[g.turn]--;g.passes=0;}else g.passes++;hapNext(g,now);}
 else if(g.kind==='pictures'){g.reveal=null;g.phase='play';g.deadline=null;}
 else if(g.kind==='numbers'){
  if(g.phase==='memorize'||g.phase==='peek')nextNumber(g);
  else if(g.phase==='answer'){g.turn=1-g.turn;g.deadline=null;}
  else if(g.phase==='reveal'){if(g.correct){g.round++;g.phase='peek';g.reveal=[g.peek++%16];g.deadline=now+3000;}else{g.phase='answer';g.turn=1-g.turn;g.reveal=null;g.deadline=null;}}
 }g.sequence++;return true;
}
// Explicit per-recipient projection: never send hidden state as a catch-all object.
export function viewDuel(g,s){
 const v={};for(const k of ['id','kind','players','sequence','turn','round','scores','finished','winner','reason','phase','deadline','paused','log'])v[k]=g[k];v.seat=s;
 if(g.kind==='blackwhite'){v.hand=s>=0?g.hands[s]:[];v.counts=g.hands.map(a=>a.length);v.colors=g.picks.map(n=>n===null?null:n%2);v.history=g.history.map(h=>({colors:h.colors,winner:h.winner,mine:s>=0?h.values[s]:null,...(g.finished?{values:h.values}:{})}));}
 if(['indian','doublepoker'].includes(g.kind)){Object.assign(v,{chips:g.chips,pot:g.pot,bet:g.bet,sides:g.sides,ready:g.ready,lastCards:g.lastCards,lastSides:g.lastSides});v.cards=g.kind==='indian'?g.cards.map((c,i)=>g.finished||g.phase==='between'||s>=0&&i!==s?c:null):g.cards.map((c,i)=>[c[0],g.finished||g.phase==='between'||s===i?c[1]:null]);}
 if(g.kind==='gyulhap')Object.assign(v,{cards:g.cards,found:g.found});
 if(g.kind==='twelve')Object.assign(v,{board:g.board,captured:g.captured});
 if(['pictures','numbers'].includes(g.kind)){v.board=g.hidden.map((c,i)=>g.finished||g.phase==='memorize'||g.reveal?.includes(i)?c:null);if(g.kind==='pictures')Object.assign(v,{belts:g.belts,positions:g.positions});else v.target=g.target;}
 if(g.kind==='monorail')Object.assign(v,{tiles:g.tiles,left:g.left,challenge:g.challenge});
 if(g.kind==='quattro')Object.assign(v,{hands:g.hands.map((h,p)=>h.map((c,i)=>g.finished||p===s||g.open[p].includes(i)?c:null)),open:g.open,ready:g.ready,mulligans:g.mulligans,used:g.used,pass:g.pass});
 if(g.kind==='rpsbet')Object.assign(v,{chips:g.chips,opponent:g.opponent,fighter:g.fighter});
 if(g.kind==='strategyyut')Object.assign(v,{pieces:g.pieces,steps:g.steps,lastChoices:g.lastChoices,submitted:g.choices.map(c=>c!==null),mine:s>=0?g.choices[s]:null});
 return structuredClone(v);
}
