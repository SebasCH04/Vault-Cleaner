(() => {
  'use strict';
  const C = globalThis.VaultCore;
  const auto = new URLSearchParams(location.search).get('vaultcleaner') === 'sync';
  const MAX_CARD_NODES = 1500, MAX_ANCESTORS = 7, SLICE_MS = 4;
  const seen = new Map(), pending = new Map(), cards = new Map();
  const nativeRequests = new Map();
  let applying = false, lastAction = null, nativeReady = false;
  const identityAttributes = new Set();
  const MARKERS = '.quality, .tags, img[src*="quality-"], [data-roll-grade], [data-roll-quality], [data-grade], [data-best-grade], [data-max-grade], [data-current-grade], [title*="Best"], [title*="Maximum"], [title*="Popularity"], [title*="popularidad"]';
  let stopped = false, count = 0, bar, label, control, observer, bestMode;
  let captureBasis = 'displayed';
  let scanTimer, sliceTimer, saveTimer, scrollTimer;
  let scanning = false, dirty = false, lastScan = 0, lastNew = Date.now(), lastUpdate = 0;
  let walk, processedRoots, scanIds, session = 0;
  let stats = {}, samples = { identifiers: [], markers: [], labels: [] };

  function idsAt(node) {
    const ids = new Set();
    for (const attr of Array.from(node.attributes || []).slice(0, 32)) {
      if (attr.name.startsWith('data-vc-') || attr.value.length > 768 || attr.name.startsWith('on') || attr.name === 'value' || /owner|character|membership|account/.test(attr.name)) continue;
      for (const match of attr.value.matchAll(/(?<!\d)\d{18,20}(?!\d)/g)) { ids.add(match[0]); identityAttributes.add(attr.name); }
    }
    return ids;
  }
  function shortText(node) {
    let text = '';
    // Only short grade labels; never concatenate a whole card/page subtree.
    const tree = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let i = 0;
    for (let n = tree.nextNode(); n; n = tree.nextNode()) {
      if (i++ >= 24) return '';
      text += n.nodeValue;
      if (text.length > 192) return '';
    }
    return text.trim();
  }
  function readMarker(node) {
    if (!node.matches(MARKERS)) return null;
    const title = (node.getAttribute('title') || '').slice(0, 256);
    let source = node.getAttribute('src') || node.getAttribute('href') || '';
    if (source.length > 768 || source.startsWith('data:')) source = '';
    try { source = decodeURIComponent(source); } catch {}
    const maximum = C.normalizeGrade(node.getAttribute('data-best-grade') || node.getAttribute('data-max-grade'));
    if (maximum) return { grade: maximum, priority: 4, kind: 'best-attribute', role: 'best' };
    const equipped = C.normalizeGrade(node.getAttribute('data-current-grade'));
    if (equipped) return { grade: equipped, priority: 4, kind: 'current-attribute', role: 'current' };
    const role = /best available|highest|maximum|máxim|mejor disponible/i.test(title) ? 'best' : /equipped|current|equipad|actual/i.test(title) ? 'current' : captureBasis === 'best' ? 'best' : 'current';
    const explicit = C.normalizeGrade(node.getAttribute('data-roll-grade') || node.getAttribute('data-roll-quality'));
    if (explicit) return { grade: explicit, priority: 3, kind: 'roll-attribute', role };
    const titled = C.normalizeGrade(title.match(/\(([SABCDF][+-]?)\)/i)?.[1] || title.match(/(?:popularity|popularidad|roll quality|best available|maximum|current|equipped)\s*[:=-]\s*([SABCDF][+-]?)(?:\s|$)/i)?.[1]);
    if (titled) return { grade: titled, priority: /popularity|popularidad|roll quality/i.test(title) ? 3 : 2, kind: 'title', role };
    const sourced = C.normalizeGrade(source.match(/quality-([SABCDF][+-]?)-text\.svg/i)?.[1]);
    if (sourced) return { grade: sourced, priority: 2, kind: 'quality-image', role };
    if (node.matches('.quality, .tags')) {
      const text = shortText(node);
      const grade = C.normalizeGrade(text.split(/\s+/).at(-1));
      if (grade) return { grade, priority: node.matches('.quality') ? 2 : 1, kind: node.matches('.quality') ? 'quality-label' : 'tags-label', role };
    }
    const grade = C.normalizeGrade(node.getAttribute('data-grade'));
    return grade ? { grade, priority: 1, kind: 'grade-attribute', role } : null;
  }
  function rankNotice(node) {
    const labels = ['title','aria-label','alt','data-original-title','data-tooltip'].map(key => node.getAttribute(key) || '');
    if (!node.matches('script, style, input, textarea') && Array.from(node.childNodes).slice(0, 4).some(n => n.nodeType === Node.TEXT_NODE && n.nodeValue.trim())) labels.push(shortText(node));
    let bestGrade = null, possible = false;
    for (const label of labels) {
      const value = label.slice(0,256);
      if (/\b(?:no|not|sin)\s+(?:higher|rango)/i.test(value)) continue;
      const grade = C.normalizeGrade(value.match(/\b([SABCDF][+-]?)\s+rank\s+possible\b/i)?.[1] || value.match(/rango\s+([SABCDF][+-]?)\s+posible\b/i)?.[1]);
      if (grade) bestGrade = grade;
      if (grade || /higher\s+rank\s+possible|rango\s+(?:superior|mayor)\s+posible/i.test(value)) possible = true;
    }
    const explicit = node.getAttribute('data-higher-rank-possible') === 'true';
    const named = node.matches('.higher-rank-possible, .higher-rank');
    if (!(possible || explicit || named) || !node.getClientRects().length) return null;
    return {bestGrade, source: bestGrade ? 'badge' : 'notice'};
  }
  function description(node) {
    return { tag: node.tagName, classes: (node.getAttribute('class') || '').slice(0, 180), idAttribute: (node.id || '').replace(/\d{18,20}/g, id => '…' + id.slice(-8)).slice(0, 100), instanceAttributes: Array.from(node.attributes || []).filter(attr => /\d{18,20}/.test(attr.value) && attr.name !== 'value' && !attr.name.startsWith('on')).map(attr => attr.name).slice(0, 10) };
  }
  function sampleIdentifier(node) {
    if (samples.identifiers.length >= 5) return;
    const ancestors = [];
    for (let n = node, i = 0; n && n !== document.body && i < MAX_ANCESTORS; n = n.parentElement, i++) ancestors.push(description(n));
    samples.identifiers.push({ ancestors });
  }
  function update(force = false) {
    if (!label || (!force && performance.now() - lastUpdate < 300)) return;
    lastUpdate = performance.now();
    label.textContent = `${stopped ? 'Detenida' : scanning ? 'Leyendo tarjetas' : stats.completed ? 'Captura lista' : 'Preparando lectura'} · ${seen.size} notas (${captureBasis === 'best' ? 'máximo confirmado' : 'máximo pendiente'}) · ${count} guardadas · ${stats.ids || 0} IDs · ${stats.markers || 0} marcadores${!seen.size && stats.completed && !scanning ? ' · Si sigue en cero, descarga Diagnóstico.' : ''}`;
  }
  function collect(id, record, enriched = false) {
    const signature = JSON.stringify(record);
    if (seen.get(id) === signature) return;
    seen.set(id, signature); pending.set(id, record); lastNew = Date.now();
    const card = cards.get(id);
    if (!enriched && nativeReady && card?.isConnected) nativeCall(card, 'read', id).then(result => {
      if (seen.get(id) !== signature || stopped) return;
      const meta = result.metadata || {}, combined = { ...record };
      if (C.normalizeGrade(meta.currentGrade)) combined.currentGrade = meta.currentGrade;
      if (C.normalizeGrade(meta.bestGrade)) { combined.bestGrade = meta.bestGrade; combined.grade = meta.bestGrade; combined.basis = 'best'; }
      if (typeof meta.higherRankPossible === 'boolean' && !['badge','notice'].includes(combined.rankImprovementSource)) { combined.higherRankPossible = meta.higherRankPossible; combined.rankImprovementChecked = true; combined.rankImprovementSource = 'native-rank'; }
      else if (typeof meta.higherRankPossible !== 'boolean' && combined.currentGrade && combined.bestGrade && C.gradeOrder(combined.bestGrade) < C.gradeOrder(combined.currentGrade)) { combined.higherRankPossible = true; combined.rankImprovementChecked = true; combined.rankImprovementSource ||= 'comparison'; }
      collect(id, combined, true);
    }).catch(() => {});
    if (!saveTimer) saveTimer = setTimeout(flush, 300);
    update();
  }
  async function flush() {
    clearTimeout(saveTimer); saveTimer = null;
    if (!pending.size) return;
    const batch = Object.fromEntries(pending); pending.clear();
    try {
      const result = await browser.runtime.sendMessage({ type: 'save-grades', grades: batch, source: 'dom' });
      count = result.total; update(true);
    } catch { if (label) label.textContent = 'No se pudieron guardar las notas. Recarga esta pestaña.'; }
  }
  function wasResolved(node) {
    for (let n = node, i = 0; n && n !== document.body && i < MAX_ANCESTORS; n = n.parentElement, i++) if (processedRoots.has(n)) return true;
    return false;
  }
  function* resolve(node, expectedId) {
    let candidate = null;
    for (let container = node, depth = 0; container && depth < MAX_ANCESTORS; container = container.parentElement, depth++) {
      if (container === document.body || container === document.documentElement || bar.contains(container)) break;
      const ids = new Set();
      const ranks = { current: { priority: 0, values: new Set() }, best: { priority: 0, values: new Set() } };
      let visited = 0, higherRankPossible = false, rankImprovementSource = null;
      const tree = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT);
      let current = container;
      while (current && visited < MAX_CARD_NODES) {
        for (const id of idsAt(current)) ids.add(id);
        if (ids.size > 1) break;
        const notice = rankNotice(current);
        if (notice) {
          higherRankPossible = true; rankImprovementSource = notice.source;
          if (notice.bestGrade) {
            const rank = ranks.best;
            if (rank.priority < 4) { rank.priority = 4; rank.values.clear(); }
            if (rank.priority === 4) rank.values.add(notice.bestGrade);
          }
        }
        const marker = readMarker(current);
        if (marker) {
          const rank = ranks[marker.role];
          if (marker.priority > rank.priority) { rank.priority = marker.priority; rank.values.clear(); }
          if (marker.priority === rank.priority) rank.values.add(marker.grade);
        }
        visited++; yield null;
        current = tree.nextNode();
      }
      if (ids.size > 1) { stats.ambiguous++; break; }
      if (current) { stats.tooLarge++; break; }
      if (ranks.current.values.size > 1 || ranks.best.values.size > 1) { stats.conflictingGrades++; candidate = null; break; }
      const currentGrade = [...ranks.current.values][0], bestGrade = [...ranks.best.values][0];
      if (currentGrade && bestGrade && C.gradeOrder(bestGrade) < C.gradeOrder(currentGrade)) { higherRankPossible = true; rankImprovementSource ||= 'comparison'; }
      if (ids.size === 1 && ids.has(expectedId) && (currentGrade || bestGrade)) {
        candidate = { container, record: { grade: bestGrade || currentGrade, basis: bestGrade ? 'best' : 'displayed', higherRankPossible, rankImprovementChecked: true, rankImprovementSource } };
        if (currentGrade) candidate.record.currentGrade = currentGrade;
        if (bestGrade) candidate.record.bestGrade = bestGrade;
      }
    }
    if (candidate) {
      processedRoots.add(candidate.container);
      cards.set(expectedId, candidate.container);
      yield { id: expectedId, record: candidate.record };
    } else stats.noGrade++;
  }
  function* scanPage() {
    // One attribute walk discovers IDs even when their names/classes change.
    // All traversal, including each larger card, yields to the browser.
    const tree = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node = tree.nextNode();
    while (node) {
      if (bar.contains(node)) { node = tree.nextNode(); continue; }
      stats.elements++;
      const ids = idsAt(node), marker = readMarker(node);
      if (node.matches(MARKERS)) {
        stats.labelCandidates++;
        if (samples.labels.length < 8) {
          const rawSource = node.getAttribute('src') || '';
          samples.labels.push({ ...description(node), title: (node.getAttribute('title') || '').slice(0, 150), label: node.matches('.quality, .tags') ? shortText(node) : '', sourceFile: rawSource.startsWith('data:') ? '[embedded image]' : rawSource.split('?')[0].split('/').at(-1).slice(0, 150), recognized: Boolean(marker) });
        }
      }
      if (marker) {
        stats.markers++;
        if (samples.markers.length < 8) samples.markers.push({ ...description(node), ...marker, title: (node.getAttribute('title') || '').slice(0, 150) });
      }
      if (ids.size === 1) {
        const id = [...ids][0];
        if (!scanIds.has(id)) { scanIds.add(id); stats.ids = scanIds.size; sampleIdentifier(node); }
        if (!wasResolved(node)) yield* resolve(node, id);
      }
      yield null;
      node = tree.nextNode();
    }
  }
  function slice() {
    sliceTimer = null;
    if (stopped || !scanning) return;
    if (document.hidden) { sliceTimer = setTimeout(slice, 500); return; }
    const deadline = performance.now() + SLICE_MS;
    let steps = 0;
    while (performance.now() < deadline && steps++ < 1000) {
      const next = walk.next();
      if (next.value) collect(next.value.id, next.value.record);
      if (next.done) {
        scanning = false; stats.completed = true; walk = null; observe(); flush(); update(true);
        if (dirty) schedule();
        return;
      }
    }
    update(); sliceTimer = setTimeout(slice, 20);
  }
  function begin() {
    scanTimer = null;
    if (stopped || scanning) return;
    dirty = false; lastScan = performance.now(); scanning = true;
    stats = { elements: 0, ids: 0, markers: 0, labelCandidates: 0, ambiguous: 0, tooLarge: 0, conflictingGrades: 0, noGrade: 0 };
    samples = { identifiers: [], markers: [], labels: [] };
    processedRoots = new WeakSet(); scanIds = new Set(); walk = scanPage();
    update(true); sliceTimer = setTimeout(slice, 0);
  }
  function schedule() {
    if (stopped) return;
    dirty = true;
    if (!scanning && !scanTimer) scanTimer = setTimeout(begin, Math.max(250, 2500 - (performance.now() - lastScan)));
  }
  function stop() {
    stopped = true; session++;
    observer?.disconnect();
    clearTimeout(scanTimer); clearTimeout(sliceTimer); clearInterval(scrollTimer);
    scanTimer = sliceTimer = scrollTimer = null;
    scanning = false; dirty = false; walk = null;
    flush(); update(true); if (control) control.textContent = 'Reanudar captura';
  }
  function observe() {
    if (!observer || stopped) return;
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: [...new Set(['src','title','href','id','data-id','data-instance-id','data-instanceid','data-item-instance-id','data-iteminstanceid','data-roll-grade','data-roll-quality','data-grade','data-best-grade','data-max-grade','data-current-grade','data-higher-rank-possible','data-original-title','data-tooltip','aria-label', ...identityAttributes])] });
  }
  function start() {
    stopped = false; session++; seen.clear(); stats.completed = false;
    update(true); if (control) control.textContent = 'Detener captura';
    observer = new MutationObserver(records => {
      for (const record of records) {
        const node = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        if (node && !bar.contains(node)) { schedule(); break; }
      }
    });
    observe();
    schedule();
    if (auto) {
      const started = Date.now(), thisSession = session; let bottomSince = null;
      scrollTimer = setInterval(() => {
        if (stopped || thisSession !== session) return;
        if (Date.now() - started > 180000) { stop(); return; }
        if (document.hidden || captureBasis !== 'best' || !seen.size || scanning || scanTimer) return;
        window.scrollBy({ top: Math.round(innerHeight * 0.8), behavior: 'instant' });
        const atBottom = scrollY + innerHeight >= document.documentElement.scrollHeight - 30;
        if (atBottom) bottomSince ||= Date.now(); else bottomSince = null;
        if (bottomSince && Date.now() - bottomSince > 8000 && Date.now() - lastNew > 8000) {
          stop(); label.textContent = `Recorrido terminado · ${seen.size} notas. Vuelve a DIM y pulsa Actualizar. Las vistas o páginas restantes aún pueden faltar.`;
        }
      }, 1500);
    }
  }
  const APPLY_LABEL = /^(?:equip popular perks|equip most popular perks|apply popular perks|equipar (?:los )?(?:perks|ventajas) (?:más )?populares|aplicar (?:los )?perks populares)$/i;
  function isApply(node) {
    return [shortText(node), node.getAttribute('aria-label') || '', node.getAttribute('title') || ''].some(value => APPLY_LABEL.test(value.trim().replace(/\s+/g, ' ')));
  }
  function nativeCall(node, kind, id, timeout = 1500) {
    return new Promise((resolve, reject) => {
      const nonce = () => [...crypto.getRandomValues(new Uint8Array(16))].map(value=>value.toString(16).padStart(2,'0')).join('');
      const requestId = nonce(), token = nonce();
      const timer = setTimeout(() => { nativeRequests.delete(requestId); node.removeAttribute?.('data-vc-native-token'); reject(new Error('El enlace con light.gg no respondió. Recarga light.gg después de actualizar la extensión.')); }, timeout);
      nativeRequests.set(requestId, { resolve, reject, timer, node });
      node.setAttribute?.('data-vc-native-token', token);
      node.dispatchEvent(new CustomEvent('vc-lightgg-native-request', { bubbles: true, detail: JSON.stringify({requestId,token,kind,id}) }));
    });
  }
  document.addEventListener('vc-lightgg-native-response', event => {
    let data; try { data = JSON.parse(event.detail); } catch { return; }
    const request = nativeRequests.get(data.requestId); if (!request) return;
    clearTimeout(request.timer); nativeRequests.delete(data.requestId); request.node.removeAttribute?.('data-vc-native-token');
    data.ok ? request.resolve(data) : request.reject(new Error(data.error));
  });
  function validCard(id) {
    const card = cards.get(id); if (!card?.isConnected) return null;
    const ids = new Set(); const tree = document.createTreeWalker(card, NodeFilter.SHOW_ELEMENT); let node = card, count = 0;
    while (node && count++ < MAX_CARD_NODES) { for (const value of idsAt(node)) ids.add(value); if (ids.size > 1) return null; node = tree.nextNode(); }
    return !node && ids.size === 1 && ids.has(id) ? card : null;
  }
  function visible(node) { return node.isConnected && node.getClientRects().length && !node.disabled && node.getAttribute('aria-disabled') !== 'true'; }
  async function applyPopular(id) {
    if (applying) throw new Error('Hay una mejora en curso en light.gg.');
    const card = validCard(id); if (!card) throw new Error('Esta copia no está en la página capturada de light.gg. Abre su vista y pulsa Reanudar captura.');
    applying = true; stop(); lastAction = { idSuffix: id.slice(-8), state: 'locating' };
    try {
      card.scrollIntoView({block:'center'});
      const selectors = 'button, [role="button"], [ng-click], [data-ng-click]';
      const ownButtons = [...card.querySelectorAll(selectors)].filter(node => visible(node) && isApply(node));
      let candidates = ownButtons;
      if (!candidates.length) {
        const inspect = [card,...card.querySelectorAll('[ng-click], [data-ng-click], button, [role="button"]')].find(node => {
          if (!visible(node)) return false;
          const expression = node.getAttribute('ng-click') || node.getAttribute('data-ng-click') || '';
          if (/perk|equip|lock|tag|move|delete|remove/i.test(expression)) return false;
          return /inspect|preview|(?:select|setselected|open|show).*(?:roll|item|weapon)/i.test(expression) || /^(?:inspect|inspect roll|inspeccionar)$/i.test(shortText(node));
        });
        if (!inspect) throw new Error('No se reconoció el botón para inspeccionar esta copia. Pulsa Diagnóstico en light.gg para ajustar su estructura.');
        inspect.click();
        const deadline = Date.now()+5000;
        do {
          await new Promise(resolve => setTimeout(resolve,200));
          candidates = [...document.querySelectorAll(selectors)].filter(node=>!bar.contains(node) && visible(node) && isApply(node)).slice(0,40);
        } while (!candidates.length && Date.now()<deadline);
      }
      if (!candidates.length) throw new Error('light.gg no muestra Equip Popular Perks. Puede que esta copia ya use los más populares o que el inspector no sea compatible. Descarga Diagnóstico si light.gg sí permite mejorarla.');
      let lastError;
      for (const button of candidates) {
        try {
          const result = await nativeCall(button,'apply',id);
          lastAction.state = 'submitted';
          label.textContent = 'Solicitud enviada a light.gg para ID …'+id.slice(-8)+'. Revisa su respuesta; después actualiza DIM. No se afirma éxito hasta verificar los perks.';
          return result;
        } catch(error) { lastError=error; }
      }
      throw lastError;
    } catch(error) { lastAction.state='error'; lastAction.error=error.message; throw error; }
    finally { applying=false; }
  }
  if (browser.runtime.onMessage?.addListener) browser.runtime.onMessage.addListener(message => {
    if (message.type === 'vc-lightgg-probe') return Promise.resolve({found:Boolean(C.normalizeId(message.id) && validCard(message.id))});
    if (message.type === 'vc-lightgg-apply') return applyPopular(C.normalizeId(message.id)).then(result=>({ok:true,...result}),error=>({ok:false,error:error.message}));
  });
  function diagnostic() {
    const controls = [...document.querySelectorAll('button, [role=button], [ng-click], [data-ng-click]')].filter(node=>!bar.contains(node) && visible(node)).slice(0,80).map(node=>({tag:node.tagName,classes:(node.className || '').toString().slice(0,120),label:shortText(node).slice(0,120),title:(node.getAttribute('title') || '').slice(0,120),hasAngularBinding:node.hasAttribute('ng-click') || node.hasAttribute('data-ng-click'),apply:isApply(node)}));
    const report = { controls, nativeReady, version: '0.1.5', lastAction, captureBasis, page: location.pathname, state: stopped ? 'stopped' : scanning ? 'scanning' : 'idle', capturedThisSession: seen.size, saved: count, counters: stats, samples, limits: { maxCardNodes: MAX_CARD_NODES, maxAncestors: MAX_ANCESTORS, sliceMs: SLICE_MS } };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'Vault-Cleaner-diagnostico.json';
    bar.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function mount() {
    bar = document.createElement('div'); bar.id = 'vc-lightgg-status';
    Object.assign(bar.style, { position: 'fixed', bottom: '16px', left: '16px', right: '16px', zIndex: '2147483647', background: '#17241c', color: '#ecffe4', padding: '12px 16px', border: '1px solid #9cd96d', borderRadius: '12px', display: 'flex', gap: '12px', alignItems: 'center', font: '13px system-ui', boxShadow: '0 12px 40px #0008' });
    label = document.createElement('span'); label.style.flex = '1';
    control = document.createElement('button'); control.textContent = 'Detener captura';
    control.addEventListener('click', () => stopped ? start() : stop());
    const debug = document.createElement('button'); debug.textContent = 'Diagnóstico'; debug.onclick = diagnostic;
    bestMode = document.createElement('input'); bestMode.type = 'checkbox'; bestMode.id = 'vc-best-mode';
    const confirmation = document.createElement('label'); confirmation.style.maxWidth = '260px';
    confirmation.append(bestMode, document.createTextNode(' Ya activé Best Available en light.gg'));
    confirmation.title = 'En light.gg: menú ☰ → Settings → Popularity Rank Display → Best Available. Confirma después de que las notas se actualicen. No cambia los perks del juego.';
    bestMode.addEventListener('change', () => {
      // Never apply a new basis to a half-completed scan or queued old records.
      stop(); captureBasis = bestMode.checked ? 'best' : 'displayed'; start();
    });
    const help = document.createElement('span'); help.textContent = 'Para leer el máximo: ☰ → Settings → Popularity Rank Display → Best Available.';
    help.style.maxWidth = '300px'; help.style.fontSize = '11px';
    bar.style.flexWrap = 'wrap';
    bar.append(label, help, confirmation, control, debug); document.body.append(bar);
    nativeCall(bar,'ping','',300).then(()=>{nativeReady=true;}).catch(()=>{}); start();
  }
  addEventListener('pagehide', stop, { once: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
})();
