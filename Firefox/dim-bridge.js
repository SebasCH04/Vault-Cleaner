(() => {
  'use strict';
  if (window.__vaultCleanerBridge) return;
  window.__vaultCleanerBridge = true;
  const C = globalThis.VaultCore;
  let redux = null, prepared = null, running = false, stopped = false;
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  function fiber(el) {
    const key = Object.keys(el).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
    return key ? el[key] : null;
  }
  function getStore() {
    if (redux?.getState()?.inventory?.stores) return redux;
    for (const el of [...document.querySelectorAll('.item')].slice(0, 8).concat([...document.body.children])) {
      let f = fiber(el);
      for (let depth = 0; f && depth < 100; depth++, f = f.return) {
        const p = f.memoizedProps;
        for (const candidate of [p?.store, p?.value?.store, f.memoizedState?.memoizedState?.store]) {
          if (typeof candidate?.getState === 'function' && candidate.getState()?.inventory?.stores) { redux = candidate; return redux; }
        }
      }
    }
    throw new Error('DIM inventory was not found. Sign in, open Inventory, expand Weapons and click Refresh inventory.');
  }
  function snapshot() {
    const state = getStore().getState();
    const stores = state.inventory.stores;
    const account = state.accounts;
    const version = account?.currentAccountDestinyVersion;
    const key = `${account?.currentAccountMembershipId}-d${version}`;
    const profile = state.dimApi?.profiles?.[key];
    const protectedIds = new Set(), protectedHashes = new Set();
    function protect(loadout) {
      for (const item of [...(loadout.equipped || []), ...(loadout.unequipped || []), ...(loadout.items || [])]) {
        const id = C.normalizeId(item.itemInstanceId ?? item.id);
        if (id) protectedIds.add(id);
        else if (item.hash) protectedHashes.add(item.hash);
      }
    }
    Object.values(profile?.loadouts || {}).forEach(protect);
    const native = state.inventory.profileResponse?.characterLoadouts?.data;
    for (const char of Object.values(native || {})) (char.loadouts || []).forEach(protect);
    for (const char of Object.values(state.inGameLoadouts?.loadouts || {})) char.forEach(protect);
    const rows = stores.flatMap(store => store.items.filter(i => i.bucket?.inWeapons).map(i => ({
      id: String(i.id), hash: i.hash, name: i.name, type: i.typeName, icon: i.icon,
      bucket: String(i.bucket.hash), bucketName: i.bucket.name,
      capacity: i.bucket.capacity, owner: i.owner, ownerName: store.name,
      locked: i.locked, equipped: i.equipped, weapon: true,
      tag: profile?.tags?.[i.id]?.tag || '',
      inLoadout: protectedIds.has(i.id) || protectedHashes.has(i.hash),
      exotic: i.rarity === 'Exotic', crafted: Boolean(i.craftedInfo),
      deepsight: Boolean(i.deepsightInfo), notransfer: Boolean(i.notransfer),
      postmaster: Boolean(i.location?.inPostmaster), power: i.power || 0,
      perks: (i.sockets?.allSockets || []).filter(s => s.isPerk && s.plugged).map(s => s.plugged.plugDef?.displayProperties?.name).filter(Boolean).slice(0, 8)
    })));
    const chars = stores.filter(s => !s.isVault).map(s => {
      const occupied = {}, capacity = {};
      for (const i of stores.flatMap(t => t.items)) if (i.bucket?.inWeapons) capacity[String(i.bucket.hash)] = i.bucket.capacity;
      for (const i of s.items) if (i.bucket?.inWeapons && !i.location?.inPostmaster) occupied[String(i.bucket.hash)] = (occupied[String(i.bucket.hash)] || 0) + 1;
      for (const bucket of Object.keys(capacity)) occupied[bucket] ||= 0;
      return { id: s.id, name: `${s.className || s.name}${s.current ? ' · active' : ''}`, current: s.current, isVault: false, capacity, occupied };
    });
    const checks = [];
    if (version !== 2) checks.push('Open your Destiny 2 account.');
    if (!state.inventory.live || state.inventory.mockProfileData) checks.push('DIM is not connected to the live inventory.');
    if (!state.dimApi?.profileLoaded || !profile) checks.push('DIM has not loaded tags and loadouts yet.');
    if (!native) checks.push('In-game loadouts could not be verified.');
    if (!rows.length) checks.push('The weapon inventory is empty or still loading.');
    return { items: rows, characters: chars, canTransfer: !checks.length, warnings: checks, at: Date.now(), accountKey: key, source: 'live' };
  }
  function search(ids) {
    getStore().dispatch({ type: 'shell/SEARCH_QUERY', payload: { query: C.exactSearch(ids), updateVersion: true } });
  }
  async function waitFor(predicate, timeout = 7000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { const result = predicate(); if (result) return result; if (stopped) throw new Error('Batch stopped.'); await delay(150); }
    throw new Error('DIM did not respond in time. Refresh inventory before trying another batch.');
  }
  function ancestors(el) {
    const result = []; let f = fiber(el);
    for (let depth = 0; f && depth < 45; depth++, f = f.return) if (f.memoizedProps) result.push(f.memoizedProps);
    return result;
  }
  function findMover(itemId, targetId) {
    for (const el of document.querySelectorAll('button')) {
      const props = ancestors(el);
      // Only a verified popup for this particular instance and its STORE action.
      if (!props.some(p => p.item?.id === itemId)) continue;
      const location = props.find(p => p.type === 'store' && typeof p.submitMoveTo === 'function');
      const info = location?.actionsModel?.store?.find(info => info.store.id === targetId && info.enabled);
      if (info) return () => location.submitMoveTo(info.store, false, 1);
    }
    return null;
  }
  async function moveOne(itemId, targetId, plan) {
    let fresh = snapshot();
    if (!fresh.canTransfer || fresh.accountKey !== plan.accountKey) throw new Error('The DIM account or connection changed. Refresh inventory.');
    const item = fresh.items.find(i => i.id === itemId);
    if (!item || !C.canSelect(item, plan.grades, plan.categories, plan.mode)) throw new Error('This weapon changed or cannot be transferred in this mode.');
    const target = fresh.characters.find(c => c.id === targetId);
    if (!C.planBatch(fresh.items, plan.grades, [itemId], target, plan.categories, 1, plan.reserve, plan.mode, plan.batchMode).batch.length) throw new Error('No space remains in the destination slot.');
    let tile = document.getElementById(itemId);
    if (!tile || !tile.classList.contains('item')) {
      search([itemId]);
      getStore().dispatch({ type: 'shell/TOGGLE_SEARCH_RESULTS', payload: true });
      tile = await waitFor(() => [...document.querySelectorAll('.item')].find(el => ancestors(el).some(p => p.item?.id === itemId)));
    }
    if (!ancestors(tile).some(p => p.item?.id === itemId)) throw new Error('The exact weapon copy could not be verified in DIM.');
    tile.click();
    const mover = await waitFor(() => findMover(itemId, targetId));
    // Recheck immediately before native DIM action. No equipment action is called.
    fresh = snapshot();
    if (!fresh.canTransfer || fresh.accountKey !== plan.accountKey) throw new Error('The account or connection changed before the transfer.');
    if (!C.planBatch(fresh.items, plan.grades, [itemId], fresh.characters.find(c => c.id === targetId), plan.categories, 1, plan.reserve, plan.mode, plan.batchMode).batch.length) throw new Error('This weapon or the available space changed before the transfer.');
    if (stopped) throw new Error('Batch stopped.');
    mover();
    await waitFor(() => snapshot().items.find(i => i.id === itemId && i.owner === targetId && i.equipped === false), 30000);
  }
  function emit(kind, data) { document.dispatchEvent(new CustomEvent('vault-cleaner-response', { detail: JSON.stringify({ kind, ...data }) })); }
  document.addEventListener('vault-cleaner-request', async event => {
    let request;
    try { request = JSON.parse(event.detail); } catch { return; }
    const { requestId, action, payload = {} } = request;
    try {
      if (action === 'stop') { stopped = true; emit('reply', { requestId, data: { stopped: true } }); return; }
      if (running) throw new Error('A batch is running. Wait or click Stop.');
      if (action === 'snapshot') { emit('reply', { requestId, data: snapshot() }); return; }
      if (action === 'search') { search(payload.ids || []); emit('reply', { requestId, data: { ok: true } }); return; }
      if (action === 'prepare') {
        const snap = snapshot();
        if (!snap.canTransfer) throw new Error(snap.warnings.join(' '));
        const target = snap.characters.find(c => c.id === payload.targetId);
        const mode = payload.mode === 'manual' ? 'manual' : 'clean';
        const batchMode = payload.batchMode === 'total' ? 'total' : 'slot';
        const result = C.planBatch(snap.items, payload.grades || {}, payload.ids || [], target, payload.categories || [], payload.limit, payload.reserve, mode, batchMode);
        if (!result.batch.length) throw new Error('No eligible selected weapons have space available for this batch.');
        prepared = { ...payload, mode, batchMode, ids: result.batch.map(i => i.id), accountKey: snap.accountKey, token: crypto.randomUUID(), expires: Date.now() + 120000 };
        emit('reply', { requestId, data: { token: prepared.token, batch: result.batch, target, skipped: result.skipped, counts: result.counts, mode, batchMode } }); return;
      }
      if (action === 'transfer') {
        const plan = prepared; prepared = null;
        if (!plan || plan.token !== payload.token || plan.expires < Date.now()) throw new Error('The batch review expired. Prepare it again.');
        running = true; stopped = false;
        let moved = 0;
        try {
          for (const id of plan.ids) {
            if (stopped) break;
            const item = snapshot().items.find(i => i.id === id);
            emit('progress', { data: { moved, total: plan.ids.length, name: item?.name || id } });
            await moveOne(id, plan.targetId, plan); moved++;
            emit('progress', { data: { moved, total: plan.ids.length, name: item?.name || id, completedId: id } });
            await delay(350);
          }
          emit('reply', { requestId, data: { moved, stopped, snapshot: snapshot() } });
        } catch (error) { emit('reply', { requestId, error: `Batch stopped after ${moved} confirmed transfer(s). ${error.message}` }); }
        finally { running = false; }
        return;
      }
      throw new Error('Unknown action.');
    } catch (error) { emit('reply', { requestId, error: error.message }); }
  });
})();
