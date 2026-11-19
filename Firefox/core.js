(function (root) {
  'use strict';
  const MAX_GRADE_AGE = 48 * 60 * 60 * 1000;
  const ID = /^\d{18,20}$/;
  const GRADE = /^(?:S|A|B|C|D|F)[+-]?$/;
  function normalizeId(value) {
    if (typeof value !== 'string') return null; // Instance IDs exceed JS integer precision.
    const id = value.replace(/^"|"$/g, '').trim();
    return ID.test(id) ? id : null;
  }
  function normalizeGrade(value) {
    if (typeof value !== 'string') return null;
    const grade = value.trim().toUpperCase();
    return GRADE.test(grade) ? grade : null;
  }
  function gradeOrder(grade) {
    return 'SABCDF'.indexOf(grade[0]) * 3 + (grade.endsWith('+') ? 0 : grade.endsWith('-') ? 2 : 1);
  }
  function extractGrades(data) {
    const result = Object.create(null);
    const seen = new WeakSet();
    function walk(value, depth) {
      if (!value || typeof value !== 'object' || depth > 12 || seen.has(value)) return;
      seen.add(value);
      if (Array.isArray(value)) { for (const v of value) walk(v, depth + 1); return; }
      const id = normalizeId(value.instanceId ?? value.instance_id ?? value.itemInstanceId ?? value.id);
      const grade = normalizeGrade(value.grade ?? value.rollGrade ?? value.rollQuality ?? value.quality ?? value.rank ?? value.rating);
      if (id && grade) result[id] = grade;
      for (const [key, v] of Object.entries(value)) {
        const keyId = normalizeId(key);
        const keyGrade = normalizeGrade(v);
        if (keyId && keyGrade) result[keyId] = keyGrade;
        if (keyId && v && typeof v === 'object') {
          const g = normalizeGrade(v.grade ?? v.rollGrade ?? v.rollQuality ?? v.quality ?? v.rank ?? v.rating);
          if (g) result[keyId] = g;
        }
        walk(v, depth + 1);
      }
    }
    walk(data, 0);
    return result;
  }
  function gradeDetails(item, grades, now = Date.now()) {
    const record = grades[item.id];
    if (!record || !Number.isFinite(record.at) || now - record.at > MAX_GRADE_AGE || record.at > now + 60000) return null;
    const fresh = at => Number.isFinite(at) && now-at <= MAX_GRADE_AGE && at <= now+60000;
    const shown = normalizeGrade(record.grade);
    const current = fresh(record.currentAt ?? record.at) ? normalizeGrade(record.currentGrade) || (record.basis !== 'best' ? shown : null) : null;
    const best = fresh(record.bestAt ?? record.at) ? normalizeGrade(record.bestGrade) : null;
    const conflict = Boolean(current && best && gradeOrder(best) > gradeOrder(current));
    return { current, best: conflict ? null : best, conflict, effective: conflict ? current : best || current || shown };
  }
  function gradeFor(item, grades, now = Date.now()) { return gradeDetails(item, grades, now)?.effective || null; }
  function transferReasons(item) {
    const out = [];
    if (!item.weapon) out.push('Armor or another item');
    if (item.owner !== 'vault') out.push('Outside the vault');
    if (item.equipped !== false) out.push('Equipped or unknown state');
    if (item.notransfer || item.postmaster) out.push('Not transferable');
    return out;
  }
  function reasons(item, grades, now = Date.now()) {
    const out = transferReasons(item);
    if (item.locked !== false) out.push('Locked or unknown state');
    if (['favorite', 'keep', 'archive'].includes(item.tag)) out.push('Favorite / keep / archive');
    if (item.inLoadout) out.push('In a loadout');
    if (item.exotic) out.push('Exotic');
    if (item.crafted) out.push('Crafted');
    if (item.deepsight) out.push('Deepsight');
    const details = gradeDetails(item, grades, now);
    if (!details) out.push('No recent light.gg rank');
    else if (!details.best) out.push(details.conflict ? 'Conflicting ranks: sync again' : 'Maximum unconfirmed: sync Best Available');
    return out;
  }
  function eligible(item, grades, categories, now = Date.now()) {
    const grade = gradeFor(item, grades, now);
    return grade && categories.includes(grade[0]) && reasons(item, grades, now).length === 0;
  }
  function canSelect(item, grades, categories, mode = 'clean', now = Date.now()) {
    return mode === 'manual' ? transferReasons(item).length === 0 : Boolean(eligible(item, grades, categories, now));
  }
  function freeSpaces(target, bucket, reserve = false) {
    const capacity = target?.capacity?.[bucket], occupied = target?.occupied?.[bucket];
    if (!Number.isInteger(capacity) || capacity < 0 || !Number.isInteger(occupied) || occupied < 0) return null;
    return Math.max(0, capacity - occupied - (reserve ? 1 : 0));
  }
  function planBatch(items, grades, selectedIds, target, categories, limit = 9, reserve = false, mode = 'clean', batchMode = 'slot') {
    if (!target || target.isVault) throw new Error('Select a character.');
    const totalMode = batchMode === 'total';
    const max = Math.max(1, Math.min(totalMode ? 27 : 9, Math.floor(Number(limit) || 9)));
    const selected = new Set(selectedIds.map(normalizeId).filter(Boolean));
    const used = Object.create(null);
    const batch = [];
    const skipped = [];
    for (const item of items) {
      if (!selected.has(item.id)) continue;
      if (!canSelect(item, grades, categories, mode)) { skipped.push({ id: item.id, reason: mode === 'manual' ? 'This copy cannot be transferred from the vault.' : 'This copy is now protected or has no valid maximum.' }); continue; }
      const free = freeSpaces(target, item.bucket, reserve);
      if (free === null) { skipped.push({ id: item.id, reason: 'Capacity could not be verified.' }); continue; }
      const remaining = Math.max(0, free - (used[item.bucket] || 0));
      if (!remaining) { skipped.push({ id: item.id, reason: 'No space in this slot.' }); continue; }
      if ((used[item.bucket] || 0) >= (totalMode ? 9 : max) || batch.length >= (totalMode ? max : 27)) { skipped.push({id:item.id,reason:'Batch limit reached.'}); continue; }
      used[item.bucket] = (used[item.bucket] || 0) + 1;
      batch.push(item);
    }
    return { batch, skipped, counts: { ...used } };
  }
  function exactSearch(ids) {
    const safe = [...new Set(ids.map(normalizeId).filter(Boolean))];
    if (!safe.length) throw new Error('No weapons selected.');
    return `(${safe.map(id => `id:${id}`).join(' or ')})`;
  }
  const api = { normalizeId, normalizeGrade, gradeOrder, extractGrades, gradeDetails, gradeFor, transferReasons, reasons, eligible, canSelect, freeSpaces, planBatch, exactSearch, MAX_GRADE_AGE };
  root.VaultCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
