const {chromium:playwright}=require('playwright');const mod=require('@sparticuz/chromium');const engine=mod.default||mod;
const assert=require('node:assert/strict');const path=require('node:path');const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await playwright.launch({executablePath:await engine.executablePath(),args:engine.args,headless:true});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent(`<main>
   <article data-id="6917530200300210001"><span class="quality">C</span><span class="roll-tag"><i class="fa-arrow-up"></i> B- Rank Possible</span></article>
   <article data-id="6917530200300210002"><span class="quality">A</span><span title="S+ Rank Possible"><i class="fa-arrow-up"></i></span></article>
   <article data-id="6917530200300210003"><span class="quality">B</span><i class="fa-arrow-up"></i><button>Equip Popular Perks</button></article>
   <article data-id="6917530200300210004"><span class="quality">C+</span><span style="display:none">A Rank Possible</span></article>
   <article data-id="6917530200300210005"><span class="quality">D</span><span>No higher rank possible</span></article>
   <article data-id="6917530200300210006"><span data-current-grade="B-" data-id="6917530200300210006"></span><span>B- Rank Possible</span></article>
  </main>`);
  await page.evaluate(()=>{window.saved={};window.browser={runtime:{sendMessage:async msg=>{Object.assign(saved,msg.grades);return {total:Object.keys(saved).length};}}};});
  await page.addScriptTag({path:root+'/core.js'});await page.addScriptTag({path:root+'/lightgg-content.js'});
  await page.waitForFunction(()=>Object.keys(saved).length===6);
  const saved=await page.evaluate(()=>saved);
  assert.equal(saved['6917530200300210001'].bestGrade,'B-');assert.equal(saved['6917530200300210001'].rankImprovementSource,'badge');
  assert.equal(saved['6917530200300210002'].bestGrade,'S+');
  for(const id of ['6917530200300210003','6917530200300210004','6917530200300210005']) assert.equal(saved[id].higherRankPossible,false);
  assert.equal(saved['6917530200300210004'].bestGrade,undefined);
  const eligible=await page.evaluate(()=>Object.keys(saved).filter(id=>VaultCore.improvementFor({id,weapon:true},Object.fromEntries(Object.entries(saved).map(([id,r])=>[id,{...r,at:Date.now()}])))==='improvable'));
  assert.deepEqual(eligible,['6917530200300210001','6917530200300210002']);
  console.log('PASS rank badge: B- Rank Possible captures attainable rank; S+ title accepted; generic arrows/buttons, hidden badges, negative notices and equal ranks excluded');
  await page.evaluate(()=>document.querySelector('.roll-tag').remove());
  await page.waitForFunction(()=>saved['6917530200300210001'].higherRankPossible===false);
  console.log('PASS rank badge: disappearing arrow notice clears eligibility on recapture');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
