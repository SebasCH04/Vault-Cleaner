(() => {
  'use strict';
  const C = globalThis.VaultCore;
  const esc = text => String(text ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const icon = (name) => {
    const paths = { vault: '<path d="M4 8l8-5 8 5v9l-8 4-8-4zM4 8l8 5 8-5M12 13v8"/>', refresh:'<path d="M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0113 4M18 18a8 8 0 01-13-4"/>', arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>', shield:'<path d="M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6"/>', weapon:'<path d="M4 6h13l3 3-3 3H8l-2 6H3l2-8M10 12v4h4l2-4M17 6V3"/>' };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.vault}</svg>`;
  };
  globalThis.mountVaultCleaner = function (host, cssURL, adapter, standalone = false) {
    const root = host.attachShadow({ mode: 'open' });
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = cssURL; root.append(link);
    const shell = document.createElement('div'); shell.className = standalone ? 'standalone' : '';
    shell.innerHTML = `<div class="app">
<header class="head"><div class="brand"><div class="logo">${icon('vault')}</div><div><h1>Vault Cleaner</h1><p>DESTINY 2</p></div></div>${standalone ? '' : '<button class="quiet" id="close" aria-label="Close panel">✕</button>'}</header>
<nav class="inventory-picker" id="inventory-picker" aria-label="Inventory type"><button data-kind="weapons" class="active" aria-pressed="true">Weapons</button><button data-kind="armor" aria-pressed="false">Armor</button></nav>
<div class="scroll"><aside class="left">
<div class="intro"><p class="eyebrow">YOUR NEXT CLEANUP</p><h2>Make room<br>for what's next.</h2><p class="muted" id="intro-copy">Choose ranks. Review your weapons.<br>Transfer them in batches.</p></div>
<div class="stats"><div class="stat"><div><b id="rated">—</b><span id="rated-label">weapons with a confirmed maximum</span><div class="progress"><i id="coverage"></i></div></div></div><div class="stat"><div><b id="total">—</b><span id="total-label">total weapons in your inventory</span></div></div><div class="stat"><div><b id="candidates">—</b><span id="candidate-label">vault candidates</span></div></div></div>
<div class="top-actions"><button id="refresh">${icon('refresh')}Refresh inventory</button><button id="sync" class="quiet">Sync light.gg ↗</button></div>
<div id="weapon-ranks"><div class="section-title"><h3>Maximum popularity</h3><span>light.gg · Vault</span></div><div class="grades" id="grades"></div>
<p class="muted" style="font-size:11px;line-height:1.5">Uses the highest rank possible with this copy's available perks. A C that can reach S is classified as S.</p>
<p class="muted" id="rank-scope" style="font-size:10px;margin:0 0 13px"></p>
<div class="safeguards"><span>Locked weapons protected</span><span>Favorites and loadouts</span><span>Crafted and exotic weapons</span></div></div>
<section id="armor-overview" class="hidden"><details class="armor-set-directory" ${standalone ? 'open' : ''}><summary>Your armor sets <small>Vault + characters</small></summary><p class="muted armor-policy">Keep distinct stat rolls and tuning options. Only equivalent or strictly outclassed copies enter duplicate cleanup. Set counts show owned slots, not currently equipped bonuses.</p><div id="armor-sets"></div></details><div class="safeguards"><span>Sets and unique rolls protected</span><span>Locks, exotics and loadouts</span></div></section>
</aside><main class="right"><div id="status" class="status">Connecting to inventory…</div>
<div class="mode-picker"><label class="field">Transfer mode<select id="transfer-mode"><option value="clean">Cleanup by maximum</option><option value="manual">Manual transfer</option></select></label><p class="muted" id="mode-hint"></p></div>
<div class="tabs" id="tabs"><button class="active" data-view="candidates">Candidates</button><button data-view="protected">Protected</button><button data-view="ungraded">No maximum</button><button data-view="all">All</button></div>
<div class="armor-filters hidden" id="armor-filters"><label class="field">Class<select id="armor-class"><option value="">All classes</option><option value="0">Titan</option><option value="1">Hunter</option><option value="2">Warlock</option></select></label><label class="field">Slot<select id="armor-slot"><option value="">All slots</option></select></label><label class="field">Set<select id="armor-set"><option value="">All sets</option></select></label><label class="field">Archetype<select id="armor-archetype"><option value="">All archetypes</option></select></label><label class="field">Tier<select id="armor-tier"><option value="">All tiers</option><option value="5">Tier 5</option><option value="4">Tier 4</option><option value="3">Tier 3</option><option value="2">Tier 2</option><option value="1">Tier 1</option><option value="0">Legacy / unknown</option></select></label></div>
<div class="toolbar"><input class="search" id="query" placeholder="Search weapons or perks…" aria-label="Search weapons or perks"><button id="select-visible">Select visible</button></div><p class="list-count" id="list-count">Waiting for inventory.</p>
<div class="table-wrap"><table><thead><tr><th style="width:28px"><input id="all-check" type="checkbox" aria-label="Select visible weapons"></th><th id="item-heading">Weapon / perks</th><th id="value-heading">Maximum</th><th>Status</th></tr></thead><tbody id="rows"></tbody></table></div>
<p class="muted" id="cleanup-hint" style="font-size:10px;margin:12px 0 0">Cleanup protects weapons with an unknown maximum. Manual transfer lets you choose any rank or an ungraded weapon.</p>
</main></div>
<footer class="footer"><div class="footer-left"><div class="destination">
<label class="field">Destination character<select id="target"><option value="">Waiting for characters…</option></select></label>
<label class="field">Batch sizing<select id="batch-mode"><option value="slot">Per slot</option><option value="total">Total</option></select></label>
<label class="field"><span id="limit-label">Max / slot</span><input type="number" id="limit" value="9" min="1" max="9"></label>
</div><div class="batch-options"><p class="sizing-hint" id="sizing-hint"></p><label class="reserve"><input type="checkbox" id="reserve">Keep 1 extra space per slot</label></div></div>
<div class="footer-right"><div class="send-row"><div class="selection"><b id="selected-count">0</b> selected<small id="capacity">Transfers respect available space.</small><small id="space-detail"></small></div><div class="batch-actions"><button id="search-dim" class="quiet">View in DIM</button><button id="prepare" class="primary">Prepare batch ${icon('arrow')}</button></div></div>
<div id="run" class="run-box hidden"><span id="run-text"></span><button id="stop" class="danger">Stop</button></div><p class="footnote">Review the batch before sending. Dismantle in Destiny 2, then prepare the next batch.</p></div>
</footer><div id="dialog" class="dialog-backdrop hidden"></div></div>`;
    root.append(shell);
    const $ = id => root.getElementById(id);
    let snap = { items: [], characters: [], canTransfer: false }, grades = {}, selected = new Set(), categories = new Set(['C','D','F']), view = 'candidates', query = '', busy = false, loading = false, currentPlan = null, mode = 'clean', batchMode = 'slot', pendingSnapshot = null, kind = 'weapons';
    let armorMemoItems = null, armorMemo = null;
    function armorInfo() { if (armorMemoItems !== snap.items) { armorMemoItems = snap.items; armorMemo = C.armorAnalysis(snap.items); } return armorMemo; }
    function inventoryItems() { return snap.items.filter(item=>kind === 'armor' ? item.armor : item.weapon); }
    function nouns(count) { return kind === 'armor' ? (count === 1 ? 'armor piece' : 'armor pieces') : (count === 1 ? 'weapon' : 'weapons'); }
    function status(text, kind = '') { $('status').textContent = text; $('status').className = 'status' + (kind ? ` ${kind}` : ''); }
    function candidates() { return inventoryItems().filter(item => kind === 'armor' ? C.canSelectItem(item,grades,[], 'clean',kind,armorInfo()) : C.eligible(item, grades, [...categories])); }
    function rows() {
      return inventoryItems().filter(item => {
        if (kind === 'armor') {
          const a = item.armorData || {}, state = armorInfo().records[item.id]?.state;
          if (view === 'candidates' && state !== 'duplicate') return false;
          if (['keep','review','protected'].includes(view) && state !== view) return false;
          if ($('armor-class').value !== '' && String(a.classType) !== $('armor-class').value) return false;
          if ($('armor-slot').value && item.bucket !== $('armor-slot').value) return false;
          if ($('armor-set').value && String(a.setHash) !== $('armor-set').value) return false;
          if ($('armor-archetype').value && String(a.archetypeHash) !== $('armor-archetype').value) return false;
          if ($('armor-tier').value && String(a.tier || 0) !== $('armor-tier').value) return false;
          return !query || [item.name,a.setName,a.archetypeName,a.className,...(item.perks || [])].join(' ').toLowerCase().includes(query.toLowerCase());
        }
        const grade = C.gradeFor(item, grades);
        const candidate = C.eligible(item, grades, [...categories]);
        if (view === 'candidates' && !candidate) return false;
        if (view === 'protected' && (!grade || candidate || !C.reasons(item, grades).length)) return false;
        if (view === 'ungraded' && C.gradeDetails(item, grades)?.best) return false;
        return !query || [item.name, ...(item.perks || [])].join(' ').toLowerCase().includes(query.toLowerCase());
      });
    }
    function selectable(item) { return C.canSelectItem(item, grades, [...categories], mode, kind, kind === 'armor' ? armorInfo() : null); }
    function syncSelection() { for (const id of selected) if (!snap.items.some(i => i.id === id && selectable(i))) selected.delete(id); }
    function rankItems() { return snap.items.filter(item => C.canSelect(item, grades, ['S','A','B','C','D','F'], mode)); }
    function render() {
      syncSelection();
      const inventory = inventoryItems(), armor = kind === 'armor';
      const rated = inventory.filter(i => armor ? Boolean(C.armorGroup(i)) : C.gradeDetails(i, grades)?.best).length;
      $('rated').textContent = rated; $('total').textContent = inventory.length; $('candidates').textContent = candidates().length;
      $('rated-label').textContent = armor ? 'pieces with complete comparison data' : 'weapons with a confirmed maximum';
      $('total-label').textContent = armor ? 'total armor across vault and characters' : 'total weapons in your inventory';
      $('candidate-label').textContent = armor ? 'vault duplicates' : 'vault candidates';
      $('coverage').style.width = `${inventory.length ? rated / inventory.length * 100 : 0}%`;
      $('weapon-ranks').classList.toggle('hidden',armor); $('sync').classList.toggle('hidden',armor);
      $('armor-overview').classList.toggle('hidden',!armor); $('armor-filters').classList.toggle('hidden',!armor);
      $('query').placeholder = armor ? 'Search armor, sets or archetypes…' : 'Search weapons or perks…';
      $('query').setAttribute('aria-label',$('query').placeholder);
      $('item-heading').textContent = armor ? 'Armor / set' : 'Weapon / perks';
      $('value-heading').textContent = armor ? 'Base stats' : 'Maximum';
      $('all-check').setAttribute('aria-label',armor ? 'Select visible armor' : 'Select visible weapons');
      $('cleanup-hint').textContent = armor ? 'Duplicate cleanup preserves a verified replacement for every selected copy. Unique rolls, tuning options and incomplete data are kept for review.' : 'Cleanup protects weapons with an unknown maximum. Manual transfer lets you choose any rank or an ungraded weapon.';
      $('intro-copy').innerHTML = armor ? 'Compare your armor. Keep your sets.<br>Transfer duplicates in batches.' : 'Choose ranks. Review your weapons.<br>Transfer them in batches.';
      $('inventory-picker').querySelectorAll('button').forEach(btn=>{btn.classList.toggle('active',btn.dataset.kind === kind);btn.setAttribute('aria-pressed',String(btn.dataset.kind === kind));btn.disabled = busy;});
      if (armor) renderArmorSets();
      const ranked = rankItems();
      $('grades').innerHTML = ['S','A','B','C','D','F'].map(grade => {
        const count = ranked.filter(i => C.gradeDetails(i, grades)?.best?.[0] === grade).length;
        return `<button class="grade-button ${categories.has(grade) ? 'active' : ''}" data-grade="${grade}" aria-pressed="${categories.has(grade)}" ${busy || mode === 'manual' ? 'disabled' : ''}><b>${grade}</b><span>${count} ${count === 1 ? 'weapon' : 'weapons'}</span></button>`;
      }).join('');
      $('rank-scope').textContent = mode === 'manual' ? 'Counts show transferable vault weapons with confirmed maxima.' : 'Counts show cleanup-ready vault weapons. Protected copies are excluded.';
      $('mode-hint').textContent = armor ? (mode === 'manual' ? 'You choose what to transfer. Keep, Review and Protected pieces can be selected; no duplicate or set protection applies.' : 'Only verified vault duplicates. Retained replacements, sets, unique tuning, locks and loadouts stay protected.') : mode === 'manual' ? 'Choose any transferable vault weapon, including S, ungraded, locked or cleanup-protected copies. You decide what to dismantle in-game.' : 'Candidates use each copy’s maximum rank and keep cleanup protections.';
      $('limit-label').textContent = batchMode === 'total' ? 'Max / batch' : 'Max / slot';
      $('sizing-hint').textContent = batchMode === 'total' ? 'One limit across all selected slots.' : armor ? 'Separate limit for Helmet, Arms, Chest, Legs and Class Item.' : 'Separate limit for Kinetic, Energy and Power.';
      const visible = rows();
      $('list-count').textContent = `${visible.length} visible ${nouns(visible.length)} · ${selected.size} selected${snap.source === 'demo' ? ' · demo data' : ''}`;
      $('rows').innerHTML = visible.slice(0, 1500).map(item => {
        if (armor) return armorRow(item);
        const details = C.gradeDetails(item, grades), grade = details?.best, ok = selectable(item);
        const protection = mode === 'manual' ? C.transferReasons(item) : C.reasons(item, grades);
        const note = `<span class="badge" data-grade="${esc(grade?.[0] || '')}">${esc(grade || '—')}</span><small class="rank-detail">${details?.current ? 'Current ' + esc(details.current) : grade ? 'Best Available' : 'Unconfirmed'}</small>`;
        const perks = (item.perks || []).join(' · ');
        let image = `<span class="weapon-icon">${icon('weapon')}</span>`;
        if (typeof item.icon === 'string' && item.icon.startsWith('/common/')) image = `<img class="weapon-icon" loading="lazy" alt="" src="https://www.bungie.net${esc(item.icon)}">`;
        return `<tr class="${selected.has(item.id) ? 'selected' : ''}"><td><input type="checkbox" data-id="${esc(item.id)}" aria-label="Select ${esc(item.name)}" ${selected.has(item.id) ? 'checked' : ''} ${!ok || busy ? 'disabled' : ''}></td><td><div class="weapon">${image}<div><b>${esc(item.name)}</b><small>${esc(item.type || item.bucketName)} · ${esc(item.owner === 'vault' ? 'Vault' : item.ownerName || 'Character')}</small>${perks ? `<small title="${esc(perks)}">${esc(perks.length > 76 ? perks.slice(0,73) + '…' : perks)}</small>` : ''}</div></div></td><td>${note}</td><td>${ok ? `<span class="tag">${mode === 'manual' ? 'Transfer only' + (item.locked ? ' · locked' : '') : 'Ready to review'}</span>` : `<span class="reason" title="${esc(protection.join(' · '))}">${esc(protection[0] || (grade ? 'Rank ' + grade + ': another category' : 'Ungraded'))}</span>`}</td></tr>`;
      }).join('') || `<tr><td colspan="4" class="empty"><strong>No ${armor ? 'armor' : 'weapons'} in this view.</strong>${armor ? 'Change your filters or open All to review your armor.' : 'Sync light.gg or change the selected ranks.'}</td></tr>`;
      const eligibleVisible = visible.filter(selectable);
      $('all-check').checked = eligibleVisible.length > 0 && eligibleVisible.every(i => selected.has(i.id));
      $('all-check').disabled = busy || !eligibleVisible.length;
      $('selected-count').textContent = selected.size;
      for (const id of ['prepare','search-dim']) $(id).disabled = busy || loading || !selected.size || (id === 'prepare' && !snap.canTransfer);
      $('refresh').disabled = busy || loading;
      for (const id of ['target','limit','reserve','select-visible','sync','query','transfer-mode','batch-mode']) $(id).disabled = busy;
      for (const id of ['armor-class','armor-slot','armor-set','armor-archetype','armor-tier']) $(id).disabled = busy;
      $('tabs').querySelectorAll('button').forEach(btn => { btn.classList.toggle('active', btn.dataset.view === view); btn.disabled = busy; });
      const target = snap.characters.find(c => c.id === $('target').value);
      $('space-detail').classList.toggle('hidden', batchMode === 'total' || !target);
      if (target) {
        const maxLimit = batchMode === 'total' ? (armor ? 45 : 27) : 9;
        const limit = Math.max(1,Math.min(maxLimit,Math.floor(Number($('limit').value) || 9)));
        const plan = C.planBatch(snap.items, grades, [...selected], target, [...categories], limit, $('reserve').checked, mode, batchMode, kind);
        const slots = Object.keys(target.capacity || {}).filter(bucket=>inventory.some(i=>i.bucket === bucket)).sort((a,b)=>armor ? C.ARMOR_SLOTS.indexOf(a)-C.ARMOR_SLOTS.indexOf(b) : ['Kinetic','Energy','Power'].indexOf(bucketLabel(a))-['Kinetic','Energy','Power'].indexOf(bucketLabel(b))).map(bucket=>({bucket,free:C.freeSpaces(target,bucket,$('reserve').checked)}));
        $('capacity').textContent = `${plan.batch.length} ready this batch · ${batchMode === 'total' ? 'Total limit' : 'Limit per slot'} ${limit}`;
        if (selected.size && !plan.batch.length) $('capacity').textContent += snap.source === 'demo' ? ' · Choose a character with free space.' : ' · DIM will recheck space when you prepare.';
        if (armor && plan.skipped.some(i=>i.reason.includes('same armor class'))) $('capacity').textContent += ' · Select a character of the matching class.';
        $('space-detail').textContent = `${$('reserve').checked ? 'Free spaces after reserve' : 'Free spaces'}: ` + slots.map(slot=>`${bucketLabel(slot.bucket)} ${slot.free ?? 'unverified'}`).join(' · ');
      } else $('capacity').textContent = 'Select a destination character.';
    }
    function bucketLabel(bucket) { return ({kinetic:'Kinetic',energy:'Energy',power:'Power','1498876634':'Kinetic','2465295065':'Energy','953998645':'Power','3448274439':'Helmet','3551918588':'Arms','14239492':'Chest','20886954':'Legs','1585787867':'Class Item'})[bucket] || snap.items.find(item=>item.bucket === bucket)?.bucketName || bucket; }
    function populateArmorFilters() {
      const items = snap.items.filter(i=>i.armor), options = (id,label,entries)=> {
        const value = $(id).value;
        const unique = [...new Map(entries).entries()].sort((a,b)=>String(a[1]).localeCompare(String(b[1])));
        $(id).innerHTML = `<option value="">${label}</option>`+unique.map(([key,name])=>`<option value="${esc(key)}">${esc(name)}</option>`).join('');
        if (unique.some(([key])=>String(key) === value)) $(id).value = value;
      };
      options('armor-slot','All slots',C.ARMOR_SLOTS.map(bucket=>[bucket,bucketLabel(bucket)]));
      options('armor-set','All sets',items.filter(i=>i.armorData?.setHash).map(i=>[i.armorData.setHash,i.armorData.setName || 'Unnamed set']));
      options('armor-archetype','All archetypes',items.filter(i=>i.armorData?.archetypeHash).map(i=>[i.armorData.archetypeHash,i.armorData.archetypeName || 'Unnamed archetype']));
    }
    function renderArmorSets() {
      const sets = armorInfo().sets.filter(s=>$('armor-class').value === '' || String(s.classType) === $('armor-class').value);
      const opened = new Set([...$('armor-sets').querySelectorAll('details[open]')].map(el=>el.dataset.set));
      $('armor-sets').innerHTML = sets.map(set=>`<details class="armor-set-card" data-set="${esc(set.key)}" ${opened.has(set.key) ? 'open' : ''}><summary><b>${esc(set.name)}</b><small>${esc(C.CLASS_NAMES[set.classType])} · ${set.slots.length}/5 slots</small></summary><p>${set.slots.length >= 4 ? '4-piece bonus possible' : set.slots.length >= 2 ? '2-piece bonus possible' : 'Collect another slot for a 2-piece bonus'} · ${set.retained.length} slots retained after duplicate cleanup</p><div class="set-slots">${C.ARMOR_SLOTS.map(bucket=>`<span class="${set.slots.includes(bucket) ? 'owned' : ''}">${esc(bucketLabel(bucket))}${set.slots.includes(bucket) ? ' ✓' : ''}</span>`).join('')}</div></details>`).join('') || '<p class="muted armor-policy">No identified sets for this class. Pieces without set data stay in Review.</p>';
    }
    function statsText(values) { return Array.isArray(values) ? values.map((v,index)=>`${C.STAT_NAMES[index].slice(0,1)} ${v ?? '—'}`).join(' · ') : 'Stats unavailable'; }
    function armorRow(item) {
      const a = item.armorData || {}, record = armorInfo().records[item.id] || {state:'review',reason:'Comparison data missing'}, ok = selectable(item);
      const state = ({duplicate:'Duplicate',keep:'Keep',review:'Review',protected:'Protected'})[record.state];
      const name = a.setName || 'Set unverified', details = `${a.className || 'Unknown class'} · ${bucketLabel(item.bucket)} · ${item.owner === 'vault' ? 'Vault' : item.ownerName || 'Character'}`;
      const baseTotal = a.base?.every(Number.isInteger) ? a.base.reduce((sum,v)=>sum+v,0) : '—';
      const image = typeof item.icon === 'string' && item.icon.startsWith('/common/') ? `<img class="weapon-icon" loading="lazy" alt="" src="https://www.bungie.net${esc(item.icon)}">` : `<span class="weapon-icon">${icon('shield')}</span>`;
      return `<tr class="${selected.has(item.id) ? 'selected' : ''}"><td><input type="checkbox" data-id="${esc(item.id)}" aria-label="Select ${esc(item.name)}" ${selected.has(item.id) ? 'checked' : ''} ${!ok || busy ? 'disabled' : ''}></td><td><div class="weapon">${image}<div><b>${esc(item.name)}</b><small>${esc(details)}</small><small>${esc(name)} · ${esc(a.archetypeName || 'Archetype unverified')}</small></div></div></td><td><b class="armor-stat-total">${baseTotal}</b><small class="rank-detail">${a.tier ? 'Tier '+esc(a.tier) : 'Legacy / unknown'}</small><small class="armor-stat-line" title="${esc(C.STAT_NAMES.join(' · '))}">${esc(statsText(a.base))}</small></td><td><span class="armor-state" data-state="${record.state}">${state}</span><span class="reason">${esc(record.reason)}</span>${record.keeperId ? `<button class="compare-button" data-compare="${esc(item.id)}" ${busy ? 'disabled' : ''}>Compare</button>` : ''}${mode === 'manual' && ok ? '<small class="rank-detail">Manual transfer only</small>' : ''}</td></tr>`;
    }
    function compareArmor(id) {
      const item = snap.items.find(i=>i.id === id), record = armorInfo().records[id], keeper = snap.items.find(i=>i.id === record?.keeperId);
      if (!item || !keeper || busy) return;
      busy = true; render();
      $('dialog').innerHTML = `<section class="dialog" role="dialog" aria-modal="true" aria-labelledby="review-title"><p class="eyebrow">ARMOR COMPARISON</p><h2 id="review-title">Your retained replacement</h2><p>${esc(record.reason)}. Matching set, archetype, tier and available tuning/mod options.</p><div class="compare-copies"><div><b>Cleanup candidate</b><span>${esc(item.name)}</span><small>ID …${esc(item.id.slice(-8))} · ${esc(item.ownerName || 'Vault')}</small></div><div><b>Retained copy</b><span>${esc(keeper.name)}</span><small>ID …${esc(keeper.id.slice(-8))} · ${esc(keeper.owner === 'vault' ? 'Vault' : keeper.ownerName || 'Character')}</small></div></div><table class="compare-table"><thead><tr><th>Stat</th><th>Candidate</th><th>Retained</th></tr></thead><tbody>${C.STAT_NAMES.map((name,index)=>`<tr><td>${name}</td><td>${item.armorData.base[index]}</td><td>${keeper.armorData.base[index]}</td></tr>`).join('')}</tbody></table><p>Base stats exclude equipped mods and masterwork bonuses. At full masterwork: ${item.armorData.potential?.reduce((s,v)=>s+v,0) ?? '—'} total on the candidate; ${keeper.armorData.potential?.reduce((s,v)=>s+v,0) ?? '—'} on the retained copy. Distinct tuning options are kept separately.</p><p>The retained copy stays outside duplicate cleanup batches.</p><div class="dialog-actions"><button id="cancel-plan">Back to review</button></div></section>`;
      $('dialog').classList.remove('hidden');
      $('cancel-plan').onclick = ()=>{$('dialog').classList.add('hidden');busy = false;render();};
      $('cancel-plan').focus();
    }
    function batchSummary(batch) {
      const counts = {};
      for (const item of batch) counts[item.bucket] = (counts[item.bucket] || 0)+1;
      return Object.entries(counts).map(([bucket,count])=>`${bucketLabel(bucket)}: ${count}`).join(' · ');
    }
    function reviewRow(item) {
      if (kind === 'armor') {
        const keeperId = currentPlan.replacements?.[item.id] || armorInfo().records[item.id]?.keeperId;
        const keeper = snap.items.find(i=>i.id === keeperId);
        return `<li><span>${esc(item.name)}<small class="muted" style="display:block">${esc(item.armorData?.setName || 'Unverified set')} · ${esc(item.armorData?.archetypeName || 'Unverified archetype')}</small><small class="muted">ID …${esc(item.id.slice(-8))}${mode !== 'manual' && keeper ? '<br>Retain ID …'+esc(keeper.id.slice(-8))+' · '+esc(keeper.ownerName || 'Vault') : ''}</small></span><span class="armor-state" data-state="${mode === 'manual' ? 'review' : 'duplicate'}">${mode === 'manual' ? 'Manual' : 'Duplicate'}</span></li>`;
      }
      return `<li><span>${esc(item.name)}<small class="muted" style="display:block">${esc((item.perks || []).join(' · '))}</small><small class="muted">ID …${esc(item.id.slice(-8))}${mode === 'manual' ? ' · '+esc(C.reasons(item,grades).join(' · ') || 'No cleanup protections') : ''}</small></span><span class="badge" data-grade="${esc(C.gradeDetails(item,grades)?.best?.[0])}">${esc(C.gradeDetails(item,grades)?.best || '—')}</span></li>`;
    }
    function populateTargets() {
      const previous = $('target').value;
      $('target').innerHTML = snap.characters.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('') || '<option value="">No characters available</option>';
      if (snap.characters.some(c => c.id === previous)) $('target').value = previous;
      else $('target').value = snap.characters.find(c => c.current)?.id || snap.characters[0]?.id || '';
      populateArmorFilters();
    }
    function applySnapshot(next) { snap = next; populateTargets(); render(); }
    let lastNativeRefresh = 0;
    async function refresh(quiet = false, fromGame = false) {
      if (busy || loading) return;
      loading = true; render();
      try {
        if (fromGame) { lastNativeRefresh = Date.now(); if (!quiet) status('Refreshing inventory through DIM…'); }
        [snap, grades] = await Promise.all([fromGame && adapter.refresh ? adapter.refresh() : adapter.snapshot(), adapter.grades()]);
        populateTargets();
        if (!quiet) {
          if (snap.source === 'demo') status('INTERACTIVE DEMO · Sample inventory and ranks. Transfers are simulated and do not affect your account.', 'demo');
          else if (!snap.canTransfer) status((snap.warnings || []).join(' '), 'error');
          else status(kind === 'armor' ? `${candidates().length} verified vault duplicates. Sets and distinct stat/tuning options are retained.` : `${inventoryItems().filter(i => C.gradeDetails(i, grades)?.best).length} of ${inventoryItems().length} weapons have a confirmed maximum. Cleanup protects copies without a maximum.`);
        }
      } catch (error) { status(error.message, 'error'); }
      finally {
        if (pendingSnapshot && pendingSnapshot.at >= (snap.at || 0)) snap = pendingSnapshot;
        pendingSnapshot = null; loading = false; populateTargets(); render();
      }
    }
    async function prepare() {
      busy = true; render();
      try {
        currentPlan = await adapter.prepare({ ids: [...selected], grades, categories: [...categories], targetId: $('target').value, limit: Number($('limit').value), reserve: $('reserve').checked, mode, batchMode, kind });
        if (currentPlan.snapshot) applySnapshot(currentPlan.snapshot);
        $('dialog').innerHTML = `<section class="dialog" role="dialog" aria-modal="true" aria-labelledby="review-title"><p class="eyebrow">REVIEW THIS BATCH</p><h2 id="review-title">${currentPlan.batch.length} ${nouns(currentPlan.batch.length)} → ${esc(currentPlan.target.name)}</h2><p>${mode === 'manual' ? 'Manual selection bypasses cleanup recommendations and set protection. Locks and tags are retained.' : kind === 'armor' ? 'Only verified duplicates transfer. Their retained replacements and set coverage are preserved.' : 'This batch uses confirmed maximum ranks and cleanup protections.'}</p><p>${currentPlan.batchMode === 'total' || batchMode === 'total' ? 'Total limit across all slots' : 'Limit per slot'} · ${esc(batchSummary(currentPlan.batch))}</p><ul class="review-list">${currentPlan.batch.map(reviewRow).join('')}</ul>${currentPlan.skipped?.length ? `<p>${currentPlan.skipped.length} selected copies were left out due to space, limits or state. You can review them in the next batch.</p>` : ''}<p>${snap.source === 'demo' ? 'This batch is a simulation.' : 'After transferring, dismantle in-game. You can stop the batch between items.'}</p><div class="dialog-actions"><button id="cancel-plan">Back to review</button><button id="confirm-plan" class="primary">${snap.source === 'demo' ? 'Simulate transfer' : 'Send batch'}</button></div></section>`;
        $('dialog').classList.remove('hidden');
        $('cancel-plan').onclick = () => { $('dialog').classList.add('hidden'); currentPlan = null; busy = false; render(); };
        $('confirm-plan').onclick = transfer;
        $('confirm-plan').focus();
      } catch (error) { busy = false; status(error.message, 'error'); render(); }
    }
    async function transfer() {
      $('dialog').classList.add('hidden'); $('run').classList.remove('hidden'); $('run-text').textContent = 'Starting batch…'; $('stop').disabled = false;
      try {
        const result = await adapter.transfer(currentPlan.token);
        snap = result.snapshot; populateTargets();
        status(`${snap.source === 'demo' ? 'Simulation: ' : ''}${result.moved} ${nouns(result.moved)} transferred and confirmed.${result.stopped ? ' The batch was stopped.' : ' Dismantle in-game and prepare the next batch.'}`);
      } catch (error) { status(error.message, 'error'); }
      finally { currentPlan = null; busy = false; $('run').classList.add('hidden'); await refresh(true); render(); }
    }
    if (adapter.onProgress) adapter.onProgress(data => {
      $('run-text').textContent = `${data.moved} / ${data.total} confirmed · ${data.name}`;
      if (data.completedId) selected.delete(data.completedId);
      if (data.snapshot) applySnapshot(data.snapshot);
    });
    if (adapter.onInventoryChanged) adapter.onInventoryChanged(next => {
      if (loading) pendingSnapshot = next;
      else if (host.style.display === 'none') snap = next;
      else applySnapshot(next);
    });
    const refreshOnReturn = () => {
      if (document.hidden || host.style.display === 'none' || busy || loading || snap.source !== 'live' || Date.now()-lastNativeRefresh < 10000) return;
      refresh(true, true);
    };
    window.addEventListener('focus', refreshOnReturn);
    document.addEventListener('visibilitychange', refreshOnReturn);
    $('refresh').onclick = () => refresh(false, true);
    $('sync').onclick = async () => { try { await adapter.sync(); status('In light.gg, choose ☰ → Settings → Popularity Rank Display → Best Available. When ranks update, check “I am viewing Best Available” in the capture bar. Then return and click Refresh inventory.'); } catch(error) { status(error.message,'error'); } };
    $('prepare').onclick = prepare;
    $('search-dim').onclick = async () => { try { await adapter.search([...selected]); } catch(error) { status(error.message,'error'); } };
    $('stop').onclick = async () => { $('stop').disabled = true; try { await adapter.stop(); $('run-text').textContent = 'Stopping: a request already sent may finish. Refresh DIM before retrying.'; } catch(error) { status(error.message,'error'); } };
    $('query').oninput = () => { query = $('query').value; render(); };
    $('inventory-picker').onclick = event=> {
      const next = event.target.closest('[data-kind]')?.dataset.kind;
      if (!next || next === kind || busy) return;
      kind = next; mode = 'clean'; view = 'candidates'; selected.clear(); query = ''; $('query').value = '';
      $('transfer-mode').innerHTML = `<option value="clean">${kind === 'armor' ? 'Duplicate cleanup' : 'Cleanup by maximum'}</option><option value="manual">Manual transfer</option>`;
      $('tabs').innerHTML = kind === 'armor' ? '<button data-view="candidates">Duplicates</button><button data-view="keep">Keep</button><button data-view="review">Review</button><button data-view="protected">Protected</button><button data-view="all">All</button>' : '<button data-view="candidates">Candidates</button><button data-view="protected">Protected</button><button data-view="ungraded">No maximum</button><button data-view="all">All</button>';
      const max = batchMode === 'total' ? (kind === 'armor' ? 45 : 27) : 9;
      $('limit').max = String(max); $('limit').value = String(Math.min(max,Number($('limit').value) || 9));
      status(snap.source === 'demo' ? 'INTERACTIVE DEMO · Sample armor and weapons. Transfers are simulated.' : kind === 'armor' ? 'Review verified duplicates. Distinct rolls, tuning options and sets are retained.' : 'Review weapons by their confirmed maximum popularity.');
      render();
    };
    for (const id of ['armor-class','armor-slot','armor-set','armor-archetype','armor-tier']) $(id).onchange = ()=> {
      if (id === 'armor-class' && $('armor-class').value !== '') {
        const target = snap.characters.find(c=>String(c.classType) === $('armor-class').value);
        if (target) $('target').value = target.id;
      }
      render();
    };
    $('target').onchange = render; $('reserve').onchange = render; $('limit').oninput = render;
    $('batch-mode').onchange = ()=>{batchMode=$('batch-mode').value;const max=batchMode === 'total' ? (kind === 'armor' ? 45 : 27) : 9;$('limit').max=String(max);$('limit').value=String(Math.max(1,Math.min(max,Math.floor(Number($('limit').value) || 9))));render();};
    $('transfer-mode').onchange = ()=>{mode=$('transfer-mode').value;selected.clear();view=mode === 'manual' ? 'all' : 'candidates';render();};
    $('grades').onclick = event => { const btn = event.target.closest('[data-grade]'); if (!btn || busy || mode === 'manual') return; const grade = btn.dataset.grade; if (categories.has(grade)) categories.delete(grade); else categories.add(grade); render(); };
    $('tabs').onclick = event => { const btn = event.target.closest('[data-view]'); if (!btn || busy) return; view = btn.dataset.view; render(); };
    $('rows').onchange = event => { const id = event.target.dataset.id; if (!id || busy) return; if (event.target.checked) selected.add(id); else selected.delete(id); render(); };
    $('rows').onclick = event=> { const id = event.target.closest('[data-compare]')?.dataset.compare; if (id) compareArmor(id); };
    function selectVisible() { if (busy) return; const eligible = rows().filter(selectable); const all = eligible.length && eligible.every(i => selected.has(i.id)); for (const item of eligible) all ? selected.delete(item.id) : selected.add(item.id); render(); }
    $('select-visible').onclick = selectVisible; $('all-check').onchange = selectVisible;
    if ($('close')) $('close').onclick = () => { host.style.display = 'none'; };
    if (adapter.onGradesChanged) adapter.onGradesChanged(async () => { grades = await adapter.grades(); if (!busy) render(); });
    // DIM sees the shadow host as event.target, so its form-control shortcut
    // guard cannot see our focused input. Keep panel keys out of page hotkeys
    // without cancelling native typing, editing or keyboard navigation.
    root.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Escape' && !$('dialog').classList.contains('hidden')) $('cancel-plan')?.click();
    });
    for (const type of ['keypress', 'keyup']) root.addEventListener(type, event => event.stopPropagation());
    refresh();
    return { refresh, root };
  };
})();
