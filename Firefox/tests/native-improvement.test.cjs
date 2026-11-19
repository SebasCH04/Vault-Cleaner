const {chromium:playwright}=require('playwright');const mod=require('@sparticuz/chromium');const engine=mod.default||mod;
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await playwright.launch({executablePath:await engine.executablePath(),args:engine.args,headless:true});
 try {
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<main id="list"><article data-id="6917530200300190001"><span class="quality">A</span><img data-original-title="Higher Rank Possible"><button id="inspect">Inspect</button></article><article data-id="6917530200300190002"><span class="quality">B</span></article></main><section id="wrong-inspector"><button ng-click="EquipPopularPerks(Roll)">Equip Popular Perks</button></section><section id="inspector"></section>');
  await page.evaluate(()=>{
   window.saved={};window.nativeLog=[];for (const name of ['vc-lightgg-native-request','vc-lightgg-native-response']) document.addEventListener(name,e=>nativeLog.push({name,detail:JSON.parse(e.detail)}));window.handlers=[];window.calls={right:0,wrong:0};
   window.browser={runtime:{sendMessage:async msg=>{Object.assign(saved,msg.grades);return{total:Object.keys(saved).length};},onMessage:{addListener:fn=>handlers.push(fn)}}};
   const card=document.querySelector('article');
   card.__scope={Roll:{InstanceId:'6917530200300190001',CurrentPopularityRank:'D',BestPopularityRank:'A',CanImprove:true}};
   document.getElementById('wrong-inspector').__scope={Roll:{InstanceId:'6917530200300190002'}};
   document.querySelector('#wrong-inspector button').onclick=()=>calls.wrong++;
   window.angular={element:el=>({scope:()=>el.__scope})};
   document.getElementById('inspect').onclick=()=>{
    const inspector=document.getElementById('inspector');inspector.__scope=card.__scope;
    inspector.innerHTML='<button ng-click="EquipPopularPerks(Roll)">Equip Popular Perks</button>';
    inspector.querySelector('button').onclick=()=>{calls.right++;card.__scope.Roll.CurrentPopularityRank='A';card.__scope.Roll.CanImprove=false;};
   };
   window.runMessage=msg=>handlers[0](msg);
  });
  for (const script of ['core.js','lightgg-native.js','lightgg-content.js']) await page.addScriptTag({path:root+'/'+script});
  await page.waitForFunction(()=>saved['6917530200300190001']?.currentGrade==='D',{}, {timeout:5000}).catch(async e=>{console.log(await page.evaluate(()=>({saved,nativeLog,status:document.getElementById('vc-lightgg-status').textContent})));throw e;});
  const record=await page.evaluate(()=>saved['6917530200300190001']);
  assert.equal(record.bestGrade,'A');assert.equal(record.higherRankPossible,true);
  console.log('PASS native metadata: exact bound copy supplies current/maximum and improvement state');
  const probe=await page.evaluate(()=>runMessage({type:'vc-lightgg-probe',id:'6917530200300190001'}));assert.equal(probe.found,true);
  const result=await page.evaluate(()=>runMessage({type:'vc-lightgg-apply',id:'6917530200300190001'}));
  assert.equal(result.ok,true);assert.equal(result.status,'submitted');
  const calls=await page.evaluate(()=>calls);assert.equal(calls.right,1);assert.equal(calls.wrong,0);
  console.log('PASS native action: inspect exact copy, reject wrong inspector, click only its Equip Popular Perks once; status remains submitted');
  await page.evaluate(()=>document.querySelector('article').dataset.id='6917530200300190003');
  const recycled=await page.evaluate(()=>runMessage({type:'vc-lightgg-apply',id:'6917530200300190001'}));assert.equal(recycled.ok,false);
  assert.equal((await page.evaluate(()=>calls)).right,1);
  console.log('PASS native action: stale/recycled card cannot apply perks to a different copy');
  assert.deepEqual(errors,[]);
 } finally {await browser.close();}
 // Background routing is exercised independently with two open light.gg tabs.
 const grades={'6917530200300190001':{grade:'A',bestGrade:'A',at:Date.now()}};let listener;const actions=[];
 const fake={runtime:{onMessage:{addListener:fn=>listener=fn}},storage:{local:{get:async()=>({vcGrades:grades}),set:async()=>{}}},tabs:{query:async()=>[{id:1,active:true},{id:2,active:false}],update:async id=>actions.push(['activate',id]),sendMessage:async(id,msg)=>{actions.push([msg.type,id]);return msg.type==='vc-lightgg-probe' ? {found:id===2}:{ok:true,status:'submitted'};}}};
 vm.runInNewContext(fs.readFileSync(root+'/background.js','utf8'),{browser:fake,URL,Date});
 assert.equal(listener({type:'apply-popular',id:'6917530200300190001'},{url:'https://example.org'}),undefined);
 const reply=await listener({type:'apply-popular',id:'6917530200300190001'},{url:'https://app.destinyitemmanager.com/'});
 assert.equal(reply.status,'submitted');assert.equal(grades['6917530200300190001'],undefined);
 assert.deepEqual(actions,[['vc-lightgg-probe',1],['vc-lightgg-probe',2],['activate',2],['vc-lightgg-apply',2]]);
 console.log('PASS background: read-only probes choose tab with exact copy, one write routed there, stale grading invalidated');
})().catch(e=>{console.error(e);process.exitCode=1;});
