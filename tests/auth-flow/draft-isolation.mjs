import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync('qb-cloud.js','utf8');
class Storage { getItem(k){return this[k]??null} setItem(k,v){this[k]=String(v)} removeItem(k){delete this[k]} }
function setup({quota=false}={}){
 const localStorage=new Storage(),sessionStorage=new Storage();
 if(quota)Object.defineProperty(localStorage,'setItem',{value:function(k,v){if(k.startsWith('qb_saved_user:'))throw new Error('QuotaExceededError');this[k]=String(v)}});
 const window={location:{origin:'http://localhost:4337',hostname:'localhost',pathname:'/account',search:'',hash:''},addEventListener(){},dispatchEvent(){}};
 vm.runInNewContext(source,{window,localStorage,sessionStorage,URL,Headers,Response,fetch:async()=>new Response('[]'),CustomEvent:class{},setTimeout});
 return {QB:window.QB,ls:localStorage,ss:sessionStorage};
}
let failures=0;
function test(name,fn){try{fn();console.log('PASS',name)}catch(e){failures++;console.log('FAIL',name,e.message)}}
const A={userId:'A',token:'a'},B={userId:'B',token:'b'};
test('actual Soul Map answers are removed from the active account on logout',()=>{const{QB,ls}=setup();QB.setSession(A);ls.setItem('qb-soul-map-local','private answers');QB.logout();assert.equal(ls.getItem('qb-soul-map-local'),null);QB.setSession(B);assert.equal(ls.getItem('qb-soul-map-local'),null);});
test('direct account switch restores the destination account draft',()=>{const{QB,ls}=setup();QB.setSession(B);ls.setItem('qb_visualdna_session_v1','draft B');QB.logout();QB.setSession(A);ls.setItem('qb_visualdna_session_v1','draft A');QB.setSession(B);assert.equal(ls.getItem('qb_visualdna_session_v1'),'draft B');QB.logout();QB.setSession(A);assert.equal(ls.getItem('qb_visualdna_session_v1'),'draft A');});
test('full local storage still signs out and retains the owner draft in the tab',()=>{const{QB,ls}=setup({quota:true});QB.setSession(A);ls.setItem('qb_qbp','{"brandName":"Draft A"}');QB.logout();assert.equal(QB.isAuthed(),false);assert.equal(ls.getItem('qb_qbp'),null);QB.setSession(A);assert.equal(QB.getQBP().brandName,'Draft A');});
test('new anonymous work wins over an older saved draft',()=>{const{QB,ls}=setup();QB.setSession(A);ls.setItem('qb_qbp','{"brandName":"Old","archetypePrimary":"Sage"}');QB.logout();ls.setItem('qb_qbp','{"brandName":"New"}');QB.setSession(A);assert.equal(QB.getQBP().brandName,'New');assert.equal(QB.getQBP().archetypePrimary,'Sage');});
test('shared owner archive wins over a stale tab fallback',()=>{const{QB,ls,ss}=setup();
  ls.setItem('qb_saved_user:A','{"qb_qbp":"{\\"brandName\\":\\"Shared\\"}"}');
  ss.setItem('qb_saved_user:A','{"qb_qbp":"{\\"brandName\\":\\"Stale tab\\"}"}');
  QB.setSession(A);
  assert.equal(QB.getQBP().brandName,'Shared');
});
process.exitCode=failures?1:0;
