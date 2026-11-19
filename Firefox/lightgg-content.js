(() => {
  'use strict';
  const C = globalThis.VaultCore;
  const auto = new URLSearchParams(location.search).get('vaultcleaner') === 'sync';
  const MAX_CARD_NODES = 1500, MAX_ANCESTORS = 7, SLICE_MS = 4;
  const seen = new Map(), pending = new Map(), maximumIds = new Set();
  const identityAttributes = new Set();
  const MARKERS = '.quality, .tags, img[src*="quality-"], [data-roll-grade], [data-roll-quality], [data-grade], [data-current-grade], [data-best-grade], [data-max-grade], [title*="Best"], [title*="Maximum"], [title*="Popularity"], [title*="popularidad"]';
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
  function possibleMaximum(node) {
    if (!node.getClientRects().length) return null;
    const labels = ['title','aria-label','alt','data-original-title','data-tooltip'].map(key => node.getAttribute(key) || '');
    if (!node.matches('script, style, input, textarea') && Array.from(node.childNodes).slice(0,4).some(n => n.nodeType === Node.TEXT_NODE && n.nodeValue.trim())) labels.push(shortText(node));
    for (const label of labels) {
      const grade = C.normalizeGrade(label.slice(0,256).match(/\b([SABCDF][+-]?)\s+rank\s+possible\b/i)?.[1]);
      if (grade) return {grade, priority:4, kind:'possible-rank', role:'best'};
    }
    return null;
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
    label.textContent = `${stopped ? 'Detenida' : scanning ? 'Leyendo tarjetas' : stats.completed ? 'Captura lista' : 'Preparando lectura'} · ${seen.size} notas · ${maximumIds.size} máximos confirmados · ${count} guardadas · ${stats.ids || 0} IDs · ${stats.markers || 0} marcadores${!seen.size && stats.completed && !scanning ? ' · Si sigue en cero, descarga Diagnóstico.' : ''}`;
  }
  function collect(id, record) {
    const signature = JSON.stringify(record);
    if (seen.get(id) === signature) return;
    seen.set(id, signature); record.bestGrade ? maximumIds.add(id) : maximumIds.delete(id); pending.set(id, record); lastNew = Date.now();
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
      const ranks = {current:{priority:0,values:new Set()},best:{priority:0,values:new Set()}};
      let visited = 0;
      const tree = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT);
      let current = container;
      while (current && visited < MAX_CARD_NODES) {
        for (const id of idsAt(current)) ids.add(id);
        if (ids.size > 1) break;
        for (const marker of [readMarker(current),possibleMaximum(current)]) {
          if (!marker) continue;
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
      if (ids.size === 1 && ids.has(expectedId) && (currentGrade || bestGrade)) {
        const record = {grade:bestGrade || currentGrade,basis:bestGrade ? 'best' : 'displayed'};
        if (currentGrade) record.currentGrade = currentGrade;
        if (bestGrade) record.bestGrade = bestGrade;
        candidate = {container,record};
      }
    }
    if (candidate) {
      processedRoots.add(candidate.container);
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
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: [...new Set(['src','title','href','id','data-id','data-instance-id','data-instanceid','data-item-instance-id','data-iteminstanceid','data-roll-grade','data-roll-quality','data-grade','data-current-grade','data-best-grade','data-max-grade','aria-label','alt','data-original-title','data-tooltip', ...identityAttributes])] });
  }
  function start() {
    stopped = false; session++; seen.clear(); maximumIds.clear(); stats.completed = false;
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
        if (document.hidden || !seen.size || scanning || scanTimer) return;
        window.scrollBy({ top: Math.round(innerHeight * 0.8), behavior: 'instant' });
        const atBottom = scrollY + innerHeight >= document.documentElement.scrollHeight - 30;
        if (atBottom) bottomSince ||= Date.now(); else bottomSince = null;
        if (bottomSince && Date.now() - bottomSince > 8000 && Date.now() - lastNew > 8000) {
          stop(); label.textContent = `Recorrido terminado · ${seen.size} notas. Vuelve a DIM y pulsa Actualizar. Las vistas o páginas restantes aún pueden faltar.`;
        }
      }, 1500);
    }
  }
  function diagnostic() {
    const report = { version: '0.1.7', captureBasis, confirmedMaxima:maximumIds.size, page: location.pathname, state: stopped ? 'stopped' : scanning ? 'scanning' : 'idle', capturedThisSession: seen.size, saved: count, counters: stats, samples, limits: { maxCardNodes: MAX_CARD_NODES, maxAncestors: MAX_ANCESTORS, sliceMs: SLICE_MS } };
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
    const confirmation = document.createElement('label');
    confirmation.append(bestMode,document.createTextNode(' Estoy viendo Best Available'));
    confirmation.title = 'En light.gg: ☰ → Settings → Popularity Rank Display → Best Available. Marca después de que cambien las notas. Solo se lee el máximo; tú cambias los perks en light.gg.';
    bestMode.addEventListener('change',()=>{stop();captureBasis=bestMode.checked ? 'best' : 'displayed';start();});
    const help = document.createElement('span'); help.textContent = 'Máximo: light.gg → Settings → Popularity Rank Display → Best Available.'; help.style.fontSize='11px';
    bar.style.flexWrap = 'wrap';
    bar.append(label, help, confirmation, control, debug); document.body.append(bar);
    start();
  }
  addEventListener('pagehide', stop, { once: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
})();
