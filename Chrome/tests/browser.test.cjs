// npm install --no-save playwright @sparticuz/chromium
// NODE_PATH=/path/to/node_modules node tests/browser.test.cjs
const { chromium: playwright } = require('playwright');
const chromiumModule = require(process.env.VC_CHROMIUM_MODULE || './browser-engine.cjs');
const chromium = chromiumModule.default || chromiumModule;
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'..');
(async () => {
  const browser=await playwright.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1080}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file://'+root+'/preview/demo.html');
  await page.locator('#app').locator('#total').waitFor();
  await page.waitForFunction(()=>document.querySelector('#app').shadowRoot.getElementById('total').textContent==='24');
  assert.equal(await page.locator('#candidates').textContent(),'6');
  assert.deepEqual(await page.locator('#tabs button').allTextContents(),['Candidates','Duplicates','Ties','Protected','No maximum','All']);
  assert.equal(await page.locator('th').nth(2).textContent(),'Maximum');
  assert.equal(await page.locator('#rated').textContent(),'21');
  assert.equal(await page.locator('.brand p').textContent(),'DESTINY 2');
  assert.equal(await page.locator('.head .pill').count(),0);
  assert.ok(!(await page.locator('.head').textContent()).includes('0.1.'));
  assert.equal(await page.locator('[data-improve]').count(),0);
  assert.ok(!(await page.locator('#app').textContent()).includes('Para leer el máximo'));

  await page.screenshot({path:path.resolve(root,'../browser-panel-check.png'),fullPage:true});
  await page.locator('#select-visible').click();
  assert.equal(await page.locator('#selected-count').textContent(),'6');
  await page.locator('#limit').fill('1');
  await page.locator('#prepare').click();
  assert.match(await page.locator('#review-title').textContent(),/^3 weapons/);
  await page.locator('#confirm-plan').click();
  await page.waitForFunction(()=>document.querySelector('#app').shadowRoot.getElementById('status').textContent.includes('3 weapons transferred and confirmed'));
  assert.equal(await page.locator('#candidates').textContent(),'3');
  console.log('PASS preview: grade filters, select, review, size limit, simulated transfer and refreshed candidates');
  await page.locator('[data-view=ungraded]').click();
  assert.equal(await page.locator('#rows tr').count(),3);
  console.log('PASS preview: ungraded items kept outside eligible candidates');
  // Exercise the actual panel widths, including the footer layout reported by the user.
  await page.evaluate(()=>{
    document.getElementById('app').shadowRoot.querySelector('.standalone').classList.remove('standalone');
    Object.assign(document.getElementById('app').style,{position:'fixed',right:'18px',top:'18px',width:'min(660px, calc(100vw - 36px))'});
    document.querySelectorAll('.note').forEach(note=>note.remove());
  });
  for (const width of [900,520,375]) {
    await page.setViewportSize({width,height:1100});
    const view=await page.locator('#search-dim').boundingBox(),prepare=await page.locator('#prepare').boundingBox();
    assert.ok(Math.abs(view.y-prepare.y)<1,`Buttons must align at width ${width}`);
    assert.equal(view.height,40);assert.equal(prepare.height,40);
    assert.ok(view.x+view.width<=prepare.x,`Buttons must not overlap at width ${width}`);
    assert.ok(prepare.x+prepare.width<=width,`Buttons must stay inside the viewport at width ${width}`);
    const finalGrade=await page.locator('#grades button').last().boundingBox();
    const gradeGrid=await page.locator('#grades').boundingBox();
    assert.ok(finalGrade.x+finalGrade.width<=gradeGrid.x+gradeGrid.width+1,`All six ranks must fit at width ${width}`);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:path.resolve(root,`../v018-panel-${width}.png`),fullPage:true});
  }
  console.log('PASS layout: aligned 40px footer buttons at 660px panel and narrow 484px/339px panels');
  await page.setViewportSize({width:1440,height:1080});
  await page.setContent('<html><body><div class="item" id="6917530200300167753">Weapon 1</div><div class="item" id="6917530200300167754">Weapon 2</div><div id="popup"></div></body></html>');
  await page.addScriptTag({path:root+'/core.js'});
  await page.evaluate(()=>{
    const make=id=>({id,name:'Weapon '+id.slice(-1),typeName:'Rifle',bucket:{inWeapons:true,hash:1498876634,capacity:10,name:'Energy'},owner:'vault',locked:false,equipped:false,location:{inPostmaster:false},rarity:'Legendary',amount:1,icon:'',sockets:{allSockets:[]}});
    const first=make('6917530200300167753'),second=make('6917530200300167754');
    const target={id:'character',name:'Hunter',className:'Hunter',isVault:false,current:true,items:[]};
    const vault={id:'vault',name:'Vault',isVault:true,items:[first,second]};
    window.state={accounts:{currentAccountDestinyVersion:2,currentAccountMembershipId:'account'},inventory:{stores:[vault,target],live:true,profileResponse:{characterLoadouts:{data:{character:{loadouts:[]}}}}},dimApi:{profileLoaded:true,profiles:{'account-d2':{loadouts:{},tags:{}}}},inGameLoadouts:{loadouts:{}}};
    window.calls=[];
    const provider={memoizedProps:{store:{getState:()=>window.state,dispatch:()=>{}}},return:null};
    for(const item of [first,second]){
      const tile=document.getElementById(item.id);
      tile.__reactFiberFake={memoizedProps:{item},return:provider};
      tile.onclick=()=>{
        const popup=document.getElementById('popup');popup.replaceChildren();
        // An EQUIP control appears first; only STORE may be chosen.
        const itemFiber={memoizedProps:{item},return:provider};
        for(const type of ['equip','store']){
          const btn=document.createElement('button');btn.textContent=type;
          btn.__reactFiberFake={memoizedProps:{},return:{memoizedProps:{type,actionsModel:{store:[{store:target,enabled:true}]},submitMoveTo:(store,equip)=>{
            window.calls.push({id:item.id,type,equip,target:store.id});
            if(type==='store'&&equip===false){item.owner=store.id;target.items.push(item);vault.items=vault.items.filter(i=>i.id!==item.id);popup.replaceChildren();}
          }},return:itemFiber}};popup.append(btn);
        }
      };
    }
    window.rpc=(action,payload={})=>new Promise((resolve,reject)=>{
      const requestId=crypto.randomUUID();
      const handler=e=>{const r=JSON.parse(e.detail);if(r.requestId===requestId){document.removeEventListener('vault-cleaner-response',handler);r.error?reject(new Error(r.error)):resolve(r.data);}};
      document.addEventListener('vault-cleaner-response',handler);
      document.dispatchEvent(new CustomEvent('vault-cleaner-request',{detail:JSON.stringify({requestId,action,payload})}));
    });
  });
  await page.addScriptTag({path:root+'/dim-bridge.js'});
  const snap=await page.evaluate(()=>rpc('snapshot'));
  assert.equal(snap.items.length,2);assert.equal(snap.canTransfer,true);
  const result=await page.evaluate(async()=>{
    const ids=['6917530200300167753','6917530200300167754'];
    const grades=Object.fromEntries(ids.map(id=>[id,{grade:'F',bestGrade:'F',at:Date.now()}]));
    const one=await rpc('prepare',{ids,grades,categories:['F'],targetId:'character',limit:1,reserve:true,batchMode:'total'});
    if(one.batch.length!==1 || one.batchMode!=='total') throw new Error('Total sizing was not retained by the DIM bridge');
    const plan=await rpc('prepare',{ids,grades,categories:['F'],targetId:'character',limit:2,reserve:true,batchMode:'total'});
    return rpc('transfer',{token:plan.token});
  });
  assert.equal(result.moved,2);
  const calls=await page.evaluate(()=>calls);
  assert.equal(calls.length,2);assert.ok(calls.every(c=>c.type==='store'&&c.equip===false));
  assert.ok(result.snapshot.items.every(i=>i.owner==='character'));
  console.log('PASS DIM bridge: exact instance IDs, native STORE callback, no EQUIP call, confirmed destination');
  const blocked=await page.evaluate(async()=>{
    state.dimApi.profileLoaded=false;
    const snap=await rpc('snapshot');
    try{await rpc('prepare',{ids:[],grades:{},categories:['F'],targetId:'character'});return {snap,blocked:false};}catch{return {snap,blocked:true};}
  });
  assert.equal(blocked.snap.canTransfer,false);assert.equal(blocked.blocked,true);
  console.log('PASS DIM bridge: missing protection data prevents preparation');
  // Manual mode explicitly bypasses cleanup grade/protection filters, while only
  // calling STORE for the selected exact copy and keeping its lock untouched.
  await page.evaluate(()=>{
    const target=state.inventory.stores.find(s=>!s.isVault),vault=state.inventory.stores.find(s=>s.isVault);
    const item=target.items.shift();item.owner='vault';item.locked=true;item.rarity='Exotic';vault.items.push(item);
    state.dimApi.profileLoaded=true;
  });
  const manual=await page.evaluate(async()=>{
    const id=state.inventory.stores.find(s=>s.isVault).items[0].id;
    const plan=await rpc('prepare',{ids:[id],grades:{},categories:[],mode:'manual',targetId:'character',limit:9,reserve:false});
    return rpc('transfer',{token:plan.token});
  });
  assert.equal(manual.moved,1);assert.ok(manual.snapshot.items.find(i=>i.locked && i.exotic)?.owner==='character');
  assert.ok((await page.evaluate(()=>calls)).every(c=>c.type==='store'&&c.equip===false));
  console.log('PASS manual DIM bridge: chosen exotic/locked copy without grade transferred through STORE with its lock retained');
  // DOM capture rejects a container shared by two instance IDs.
  await page.setContent('<div data-id="6917530200300167753"><img class="quality" title="Popularity (D)"></div><div data-id="6917530200300167754"><img class="quality" title="Popularity (A)"></div><div data-id="6917530200300167755"><span data-id="6917530200300167756"></span><img class="quality" title="Popularity (F)"></div>');
  await page.addScriptTag({path:root+'/core.js'});
  await page.evaluate(()=>{window.saved=[];window.browser={runtime:{sendMessage:async m=>{saved.push(m);return {total:2};}}};});
  await page.addScriptTag({path:root+'/lightgg-content.js'});
  await page.waitForFunction(()=>window.saved.length>0);
  const capture=await page.evaluate(()=>saved[0].grades);
  assert.equal(capture['6917530200300167753'].grade,'D');assert.equal(capture['6917530200300167754'].grade,'A');assert.equal(capture['6917530200300167755'],undefined);
  console.log('PASS light.gg capture: exact copy grading; ambiguous containers ignored');
  assert.deepEqual(errors,[]);
  await browser.close();
})().catch(error=>{console.error(error);process.exitCode=1;});
