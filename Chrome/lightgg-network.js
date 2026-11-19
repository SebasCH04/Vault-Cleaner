(() => {
  'use strict';
  if (new URLSearchParams(location.search).get('vaultcleaner') === 'background') return;
  const C = globalThis.VaultCore;
  const DATA_EVENT = 'vault-cleaner-appraisal-data';
  const LIMIT = 4 * 1024 * 1024;
  const MAX_NODES = 60000;
  const names = new Set();
  let responses = 0;
  let listening = false;
  const pending = new Map();
  const keyName = key => key.toLowerCase().replace(/[_-]/g,'');
  const rolePrefixes = {best:['bestpossible','bestavailable','highest','maximum','best','max'],current:['currentlyequipped','current','equipped']};
  const contexts = new Set(['roll','popularity','rollpopularity','popularityrank','popularityranks','rollappraisal','appraisal','grades','rankings']);
  const gradeKeys = new Set(['grade','quality','rank','letter','rollgrade','rollquality','popularitygrade','popularityrank']);

  function emit() {
    if (!listening) return;
    const records = Object.fromEntries(pending);
    pending.clear();
    document.dispatchEvent(new CustomEvent(DATA_EVENT,{
      detail:JSON.stringify({records,responses,fields:[...names]})
    }));
  }

  function appraisalUrl(value) {
    try {
      const url = new URL(value,location.href);
      return url.origin === location.origin &&
        !/\.[a-z0-9]{2,5}$/i.test(url.pathname) &&
        /(?:^|\/)(?:api(?:\/|$)|[^/]*(?:roll|apprais|inventory)[^/]*(?:\/|$))/i.test(url.pathname);
    } catch { return false; }
  }

  function object(value) { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }

  function readOverall(key, value, path, rank) {
    if (object(value)) {
      for (const [name,entry] of Object.entries(value)) {
        const field = keyName(name);
        if (gradeKeys.has(field)) {
          const grade = C.normalizeGrade(entry);
          if (grade) rank.grades.add(grade);
        } else if (/^(?:percentage|percent|pct|ratio|fraction|score|value)$/.test(field)) {
          readOverall(key+field,entry,path+'-'+field,rank);
        }
      }
      return;
    }
    const letter = C.normalizeGrade(value);
    if (letter) {rank.grades.add(letter);return;}
    const raw = typeof value === 'number' ? value : typeof value === 'string' &&
      /^\d{1,12}(?:[.,]\d{1,12})?\s*%?$/.test(value.trim()) ? Number(value.trim().replace('%','').replace(',','.')) : NaN;
    if (!Number.isFinite(raw) || raw < 0) return;
    const literalPercent = typeof value === 'string' && value.trim().endsWith('%');
    const percent = literalPercent || /(?:percentage|percent|pct)$/.test(key);
    const ratio = !percent && /(?:ratio|fraction)$/.test(key);
    if (percent && raw > 100 || ratio && raw > 1) return;
    const scale = percent || ratio ? 'percent' : 'score:'+path;
    rank.scores.set(scale, [...new Set([...(rank.scores.get(scale) || []), ratio ? raw*100 : raw])]);
  }

  function roleEntry(value, levels, rank, path, prefixes, context = false) {
    if (!object(value) || levels < 0) return;
    for (const [name,entry] of Object.entries(value)) {
      const field = keyName(name);
      const prefix = prefixes.find(prefix=>field.startsWith(prefix));
      const key = prefix ? field.slice(prefix.length) : field;
      const qualified = context || Boolean(prefix);
      const selector = /^[a-z]{2,40}$/.test(field) ? path+field : path;
      if (prefix && !key) roleEntry(entry,levels-1,rank,selector+'-',[],true);
      else if (contexts.has(key)) roleEntry(entry,levels-1,rank,selector+'-',prefixes,qualified);
      else if (qualified && gradeKeys.has(key)) {
        const grade = C.normalizeGrade(entry);
        if (grade) rank.grades.add(grade);
        else if (object(entry)) roleEntry(entry,levels-1,rank,selector+'-',[],true);
      } else if (qualified && /^overall(?:popularity)?(?:score|value)?(?:percentage|percent|pct|ratio|fraction)?$/.test(key)) {
        if (names.size < 30) names.add(selector);
        readOverall(key,entry,selector,rank);
      } else if (names.size < 30 && /^[a-z]{2,40}$/.test(field) && /overall|popularity.*(?:score|value)/.test(field)) {
        names.add(selector);
      }
    }
  }

  function capture(value) {
    if (!value || typeof value !== 'object') return;
    responses++;
    const records = new Map(), disputed = new Set();
    const queue = [[value,null,0]];
    for (let i = 0; i < queue.length && i < MAX_NODES; i++) {
      const [part,keyId,depth] = queue[i];
      if (depth > 9) continue;
      if (Array.isArray(part)) {
        for (const item of part) {
          if (queue.length >= MAX_NODES) break;
          if (object(item)) queue.push([item,null,depth+1]);
        }
        continue;
      }
      if (!object(part)) continue;
      const fields = Object.entries(part);
      const ids = new Set(fields.filter(([key])=>/^(?:iteminstanceid|instanceid|id)$/.test(keyName(key)))
        .map(([,value])=>C.normalizeId(value)).filter(Boolean));
      if (keyId) ids.add(keyId);
      if (ids.size === 1) {
        const id = ids.values().next().value;
        const record = {};
        for (const [role,prefixes] of Object.entries(rolePrefixes)) {
          const rank = {grades:new Set(),scores:new Map()};
          roleEntry(part,3,rank,'',prefixes);
          const scale = rank.scores.has('percent') ? 'percent' : rank.scores.size === 1 ? rank.scores.keys().next().value : null;
          const scores = rank.scores.get(scale);
          if (rank.grades.size === 1 && scores?.length === 1 && scale.length <= 96) {
            record[role+'Grade'] = rank.grades.values().next().value;
            record[role+'Overall'] = scores[0];
            record[role+'OverallScale'] = scale;
          }
        }
        if (record.bestGrade || record.currentGrade) {
          record.grade = record.bestGrade || record.currentGrade;
          record.basis = record.bestGrade ? 'best' : 'displayed';
          const prior = records.get(id);
          if (prior && JSON.stringify(prior) !== JSON.stringify(record)) disputed.add(id);
          records.set(id,record);
        }
      }
      for (const [key,child] of fields) {
        if (queue.length >= MAX_NODES) break;
        if (child && typeof child === 'object') queue.push([child,C.normalizeId(key),depth+1]);
      }
    }
    for (const [id,record] of records) if (!disputed.has(id) && pending.size < 5000) pending.set(id,record);
    emit();
  }

  function parse(text) {
    if (typeof text === 'string' && text.length <= LIMIT && /overall|popularity|instance_?id/i.test(text)) {
      try { capture(JSON.parse(text)); } catch {}
    }
  }

  async function inspect(response) {
    if (!response.ok || !appraisalUrl(response.url) || !/\bjson\b/i.test(response.headers.get('content-type') || '')) return;
    if (Number(response.headers.get('content-length')) > LIMIT || !response.body) return;
    const reader = response.clone().body.getReader(), decoder = new TextDecoder();
    let bytes = 0, text = '';
    while (true) {
      const {done,value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > LIMIT) {void reader.cancel().catch(()=>{});return;}
      text += decoder.decode(value,{stream:true});
    }
    parse(text+decoder.decode());
  }

  document.addEventListener('vault-cleaner-appraisal-listen', () => {listening = true;emit();});
  document.dispatchEvent(new Event('vault-cleaner-appraisal-ready'));
  const nativeFetch = window.fetch;
  window.fetch = function (...args) {
    const request = Reflect.apply(nativeFetch,this,args);
    void request.then(inspect,()=>{}).catch(()=>{});
    return request;
  };
  const nativeSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('load',function () {
      try {
        if (this.status < 200 || this.status >= 300 || !appraisalUrl(this.responseURL) ||
            !/\bjson\b/i.test(this.getResponseHeader('content-type') || '') ||
            Number(this.getResponseHeader('content-length')) > LIMIT) return;
        if (this.responseType === 'json') capture(this.response);
        else if (this.responseType === '' || this.responseType === 'text') parse(this.responseText);
      } catch {}
    },{once:true});
    return Reflect.apply(nativeSend,this,args);
  };
})();
