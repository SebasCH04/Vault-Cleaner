'use strict';
let writes = Promise.resolve();
function saveGrades(msg) {
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
        const fromModel = msg.source === 'appraisal-model';
        const fromAppraisal = fromModel || msg.source === 'appraisal';
        const merged = {grade,at:now,source:fromAppraisal ? msg.source : 'dom',basis:record.basis === 'best' ? 'best' : 'displayed'};
        for (const role of ['current','best']) {
          const key = role+'Grade', time = role+'At';
          const score = role+'Overall', scoreTime = score+'At', scoreGrade = score+'Grade';
          const scoreScale = score+'Scale', scoreSource = score+'Source';
          const scale = record[scoreScale] || 'percent';
          const scoreValid = (value, unit) => typeof value === 'number' && Number.isFinite(value) &&
            (unit === 'lightgg-average-rank' ? value >= -0.25 && value <= 8 : value >= 0 &&
              (unit === 'percent' ? value <= 100 : typeof unit === 'string' && /^score:[a-z-]{2,90}$/.test(unit)));
          const priorScale = previous[scoreScale] || 'percent';
          const retainScore = previous[scoreGrade] === previous[key] && fresh(previous[scoreTime]) &&
            scoreValid(previous[score],priorScale);
          const preferAppraisal = !fromAppraisal && retainScore && previous[scoreSource] === 'appraisal' &&
            (record[key] === previous[key] || role === 'best' && record[key] === previous[key]?.[0] &&
              previous[key]?.length === 2 && record[score] === undefined);
          const preferModel = !fromModel && retainScore && previous[scoreSource] === 'appraisal-model';
          if (valid(record[key]) && !preferAppraisal && !preferModel) {
            merged[key]=record[key];merged[time]=now;
            if (scoreValid(record[score],scale) && (scale === 'lightgg-average-rank' ? fromModel : fromAppraisal || scale === 'percent')) {
              merged[score]=record[score];merged[scoreTime]=now;merged[scoreGrade]=record[key];
              merged[scoreScale]=scale;merged[scoreSource]=merged.source;
            }
          } else if (valid(previous[key]) && fresh(previous[time] ?? previous.at)) {
            merged[key]=previous[key];merged[time]=previous[time] ?? previous.at;
          }
          // A card without a score cannot erase independently observed appraisal data.
          if (merged[score] === undefined && merged[key] === previous[key] && retainScore &&
              (!record[key] || preferAppraisal || preferModel || previous[scoreSource] === 'appraisal')) {
            merged[score]=previous[score];merged[scoreTime]=previous[scoreTime];merged[scoreGrade]=previous[scoreGrade];
            merged[scoreScale]=priorScale;merged[scoreSource]=previous[scoreSource] || 'dom';
          }
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
browser.runtime.onMessage.addListener((msg, sender) => {
  const origin = sender.url && new URL(sender.url).origin;
  if (msg.type === 'save-grades' && origin === 'https://www.light.gg') return saveGrades(msg);
  if (msg.type === 'open-sync') return browser.tabs.create({ url: 'https://www.light.gg/god-roll/roll-appraiser/?vaultcleaner=sync' });
});
