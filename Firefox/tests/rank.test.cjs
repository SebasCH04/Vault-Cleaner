const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const {chromium:playwright}=require('playwright');const mod=require('@sparticuz/chromium');const engine=mod.default||mod;const root=path.resolve(__dirname,'..');
(async()=>{
 const id='6917530200300210001';let listener;let storage={vcGrades:{}};let tabWrites=0;
 const browserApi={runtime:{onMessage:{addListener:cb=>listener=cb}},storage:{local:{get:async()=>structuredClone(storage),set:async values=>Object.assign(storage,structuredClone(values))}},tabs:{create:async()=>{tabWrites++;}}};
 vm.runInNewContext(fs.readFileSync(root+'/background.js','utf8'),{browser:browserApi,URL,Date,Promise});
 const sender={url:'https://www.light.gg/god-roll/roll-appraiser/'};
 await listener({type:'save-grades',grades:{[id]:{grade:'S',currentGrade:'C',bestGrade:'S',basis:'best'}}},sender);
 assert.equal(storage.vcGrades[id].bestGrade,'S');assert.equal(storage.vcGrades[id].currentGrade,'C');
 const bestAt=storage.vcGrades[id].bestAt;await listener({type:'save-grades',grades:{[id]:{grade:'D',currentGrade:'D'}}},sender);
 assert.equal(storage.vcGrades[id].bestAt,bestAt);assert.equal(storage.vcGrades[id].bestGrade,'S');assert.equal(storage.vcGrades[id].currentGrade,'D');
 const before=JSON.stringify(storage);await listener({type:'save-grades',grades:{[id]:'F'}},{url:'https://example.com'});assert.equal(JSON.stringify(storage),before);
 assert.equal(listener({type:'apply-popular',id},{url:'https://app.destinyitemmanager.com'}),undefined);assert.equal(tabWrites,0);
 console.log('PASS storage: current and maximum persist separately; current capture does not renew old maximum; wrong origin/perk action rejected');
 const browser=await playwright.launch({executablePath:await engine.executablePath(),args:engine.args,headless:true});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent(`<main><article data-id="${id}"><span class="quality">C</span><span>↑ S Rank Possible</span><button onclick="window.perkClicks++">Equip Popular Perks</button></article><article data-id="6917530200300210002"><span data-current-grade="F"></span><span data-best-grade="C+"></span></article><article data-id="6917530200300210003"><span class="quality">C</span></article><article data-id="6917530200300210004"><span class="quality">D</span><span style="display:none">S Rank Possible</span></article></main>`);
  await page.evaluate(()=>{window.saved={};window.perkClicks=0;window.browser={runtime:{sendMessage:async msg=>{Object.assign(saved,msg.grades);return{total:Object.keys(saved).length};}}};});
  await page.addScriptTag({path:root+'/core.js'});await page.addScriptTag({path:root+'/lightgg-content.js'});
  await page.waitForFunction(()=>Object.keys(saved).length===4);
  const saved=await page.evaluate(()=>saved);assert.equal(saved[id].grade,'S');assert.equal(saved[id].currentGrade,'C');assert.equal(saved[id].bestGrade,'S');assert.equal(saved['6917530200300210002'].bestGrade,'C+');
  assert.equal(saved['6917530200300210003'].bestGrade,undefined);assert.equal(saved['6917530200300210004'].bestGrade,undefined);
  assert.equal(await page.evaluate(()=>perkClicks),0);
  await page.locator('#vc-best-mode').check();
  await page.waitForFunction(()=>saved['6917530200300210003'].bestGrade==='C');
  assert.equal((await page.evaluate(()=>saved['6917530200300210003'])).currentGrade,undefined);
  await page.locator('#vc-best-mode').uncheck();
  await page.waitForFunction(()=>saved['6917530200300210003'].bestGrade===undefined);
  console.log('PASS capture: C→S possible rank, explicit F→C+ maximum, hidden notice excluded, Best Available confirmation rescans without changing perks');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
