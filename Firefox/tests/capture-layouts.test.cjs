const { chromium:playwright }=require('playwright');
const engine=require('@sparticuz/chromium');const chromium=engine.default||engine;
const assert=require('node:assert/strict');const path=require('node:path');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await playwright.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});
 try {
  const page=await browser.newPage({acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<main id="cards"></main>');
  await page.evaluate(()=>{
   const list=document.getElementById('cards');
   const card=document.createElement('article');card.id='weapon_6917530200300170001';
   // Layout regression: cards can contain many perk icons before their rank.
   for(let i=0;i<240;i++)card.append(document.createElement('span'));
   card.insertAdjacentHTML('beforeend','<div><span class="tags">PVE · S+</span></div>');list.append(card);
   list.insertAdjacentHTML('beforeend',[
    '<article data-iteminstanceid="i6917530200300170002"><div class="quality"><span>D</span></div></article>',
    '<article data-inst="weapon_6917530200300170003"><img src="/quality-c-text.svg"></article>',
    '<article data-instance-id="6917530200300170004" data-owner="6917530200300999999"><span data-roll-grade="F"></span></article>',
    '<article data-id="6917530200300170005"><span class="quality">N/A</span><span>God Roll</span></article>',
    '<article data-id="6917530200300170006"><span class="quality">D</span><span class="quality">F</span></article>',
    '<article data-id="6917530200300170007"><span data-id="6917530200300170008"></span><span class="quality">F</span></article>',
    '<article data-id="6917530200300170009"><span class="tags">A</span><span class="quality" title="Popularity (B)"></span></article>'
   ].join(''));
   window.saved={};window.browser={runtime:{sendMessage:async msg=>{Object.assign(saved,msg.grades);return{total:Object.keys(saved).length};}}};
   window.secret='do-not-export-me';
   list.insertAdjacentHTML('beforeend','<input type="hidden" name="csrf" value="do-not-export-me">');
  });
  await page.addScriptTag({path:root+'/core.js'});await page.addScriptTag({path:root+'/lightgg-content.js'});
  await page.waitForFunction(()=>document.getElementById('vc-lightgg-status').textContent.startsWith('Capture complete'),{},{timeout:30000});
  const captured=await page.evaluate(()=>saved);
  assert.equal(captured['6917530200300170001']?.grade,'S+');assert.equal(captured['6917530200300170002']?.grade,'D');assert.equal(captured['6917530200300170003']?.grade,'C');assert.equal(captured['6917530200300170004']?.grade,'F');assert.equal(captured['6917530200300170009']?.grade,'B');
  for(const id of ['6917530200300170005','6917530200300170006','6917530200300170007','6917530200300170008'])assert.equal(captured[id],undefined);
  console.log('PASS capture: large perk cards, text grades, source grades, prefixed IDs and explicit grade attributes');
  console.log('PASS capture: N/A, God Roll text, contradictory ranks and multiple copy IDs excluded');
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Diagnostics',exact:true}).click();const download=await downloadPromise;
  const fs=require('node:fs');const raw=fs.readFileSync(await download.path(),'utf8');const report=JSON.parse(raw);
  assert.equal(report.version,'0.3.1');assert.equal(report.capturedThisSession,5);assert.ok(report.counters.ids>=8);assert.ok(!raw.includes('do-not-export-me'));
  assert.ok(report.samples.identifiers.length>0);assert.ok(report.samples.markers.length>0);
  console.log('PASS diagnostic: useful counters and markup samples; hidden form values excluded');
  await page.evaluate(()=>document.querySelector('[data-inst]').setAttribute('data-inst','weapon_6917530200300170010'));
  await page.waitForFunction(()=>saved['6917530200300170010']?.grade==='C',{},{timeout:15000});
  console.log('PASS capture: changed custom instance attribute is observed after automatic discovery');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
