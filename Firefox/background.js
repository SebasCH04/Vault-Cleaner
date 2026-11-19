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
          const fresh = at => Number.isFinite(at) && now-at <= 48*60*60*1000 && at <= now+60000;
          const merged = {grade,at:now,source:'dom',basis:record.basis === 'best' ? 'best' : 'displayed'};
          for (const role of ['current','best']) {
            const key = role+'Grade', time = role+'At';
            if (valid(record[key])) {merged[key]=record[key];merged[time]=now;}
            else if (valid(previous[key]) && fresh(previous[time] ?? previous.at)) {merged[key]=previous[key];merged[time]=previous[time] ?? previous.at;}
          }
          grades[id] = merged;
          count++;
        }
      }
      if (count) await browser.storage.local.set({ vcGrades: grades, vcLastSync: now });
      return { saved: count, total: Object.keys(grades).length };
    });
    return writes;
  }
  if (msg.type === 'open-sync') return browser.tabs.create({ url: 'https://www.light.gg/god-roll/roll-appraiser/?vaultcleaner=sync' });
});
