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
  function gradeFor(item, grades, now = Date.now()) {
    const record = grades[item.id];
    const grade = normalizeGrade(record?.grade);
    if (!grade || !Number.isFinite(record.at) || now - record.at > MAX_GRADE_AGE || record.at > now + 60000) return null;
    return grade;
  }
  function reasons(item, grades, now = Date.now()) {
    const out = [];
    if (!item.weapon) out.push('Armadura u otro objeto');
    if (item.owner !== 'vault') out.push('Fuera del vault');
    if (item.locked !== false) out.push('Bloqueada o estado desconocido');
    if (item.equipped !== false) out.push('Equipada o estado desconocido');
    if (['favorite', 'keep', 'archive'].includes(item.tag)) out.push('Favorita / conservar / archivar');
    if (item.inLoadout) out.push('En un loadout');
    if (item.exotic) out.push('Exótica');
    if (item.crafted) out.push('Fabricada');
    if (item.deepsight) out.push('Deepsight');
    if (item.notransfer || item.postmaster) out.push('No transferible');
    if (!gradeFor(item, grades, now)) out.push('Sin nota reciente de light.gg');
    return out;
  }
  function eligible(item, grades, categories, now = Date.now()) {
    const grade = gradeFor(item, grades, now);
    return grade && categories.includes(grade[0]) && reasons(item, grades, now).length === 0;
  }
  function planBatch(items, grades, selectedIds, target, categories, limit = 9, reserve = 1) {
    if (!target || target.isVault) throw new Error('Selecciona un personaje.');
    const max = Math.max(1, Math.min(27, Number(limit) || 9));
    const keep = reserve ? 1 : 0;
    const selected = new Set(selectedIds.map(normalizeId).filter(Boolean));
    const used = Object.create(null);
    const batch = [];
    const skipped = [];
    for (const item of items) {
      if (!selected.has(item.id)) continue;
      if (!eligible(item, grades, categories)) { skipped.push({ id: item.id, reason: 'Ahora está protegida o no tiene una nota válida.' }); continue; }
      const capacity = target.capacity?.[item.bucket];
      const occupied = target.occupied?.[item.bucket];
      if (!Number.isInteger(capacity) || !Number.isInteger(occupied)) { skipped.push({ id: item.id, reason: 'No se pudo verificar la capacidad.' }); continue; }
      const remaining = Math.max(0, capacity - occupied - keep - (used[item.bucket] || 0));
      if (!remaining) { skipped.push({ id: item.id, reason: 'Sin espacio en esta ranura.' }); continue; }
      if (batch.length >= max) break;
      used[item.bucket] = (used[item.bucket] || 0) + 1;
      batch.push(item);
    }
    return { batch, skipped };
  }
  function exactSearch(ids) {
    const safe = [...new Set(ids.map(normalizeId).filter(Boolean))];
    if (!safe.length) throw new Error('No hay armas seleccionadas.');
    return `(${safe.map(id => `id:${id}`).join(' or ')})`;
  }
  const api = { normalizeId, normalizeGrade, extractGrades, gradeFor, reasons, eligible, planBatch, exactSearch, MAX_GRADE_AGE };
  root.VaultCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
