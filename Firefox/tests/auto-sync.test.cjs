const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname,'..');
const id = '6917530200300410021';
const other = '6917530200300410022';
const dim = {url:'https://app.destinyitemmanager.com/',tab:{id:1,windowId:2},frameId:0};
const appraiser = 'https://www.light.gg/god-roll/roll-appraiser/?vaultcleaner=background';
const starter = {type:'vc-auto-sync-start',account:'1234567890123456789-d2',ids:[id]};
const appraisal = {grade:'S',basis:'best',bestGrade:'S',bestOverall:0.21,bestOverallScale:'lightgg-average-rank'};

function fixture() {
  const messages = [], opened = [], closed = [], alarms = new Map();
  const hooks = {};
  const event = name=>({addListener:fn=>{hooks[name]=fn;}});
  const now = Date.now();
  let time = now;
  class Clock extends Date {static now() {return time;}}
  const storage = {};
  const session = {};
  const area = data=>({
    get:async key=>key ? {[key]:structuredClone(data[key])} : structuredClone(data),
    set:async next=>Object.assign(data,structuredClone(next))
  });
  const browser = {
    runtime:{onMessage:{addListener:listener=>messages.push(listener)}},
    storage:{local:area(storage),session:area(session)},
    tabs:{create:async options=>{opened.push(structuredClone(options));return {id:opened.length+10};},
      remove:async id=>closed.push(id),onRemoved:event('removed'),onUpdated:event('updated')},
    alarms:{create:(name,options)=>alarms.set(name,options.when),clear:async name=>alarms.delete(name),
      onAlarm:event('alarm')}
  };
  const context = vm.createContext({browser,URL,Date:Clock});
  for (const file of ['background.js','auto-sync.js']) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
  const sender = (id=11,url=appraiser)=>({url,tab:{id},frameId:0});
  const send = async (value,origin=dim) => {
    for (const receive of messages) {
      const result = receive(value,origin);
      if (result !== undefined) return result;
    }
  };
  return {send,sender,opened,closed,storage,hooks,alarms,elapse:ms=>{time+=ms;}};
}

test('A DIM panel gets one inactive tab and only matching grades are saved',async()=>{
  const f = fixture();
  const states = await Promise.all([f.send(starter),f.send(starter)]);
  assert.deepEqual(states.map(state=>state.status),['running','running']);
  assert.deepEqual(f.opened,[{url:appraiser,active:false,windowId:2}]);
  assert.equal(await f.send({type:'vc-auto-sync-ready'},f.sender(99)),false);
  assert.equal(await f.send({type:'vc-auto-sync-ready'},f.sender()),true);
  const result = await f.send({type:'vc-auto-sync-complete',grades:{[id]:appraisal,[other]:appraisal}},f.sender());
  assert.equal(result.status,'done');
  assert.equal(result.matched,1);
  assert.deepEqual(f.closed,[11]);
  assert.equal(f.alarms.size,0);
  assert.equal(f.storage.vcGrades[id].bestOverall,0.21);
  assert.equal(f.storage.vcGrades[other],undefined);
  assert.equal((await f.send(starter)).status,'done');
  assert.equal(f.opened.length,1);
  assert.equal((await f.send({...starter,force:true})).status,'running');
  assert.equal(f.opened.length,2);
});

test('A login prompt and a timeout close only the automatically opened tab and preserve cache',async()=>{
  const f = fixture();
  await f.send({type:'save-grades',source:'appraisal-model',grades:{[id]:appraisal}},f.sender(42));
  await f.send(starter);
  const login = await f.send({type:'vc-auto-sync-login'},f.sender());
  assert.equal(login.status,'login');
  assert.deepEqual(f.closed,[11]);
  assert.equal(f.storage.vcGrades[id].bestOverall,0.21);
  assert.equal((await f.send(starter)).status,'login');
  await f.send({...starter,force:true});
  f.elapse(120000);
  f.hooks.alarm({name:'vault-cleaner-auto-sync'});
  assert.equal((await f.send(starter)).status,'timeout');
  assert.deepEqual(f.closed,[11,12]);
  assert.equal(f.storage.vcGrades[id].bestOverall,0.21);
});

test('No matches or a manually closed auto tab do not erase saved grades',async()=>{
  const f = fixture();
  await f.send({type:'save-grades',source:'appraisal-model',grades:{[id]:appraisal}},f.sender(42));
  await f.send(starter);
  assert.equal((await f.send({type:'vc-auto-sync-complete',grades:{[other]:appraisal}},f.sender())).status,'no-matches');
  await f.send({...starter,force:true});
  f.hooks.removed(42);
  assert.equal((await f.send(starter)).status,'running');
  f.hooks.removed(12);
  assert.equal((await f.send(starter)).status,'interrupted');
  assert.deepEqual(f.closed,[11]);
  assert.equal(f.storage.vcGrades[id].bestOverall,0.21);
});
