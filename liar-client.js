// Application heartbeat also works through proxies that answer protocol pings.
function attachClientHeartbeat(socket) {
  let lastSeen=Date.now();
  const beat=()=>{if(Date.now()-lastSeen>60000){socket.close();return;}if(socket.readyState===1)socket.send(JSON.stringify({type:'heartbeat'}));};
  socket.addEventListener('open',()=>{lastSeen=Date.now();beat();});
  socket.addEventListener('message',()=>{lastSeen=Date.now();});
  const timer=setInterval(beat,20000);
  socket.addEventListener('close',()=>clearInterval(timer),{once:true});
}
const $=s=>document.querySelector(s);
let room=new URLSearchParams(location.search).get('room');if(!room){room=crypto.randomUUID();history.replaceState(null,'','?room='+room);}$('#invite').value=location.href;
const key='liar-'+room;
function read(){try{return JSON.parse(localStorage.getItem(key)||sessionStorage.getItem(key)||'null')}catch{return null}}
function save(){const s=JSON.stringify(me);try{localStorage.setItem(key,s)}catch{}try{sessionStorage.setItem(key,s)}catch{}}
let me=read();if(!me||typeof me.id!=='string')me={id:crypto.randomUUID()};save();if(me.nick)$('#nick').value=me.nick;
let ws,state=null,joined=false,wantJoin=!!me.token,showRole=false,gameId=null,phaseKey=null,lastChat='',lastHints='',lastPlayers='',lastCandidates='';
const show=(id,yes)=>$(id).classList.toggle('hidden',!yes);const notice=t=>$('#notice').textContent=t;
function send(m){if(ws?.readyState===1)ws.send(JSON.stringify(m));else notice('서버에 다시 연결 중이에요.');}
function action(type,extra={}){notice('');send({type,gameId:state?.game?.id,...extra});}
function connect(){ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/liar-ws?room='+room);attachClientHeartbeat(ws);
 ws.onopen=()=>{if(wantJoin)send({type:'join',...me,nick:me.nick});else{$('#join').disabled=false;$('#status').textContent='닉네임을 입력하고 입장하세요.';}};
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==='joined'){joined=true;wantJoin=true;me.token=m.token;save();$('#join').disabled=true;}else if(m.type==='state')render(m);else if(m.type==='error'){notice(m.error);if(!joined)$('#join').disabled=false;}};
 ws.onclose=e=>{joined=false;$('#join').disabled=true;for(const id of ['start','sendHint','sendVote','sendGuess','sendChat'])$('#'+id).disabled=true;$('#status').textContent='연결이 끊겨 복귀 중…';if(e.reason==='Reconnected'){notice('다른 창에서 접속했어요. 이 창을 닫아주세요.');return;}if(e.code!==1008)setTimeout(connect,2000);};}
function role(){const g=state?.game;$('#reveal').disabled=!g;$('#reveal').textContent=showRole?'역할 숨기기':'역할 확인하기';$('#roleTitle').textContent=!g?'당신은 누구인가요?':!showRole?'쉿, 나만 확인하세요':g.role==='liar'?'당신은 라이어!':'당신은 시민';$('#roleWord').textContent=!g?'게임이 시작되면 역할이 배정돼요.':!showRole?'아래 버튼으로 내 역할과 제시어를 확인하세요.':g.role==='liar'&&g.phase!=='finished'?'제시어를 모릅니다. 힌트를 듣고 자연스럽게 섞여보세요.':'제시어: '+g.word;$('#topicLabel').textContent=g?'주제 · '+g.category:'SECRET IDENTITY';}
function render(m){state=m;const g=m.game,host=m.host===me.id,name=id=>m.members.find(p=>p.id===id)?.nick||'참가자';
 if(gameId!==(g?.id||null)){gameId=g?.id||null;showRole=false;$('#hint').value='';$('#finalGuess').value='';lastCandidates='';notice('');}
 const nextPhase=g?.id+':'+g?.phase+':'+g?.voteRound+':'+g?.hints.length;if(nextPhase!==phaseKey){phaseKey=nextPhase;notice('');}
 $('#category').value=m.category;$('#rounds').value=m.rounds;$('#category').disabled=!host||!!g;$('#rounds').disabled=!host||!!g;$('#start').disabled=!host||!!g||m.members.filter(p=>p.online).length<4;
 $('#status').textContent=(g?g.phase==='finished'?'게임 종료':'게임 중':'대기실')+' · '+m.members.filter(p=>p.online).length+'/10명'+(host?' · 내가 방장입니다':'');
 const players=JSON.stringify([m.members,g?.turn,g?.voted,m.host]);if(players!==lastPlayers){lastPlayers=players;$('#players').replaceChildren(...m.members.map(p=>{const d=document.createElement('div');d.className='player'+(g?.turn===p.id?' active':'');const b=document.createElement('b');b.textContent=p.nick+(p.id===me.id?' (나)':'');const s=document.createElement('small');s.textContent=(!p.online?'연결 끊김':p.id===m.host?'방장':'접속 중')+(g?.phase==='vote'&&g.voted.includes(p.id)?' · 투표 완료':'');d.append(b,s);return d;}));}
 role();const mine=g?.phase==='hint'&&g.turn===me.id;const labels={hint:'힌트 작성',discussion:'자유 토론',vote:g?.voteRound?'동률 · 재투표':'비밀 투표',guess:'라이어의 마지막 기회',finished:'결과 발표'};
 $('#phase').textContent=g?labels[g.phase]:'WAITING ROOM';$('#turnTitle').textContent=!g?'친구들을 기다리고 있어요':g.phase==='hint'?(mine?'내 차례!':name(g.turn)+'님의 차례')+' · '+(Math.floor(g.hints.length/g.players.length)+1)+'바퀴째':labels[g.phase];
 $('#help').textContent=!g?'4명 이상 모이면 방장이 시작할 수 있어요.':g.phase==='hint'?'제시어를 직접 말하지 말고, 자연스럽게 힌트를 주세요.':g.phase==='discussion'?'채팅으로 의심되는 사람을 이야기해요. 모두 준비되면 방장이 투표를 시작합니다.':g.phase==='vote'?'누가 모르는 척했을까요? 제출한 표는 집계 전까지 비밀이에요.':g.phase==='guess'?name(g.accused)+'님이 라이어였습니다. 제시어를 맞힐 마지막 기회!':'정체와 제시어가 공개됐어요. 다시 한 판?';
 show('#hintForm',mine);$('#sendHint').disabled=!mine;show('#skipHint',host&&m.canSkipHint);show('#openVote',host&&g?.phase==='discussion');show('#voteForm',g?.phase==='vote');show('#finishVote',host&&m.canFinishVote);show('#guessForm',g?.phase==='guess'&&g.role==='liar');$('#sendGuess').disabled=!(g?.phase==='guess'&&g.role==='liar');show('#finishGuess',host&&m.canFinishGuess);
 if(g?.phase==='vote'){const candidates=g.id+':'+g.voteRound+':'+g.candidates.join();if(candidates!==lastCandidates){lastCandidates=candidates;$('#suspect').replaceChildren(...[{id:'',nick:'의심되는 사람 선택'},...g.candidates.filter(id=>id!==me.id).map(id=>({id,nick:name(id)}))].map(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.nick;return o;}));}const voted=g.voted.includes(me.id);$('#suspect').disabled=voted;$('#sendVote').disabled=voted;$('#voteStatus').textContent=g.voted.length+'/'+g.players.length+'명 투표 완료'+(voted?' · 내 투표: '+name(g.myVote):'');}
 show('#result',g?.phase==='finished');$('#winner').textContent=g?.winner==='liar'?'라이어 승리!':'시민 승리!';$('#resultText').textContent=g?.phase==='finished'?g.reason+' 제시어: '+g.word+' · 라이어: '+name(g.liar)+(g.guess?' · 마지막 답: '+g.guess:''):'';show('#rematch',host);show('#lobby',host);
 const hints=JSON.stringify(g?.hints||[]);if(hints!==lastHints){lastHints=hints;$('#hintCount').textContent=(g?.hints.length||0)+'개';$('#hints').replaceChildren(...(g?.hints||[]).map(h=>{const d=document.createElement('div');d.className='hintentry';const b=document.createElement('b');b.textContent=h.round+'바퀴 · '+name(h.id);const p=document.createElement('p');p.textContent=h.text;d.append(b,p);return d;}));}
 $('#tally').textContent=g?.tally?'최근 집계: '+Object.entries(g.tally).map(([id,n])=>name(id)+' '+n+'표').join(' · '):'';
 $('#chat').disabled=!joined;$('#sendChat').disabled=!joined;const chats=JSON.stringify(m.chat);if(chats!==lastChat){lastChat=chats;const log=$('#chatlog'),bottom=log.scrollHeight-log.scrollTop-log.clientHeight<60;log.replaceChildren(...m.chat.map(c=>{const d=document.createElement('div');d.className='message';const b=document.createElement('b');b.textContent=c.nick;const s=document.createElement('span');s.textContent=c.text;d.append(b,s);return d;}));if(bottom)log.scrollTop=log.scrollHeight;}
}
$('#join').onclick=()=>{const nick=$('#nick').value.trim();if(!nick){notice('닉네임을 입력해주세요.');return;}me.nick=nick;save();send({type:'join',...me});};$('#nick').onkeydown=e=>{if(e.key==='Enter'&&!$('#join').disabled)$('#join').click();};
for(const id of ['category','rounds'])$('#'+id).onchange=()=>{if(joined)send({type:'config',category:$('#category').value,rounds:Number($('#rounds').value)});};
$('#start').onclick=()=>action('start');$('#rematch').onclick=()=>action('rematch');$('#lobby').onclick=()=>action('lobby');$('#reveal').onclick=()=>{showRole=!showRole;role();};
$('#hintForm').onsubmit=e=>{e.preventDefault();if(!$('#hint').value.trim())return;action('hint',{text:$('#hint').value,sequence:state.game.hints.length});$('#hint').value='';};
$('#openVote').onclick=()=>action('openVote');$('#skipHint').onclick=()=>action('skipHint',{sequence:state.game.hints.length});$('#finishVote').onclick=()=>action('finishVote');$('#finishGuess').onclick=()=>action('finishGuess');
$('#voteForm').onsubmit=e=>{e.preventDefault();action('vote',{target:$('#suspect').value,voteRound:state.game.voteRound});};$('#guessForm').onsubmit=e=>{e.preventDefault();action('guess',{text:$('#finalGuess').value});};
$('#chatForm').onsubmit=e=>{e.preventDefault();if(!joined)return;send({type:'chat',text:$('#chat').value});$('#chat').value='';};$('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);$('#copy').textContent='복사 완료!';}catch{$('#invite').select();notice('초대 링크를 길게 눌러 복사해주세요.');}};
connect();
