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
  const ARMOR_SLOTS = ['3448274439','3551918588','14239492','20886954','1585787867'];
  const ARMOR_STATS = [2996146975,392767087,1943323491,1735777505,144602215,4244567218];
  const STAT_NAMES = ['Weapons','Health','Class','Grenade','Super','Melee'];
  const CLASS_NAMES = ['Titan','Hunter','Warlock'];
  function armorTransferReasons(item) {
    const out = [];
    if (!item.armor) out.push('Not armor');
    if (item.owner !== 'vault') out.push('Outside the vault');
    if (item.equipped !== false) out.push('Equipped or unknown state');
    if (item.notransfer || item.postmaster) out.push('Not transferable');
    return out;
  }
  function armorProtection(item) {
    const out = [];
    if (item.locked !== false) out.push('Locked or unknown state');
    if (['favorite','keep','archive'].includes(item.tag)) out.push('Favorite / keep / archive');
    if (item.inLoadout) out.push('In a loadout');
    if (item.equipped !== false) out.push('Equipped or unknown state');
    if (item.postmaster || item.notransfer) out.push('Not transferable');
    return out;
  }
  function armorGroup(item) {
    const a = item.armorData;
    const exotic = Boolean(item.exotic);
    if (!a?.complete || !normalizeId(item.id) || !ARMOR_SLOTS.includes(item.bucket) || ![0,1,2].includes(a.classType) ||
        !Array.isArray(a.base) || a.base.length !== 6 || !a.base.every(v => Number.isInteger(v) && v >= 0) ||
        (!exotic && !a.setHash) || !a.archetypeHash || !Number.isInteger(a.tier) || a.tier < (exotic ? 0 : 1) || a.tier > 5 ||
        typeof a.features !== 'string' || !a.features || !Number.isInteger(a.masterwork) || a.masterwork < 0 || a.masterwork > 5 || !item.hash) return null;
    // Exotics do not require a legendary set bonus. Their actual intrinsic
    // perks must be verified, especially both rolls on exotic class items.
    if (exotic && (a.generation !== 3 || !Array.isArray(a.exoticPerks) ||
        a.exoticPerks.length < (item.bucket === ARMOR_SLOTS[4] ? 2 : 1) ||
        !a.exoticPerks.every(p=>Array.isArray(p) && p.length === 2 && Number.isInteger(p[0]) && p[0] >= 0 && Number.isInteger(p[1]) && p[1] > 0))) return null;
    // Same item definition as well as matching features. Different tuning,
    // mod access, stat distributions or legacy armor are never interchangeable.
    return JSON.stringify([item.hash,exotic,item.bucket,a.classType,a.setHash || null,a.archetypeHash,a.tier,a.features,exotic ? a.exoticPerks : [],
      a.base.map((v,index)=>v > 0 ? index : null).filter(v=>v !== null)]);
  }
  function armorAnalysis(items) {
    const armor = items.filter(i=>i.armor), records = Object.create(null), groups = new Map();
    const topPower = new Map();
    const preference = (a,b) => armorProtection(b).length - armorProtection(a).length ||
      (b.armorData?.masterwork || 0)-(a.armorData?.masterwork || 0) || (b.power || 0)-(a.power || 0) || a.id.localeCompare(b.id);
    for (const item of armor.filter(i=>!i.postmaster && !i.notransfer && [0,1,2].includes(i.armorData?.classType)).sort(preference)) {
      const key = `${item.armorData.classType}:${item.bucket}`, previous = topPower.get(key);
      if (!previous || item.power > previous.power) topPower.set(key,item);
    }
    const powerIds = new Set([...topPower.values()].filter(i=>i.power > 0).map(i=>i.id));
    for (const item of armor) {
      const protection = armorProtection(item), key = armorGroup(item);
      records[item.id] = { state: protection.length ? 'protected' : !key ? 'review' : 'keep',
        reason: protection[0] || (!key ? 'Incomplete comparison data or legacy armor' : 'Distinct stats, tuning or set role') };
      // Postmaster/untransferable/equipment with unknown state cannot serve as a keeper.
      if (key && !item.postmaster && !item.notransfer && typeof item.equipped === 'boolean') {
        if (!groups.has(key)) groups.set(key,[]);
        groups.get(key).push(item);
      }
    }
    for (const group of groups.values()) {
      const dominates = (a,b) => a.armorData.base.every((v,index)=>v >= b.armorData.base[index]);
      const order = group.slice().sort((a,b)=> {
        // Put strict stat improvements first, then prioritize invested/protected copies.
        const sum = i=>i.armorData.base.reduce((total,v)=>total+v,0);
        return sum(b)-sum(a) || preference(a,b);
      });
      const keepers = [];
      for (const item of order) {
        const candidate = !armorProtection(item).length && item.owner === 'vault' && !powerIds.has(item.id);
        const keeper = candidate && keepers.find(k=>dominates(k,item) && (k.power || 0) >= (item.power || 0) && (k.armorData.masterwork || 0) >= (item.armorData.masterwork || 0));
        if (keeper) records[item.id] = { state:'duplicate', keeperId:keeper.id,
          reason: keeper.armorData.base.every((v,index)=>v === item.armorData.base[index]) ?
            'Equivalent copy retained with the same stats and options' : 'Retained copy has equal or better stats in every category' };
        else {
          keepers.push(item);
          if (powerIds.has(item.id) && records[item.id].state === 'keep') records[item.id].reason = 'Highest-Power copy for this class and slot';
        }
      }
    }
    const sets = new Map();
    for (const item of armor) {
      const a = item.armorData;
      if (!a?.setHash || ![0,1,2].includes(a.classType) || item.exotic || item.postmaster || item.notransfer || !ARMOR_SLOTS.includes(item.bucket)) continue;
      const key = `${a.classType}:${a.setHash}`;
      if (!sets.has(key)) sets.set(key,{ key,hash:a.setHash,name:a.setName || 'Unnamed set',classType:a.classType,slots:new Set(),retained:new Set() });
      const set = sets.get(key); set.slots.add(item.bucket);
      if (records[item.id]?.state !== 'duplicate') set.retained.add(item.bucket);
    }
    return { records, sets:[...sets.values()].map(s=>({...s,slots:[...s.slots],retained:[...s.retained]})) };
  }
  function canSelectItem(item, grades, categories, mode, kind = 'weapons', analysis) {
    if (kind !== 'armor') return Boolean(item.weapon && canSelect(item,grades,categories,mode));
    return armorTransferReasons(item).length === 0 && (mode === 'manual' || analysis?.records[item.id]?.state === 'duplicate');
  }
  function freeSpaces(target, bucket, reserve = false) {
    const capacity = target?.capacity?.[bucket], occupied = target?.occupied?.[bucket];
    if (!Number.isInteger(capacity) || capacity < 0 || !Number.isInteger(occupied) || occupied < 0) return null;
    return Math.max(0, capacity - occupied - (reserve ? 1 : 0));
  }
  function planBatch(items, grades, selectedIds, target, categories, limit = 9, reserve = false, mode = 'clean', batchMode = 'slot', kind = 'weapons') {
    if (!target || target.isVault) throw new Error('Select a character.');
    const totalMode = batchMode === 'total';
    const totalMax = kind === 'armor' ? 45 : 27;
    const max = Math.max(1, Math.min(totalMode ? totalMax : 9, Math.floor(Number(limit) || 9)));
    const selected = new Set(selectedIds.map(normalizeId).filter(Boolean));
    const used = Object.create(null);
    const batch = [];
    const skipped = [];
    const analysis = kind === 'armor' ? armorAnalysis(items) : null;
    const keeperIds = new Set();
    for (const item of items) {
      if (!selected.has(item.id)) continue;
      if (!canSelectItem(item, grades, categories, mode, kind, analysis)) { skipped.push({ id: item.id, reason: mode === 'manual' ? 'This copy cannot be transferred from the vault.' : 'This copy is now protected or has no valid maximum or duplicate replacement.' }); continue; }
      if (kind === 'armor' && (![0,1,2].includes(target.classType) || item.armorData?.classType !== target.classType)) {
        skipped.push({id:item.id,reason:'Select a destination of the same armor class.'}); continue;
      }
      const free = freeSpaces(target, item.bucket, reserve);
      if (free === null) { skipped.push({ id: item.id, reason: 'Capacity could not be verified.' }); continue; }
      const remaining = Math.max(0, free - (used[item.bucket] || 0));
      if (!remaining) { skipped.push({ id: item.id, reason: 'No space in this slot.' }); continue; }
      if ((used[item.bucket] || 0) >= (totalMode ? 9 : max) || batch.length >= (totalMode ? max : totalMax)) { skipped.push({id:item.id,reason:'Batch limit reached.'}); continue; }
      used[item.bucket] = (used[item.bucket] || 0) + 1;
      batch.push(item);
      if (kind === 'armor' && mode !== 'manual') keeperIds.add(analysis.records[item.id].keeperId);
    }
    if (batch.some(i=>keeperIds.has(i.id))) throw new Error('A retained armor copy cannot be included in its cleanup batch.');
    return { batch, skipped, counts: { ...used }, ...(kind === 'armor' ? { keeperIds:[...keeperIds] } : {}) };
  }
  function exactSearch(ids) {
    const safe = [...new Set(ids.map(normalizeId).filter(Boolean))];
    if (!safe.length) throw new Error('No items selected.');
    return `(${safe.map(id => `id:${id}`).join(' or ')})`;
  }
  const api = { normalizeId, normalizeGrade, gradeOrder, extractGrades, gradeDetails, gradeFor, transferReasons, reasons, eligible, canSelect, canSelectItem, armorTransferReasons, armorProtection, armorAnalysis, armorGroup, ARMOR_SLOTS, ARMOR_STATS, STAT_NAMES, CLASS_NAMES, freeSpaces, planBatch, exactSearch, MAX_GRADE_AGE };
  root.VaultCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
