const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {chromium}=require('playwright');
const mod=require('./browser-engine.cjs'),engine=mod.default||mod;
const root=path.resolve(__dirname,'..');
(async()=>{
 let listener,now=Date.now();const storage={vcGrades:{}};
 class Clock extends Date {static now(){return now;}}
 const api={runtime:{onMessage:{addListener:fn=>listener=(msg,sender)=>new Promise(resolve=>{if(fn(msg,sender,resolve)!==true)resolve(undefined);})}},storage:{local:{get:async()=>structuredClone(storage),set:async v=>Object.assign(storage,structuredClone(v))}}};
 vm.runInNewContext(fs.readFileSync(root+'/background.js','utf8'),{browser:api,URL,Date:Clock,Promise});
 const id='6917530200300220001',sender={url:'https://www.light.gg/god-roll/roll-appraiser/'};
 const save=r=>listener({type:'save-grades',grades:{[id]:r}},sender);
 await save({grade:'S',bestGrade:'S',bestOverall:93.25,currentGrade:'C',currentOverall:40,basis:'best'});
 assert.equal(storage.vcGrades[id].bestOverallGrade,'S');assert.equal(storage.vcGrades[id].currentOverallGrade,'C');
 const original=storage.vcGrades[id].bestOverallAt;now+=6000;
 await save({grade:'D',currentGrade:'D',currentOverall:20});
 assert.equal(storage.vcGrades[id].bestOverall,93.25);assert.equal(storage.vcGrades[id].bestOverallAt,original);
 assert.equal(storage.vcGrades[id].currentOverallAt,now);
 await save({grade:'S',bestGrade:'S',basis:'best'});assert.equal(storage.vcGrades[id].bestOverall,undefined);
 await save({grade:'S+',bestGrade:'S+',bestOverall:100,basis:'best'});assert.equal(storage.vcGrades[id].bestOverallGrade,'S+');
 now+=48*60*60*1000+1;await save({grade:'F',currentGrade:'F',currentOverall:0});
 assert.equal(storage.vcGrades[id].bestGrade,undefined);assert.equal(storage.vcGrades[id].bestOverall,undefined);assert.equal(storage.vcGrades[id].currentOverall,0);
 for(const bad of [-1,101,NaN,Infinity,'90%']) {await save({grade:'B',bestGrade:'B',bestOverall:bad});assert.equal(storage.vcGrades[id].bestOverall,undefined);}
 console.log('PASS Overall storage: grade-bound percentages, independent freshness, no score renewal from current capture, absent/invalid/expired scores discarded');
 const browser=await chromium.launch({executablePath:await engine.executablePath(),args:engine.args,headless:true});
 try {
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const iid=n=>String(6917530200300220000n+BigInt(n));
  const cards=[
   '<span class="quality">C</span><span>↑ S Rank Possible</span><span>Overall: 42%</span>',
   '<span data-current-grade="F" data-current-overall="0"></span><span data-best-grade="A" data-best-overall="90.5"></span>',
   '<span class="quality">A</span><div><span>Overall</span><b>92,75%</b></div>',
   '<span class="quality">B</span><span>Perks: 99%</span><span>Trait Combo: 100%</span><span style="display:none">Overall: 88%</span>',
   '<span class="quality">A</span><span>Overall: 81%</span><span>Overall: 82%</span>',
   '<span data-best-grade="S+"></span><span title="Best Available Overall: 100%"></span>',
   '<span class="quality">B</span><span class="overall-score">79.3%</span>',
   '<span data-best-grade="S" data-best-overall="101"></span>',
   '<span data-best-grade="S-" data-best-overall="94" data-current-overall="20"></span>',
   '<span data-current-grade="C"></span><span data-best-grade="A"></span><span>Current Overall: 50%</span><span>Best Available Overall: 86.1%</span>',
   '<span class="quality">B</span><span>Overall: -5%</span>'
  ];
  await page.setContent('<main>'+cards.map((c,n)=>`<article data-id="${iid(n+1)}">${c}<button onclick="window.perkClicks++">Change perks</button></article>`).join('')+'</main>');
  await page.evaluate(()=>{window.saved={};window.perkClicks=0;window.browser={runtime:{sendMessage:async m=>{Object.assign(saved,m.grades);return {total:Object.keys(saved).length};}}};});
  await page.addScriptTag({path:root+'/core.js'});await page.addScriptTag({path:root+'/lightgg-content.js'});
  await page.waitForFunction(()=>Object.keys(saved).length===11);
  let captured=await page.evaluate(()=>saved);
  assert.equal(captured[iid(1)].bestGrade,'S');assert.equal(captured[iid(1)].currentOverall,42);assert.equal(captured[iid(1)].bestOverall,undefined);
  assert.equal(captured[iid(2)].bestOverall,90.5);assert.equal(captured[iid(2)].currentOverall,0);
  assert.equal(captured[iid(3)].currentOverall,92.75);
  assert.equal(captured[iid(4)].currentOverall,undefined);assert.equal(captured[iid(5)].currentOverall,undefined);
  assert.equal(captured[iid(6)].bestOverall,100);assert.equal(captured[iid(7)].currentOverall,79.3);
  assert.equal(captured[iid(8)].bestOverall,undefined);assert.equal(captured[iid(9)].bestOverall,94);
  assert.equal(captured[iid(10)].currentOverall,50);assert.equal(captured[iid(10)].bestOverall,86.1);
  assert.equal(captured[iid(11)].currentOverall,undefined);assert.equal(await page.evaluate(()=>perkClicks),0);
  await page.locator('#vc-best-mode').check();
  await page.waitForFunction(id=>saved[id].bestOverall===92.75,iid(3));
  captured=await page.evaluate(()=>saved);
  assert.equal(captured[iid(1)].bestOverall,undefined);assert.equal(captured[iid(1)].bestGrade,'S');
  // A possible S must never borrow the percentage displayed for C.
  assert.equal(captured[iid(4)].bestOverall,undefined);assert.equal(captured[iid(5)].bestOverall,undefined);
  await page.evaluate(id=>document.querySelector(`[data-id="${id}"] b`).firstChild.nodeValue='93.5%',iid(3));
  await page.waitForFunction(id=>saved[id].bestOverall===93.5,iid(3),{timeout:15000});
  await page.evaluate(id=>{const card=document.querySelector(`[data-id="${id}"]`);card.querySelector('.quality').textContent='S';card.querySelector('span:last-of-type').textContent='Overall: 96%';},iid(1));
  await page.waitForFunction(id=>saved[id].bestOverall===96,iid(1),{timeout:15000});
  assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>perkClicks),0);
  console.log('PASS Overall capture: explicit/current/maximum labels, split labels, decimal percentages, hidden and per-perk exclusion, conflicting scores, grade roles, text updates and read-only scanning');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
