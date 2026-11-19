const assert=require('node:assert/strict');const path=require('node:path');const {chromium}=require('playwright');const m=require('@sparticuz/chromium');const engine=m.default||m;const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({executablePath:await engine.executablePath(),args:engine.args,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:1050}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setContent('<div id="app"></div>');
  await page.addScriptTag({path:root+'/core.js'});await page.addScriptTag({path:root+'/ui.js'});
  await page.evaluate(css=>{
   const buckets=['kinetic','energy','power'];const names=['Kinetic','Energy','Power'];
   const items=buckets.flatMap((bucket,j)=>Array.from({length:12},(_,i)=>({id:String(6917530200300500000n+BigInt(j*100+i)),name:`Weapon ${j}-${i}`,bucket,bucketName:names[j],weapon:true,owner:'vault',locked:false,equipped:false,perks:[]})));
   const manual={...items[0],id:'6917530200300509999',name:'Manual Unknown',locked:true,exotic:true};items.push(manual);
   const grades=Object.fromEntries(items.slice(0,36).map(item=>[item.id,{grade:'F',bestGrade:'F',currentGrade:'F',at:Date.now()}]));
   Object.assign(grades[items[0].id],{grade:'S',bestGrade:'S',currentGrade:'C'});
   window.snap={source:'demo',canTransfer:true,items,characters:[{id:'hunter',name:'Hunter',capacity:{kinetic:10,energy:10,power:10},occupied:{kinetic:1,energy:1,power:1}}]};window.lastPlan=null;let progress;
   mountVaultCleaner(document.getElementById('app'),css,{
    snapshot:async()=>structuredClone(snap),grades:async()=>structuredClone(grades),
    prepare:async payload=>{lastPlan={...payload,...VaultCore.planBatch(items,grades,payload.ids,snap.characters[0],payload.categories,payload.limit,payload.reserve,payload.mode,payload.batchMode),target:snap.characters[0],token:'fixture'};return structuredClone(lastPlan);},
    transfer:async()=>{for(const item of lastPlan.batch){item.owner='hunter';snap.characters[0].occupied[item.bucket]++;progress({moved:lastPlan.batch.indexOf(item)+1,total:lastPlan.batch.length,name:item.name,completedId:item.id});}return{moved:lastPlan.batch.length,snapshot:structuredClone(snap)};},
    onProgress:cb=>progress=cb,sync:async()=>{},search:async()=>{},stop:async()=>{}
   },true);
  },'file://'+root+'/panel.css');
  await page.waitForFunction(()=>document.getElementById('app').shadowRoot.getElementById('candidates').textContent==='35');
  assert.equal(await page.locator('#reserve').isChecked(),false);assert.equal(await page.locator('#limit').getAttribute('max'),'9');assert.match(await page.locator('#capacity').textContent(),/0 ready this batch · Limit per slot 9/);
  await page.locator('#select-visible').click();assert.equal(await page.locator('#selected-count').textContent(),'35');
  await page.locator('#batch-controls > summary').click();
  await page.locator('#prepare').click();assert.match(await page.locator('#review-title').textContent(),/^27 weapons/);
  const plan=await page.evaluate(()=>lastPlan);assert.deepEqual(plan.counts,{kinetic:9,energy:9,power:9});assert.ok(!plan.ids.includes('6917530200300500000'));assert.equal(plan.skipped.length,8);
  await page.locator('#cancel-plan').click();
  await page.locator('#batch-mode').selectOption('total');
  assert.equal(await page.locator('#limit-label').textContent(),'Max / batch');
  assert.equal(await page.locator('#limit').getAttribute('max'),'27');
  assert.equal(await page.locator('#selected-count').textContent(),'35');
  assert.match(await page.locator('#capacity').textContent(),/9 ready this batch · Total limit 9/);
  await page.locator('#prepare').click();
  const totalPlan=await page.evaluate(()=>lastPlan);
  assert.equal(totalPlan.batch.length,9);assert.equal(totalPlan.batchMode,'total');
  assert.match(await page.locator('#dialog').textContent(),/Total limit across all slots/);
  await page.locator('#cancel-plan').click();
  await page.locator('#limit').fill('12');await page.locator('#prepare').click();
  assert.equal((await page.evaluate(()=>lastPlan)).batch.length,12);
  await page.locator('#cancel-plan').click();
  await page.locator('#batch-mode').selectOption('slot');
  assert.equal(await page.locator('#limit').inputValue(),'9');
  await page.locator('#batch-mode').selectOption('total');
  await page.locator('#transfer-mode').selectOption('manual');assert.equal(await page.locator('#selected-count').textContent(),'0');
  await page.locator('#query').fill('Manual Unknown');const checkbox=page.locator('#rows input[type=checkbox]');assert.equal(await checkbox.isDisabled(),false);await checkbox.check();
  await page.locator('#prepare').click();assert.match(await page.locator('#dialog').textContent(),/Manual selection/);assert.deepEqual((await page.evaluate(()=>lastPlan)).ids,['6917530200300509999']);
  await page.locator('#confirm-plan').click();await page.waitForFunction(()=>document.getElementById('app').shadowRoot.getElementById('status').textContent.includes('1 weapon transferred and confirmed'));
  const moved=await page.evaluate(()=>snap.items.find(i=>i.id==='6917530200300509999'));assert.equal(moved.owner,'hunter');assert.equal(moved.locked,true);
  console.log('PASS UI: C→S protected; 27 per-slot vs 9/12 total; selection retained for sizing, cleared for transfer mode; ungraded/locked manual copy transferred without unlocking');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
