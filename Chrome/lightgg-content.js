(() => {
  'use strict';
  const browser = globalThis.chrome?.runtime ? globalThis.chrome : globalThis.browser;
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

  function identityAttribute(attr) {
    // A long number in a perk icon filename is an asset hash, not a copy ID.
    // Accept structural IDs and plain data attributes, never URLs or metadata.
    const name = attr.name;
    if (name !== 'id' && !name.startsWith('data-')) return false;
    if (name.startsWith('data-vc-') || /owner|character|membership|account/.test(name)) return false;
    if (/(?:^|[-_])(?:src|href|url|uri|icon|image|thumbnail|background|tooltip|title|perk|plug|socket|hash|grade|quality|rank|timestamp)(?:$|[-_])/.test(name)) return false;
    return attr.value.length <= 768 && !/[\/\\:]/.test(attr.value);
  }
  function assetIdentifiersAt(node) {
    return Array.from(node.attributes || []).slice(0,32).filter(attr =>
      (['src','href','srcset','style'].includes(attr.name) || /^data-.*(?:src|href|url|icon|image|thumbnail|background)/.test(attr.name)) &&
      attr.value.length <= 768 && /(?<!\d)\d{18,20}(?!\d)/.test(attr.value)
    ).map(attr => attr.name);
  }
  function idsAt(node) {
    const ids = new Set();
    for (const attr of Array.from(node.attributes || []).slice(0, 32)) {
      if (!identityAttribute(attr)) continue;
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
  function readOverall(node) {
    if (node.matches('script,style,input,textarea')) return null;
    for (const [attr,role] of [['data-best-overall','best'],['data-max-overall','best'],['data-current-overall','current'],
      ['data-overall',captureBasis === 'best' ? 'best' : 'current'],['data-overall-score',captureBasis === 'best' ? 'best' : 'current']]) {
      const raw = node.getAttribute(attr);
      if (raw === null) continue;
      const overall = C.normalizeOverall(raw);
      if (overall !== null) return {overall,role,priority:4,generic:!/(?:best|max|current)-overall/.test(attr)};
    }
    if (!node.getClientRects().length) return null;
    const labels = ['title','aria-label','data-original-title','data-tooltip'].map(a=>(node.getAttribute(a) || '').slice(0,256));
    const direct = Array.from(node.childNodes).slice(0,4).filter(n=>n.nodeType === Node.TEXT_NODE).map(n=>n.nodeValue).join(' ').slice(0,256);
    if (/\boverall\b/i.test(direct)) labels.push(shortText(node));
    else if (node.matches('.overall, .overall-score, [data-popularity-overall]')) labels.push('Overall '+shortText(node));
    else if (node.children.length <= 8 && Array.from(node.children).some(child=>child.getClientRects().length && /^overall(?:\s+(?:popularity|score))?\s*[:=]?$/i.test(shortText(child)))) labels.push(shortText(node));
    for (const label of labels) {
      // Only the explicitly labelled Overall percentage, never individual
      // perk popularity, stars, trait-combo scores or unrelated bar widths.
      const matches = [...label.matchAll(/\boverall(?:\s+(?:popularity|score))?\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*%/gi)];
      if (matches.length !== 1) continue;
      const match = matches[0];
      const overall = match ? C.normalizeOverall(match[1]) : null;
      if (overall === null) continue;
      const explicitBest = /best available|maximum|highest|máxim/i.test(label), explicitCurrent = /current|equipped|actual|equipad/i.test(label);
      if (explicitBest && explicitCurrent) continue;
      const role = explicitBest ? 'best' : explicitCurrent ? 'current' : captureBasis === 'best' ? 'best' : 'current';
      return {overall,role,priority:2,generic:!explicitBest && !explicitCurrent};
    }
    return null;
  }
  function description(node) {
    return { tag: node.tagName, classes: (node.getAttribute('class') || '').slice(0, 180), idAttribute: (node.id || '').replace(/\d{18,20}/g, id => '…' + id.slice(-8)).slice(0, 100), instanceAttributes: Array.from(node.attributes || []).filter(attr => identityAttribute(attr) && /\d{18,20}/.test(attr.value)).map(attr => attr.name).slice(0, 10), ignoredAssetAttributes: assetIdentifiersAt(node).slice(0,10) };
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
    label.textContent = `${stopped ? 'Stopped' : scanning ? 'Reading cards' : stats.completed ? 'Capture complete' : 'Preparing capture'} · ${seen.size} ranks · ${maximumIds.size} confirmed maxima · ${count} saved · ${stats.ids || 0} IDs · ${stats.markers || 0} markers${!seen.size && stats.completed && !scanning ? ' · If this stays at zero, download Diagnostics.' : ''}`;
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
      if (result?.vcError) throw new Error(result.vcError);
      count = result.total; update(true);
    } catch { if (label) label.textContent = 'Ranks could not be saved. Reload this tab.'; }
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
      const ranks = {current:{priority:0,values:new Set(),displayed:new Set()},best:{priority:0,values:new Set(),displayed:new Set()}};
      const scores = {current:{priority:0,values:new Set(),generic:false},best:{priority:0,values:new Set(),generic:false}};
      let visited = 0;
      const tree = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT);
      let current = container;
      while (current && visited < MAX_CARD_NODES) {
        for (const id of idsAt(current)) ids.add(id);
        if (ids.size > 1) break;
        for (const marker of [readMarker(current),possibleMaximum(current)]) {
          if (!marker) continue;
          const rank = ranks[marker.role];
          if (marker.kind !== 'possible-rank') rank.displayed.add(marker.grade);
          if (marker.priority > rank.priority) { rank.priority = marker.priority; rank.values.clear(); }
          if (marker.priority === rank.priority) rank.values.add(marker.grade);
        }
        const overall = readOverall(current);
        if (overall) {
          const score = scores[overall.role];
          if (overall.priority > score.priority) {score.priority = overall.priority;score.values.clear();score.generic=false;}
          if (overall.priority === score.priority) {score.values.add(overall.overall);score.generic ||= overall.generic;}
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
        for (const role of ['current','best']) if (record[role+'Grade'] && scores[role].values.size === 1 &&
          (!scores[role].generic || ranks[role].displayed.size === 1 && ranks[role].displayed.has(record[role+'Grade']))) record[role+'Overall'] = [...scores[role].values][0];
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
      stats.ignoredAssetIdentifiers += assetIdentifiersAt(node).length;
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
    stats = { elements: 0, ids: 0, ignoredAssetIdentifiers: 0, markers: 0, labelCandidates: 0, ambiguous: 0, tooLarge: 0, conflictingGrades: 0, noGrade: 0 };
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
    flush(); update(true); if (control) control.textContent = 'Resume capture';
  }
  function observe() {
    if (!observer || stopped) return;
    observer.observe(document.body, { childList: true, subtree: true, characterData:true, attributes: true, attributeFilter: [...new Set(['src','title','href','id','data-id','data-instance-id','data-instanceid','data-item-instance-id','data-iteminstanceid','data-roll-grade','data-roll-quality','data-grade','data-current-grade','data-best-grade','data-max-grade','data-best-overall','data-max-overall','data-current-overall','data-overall','data-overall-score','aria-label','alt','data-original-title','data-tooltip', ...identityAttributes])] });
  }
  function start() {
    stopped = false; session++; seen.clear(); maximumIds.clear(); stats.completed = false;
    update(true); if (control) control.textContent = 'Stop capture';
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
          stop(); label.textContent = `Capture finished · ${seen.size} ranks. Return to DIM and click Refresh inventory. Other views or pages may still be missing.`;
        }
      }, 1500);
    }
  }
  function diagnostic() {
    const report = { version: '0.3.1', captureBasis, confirmedMaxima:maximumIds.size, page: location.pathname, state: stopped ? 'stopped' : scanning ? 'scanning' : 'idle', capturedThisSession: seen.size, saved: count, counters: stats, samples, limits: { maxCardNodes: MAX_CARD_NODES, maxAncestors: MAX_ANCESTORS, sliceMs: SLICE_MS } };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'Vault-Cleaner-diagnostics.json';
    bar.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function mount() {
    bar = document.createElement('div'); bar.id = 'vc-lightgg-status';
    Object.assign(bar.style, { position: 'fixed', bottom: '16px', left: '16px', right: '16px', zIndex: '2147483647', background: '#17241c', color: '#ecffe4', padding: '12px 16px', border: '1px solid #9cd96d', borderRadius: '12px', display: 'flex', gap: '12px', alignItems: 'center', font: '13px system-ui', boxShadow: '0 12px 40px #0008' });
    label = document.createElement('span'); label.style.flex = '1';
    control = document.createElement('button'); control.textContent = 'Stop capture';
    control.addEventListener('click', () => stopped ? start() : stop());
    const debug = document.createElement('button'); debug.textContent = 'Diagnostics'; debug.onclick = diagnostic;
    bestMode = document.createElement('input'); bestMode.type = 'checkbox'; bestMode.id = 'vc-best-mode';
    const confirmation = document.createElement('label');
    confirmation.append(bestMode,document.createTextNode(' I am viewing Best Available'));
    confirmation.title = 'In light.gg: ☰ → Settings → Popularity Rank Display → Best Available. Check after ranks update. This only reads the maximum; you change perks in light.gg.';
    bestMode.addEventListener('change',()=>{stop();captureBasis=bestMode.checked ? 'best' : 'displayed';start();});
    const help = document.createElement('span'); help.textContent = 'Maximum: light.gg → Settings → Popularity Rank Display → Best Available.'; help.style.fontSize='11px';
    bar.style.flexWrap = 'wrap';
    bar.append(label, help, confirmation, control, debug); document.body.append(bar);
    start();
  }
  addEventListener('pagehide', stop, { once: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
})();
