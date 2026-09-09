import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const BASE = process.env.QB_BASE || 'http://127.0.0.1:4337';
const session = {token:'expired-token',refreshToken:'refresh-a',userId:'user-a',email:'a@example.test'};
const browser = await chromium.launch();
let failed = 0;
async function scenario(name, run) {
  const ctx = await browser.newContext();
  await ctx.route('**://*.supabase.co/**', r => r.fulfill({status:200,json:[]}));
  await ctx.route('**/api/**', r => r.fulfill({status:200,json:{qbp:{},tier:'free',artifacts:[]}}));
  await ctx.route('https://outside.example/**', r => r.fulfill({status:200,body:'outside'}));
  await ctx.route('**/auth/v1/user', r => r.fulfill({json:{id:'user-b',email:'b@example.test'}}));
  const page = await ctx.newPage();
  try { await run(page,ctx); console.log('PASS',name); }
  catch(e) { failed++; console.log('FAIL',name,e.message); }
  finally { await ctx.close(); }
}
async function seed(ctx,s=session,extra={}) { await ctx.addInitScript(({s,extra})=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem('qb_session',JSON.stringify(s)); for(const[k,v]of Object.entries(extra))localStorage.setItem(k,v);sessionStorage.setItem('seeded','1');}}, {s,extra}); }
await scenario('expired API session refreshes once and renders account',async(p,c)=>{
  await seed(c); let refreshes=0;
  await c.route('**/auth/v1/token?*',r=>{refreshes++;return r.fulfill({json:{access_token:'fresh-token',refresh_token:'refresh-b'}});});
  await c.route('**/api/qbp',r=>r.fulfill(r.request().headers().authorization==='Bearer fresh-token'?{json:{tier:'free'}}:{status:401,json:{error:'Invalid session'}}));
  await p.goto(BASE+'/account'); await p.waitForTimeout(1200);
  assert.equal(refreshes,1); assert.match(await p.locator('body').innerText(),/Your account/);
});
await scenario('revoked session ends at usable login without a redirect loop',async(p,c)=>{
  await seed(c); let navs=0;p.on('framenavigated',()=>navs++);
  await c.route('**/auth/v1/token?*',r=>r.fulfill({status:400,json:{error:'invalid_grant'}}));
  await c.route('**/api/qbp',r=>r.fulfill({status:401,json:{error:'Invalid session'}}));
  await p.goto(BASE+'/account'); await p.waitForTimeout(1100);
  assert.ok(navs<=3,`${navs} navigations`); assert.ok(await p.locator('#login-email').isVisible());
});
for (const path of ['https://outside.example/','/\\outside.example/','/signin','/a/../login']) {
 await scenario('callback rejects unsafe or looping return '+path,async(p)=>{
  await p.goto(BASE+'/auth-callback.html?return_to='+encodeURIComponent(path)+'#access_token=new-token&refresh_token=new-refresh');
  await p.waitForTimeout(1200); assert.equal(new URL(p.url()).pathname,'/foundation'); assert.equal(new URL(p.url()).origin,new URL(BASE).origin);
 });
}
await scenario('expired callback offers a direct new-link action',async(p)=>{
 await p.goto(BASE+'/auth-callback.html#error=access_denied&error_description=Expired');
 assert.ok(await p.locator('a[href^="/login"]').count());
});
await scenario('sign-out hides brand data and another account cannot inherit it',async(p,c)=>{
 await seed(c,session,{qb_qbp:JSON.stringify({brandName:'Private brand A'}),qb_completions:JSON.stringify({'soul-map':'done'}),qb_user_tier:'pro',qb_sub_status:'active',qb_soul_map_result:'Private output'});
 await p.goto(BASE+'/account'); await p.waitForTimeout(100);
 const state=await p.evaluate(()=>{QB.logout();const afterLogout=QB.getQBP();QB.setSession({token:'b',userId:'user-b'});return {afterLogout,afterSwitch:QB.getQBP(),output:localStorage.getItem('qb_soul_map_result')};});
 assert.deepEqual(state.afterLogout,{});assert.deepEqual(state.afterSwitch,{});assert.equal(state.output,null);
});
await scenario('sign-out preserves a private draft for the same account to resume',async(p,c)=>{
 await seed(c,session,{qb_qbp:JSON.stringify({brandName:'Draft A'})});await p.goto(BASE+'/account');
 const result=await p.evaluate(s=>{QB.logout();QB.setSession(s);return QB.getQBP();},session);assert.equal(result.brandName,'Draft A');
});
await scenario('forged payment success does not activate a plan',async(p,c)=>{
 await seed(c);await p.goto(BASE+'/payment.html?payment=success&plan=pro');
 assert.notEqual(await p.evaluate(()=>localStorage.getItem('qb_sub_status')),'active');
 assert.doesNotMatch(await p.locator('#app').innerText(),/Your account is active/);
});
await scenario('cancelled annual checkout stays on plans without charging again',async(p,c)=>{
 await seed(c);let calls=0;await c.route('**/api/stripe/checkout',r=>{calls++;return r.fulfill({json:{checkout_url:BASE+'/404.html'}})});
 await p.goto(BASE+'/payment.html?cancelled=1&plan=pro&billing=annual');await p.waitForTimeout(300);
 assert.equal(calls,0);assert.match(await p.locator('#app').innerText(),/2,460|2460/);
});
await scenario('confirmed subscription returns to the paid tool requested',async(p,c)=>{
 await seed(c);await c.route('**/rest/v1/profiles**',r=>r.fulfill({json:[{tier:'pro',subscription_status:'active',qbp:{}}]}));
 await p.goto(BASE+'/payment.html?payment=success&plan=pro');await p.waitForTimeout(300);
 await p.evaluate(()=>sessionStorage.setItem('qb_return_to','/voice-guide-agent.html'));
 await p.locator('#app button').click();await p.waitForTimeout(300);assert.equal(new URL(p.url()).pathname,'/voice-guide-agent.html');
});
await scenario('late refresh cannot sign a user back in after sign-out',async(p,c)=>{
 await seed(c);let release;const gate=new Promise(r=>release=r);
 await c.route('**/auth/v1/token?*',async r=>{await gate;await r.fulfill({json:{access_token:'late-token',refresh_token:'late-refresh'}})});
 await p.goto(BASE+'/account');await p.evaluate(()=>{window.refreshDone=QB.refreshAccessToken();});await p.waitForTimeout(100);
 await p.evaluate(()=>QB.logout());release();await p.evaluate(()=>window.refreshDone);
 assert.equal(await p.evaluate(()=>QB.isAuthed()),false);
});
await scenario('late profile cannot refill data after sign-out',async(p,c)=>{
 await seed(c);let release;const gate=new Promise(r=>release=r);
 await c.route('**/rest/v1/profiles**',async r=>{await gate;await r.fulfill({json:[{tier:'pro',subscription_status:'active',qbp:{brandName:'Private A'}}]})});
 await p.goto(BASE+'/account');await p.evaluate(()=>QB.logout());release();await p.waitForTimeout(150);
 assert.deepEqual(await p.evaluate(()=>QB.getQBP()),{});
});
await browser.close();console.log(`${failed} failures`);process.exitCode=failed?1:0;
