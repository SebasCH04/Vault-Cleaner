(() => {
  'use strict';
  const pending = new Map();
  let onProgress = () => {}, onGrades = () => {}, onInventory = () => {};
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
    onProgress: callback => { onProgress = callback; }, onGradesChanged: callback => { onGrades = callback; }, onInventoryChanged: callback => { onInventory = callback; }
  };
  browser.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.vcGrades) onGrades(); });
  const toggle = document.createElement('button'); toggle.textContent = '◇  Vault Cleaner';
  Object.assign(toggle.style, { position: 'fixed', right: '22px', bottom: '22px', zIndex: '2147483600', padding: '12px 18px', color: '#14210e', background: '#bbec84', border: '1px solid #d4ffaf', borderRadius: '10px', boxShadow: '0 5px 24px #0008', font: '600 13px system-ui', cursor: 'pointer' });
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
