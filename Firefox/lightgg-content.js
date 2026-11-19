(() => {
  'use strict';
  const C = globalThis.VaultCore;
  const auto = new URLSearchParams(location.search).get('vaultcleaner') === 'sync';
  const seen = new Map(), pending = new Map();
  const MAX_NODES = 96, MAX_ANCESTORS = 6, SLICE_MS = 4;
  let count = 0, stopped = false, bar, label, control;
  let observer, scanTimer, sliceTimer, saveTimer, scrollTimer;
  let scanning = false, dirty = false, lastScan = 0, lastNew = Date.now();
  let walk = null, images = [], index = 0, session = 0;
  function update() {
    if (label) label.textContent = `${stopped ? 'Captura detenida' : 'Capturando notas'} · ${seen.size} vistas aquí · ${count} guardadas. Las que falten quedan sin evaluar.`;
  }
  function collect(id, grade) {
    if (seen.get(id) === grade) return;
    seen.set(id, grade); pending.set(id, grade); lastNew = Date.now();
    if (!saveTimer) saveTimer = setTimeout(flush, 300);
  }
  async function flush() {
    clearTimeout(saveTimer); saveTimer = null;
    if (!pending.size) return;
    const batch = Object.fromEntries(pending); pending.clear();
    try {
      const result = await browser.runtime.sendMessage({ type: 'save-grades', grades: batch, source: 'dom' });
      count = result.total; update();
    } catch { if (label) label.textContent = 'No se pudieron guardar las notas. Recarga esta pestaña.'; }
  }
  function readGrade(image) {
    const title = image.getAttribute('title') || '';
    let src = image.getAttribute('src') || '';
    try { src = decodeURIComponent(src); } catch {}
    return C.normalizeGrade(title.match(/\(([SABCDF][+-]?)\)/i)?.[1] || src.match(/quality-([SABCDF][+-]?)-text\.svg/i)?.[1]);
  }
  // Yield between nodes. Never enumerate an unbounded ancestor subtree.
  function* resolve(image) {
    const grade = readGrade(image);
    if (!grade || !image.isConnected) return;
    let container = image;
    for (let depth = 0; container && depth < MAX_ANCESTORS; depth++, container = container.parentElement) {
      if (container === document.body || container === document.documentElement) return;
      const ids = new Set();
      const tree = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT);
      let node = container, visited = 0;
      while (node && visited < MAX_NODES) {
        if (node !== image && node.matches('img.quality')) return;
        const attrs = node.attributes;
        for (let a = 0; a < Math.min(attrs.length, 16); a++) {
          const value = attrs[a].value;
          if (value.length > 256) continue;
          for (const id of value.match(/\b\d{18,20}\b/g) || []) ids.add(id);
        }
        if (ids.size > 1) return;
        visited++; yield null;
        node = tree.nextNode();
      }
      if (node) return; // Truncated subtree: identity not completely verified.
      if (ids.size === 1) { yield { id: [...ids][0], grade }; return; }
    }
  }
  function slice() {
    sliceTimer = null;
    if (stopped || !scanning) return;
    if (document.hidden) { sliceTimer = setTimeout(slice, 500); return; }
    const deadline = performance.now() + SLICE_MS;
    let steps = 0;
    while (performance.now() < deadline && steps++ < 250) {
      if (!walk) {
        if (index >= images.length) {
          scanning = false; images = []; flush();
          if (dirty) schedule();
          return;
        }
        walk = resolve(images[index++]);
      }
      const next = walk.next();
      if (next.value) collect(next.value.id, next.value.grade);
      if (next.done) walk = null;
    }
    sliceTimer = setTimeout(slice, 20);
  }
  function begin() {
    scanTimer = null;
    if (stopped || scanning) return;
    dirty = false; lastScan = performance.now();
    images = [...document.querySelectorAll('img.quality')];
    index = 0; walk = null; scanning = true; sliceTimer = setTimeout(slice, 0);
  }
  function schedule() {
    if (stopped) return;
    dirty = true;
    if (!scanning && !scanTimer) scanTimer = setTimeout(begin, Math.max(250, 2000 - (performance.now() - lastScan)));
  }
  function stop() {
    stopped = true; session++;
    observer?.disconnect();
    clearTimeout(scanTimer); clearTimeout(sliceTimer); clearInterval(scrollTimer);
    scanTimer = sliceTimer = scrollTimer = null;
    scanning = false; dirty = false; walk = null; images = [];
    flush(); update();
    if (control) control.textContent = 'Reanudar captura';
  }
  function start() {
    stopped = false; session++; seen.clear();
    update(); if (control) control.textContent = 'Detener captura';
    observer = new MutationObserver(records => {
      for (const record of records) {
        const node = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        if (node && !bar.contains(node)) { schedule(); break; }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src','title','href','data-id','data-instance-id','data-instanceid','data-item-instance-id','data-iteminstanceid'] });
    schedule();
    if (auto) {
      const started = Date.now(), thisSession = session;
      let bottomSince = null;
      scrollTimer = setInterval(() => {
        if (stopped || thisSession !== session) return;
        if (Date.now() - started > 180000) { stop(); return; }
        if (document.hidden || !seen.size || scanning || scanTimer) return;
        window.scrollBy({ top: Math.round(innerHeight * 0.8), behavior: 'instant' });
        const atBottom = scrollY + innerHeight >= document.documentElement.scrollHeight - 30;
        if (atBottom) bottomSince ||= Date.now(); else bottomSince = null;
        if (bottomSince && Date.now() - bottomSince > 8000 && Date.now() - lastNew > 8000) {
          stop();
          label.textContent = `Recorrido terminado · ${seen.size} notas vistas. Vuelve a DIM y pulsa Actualizar. Las vistas o páginas restantes aún pueden faltar.`;
        }
      }, 1500);
    }
  }
  function mount() {
    bar = document.createElement('div'); bar.id = 'vc-lightgg-status';
    Object.assign(bar.style, { position: 'fixed', bottom: '20px', left: '20px', right: '20px', zIndex: '2147483647', background: '#17241c', color: '#ecffe4', padding: '12px 16px', border: '1px solid #9cd96d', borderRadius: '12px', display: 'flex', gap: '20px', alignItems: 'center', font: '13px system-ui', boxShadow: '0 12px 40px #0008' });
    label = document.createElement('span'); label.style.flex = '1';
    control = document.createElement('button'); control.textContent = 'Detener captura';
    control.addEventListener('click', () => stopped ? start() : stop());
    bar.append(label, control); document.body.append(bar);
    start();
  }
  addEventListener('pagehide', stop, { once: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
})();
