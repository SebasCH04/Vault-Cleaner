'use strict';
let writes = Promise.resolve();
browser.runtime.onMessage.addListener((msg, sender) => {
  const origin = sender.url && new URL(sender.url).origin;
  if (msg.type === 'save-grades' && origin === 'https://www.light.gg') {
    // Serialize merges: pagination can deliver several responses simultaneously.
    writes = writes.catch(() => {}).then(async () => {
      const stored = await browser.storage.local.get('vcGrades');
      const grades = stored.vcGrades || {};
      const now = Date.now();
      let count = 0;
      for (const [id, value] of Object.entries(msg.grades || {})) {
        const record = typeof value === 'string' ? { grade: value } : value || {};
        const grade = record.grade;
        if (typeof grade === 'string' && /^\d{18,20}$/.test(id) && /^(?:S|A|B|C|D|F)[+-]?$/.test(grade)) {
          const valid = value => typeof value === 'string' && /^(?:S|A|B|C|D|F)[+-]?$/.test(value);
          const previous = grades[id] || {};
          const fresh = value => Number.isFinite(value) && now-value <= 48*60*60*1000 && value <= now+60000;
          const merged = { grade, at: now, source: 'dom', basis: record.basis === 'best' ? 'best' : 'displayed', higherRankPossible: record.higherRankChecked === true ? record.higherRankPossible === true : record.higherRankPossible === true || (fresh(previous.at) && previous.higherRankPossible === true) };
          if (valid(record.bestGrade)) { merged.bestGrade = record.bestGrade; merged.bestAt = now; }
          else if (valid(previous.bestGrade) && fresh(previous.bestAt ?? previous.at)) { merged.bestGrade = previous.bestGrade; merged.bestAt = previous.bestAt ?? previous.at; }
          if (valid(record.currentGrade)) { merged.currentGrade = record.currentGrade; merged.currentAt = now; }
          else if (valid(previous.currentGrade) && fresh(previous.currentAt ?? previous.at)) { merged.currentGrade = previous.currentGrade; merged.currentAt = previous.currentAt ?? previous.at; }
          grades[id] = merged;
          count++;
        }
      }
      if (count) await browser.storage.local.set({ vcGrades: grades, vcLastSync: now });
      return { saved: count, total: Object.keys(grades).length };
    });
    return writes;
  }
  if (msg.type === 'apply-popular' && ['https://app.destinyitemmanager.com','https://beta.destinyitemmanager.com'].includes(origin)) {
    return (async () => {
      if (!/^\d{18,20}$/.test(msg.id) || typeof msg.id !== 'string') throw new Error('ID de copia inválido.');
      const tabs = await browser.tabs.query({url:'https://www.light.gg/god-roll/roll-appraiser/*'});
      const ordered = tabs.sort((a,b)=>Number(b.active)-Number(a.active) || (b.lastAccessed || 0)-(a.lastAccessed || 0));
      let match;
      for (const tab of ordered) {
        try { if ((await browser.tabs.sendMessage(tab.id,{type:'vc-lightgg-probe',id:msg.id}))?.found) {match=tab;break;} } catch {}
      }
      if (!match) throw new Error('No se encontró esa copia en una pestaña capturada de light.gg. Abre su vista, pulsa Reanudar captura y vuelve a intentarlo.');
      await browser.tabs.update(match.id,{active:true});
      const result = await browser.tabs.sendMessage(match.id,{type:'vc-lightgg-apply',id:msg.id});
      if (!result?.ok) throw new Error(result?.error || 'No se pudo enviar la mejora a light.gg.');
      // Keep pending writes ordered. Stale notes cannot be used as proof of success.
      writes = writes.catch(()=>{}).then(async()=>{
        const stored=await browser.storage.local.get('vcGrades'), grades=stored.vcGrades || {};
        delete grades[msg.id]; await browser.storage.local.set({vcGrades:grades});
      });
      await writes;
      return {status:'submitted'};
    })();
  }
  if (msg.type === 'open-sync') return browser.tabs.create({ url: 'https://www.light.gg/god-roll/roll-appraiser/?vaultcleaner=sync' });
});
