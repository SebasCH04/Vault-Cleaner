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
<div class="scroll"><aside class="left">
<div class="intro"><p class="eyebrow">YOUR NEXT CLEANUP</p><h2>Make room<br>for what's next.</h2><p class="muted">Choose ranks. Review your weapons.<br>Transfer them in batches.</p></div>
<div class="stats"><div class="stat"><div><b id="rated">—</b><span>weapons with a confirmed maximum</span><div class="progress"><i id="coverage"></i></div></div></div><div class="stat"><div><b id="total">—</b><span>total weapons in your inventory</span></div></div><div class="stat"><div><b id="candidates">—</b><span>vault candidates</span></div></div></div>
<div class="top-actions"><button id="refresh">${icon('refresh')}Refresh inventory</button><button id="sync" class="quiet">Sync light.gg ↗</button></div>
<div class="section-title"><h3>Maximum popularity</h3><span>light.gg</span></div><div class="grades" id="grades"></div>
<p class="muted" style="font-size:11px;line-height:1.5">Uses the highest rank possible with this copy's available perks. A C that can reach S is classified as S.</p>
<div class="safeguards"><span>Locked weapons protected</span><span>Favorites and loadouts</span><span>Crafted and exotic weapons</span></div>
</aside><main class="right"><div id="status" class="status">Connecting to inventory…</div>
<div class="mode-picker"><label class="field">Transfer mode<select id="transfer-mode"><option value="clean">Cleanup by maximum</option><option value="manual">Manual transfer</option></select></label><p class="muted" id="mode-hint"></p></div>
<div class="tabs" id="tabs"><button class="active" data-view="candidates">Candidates</button><button data-view="protected">Protected</button><button data-view="ungraded">No maximum</button><button data-view="all">All</button></div>
<div class="toolbar"><input class="search" id="query" placeholder="Search weapons or perks…" aria-label="Search weapons or perks"><button id="select-visible">Select visible</button></div><p class="list-count" id="list-count">Waiting for inventory.</p>
<div class="table-wrap"><table><thead><tr><th style="width:28px"><input id="all-check" type="checkbox" aria-label="Select visible weapons"></th><th>Weapon / perks</th><th>Maximum</th><th>Status</th></tr></thead><tbody id="rows"></tbody></table></div>
<p class="muted" style="font-size:10px;margin:12px 0 0">Cleanup protects weapons with an unknown maximum. Manual transfer lets you choose any rank or an ungraded weapon.</p>
</main></div>
<footer class="footer"><div class="footer-left"><div class="destination">
<label class="field">Destination character<select id="target"><option value="">Waiting for characters…</option></select></label>
<label class="field">Batch sizing<select id="batch-mode"><option value="slot">Per slot</option><option value="total">Total</option></select></label>
<label class="field"><span id="limit-label">Max / slot</span><input type="number" id="limit" value="9" min="1" max="9"></label>
</div><div class="batch-options"><p class="sizing-hint" id="sizing-hint"></p><label class="reserve"><input type="checkbox" id="reserve">Keep 1 extra space per slot</label></div></div>
<div class="footer-right"><div class="send-row"><div class="selection"><b id="selected-count">0</b> selected<small id="capacity">Transfers respect available space.</small></div><div class="batch-actions"><button id="search-dim" class="quiet">View in DIM</button><button id="prepare" class="primary">Prepare batch ${icon('arrow')}</button></div></div>
<div id="run" class="run-box hidden"><span id="run-text"></span><button id="stop" class="danger">Stop</button></div><p class="footnote">Review the batch before sending. Dismantle in Destiny 2, then prepare the next batch.</p></div>
</footer><div id="dialog" class="dialog-backdrop hidden"></div></div>`;
    root.append(shell);
    const $ = id => root.getElementById(id);
    let snap = { items: [], characters: [], canTransfer: false }, grades = {}, selected = new Set(), categories = new Set(['C','D','F']), view = 'candidates', query = '', busy = false, loading = false, currentPlan = null, mode = 'clean', batchMode = 'slot';
    function status(text, kind = '') { $('status').textContent = text; $('status').className = 'status' + (kind ? ` ${kind}` : ''); }
    function candidates() { return snap.items.filter(item => C.eligible(item, grades, [...categories])); }
    function rows() {
      return snap.items.filter(item => {
        const grade = C.gradeFor(item, grades);
        const candidate = C.eligible(item, grades, [...categories]);
        if (view === 'candidates' && !candidate) return false;
        if (view === 'protected' && (!grade || candidate || !C.reasons(item, grades).length)) return false;
        if (view === 'ungraded' && C.gradeDetails(item, grades)?.best) return false;
        return !query || [item.name, ...(item.perks || [])].join(' ').toLowerCase().includes(query.toLowerCase());
      });
    }
    function selectable(item) { return C.canSelect(item, grades, [...categories], mode); }
    function syncSelection() { for (const id of selected) if (!snap.items.some(i => i.id === id && selectable(i))) selected.delete(id); }
    function render() {
      syncSelection();
      const rated = snap.items.filter(i => C.gradeDetails(i, grades)?.best).length;
      $('rated').textContent = rated; $('total').textContent = snap.items.length; $('candidates').textContent = candidates().length;
      $('coverage').style.width = `${snap.items.length ? rated / snap.items.length * 100 : 0}%`;
      $('grades').innerHTML = ['S','A','B','C','D','F'].map(grade => `<button class="grade-button ${categories.has(grade) ? 'active' : ''}" data-grade="${grade}" aria-pressed="${categories.has(grade)}" ${busy || mode === 'manual' ? 'disabled' : ''}><b>${grade}</b><span>${snap.items.filter(i => C.gradeDetails(i, grades)?.best?.[0] === grade).length} weapons</span></button>`).join('');
      $('mode-hint').textContent = mode === 'manual' ? 'Choose any transferable vault weapon, including S, ungraded, locked or cleanup-protected copies. You decide what to dismantle in-game.' : 'Candidates use each copy’s maximum rank and keep cleanup protections.';
      $('limit-label').textContent = batchMode === 'total' ? 'Max / batch' : 'Max / slot';
      $('sizing-hint').textContent = batchMode === 'total' ? 'One limit across all selected slots.' : 'Separate limit for Kinetic, Energy and Power.';
      const visible = rows();
      $('list-count').textContent = `${visible.length} visible weapons · ${selected.size} selected${snap.source === 'demo' ? ' · demo data' : ''}`;
      $('rows').innerHTML = visible.slice(0, 1500).map(item => {
        const details = C.gradeDetails(item, grades), grade = details?.best, ok = selectable(item);
        const protection = mode === 'manual' ? C.transferReasons(item) : C.reasons(item, grades);
        const note = `<span class="badge" data-grade="${esc(grade?.[0] || '')}">${esc(grade || '—')}</span><small class="rank-detail">${details?.current ? 'Current ' + esc(details.current) : grade ? 'Best Available' : 'Unconfirmed'}</small>`;
        const perks = (item.perks || []).join(' · ');
        let image = `<span class="weapon-icon">${icon('weapon')}</span>`;
        if (typeof item.icon === 'string' && item.icon.startsWith('/common/')) image = `<img class="weapon-icon" loading="lazy" alt="" src="https://www.bungie.net${esc(item.icon)}">`;
        return `<tr class="${selected.has(item.id) ? 'selected' : ''}"><td><input type="checkbox" data-id="${esc(item.id)}" aria-label="Select ${esc(item.name)}" ${selected.has(item.id) ? 'checked' : ''} ${!ok || busy ? 'disabled' : ''}></td><td><div class="weapon">${image}<div><b>${esc(item.name)}</b><small>${esc(item.type || item.bucketName)} · ${esc(item.owner === 'vault' ? 'Vault' : item.ownerName || 'Character')}</small>${perks ? `<small title="${esc(perks)}">${esc(perks.length > 76 ? perks.slice(0,73) + '…' : perks)}</small>` : ''}</div></div></td><td>${note}</td><td>${ok ? `<span class="tag">${mode === 'manual' ? 'Transfer only' + (item.locked ? ' · locked' : '') : 'Ready to review'}</span>` : `<span class="reason" title="${esc(protection.join(' · '))}">${esc(protection[0] || (grade ? 'Rank ' + grade + ': another category' : 'Ungraded'))}</span>`}</td></tr>`;
      }).join('') || '<tr><td colspan="4" class="empty"><strong>No weapons in this view.</strong>Sync light.gg or change the selected ranks.</td></tr>';
      const eligibleVisible = visible.filter(selectable);
      $('all-check').checked = eligibleVisible.length > 0 && eligibleVisible.every(i => selected.has(i.id));
      $('all-check').disabled = busy || !eligibleVisible.length;
      $('selected-count').textContent = selected.size;
      for (const id of ['prepare','search-dim']) $(id).disabled = busy || !selected.size || (id === 'prepare' && !snap.canTransfer);
      $('refresh').disabled = busy || loading;
      for (const id of ['target','limit','reserve','select-visible','sync','query','transfer-mode','batch-mode']) $(id).disabled = busy;
      $('tabs').querySelectorAll('button').forEach(btn => { btn.classList.toggle('active', btn.dataset.view === view); btn.disabled = busy; });
      const target = snap.characters.find(c => c.id === $('target').value);
      if (target) {
        const maxLimit = batchMode === 'total' ? 27 : 9;
        const limit = Math.max(1,Math.min(maxLimit,Math.floor(Number($('limit').value) || 9)));
        const perSlot = batchMode === 'total' ? 9 : limit;
        const slots = Object.keys(target.capacity || {}).map(bucket => ({bucket,free:Number.isInteger(target.capacity[bucket]) && Number.isInteger(target.occupied?.[bucket]) ? Math.min(perSlot,Math.max(0,target.capacity[bucket]-target.occupied[bucket]-($('reserve').checked ? 1 : 0))) : 0}));
        const total = Math.min(batchMode === 'total' ? limit : 27,slots.reduce((sum,slot)=>sum+slot.free,0));
        $('capacity').textContent = slots.map(slot=>`${bucketLabel(slot.bucket)}: ${slot.free}`).join(' · ') + ` · Up to ${total} this batch.`;

      }
    }
    function bucketLabel(bucket) { return ({kinetic:'Kinetic',energy:'Energy',power:'Power','1498876634':'Kinetic','2465295065':'Energy','953998645':'Power'})[bucket] || snap.items.find(item=>item.bucket === bucket)?.bucketName || bucket; }
    function batchSummary(batch) {
      const counts = {};
      for (const item of batch) counts[item.bucket] = (counts[item.bucket] || 0)+1;
      return Object.entries(counts).map(([bucket,count])=>`${bucketLabel(bucket)}: ${count}`).join(' · ');
    }
    function populateTargets() {
      const previous = $('target').value;
      $('target').innerHTML = snap.characters.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('') || '<option value="">No characters available</option>';
      if (snap.characters.some(c => c.id === previous)) $('target').value = previous;
      else $('target').value = snap.characters.find(c => c.current)?.id || snap.characters[0]?.id || '';
    }
    async function refresh(quiet = false) {
      if (busy || loading) return;
      loading = true; render();
      try {
        [snap, grades] = await Promise.all([adapter.snapshot(), adapter.grades()]);
        populateTargets();
        if (!quiet) {
          if (snap.source === 'demo') status('INTERACTIVE DEMO · Sample inventory and ranks. Transfers are simulated and do not affect your account.', 'demo');
          else if (!snap.canTransfer) status((snap.warnings || []).join(' '), 'error');
          else status(`${snap.items.filter(i => C.gradeDetails(i, grades)?.best).length} of ${snap.items.length} weapons have a confirmed maximum. Cleanup protects copies without a maximum.`);
        }
      } catch (error) { status(error.message, 'error'); }
      finally { loading = false; render(); }
    }
    async function prepare() {
      busy = true; render();
      try {
        currentPlan = await adapter.prepare({ ids: [...selected], grades, categories: [...categories], targetId: $('target').value, limit: Number($('limit').value), reserve: $('reserve').checked, mode, batchMode });
        $('dialog').innerHTML = `<section class="dialog" role="dialog" aria-modal="true" aria-labelledby="review-title"><p class="eyebrow">REVIEW THIS BATCH</p><h2 id="review-title">${currentPlan.batch.length} ${currentPlan.batch.length === 1 ? 'weapon' : 'weapons'} → ${esc(currentPlan.target.name)}</h2><p>${mode === 'manual' ? 'Manual selection: these copies transfer without rank or cleanup protection filters. Their locks and tags are retained.' : 'This batch uses confirmed maximum ranks and cleanup protections.'}</p><p>${currentPlan.batchMode === 'total' || batchMode === 'total' ? 'Total limit across all slots' : 'Limit per slot'} · ${esc(batchSummary(currentPlan.batch))}</p><ul class="review-list">${currentPlan.batch.map(item => `<li><span>${esc(item.name)}<small class="muted" style="display:block">${esc((item.perks || []).join(' · '))}</small><small class="muted">ID …${esc(item.id.slice(-8))}${mode === 'manual' ? ' · ' + esc(C.reasons(item, grades).join(' · ') || 'No cleanup protections') : ''}</small></span><span class="badge" data-grade="${esc(C.gradeDetails(item, grades)?.best?.[0])}">${esc(C.gradeDetails(item, grades)?.best || '—')}</span></li>`).join('')}</ul>${currentPlan.skipped?.length ? `<p>${currentPlan.skipped.length} selected copies were left out due to space, limits or state. You can review them in the next batch.</p>` : ''}<p>${snap.source === 'demo' ? 'This batch is a simulation.' : 'After transferring, dismantle in-game. You can stop the batch between weapons.'}</p><div class="dialog-actions"><button id="cancel-plan">Back to review</button><button id="confirm-plan" class="primary">${snap.source === 'demo' ? 'Simulate transfer' : 'Send batch'}</button></div></section>`;
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
        status(`${snap.source === 'demo' ? 'Simulation: ' : ''}${result.moved} weapon${result.moved === 1 ? '' : 's'} transferred and confirmed.${result.stopped ? ' The batch was stopped.' : ' Dismantle in-game and prepare the next batch.'}`);
      } catch (error) { status(error.message, 'error'); }
      finally { currentPlan = null; busy = false; $('run').classList.add('hidden'); await refresh(true); render(); }
    }
    if (adapter.onProgress) adapter.onProgress(data => {
      $('run-text').textContent = `${data.moved} / ${data.total} confirmed · ${data.name}`;
      if (data.completedId) selected.delete(data.completedId);
    });
    $('refresh').onclick = () => refresh();
    $('sync').onclick = async () => { try { await adapter.sync(); status('In light.gg, choose ☰ → Settings → Popularity Rank Display → Best Available. When ranks update, check “I am viewing Best Available” in the capture bar. Then return and click Refresh inventory.'); } catch(error) { status(error.message,'error'); } };
    $('prepare').onclick = prepare;
    $('search-dim').onclick = async () => { try { await adapter.search([...selected]); } catch(error) { status(error.message,'error'); } };
    $('stop').onclick = async () => { $('stop').disabled = true; try { await adapter.stop(); $('run-text').textContent = 'Stopping: a request already sent may finish. Refresh DIM before retrying.'; } catch(error) { status(error.message,'error'); } };
    $('query').oninput = () => { query = $('query').value; render(); };
    $('target').onchange = render; $('reserve').onchange = render; $('limit').oninput = render;
    $('batch-mode').onchange = ()=>{batchMode=$('batch-mode').value;const max=batchMode === 'total' ? 27 : 9;$('limit').max=String(max);$('limit').value=String(Math.max(1,Math.min(max,Math.floor(Number($('limit').value) || 9))));render();};
    $('transfer-mode').onchange = ()=>{mode=$('transfer-mode').value;selected.clear();view=mode === 'manual' ? 'all' : 'candidates';render();};
    $('grades').onclick = event => { const btn = event.target.closest('[data-grade]'); if (!btn || busy || mode === 'manual') return; const grade = btn.dataset.grade; if (categories.has(grade)) categories.delete(grade); else categories.add(grade); render(); };
    $('tabs').onclick = event => { const btn = event.target.closest('[data-view]'); if (!btn || busy) return; view = btn.dataset.view; render(); };
    $('rows').onchange = event => { const id = event.target.dataset.id; if (!id || busy) return; if (event.target.checked) selected.add(id); else selected.delete(id); render(); };
    function selectVisible() { if (busy) return; const eligible = rows().filter(selectable); const all = eligible.length && eligible.every(i => selected.has(i.id)); for (const item of eligible) all ? selected.delete(item.id) : selected.add(item.id); render(); }
    $('select-visible').onclick = selectVisible; $('all-check').onchange = selectVisible;
    if ($('close')) $('close').onclick = () => { host.style.display = 'none'; };
    if (adapter.onGradesChanged) adapter.onGradesChanged(async () => { grades = await adapter.grades(); if (!busy) render(); });
    root.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('dialog').classList.contains('hidden')) $('cancel-plan')?.click(); });
    refresh();
    return { refresh, root };
  };
})();
