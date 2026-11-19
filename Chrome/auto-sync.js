'use strict';
(() => {
  const URL_BASE = 'https://www.light.gg/god-roll/roll-appraiser/';
  const JOB_KEY = 'vcAutoSyncJob', STATUS_KEY = 'vcAutoSyncStatus', TIMEOUT = 'vault-cleaner-auto-sync';
  const DIM = new Set(['https://app.destinyitemmanager.com','https://beta.destinyitemmanager.com']);
  const MAX_WAIT = 120000, SUCCESS_RETRY = 15 * 60 * 1000, FAILURE_RETRY = 2 * 60 * 1000;
  let actions = Promise.resolve();

  function serialize(action) {
    actions = actions.catch(()=>{}).then(action);
    return actions;
  }
  async function job() {
    return (await browser.storage.session.get(JOB_KEY))[JOB_KEY];
  }
  async function publish(state, status, matched = 0) {
    const result = {status,matched,account:state.account};
    await browser.storage.session.set({[JOB_KEY]:{...state,result}});
    await browser.storage.local.set({[STATUS_KEY]:result});
    return result;
  }
  async function finish(state, status, matched = 0, close = true) {
    const result = await publish({account:state.account,at:Date.now()},status,matched);
    await browser.alarms.clear(TIMEOUT);
    if (close) await browser.tabs.remove(state.tabId).catch(()=>{});
    return result;
  }
  async function start(message, sender) {
    const ids = [...new Set((Array.isArray(message.ids) ? message.ids : []).slice(0,2500)
      .filter(id=>typeof id === 'string' && /^\d{18,20}$/.test(id)))];
    if (!ids.length || typeof message.account !== 'string' || !/^\d{1,20}-d2$/.test(message.account)) return;
    let previous = await job();
    if (previous?.tabId !== undefined) {
      if (Date.now() < previous.deadline) return previous.account === message.account ? previous.result : {status:'other-running'};
      await finish(previous,'timeout');
      previous = await job();
    }
    if (!message.force && previous?.account === message.account &&
        Date.now()-previous.at < (previous.result.status === 'done' ? SUCCESS_RETRY : FAILURE_RETRY)) return previous.result;
    const state = {account:message.account,ids,deadline:Date.now()+MAX_WAIT};
    let tab;
    try {
      tab = await browser.tabs.create({url:URL_BASE+'?vaultcleaner=background',active:false,windowId:sender.tab.windowId});
      state.tabId = tab.id;
      browser.alarms.create(TIMEOUT,{when:state.deadline});
      return await publish(state,'running');
    } catch {
      await browser.alarms.clear(TIMEOUT);
      if (tab) await browser.tabs.remove(tab.id).catch(()=>{});
      return publish({account:state.account,at:Date.now()},'error');
    }
  }
  async function receive(message, sender) {
    const state = await job();
    if (state?.tabId === undefined || state.tabId !== sender.tab?.id) return false;
    if (Date.now() >= state.deadline) return finish(state,'timeout');
    if (message.type === 'vc-auto-sync-ready') return true;
    if (message.type === 'vc-auto-sync-login') return finish(state,'login');
    const ids = new Set(state.ids), grades = {};
    for (const [id,record] of Object.entries(message.grades || {})) {
      if (ids.has(id) && record?.bestOverallScale === 'lightgg-average-rank' && Number.isFinite(record.bestOverall) &&
          record.bestOverall >= -0.25 && record.bestOverall <= 8 && record.bestGrade === record.grade) grades[id] = record;
    }
    try {
      const {saved} = await saveGrades({grades,source:'appraisal-model'});
      return finish(state,saved ? 'done' : 'no-matches',saved);
    } catch { return finish(state,'error'); }
  }

  browser.runtime.onMessage.addListener((message,sender) => {
    if (!sender.tab || !sender.url) return;
    const url = new URL(sender.url);
    if (message.type === 'vc-auto-sync-start' && DIM.has(url.origin)) return serialize(()=>start(message,sender));
    if (sender.frameId === 0 && url.origin === new URL(URL_BASE).origin && url.pathname === '/god-roll/roll-appraiser/' &&
        url.searchParams.get('vaultcleaner') === 'background' &&
        ['vc-auto-sync-ready','vc-auto-sync-complete','vc-auto-sync-login'].includes(message.type)) {
      return serialize(()=>receive(message,sender));
    }
  });
  browser.alarms.onAlarm.addListener(alarm=>{
    if (alarm.name !== TIMEOUT) return;
    void serialize(async()=> {
      const state = await job();
      if (state?.tabId === undefined) return;
      if (Date.now() >= state.deadline) await finish(state,'timeout');
      else browser.alarms.create(TIMEOUT,{when:state.deadline});
    }).catch(()=>{});
  });
  browser.tabs.onRemoved.addListener(id=>{
    void serialize(async()=> {
      const state = await job();
      if (state?.tabId === id) await finish(state,'interrupted',0,false);
    }).catch(()=>{});
  });
  browser.tabs.onUpdated.addListener((id,change)=>{
    if (!change.url || !/^https:\/\/(?:www\.)?light\.gg\/(?:[^/?]+\/)*(?:login|sign-?in)(?:[/?#]|$)/i.test(change.url)) return;
    void serialize(async()=>{
      const state = await job();
      if (state?.tabId === id) await finish(state,'login');
    }).catch(()=>{});
  });
})();
