const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {chromium} = require('playwright');
const moduleValue = require('@sparticuz/chromium');
const engine = moduleValue.default || moduleValue;
const C = require('../core.js');

const root = path.resolve(__dirname,'..');
const origin = 'https://www.light.gg';
const location = origin+'/god-roll/roll-appraiser/';
const id = n => String(6917530200300240000n + BigInt(n));
const storage = {vcGrades:{}};
let receive;
const browserApi = {runtime:{onMessage:{addListener:callback=>receive=callback}},
  storage:{local:{get:async()=>structuredClone(storage),set:async value=>Object.assign(storage,structuredClone(value))}}};
vm.runInNewContext(fs.readFileSync(root+'/background.js','utf8'),{browser:browserApi,URL,Date});

(async () => {
  const browser = await chromium.launch({headless:true,executablePath:await engine.executablePath(),args:engine.args});
  try {
    const page = await browser.newPage({acceptDownloads:true});
    const errors = [];
    page.on('pageerror',error=>errors.push(error.message));
    const payload = {
      rolls:[
        {ItemInstanceId:id(1),BestAvailable:{Overall:{Grade:'S+',Score:243.5}},Equipped:{Grade:'A',OverallPercentage:84}},
        {itemInstanceId:id(2),bestAvailable:{overall:{grade:'S+',score:228.7}}},
        {instanceId:id(3),maximumRoll:{rank:'S+',overallRatio:0.98}},
        {instanceId:id(4),overall:99,grade:'S+',traitComboPercentage:100},
        {instanceId:id(5),bestAvailableRank:'S+',bestOverallPercent:96,bestOverallPercentage:99},
        {id:Number(id(6)),bestGrade:'S+',bestOverallPercentage:99},
        {instanceId:id(7),id:id(8),bestGrade:'S+',bestOverallPercentage:99},
        {instanceId:id(9),equippedGrade:'S+',equippedOverallPercentage:98},
        {instanceId:id(10),bestGrade:'S+',bestOverallRatio:0.91}
      ],
      unrelated:'do-not-export-me'
    };
    await page.route('**/*',async route=>{
      const url = new URL(route.request().url());
      if (url.href === location) return route.fulfill({
        contentType:'text/html',
        body:'<!doctype html><main>'+[1,2,3,10].map(n=>'<article data-instance-id="'+id(n)+'"><span class="quality">S</span></article>').join('')+'</main>'
      });
      if (url.pathname === '/api/inventory/rolls') return route.fulfill({json:payload});
      if (url.pathname === '/api/appraisals') return route.fulfill({json:{[id(11)]:{bestGrade:'A',bestOverallPercentage:76}}});
      return route.abort();
    });
    await page.exposeFunction('saveAppraisalMessage',message=>receive(message,{url:location}));
    await page.goto(location);
    await page.addScriptTag({path:root+'/core.js'});
    await page.addScriptTag({path:root+'/lightgg-network.js'});
    const original = await page.evaluate(async ()=>await (await fetch('/api/inventory/rolls')).json());
    assert.equal(original.unrelated,'do-not-export-me','Original request and response remain usable');
    await page.evaluate(()=>{window.browser={runtime:{sendMessage:message=>window.saveAppraisalMessage(message)}};});
    await page.addScriptTag({path:root+'/lightgg-content.js'});
    await page.locator('#vc-lightgg-status > summary').click();
    await page.locator('#vc-best-mode').check();
    await page.waitForFunction(()=>document.querySelector('#vc-lightgg-status').textContent.includes('4 Overall'));
    assert.equal(storage.vcGrades[id(1)].bestOverall,243.5);
    assert.equal(storage.vcGrades[id(1)].bestOverallScale,'score:bestavailable-overall-score');
    assert.equal(storage.vcGrades[id(1)].bestGrade,'S+','A coarse DOM S must preserve the response S+');
    assert.equal(storage.vcGrades[id(2)].bestOverall,228.7);
    assert.equal(storage.vcGrades[id(3)].bestOverall,98);
    assert.equal(storage.vcGrades[id(10)].bestOverall,91);
    for (const n of [4,5,6,7,8]) assert.equal(storage.vcGrades[id(n)],undefined);
    assert.equal(storage.vcGrades[id(9)].bestGrade,undefined);
    assert.equal(storage.vcGrades[id(9)].currentOverall,98);

    const sent = await page.evaluate(()=>new Promise((resolve,reject)=>{
      const xhr = new XMLHttpRequest();
      xhr.open('GET','/api/appraisals');
      xhr.responseType = 'json';
      xhr.addEventListener('load',()=>resolve(xhr.response));
      xhr.addEventListener('error',reject);
      xhr.send();
    }));
    assert.equal(sent[id(11)].bestOverallPercentage,76);
    await page.waitForFunction(()=>document.querySelector('#vc-lightgg-status').textContent.includes('5 Overall'));
    assert.equal(storage.vcGrades[id(11)].bestOverall,76);
    const weapon = n => ({id:id(n),weapon:true,owner:'vault',hash:10,bucket:'energy',locked:false,equipped:false});
    const weapons = [1,2,3,10].map(weapon);
    assert.equal(C.weaponCompare(weapons[0],weapons[2],storage.vcGrades),null);
    assert.ok(C.weaponCompare(weapons[0],weapons[1],storage.vcGrades)<0);
    assert.ok(C.weaponCompare(weapons[2],weapons[3],storage.vcGrades)<0);
    const records = C.weaponAnalysis(weapons,storage.vcGrades).records;
    assert.equal(records[id(1)].state,'tie');
    assert.equal(records[id(3)].state,'tie');
    assert.equal(records[id(2)].state,'duplicate');

    await page.locator('#vc-lightgg-status > summary').click();
    const pendingDownload = page.waitForEvent('download');
    await page.getByRole('button',{name:'Diagnostics',exact:true}).click();
    const reportText = fs.readFileSync(await (await pendingDownload).path(),'utf8');
    const report = JSON.parse(reportText);
    assert.equal(report.appraisal.responses,2);
    assert.equal(report.appraisal.maximumScores,5);
    assert.ok(report.appraisal.fields.some(field=>field.includes('overall')));
    assert.ok(!reportText.includes('do-not-export-me'));
    assert.ok(!reportText.includes(id(1)));
    assert.deepEqual(errors,[]);
    console.log('PASS appraisal responses: early fetch, XHR, exact identities, current versus maximum, score scales, DOM merge and redacted diagnostics.');

    await page.route(location, route=>route.fulfill({contentType:'text/html',body:'<!doctype html><main id="my-rolls"></main>'}));
    await page.goto(location);
    await page.evaluate(()=>{window.browser={runtime:{sendMessage:message=>window.saveAppraisalMessage(message)}};});
    await page.addScriptTag({path:root+'/core.js'});
    await page.addScriptTag({path:root+'/lightgg-model.js'});
    await page.addScriptTag({path:root+'/lightgg-content.js'});
    const rows = [
      {itemInstanceId:id(20),BestGrade:'S',BestAvgRank:0.31,EquippedGrade:'S',EquippedAvgRank:0.36},
      {itemInstanceId:id(21),BestGrade:'S',BestAvgRank:0.18,EquippedGrade:'S-',EquippedAvgRank:0.44},
      {itemInstanceId:id(22),BestGrade:'S-',BestAvgRank:0.43,Modified:true,EquippedGrade:'S-',EquippedAvgRank:0.44},
      {itemInstanceId:id(23),BestGrade:'S+',BestAvgRank:-0.04},
      {itemInstanceId:id(24),BestGrade:'S+',BestAvgRank:6},
      {itemInstanceId:id(25),BestGrade:'F-',BestAvgRank:6}
    ];
    // The model can mount after the extension and contain copies absent from the grid.
    await page.evaluate(rows=>{document.querySelector('#my-rolls').__vue__ = {$data:{Rolls:rows}};},rows);
    await page.waitForFunction(()=>document.querySelector('#vc-lightgg-status').textContent.includes('4 Overall'));
    assert.equal(storage.vcGrades[id(20)].bestOverall,0.31);
    assert.equal(storage.vcGrades[id(21)].bestOverall,0.18);
    assert.equal(storage.vcGrades[id(22)].currentOverall,undefined);
    assert.equal(storage.vcGrades[id(23)].bestOverall,-0.04);
    assert.equal(storage.vcGrades[id(24)],undefined);
    assert.equal(storage.vcGrades[id(25)],undefined);
    const before = storage.vcGrades[id(21)].bestOverallAt;
    await receive({type:'save-grades',source:'dom',grades:{[id(21)]:{grade:'A',bestGrade:'A',basis:'best'}}},{url:location});
    assert.equal(storage.vcGrades[id(21)].bestGrade,'S');
    assert.equal(storage.vcGrades[id(21)].bestOverallAt,before);
    const modelWeapons = [20,21,22].map(weapon);
    const modelRanking = C.weaponAnalysis(modelWeapons,storage.vcGrades).records;
    assert.equal(modelRanking[id(20)].keeperId,id(21));
    assert.equal(modelRanking[id(22)].keeperId,id(21));
    assert.equal(C.weaponDominates(modelWeapons[1],modelWeapons[0],storage.vcGrades),true);
    assert.deepEqual(errors,[]);
    console.log('PASS actual Roll Appraiser model shape: late Vue inventory, exact signed grades, lower native rank wins, invalid placeholders and perk previews excluded.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
