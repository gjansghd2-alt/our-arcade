import {renderMatgo} from './matgo-ui.js';
import {catalog} from './duel-catalog.js';
const $=s=>document.querySelector(s),el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const query=new URLSearchParams(location.search),kind=location.pathname.startsWith('/matgo')?'matgo':query.get('game'),meta=Object.hasOwn(catalog,kind)?catalog[kind]:null;
if(!meta){for(const[k,m]of Object.entries(catalog)){if(m.standalone)continue;const a=el('a',undefined,'duel-card');a.href='/duel?game='+k;a.style.setProperty('--accent',m.color);a.append(el('small',m.tag+' · '+m.players+'명'),el('div',m.icon,'symbol'),el('h2',m.name),el('p',m.desc),el('span','대결하러 가기 →','enter'));$('#catalog').append(a);}}
else init();
function init(){
 if(kind==='matgo'){document.body.classList.add('matgopage');const css=el('link');css.rel='stylesheet';css.href='/matgo.css';document.head.append(css);document.querySelector('nav a:last-child').textContent='우리끼리 맞고 🎴';document.querySelector('nav a:last-child').href='/matgo';document.querySelector('header .eyebrow').textContent='FORTY-EIGHT CARDS. ONE MORE GO.';document.querySelectorAll('.hero-art span').forEach((e,i)=>e.textContent=['松','光','桐'][i]);document.querySelector('footer').textContent='우리끼리 오락실 · 돈 없이 점수로 즐기는 맞고. 서버 재시작 시 방과 기록은 초기화됩니다.';}

 $('#catalog').hidden=true;$('#room').hidden=false;$('#title').textContent=meta.name;$('#subtitle').textContent=meta.desc;$('#rules').textContent=kind==='matgo'?meta.rules.replaceAll('. ','.\n\n'):meta.rules;$('#capacity').textContent=meta.players+'인 + 관전';document.querySelector('#rules + p').textContent='먼저 입장한 사람이 방장입니다. 같은 브라우저에서 같은 링크로 돌아오면 복귀해요. 선수 연결이 끊기면 진행을 멈추고 복귀를 기다립니다.';document.title=meta.name+(kind==='matgo'?' · 우리끼리 오락실':' · 데스매치 클럽');document.documentElement.style.setProperty('--accent',meta.color);
 let room=query.get('room');if(!room){room=crypto.randomUUID();history.replaceState(null,'',kind==='matgo'?'/matgo?room='+room:'/duel?game='+kind+'&room='+room);}$('#invite').value=location.href;
 const key='duel-'+kind+'-'+room;let creds;try{creds=JSON.parse(localStorage.getItem(key)||sessionStorage.getItem(key)||'null');}catch{}if(!creds)creds={id:crypto.randomUUID()};if(creds.nick)$('#nick').value=creds.nick;
 let ws,state,joined=false,selected=[],from=null,drop=null,draft=[],rotation=0,side=0,lastSeq=null,lastGamePaint='',clockOffset=0;
 const notice=t=>$('#notice').textContent=t;
 function save(){for(const storage of [localStorage,sessionStorage])try{storage.setItem(key,JSON.stringify(creds));}catch{}}
 function send(m){if(ws?.readyState===1)ws.send(JSON.stringify(m));else notice('서버에 다시 연결 중이에요.');}
 const action=a=>{if(state?.game)send({type:'action',gameId:state.game.id,sequence:state.game.sequence,phase:state.game.phase,round:state.game.round,action:a});};
 function connect(){ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/duel-ws?game='+kind+'&room='+room);ws.onopen=()=>{notice('');$('#status').textContent=creds.token?'이전 자리로 복귀 중…':'연결 완료 · 닉네임을 입력하고 입장해주세요.';$('#join').disabled=false;$('#watch').disabled=false;if(creds.token)send({type:'join',...creds});};ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==='joined'){joined=true;creds.token=m.token;save();}else if(m.type==='error')notice(m.error);else if(m.type==='state'){state=m;clockOffset=m.now-Date.now();render();}};ws.onclose=e=>{joined=false;lastGamePaint='';$('#status').textContent='연결이 끊겼어요. 다시 연결 중…';for(const id of ['join','watch','start','sendChat'])$('#'+id).disabled=true;$('#game').querySelectorAll('button').forEach(b=>b.disabled=true);if(e.reason==='Reconnected'){notice('다른 창에서 복귀했어요. 새 창에서 계속해주세요.');return;}if(e.code!==1008)setTimeout(connect,2000);};}
 function join(spectator){const nick=$('#nick').value.trim();if(!nick){notice('닉네임을 입력해주세요.');return;}creds.nick=nick;creds.spectator=spectator;save();send({type:'join',...creds});}
 $('#join').onclick=()=>join(false);$('#watch').onclick=()=>join(true);$('#start').onclick=()=>send({type:'start'});$('#seat').onclick=()=>{const self=state?.members.find(p=>p.id===creds.id);send({type:'seat',spectator:self?.seat>=0});};$('#rematch').onclick=()=>send({type:'rematch'});$('#lobby').onclick=()=>send({type:'lobby'});$('#resign').onclick=()=>{if(confirm('이번 대결을 기권할까요?'))action({op:'resign'});};$('#draw').onclick=()=>send({type:'draw',gameId:state.game.id,sequence:state.game.sequence});
 $('#chatForm').onsubmit=e=>{e.preventDefault();send({type:'chat',text:$('#chat').value});$('#chat').value='';};$('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);$('#copy').textContent='복사 완료';}catch{$('#invite').select();notice('초대 링크를 복사해주세요.');}};
 function btn(text,fn,disabled=false,cls=''){const b=el('button',text,cls);b.disabled=disabled;b.onclick=fn;return b;}
 function controls(...children){const d=el('div',undefined,'controls');d.append(...children);return d;}
 function label(t){return el('p',t,'caption');}
 function card(t,sub){const d=el('div',undefined,'playing-card');d.append(el('small',sub),el('b',String(t??'?')));return d;}
 function name(s){const id=state.game?.players[s];return state.members.find(p=>p.id===id)?.nick||`${s+1}번`;}
 function choose(i,max=3){if(selected.includes(i))selected=selected.filter(n=>n!==i);else if(selected.length<max)selected.push(i);renderGame();}
 function render(){const g=state.game,host=state.host===creds.id,self=state.members.find(p=>p.id===creds.id);$('#join').disabled=joined;$('#watch').disabled=joined;$('#seat').disabled=!joined||!!g;$('#start').disabled=!host||!!g||state.members.filter(p=>p.seat>=0&&p.online).length<meta.players;$('#sendChat').disabled=!joined;$('#status').textContent=(host?'내가 방장 · ':'')+(g?g.finished?'경기 종료':g.paused?'선수 재접속 대기':'대결 중':'대기실')+' · 접속 '+state.members.filter(p=>p.online).length+'명';
 $('#members').replaceChildren(...state.members.map(p=>el('span',p.nick+' · '+(p.seat<0?'관전':kind==='strategyyut'&&p.seat>1?(p.seat-1)+'번 조력자':(p.seat+1)+'번 선수')+(p.online?'':' · 연결 끊김'),'member')));
 $('#rematch').hidden=$('#lobby').hidden=!g?.finished||!host;$('#resign').hidden=!g||g.finished||g.seat<0;$('#draw').hidden=!g||g.finished||g.seat<0||g.seat>1;$('#draw').textContent=state.drawOffer===1-g?.seat?'무승부 수락':'무승부 제안';
 const seq=g?.id+':'+g?.sequence;if(seq!==lastSeq){lastSeq=seq;selected=[];from=null;drop=null;draft=[];notice('');}
 const log=$('#chatlog'),bottom=log.scrollHeight-log.scrollTop-log.clientHeight<60;log.replaceChildren(...state.chat.map(m=>{const d=el('div',undefined,'message');d.append(el('b',m.nick),el('span',m.text));return d;}));if(bottom)log.scrollTop=log.scrollHeight;
 $('#history').replaceChildren(...(g?.log||[]).slice().reverse().map(t=>el('p',t)));$('#score').replaceChildren();if(g)for(let s=0;s<2;s++){const d=el('div',undefined,'scorebox');d.append(el('span',name(s)),el('b',g.chips?g.chips[s]+'칩':g.scores[s]+'점'));$('#score').append(d);}
 $('#phase').textContent=g?(kind==='matgo'?(g.moves+1)+'번째 차례 · ':g.round+' ROUND · ')+({choosehand:'바닥 패 선택',chooseflip:'뒤집은 패 짝 선택',gostop:'고 / 스톱',gukjin:'국진 선택',play:'대결',between:'라운드 결과',finished:'최종 결과',memorize:'기억하세요',peek:'힌트 공개',buzz:'버저 대기',answer:'정답 입력',bonus:'결 추가 기회',open:'카드 공개',mulligan:'첫 패 선택',exchange:'교환',role:'역할 선택',fight:'비밀 제출',bet:'예측',choose:'윷 선택',move:'말 이동',reveal:'결과 공개'}[g.phase]||g.phase):'WAITING';
 $('#turn').textContent=!g?'친구를 초대해 주세요.':g.finished?g.winner===null?'무승부':name(g.winner)+' 승리!':g.paused?'선수가 돌아오면 이어서 진행해요':g.turn<0?'먼저 버저를 누르세요':name(g.turn)+' 차례'+(g.seat===g.turn?' · 내 차례!':'');const paintKey=JSON.stringify([g,joined]);if(paintKey!==lastGamePaint){lastGamePaint=paintKey;renderGame();}clock();}
 function renderGame(){const root=$('#game');root.replaceChildren();const g=state?.game;if(!g)return;const s=g.seat,active=joined&&s>=0&&!g.finished&&!g.paused,my=active&&g.turn===s;
 if(kind==='matgo'){renderMatgo(root,g,{action,my,active,name});return;}
 if(g.finished)root.append(el('p',g.reason,'helpbox'));
 if(kind==='blackwhite'){
  root.append(label('상대 숫자는 숨겨져요. 짝수=흑 / 홀수=백.'),controls(...g.colors.map((c,i)=>card(c===null?'대기':c?'백':'흑',name(i)+' 제출'))));
  root.append(controls(...g.hand.map(n=>btn(String(n),()=>action({op:'tile',value:n}),!my,'tile '+(n%2?'white':'black')))));
  for(const [i,h]of g.history.entries())root.append(label((i+1)+'회 · '+h.colors.map(c=>c?'백':'흑').join(' / ')+' · '+(h.winner===null?'무승부':name(h.winner)+' 승')+(h.mine!==null?' · 내 숫자 '+h.mine:'')));
 }
 if(['indian','doublepoker'].includes(kind)){
  for(let p=0;p<2;p++)root.append(card(Array.isArray(g.cards[p])?g.cards[p].map(n=>n??'?').join(' / '):g.cards[p],name(p)+(kind==='doublepoker'?' 앞 / 뒤':' 카드')));
  root.append(label('팟 '+g.pot+'칩 · 총 베팅 '+g.bet.join(' / ')));
  if(g.phase==='between'){root.append(btn(g.ready[s]?'상대 준비 대기':'다음 라운드',()=>action({op:'ready'}),!active||g.ready[s]));return;}
  const sideSelect=el('select');sideSelect.setAttribute('aria-label','베팅 면');for(const[i,t]of ['앞면','뒷면'].entries()){const o=el('option',t);o.value=i;sideSelect.append(o);}sideSelect.value=g.sides[s]??side;sideSelect.disabled=!my||g.sides[s]!==null;sideSelect.onchange=()=>side=Number(sideSelect.value);if(kind==='doublepoker')root.append(sideSelect);
  const amount=el('input');amount.type='number';amount.min=Math.max(...g.bet)+1;amount.value=amount.min;amount.setAttribute('aria-label','레이즈 총액');
  root.append(controls(btn('콜 · 공개',()=>action({op:'call',side}),!my),amount,btn('총액으로 레이즈',()=>action({op:'raise',amount:Number(amount.value),side}),!my),btn('폴드',()=>action({op:'fold',side}),!my,'secondary')));
  if(kind==='doublepoker')root.append(controls(btn('양면 승부 · 즉시 공개',()=>action({op:'double'}),!my||g.sides[1-s]===null)));
 }
 if(kind==='gyulhap'){
  const grid=el('div',undefined,'grid three');g.cards.forEach((c,i)=>{const b=btn('',()=>choose(i),!my||g.phase!=='answer','tile'+(selected.includes(i)?' selected':''));b.style.background=['#eee8d9','#454659','#142128'][c[2]];const glyph=el('span',['●','▲','■'][c[0]],'glyph');glyph.style.color=['#f04b51','#f2bc22','#388be8'][c[1]];b.append(el('small',String(i+1)),glyph);grid.append(b);});root.append(grid,label('확인한 합: '+(g.found.map(k=>k.split(',').map(n=>Number(n)+1).join('·')).join(' / ')||'없음')));
  root.append(controls(btn('합! 입력 시작',()=>action({op:'claim'}),!my||g.phase!=='play'),btn('선택한 3장 제출',()=>action({op:'hap',ids:selected}),!my||g.phase!=='answer'||selected.length!==3),btn('결! 더 이상 없음',()=>action({op:'gyul'}),!my||g.phase==='answer'),btn('패스',()=>action({op:'pass'}),!my,'secondary')));
 }
 if(kind==='twelve'){
  const grid=el('div',undefined,'grid three board12');const names={K:'王',R:'將',E:'相',P:'子',H:'侯'},arrows={K:'↖ ↑ ↗ ← → ↙ ↓ ↘',R:'↑ ← → ↓',E:'↖ ↗ ↙ ↘',P:'↑',H:'↖ ↑ ↗ ← → ↓'};
  g.board.forEach((p,i)=>{const b=btn('',()=>{if(drop!==null){action({op:'drop',index:drop,to:i});return;}if(p?.s===s){from=i;renderGame();}else if(from!==null)action({op:'move',from,to:i});},!my,'tile '+(p?'owner'+p.s:'empty')+(from===i?' selected':''));if(p){b.append(el('span',names[p.t]),el('small',arrows[p.t]));if(p.s===1)b.style.transform='rotate(180deg)';}else b.textContent='·';grid.append(b);});root.append(grid);
  if(s>=0)root.append(label('내 포로 · 선택 후 빈칸에 배치'),controls(...g.captured[s].map((t,i)=>btn(names[t],()=>{drop=i;from=null;renderGame();},!my,'tile'+(drop===i?' selected':'')))));
 }
 if(['pictures','numbers'].includes(kind)){
  const symbols=['☀','☂','★','♥','♠','♦','♣','☾','♫','⚑','✿','☕','⚓','♜','☁','⚡'];const grid=el('div',undefined,'grid');g.board.forEach((v,i)=>{const text=v===null?String.fromCharCode(65+i):kind==='pictures'?symbols[v]:String(v);const b=btn(text,()=>kind==='pictures'?action({op:'picture',index:i}):choose(i),!active||(kind==='pictures'?(!my||g.phase!=='play'):(!my||g.phase!=='answer')),'tile'+(selected.includes(i)?' selected':''));b.append(el('small',String.fromCharCode(65+i)));grid.append(b);});root.append(grid);
  if(kind==='pictures')for(let p=0;p<2;p++){root.append(label(name(p)+' · '+g.positions[p]+'/20'));const path=el('div',undefined,'path');g.belts[p].forEach((v,i)=>path.append(el('span',symbols[v],i===g.positions[p]?'current':'')));root.append(path);}
  else{root.prepend(el('h2','목표 숫자: '+(g.target??'기억하세요')));root.append(controls(btn('버저!',()=>action({op:'buzz'}),!active||g.phase!=='buzz'),btn('수식 제출 '+selected.map(i=>String.fromCharCode(65+i)).join(' → '),()=>action({op:'formula',ids:selected}),!my||g.phase!=='answer'||selected.length!==3),btn('패스',()=>action({op:'pass'}),!my||g.phase!=='answer','secondary')));}
 }
 if(kind==='quattro'){
  for(let p=0;p<2;p++){root.append(label(name(p)+'의 패'));const cards=el('div',undefined,'cards-row');g.hands[p].forEach((c,i)=>{const b=btn(c?['빨강','파랑','노랑','초록','무색'][c.c]+' '+c.n:'?',()=>{if(g.phase==='open')action({op:'open',index:i});else{selected=[i];renderGame();}},!active||p!==s||g.open[p].includes(i)||!['open','exchange'].includes(g.phase),'tile swatch'+c?.c+(selected[0]===i&&p===s?' selected':''));b.append(el('small',g.open[p].includes(i)?'공개':'비공개'));cards.append(b);});root.append(cards);}
  if(g.phase==='mulligan')root.append(controls(btn('멀리건 '+(g.mulligans[s]??0)+'/2',()=>action({op:'mulligan'}),!active||g.ready[s]||g.mulligans[s]>=2),btn('이 패로 시작',()=>action({op:'ready'}),!active||g.ready[s])));
  if(g.phase==='exchange'){root.append(label('내 비공개 카드 선택 → 교환소 선택'));root.append(controls(...Array.from({length:6},(_,i)=>btn('교환소 '+(i+1)+(g.used[s]?.includes(i)?' ✓':''),()=>action({op:'exchange',shop:i,index:selected[0]}),!my||selected.length!==1||g.used[s]?.includes(i)))));root.append(btn('교환 마침 · 다음 카드 공개',()=>action({op:'pass'}),!my));}
 }
 if(kind==='rpsbet'){
  const hands=['바위 ✊','보 ✋','가위 ✌'];root.append(card(g.opponent===null?'?':hands[g.opponent],'가상 상대 · 예측 선수에게만 공개'));
  if(g.phase==='role')root.append(controls(btn('직접 승부',()=>action({op:'fight'}),!my),btn('상대 승부 예측',()=>action({op:'predict'}),!my)));
  if(g.phase==='fight')root.append(controls(...hands.map((h,i)=>btn(h,()=>action({op:'hand',value:i}),!my))));
  if(g.phase==='bet'){const amount=el('input');amount.type='number';amount.min=g.chips[s]?1:0;amount.max=g.chips[s]??0;amount.value=amount.min;amount.setAttribute('aria-label','예측 베팅 칩');root.append(amount,controls(...['win','draw','lose'].map((v,i)=>btn(['승리 예상','무승부 예상','패배 예상'][i],()=>action({op:'predict',value:v,amount:Number(amount.value)}),!my))));}
 }
 if(kind==='monorail'){
  const shapes=[[0,2],[1,3],[0,1],[1,2],[2,3],[0,3]],glyphs=['│','─','└','┌','┐','┘'];root.append(label('모양 선택 → 빈칸에 1~3개 배치 → 확정. 여러 개는 일렬로 놓아주세요.'),controls(...glyphs.map((t,i)=>btn(t,()=>{rotation=i;renderGame();},!my,'tile'+(rotation===i?' selected':'')))));
  const all=[...g.tiles,...draft],xmin=Math.min(...all.map(t=>t.x))-1,xmax=Math.max(...all.map(t=>t.x))+1,ymin=Math.min(...all.map(t=>t.y))-1,ymax=Math.max(...all.map(t=>t.y))+1;const scroll=el('div',undefined,'rail-scroll'),grid=el('div',undefined,'railgrid');grid.style.gridTemplateColumns=`repeat(${xmax-xmin+1},42px)`;
  for(let y=ymin;y<=ymax;y++)for(let x=xmin;x<=xmax;x++){const old=g.tiles.find(t=>t.x===x&&t.y===y),tmp=draft.find(t=>t.x===x&&t.y===y),t=old||tmp;const glyph=t?glyphs[shapes.findIndex(d=>[...t.d].sort().join()===[...d].sort().join())]:'+';const b=btn(glyph,()=>{if(tmp)draft=draft.filter(t=>t!==tmp);else if(draft.length<Math.min(3,g.left))draft.push({x,y,d:shapes[rotation]});renderGame();},!my||!!old,old&&g.tiles.indexOf(old)<2?'station':tmp?'draft':'secondary');b.setAttribute('aria-label',`철로 ${x},${y} ${glyph}`);grid.append(b);}scroll.append(grid);root.append(scroll,label('남은 타일 '+g.left+'개'+(g.challenge!==null?' · 불가능 선언에 대한 완성 도전':'')),controls(btn('배치 확정 ('+draft.length+')',()=>action({op:'lay',tiles:draft}),!my||!draft.length),btn('선택 취소',()=>{draft=[];renderGame();},!my,'secondary'),btn(g.challenge===null?'불가능 선언':'불가능 인정',()=>action({op:g.challenge===null?'impossible':'concede'}),!my||draft.length>0,'secondary')));
 }
 if(kind==='strategyyut'){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 420 420');svg.setAttribute('class','strategy-board');svg.setAttribute('role','img');svg.setAttribute('aria-label','전략 윷놀이 말 위치');
  const coords={};for(let n=1;n<=5;n++)coords[n]=[370,370-n*64];for(let n=6;n<=10;n++)coords[n]=[370-(n-5)*64,50];for(let n=11;n<=15;n++)coords[n]=[50,50+(n-10)*64];for(let n=16;n<=20;n++)coords[n]=[50+(n-15)*64,370];Object.assign(coords,{21:[317,103],22:[263,157],23:[210,210],24:[157,263],25:[103,317],26:[103,103],27:[157,157],28:[263,263],29:[317,317]});
  const shape=(tag,attrs,text)=>{const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;svg.append(e);return e;};
  shape('path',{d:'M370 370 V50 H50 V370 Z M50 50 L370 370 M370 50 L50 370',fill:'none',stroke:'#62634d','stroke-width':3});
  for(const[n,[x,y]]of Object.entries(coords)){shape('circle',{cx:x,cy:y,r:Number(n)%5===0||n==='23'?20:16,fill:'#222a25',stroke:'#9fae88','stroke-width':2});shape('text',{x,y:y+4,'text-anchor':'middle',fill:'#becbb0','font-size':11},n);}
  const colors=['#edb47a','#86bdf0','#f1d699','#b1d8f3'];for(let p=0;p<4;p++)for(let i=0;i<2;i++){const pos=g.pieces[p][i].pos;if(!coords[pos])continue;const[x,y]=coords[pos],offset=(p-1.5)*8;shape('circle',{cx:x+offset,cy:y-9+i*18,r:10,fill:colors[p],stroke:'#111','stroke-width':1.5});shape('text',{x:x+offset,y:y-5+i*18,'text-anchor':'middle',fill:'#111','font-size':10,'font-weight':700},String(p+1));}root.append(svg);
  root.append(label('진행 순서: 대결자1 → 조력자1 → 대결자2 → 조력자2. 매번 네 명 모두 비밀 선택해요.'));
  if(g.phase==='choose')root.append(controls(btn('윷 선택 (1)',()=>action({op:'stick',value:1}),!active||g.submitted[s]),btn('모 선택 (0)',()=>action({op:'stick',value:0}),!active||g.submitted[s])),label('제출: '+g.submitted.map((v,i)=>name(i)+(v?' ✓':' …')).join(' / ')));
  if(g.lastChoices)root.append(label('지난 선택 '+g.lastChoices.map(n=>n?'윷':'모').join(' · ')));if(g.steps!==null)root.append(el('h2',({[-1]:'빽도',2:'개',3:'걸',4:'윷',5:'모'})[g.steps]+' · '+name(g.turn)+' 말 이동'));
  for(let p=0;p<4;p++)root.append(label(name(p)),controls(...g.pieces[p].map((piece,i)=>btn('말 '+(i+1)+' · '+(piece.pos===-1?'대기':piece.pos===30?'완주':piece.pos+'번 칸'),()=>action({op:'move',index:i,shortcut:$('#shortcut').checked}),!my||p!==s||g.phase!=='move'||piece.pos===30,'tile'))));
  const lab=el('label',' 지름길 사용');const check=el('input');check.type='checkbox';check.id='shortcut';check.checked=true;lab.prepend(check);root.append(lab,el('p','바깥길 1~20 · 5→21→22→23→24→25→15 / 10→26→27→23→28→29→20 · 23 중앙 출발은 28로 이동','helpbox'));
 }
 }
 function clock(){const g=state?.game;$('#timer').textContent=g?.paused?'PAUSED':g?.deadline?Math.max(0,(g.deadline-Date.now()-clockOffset)/1000).toFixed(1)+'s':'';}
 setInterval(clock,100);connect();
}
