(() => {
  'use strict';
  const C = globalThis.VaultCore;
  const auto = new URLSearchParams(location.search).get('vaultcleaner') === 'sync';
  const MAX_CARD_NODES = 1500, MAX_ANCESTORS = 7, SLICE_MS = 4;
  const seen = new Map(), pending = new Map();
  const identityAttributes = new Set();
  const MARKERS = '.quality, .tags, img[src*="quality-"], [data-roll-grade], [data-roll-quality], [data-grade], [title*="Popularity"], [title*="popularidad"]';
  let stopped = false, count = 0, bar, label, control, observer;
  let scanTimer, sliceTimer, saveTimer, scrollTimer;
  let scanning = false, dirty = false, lastScan = 0, lastNew = Date.now(), lastUpdate = 0;
  let walk, processedRoots, scanIds, session = 0;
  let stats = {}, samples = { identifiers: [], markers: [], labels: [] };

  function idsAt(node) {
    const ids = new Set();
    for (const attr of Array.from(node.attributes || []).slice(0, 32)) {
      if (attr.value.length > 768 || attr.name.startsWith('on') || attr.name === 'value' || /owner|character|membership|account/.test(attr.name)) continue;
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
    const explicit = C.normalizeGrade(node.getAttribute('data-roll-grade') || node.getAttribute('data-roll-quality'));
    if (explicit) return { grade: explicit, priority: 3, kind: 'roll-attribute' };
    const titled = C.normalizeGrade(title.match(/\(([SABCDF][+-]?)\)/i)?.[1] || title.match(/(?:popularity|popularidad|roll quality)\s*[:=-]\s*([SABCDF][+-]?)(?:\s|$)/i)?.[1]);
    if (titled) return { grade: titled, priority: /popularity|popularidad|roll quality/i.test(title) ? 3 : 2, kind: 'title' };
    const sourced = C.normalizeGrade(source.match(/quality-([SABCDF][+-]?)-text\.svg/i)?.[1]);
    if (sourced) return { grade: sourced, priority: 2, kind: 'quality-image' };
    if (node.matches('.quality, .tags')) {
      const text = shortText(node);
      const grade = C.normalizeGrade(text.split(/\s+/).at(-1));
      if (grade) return { grade, priority: node.matches('.quality') ? 2 : 1, kind: node.matches('.quality') ? 'quality-label' : 'tags-label' };
    }
    const grade = C.normalizeGrade(node.getAttribute('data-grade'));
    return grade ? { grade, priority: 1, kind: 'grade-attribute' } : null;
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
    label.textContent = `${stopped ? 'Detenida' : scanning ? 'Leyendo tarjetas' : stats.completed ? 'Captura lista' : 'Preparando lectura'} · ${seen.size} notas · ${count} guardadas · ${stats.ids || 0} IDs · ${stats.markers || 0} marcadores${!seen.size && stats.completed && !scanning ? ' · Si sigue en cero, descarga Diagnóstico.' : ''}`;
  }
  function collect(id, grade) {
    if (seen.get(id) === grade) return;
    seen.set(id, grade); pending.set(id, grade); lastNew = Date.now();
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
    for (let container = node, depth = 0; container && depth < MAX_ANCESTORS; container = container.parentElement, depth++) {
      if (container === document.body || container === document.documentElement || bar.contains(container)) return;
      const ids = new Set(), grades = new Set();
      let priority = 0, visited = 0;
      const tree = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT);
      let current = container;
      while (current && visited < MAX_CARD_NODES) {
        for (const id of idsAt(current)) ids.add(id);
        if (ids.size > 1) { stats.ambiguous++; return; }
        const marker = readMarker(current);
        if (marker) {
          if (marker.priority > priority) { priority = marker.priority; grades.clear(); }
          if (marker.priority === priority) grades.add(marker.grade);
        }
        visited++; yield null;
        current = tree.nextNode();
      }
      if (current) { stats.tooLarge++; return; }
      if (ids.size === 1 && ids.has(expectedId) && grades.size === 1) {
        processedRoots.add(container);
        yield { id: expectedId, grade: [...grades][0] };
        return;
      }
      if (grades.size > 1) { stats.conflictingGrades++; return; }
    }
    stats.noGrade++;
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
      if (next.value) collect(next.value.id, next.value.grade);
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
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: [...new Set(['src','title','href','id','data-id','data-instance-id','data-instanceid','data-item-instance-id','data-iteminstanceid','data-roll-grade','data-roll-quality','data-grade', ...identityAttributes])] });
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
    const report = { version: '0.1.2', page: location.pathname, state: stopped ? 'stopped' : scanning ? 'scanning' : 'idle', capturedThisSession: seen.size, saved: count, counters: stats, samples, limits: { maxCardNodes: MAX_CARD_NODES, maxAncestors: MAX_ANCESTORS, sliceMs: SLICE_MS } };
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
    bar.append(label, control, debug); document.body.append(bar); start();
  }
  addEventListener('pagehide', stop, { once: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
})();
