const {chromium:playwright} = require('playwright');
const engine = require('@sparticuz/chromium');
const chromium = engine.default || engine;
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
(async () => {
  const browser = await playwright.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});
  try {
    const page = await browser.newPage();
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.setContent('<html><body><main id="list"></main></body></html>');
    await page.evaluate(() => {
      const list=document.getElementById('list');
      for(let i=0;i<1300;i++) {
        const card=document.createElement('article'); card.dataset.id=String(6917530200000000000n+BigInt(i));
        const wrap=document.createElement('div');
        const img=document.createElement('img'); img.className='quality';img.title='Popularity (D)';wrap.append(img);card.append(wrap);
        for(let j=0;j<28;j++)card.append(document.createElement('span'));
        list.append(card);
      }
      // Reproduce the expensive ancestor path: grade cards without an ID near
      // a huge page. They must be rejected without traversing the whole page.
      for(let i=0;i<200;i++){
        const group=document.createElement('section');
        for(let j=0;j<125;j++)group.append(document.createElement('span'));
        const image=document.createElement('img');image.className='quality';image.title='Popularity (F)';group.append(image);list.append(group);
      }
      window.saved={};window.messages=0;window.longTasks=[];window.scans=0;window.maxDelay=0;
      window.browser={runtime:{sendMessage:async msg=>{messages++;Object.assign(saved,msg.grades);return {total:Object.keys(saved).length};}}};
      const createTreeWalker=document.createTreeWalker.bind(document);
      document.createTreeWalker=function(root,...args){if(root===document.body)scans++;return createTreeWalker(root,...args);};
      const observer=new PerformanceObserver(entries=>longTasks.push(...entries.getEntries().map(e=>e.duration)));
      observer.observe({entryTypes:['longtask']});
      let last=performance.now();window.heartbeat=setInterval(()=>{const now=performance.now();maxDelay=Math.max(maxDelay,now-last);last=now;},25);
      window.nativeFetch=fetch;window.nativeXHROpen=XMLHttpRequest.prototype.open;
    });
    // Finish fixture layout before measuring extension work, so initial page
    // construction is not counted as capture-induced event-loop delay.
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.waitForTimeout(150);
    await page.evaluate(()=>{maxDelay=0;longTasks.length=0;});
    await page.addScriptTag({path:root+'/core.js'});
    await page.addScriptTag({path:root+'/lightgg-content.js'});
    await page.waitForFunction(()=>Object.keys(saved).length===1300,{},{timeout:30000});
    await page.waitForTimeout(2500);
    const metrics=await page.evaluate(()=>({captured:Object.keys(saved).length,scans,messages,maxDelay,longTasks,nodes:document.querySelectorAll('*').length,untouched:fetch===nativeFetch&&XMLHttpRequest.prototype.open===nativeXHROpen}));
    assert.equal(metrics.captured,1300);assert.equal(metrics.scans,1);assert.ok(metrics.untouched);
    assert.ok(metrics.maxDelay<250,JSON.stringify(metrics));
    assert.equal(metrics.longTasks.length,0,JSON.stringify(metrics));
    console.log('PASS large page: '+JSON.stringify(metrics));
    await page.locator('#vc-lightgg-status > summary').click();
    await page.getByRole('button',{name:'Stop capture',exact:true}).click();
    await page.evaluate(()=>{
      const card=document.createElement('div');card.dataset.id='6917530200300169999';card.innerHTML='<img class="quality" title="Popularity (F)">';document.getElementById('list').append(card);
    });
    await page.waitForTimeout(2500);
    const paused=await page.evaluate(()=>({scans,captured:Object.hasOwn(saved,'6917530200300169999'),text:document.getElementById('vc-lightgg-status').textContent}));
    assert.equal(paused.scans,1);assert.equal(paused.captured,false);assert.match(paused.text,/Stopped/);
    console.log('PASS Stop: no background rescans or capture after DOM changes');
    await page.getByRole('button',{name:'Resume capture',exact:true}).click();
    await page.waitForFunction(()=>Object.hasOwn(saved,'6917530200300169999'),{},{timeout:30000});
    console.log('PASS Resume: new weapons are captured without page reload');
    // Recycled cards: same image and grade, changed instance identity.
    await page.evaluate(()=>document.querySelector('article').dataset.id='6917530200300169998');
    await page.waitForFunction(()=>Object.hasOwn(saved,'6917530200300169998'),{},{timeout:30000});
    console.log('PASS virtualized card: changed copy identity causes a new scan');
    assert.deepEqual(errors,[]);
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
