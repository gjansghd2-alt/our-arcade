import {cards} from './matgo-cards.js';
const need=(b,m='현재 차례와 선택한 패를 확인해주세요.')=>{if(!b)throw Error(m);};
const month=id=>cards[id].month;
const note=(g,t)=>{g.log.push(t);g.log=g.log.slice(-80);};
const end=(g,w,reason)=>{g.finished=true;g.winner=w;g.reason=reason;g.phase='finished';};
export function scoreMatgo(ids,gukjin=null){
 const groups={g:[],a:[],r:[],p:[]};let pi=0;
 for(const id of ids){const c=cards[id];if(c.type==='p'||c.type==='d'||id===32&&gukjin==='pi'){groups.p.push(id);pi+=c.type==='d'||id===32?2:1;}else groups[c.type].push(id);}
 const details=[];const add=(name,n)=>{if(n>0)details.push({name,points:n});};
 const n=groups.g.length,bright=n===5?15:n===4?4:n===3?groups.g.includes(44)?2:3:0;add(n===3&&groups.g.includes(44)?'비3광':n+'광',bright);
 add('열끗',groups.a.length-4);add('띠',groups.r.length-4);add('피',pi-9);
 for(const[name,ids,value]of [['고도리',[4,12,29],5],['홍단',[1,5,9],3],['청단',[21,33,37],3],['초단',[13,17,25],3]])if(ids.every(id=>groups[name==='고도리'?'a':'r'].includes(id)))add(name,value);
 return {base:details.reduce((s,d)=>s+d.points,0),details,groups,pi,bright,animals:groups.a.length};
}
export function settlementMatgo(g,s){const a=scoreMatgo(g.captured[s],g.gukjin),b=scoreMatgo(g.captured[1-s],g.gukjin),factors=[];
 if(g.goes[s]>=3)factors.push({name:g.goes[s]+'고',times:2**(g.goes[s]-2)});
 if(g.shaken[s].length)factors.push({name:'흔들기·폭탄 '+g.shaken[s].length+'회',times:2**g.shaken[s].length});
 if(a.pi>=10&&b.pi>0&&b.pi<=7)factors.push({name:'피박',times:2});
 if(a.bright&&b.groups.g.length===0)factors.push({name:'광박',times:2});
 if(a.animals>=7)factors.push({name:'멍박',times:2});
 if(g.lastGo===1-s)factors.push({name:'고박',times:2});
 const base=a.base+g.goes[s],multiplier=factors.reduce((x,f)=>x*f.times,1);return {base,cardPoints:a.base,goPoints:g.goes[s],factors,multiplier,total:base*multiplier};
}
function refresh(g){g.scoreDetails=g.captured.map(ids=>scoreMatgo(ids,g.gukjin));g.scores=g.scoreDetails.map((v,s)=>v.base+g.goes[s]);}
export function initMatgo(g,shuffle,deck=null){
 let pool;for(let i=0;i<200;i++){pool=deck?[...deck]:shuffle(cards.map(c=>c.id));need(pool.length===48&&new Set(pool).size===48&&pool.every(id=>Number.isInteger(id)&&cards[id]),'화투 패 구성이 잘못됐어요.');const floor=pool.slice(20,28);if(!Array.from({length:12},(_,m)=>floor.filter(id=>month(id)===m+1).length).includes(4))break;if(deck)throw Error('바닥 총통은 재배분해야 합니다.');pool=null;}need(pool);
 g.hands=[pool.slice(0,10),pool.slice(10,20)];g.table=pool.slice(20,28);g.deck=pool.slice(28);g.captured=[[],[]];g.goes=[0,0];g.goBase=[-1,-1];g.lastGo=null;g.shaken=[[],[]];g.shown=[[],[]];g.empty=[0,0];g.ppuk={};g.gukjin=null;g.limbo=[];g.pending=null;g.last=null;g.moves=0;g.phase='play';refresh(g);
 const generals=g.hands.map(h=>Array.from({length:12},(_,m)=>h.filter(id=>month(id)===m+1).length).includes(4));if(generals.some(Boolean)){const w=generals.every(Boolean)?null:generals[0]?0:1;if(w!==null)g.settlement={base:7,cardPoints:7,goPoints:0,factors:[],multiplier:1,total:7};end(g,w,w===null?'양쪽 총통 · 무승부':'총통 · 7점 승리');}
}
function take(g,ids){g.table=g.table.filter(id=>!ids.includes(id));g.limbo=g.limbo.filter(id=>!ids.includes(id));g.captured[g.turn].push(...ids);g.pending.got.push(...ids);}
function bonus(g,name,n=1){g.pending.events.push(name);g.pending.steals+=n;}
function takeTriple(g,id,matches){const m=month(id);take(g,[id,...matches]);if(Object.hasOwn(g.ppuk,m)){bonus(g,g.ppuk[m]===g.turn?'자뻑 먹기':'뻑 먹기',g.ppuk[m]===g.turn?2:1);delete g.ppuk[m];}}
function flip(g){const p=g.pending;need(g.deck.length>0,'뒤집을 패가 없어요.');p.flip=g.deck.pop();g.limbo.push(p.flip);const same=p.played.length===1&&month(p.played[0])===month(p.flip);
 if(p.mode==='play'&&same){const id=p.played[0];if(p.matches.length===1){g.table.push(id,p.flip);g.limbo=[];g.ppuk[month(id)]=g.turn;p.events.push('뻑! 세 장이 바닥에 남아요');}else if(p.matches.length===0){take(g,[id,p.flip]);bonus(g,'쪽!');}else if(p.matches.length===2){take(g,[id,p.flip,...p.matches]);bonus(g,'따닥!');}else throw Error('패 중복 상태');return finishTurn(g);}
 if(p.mode==='play'){const id=p.played[0];if(p.matches.length===0){g.table.push(id);g.limbo=g.limbo.filter(x=>x!==id);}else if(p.matches.length===3)takeTriple(g,id,p.matches);else take(g,[id,p.choice??p.matches[0]]);}
 const matches=g.table.filter(id=>month(id)===month(p.flip));if(matches.length===2){p.flipChoices=matches;g.phase='chooseflip';return;}if(matches.length===3)takeTriple(g,p.flip,matches);else if(matches.length===1)take(g,[p.flip,matches[0]]);else{g.table.push(p.flip);g.limbo=g.limbo.filter(x=>x!==p.flip);}finishTurn(g);
}
function stealPi(g,n){for(let i=0;i<n;i++){const other=1-g.turn,pi=scoreMatgo(g.captured[other],g.gukjin).groups.p.sort((a,b)=>(cards[a].type==='p'?1:2)-(cards[b].type==='p'?1:2));if(!pi.length)break;const id=pi[0];g.captured[other]=g.captured[other].filter(x=>x!==id);g.captured[g.turn].push(id);g.pending.stolen.push(id);}}
function finishTurn(g){const p=g.pending;if(!g.table.length&&p.got.length&&g.deck.length)bonus(g,'쓸!');stealPi(g,p.steals);g.last={player:g.turn,played:p.played,flip:p.flip,got:p.got,stolen:p.stolen,events:p.events};g.moves++;note(g,(g.turn+1)+'번 · '+(p.events.join(' · ')||'패 진행')+' · '+p.got.length+'장 획득'+(p.stolen.length?' / 피 '+p.stolen.length+'장 가져오기':''));g.pending=null;need(g.limbo.length===0,'미처리 화투 패');if(g.captured[g.turn].includes(32)&&g.gukjin===null){g.phase='gukjin';return;}finishScore(g);}
function finishScore(g){refresh(g);const s=g.turn,base=g.scoreDetails[s].base;if(g.scores[s]>=7&&base>g.goBase[s]){if(!g.hands[s].length&&!g.empty[s])win(g,s,'마지막 패 · 자동 스톱');else g.phase='gostop';return;}next(g);}
function win(g,s,reason){g.settlement=settlementMatgo(g,s);end(g,s,reason+' · '+g.settlement.total+'점');note(g,g.reason);}
function next(g){if(g.deck.length===0||g.hands.every((h,s)=>h.length+g.empty[s]===0)){end(g,null,'나가리 · 추가 점수 없이 패 소진');return;}g.turn=1-g.turn;if(!g.hands[g.turn].length&&!g.empty[g.turn])g.turn=1-g.turn;g.phase='play';}
export function actMatgo(g,s,a){need(s===g.turn,'상대 차례예요.');
 if(g.phase==='gostop'){need(['go','stop'].includes(a.op));if(a.op==='stop')win(g,s,'스톱');else{need(g.hands[s].length+g.empty[s]>0);g.goBase[s]=g.scoreDetails[s].base;g.goes[s]++;g.lastGo=s;refresh(g);note(g,(s+1)+'번 '+g.goes[s]+'고!');next(g);}return;}
 if(g.phase==='gukjin'){need(a.op==='gukjin'&&['animal','pi'].includes(a.value));g.gukjin=a.value;note(g,'국진을 '+(a.value==='pi'?'쌍피':'열끗')+'로 선택');finishScore(g);return;}
 if(g.phase==='choosehand'){need(a.op==='choose'&&g.pending.matches.includes(a.id));g.pending.choice=a.id;flip(g);return;}
 if(g.phase==='chooseflip'){need(a.op==='choose'&&g.pending.flipChoices.includes(a.id));take(g,[g.pending.flip,a.id]);finishTurn(g);return;}
 need(g.phase==='play');
 if(a.op==='shake'){const same=g.hands[s].filter(id=>month(id)===a.month);need(same.length===3&&!g.shaken[s].includes(a.month),'같은 월 세 장을 가진 경우 한 번만 흔들 수 있어요.');g.shaken[s].push(a.month);g.shown[s].push(...same);note(g,(s+1)+'번 '+a.month+'월 흔들기!');return;}
 need(['play','bomb','empty'].includes(a.op));const p={mode:a.op,played:[],matches:[],flip:null,got:[],stolen:[],events:[],steals:0};
 if(a.op==='empty'){need(g.empty[s]>0,'폭탄 공패가 없어요.');g.empty[s]--;p.events.push('폭탄 공패 사용');}
 else if(a.op==='bomb'){const same=g.hands[s].filter(id=>month(id)===a.month),floor=g.table.filter(id=>month(id)===a.month);need(same.length===3&&floor.length===1,'손패 3장과 바닥 1장이 같은 월이어야 해요.');p.played=same;p.matches=floor;g.empty[s]+=2;if(!g.shaken[s].includes(a.month))g.shaken[s].push(a.month);}
 else{need(Number.isInteger(a.id)&&g.hands[s].includes(a.id),'내 손패를 골라주세요.');p.played=[a.id];p.matches=g.table.filter(id=>month(id)===month(a.id));}
 g.hands[s]=g.hands[s].filter(id=>!p.played.includes(id));g.limbo=[...p.played];g.pending=p;
 if(a.op==='bomb'){take(g,[...p.played,...p.matches]);bonus(g,'폭탄!');}
 if(a.op==='play'&&p.matches.length===2){g.phase='choosehand';return;}flip(g);
}
export function viewMatgo(g,s){return {hand:s>=0?[...g.hands[s]]:[],counts:g.hands.map(h=>h.length),table:g.table,captured:g.captured,deckCount:g.deck.length,goes:g.goes,shaken:g.shaken,shown:g.shown.map((ids,p)=>ids.filter(id=>g.hands[p].includes(id))),empty:g.empty,gukjin:g.gukjin,scoreDetails:g.scoreDetails,preview:[settlementMatgo(g,0),settlementMatgo(g,1)],moves:g.moves,last:g.last,settlement:g.settlement,choices:g.phase==='choosehand'?g.pending.matches:g.phase==='chooseflip'?g.pending.flipChoices:[],played:g.pending?.played??[],flip:g.pending?.flip??null};}
