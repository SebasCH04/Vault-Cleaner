const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname,'../background.js'),'utf8');
const id = n => String(6917530200300330000n + BigInt(n));
const sender = {url:'https://www.light.gg/god-roll/roll-appraiser/'};

function worker(storage = {}, fail = {}) {
  let listener, tabCalls = 0;
  const chrome = {
    runtime:{onMessage:{addListener:fn=>{listener=fn;}}},
    storage:{local:{
      get:async()=>{if (fail.read) throw Error('Storage unavailable'); await Promise.resolve(); return structuredClone(storage);},
      set:async values=>{if (fail.write) throw Error('Storage quota reached'); Object.assign(storage,structuredClone(values));}
    }},
    tabs:{create:async options=>{tabCalls++; if (fail.tabs) throw Error('Tab could not be opened'); return {id:1,url:options.url};}}
  };
  // A service worker has no window, document, localStorage or Firefox namespace.
  vm.runInNewContext(source,{chrome,URL,Date,Promise});
  function request(msg,from = sender) {
    return new Promise((resolve,reject)=>{
      const returned=listener(msg,from,resolve);
      if (returned !== true && returned !== false) return reject(Error('Chrome listener must return a boolean'));
      if (returned === false) resolve(undefined);
    });
  }
  return {storage,fail,request,tabCalls:()=>tabCalls};
}

test('Chrome callback replies keep the message channel open and merge concurrent capture writes',async()=>{
  const w=worker();
  const results=await Promise.all(Array.from({length:24},(_,n)=>w.request({type:'save-grades',grades:{[id(n)]:{
    grade:n%2 ? 'A' : 'S+',bestGrade:n%2 ? 'A' : 'S+',bestOverall:80+n/10,basis:'best'
  }}})));
  assert.equal(Object.keys(w.storage.vcGrades).length,24);
  assert.equal(results.at(-1).total,24);
  assert.ok(results.every(r=>r.saved===1 && !r.vcError));
  assert.equal(w.storage.vcGrades[id(0)].bestOverallGrade,'S+');
});

test('Chrome service worker restart preserves saved ranks, Overall and keeper choices',async()=>{
  const store={vcWeaponKeepers:{'[7,"kinetic"]':id(0)}};
  const first=worker(store);
  await first.request({type:'save-grades',grades:{[id(0)]:{grade:'S',bestGrade:'S',bestOverall:97,basis:'best'}}});
  const bestAt=store.vcGrades[id(0)].bestAt;
  const second=worker(store);
  const result=await second.request({type:'save-grades',grades:{[id(0)]:{grade:'C',currentGrade:'C',currentOverall:22}}});
  assert.equal(result.saved,1);assert.equal(store.vcGrades[id(0)].bestAt,bestAt);
  assert.equal(store.vcGrades[id(0)].bestOverall,97);assert.equal(store.vcWeaponKeepers['[7,"kinetic"]'],id(0));
});

test('Chrome write failures are returned to the sender and do not poison later captures',async()=>{
  const w=worker({}, {write:true});
  const msg={type:'save-grades',grades:{[id(1)]:{grade:'A',bestGrade:'A'}}};
  assert.match((await w.request(msg)).vcError,/quota/);
  assert.equal(w.storage.vcGrades,undefined);
  w.fail.write=false;
  assert.equal((await w.request(msg)).saved,1);
});

test('Chrome sync opens the original light.gg URL and reports failures',async()=>{
  const w=worker();
  assert.equal((await w.request({type:'open-sync'},{url:'https://app.destinyitemmanager.com/'})).url,'https://www.light.gg/god-roll/roll-appraiser/?vaultcleaner=sync');
  assert.equal(w.tabCalls(),1);w.fail.tabs=true;
  assert.match((await w.request({type:'open-sync'})).vcError,/Tab/);
});

test('Wrong-origin writes and unsupported perk-changing messages are ignored',async()=>{
  const w=worker();
  assert.equal(await w.request({type:'save-grades',grades:{[id(2)]:'F'}},{url:'https://example.com/'}),undefined);
  assert.equal(await w.request({type:'apply-popular',id:id(2)}),undefined);
  assert.equal(w.storage.vcGrades,undefined);assert.equal(w.tabCalls(),0);
});
