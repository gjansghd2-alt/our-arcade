// Black forbidden moves only. RIF definitions 3 and 9.2–9.3; no tournament opening protocol.
// Enumerate distinct stone sets, not endpoints (one open four has two endpoints).
const dirs=[[1,0],[0,1],[1,1],[1,-1]],inBoard=(x,y)=>x>=0&&x<15&&y>=0&&y<15;
function point(i,dx,dy,n){const x=i%15+dx*n,y=Math.floor(i/15)+dy*n;return inBoard(x,y)?y*15+x:-1;}
function run(b,i,dx,dy){let n=1;for(const sign of[-1,1])for(let k=1;;k++){const q=point(i,dx,dy,k*sign);if(q<0||b[q]!==0)break;n++;}return n;}
function lengths(b,i){return dirs.map(([dx,dy])=>run(b,i,dx,dy));}
function fourSets(b,i){const sets=new Set();for(const[dx,dy]of dirs)for(let start=-4;start<=0;start++){const cells=Array.from({length:5},(_,k)=>point(i,dx,dy,start+k));if(cells.some(q=>q<0||b[q]===1))continue;const stones=cells.filter(q=>b[q]===0),holes=cells.filter(q=>b[q]===null);if(stones.length!==4||holes.length!==1)continue;const q=holes[0];b[q]=0;const wins=run(b,q,dx,dy)===5;b[q]=null;if(wins)sets.add(stones.slice().sort((a,c)=>a-c).join(','));}return sets;}
function forbiddenPlaced(b,i,memo){const lengthsHere=lengths(b,i);if(lengthsHere.includes(5))return '';if(lengthsHere.some(n=>n>5))return '장목';const key=i+':'+b.map(p=>p===null?'.':p).join('');if(memo.has(key))return memo.get(key);if(fourSets(b,i).size>=2){memo.set(key,'4·4');return '4·4';}
 const threes=new Set();for(const[dx,dy]of dirs)for(let start=-3;start<=0;start++){const cells=Array.from({length:4},(_,k)=>point(i,dx,dy,start+k)),left=point(i,dx,dy,start-1),right=point(i,dx,dy,start+4);if(left<0||right<0||b[left]!==null||b[right]!==null||cells.some(q=>q<0||b[q]===1))continue;const stones=cells.filter(q=>b[q]===0),holes=cells.filter(q=>b[q]===null);if(stones.length!==3||holes.length!==1)continue;const signature=stones.slice().sort((a,c)=>a-c).join(',');if(threes.has(signature))continue;const q=holes[0];b[q]=0;let open=!lengths(b,q).includes(5);for(const end of[left,right]){b[end]=0;if(run(b,end,dx,dy)!==5)open=false;b[end]=null;}if(open&&!forbiddenPlaced(b,q,memo))threes.add(signature);b[q]=null;if(threes.size>=2){memo.set(key,'3·3');return '3·3';}}
 memo.set(key,'');return '';
}
export function forbiddenMove(board,to){if(!Number.isInteger(to)||to<0||to>=225||board[to]!==null)return '빈자리가 아님';const b=board.slice();b[to]=0;return forbiddenPlaced(b,to,new Map());}
