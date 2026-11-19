const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require('playwright');
const m=require('@sparticuz/chromium'),engine=m.default||m;
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({executablePath:await engine.executablePath(),args:engine.args,headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1100}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file://'+root+'/preview/demo.html');
  await page.waitForFunction(()=>document.getElementById('app').shadowRoot.getElementById('total').textContent==='24');
  assert.equal(await page.locator('#candidates').textContent(),'6');
  await page.locator('[data-view=duplicates]').click();
  assert.equal(await page.locator('#transfer-mode').inputValue(),'duplicates');
  assert.equal(await page.locator('#candidates').textContent(),'3');
  assert.equal(await page.locator('#rows input').count(),5);
  assert.equal(await page.locator('#rows input:not(:disabled)').count(),3);
  assert.match(await page.locator('#list-count').textContent(),/3 selectable.*1 groups need a keeper/);
  assert.match(await page.locator('#grades [data-grade=S]').textContent(),/2 weapons/);
  assert.match(await page.locator('#rows').textContent(),/Current C/);
  await page.locator('#rows tr').filter({hasText:'Current C'}).locator('[data-compare]').click();
  assert.match(await page.locator('#dialog').textContent(),/Confirmed maximum.*S.*S/);
  assert.match(await page.locator('#dialog').textContent(),/Maximum Overall.*91%.*95%/);
  assert.match(await page.locator('#dialog').textContent(),/Frenzy/);
  assert.match(await page.locator('#dialog').textContent(),/Masterwork.*Range/);
  await page.locator('#cancel-plan').press('Escape');
  await page.locator('#select-visible').click();assert.equal(await page.locator('#selected-count').textContent(),'3');
  await page.locator('#select-visible').click();assert.equal(await page.locator('#selected-count').textContent(),'3');
  await page.locator('#all-check').uncheck();assert.equal(await page.locator('#selected-count').textContent(),'0');
  await page.locator('#all-check').check();assert.equal(await page.locator('#selected-count').textContent(),'3');
  await page.locator('#batch-mode').selectOption('total');
  await page.locator('#prepare').click();
  assert.match(await page.locator('#dialog').textContent(),/Retain ID/);
  assert.match(await page.locator('#dialog').textContent(),/retained best copies stay outside/);
  await page.locator('#cancel-plan').click();
  await page.locator('[data-view=candidates]').click();
  assert.equal(await page.locator('#transfer-mode').inputValue(),'clean');
  assert.equal(await page.locator('#selected-count').textContent(),'0');
  assert.equal(await page.locator('#candidates').textContent(),'6');
  assert.equal(await page.locator('#grades [data-grade=S]').getAttribute('aria-pressed'),'false');
  await page.locator('#transfer-mode').selectOption('duplicates');
  await page.locator('#grades [data-grade=S]').click();assert.equal(await page.locator('#rows input:not(:disabled)').count(),1);
  await page.locator('#grades [data-grade=S]').click();
  await page.locator('#query').pressSequentially('frenzy');assert.equal(await page.locator('#rows input:not(:disabled)').count(),2);
  await page.locator('#query').fill('');
  await page.locator('[data-view=ties]').click();
  assert.equal(await page.locator('#rows input').count(),2);assert.equal(await page.locator('#select-visible').isDisabled(),true);
  await page.locator('[data-choose]').first().click();
  assert.match(await page.locator('#dialog').textContent(),/same maximum rank and Overall/);
  assert.equal(await page.locator('#save-keeper').isDisabled(),true);
  assert.equal(await page.locator('[name=weapon-keeper]:checked').count(),0);
  await page.screenshot({path:path.resolve(root,'../weapon-ties-check.png'),fullPage:true});
  for(const width of [900,520,375]) {
   await page.setViewportSize({width,height:1100});
   assert.equal(await page.evaluate(()=>{const d=document.getElementById('app').shadowRoot.querySelector('.dialog');return d.scrollWidth<=d.clientWidth+1;}),true,'Keeper dialog overflow at '+width);
  }
  await page.setViewportSize({width:1440,height:1100});
  await page.locator('[name=weapon-keeper]').first().check();await page.locator('#save-keeper').click();
  await page.locator('#dialog.hidden').waitFor({state:'attached'});
  assert.equal(await page.locator('#rows input').count(),0);assert.equal(await page.locator('#candidates').textContent(),'4');
  await page.locator('#refresh').click();
  assert.equal(await page.locator('#candidates').textContent(),'4');
  await page.locator('[data-view=duplicates]').click();assert.equal(await page.locator('#rows input').count(),4);
  const withoutMetadata=page.locator('#rows tr').filter({hasText:'The Recluse'});
  await withoutMetadata.locator('[data-compare]').click();
  assert.match(await page.locator('#dialog').textContent(),/Maximum Overall.*82%.*82%/);
  await page.locator('#cancel-plan').click();
  await page.screenshot({path:path.resolve(root,'../weapon-duplicates-check.png'),fullPage:true});
  await page.evaluate(()=>{
   document.getElementById('app').shadowRoot.querySelector('.standalone').classList.remove('standalone');
   Object.assign(document.getElementById('app').style,{position:'fixed',right:'18px',top:'18px',width:'min(660px, calc(100vw - 36px))'});
   document.querySelectorAll('.note').forEach(n=>n.remove());
  });
  for(const width of [900,520,375]) {
   await page.setViewportSize({width,height:1100});
   const fits=await page.evaluate(()=>{const app=document.getElementById('app').shadowRoot.querySelector('.app');return app.scrollWidth<=app.clientWidth+1;});
   assert.equal(fits,true,'Duplicate view overflow at '+width);
  }
  await page.setViewportSize({width:1440,height:1100});
  await page.locator('#select-visible').click();await page.locator('#prepare').click();await page.locator('#confirm-plan').click();
  await page.waitForFunction(()=>document.getElementById('app').shadowRoot.getElementById('status').textContent.includes('4 weapons transferred and confirmed'));
  assert.equal(await page.locator('#candidates').textContent(),'0');assert.equal(await page.locator('#select-visible').isDisabled(),true);
  await page.locator('#refresh').click();assert.equal(await page.locator('#candidates').textContent(),'0');
  await page.locator('[data-kind=armor]').click();assert.equal(await page.locator('#candidates').textContent(),'5');
  await page.locator('[data-kind=weapons]').click();assert.equal(await page.locator('#transfer-mode').inputValue(),'clean');
  console.log('PASS weapon duplicates UI: max ranks and Overall, different masterworks, optional metadata, user-selected ties, stable Select visible, header clearing, frozen retained IDs, mode filters, saved choices, refreshed counts and responsive layout');

  await page.goto('file://'+root+'/popup.html');
  await page.setContent('<div id="tiles"></div><div id="popup"></div>');
  await page.addScriptTag({path:root+'/core.js'});
  await page.evaluate(()=>{
   const bucket={inWeapons:true,hash:1498876634,name:'Kinetic',capacity:10};
   const plug=(hash,name,category=2000)=>({plugDef:{hash,displayProperties:{name},plug:{plugCategoryHash:category,plugCategoryIdentifier:category===1744546145 ? 'intrinsics' : 'weapon.traits'}}});
   const make=(n,locked=false,extra=false)=>({id:String(6917530200400050000n+BigInt(n)),hash:500,name:'Example Rifle',typeName:'Rifle',bucket,location:bucket,
    owner:'vault',locked,equipped:false,rarity:'Legendary',classType:1,tier:0,adept:false,holofoil:false,element:{hash:1},power:550,crafted:false,
    masterworkInfo:{tier:10,stats:[{hash:1240592695,name:'Range',isPrimary:true,value:10}]},stats:[{statHash:1240592695,base:40,value:50}],
    sockets:{allSockets:Array.from({length:5},(_,index)=>{
     const hash=1000+index,selected=plug(hash,index ? 'Perk '+index : 'Frame',index ? 2000+index : 1744546145);
     const available=[selected,...(extra && index===4 ? [plug(1014,'Unselected Frenzy',2004)] : [])];
     return {socketIndex:index,isPerk:true,visibleInGame:true,hasRandomizedPlugItems:index>0,
      socketDefinition:{socketTypeHash:3000+index,...(index ? {randomizedPlugSetHash:4000+index} : {})},plugged:selected,
      reusablePlugItems:available.map(p=>({plugItemHash:p.plugDef.hash})),plugOptions:available,
      // Full loot-pool options must never masquerade as this copy's options.
      plugSet:{plugs:[...available,plug(9999,'Loot-pool-only perk')]}};
    })}});
   const keeper=make(0,true,true),same=make(1,false,true),subset=make(2),variant=make(3);
   variant.sockets.allSockets[4].plugged=plug(2222,'Different roll',2004);
   variant.sockets.allSockets[4].plugOptions=[variant.sockets.allSockets[4].plugged];variant.sockets.allSockets[4].reusablePlugItems=[{plugItemHash:2222}];
   const incomplete=make(4);delete incomplete.sockets.allSockets[4].reusablePlugItems;
   const override=make(5,false,true);
   override.sockets.allSockets[4].actuallyPlugged=override.sockets.allSockets[4].plugged;
   override.sockets.allSockets[4].plugged=plug(9999,'DIM preview',2004);
   const investment=make(6,false,true);investment.masterworkInfo.stats[0].hash=155624089;
   const vault={id:'vault',isVault:true,name:'Vault',items:[keeper,same,subset,variant,incomplete,override,investment]};
   const target={id:'hunter',name:'Hunter',className:'Hunter',isVault:false,current:true,items:[]};
   window.state={accounts:{currentAccountDestinyVersion:2,currentAccountMembershipId:'account'},inventory:{stores:[vault,target],live:true,profileResponse:{characterLoadouts:{data:{hunter:{loadouts:[]}}}}},dimApi:{profileLoaded:true,profiles:{'account-d2':{loadouts:{},tags:{}}}},inGameLoadouts:{loadouts:{}}};
   window.grades=Object.fromEntries(vault.items.map((i,n)=>[i.id,{grade:'S',bestGrade:'S',currentGrade:'C',at:Date.now(),bestOverall:n ? 90-n : 99,bestOverallGrade:'S',bestOverallAt:Date.now()}]));
   window.calls=[];const provider={memoizedProps:{store:{getState:()=>state,dispatch:()=>{}}},return:null};
   for(const item of vault.items){
    const tile=document.createElement('div');tile.id=item.id;tile.className='item';document.getElementById('tiles').append(tile);
    const fiber={memoizedProps:{item},return:provider};tile.__reactFiberFake=fiber;
    tile.onclick=()=>{
     const popup=document.getElementById('popup');popup.replaceChildren();
     for(const type of ['equip','store']){
      const button=document.createElement('button');button.textContent=type;
      button.__reactFiberFake={memoizedProps:{},return:{memoizedProps:{type,actionsModel:{store:[{store:target,enabled:true}]},submitMoveTo:(destination,equip)=>{
       calls.push({id:item.id,type,equip});if(type==='store' && equip===false){item.owner=destination.id;vault.items=vault.items.filter(i=>i!==item);destination.items.push(item);popup.replaceChildren();}
      }},return:fiber}};popup.append(button);
     }
    };
   }
   window.rpc=(action,payload={})=>new Promise((resolve,reject)=>{
    const requestId=crypto.randomUUID(),handler=e=>{const r=JSON.parse(e.detail);if(r.requestId===requestId){document.removeEventListener('vault-cleaner-response',handler);r.error ? reject(Error(r.error)) : resolve(r.data);}};
    document.addEventListener('vault-cleaner-response',handler);document.dispatchEvent(new CustomEvent('vault-cleaner-request',{detail:JSON.stringify({requestId,action,payload})}));
   });
   window.prepare=(ids,keeperChoices={})=>rpc('prepare',{kind:'weapons',mode:'duplicates',ids,grades,keeperChoices,categories:['S','A','B','C','D','F'],targetId:'hunter',limit:9});
  });
  await page.addScriptTag({path:root+'/dim-bridge.js'});
  const snap=await page.evaluate(()=>rpc('snapshot'));
  assert.equal(snap.canTransfer,true);assert.equal(snap.items[0].weaponData.complete,true);
  assert.deepEqual(snap.items[0].weaponData.columns[4].options.map(p=>p.hash),[1004,1014]);
  assert.equal(snap.items[4].weaponData.complete,false);
  assert.deepEqual(snap.items[5].weaponData.columns[4].options.map(p=>p.hash),[1004,1014]);
  const a=await page.evaluate(async()=>VaultCore.weaponAnalysis((await rpc('snapshot')).items,grades));
  for(const index of [1,2,3,4,5,6])assert.equal(a.records[snap.items[index].id].keeperId,snap.items[0].id);
  assert.equal(a.records[snap.items[4].id].state,'duplicate');
  const missing=await page.evaluate(async id=>{
   const plan=await prepare([id]),vault=state.inventory.stores[0],keeper=vault.items.shift();
   try{await rpc('transfer',{token:plan.token});return false;}catch(e){return e.message.includes('retained weapon replacement');}finally{vault.items.unshift(keeper);}
  },snap.items[1].id);
  assert.equal(missing,true);assert.deepEqual(await page.evaluate(()=>calls),[]);
  const changed=await page.evaluate(async id=>{
   const plan=await prepare([id]),keeper=state.inventory.stores[0].items[0],hash=keeper.hash;
   keeper.hash=501;
   try{await rpc('transfer',{token:plan.token});return false;}catch(e){return e.message.includes('retained weapon replacement');}finally{keeper.hash=hash;}
  },snap.items[1].id);
  assert.equal(changed,true);assert.deepEqual(await page.evaluate(()=>calls),[]);
  const expired=await page.evaluate(async id=>{
   const keeperId=state.inventory.stores[0].items[0].id,record=grades[keeperId],originalAt=record.at;
   record.at=Date.now()-VaultCore.MAX_GRADE_AGE+1000;
   const plan=await prepare([id]);const now=Date.now;Date.now=()=>now()+1500;
   try{await rpc('transfer',{token:plan.token});return false;}catch(e){return e.message.includes('valid maximum');}
   finally{Date.now=now;record.at=originalAt;}
  },snap.items[1].id);
  assert.equal(expired,true);assert.deepEqual(await page.evaluate(()=>calls),[]);
  const expiredOverall=await page.evaluate(async id=>{
   const record=grades[state.inventory.stores[0].items[0].id],original=record.bestOverallAt;
   record.bestOverallAt=Date.now()-VaultCore.MAX_GRADE_AGE+1000;
   const plan=await prepare([id]);const now=Date.now;Date.now=()=>now()+1500;
   try{await rpc('transfer',{token:plan.token});return false;}catch(e){return e.message.includes('valid maximum');}
   finally{Date.now=now;record.bestOverallAt=original;}
  },snap.items[1].id);
  assert.equal(expiredOverall,true);assert.deepEqual(await page.evaluate(()=>calls),[]);
  const undecided=await page.evaluate(async id=>{
   grades[id].bestOverall=99;
   try {await prepare([id]);return false;}catch(e){return e.message.includes('No space') || e.message.includes('eligible');}
  },snap.items[1].id);
  assert.equal(undecided,true);
  const moved=await page.evaluate(async ids=>{
   const keeper=state.inventory.stores[0].items[0],choices={[VaultCore.weaponFamily((await rpc('snapshot')).items[0])]:keeper.id};
   const plan=await prepare(ids,choices);if(Object.keys(plan.replacements).length!==6)throw Error('Missing retained weapon IDs');
   if(plan.batch.some(i=>Object.values(plan.replacements).includes(i.id)))throw Error('Keeper included in batch');
   return rpc('transfer',{token:plan.token});
  },[1,2,3,4,5,6].map(index=>snap.items[index].id));
  assert.equal(moved.moved,6);assert.equal(moved.snapshot.characters[0].occupied['1498876634'],6);
  const retained=moved.snapshot.items.find(i=>i.id===snap.items[0].id);assert.equal(retained.owner,'vault');assert.equal(retained.locked,true);
  assert.ok((await page.evaluate(()=>calls)).every(c=>c.type==='store' && c.equip===false));

  assert.deepEqual(errors,[]);
  console.log('PASS weapon duplicates bridge: optional rolled options and overrides, loot-pool exclusion, rank/Overall comparisons across different rolls and masterworks, manual tie choice, frozen keeper identity, rank and score expiry and exact STORE without EQUIP');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
