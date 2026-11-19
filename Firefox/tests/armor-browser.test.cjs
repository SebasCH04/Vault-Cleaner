const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium} = require('playwright');
const m = require('@sparticuz/chromium'), engine = m.default || m;
const root = path.resolve(__dirname,'..');
(async()=>{
  const browser=await chromium.launch({executablePath:await engine.executablePath(),args:engine.args,headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1200}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('file://'+root+'/preview/demo.html');
    await page.waitForFunction(()=>document.getElementById('app').shadowRoot.getElementById('total').textContent==='24');
    await page.locator('[data-kind=armor]').click();
    assert.equal(await page.locator('#total').textContent(),'17');
    assert.equal(await page.locator('#candidates').textContent(),'5');
    assert.deepEqual(await page.locator('#tabs button').allTextContents(),['Duplicates','Keep','Review','Protected','All']);
    assert.equal(await page.locator('#sync').isVisible(),false);
    assert.match(await page.locator('#armor-sets').textContent(),/Tecsec.*5\/5 slots/);
    assert.match(await page.locator('#armor-sets').textContent(),/5 slots retained/);
    assert.match(await page.locator('#armor-sets').textContent(),/Aion Renewal.*1\/5 slots/);
    await page.locator('[data-compare]').first().click();
    assert.equal(await page.locator('.compare-table tbody tr').count(),6);
    assert.match(await page.locator('#dialog').textContent(),/Retained copy/);
    await page.locator('#cancel-plan').press('Escape');
    assert.ok(await page.locator('#dialog').evaluate(el=>el.classList.contains('hidden')));
    await page.locator('#armor-archetype').selectOption('201');
    assert.equal(await page.locator('#rows input').count(),0);
    await page.locator('[data-view=keep]').click();
    assert.match(await page.locator('#rows').textContent(),/Brawler/);
    await page.locator('#armor-archetype').selectOption('');
    await page.locator('[data-view=review]').click();assert.match(await page.locator('#rows').textContent(),/Legacy Vest/);
    await page.locator('[data-view=protected]').click();assert.match(await page.locator('#rows').textContent(),/Tecsec Mask/);
    assert.doesNotMatch(await page.locator('#rows').textContent(),/Exotic Gauntlets/);
    await page.locator('[data-view=candidates]').click();
    await page.locator('#query').pressSequentially('tecsec');
    assert.equal(await page.locator('#rows input').count(),3);
    await page.locator('#query').fill('cross counter');
    assert.equal(await page.locator('#rows input').count(),2);
    assert.match(await page.locator('#rows').textContent(),/Exotic armor/);
    assert.doesNotMatch(await page.locator('#rows').textContent(),/Set unverified|Legacy/);
    await page.locator('[data-compare]').first().click();
    assert.match(await page.locator('#dialog').textContent(),/intrinsic perks/);
    assert.match(await page.locator('.compare-copies').textContent(),/Cross Counter.*Cross Counter/);
    await page.locator('#cancel-plan').click();
    await page.locator('#query').fill('');
    await page.locator('#select-visible').click();assert.equal(await page.locator('#selected-count').textContent(),'5');
    await page.locator('#batch-mode').selectOption('total');assert.equal(await page.locator('#limit').getAttribute('max'),'45');
    assert.equal(await page.locator('#space-detail').isVisible(),false);
    await page.locator('#prepare').click();
    assert.match(await page.locator('#review-title').textContent(),/^5 armor pieces/);
    assert.match(await page.locator('#dialog').textContent(),/Retain ID/);
    await page.locator('#confirm-plan').click();
    await page.waitForFunction(()=>document.getElementById('app').shadowRoot.getElementById('status').textContent.includes('5 armor pieces transferred and confirmed'));
    assert.equal(await page.locator('#candidates').textContent(),'0');
    assert.match(await page.locator('#armor-sets').textContent(),/5 slots retained/);
    await page.locator('[data-kind=weapons]').click();assert.equal(await page.locator('#total').textContent(),'24');assert.equal(await page.locator('#limit').getAttribute('max'),'27');
    console.log('PASS Armor UI: exotic duplicates, intrinsic-perk search and Compare, scoped counts, sets, archetype/Review/Protected views, 45 total sizing, retained IDs, simulated transfers and unchanged Weapons scope');

    await page.goto('file://'+root+'/popup.html');
    await page.setContent('<div id="tiles"></div><div id="popup"></div>');
    await page.addScriptTag({path:root+'/core.js'});
    await page.evaluate(()=>{
      const bucket={inArmor:true,inWeapons:false,hash:3448274439,name:'Helmet',capacity:10};
      const plug=(hash,name,category)=>({plugDef:{hash,displayProperties:{name},plug:{plugCategoryHash:category,plugCategoryIdentifier:'test.functional'}}});
      const make=(n,base,locked=false,tuning=[])=>({id:String(6917530200300950000n+BigInt(n)),hash:500,name:'Tecsec Mask',typeName:'Helmet',bucket,location:bucket,
        owner:'vault',locked,equipped:false,rarity:'Legendary',classType:1,tier:tuning.length ? 5 : 4,power:550,
        setBonus:{hash:100,displayProperties:{name:'Tecsec'},setPerks:[{requiredSetCount:2,sandboxPerkHash:1001},{requiredSetCount:4,sandboxPerkHash:1002}]},
        stats:VaultCore.ARMOR_STATS.map((statHash,index)=>({statHash,base:base[index],value:base[index]+10})),
        sockets:{allSockets:[{socketIndex:0,visibleInGame:true,plugged:{...plug(700,'Masterwork',2198080209),stats:{[VaultCore.ARMOR_STATS[1]]:{value:5}}}},
          {socketIndex:1,isPerk:true,visibleInGame:true,plugged:plug(800,'Powerhouse',778194869)},
          {socketIndex:2,visibleInGame:true,socketDefinition:{socketTypeHash:900,reusablePlugSetHash:901},plugged:plug(902,'Empty mod',748854354)},
          ...(tuning.length ? [{socketIndex:3,visibleInGame:true,plugged:plug(950,'Tuning',3481777685),reusablePlugItems:tuning.map(plugItemHash=>({plugItemHash}))}] : [])]}});
      window.makeArmor=make;
      const keeper=make(0,[30,0,0,20,25,0],true),duplicate=make(1,[30,0,0,20,25,0]),lower=make(2,[28,0,0,18,23,0]);
      const tuneA=make(3,[30,0,0,20,25,0],false,[100,101]),tuneB=make(4,[30,0,0,20,25,0],false,[100,102]);
      const makeExotic=(n,locked=false,perks=[10001],tuning=[])=>{
        const item=make(n,[30,0,0,20,25,0],locked,tuning);
        item.hash=perks.length===2 ? 601 : 600;item.name=perks.length===2 ? 'Exotic Cloak' : 'Exotic Helmet';
        item.rarity='Exotic';item.tier=tuning.length ? 5 : 0;delete item.setBonus;
        if(perks.length===2)item.bucket=item.location={...bucket,hash:Number(VaultCore.ARMOR_SLOTS[4]),name:'Class Item'};
        item.sockets.allSockets.push(...perks.map((hash,index)=>({socketIndex:4+index,isPerk:true,visibleInGame:true,plugged:plug(hash,'Exotic perk '+hash,1744546145)})));
        return item;
      };
      const exoticKeeper=makeExotic(10,true),exoticDupe=makeExotic(11),exoticLower=makeExotic(12);
      exoticLower.stats.forEach((stat,index)=>stat.base=[28,0,0,18,23,0][index]);
      const otherArchetype=makeExotic(13);otherArchetype.sockets.allSockets[1].plugged=plug(801,'Brawler',778194869);
      const otherTuning=makeExotic(14,false,[10001],[100,102]);
      const classKeeper=makeExotic(15,true,[10001,10002]),classDupe=makeExotic(16,false,[10001,10002]);
      const classVariant=makeExotic(17,false,[10001,10003]),classMissing=makeExotic(18,false,[10001,10002]);classMissing.sockets.allSockets.pop();
      const legacy=makeExotic(19);legacy.sockets.allSockets.shift();
      const vault={id:'vault',isVault:true,name:'Vault',items:[keeper,duplicate,lower,tuneA,tuneB,exoticKeeper,exoticDupe,exoticLower,otherArchetype,otherTuning,classKeeper,classDupe,classVariant,classMissing,legacy]};
      const hunter={id:'hunter',classType:1,className:'Hunter',name:'Hunter',items:[],isVault:false,current:true};
      const titan={id:'titan',classType:0,className:'Titan',name:'Titan',items:[],isVault:false};
      window.state={accounts:{currentAccountDestinyVersion:2,currentAccountMembershipId:'account'},inventory:{stores:[vault,hunter,titan],live:true,profileResponse:{characterLoadouts:{data:{hunter:{loadouts:[]}}}}},dimApi:{profileLoaded:true,profiles:{'account-d2':{loadouts:{},tags:{}}}},inGameLoadouts:{loadouts:{}}};
      const provider={memoizedProps:{store:{getState:()=>state,dispatch:()=>{}}},return:null};
      window.calls=[];
      for(const item of vault.items){
        const tile=document.createElement('div');tile.id=item.id;tile.className='item';document.getElementById('tiles').append(tile);
        const fiber={memoizedProps:{item},return:provider};tile.__reactFiberFake=fiber;
        tile.onclick=()=>{
          const popup=document.getElementById('popup');popup.replaceChildren();
          for(const type of ['equip','store']){
            const button=document.createElement('button');button.textContent=type;
            button.__reactFiberFake={memoizedProps:{},return:{memoizedProps:{type,actionsModel:{store:[{store:hunter,enabled:true}]},submitMoveTo:(target,equip)=>{
              calls.push({id:item.id,type,equip});
              if(type==='store' && equip===false){item.owner=target.id;vault.items=vault.items.filter(i=>i!==item);target.items.push(item);popup.replaceChildren();}
            }},return:fiber}};popup.append(button);
          }
        };
      }
      window.rpc=(action,payload={})=>new Promise((resolve,reject)=>{
        const requestId=crypto.randomUUID();const handler=event=>{const r=JSON.parse(event.detail);if(r.requestId===requestId){document.removeEventListener('vault-cleaner-response',handler);r.error ? reject(new Error(r.error)) : resolve(r.data);}};
        document.addEventListener('vault-cleaner-response',handler);document.dispatchEvent(new CustomEvent('vault-cleaner-request',{detail:JSON.stringify({requestId,action,payload})}));
      });
    });
    await page.addScriptTag({path:root+'/dim-bridge.js'});
    const snap=await page.evaluate(()=>rpc('snapshot'));
    assert.equal(snap.canTransfer,true);assert.equal(snap.items.length,15);
    assert.deepEqual(snap.items[1].armorData.base,[30,0,0,20,25,0]);
    assert.deepEqual(snap.items[1].armorData.potential,[30,5,5,20,25,5]);
    assert.equal(snap.items[1].armorData.archetypeName,'Powerhouse');assert.equal(snap.items[1].armorData.complete,true);
    assert.equal(snap.characters[0].classType,1);
    const a=await page.evaluate(async()=>VaultCore.armorAnalysis((await rpc('snapshot')).items));
    assert.equal(a.records[snap.items[1].id].keeperId,snap.items[0].id);
    assert.equal(a.records[snap.items[3].id].state,'keep');assert.equal(a.records[snap.items[4].id].state,'keep');
    assert.equal(snap.items[6].armorData.setHash,null);assert.equal(snap.items[6].armorData.tier,0);
    assert.equal(snap.items[6].armorData.complete,true);assert.deepEqual(snap.items[6].armorData.exoticPerks,[[4,10001]]);
    assert.equal(a.records[snap.items[6].id].keeperId,snap.items[5].id);assert.equal(a.records[snap.items[7].id].keeperId,snap.items[5].id);
    assert.equal(a.records[snap.items[8].id].state,'keep');assert.equal(a.records[snap.items[9].id].state,'keep');
    assert.equal(a.records[snap.items[11].id].keeperId,snap.items[10].id);assert.equal(a.records[snap.items[12].id].state,'keep');
    assert.equal(a.records[snap.items[13].id].state,'review');assert.equal(a.records[snap.items[14].id].state,'review');
    const wrong=await page.evaluate(async id=>{try{await rpc('prepare',{kind:'armor',ids:[id],targetId:'titan',mode:'clean'});return false;}catch(e){return e.message.includes('same class');}},snap.items[1].id);
    assert.equal(wrong,true);
    // Preparation freezes the retained reference. Removing it blocks the move,
    // even if another selected copy could otherwise replace it after transfer.
    const blocked=await page.evaluate(async id=>{
      const plan=await rpc('prepare',{kind:'armor',ids:[id],targetId:'hunter',mode:'clean',limit:9});
      const vault=state.inventory.stores[0],keeper=vault.items.shift();
      try {await rpc('transfer',{token:plan.token});return false;}
      catch(e){return e.message.includes('retained armor replacement');}
      finally {vault.items.unshift(keeper);}
    },snap.items[1].id);
    assert.equal(blocked,true);assert.deepEqual(await page.evaluate(()=>calls),[]);
    const exoticBlocked=await page.evaluate(async ({id,keeperId})=>{
      const plan=await rpc('prepare',{kind:'armor',ids:[id],targetId:'hunter',mode:'clean',limit:9});
      const vault=state.inventory.stores[0],keeper=vault.items.find(i=>i.id===keeperId);
      vault.items=vault.items.filter(i=>i!==keeper);
      try {await rpc('transfer',{token:plan.token});return false;}
      catch(e){return e.message.includes('retained armor replacement');}
      finally {vault.items.push(keeper);}
    },{id:snap.items[6].id,keeperId:snap.items[5].id});
    assert.equal(exoticBlocked,true);assert.deepEqual(await page.evaluate(()=>calls),[]);
    const perkChanged=await page.evaluate(async ({id,keeperId})=>{
      const plan=await rpc('prepare',{kind:'armor',ids:[id],targetId:'hunter',mode:'clean',limit:9});
      const keeper=state.inventory.stores[0].items.find(i=>i.id===keeperId),perk=keeper.sockets.allSockets.at(-1).plugged.plugDef;
      const original=perk.hash;perk.hash=10003;
      try {await rpc('transfer',{token:plan.token});return false;}
      catch(e){return e.message.includes('retained armor replacement');}
      finally {perk.hash=original;}
    },{id:snap.items[11].id,keeperId:snap.items[10].id});
    assert.equal(perkChanged,true);assert.deepEqual(await page.evaluate(()=>calls),[]);
    const moved=await page.evaluate(async ids=>{
      const plan=await rpc('prepare',{kind:'armor',ids,targetId:'hunter',mode:'clean',limit:9});
      if(Object.keys(plan.replacements).length!==5)throw Error('Missing retained references');
      return rpc('transfer',{token:plan.token});
    },[1,2,6,7,11].map(index=>snap.items[index].id));
    assert.equal(moved.moved,5);assert.ok((await page.evaluate(()=>calls)).every(c=>c.type==='store' && c.equip===false));
    assert.equal(moved.snapshot.items.find(i=>i.id===snap.items[0].id).locked,true);
    assert.equal(moved.snapshot.items.find(i=>i.id===snap.items[0].id).owner,'vault');
    assert.equal(moved.snapshot.characters[0].occupied['3448274439'],4);
    assert.equal(moved.snapshot.characters[0].occupied['1585787867'],1);
    for(const index of [5,10]) {assert.equal(moved.snapshot.items.find(i=>i.id===snap.items[index].id).locked,true);assert.equal(moved.snapshot.items.find(i=>i.id===snap.items[index].id).owner,'vault');}
    assert.deepEqual(errors,[]);
    console.log('PASS Armor DIM bridge: setless/untiered exotics, exact class-item perks, distinct archetypes/tuning and legacy protection, frozen keeper/perk rechecks, class restrictions, exact STORE without EQUIP and capacity updates');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
