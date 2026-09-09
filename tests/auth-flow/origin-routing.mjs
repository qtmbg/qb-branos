import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const BASE=process.env.QB_BASE||'http://127.0.0.1:4337';
const b=await chromium.launch();let failures=0;
for(const path of ['/foundation','/login?return_to=%2Fqbp','/payment.html?plan=pro&billing=annual','/signal-scan.html']){
 const c=await b.newContext();
 await c.route('https://**quantumbranding.ai/**',async r=>{
  const u=new URL(r.request().url());
  if(u.pathname.startsWith('/api/'))return r.fulfill({json:{ok:true}});
  const res=await fetch(BASE+u.pathname+u.search);return r.fulfill({status:res.status,headers:{'content-type':res.headers.get('content-type')||'text/html'},body:Buffer.from(await res.arrayBuffer())});
 });
 const p=await c.newPage();try{
  await p.goto('https://quantumbranding.ai'+path,{waitUntil:'domcontentloaded'});await p.waitForTimeout(1000);
  assert.equal(new URL(p.url()).origin,'https://app.quantumbranding.ai');
  if(path.startsWith('/login'))assert.equal(new URL(p.url()).searchParams.get('return_to'),'/qbp');
  console.log('PASS',path);
 }catch(e){failures++;console.log('FAIL',path,e.message)}finally{await c.close()}
}
await b.close();process.exitCode=failures?1:0;
