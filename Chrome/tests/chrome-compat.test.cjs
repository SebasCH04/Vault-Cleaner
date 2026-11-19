const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const script = fs.readFileSync(path.resolve(__dirname,'../chrome-api.js'),'utf8');

test('Chrome versions with a native browser namespace keep using it',()=>{
  const browser = {};
  const context = {browser};
  vm.runInNewContext(script,context);
  assert.equal(context.browser,browser);
});

test('Chrome versions without the namespace can reply asynchronously from the worker',async()=>{
  let handle;
  const context = {
    chrome:{runtime:{
      onMessage:{addListener:listener=>{handle=listener;}},
      sendMessage:async ()=>({vcError:'Failed to store grades'})
    }}
  };
  vm.runInNewContext(script,context);
  context.browser.runtime.onMessage.addListener(message=>{
    if (message === 'sync') return Promise.resolve('running');
    if (message === 'fail') return Promise.reject(new Error('Failed to store grades'));
  });
  assert.equal(handle('ignored',{},()=>assert.fail('Unrecognized message received a response')),false);
  const reply = message=>new Promise(resolve=>assert.equal(handle(message,{},resolve),true));
  assert.equal(await reply('sync'),'running');
  assert.equal((await reply('fail')).vcError,'Failed to store grades');
  await assert.rejects(context.browser.runtime.sendMessage('fail'),/Failed to store grades/);
});
