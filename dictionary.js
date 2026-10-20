import {readFileSync} from 'node:fs';
const snapshot=JSON.parse(readFileSync(new URL('./dictionary-data.json',import.meta.url),'utf8'));
const offlineWords=new Set(snapshot.words);
export const dictionaryInfo={source:snapshot.source,snapshot:snapshot.snapshot,wordCount:offlineWords.size,sourceEntries:snapshot.sourceEntries};
const unavailable='사전에 연결하지 못했어요. 남은 시간은 유지돼요. 다시 시도해주세요.';
export function createDictionary({key,fetchImpl=fetch,timeout=4000,clock=Date.now}={}){
 const cache=new Map(),pending=new Map();
 return async function lookup(word){
  if(!/^[가-힣]{2}$/.test(word))return false;
  if(!key)throw Error('우리말샘 인증키 연결이 필요해요. 현재는 기본 단어장만 사용할 수 있어요.');
  const hit=cache.get(word);if(hit&&hit.until>clock())return hit.found;
  if(pending.has(word))return pending.get(word);
  const task=(async()=>{
   try{
    const url=new URL('https://opendict.korean.go.kr/api/search');
    url.search=new URLSearchParams({key,q:word,req_type:'json',advanced:'y',target:'1',method:'exact',type1:'word',type2:'all',type3:'all',type4:'all',pos:'0',num:'100'});
    const response=await fetchImpl(url,{signal:AbortSignal.timeout(timeout)});
    if(!response.ok)throw Error();
    const data=await response.json();
    if(data.error||!data.channel||!Number.isFinite(Number(data.channel.total)))throw Error();
    const items=data.channel.item||[];
    if(!Array.isArray(items))throw Error();
    const found=items.some(item=>typeof item.word==='string'&&item.word.normalize('NFC').replace(/[-^]/g,'')===word);
    if(cache.size>=10000)cache.delete(cache.keys().next().value);
    cache.set(word,{found,until:clock()+(found?86400000:300000)});
    return found;
   }catch{throw Error(unavailable);}finally{pending.delete(word);}
  })();
  pending.set(word,task);return task;
 };
}
export const dictionaryEnabled=true;
const remoteLookup=process.env.OPENDICT_API_KEY?createDictionary({key:process.env.OPENDICT_API_KEY}):null;
export async function lookupWord(word){
 const value=String(word||'').trim().normalize('NFC');
 if(!/^[가-힣]{2}$/.test(value))return false;
 if(offlineWords.has(value))return true;
 return remoteLookup?remoteLookup(value):false;
}
