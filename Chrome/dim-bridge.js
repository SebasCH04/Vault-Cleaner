(() => {
  'use strict';
  if (window.__vaultCleanerBridge) return;
  window.__vaultCleanerBridge = true;
  const C = globalThis.VaultCore;
  let redux = null, prepared = null, running = false, stopped = false, refreshing = null;
  let watched = null, inventoryTimer = null;
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const accountKeyFor = state => `${state.accounts?.currentAccountMembershipId}-d${state.accounts?.currentAccountDestinyVersion}`;
  function fiber(el) {
    const key = Object.keys(el).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
    return key ? el[key] : null;
  }
  function getStore() {
    if (redux?.getState()?.inventory?.stores) { watchStore(redux); return redux; }
    for (const el of [...document.querySelectorAll('.item')].slice(0, 8).concat([...document.body.children])) {
      let f = fiber(el);
      for (let depth = 0; f && depth < 100; depth++, f = f.return) {
        const p = f.memoizedProps;
        for (const candidate of [p?.store, p?.value?.store, f.memoizedState?.memoizedState?.store]) {
          if (typeof candidate?.getState === 'function' && candidate.getState()?.inventory?.stores) { redux = candidate; watchStore(redux); return redux; }
        }
      }
    }
    throw new Error('DIM inventory was not found. Sign in, open Inventory, expand Weapons and click Refresh inventory.');
  }
  function watchStore(store) {
    if (watched === store || typeof store.subscribe !== 'function') return;
    watched = store;
    let previous = store.getState();
    store.subscribe(() => {
      const next = store.getState();
      const changed = next.inventory?.stores !== previous.inventory?.stores || next.inventory?.profileError !== previous.inventory?.profileError || next.inventory?.live !== previous.inventory?.live || next.accounts !== previous.accounts || next.dimApi !== previous.dimApi || next.inGameLoadouts !== previous.inGameLoadouts;
      previous = next;
      if (!changed) return;
      clearTimeout(inventoryTimer);
      inventoryTimer = setTimeout(() => {
        if (running || document.hidden) return; // Confirmed transfers already carry their updated snapshot.
        try { emit('inventory', { data: snapshot() }); } catch { /* A later DIM state update can restore the connection. */ }
      }, 120);
    });
  }
  function weaponData(item) {
    const sockets = item.sockets?.allSockets || [];
    const actual = s=>s.actuallyPlugged || s.plugged;
    const cosmetic = s=>/skin|shader|ornament|tracker|memento/i.test(actual(s)?.plugDef?.plug?.plugCategoryIdentifier || '');
    const masterworkSocket = s=>/masterwork/i.test(actual(s)?.plugDef?.plug?.plugCategoryIdentifier || '');
    let verified = !item.missingSockets;
    const columns = sockets.filter(s=>s.isPerk && !cosmetic(s) && !masterworkSocket(s)).map(s=> {
      const selected = actual(s)?.plugDef, sd = s.socketDefinition || {};
      const intrinsic = selected?.plug?.plugCategoryHash === 1744546145;
      const live = s.reusablePlugItems;
      const definitions = new Map((s.plugOptions || []).map(p=>[p.plugDef?.hash,p.plugDef]));
      if (selected?.hash) definitions.set(selected.hash,selected);
      // plugSet is the full loot pool, not this copy's rolled options. Random
      // sockets need instance-level data. Include the actual plug, even when
      // DIM's socket-override UI is previewing a different selection.
      let hashes = intrinsic ? [selected?.hash] : Array.isArray(live) && live.length ? [selected?.hash,...live.map(p=>p.plugItemHash)] :
        (s.hasRandomizedPlugItems || sd.randomizedPlugSetHash) ? [] : (s.plugOptions || []).map(p=>p.plugDef?.hash);
      if (!hashes.length || hashes.some(hash=>!Number.isInteger(hash) || hash <= 0 || !definitions.has(hash)) ||
          (s.plugOptions || []).some(p=>p.unreliablePerkOption)) verified = false;
      hashes = [...new Set(hashes.filter(hash=>Number.isInteger(hash) && hash > 0))].sort((a,b)=>a-b);
      return {index:s.socketIndex,type:sd.socketTypeHash || 0,category:selected?.plug?.plugCategoryHash || 0,
        name:selected?.plug?.plugCategoryIdentifier?.includes('origin') ? 'Origin trait' : intrinsic ? 'Frame' : 'Perk slot '+s.socketIndex,
        options:hashes.map(hash=>({hash,name:definitions.get(hash)?.displayProperties?.name || String(hash)}))};
    }).sort((a,b)=>a.index-b.index);
    const functional = sockets.filter(s=>!s.isPerk && !cosmetic(s) && !masterworkSocket(s)).map(s=> {
      const def = actual(s)?.plugDef, sd = s.socketDefinition || {};
      return [s.socketIndex,Boolean(s.visibleInGame),sd.socketTypeHash || 0,sd.reusablePlugSetHash || 0,sd.randomizedPlugSetHash || 0,
        def?.plug?.plugCategoryHash || 0,s.isMod ? 0 : def?.hash || 0];
    });
    const base = (item.stats || []).map(s=>[s.statHash,s.base]).sort((a,b)=>a[0]-b[0]);
    const mw = item.masterworkInfo;
    const masterworkStats = (mw?.stats || []).map(s=>[s.hash,Boolean(s.isPrimary)]).sort((a,b)=>a[0]-b[0]);
    const result = {tier:item.tier,adept:item.adept,holofoil:item.holofoil,element:item.element?.hash,
      masterwork:mw?.tier,masterworkType:masterworkStats.length ? JSON.stringify(masterworkStats) : '',
      masterworkName:(mw?.stats || []).filter(s=>s.isPrimary).map(s=>s.name).join(' / ') || 'Unknown masterwork',
      base,columns,features:JSON.stringify(functional),complete:true};
    // Reject missing and ambiguous metadata, including weapon socket previews.
    result.complete = Boolean(verified && columns.some(c=>c.category === 1744546145) && Number.isFinite(item.power) &&
      sockets.every(s=>!s.visibleInGame || actual(s)?.plugDef?.plug) && C.weaponGroup({id:String(item.id),hash:item.hash,
        bucket:String(item.bucket.hash),weapon:true,exotic:Boolean(item.isExotic || item.rarity === 'Exotic'),crafted:Boolean(item.craftedInfo || item.crafted),weaponData:result}));
    return result;
  }
  function armorData(item) {
    const sockets = item.sockets?.allSockets || [];
    const category = s=>s.plugged?.plugDef?.plug?.plugCategoryHash;
    const exotic = Boolean(item.isExotic || item.rarity === 'Exotic');
    const archetype = sockets.find(s=>category(s) === 778194869)?.plugged?.plugDef;
    const masterwork = sockets.find(s=>category(s) === 2198080209);
    const tuning = sockets.find(s=>s.visibleInGame && category(s) === 3481777685);
    const base = C.ARMOR_STATS.map(hash=>item.stats?.find(s=>s.statHash === hash)?.base);
    const mwStats = C.ARMOR_STATS.map(hash=>masterwork?.plugged?.stats?.[hash]?.value).filter(Number.isInteger);
    const mwInvestments = masterwork?.plugged?.plugDef?.investmentStats;
    const masterworkLevel = Number.isInteger(item.masterworkInfo?.tier) ? item.masterworkInfo.tier :
      Array.isArray(mwInvestments) ? (mwInvestments.find(s=>s.isConditionallyActive && C.ARMOR_STATS.includes(s.statTypeHash))?.value || 0) :
      mwStats.length ? Math.max(0,...mwStats) : null;
    const tuningOptions = (tuning?.reusablePlugItems || []).map(p=>p.plugItemHash).filter(Number.isInteger).sort((a,b)=>a-b);
    // Compare mod access and intrinsic perks, excluding cosmetic choices and
    // the current masterwork level. Tuning uses every available option, not
    // merely the currently selected mod.
    const features = sockets.filter(s=> {
      const def = s.plugged?.plugDef;
      return category(s) !== 2198080209 && category(s) !== 778194869 && category(s) !== 3481777685 &&
        !/skin|shader|ornament|tracker|memento/i.test(def?.plug?.plugCategoryIdentifier || '');
    }).map(s=> {
      const def = s.plugged?.plugDef, sd = s.socketDefinition || {};
      return [s.socketIndex,Boolean(s.visibleInGame),sd.socketTypeHash || 0,sd.reusablePlugSetHash || 0,
        sd.randomizedPlugSetHash || 0,def?.plug?.plugCategoryHash || 0,
        (s.reusablePlugItems || []).map(p=>p.plugItemHash).sort((a,b)=>a-b),s.isPerk ? def?.hash || 0 : 0];
    });
    const classType = Number.isInteger(item.classType) ? item.classType : null;
    const tier = Number.isInteger(item.tier) ? item.tier : null;
    const setHash = item.setBonus?.hash || null;
    const exoticPerks = exotic ? sockets.filter(s=>s.isPerk && s.visibleInGame && [1744546145,748854354].includes(category(s)))
      .map(s=>[s.socketIndex,s.plugged?.plugDef?.hash || null]).sort((a,b)=>a[0]-b[0]) : [];
    const verifiedExotic = !exotic || (exoticPerks.length >= (String(item.bucket.hash) === C.ARMOR_SLOTS[4] ? 2 : 1) &&
      exoticPerks.every(p=>Number.isInteger(p[0]) && p[0] >= 0 && Number.isInteger(p[1]) && p[1] > 0));
    const complete = Boolean(masterwork && archetype?.hash && (exotic || setHash) && verifiedExotic && [0,1,2].includes(classType) &&
      Number.isInteger(tier) && tier >= (exotic ? 0 : 1) && tier <= 5 && base.every(v=>Number.isInteger(v) && v >= 0) &&
      Number.isFinite(item.power) && Number.isInteger(masterworkLevel) && masterworkLevel >= 0 && masterworkLevel <= 5 &&
      (!tuning || tuningOptions.length) && sockets.every(s=>!s.visibleInGame || s.plugged?.plugDef?.plug));
    const bonuses = item.setBonus?.setPerks || [];
    return { classType, className:C.CLASS_NAMES[classType] || 'Unknown class', tier,
      setHash,setName:item.setBonus?.displayProperties?.name || '',
      setBonuses:bonuses.map(p=>({pieces:p.requiredSetCount,hash:p.sandboxPerkHash})),
      archetypeHash:archetype?.hash || null,archetypeName:archetype?.displayProperties?.name || '',
      generation:masterwork ? 3 : 2,base:base.map(v=>Number.isInteger(v) ? v : null),
      potential:base.map(v=>Number.isInteger(v) ? (masterwork && v === 0 ? 5 : v) : null),
      masterwork:masterworkLevel,
      tuningOptions,exoticPerks,features:JSON.stringify([features,tuningOptions]),complete };
  }
  function snapshot() {
    const state = getStore().getState();
    const stores = state.inventory.stores;
    const account = state.accounts;
    const version = account?.currentAccountDestinyVersion;
    const key = accountKeyFor(state);
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
    const rows = stores.flatMap(store => store.items.filter(i => i.bucket?.inWeapons || i.bucket?.inArmor).map(i => ({
      id: String(i.id), hash: i.hash, name: i.name, type: i.typeName, icon: i.icon,
      bucket: String(i.bucket.hash), bucketName: i.bucket.name,
      capacity: i.bucket.capacity, owner: store.isVault ? 'vault' : String(store.id), ownerName: store.name,
      locked: i.locked, equipped: i.equipped, weapon: Boolean(i.bucket.inWeapons), armor:Boolean(i.bucket.inArmor),
      ...(i.bucket.inArmor ? { armorData:armorData(i) } : {}),
      ...(i.bucket.inWeapons ? { weaponData:weaponData(i) } : {}),
      tag: profile?.tags?.[i.id]?.tag || '',
      inLoadout: protectedIds.has(i.id) || protectedHashes.has(i.hash),
      exotic: Boolean(i.isExotic || i.rarity === 'Exotic'), crafted: Boolean(i.craftedInfo || i.crafted),
      deepsight: Boolean(i.deepsightInfo), notransfer: Boolean(i.notransfer),
      postmaster: Boolean(i.location?.inPostmaster), power: i.power || 0,
      perks: (i.sockets?.allSockets || []).filter(s => s.isPerk && s.plugged).map(s => s.plugged.plugDef?.displayProperties?.name).filter(Boolean).slice(0, 8)
    })));
    const chars = stores.filter(s => !s.isVault).map(s => {
      const occupied = {}, capacity = {};
      for (const i of stores.flatMap(t => t.items)) if (i.bucket?.inWeapons || i.bucket?.inArmor) capacity[String(i.bucket.hash)] = i.bucket.capacity;
      // DIM counts the item's actual location, not its normal destination bucket.
      // Equipped weapons occupy a space; postmaster and other locations do not.
      const seen = new Set();
      for (const i of s.items) {
        const bucket = String(i.location?.hash ?? i.bucket?.hash);
        if (!(i.bucket?.inWeapons || i.bucket?.inArmor) || i.location?.inPostmaster || !(bucket in capacity)) continue;
        const id = C.normalizeId(String(i.id));
        if (id && seen.has(id)) continue;
        if (id) seen.add(id);
        occupied[bucket] = (occupied[bucket] || 0) + 1;
      }
      for (const bucket of Object.keys(capacity)) occupied[bucket] ||= 0;
      return { id: s.id, name: `${s.className || s.name}${s.current ? ' · active' : ''}`, classType:Number.isInteger(s.classType) ? s.classType : null, current: s.current, isVault: false, capacity, occupied };
    });
    const checks = [];
    if (version !== 2) checks.push('Open your Destiny 2 account.');
    if (!state.inventory.live || state.inventory.mockProfileData) checks.push('DIM is not connected to the live inventory.');
    if (state.inventory.profileError) checks.push('DIM could not refresh inventory. Refresh DIM before sending weapons.');
    if (!state.dimApi?.profileLoaded || !profile) checks.push('DIM has not loaded tags and loadouts yet.');
    if (!native) checks.push('In-game loadouts could not be verified.');
    if (!rows.length) checks.push('The inventory is empty or still loading.');
    const canSync = version === 2 && state.inventory.live && !state.inventory.mockProfileData &&
      rows.some(item=>item.weapon && C.normalizeId(item.id));
    return { items: rows, characters: chars, canSync, canTransfer: !checks.length, warnings: checks, at: Date.now(), accountKey: key, source: 'live' };
  }
  function refreshControl() {
    return [...document.querySelectorAll('button[aria-keyshortcuts]')].find(el =>
      el.getAttribute('aria-keyshortcuts')?.toUpperCase() === 'R' && typeof fiber(el)?.memoizedProps?.onClick === 'function'
    );
  }
  async function refreshInventory() {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const store = getStore(), before = store.getState(), accountKey = accountKeyFor(before);
      const button = refreshControl();
      if (!button || button.disabled || button.classList.contains('disabled')) throw new Error('DIM refresh is unavailable. Use DIM’s refresh button, then try again.');
      button.click();
      let sawSpinner = false;
      const deadline = Date.now() + 25000;
      while (Date.now() < deadline) {
        const current = store.getState();
        if (accountKeyFor(current) !== accountKey) throw new Error('The DIM account changed during refresh. Review your selection again.');
        if (current.inventory?.profileError && current.inventory.profileError !== before.inventory?.profileError) throw new Error('DIM could not refresh from Bungie. Try Refresh inventory again.');
        const spinning = Boolean(refreshControl()?.querySelector('.fa-spin'));
        sawSpinner ||= spinning;
        // An unchanged Bungie response need not replace stores. DIM's spinner
        // still provides a completion signal for that successful refresh.
        if (!spinning && (sawSpinner || current.inventory?.stores !== before.inventory?.stores)) return snapshot();
        await delay(100);
      }
      throw new Error('DIM has not finished refreshing. Wait for its refresh to finish, then try again.');
    })();
    try { return await refreshing; } finally { refreshing = null; }
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
    if (item) verifyKeeper(fresh,item,plan);
    const analysis = plan.kind === 'armor' ? C.armorAnalysis(fresh.items) : plan.mode === 'duplicates' ? C.weaponAnalysis(fresh.items,plan.grades,Date.now(),plan.keeperChoices || {}) : null;
    if (!item || !C.canSelectItem(item, plan.grades, plan.categories, plan.mode, plan.kind, analysis)) throw new Error('This item changed or cannot be transferred in this mode.');
    const target = fresh.characters.find(c => c.id === targetId);
    if (!C.planBatch(fresh.items, plan.grades, [itemId], target, plan.categories, 1, plan.reserve, plan.mode, plan.batchMode, plan.kind, plan.keeperChoices || {}).batch.length) throw new Error('No space remains or this item is no longer eligible.');
    let tile = document.getElementById(itemId);
    if (!tile || !tile.classList.contains('item')) {
      search([itemId]);
      getStore().dispatch({ type: 'shell/TOGGLE_SEARCH_RESULTS', payload: true });
      tile = await waitFor(() => [...document.querySelectorAll('.item')].find(el => ancestors(el).some(p => p.item?.id === itemId)));
    }
    if (!ancestors(tile).some(p => p.item?.id === itemId)) throw new Error('The exact item copy could not be verified in DIM.');
    tile.click();
    const mover = await waitFor(() => findMover(itemId, targetId));
    // Recheck immediately before native DIM action. No equipment action is called.
    fresh = snapshot();
    if (!fresh.canTransfer || fresh.accountKey !== plan.accountKey) throw new Error('The account or connection changed before the transfer.');
    verifyKeeper(fresh,fresh.items.find(i=>i.id === itemId),plan);
    if (!C.planBatch(fresh.items, plan.grades, [itemId], fresh.characters.find(c => c.id === targetId), plan.categories, 1, plan.reserve, plan.mode, plan.batchMode, plan.kind, plan.keeperChoices || {}).batch.length) throw new Error('This item or the available space changed before the transfer.');
    if (stopped) throw new Error('Batch stopped.');
    mover();
    await waitFor(() => snapshot().items.find(i => i.id === itemId && i.owner === targetId && i.equipped === false), 30000);
  }
  function verifyKeeper(snap,item,plan) {
    if (plan.kind !== 'armor' && plan.mode === 'duplicates') {
      const keeper = snap.items.find(i=>i.id === plan.replacements?.[item?.id]);
      if (!keeper || plan.ids.includes(keeper.id) || !C.weaponDominates(keeper,item,plan.grades,Date.now(),plan.keeperChoices?.[C.weaponFamily(item)] === keeper.id)) {
        throw new Error('The retained weapon replacement changed, is missing or has no valid maximum. Review the batch again.');
      }
      return;
    }
    if (plan.kind !== 'armor' || plan.mode === 'manual') return;
    const keeper = snap.items.find(i=>i.id === plan.replacements?.[item?.id]);
    if (!keeper || plan.ids.includes(keeper.id) || keeper.postmaster || keeper.notransfer || typeof keeper.equipped !== 'boolean' ||
        !C.armorGroup(item) || C.armorGroup(item) !== C.armorGroup(keeper) ||
        !keeper.armorData.base.every((v,index)=>v >= item.armorData.base[index]) || keeper.power < item.power ||
        (keeper.armorData.masterwork || 0) < (item.armorData.masterwork || 0)) {
      throw new Error('The retained armor replacement changed or is missing. Review the batch again.');
    }
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
      if (action === 'refresh') { emit('reply', { requestId, data: await refreshInventory() }); return; }
      if (action === 'search') { search(payload.ids || []); emit('reply', { requestId, data: { ok: true } }); return; }
      if (action === 'prepare') {
        let snap = snapshot();
        if (!snap.canTransfer) throw new Error(snap.warnings.join(' '));
        let target = snap.characters.find(c => c.id === payload.targetId);
        const kind = payload.kind === 'armor' ? 'armor' : 'weapons';
        const mode = payload.mode === 'manual' ? 'manual' : payload.mode === 'duplicates' && kind === 'weapons' ? 'duplicates' : 'clean';
        const batchMode = payload.batchMode === 'total' ? 'total' : 'slot';
        const plan = () => C.planBatch(snap.items, payload.grades || {}, payload.ids || [], target, payload.categories || [], payload.limit, payload.reserve, mode, batchMode, kind, payload.keeperChoices || {});
        let result = plan();
        // Dismantling in-game may leave DIM's cached inventory full. Refresh once
        // before refusing an otherwise eligible selection for lack of space.
        if (!result.batch.length && result.skipped.some(item => item.reason === 'No space in this slot.') && refreshControl()) {
          const accountKey = snap.accountKey;
          snap = await refreshInventory();
          if (snap.accountKey !== accountKey) throw new Error('The DIM account changed. Review your selection again.');
          if (!snap.canTransfer) throw new Error(snap.warnings.join(' '));
          target = snap.characters.find(c => c.id === payload.targetId);
          result = plan();
        }
        if (!result.batch.length) {
          if (result.skipped.some(item=>item.reason === 'Select a destination of the same armor class.')) throw new Error('Choose a character of the same class as the selected armor.');
          if (result.skipped.length && result.skipped.every(item => /protected|cannot be transferred/.test(item.reason))) throw new Error('The selected copies are no longer eligible in this transfer mode. Refresh inventory and review your selection.');
          if (result.skipped.some(item => item.reason === 'Capacity could not be verified.')) throw new Error('DIM slot capacity could not be verified. Refresh DIM and prepare the batch again.');
          const spaces = Object.keys(target.capacity || {}).map(bucket => `${snap.items.find(i => i.bucket === bucket)?.bucketName || bucket}: ${C.freeSpaces(target, bucket, payload.reserve) ?? 'unverified'}`).join(' · ');
          throw new Error(`None of the selected ${kind === 'armor' ? 'armor pieces' : 'weapons'} fit in ${target.name}. Free spaces: ${spaces}.`);
        }
        const analysis = kind === 'armor' ? C.armorAnalysis(snap.items) : mode === 'duplicates' ? C.weaponAnalysis(snap.items,payload.grades || {},Date.now(),payload.keeperChoices || {}) : null;
        const replacements = analysis && mode !== 'manual' ? Object.fromEntries(result.batch.map(i=>[i.id,analysis.records[i.id].keeperId])) : {};
        prepared = { ...payload, mode, batchMode, kind, replacements, ids: result.batch.map(i => i.id), accountKey: snap.accountKey, token: crypto.randomUUID(), expires: Date.now() + 120000 };
        emit('reply', { requestId, data: { token: prepared.token, batch: result.batch, target, skipped: result.skipped, counts: result.counts, mode, batchMode, kind, replacements, snapshot: snap } }); return;
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
            emit('progress', { data: { moved, total: plan.ids.length, name: item?.name || id, completedId: id, snapshot: snapshot() } });
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
