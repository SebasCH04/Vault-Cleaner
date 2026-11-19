const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const {chromium:playwright}=require('playwright');const mod=require('@sparticuz/chromium');const engine=mod.default||mod;const root=path.resolve(__dirname,'..');
(async()=>{
 const id='6917530200300210001';let listener;let storage={vcGrades:{[id]:{grade:'S',bestGrade:'S',currentGrade:'D',higherRankPossible:true,basis:'best',at:Date.now()}}};let tabWrites=0;
 const browserApi={runtime:{onMessage:{addListener:cb=>listener=cb}},storage:{local:{get:async()=>structuredClone(storage),set:async values=>Object.assign(storage,structuredClone(values))}},tabs:{create:async()=>{tabWrites++;}}};
 vm.runInNewContext(fs.readFileSync(root+'/background.js','utf8'),{browser:browserApi,URL,Date,Promise});
 const sender={url:'https://www.light.gg/god-roll/roll-appraiser/'};
 await listener({type:'save-grades',grades:{[id]:{grade:'D',bestGrade:'A',higherRankPossible:true}}},sender);
 assert.deepEqual(Object.keys(storage.vcGrades[id]).sort(),['at','basis','grade','source']);assert.equal(storage.vcGrades[id].grade,'D');assert.equal(storage.vcGrades[id].basis,'displayed');
 const before=JSON.stringify(storage);await listener({type:'save-grades',grades:{[id]:'F'}},{url:'https://example.com'});assert.equal(JSON.stringify(storage),before);
 assert.equal(listener({type:'apply-popular',id},{url:'https://app.destinyitemmanager.com'}),undefined);assert.equal(tabWrites,0);
 console.log('PASS storage: fresh displayed rank replaces old maximum data; wrong origin rejected; removed perk action does nothing');
 const browser=await playwright.launch({executablePath:await engine.executablePath(),args:engine.args,headless:true});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent(`<main><article data-id="${id}"><span class="quality">D</span><span>↑ B- Rank Possible</span><button onclick="window.perkClicks++">Equip Popular Perks</button></article><article data-id="6917530200300210002"><span data-current-grade="C+"></span><span data-best-grade="S"></span></article></main>`);
  await page.evaluate(()=>{window.saved={};window.perkClicks=0;window.browser={runtime:{sendMessage:async msg=>{Object.assign(saved,msg.grades);return{total:Object.keys(saved).length};}}};});
  await page.addScriptTag({path:root+'/core.js'});await page.addScriptTag({path:root+'/lightgg-content.js'});
  await page.waitForFunction(()=>Object.keys(saved).length===2);
  const saved=await page.evaluate(()=>saved);assert.equal(saved[id].grade,'D');assert.equal(saved['6917530200300210002'].grade,'C+');assert.deepEqual(Object.keys(saved[id]).sort(),['basis','grade']);
  assert.equal(await page.locator('#vc-lightgg-status input').count(),0);assert.deepEqual(await page.locator('#vc-lightgg-status button').allTextContents(),['Detener captura','Diagnóstico']);assert.equal(await page.evaluate(()=>perkClicks),0);
  await page.evaluate(()=>document.querySelector('.quality').textContent='B+');
  await page.waitForFunction(()=>saved['6917530200300210001'].grade==='B+');
  console.log('PASS capture: displayed ranks only, no maximum confirmation, no perk changes; changed rank is recaptured');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
