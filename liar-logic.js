import {randomInt,randomUUID} from 'node:crypto';
export const topics={
  '음식':['김치찌개','떡볶이','피자','초밥','라면','삼겹살','비빔밥','치킨','아이스크림','붕어빵','김밥','팝콘','햄버거','만두','수박','케이크'],
  '장소':['도서관','놀이공원','공항','영화관','수영장','편의점','학교','병원','해수욕장','캠핑장','동물원','미용실','노래방','박물관','지하철역','헬스장'],
  '동물':['고양이','강아지','기린','펭귄','코끼리','토끼','돌고래','판다','호랑이','햄스터','다람쥐','악어','부엉이','낙타','문어','거북이'],
  '물건':['우산','스마트폰','냉장고','칫솔','이어폰','가방','선풍기','안경','시계','거울','베개','리모컨','드라이어','연필','지갑','세탁기'],
  '취미·활동':['캠핑','등산','수영','낚시','볼링','요리','독서','사진촬영','자전거','스케이트','영화감상','노래하기','그림그리기','여행','축구','야구']
};
const clean=s=>String(s??'').normalize('NFC').replace(/\s/g,'');
export function createGame(players,category='랜덤',rounds=2){
 if(players.length<4||players.length>10)throw Error('4~10명이 필요해요.');
 const names=Object.keys(topics),chosen=topics[category]?category:names[randomInt(names.length)];
 const order=[...players];for(let i=order.length-1;i>0;i--){const j=randomInt(i+1);[order[i],order[j]]=[order[j],order[i]];}
 return {id:randomUUID(),players:order,liar:order[randomInt(order.length)],word:topics[chosen][randomInt(topics[chosen].length)],category:chosen,rounds,phase:'hint',hints:[],votes:{},voteRound:0,candidates:[...order],tally:null,winner:null,reason:'',guess:null,accused:null};
}
export const turn=g=>g.phase==='hint'?g.players[g.hints.length%g.players.length]:null;
export function hint(g,id,text,sequence,skip=false){
 if(g.phase!=='hint'||turn(g)!==id||sequence!==g.hints.length)throw Error('현재 차례를 확인해주세요.');
 text=String(text??'').trim();if(!skip&&(!text||text.length>100))throw Error('힌트를 1~100자로 적어주세요.');
 if(!skip&&clean(text).includes(clean(g.word)))throw Error('제시어를 직접 적지 말고 간접적으로 설명해주세요.');
 g.hints.push({id,text:skip?'연결 끊김 · 힌트 건너뜀':text,round:Math.floor(g.hints.length/g.players.length)+1,skip});
 if(g.hints.length===g.players.length*g.rounds)g.phase='discussion';
}
export function openVote(g){if(g.phase!=='discussion')throw Error('힌트를 모두 작성한 뒤 투표할 수 있어요.');g.phase='vote';g.voteStarted=Date.now();}
function finish(g,winner,reason){g.phase='finished';g.winner=winner;g.reason=reason;}
export function resolveVotes(g){
 const counts=Object.fromEntries(g.candidates.map(id=>[id,0]));for(const target of Object.values(g.votes))if(target)counts[target]++;
 g.tally=counts;const high=Math.max(...Object.values(counts));const tied=g.candidates.filter(id=>counts[id]===high);
 if(high===0){finish(g,'liar','유효한 표가 없어 라이어가 살아남았어요.');return;}
 if(tied.length>1){if(g.voteRound===0){g.voteRound=1;g.candidates=tied;g.votes={};g.voteStarted=Date.now();}else finish(g,'liar','재투표도 동률! 라이어가 살아남았어요.');return;}
 g.accused=tied[0];if(g.accused===g.liar){g.phase='guess';g.guessStarted=Date.now();}else finish(g,'liar','시민을 지목해 라이어가 살아남았어요.');
}
export function vote(g,id,target,voteRound){
 if(g.phase!=='vote'||g.voteRound!==voteRound||!g.players.includes(id)||!g.candidates.includes(target)||id===target)throw Error('투표 대상을 확인해주세요. 자신에게 투표할 수 없어요.');
 if(Object.hasOwn(g.votes,id))throw Error('이미 투표했어요.');g.votes[id]=target;
 if(g.players.every(p=>Object.hasOwn(g.votes,p)))resolveVotes(g);
}
export function finalGuess(g,id,text){
 if(g.phase!=='guess'||id!==g.liar)throw Error('지목된 라이어만 정답을 맞힐 수 있어요.');
 text=String(text??'').trim();if(!text||text.length>30)throw Error('정답을 1~30자로 입력해주세요.');g.guess=text;
 finish(g,clean(text)===clean(g.word)?'liar':'citizens',clean(text)===clean(g.word)?'라이어가 제시어를 맞혀 역전했어요!':'라이어가 제시어를 맞히지 못했어요. 시민 승리!');
}
export function abandonGuess(g){if(g.phase!=='guess')throw Error('최종 추측 단계가 아니에요.');finish(g,'citizens','라이어가 연결을 복구하지 못해 시민이 승리했어요.');}
export function view(g,id){
 if(!g)return null;
 // Explicit allowlist: never spread the secret-bearing game into a response.
 const done=g.phase==='finished';return {id:g.id,players:g.players,category:g.category,rounds:g.rounds,phase:g.phase,hints:g.hints,turn:turn(g),role:id===g.liar?'liar':'citizen',word:id!==g.liar||done?g.word:null,liar:done?g.liar:null,voteRound:g.voteRound,candidates:g.candidates,voted:Object.keys(g.votes),myVote:g.votes[id]??null,tally:g.tally,accused:g.accused,winner:g.winner,reason:g.reason,guess:done?g.guess:null};
}
