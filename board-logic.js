import {forbiddenMove} from './renju.js';
import {randomUUID} from 'node:crypto';
const inside=(x,y,w=9,h=10)=>x>=0&&x<w&&y>=0&&y<h;
export function palace(x,y,s){return x>=3&&x<=5&&y>=(s?0:7)&&y<=(s?2:9);}
const lines=[[[3,0],[4,1],[5,2]],[[5,0],[4,1],[3,2]],[[3,7],[4,8],[5,9]],[[5,7],[4,8],[3,9]]];
function diagonal(a,b){for(const l of lines){const i=l.findIndex(p=>p[0]===a[0]&&p[1]===a[1]),j=l.findIndex(p=>p[0]===b[0]&&p[1]===b[1]);if(i>=0&&j>=0)return l.slice(Math.min(i,j)+1,Math.max(i,j));}return null;}
export function initialBoard(setups=[0,0]){const b=Array(90).fill(null);for(let s=0;s<2;s++){let back=['R','H','E','A',null,'A','E','H','R'];if(setups[s]&1)[back[1],back[2]]=[back[2],back[1]];if(setups[s]&2)[back[6],back[7]]=[back[7],back[6]];for(let x=0;x<9;x++)if(back[x])b[(s?0:9)*9+x]={s,t:back[x]};b[(s?1:8)*9+4]={s,t:'K'};for(const x of[1,7])b[(s?2:7)*9+x]={s,t:'C'};for(const x of[0,2,4,6,8])b[(s?3:6)*9+x]={s,t:'P'};}return b;}
export function pseudo(b,from,to){if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=90||to>=90||from===to)return false;const p=b[from],q=b[to];if(!p||q?.s===p.s)return false;const x=from%9,y=Math.floor(from/9),u=to%9,v=Math.floor(to/9),dx=u-x,dy=v-y,ax=Math.abs(dx),ay=Math.abs(dy),at=(a,c)=>b[c*9+a];
 if(p.t==='K'||p.t==='A')return palace(u,v,p.s)&&palace(x,y,p.s)&&((ax+ay===1)||(ax===1&&ay===1&&diagonal([x,y],[u,v])!==null));
 if(p.t==='P')return (ay===0&&ax===1)||(dx===0&&dy===(p.s?1:-1))||(ax===1&&dy===(p.s?1:-1)&&diagonal([x,y],[u,v])!==null);
 if(p.t==='H'){if(ax===2&&ay===1)return !at(x+Math.sign(dx),y);if(ax===1&&ay===2)return !at(x,y+Math.sign(dy));return false;}
 if(p.t==='E'){if(ax===3&&ay===2)return !at(x+Math.sign(dx),y)&&!at(x+2*Math.sign(dx),y+Math.sign(dy));if(ax===2&&ay===3)return !at(x,y+Math.sign(dy))&&!at(x+Math.sign(dx),y+2*Math.sign(dy));return false;}
 let path=[];if(dx===0||dy===0){for(let n=1;n<Math.max(ax,ay);n++)path.push([x+n*Math.sign(dx),y+n*Math.sign(dy)]);}else{path=diagonal([x,y],[u,v]);if(path===null)return false;}
 const screens=path.map(([a,c])=>at(a,c)).filter(Boolean);if(p.t==='R')return screens.length===0;if(p.t==='C')return screens.length===1&&screens[0].t!=='C'&&q?.t!=='C';return false;
}
export function checked(b,s){const k=b.findIndex(p=>p?.s===s&&p.t==='K');return k<0||b.some((p,i)=>p&&p.s!==s&&pseudo(b,i,k));}
export function facing(b){const a=b.findIndex(p=>p?.s===0&&p.t==='K'),c=b.findIndex(p=>p?.s===1&&p.t==='K');if(a<0||c<0||a%9!==c%9)return false;for(let i=Math.min(a,c)+9;i<Math.max(a,c);i+=9)if(b[i])return false;return true;}
export function legal(b,s,from,to,breakFace=false){if(b[from]?.s!==s||b[to]?.t==='K'||!pseudo(b,from,to))return false;const c=b.slice();c[to]=c[from];c[from]=null;return !checked(c,s)&&(!breakFace||!facing(c));}
export function legalMoves(g){const out=[];if(g.kind!=='janggi'||g.finished)return out;for(let f=0;f<90;f++)if(g.board[f]?.s===g.turn)for(let t=0;t<90;t++)if(legal(g.board,g.turn,f,t,g.bikjang))out.push([f,t]);return out;}
export function createBoardGame(kind,players,rule='free',setups=[0,0],forbidden=false){const g={id:randomUUID(),kind,players,rule,forbidden,board:kind==='omok'?Array(225).fill(null):initialBoard(setups),turn:0,sequence:0,finished:false,winner:null,reason:'',last:null,log:[],passes:0,bikjang:false,drawOffer:null,repetitions:{}};g.repetitions[position(g)]=1;return g;}
function position(g){return g.turn+':'+JSON.stringify(g.board);}
export function finish(g,winner,reason){g.finished=true;g.winner=winner;g.reason=reason;g.drawOffer=null;}
export function boardMove(g,side,from,to){if(g.finished||side!==g.turn)throw Error('내 차례에만 둘 수 있어요.');if(g.kind==='omok'){if(!Number.isInteger(to)||to<0||to>=225||g.board[to]!==null)throw Error('빈 교차점에 돌을 놓아주세요.');if(g.forbidden&&side===0){const why=forbiddenMove(g.board,to);if(why)throw Error(why+' 금수입니다. 다른 곳에 놓아주세요.');}g.board[to]=side;const x=to%15,y=Math.floor(to/15);for(const[dx,dy]of[[1,0],[0,1],[1,1],[1,-1]]){let n=1;for(const d of[-1,1])for(let k=1;inside(x+dx*k*d,y+dy*k*d,15,15)&&g.board[(y+dy*k*d)*15+x+dx*k*d]===side;k++)n++;if(g.forbidden?(side===0?n===5:n>=5):(g.rule==='exact'?n===5:n>=5))finish(g,side,'오목 완성');}if(!g.finished&&g.board.every(p=>p!==null))finish(g,null,'빈자리가 없는 무승부');g.last={from:null,to};}
 else{if(!legal(g.board,side,from,to,g.bikjang))throw Error('그곳으로 이동할 수 없어요. 장군과 이동 경로를 확인해주세요.');g.board[to]=g.board[from];g.board[from]=null;g.last={from,to};g.bikjang=facing(g.board);}
 g.log.push(`${side===0?(g.kind==='omok'?'흑':'초'):(g.kind==='omok'?'백':'한')} · ${from===null?'':from+' → '}${to}`);g.log=g.log.slice(-100);g.turn=1-side;g.sequence++;g.passes=0;g.drawOffer=null;
 if(g.kind==='janggi'&&!g.finished){if(!g.bikjang&&checked(g.board,g.turn)&&!legalMoves(g).length)finish(g,side,'외통장군');const k=position(g);g.repetitions[k]=(g.repetitions[k]||0)+1;if(!g.finished&&g.repetitions[k]>=3)finish(g,null,'같은 국면 3회 반복 · 친선 무승부');}
}
export function pass(g,side){if(g.kind!=='janggi'||g.finished||side!==g.turn)throw Error('지금은 한 수 쉴 수 없어요.');if(g.bikjang){finish(g,null,'빅장 수락');g.sequence++;return;}if(checked(g.board,side))throw Error('장군을 먼저 피해주세요.');g.turn=1-side;g.sequence++;g.passes++;g.drawOffer=null;g.last=null;g.log.push((side?'한':'초')+' · 한 수 쉼');if(g.passes>=2)finish(g,null,'서로 한 수 쉼 · 친선 무승부');}
