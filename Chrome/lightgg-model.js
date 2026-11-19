(() => {
  'use strict';
  const C = globalThis.VaultCore;
  const SCALE = 'lightgg-average-rank';

  function inventory() {
    // The Roll Appraiser owns this Vue root. Read its inventory, including
    // rolls that are collapsed or filtered out of the visible grid.
    for (const selector of ['#my-rolls','#main-content']) {
      const vm = document.querySelector(selector)?.__vue__;
      for (const data of [vm?.$data,vm?.$root?.$data]) if (Array.isArray(data?.Rolls)) return data;
    }
    return null;
  }

  document.addEventListener('vault-cleaner-appraisal-model-request', () => {
    const model = inventory(), rolls = model?.Rolls, records = Object.create(null), disputed = new Set();
    if (rolls) for (const roll of rolls.slice(0,5000)) {
      const id = C.normalizeId(roll?.itemInstanceId);
      if (!id) continue;
      const bestGrade = C.normalizeGrade(roll.BestGrade);
      const bestOverall = roll.BestAvgRank;
      // Missing and pending results can carry a placeholder rank. Require
      // the score and exact letter to agree before recommending a duplicate.
      if (!bestGrade || C.lightggAverageGrade(bestOverall) !== bestGrade ||
          bestOverall === 6 && !roll.BestPerks?.length) continue;
      const record = {grade:bestGrade,basis:'best',bestGrade,bestOverall,bestOverallScale:SCALE};
      const currentGrade = C.normalizeGrade(roll.EquippedGrade);
      if (!roll.Modified && currentGrade && C.lightggAverageGrade(roll.EquippedAvgRank) === currentGrade &&
          C.gradeOrder(currentGrade) >= C.gradeOrder(bestGrade) &&
          (currentGrade !== bestGrade || roll.EquippedAvgRank >= bestOverall)) {
        record.currentGrade = currentGrade;
        record.currentOverall = roll.EquippedAvgRank;
        record.currentOverallScale = SCALE;
      }
      if (records[id] && JSON.stringify(records[id]) !== JSON.stringify(record)) disputed.add(id);
      records[id] = record;
    }
    for (const id of disputed) delete records[id];
    document.dispatchEvent(new CustomEvent('vault-cleaner-appraisal-model',{
      detail:JSON.stringify({available:Boolean(rolls),rolls:rolls?.length ?? 0,
        signedIn:model?.IsAuthenticated ?? null,loading:Boolean(model?.Loading || model?.VaultLoading || model?.ManifestLoaded === false),records})
    }));
  });
})();
