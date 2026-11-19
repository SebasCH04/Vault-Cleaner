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
    shell.innerHTML = `<div class="app"><header class="head"><div class="brand"><div class="logo">${icon('vault')}</div><div><h1>Vault Cleaner</h1><p>DESTINY 2 · MENOS VAULT, MÁS JUEGO</p></div></div><span class="pill mode">BASE 0.1.4</span>${standalone ? '' : '<button class="quiet" id="close" aria-label="Cerrar panel">✕</button>'}</header><div class="scroll"><aside class="left"><div class="intro"><p class="eyebrow">TU PRÓXIMA LIMPIEZA</p><h2>Haz espacio<br>para lo que viene.</h2><p class="muted">Elige las notas. Revisa tus armas.<br>Envíalas al personaje por tandas.</p></div><div class="stats"><div class="stat"><div><b id="rated">—</b><span>armas con máximo confirmado</span><div class="progress"><i id="coverage"></i></div></div></div><div class="stat"><div><b id="total">—</b><span>armas en tu inventario</span></div></div><div class="stat"><div><b id="candidates">—</b><span>candidatas en el vault</span></div></div></div><div class="top-actions"><button id="refresh">${icon('refresh')}Actualizar inventario</button><button id="sync" class="quiet">Sincronizar light.gg ↗</button></div><div class="section-title"><h3>Máxima popularidad</h3><span>light.gg</span></div><div class="grades" id="grades"></div><p class="muted" style="font-size:11px;line-height:1.5">Se filtra por el máximo de esta copia. En light.gg activa Settings → Popularity Rank Display → Best Available y confírmalo en la franja verde.</p><div class="safeguards"><span>Bloqueadas protegidas</span><span>Favoritas y loadouts</span><span>Fabricadas y exóticas</span></div></aside><main class="right"><div id="status" class="status">Conectando con el inventario…</div><div class="tabs" id="tabs"><button class="active" data-view="candidates">Candidatas</button><button data-view="protected">Protegidas</button><button data-view="improvable">Mejorables</button><button data-view="ungraded">Sin nota</button><button data-view="all">Todas</button></div><div class="toolbar"><input class="search" id="query" placeholder="Buscar arma o perk…" aria-label="Buscar arma o perk"><button id="select-visible">Seleccionar visibles</button></div><p class="list-count" id="list-count">Esperando inventario.</p><div class="table-wrap"><table><thead><tr><th style="width:28px"><input id="all-check" type="checkbox" aria-label="Seleccionar armas visibles"></th><th>Arma / perks</th><th>Máximo</th><th>Estado</th></tr></thead><tbody id="rows"></tbody></table></div><p class="muted" style="font-size:10px;margin:12px 0 0">El máximo usa los perks disponibles en esta copia. Si falta confirmarlo, el arma queda protegida. «Sin nota» nunca se convierte en F.</p></main></div><footer class="footer"><div class="footer-left"><div class="destination"><label class="field">Personaje de destino<select id="target"><option value="">Esperando personajes…</option></select></label><label class="field">Máx. / tanda<input type="number" id="limit" value="9" min="1" max="27"></label></div><label class="reserve"><input type="checkbox" id="reserve" checked>Reservar un espacio libre por ranura</label></div><div class="footer-right"><div class="send-row"><div class="selection"><b id="selected-count">0</b> seleccionadas<small id="capacity">El traslado respeta los espacios libres.</small></div><div><button id="search-dim" class="quiet" style="min-width:0;margin-right:6px">Ver en DIM</button><button id="prepare" class="primary">Preparar tanda ${icon('arrow')}</button></div></div><div id="run" class="run-box hidden"><span id="run-text"></span><button id="stop" class="danger">Detener</button></div><p class="footnote">Revisa la tanda antes de enviarla. Después, desmantela dentro de Destiny 2 y prepara la siguiente.</p></div></footer><div id="dialog" class="dialog-backdrop hidden"></div></div>`;
    root.append(shell);
    const $ = id => root.getElementById(id);
    let snap = { items: [], characters: [], canTransfer: false }, grades = {}, selected = new Set(), categories = new Set(['C','D','F']), view = 'candidates', query = '', busy = false, loading = false, currentPlan = null;
    function status(text, kind = '') { $('status').textContent = text; $('status').className = 'status' + (kind ? ` ${kind}` : ''); }
    function candidates() { return snap.items.filter(item => C.eligible(item, grades, [...categories])); }
    function rows() {
      return snap.items.filter(item => {
        const grade = C.gradeFor(item, grades);
        const details = C.gradeDetails(item, grades);
        if (view === 'improvable' && C.improvementFor(item, grades) === 'none') return false;
        const candidate = C.eligible(item, grades, [...categories]);
        if (view === 'candidates' && !candidate) return false;
        if (view === 'protected' && (!grade || candidate || !C.reasons(item, grades).length)) return false;
        if (view === 'ungraded' && grade) return false;
        return !query || [item.name, ...(item.perks || [])].join(' ').toLowerCase().includes(query.toLowerCase());
      });
    }
    function syncSelection() { for (const id of selected) if (!candidates().some(i => i.id === id)) selected.delete(id); }
    function render() {
      syncSelection();
      const rated = snap.items.filter(i => C.gradeDetails(i, grades)?.best).length;
      $('rated').textContent = rated; $('total').textContent = snap.items.length; $('candidates').textContent = candidates().length;
      $('coverage').style.width = `${snap.items.length ? rated / snap.items.length * 100 : 0}%`;
      $('grades').innerHTML = ['S','A','B','C','D','F'].map(grade => `<button class="grade-button ${categories.has(grade) ? 'active' : ''}" data-grade="${grade}" aria-pressed="${categories.has(grade)}" ${busy ? 'disabled' : ''}><b>${grade}</b><span>${snap.items.filter(i => C.gradeDetails(i, grades)?.best?.[0] === grade).length} armas</span></button>`).join('');
      const visible = rows();
      $('list-count').textContent = view === 'improvable' ? `${visible.filter(item=>C.improvementFor(item,grades)==='improvable').length} mejorables · ${visible.filter(item=>C.improvementFor(item,grades)==='check').length} por comprobar · todas las categorías` : `${visible.length} armas visibles · ${selected.size} seleccionadas${snap.source === 'demo' ? ' · datos de demostración' : ''}`;
      $('rows').innerHTML = visible.slice(0, 1500).map(item => {
        const grade = C.gradeFor(item, grades), ok = C.eligible(item, grades, [...categories]);
        const details = C.gradeDetails(item, grades);
        const protection = C.reasons(item, grades);
        const improvement = C.improvementFor(item, grades);
        const improveButton = improvement !== 'none' && typeof adapter.improve === 'function' ? `<button class="improve-button" data-improve="${esc(item.id)}" ${busy ? 'disabled' : ''}>${improvement === 'check' ? 'Comprobar y aplicar' : 'Aplicar perks populares'}</button>` : '';
        const improveState = improvement === 'check' ? 'Por comprobar: falta rango actual' : 'Puede mejorar sus perks';
        const note = `<span class="badge" data-grade="${esc(details?.best?.[0] || '')}">${esc(details?.best || '—')}</span><small style="display:block;font-size:10px;color:#a8b6c6;margin-top:5px">${details?.current ? 'Actual ' + esc(details.current) : details?.best ? 'Best Available' : 'Sin confirmar'}</small>`;
        const perks = (item.perks || []).join(' · ');
        let image = `<span class="weapon-icon">${icon('weapon')}</span>`;
        if (typeof item.icon === 'string' && item.icon.startsWith('/common/')) image = `<img class="weapon-icon" loading="lazy" alt="" src="https://www.bungie.net${esc(item.icon)}">`;
        return `<tr class="${selected.has(item.id) ? 'selected' : ''}"><td><input type="checkbox" data-id="${esc(item.id)}" aria-label="Seleccionar ${esc(item.name)}" ${selected.has(item.id) ? 'checked' : ''} ${!ok || busy || view === 'improvable' ? 'disabled' : ''}></td><td><div class="weapon">${image}<div><b>${esc(item.name)}</b><small>${esc(item.type || item.bucketName)} · ${esc(item.owner === 'vault' ? 'Vault' : item.ownerName || 'Personaje')}</small>${perks ? `<small title="${esc(perks)}">${esc(perks.length > 76 ? perks.slice(0,73) + '…' : perks)}</small>` : ''}</div></div></td><td>${note}</td><td>${view === 'improvable' ? `<span class="reason">${esc(improveState)}</span>${improveButton}` : `${ok ? '<span class="tag">Lista para revisar</span>' : `<span class="reason" title="${esc(protection.join(' · '))}">${esc(protection[0] || (details?.best ? 'Máximo ' + details.best + ': otra categoría' : 'Otra categoría'))}</span>`}${view === 'all' ? improveButton : ''}`}</td></tr>`;
      }).join('') || '<tr><td colspan="4" class="empty"><strong>No hay armas en esta vista.</strong>Sincroniza light.gg o cambia las notas seleccionadas.</td></tr>';
      const eligibleVisible = view === 'improvable' ? [] : visible.filter(i => C.eligible(i, grades, [...categories]));
      $('select-visible').classList.toggle('hidden', view === 'improvable');
      $('all-check').checked = eligibleVisible.length > 0 && eligibleVisible.every(i => selected.has(i.id));
      $('all-check').disabled = busy || !eligibleVisible.length;
      $('selected-count').textContent = selected.size;
      for (const id of ['prepare','search-dim']) $(id).disabled = busy || !selected.size || (id === 'prepare' && !snap.canTransfer);
      $('refresh').disabled = busy || loading;
      for (const id of ['target','limit','reserve','select-visible','sync','query']) $(id).disabled = busy;
      $('tabs').querySelectorAll('button').forEach(btn => { btn.classList.toggle('active', btn.dataset.view === view); btn.disabled = busy; });
      const target = snap.characters.find(c => c.id === $('target').value);
      if (target) {
        const free = Object.keys(target.capacity || {}).map(b => Math.max(0, target.capacity[b] - (target.occupied[b] || 0) - ($('reserve').checked ? 1 : 0)));
        $('capacity').textContent = `${free.reduce((a,b) => a+b,0)} espacios disponibles entre las ranuras de armas.`;
      }
    }
    function populateTargets() {
      const previous = $('target').value;
      $('target').innerHTML = snap.characters.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('') || '<option value="">Sin personajes disponibles</option>';
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
          if (snap.source === 'demo') status('DEMO INTERACTIVA · Inventario y notas de prueba. Los traslados aquí son simulados y no afectan tu cuenta.', 'demo');
          else if (!snap.canTransfer) status((snap.warnings || []).join(' '), 'error');
          else status(`${snap.items.filter(i => C.gradeDetails(i, grades)?.best).length} de ${snap.items.length} armas tienen máximo confirmado. La limpieza usa Best Available; los máximos pendientes quedan protegidos.`);
        }
      } catch (error) { status(error.message, 'error'); }
      finally { loading = false; render(); }
    }
    function reviewImprovement(id) {
      if (busy) return;
      const item = snap.items.find(item=>item.id===id);
      if (!item || C.improvementFor(item, grades)==='none' || typeof adapter.improve!=='function') return;
      busy=true; render();
      const details=C.gradeDetails(item, grades);
      $('dialog').innerHTML=`<section class="dialog" role="dialog" aria-modal="true" aria-labelledby="improve-title"><p class="eyebrow">PERKS MÁS POPULARES</p><h2 id="improve-title">${esc(item.name)}</h2><p>Copia …${esc(item.id.slice(-8))} · Actual ${esc(details?.current || 'por comprobar')} → Máximo ${esc(details?.best || 'por comprobar')}</p><p>Se pedirá a light.gg que aplique los perks más populares disponibles en esta copia. Cambia su selección de perks en el juego. No la traslada ni la desmantela.</p><p>Perks actuales: ${esc((item.perks || []).join(' · ') || 'No disponibles')}</p><p>${snap.source==='demo' ? 'La mejora de esta demo es simulada.' : 'Mantén Roll Appraiser abierto y la copia en su vista capturada. Debes estar en órbita, en un espacio social o fuera del juego. Si ya usa los perks populares, puede que light.gg no ofrezca cambios.'}</p><div class="dialog-actions"><button id="cancel-improve">Volver</button><button id="confirm-improve" class="primary">${snap.source==='demo' ? 'Simular mejora' : 'Aplicar perks populares'}</button></div></section>`;
      $('dialog').classList.remove('hidden');
      $('cancel-improve').onclick=()=>{$('dialog').classList.add('hidden');busy=false;render();};
      $('confirm-improve').onclick=async()=>{
        $('dialog').classList.add('hidden');status('Comprobando la copia y enviando la mejora a light.gg…');
        try {
          const result=await adapter.improve(id);
          status(result.status==='simulated' ? 'Simulación: perks populares aplicados a esta copia.' : 'Solicitud enviada a light.gg. Comprueba su respuesta allí; después actualiza DIM y sincroniza de nuevo. Hasta verificar el resultado no se marca como mejorada.');
        } catch(error) { status(error.message,'error'); }
        finally {busy=false;await refresh(true);render();}
      };
      $('confirm-improve').focus();
    }
    async function prepare() {
      busy = true; render();
      try {
        currentPlan = await adapter.prepare({ ids: [...selected], grades, categories: [...categories], targetId: $('target').value, limit: Number($('limit').value), reserve: $('reserve').checked });
        $('dialog').innerHTML = `<section class="dialog" role="dialog" aria-modal="true" aria-labelledby="review-title"><p class="eyebrow">REVISA ESTA TANDA</p><h2 id="review-title">${currentPlan.batch.length} armas → ${esc(currentPlan.target.name)}</h2><p>Se moverán sin equiparse. Las demás armas permanecerán donde están.</p><ul class="review-list">${currentPlan.batch.map(item => `<li><span>${esc(item.name)}<small class="muted" style="display:block">${esc((item.perks || []).join(' · '))}</small><small class="muted">ID …${esc(item.id.slice(-8))}</small></span><span class="badge" data-grade="${esc(C.gradeFor(item, grades)?.[0])}">${esc(C.gradeFor(item, grades))}</span></li>`).join('')}</ul><p>${snap.source === 'demo' ? 'Esta tanda es una simulación.' : 'Después del traslado, desmantélalas dentro del juego. Puedes detener la tanda entre armas.'}</p><div class="dialog-actions"><button id="cancel-plan">Volver a revisar</button><button id="confirm-plan" class="primary">${snap.source === 'demo' ? 'Simular traslado' : 'Enviar tanda'}</button></div></section>`;
        $('dialog').classList.remove('hidden');
        $('cancel-plan').onclick = () => { $('dialog').classList.add('hidden'); currentPlan = null; busy = false; render(); };
        $('confirm-plan').onclick = transfer;
        $('confirm-plan').focus();
      } catch (error) { busy = false; status(error.message, 'error'); render(); }
    }
    async function transfer() {
      $('dialog').classList.add('hidden'); $('run').classList.remove('hidden'); $('run-text').textContent = 'Iniciando tanda…'; $('stop').disabled = false;
      try {
        const result = await adapter.transfer(currentPlan.token);
        snap = result.snapshot; populateTargets();
        status(`${snap.source === 'demo' ? 'Simulación: ' : ''}${result.moved} arma(s) trasladada(s) y confirmada(s).${result.stopped ? ' La tanda fue detenida.' : ' Desmantela en el juego y prepara la siguiente tanda.'}`);
      } catch (error) { status(error.message, 'error'); }
      finally { currentPlan = null; busy = false; $('run').classList.add('hidden'); await refresh(true); render(); }
    }
    if (adapter.onProgress) adapter.onProgress(data => {
      $('run-text').textContent = `${data.moved} / ${data.total} confirmadas · ${data.name}`;
      if (data.completedId) selected.delete(data.completedId);
    });
    $('refresh').onclick = () => refresh();
    $('sync').onclick = async () => { try { await adapter.sync(); status('Se abrió light.gg. Inicia sesión allí si hace falta; activa Settings → Popularity Rank Display → Best Available, espera que se actualicen las notas y marca «Ya activé Best Available» en la franja verde. Luego vuelve y pulsa Actualizar.'); } catch(error) { status(error.message,'error'); } };
    $('prepare').onclick = prepare;
    $('search-dim').onclick = async () => { try { await adapter.search([...selected]); } catch(error) { status(error.message,'error'); } };
    $('stop').onclick = async () => { $('stop').disabled = true; try { await adapter.stop(); $('run-text').textContent = 'Deteniendo: una petición ya enviada puede terminar. Actualiza DIM antes de repetir.'; } catch(error) { status(error.message,'error'); } };
    $('query').oninput = () => { query = $('query').value; render(); };
    $('target').onchange = render; $('reserve').onchange = render;
    $('grades').onclick = event => { const btn = event.target.closest('[data-grade]'); if (!btn || busy) return; const grade = btn.dataset.grade; if (categories.has(grade)) categories.delete(grade); else categories.add(grade); render(); };
    $('tabs').onclick = event => { const btn = event.target.closest('[data-view]'); if (!btn || busy) return; view = btn.dataset.view; if (view==='improvable') selected.clear(); render(); };
    $('rows').onclick = event => { const button=event.target.closest('[data-improve]'); if (button) reviewImprovement(button.dataset.improve); };
    $('rows').onchange = event => { const id = event.target.dataset.id; if (!id || busy) return; if (event.target.checked) selected.add(id); else selected.delete(id); render(); };
    function selectVisible() { if (busy || view==='improvable') return; const eligible = rows().filter(i => C.eligible(i, grades, [...categories])); const all = eligible.length && eligible.every(i => selected.has(i.id)); for (const item of eligible) all ? selected.delete(item.id) : selected.add(item.id); render(); }
    $('select-visible').onclick = selectVisible; $('all-check').onchange = selectVisible;
    if ($('close')) $('close').onclick = () => { host.style.display = 'none'; };
    if (adapter.onGradesChanged) adapter.onGradesChanged(async () => { grades = await adapter.grades(); if (!busy) render(); });
    root.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('dialog').classList.contains('hidden')) ($('cancel-plan') || $('cancel-improve'))?.click(); });
    refresh();
    return { refresh, root };
  };
})();
