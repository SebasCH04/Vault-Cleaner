(() => {
  'use strict';
  const C = globalThis.VaultCore;
  const syncMode = new URLSearchParams(location.search).get('vaultcleaner');
  if (syncMode === 'background') {
    void captureInBackground().catch(()=>{});
    return;
  }
  const auto = syncMode === 'sync';
  const MAX_CARD_NODES = 1500, MAX_ANCESTORS = 7, SLICE_MS = 4;
  const seen = new Map(), pending = new Map(), maximumIds = new Set(), overallIds = new Set();
  const nativeOverallIds = new Set(), nativeSignatures = new Map();
  let nativeSummary = {responses:0,fields:[]};
  let modelSummary = {available:false,rolls:0};
  const identityAttributes = new Set();
  const MARKERS = '.quality, .tags, [src*="quality-" i], [href*="quality-" i], [data-src*="quality-" i], [data-roll-grade], [data-roll-quality], [data-grade], [data-current-grade], [data-best-grade], [data-max-grade]';
  const OVERALL = /^overall(?:\s+(?:popularity|score))?\s*[:=]?$/i;
  const OVERALL_START = /^(?:(?:best available|maximum|highest|current|equipped)\s+)?overall\b/i;
  const OVERALL_ROW = '.overall, .overall-score, [data-popularity-overall]';
  const LABELS = ['title','aria-label','alt','data-original-title','data-bs-original-title','data-tooltip','data-bs-title'];
  const GRADE = '[SABCDF](?:\\s*[+＋−–‑-])?';
  const rankInLabel = new RegExp('(?:^|\\s)(?:popularity(?: rank)?|popularidad|roll quality|best available|maximum|current|equipped)\\s*(?:[:=]\\s*|\\(\\s*|\\s+)(' + GRADE + ')(?=\\s|[),.]|$)', 'i');
  const rankInParens = new RegExp('\\(\\s*(' + GRADE + ')\\s*\\)','i');
  const overallGrade = new RegExp('\\boverall(?:\\s+(?:popularity|score|rank))*\\s*[:=(]?\\s*(' + GRADE + ')(?=\\s|[),.]|$)','i');
  const possibleRank = new RegExp('\\b(' + GRADE + ')\\s+rank\\s+possible\\b','i');
  let stopped = false, count = 0, bar, label, control, observer, bestMode;
  let captureBasis = 'displayed';
  let scanTimer, sliceTimer, saveTimer, scrollTimer, modelTimer;
  let scanning = false, dirty = false, lastScan = 0, lastNew = Date.now(), lastUpdate = 0;
  let walk, processedRoots, scanIds, cardEvidence, session = 0;
  let stats = {}, samples = { identifiers: [], markers: [], labels: [] };

  async function captureInBackground() {
    if (!await browser.runtime.sendMessage({type:'vc-auto-sync-ready'})) return;
    let signature, stableSince, loginSince, sending = false;
    const sample = async event=>{
      if (sending || typeof event.detail !== 'string' || event.detail.length > 1500000) return;
      let model;
      try {model = JSON.parse(event.detail);} catch {return;}
      if (!model) return;
      let message;
      if (model.signedIn === false) {
        loginSince ??= Date.now();
        if (Date.now()-loginSince >= 4000) message = {type:'vc-auto-sync-login'};
      } else {
        loginSince = undefined;
        const grades = model.records;
        if (model.loading || !model.available || !grades || !Object.keys(grades).length) {
          signature = undefined;
          return;
        }
        if (event.detail !== signature) {
          signature = event.detail;
          stableSince = Date.now();
          return;
        }
        if (Date.now()-stableSince >= 6000) message = {type:'vc-auto-sync-complete',grades};
      }
      if (!message) return;
      sending = true;
      try {
        await browser.runtime.sendMessage(message);
        stopSampling();
      } catch {sending = false;}
    };
    const request = ()=>document.dispatchEvent(new Event('vault-cleaner-appraisal-model-request'));
    const timer = setInterval(request,2000);
    function stopSampling() {
      clearInterval(timer);
      document.removeEventListener('vault-cleaner-appraisal-model',sample);
    }
    document.addEventListener('vault-cleaner-appraisal-model',sample);
    addEventListener('pagehide',stopSampling,{once:true});
    request();
  }

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
    const attrs = node.attributes;
    for (let i = 0; i < Math.min(attrs.length,32); i++) {
      const attr = attrs[i];
      if (!identityAttribute(attr)) continue;
      for (const match of attr.value.matchAll(/(?<!\d)\d{18,20}(?!\d)/g)) { ids.add(match[0]); identityAttributes.add(attr.name); }
    }
    return ids;
  }
  function shortText(node, separator = '') {
    let text = '';
    // Only short grade labels; never concatenate a whole card/page subtree.
    const tree = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let i = 0;
    for (let n = tree.nextNode(); n; n = tree.nextNode()) {
      if (i++ >= 24) return '';
      text += (text ? separator : '') + n.nodeValue;
      if (text.length > 192) return '';
    }
    return text.trim();
  }
  function displayRole(label = '') {
    if (/best available|highest|maximum|máxim|mejor disponible/i.test(label)) return 'best';
    if (/\bequipped\b|\bcurrent\b|equipad|\bactual\b/i.test(label)) return 'current';
    return captureBasis === 'best' ? 'best' : 'current';
  }
  function labelsAt(node) {
    if (!node.attributes.length) return [];
    return LABELS.map(key => node.getAttribute(key)).filter(Boolean)
      .map(text => text.slice(0,512).replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').trim());
  }
  function gradeFromSource(source) {
    if (!source || source.length > 768 || source.startsWith('data:')) return null;
    try { source = decodeURIComponent(source); } catch {}
    const match = source.match(/quality-([SABCDF])(?:(?:[-_]?)(plus|minus)|([+＋−–‑-]))?-(?:text|letter)(?:[.?#/]|$)/i);
    if (!match) return null;
    const suffix = match[2]?.toLowerCase();
    return C.normalizeGrade(match[1] + (suffix === 'plus' ? '+' : suffix === 'minus' ? '-' : match[3] || ''));
  }
  function refineGrade(grades) {
    if (grades.size === 1) return grades.values().next().value;
    if (grades.size === 2) {
      const [a,b] = grades;
      if (a[0] === b[0] && a.length !== b.length) return a.length > b.length ? a : b;
    }
    return null;
  }
  function readMarker(node, labels = labelsAt(node)) {
    if (!node.attributes.length) return null;
    const marker = node.matches(MARKERS);
    if (!marker && !labels.length && !node.hasAttribute('xlink:href')) return null;
    const sourced = gradeFromSource(node.getAttribute('src') || node.getAttribute('data-src') || node.getAttribute('href') || node.getAttribute('xlink:href'));
    const badge = node.matches('.quality, .tags');
    const text = badge ? shortText(node,' ') : '';
    const printed = C.normalizeGrade(text) || C.normalizeGrade(text.split(/\s+/).at(-1));
    const precise = grade => {
      if (grade.length !== 1) return grade;
      const signed = [sourced,printed].filter(value=>value?.length === 2 && value[0] === grade);
      return refineGrade(new Set(signed)) || grade;
    };
    const maximum = C.normalizeGrade(node.getAttribute('data-best-grade') || node.getAttribute('data-max-grade'));
    if (maximum) return { grade: precise(maximum), priority: 6, kind: 'best-attribute', role: 'best' };
    const equipped = C.normalizeGrade(node.getAttribute('data-current-grade'));
    if (equipped) return { grade: precise(equipped), priority: 6, kind: 'current-attribute', role: 'current' };
    const role = displayRole(labels.join(' '));
    const explicit = C.normalizeGrade(node.getAttribute('data-roll-grade')) || C.normalizeGrade(node.getAttribute('data-roll-quality'));
    if (explicit) return { grade: precise(explicit), priority: 3, kind: 'roll-attribute', role };
    for (const label of labels) {
      if (/trait combo|individual perks|community reviews|\boverall\b/i.test(label)) continue;
      const titled = C.normalizeGrade(label.match(rankInLabel)?.[1] ||
        (marker ? label.match(rankInParens)?.[1] || label : ''));
      if (titled) return { grade: precise(titled), priority: 3, kind: 'title', role: displayRole(label) };
    }
    if (sourced) return { grade: sourced, priority: 3, kind: 'quality-image', role };
    if (printed) return { grade: printed, priority: node.matches('.quality') ? 2 : 1, kind: node.matches('.quality') ? 'quality-label' : 'tags-label', role };
    const grade = C.normalizeGrade(node.getAttribute('data-grade'));
    return grade ? { grade, priority: 1, kind: 'grade-attribute', role } : null;
  }
  function possibleMaximum(node, labels, direct) {
    const possibleLabels = /rank|possible/i.test(direct) ? [...labels,shortText(node,' ')] : labels;
    for (const label of possibleLabels) {
      const grade = C.normalizeGrade(label.match(possibleRank)?.[1]);
      if (grade && node.getClientRects().length) return grade;
    }
    return null;
  }
  function directText(node) {
    let text = '';
    for (let child = node.firstChild, i = 0; child && i < 8; child = child.nextSibling, i++) {
      if (child.nodeType === Node.TEXT_NODE) text += ' ' + child.nodeValue.slice(0,192);
      if (text.length > 192) return '';
    }
    return text.trim();
  }
  function readOverall(node, nodeLabels, direct) {
    if (node.attributes.length) for (const [attr,role] of [['data-best-overall','best'],['data-max-overall','best'],['data-current-overall','current'],
      ['data-overall',captureBasis === 'best' ? 'best' : 'current'],['data-overall-score',captureBasis === 'best' ? 'best' : 'current']]) {
      const raw = node.getAttribute(attr);
      if (raw === null) continue;
      const overall = C.normalizeOverall(raw);
      if (overall !== null) return {overall,role,priority:4,generic:!/(?:best|max|current)-overall/.test(attr)};
    }
    const labels = nodeLabels.filter(label=>/\boverall\b/i.test(label));
    const children = node.children;
    const rowLabel = children.length > 0 && children.length <= 8 &&
      Array.from(children).find(child=>OVERALL.test(directText(child)));
    const row = OVERALL_START.test(direct) || node.matches(OVERALL_ROW) || rowLabel;
    if ((!labels.length && !row) || !node.getClientRects().length) return null;
    if (row && (!rowLabel || rowLabel.getClientRects().length)) {
      const text = shortText(node,' ');
      if (!/individual perks|trait combo|community reviews/i.test(text)) {
        labels.push(OVERALL_START.test(text) ? text : 'Overall '+text);
        // The grade or percentage can be carried on the row's icon or meter.
        for (const part of node.querySelectorAll('img, use, [role="meter"], meter, [data-score], [data-percentage], [aria-label], [title], [data-original-title], [data-bs-original-title], [data-tooltip], [data-bs-title]')) {
          if (!part.getClientRects().length) continue;
          const grade = readMarker(part)?.grade || C.normalizeGrade(part.getAttribute('alt'));
          if (grade) labels.push('Overall '+grade);
          for (const value of labelsAt(part)) {
            if (/^\d+(?:[.,]\d+)?\s*%$/.test(value)) labels.push('Overall '+value);
            else if (/\boverall\b/i.test(value)) labels.push(value);
          }
          const dataScore = part.getAttribute('data-score');
          const value = part.getAttribute('data-percentage') ?? (dataScore?.endsWith('%') ? dataScore : null) ??
            (part.matches('meter[max="100"]') ? part.getAttribute('value') :
              part.matches('[role="meter"][aria-valuemax="100"]') ? part.getAttribute('aria-valuenow') : null);
          const score = C.normalizeOverall(value);
          if (score !== null) labels.push('Overall '+score+'%');
        }
      }
    }
    const grades = new Set(), scores = new Set();
    let role, generic = true;
    for (const label of labels) {
      if (/individual perks|trait combo|community reviews/i.test(label)) continue;
      const explicitBest = /best available|maximum|highest|máxim/i.test(label), explicitCurrent = /current|equipped|actual|equipad/i.test(label);
      if (explicitBest && explicitCurrent) continue;
      const grade = C.normalizeGrade(label.match(overallGrade)?.[1]);
      const score = C.normalizeOverall(label.match(/\boverall(?:\s+(?:popularity|score|rank))*\s*[:=(]?\s*(\d+(?:[.,]\d+)?)\s*%/i)?.[1] ??
        (grade ? label.match(/(?:^|[\s(,])([0-9]+(?:[.,][0-9]+)?)\s*%/)?.[1] : null));
      if (!grade && score === null) continue;
      const labelRole = displayRole(label);
      if (role && labelRole !== role) return null;
      role = labelRole;
      generic &&= !explicitBest && !explicitCurrent;
      if (grade) grades.add(grade);
      if (score !== null) scores.add(score);
    }
    if (!role) return null;
    const grade = refineGrade(grades);
    const gradeConflict = grades.size > 0 && !grade;
    return {grade,gradeConflict,overall:scores.size === 1 ? scores.values().next().value : null,
      conflict:gradeConflict || scores.size > 1,role,priority:2,generic};
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
    const overallCount = overallIds.size + [...nativeOverallIds].filter(id=>!overallIds.has(id)).length;
    label.textContent = `${stopped ? 'Stopped' : scanning ? 'Reading cards' : stats.completed ? 'Capture complete' : 'Preparing capture'} · ${maximumIds.size} max · ${overallCount} Overall`;
    label.title = `${seen.size} ranks in this scan · ${count} total saved`;
  }
  function collect(id, record) {
    const signature = JSON.stringify(record);
    if (seen.get(id) === signature) return;
    seen.set(id, signature);
    if (record.bestGrade || nativeOverallIds.has(id)) maximumIds.add(id);
    else maximumIds.delete(id);
    record.bestOverall !== undefined ? overallIds.add(id) : overallIds.delete(id);
    pending.set(id, record); lastNew = Date.now();
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
    } catch { if (label) label.textContent = 'Ranks could not be saved. Reload this tab.'; }
  }
  function requestAppraisalData() { document.dispatchEvent(new Event('vault-cleaner-appraisal-listen')); }
  function requestRollModel() {
    if (!document.hidden) document.dispatchEvent(new Event('vault-cleaner-appraisal-model-request'));
  }
  document.addEventListener('vault-cleaner-appraisal-ready',()=>{if (bar && !stopped) requestAppraisalData();});
  document.addEventListener('vault-cleaner-appraisal-data',event=>receiveAppraisals(event,'appraisal'));
  document.addEventListener('vault-cleaner-appraisal-model',event=>receiveAppraisals(event,'appraisal-model'));
  async function receiveAppraisals(event,source) {
    if (!bar || stopped || typeof event.detail !== 'string' || event.detail.length > 1500000) return;
    let message;
    try {message = JSON.parse(event.detail);} catch {return;}
    if (!message) return;
    const fromModel = source === 'appraisal-model';
    if (fromModel) {
      if (typeof message.available !== 'boolean' || !Number.isInteger(message.rolls) || message.rolls < 0) return;
      modelSummary = {available:message.available,rolls:message.rolls};
    } else {
      if (!Number.isInteger(message.responses) || !Array.isArray(message.fields)) return;
      nativeSummary = {responses:Math.max(0,message.responses),
        fields:message.fields.filter(field=>typeof field === 'string' && /^[a-z-]{2,96}$/.test(field)).slice(0,30)};
    }
    const records = {};
    for (const [id,record] of Object.entries(message.records || {})) {
      if (!C.normalizeId(id) || !record || !C.normalizeGrade(record.grade)) continue;
      if (fromModel && C.lightggAverageGrade(record.bestOverall) !== record.bestGrade) continue;
      const key = source + id;
      const signature = JSON.stringify(record);
      if (nativeSignatures.get(key) === signature) continue;
      nativeSignatures.set(key,signature);
      records[id] = record;
    }
    if (!Object.keys(records).length) return;
    try {
      const result = await browser.runtime.sendMessage({type:'save-grades',grades:records,source});
      count = result.total;
      for (const [id,record] of Object.entries(records)) if (record.bestGrade) {nativeOverallIds.add(id);maximumIds.add(id);}
      lastNew = Date.now();
      update(true);
    } catch {
      for (const id of Object.keys(records)) nativeSignatures.delete(source + id);
      if (label) label.textContent = 'Overall could not be saved. Reload this tab.';
    }
  }
  function wasResolved(node) {
    for (let n = node, i = 0; n && n !== document.body && i < MAX_ANCESTORS; n = n.parentElement, i++) if (processedRoots.has(n)) return true;
    return false;
  }
  function readEvidence(node) {
    let evidence = cardEvidence.get(node);
    if (!evidence) {
      const labels = labelsAt(node);
      const isContent = !node.matches('script,style,input,textarea');
      const direct = isContent ? directText(node) : '';
      evidence = {ids:idsAt(node), marker:readMarker(node,labels),
        possible:isContent ? possibleMaximum(node,labels,direct) : null,
        overall:isContent ? readOverall(node,labels,direct) : null};
      cardEvidence.set(node,evidence);
    }
    return evidence;
  }
  function addRank(rank, grade, priority) {
    if (priority > rank.priority) {rank.priority = priority; rank.values.clear();}
    if (priority === rank.priority) rank.values.add(grade);
    if (grade.length === 2 && priority >= 2) rank.signed.add(grade);
  }
  function* resolve(node, expectedId) {
    let candidate = null;
    for (let container = node, depth = 0; container && depth < MAX_ANCESTORS; container = container.parentElement, depth++) {
      if (container === document.body || container === document.documentElement || bar.contains(container)) break;
      const ids = new Set();
      const ranks = {current:{priority:0,values:new Set(),scoped:new Set(),signed:new Set(),conflict:false},best:{priority:0,values:new Set(),scoped:new Set(),signed:new Set(),conflict:false}};
      const scores = {current:{priority:0,values:new Set(),generic:false,conflict:false},best:{priority:0,values:new Set(),generic:false,conflict:false}};
      const possible = new Set();
      let visited = 0;
      const tree = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT);
      let current = container;
      while (current && visited < MAX_CARD_NODES) {
        const evidence = readEvidence(current);
        for (const id of evidence.ids) ids.add(id);
        if (ids.size > 1) break;
        const {marker,overall} = evidence;
        if (marker) addRank(ranks[marker.role],marker.grade,marker.priority);
        if (evidence.possible) possible.add(evidence.possible);
        if (overall) {
          if (overall.grade) ranks[overall.role].scoped.add(overall.grade);
          ranks[overall.role].conflict ||= overall.gradeConflict === true;
          const score = scores[overall.role];
          if (overall.overall != null || overall.conflict) {
            if (overall.priority > score.priority) {score.priority = overall.priority;score.values.clear();score.generic=false;score.conflict=false;}
            if (overall.priority === score.priority) {
              if (overall.overall != null) score.values.add(overall.overall);
              score.generic ||= overall.generic;
              score.conflict ||= overall.conflict;
            }
          }
        }
        visited++; yield null;
        current = tree.nextNode();
      }
      if (ids.size > 1) { stats.ambiguous++; break; }
      if (current) { stats.tooLarge++; break; }
      const displayed = {};
      let conflict = false;
      for (const [role,rank] of Object.entries(ranks)) {
        const values = rank.scoped.size && rank.priority < 6 ? rank.scoped : new Set([...rank.values,...rank.scoped]);
        const grade = refineGrade(values);
        const signed = grade?.length === 1 ? [...rank.signed].filter(value=>value[0] === grade) : [];
        displayed[role] = signed.length === 1 ? signed[0] : grade;
        if (rank.conflict || values.size && !grade || signed.length > 1) conflict = true;
      }
      const possibleGrade = refineGrade(possible);
      if (conflict || possible.size && !possibleGrade) {stats.conflictingGrades++; candidate = null; break;}
      const currentGrade = displayed.current;
      let bestGrade = displayed.best || possibleGrade;
      if (displayed.best && possibleGrade && C.gradeOrder(possibleGrade) < C.gradeOrder(displayed.best)) bestGrade = possibleGrade;
      if (ids.size === 1 && ids.has(expectedId) && (currentGrade || bestGrade)) {
        const record = {grade:bestGrade || currentGrade,basis:bestGrade ? 'best' : 'displayed'};
        if (currentGrade) record.currentGrade = currentGrade;
        if (bestGrade) record.bestGrade = bestGrade;
        for (const role of ['current','best']) if (record[role+'Grade'] && !scores[role].conflict && scores[role].values.size === 1 &&
          (!scores[role].generic || displayed[role] === record[role+'Grade'])) record[role+'Overall'] = scores[role].values.values().next().value;
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
      if (node.attributes.length) stats.ignoredAssetIdentifiers += assetIdentifiersAt(node).length;
      const evidence = cardEvidence.get(node);
      const ids = evidence?.ids ?? idsAt(node), marker = evidence ? evidence.marker : readMarker(node);
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
    processedRoots = new WeakSet(); scanIds = new Set(); cardEvidence = new WeakMap(); walk = scanPage();
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
    clearInterval(modelTimer);
    scanTimer = sliceTimer = scrollTimer = null;
    scanning = false; dirty = false; walk = null;
    flush(); update(true); if (control) control.textContent = 'Resume capture';
  }
  function observe() {
    if (!observer || stopped) return;
    observer.observe(document.body, { childList: true, subtree: true, characterData:true, attributes: true, attributeFilter: [...new Set(['src','data-src','href','xlink:href','id','data-id','data-instance-id','data-instanceid','data-item-instance-id','data-iteminstanceid','data-roll-grade','data-roll-quality','data-grade','data-current-grade','data-best-grade','data-max-grade','data-best-overall','data-max-overall','data-current-overall','data-overall','data-overall-score','data-popularity-overall','data-score','data-percentage','aria-valuenow','value', ...LABELS, ...identityAttributes])] });
  }
  function start() {
    stopped = false; session++; seen.clear(); maximumIds.clear(); overallIds.clear(); stats.completed = false;
    for (const id of nativeOverallIds) maximumIds.add(id);
    update(true); if (control) control.textContent = 'Stop capture';
    observer = new MutationObserver(records => {
      for (const record of records) {
        const node = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        if (node && !bar.contains(node)) { schedule(); break; }
      }
    });
    observe();
    schedule();
    requestAppraisalData();
    requestRollModel();
    modelTimer = setInterval(requestRollModel,4000);
    if (auto && captureBasis === 'best') {
      const started = Date.now(), thisSession = session; let bottomSince = null;
      scrollTimer = setInterval(() => {
        if (stopped || thisSession !== session) return;
        if (Date.now() - started > 180000) { stop(); return; }
        if (document.hidden || bar.open || !seen.size || scanning || scanTimer) return;
        window.scrollBy({ top: Math.round(innerHeight * 0.8), behavior: 'instant' });
        const atBottom = scrollY + innerHeight >= document.documentElement.scrollHeight - 30;
        if (atBottom) bottomSince ||= Date.now(); else bottomSince = null;
        if (bottomSince && Date.now() - bottomSince > 8000 && Date.now() - lastNew > 8000) {
          stop();
        }
      }, 1500);
    }
  }
  function diagnostic() {
    const report = { version: browser.runtime.getManifest?.().version || '0.3.7', captureBasis, confirmedMaxima:maximumIds.size,
      maximumOverallScores:new Set([...overallIds,...nativeOverallIds]).size,
      appraisal:{...nativeSummary,maximumScores:nativeOverallIds.size,model:modelSummary}, page: location.pathname, state: stopped ? 'stopped' : scanning ? 'scanning' : 'idle', capturedThisSession: seen.size, saved: count, counters: stats, samples, limits: { maxCardNodes: MAX_CARD_NODES, maxAncestors: MAX_ANCESTORS, sliceMs: SLICE_MS } };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'Vault-Cleaner-diagnostics.json';
    bar.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function mount() {
    bar = document.createElement('details'); bar.id = 'vc-lightgg-status';
    Object.assign(bar.style, { position: 'fixed', bottom: '10px', left: '10px', zIndex: '2147483647', background: '#17241c', color: '#ecffe4', border: '1px solid #719f4d', borderRadius: '8px', width: 'max-content', maxWidth: 'min(275px, calc(100vw - 20px))', font: '12px system-ui', boxShadow: '0 4px 18px #0008' });
    const summary = document.createElement('summary');
    Object.assign(summary.style, {padding:'6px 8px',cursor:'pointer',lineHeight:'1.3'});
    label = document.createElement('span'); label.setAttribute('role','status');
    summary.append(label);
    summary.setAttribute('aria-label','Vault Cleaner capture');
    const options = document.createElement('div');
    Object.assign(options.style, {padding:'8px',display:'flex',flexWrap:'wrap',alignItems:'center',gap:'7px',borderTop:'1px solid #49643b'});
    control = document.createElement('button'); control.textContent = 'Stop capture';
    control.addEventListener('click', () => stopped ? start() : stop());
    const debug = document.createElement('button'); debug.textContent = 'Diagnostics'; debug.onclick = diagnostic;
    bestMode = document.createElement('input'); bestMode.type = 'checkbox'; bestMode.id = 'vc-best-mode';
    const confirmation = document.createElement('label');
    confirmation.append(bestMode,document.createTextNode(' I am viewing Best Available'));
    confirmation.style.width = '100%';
    bestMode.addEventListener('change',()=>{
      stop();captureBasis=bestMode.checked ? 'best' : 'displayed';start();
      bar.open = false;
      summary.focus({preventScroll:true});
    });
    const help = document.createElement('p');
    help.textContent = 'Settings → Popularity Rank Display → Best Available. Confirm after ranks update.';
    Object.assign(help.style, {margin:'0',fontSize:'11px'});
    options.append(help, confirmation, control, debug);
    bar.append(summary, options); document.body.append(bar);
    document.addEventListener('pointerdown',event=>{if (bar.open && !bar.contains(event.target)) bar.open = false;});
    bar.addEventListener('keydown',event=>{if (event.key === 'Escape' && bar.open) {bar.open = false;summary.focus();}});
    start();
  }
  addEventListener('pagehide', stop, { once: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
})();
