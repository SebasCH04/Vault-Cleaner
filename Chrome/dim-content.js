(() => {
  'use strict';
  const pending = new Map();
  let onProgress = () => {}, onGrades = () => {}, onInventory = () => {}, onAutoSync = () => {};
  document.addEventListener('vault-cleaner-response', event => {
    let message; try { message = JSON.parse(event.detail); } catch { return; }
    if (message.kind === 'progress') { onProgress(message.data); return; }
    if (message.kind === 'inventory') { onInventory(message.data); return; }
    const request = pending.get(message.requestId); if (!request) return;
    clearTimeout(request.timer); pending.delete(message.requestId);
    message.error ? request.reject(new Error(message.error)) : request.resolve(message.data);
  });
  function rpc(action, payload) {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();
      const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('The DIM connection timed out. Reload DIM.')); }, action === 'transfer' ? 900000 : ['refresh','prepare'].includes(action) ? 35000 : 12000);
      pending.set(requestId, { resolve, reject, timer });
      document.dispatchEvent(new CustomEvent('vault-cleaner-request', { detail: JSON.stringify({ requestId, action, payload }) }));
    });
  }
  const adapter = {
    snapshot: () => rpc('snapshot'),
    refresh: () => rpc('refresh'),
    grades: async () => (await browser.storage.local.get('vcGrades')).vcGrades || {},
    keepers: async () => (await browser.storage.local.get('vcWeaponKeepers')).vcWeaponKeepers || {},
    saveKeepers: async choices => browser.storage.local.set({vcWeaponKeepers:choices}),
    prepare: payload => rpc('prepare', payload), transfer: token => rpc('transfer', { token }),
    stop: () => rpc('stop'), search: ids => rpc('search', { ids }),
    sync: () => browser.runtime.sendMessage({ type: 'open-sync' }),
    autoSync: (snapshot,force) => browser.runtime.sendMessage({
      type:'vc-auto-sync-start',account:snapshot.accountKey,force,ids:snapshot.items.filter(item=>item.weapon).map(item=>item.id)
    }),
    onAutoSyncChanged: callback => {onAutoSync = callback;},
    onProgress: callback => { onProgress = callback; }, onGradesChanged: callback => { onGrades = callback; }, onInventoryChanged: callback => { onInventory = callback; }
  };
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.vcGrades) onGrades(changes.vcGrades.newValue || {});
    if (changes.vcAutoSyncStatus) onAutoSync(changes.vcAutoSyncStatus.newValue);
  });
  const toggle = document.createElement('button'); toggle.textContent = '◇  Vault Cleaner';
  Object.assign(toggle.style, {
    position: 'fixed', right: '22px', bottom: '22px', zIndex: '2147483600',
    padding: '10px 16px', color: '#182619', background: '#b9e68e',
    border: '1px solid #ceefa9', borderRadius: '12px', boxShadow: '0 4px 18px #050b1099',
    font: '650 13px system-ui', cursor: 'pointer'
  });
  document.body.append(toggle);
  let host = null, panel = null;
  toggle.onclick = () => {
    if (!host) {
      host = document.createElement('div');
      Object.assign(host.style, { position: 'fixed', right: '18px', top: '18px', zIndex: '2147483646', width: 'min(660px, calc(100vw - 36px))', display: 'block' });
      document.body.append(host);
      panel = mountVaultCleaner(host, browser.runtime.getURL('panel.css'), adapter);
    } else { host.style.display = host.style.display === 'none' ? 'block' : 'none'; if (host.style.display === 'block') panel.refresh(); }
  };
})();
