(() => {
  'use strict';
  const C = globalThis.VaultCore;
  const auto = new URLSearchParams(location.search).get('vaultcleaner') === 'sync';
  const seen = new Map();
  let count = 0, stopped = false, bar = null, label = null, lastNew = Date.now();
  async function save(grades, source) {
    const changed = Object.create(null);
    for (const [id, raw] of Object.entries(grades)) {
      const grade = C.normalizeGrade(raw);
      if (C.normalizeId(id) && grade && seen.get(id) !== grade) { seen.set(id, grade); changed[id] = grade; lastNew = Date.now(); }
    }
    if (!Object.keys(changed).length) return;
    try {
      const result = await browser.runtime.sendMessage({ type: 'save-grades', grades: changed, source });
      count = result.total;
      update();
    } catch { if (label) label.textContent = 'No se pudieron guardar las notas. Recarga esta pestaña.'; }
  }
  document.addEventListener('vault-cleaner-grades', event => { try { save(JSON.parse(event.detail), 'api'); } catch {} });
  function scrape() {
    const grades = Object.create(null);
    for (const image of document.querySelectorAll('img.quality')) {
      const title = image.getAttribute('title') || '';
      let src = image.getAttribute('src') || '';
      try { src = decodeURIComponent(src); } catch {}
      const grade = C.normalizeGrade(title.match(/\(([SABCDF][+-]?)\)/i)?.[1] || src.match(/quality-([SABCDF][+-]?)-text\.svg/i)?.[1]);
      if (!grade) continue;
      let container = image;
      for (let depth = 0; container && depth < 7; depth++, container = container.parentElement) {
        const ids = new Set();
        for (const el of [container, ...container.querySelectorAll('*')]) {
          for (const attr of el.attributes || []) for (const id of attr.value.match(/\b\d{18,20}\b/g) || []) ids.add(id);
        }
        if (ids.size > 1) break; // Never associate a grade with several weapon copies.
        if (ids.size === 1) { grades[[...ids][0]] = grade; break; }
      }
    }
    save(grades, 'dom');
  }
  function update() {
    if (label) label.textContent = `${stopped ? 'Captura pausada' : 'Sincronizando light.gg'} · ${seen.size} notas vistas en esta sesión · ${count} guardadas. Las que falten quedarán sin evaluar.`;
  }
  function mount() {
    if (!auto) return;
    bar = document.createElement('div');
    Object.assign(bar.style, { position: 'fixed', bottom: '20px', left: '20px', right: '20px', zIndex: '2147483647', background: '#17241c', color: '#ecffe4', padding: '16px 20px', border: '1px solid #9cd96d', borderRadius: '12px', display: 'flex', gap: '20px', alignItems: 'center', font: '14px system-ui', boxShadow: '0 12px 40px #0008' });
    label = document.createElement('span'); label.style.flex = '1';
    const stop = document.createElement('button'); stop.textContent = 'Detener recorrido';
    stop.addEventListener('click', () => { stopped = true; update(); stop.disabled = true; });
    bar.append(label, stop); document.body.append(bar); update();
    const started = Date.now(); let bottomSince = null;
    const timer = setInterval(() => {
      if (stopped || Date.now() - started > 180000) { clearInterval(timer); stopped = true; update(); return; }
      if (!document.querySelector('img.quality')) return; // Wait for sign-in / inventory.
      window.scrollBy({ top: Math.round(innerHeight * 0.8), behavior: 'smooth' });
      const atBottom = scrollY + innerHeight >= document.documentElement.scrollHeight - 30;
      if (atBottom) bottomSince ||= Date.now(); else bottomSince = null;
      if (bottomSince && Date.now() - bottomSince > 12000 && Date.now() - lastNew > 10000) {
        clearInterval(timer); stopped = true; update();
        label.textContent = `Recorrido terminado · ${seen.size} notas vistas. Vuelve a DIM y pulsa Actualizar. Si light.gg usa filtros o páginas, abre también las restantes; no se presupone que estén todas.`;
      }
    }, 1000);
  }
  setInterval(scrape, 1800);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
})();
