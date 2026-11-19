(() => {
  'use strict';
  const now = Date.now();
  const names = ['Midnight Coup', 'The Recluse', 'Edge Transit', 'Blast Furnace', 'The Mountaintop', 'Hammerhead', 'Forbearance', 'Succession', 'Luna’s Howl', 'Hung Jury SR4', 'Elsie’s Rifle', 'Falling Guillotine', 'Indebted Kindness', 'Apex Predator', '1000 Yard Stare', 'Sunshot', 'Graviton Lance', 'Khvostov 7G-0X'];
  const types = ['Cañón de mano', 'Subfusil', 'Lanzagranadas', 'Fusil de pulsos', 'Lanzagranadas', 'Ametralladora', 'Lanzagranadas', 'Fusil de francotirador', 'Cañón de mano', 'Fusil de explorador', 'Fusil de pulsos', 'Espada', 'Pistola', 'Lanzacohetes', 'Fusil de francotirador', 'Cañón de mano', 'Fusil de pulsos', 'Fusil automático'];
  const letters = ['F','D','C','D','F','C','A','S','B','C','D','F',null,'B','D','A',null,null];
  const perks = [['Explosive Payload','Kinetic Tremors'], ['Subsistence','Desperate Measures'], ['Auto-Loading Holster','Bait and Switch'], ['Headseeker','Frenzy'], ['Overflow','Vorpal Weapon'], ['Envious Assassin','Killing Tally']];
  let snap = {
    source: 'demo', canTransfer: true, warnings: [], at: now,
    items: names.map((name, i) => ({ id: String(6917530200000000000n + BigInt(i)), hash: i+1, name, type: types[i], bucket: ['kinetic','energy','power'][i % 3], bucketName: ['Cinética','Energía','Potencia'][i % 3], owner: 'vault', ownerName: 'Vault', weapon: true, alternativePerks: true, locked: i === 9, equipped: false, tag: i === 10 ? 'favorite' : '', inLoadout: i === 11, exotic: i >= 15, crafted: i === 14, deepsight: false, notransfer: false, postmaster: false, power: 550, perks: perks[i % perks.length] })),
    characters: [
      { id: 'hunter', name: 'Cazador · activo', current: true, isVault: false, capacity: { kinetic:10, energy:10, power:10 }, occupied: { kinetic:5, energy:6, power:7 } },
      { id: 'warlock', name: 'Hechicero', current: false, isVault: false, capacity: { kinetic:10, energy:10, power:10 }, occupied: { kinetic:3, energy:3, power:3 } }
    ]
  };
  const grades = {};
  snap.items.forEach((item, i) => { if (letters[i]) grades[item.id] = { grade: letters[i], bestGrade: letters[i], currentGrade: letters[i], at: now, source: 'demo' }; });
  // Confirmed tier increases; a best-only copy remains outside Mejorables.
  grades[snap.items[6].id].currentGrade = 'D';
  grades[snap.items[7].id].currentGrade = 'C';
  delete grades[snap.items[8].id].currentGrade; grades[snap.items[8].id].basis='best';
  grades[snap.items[13].id] = { grade: 'B-', bestGrade: 'B-', currentGrade: 'D', higherRankPossible: true, rankImprovementChecked:true, rankImprovementSource:'badge', at: now, source: 'demo' };
  let plan = null, progress = () => {}, stopped = false;
  const adapter = {
    snapshot: async () => structuredClone(snap), grades: async () => structuredClone(grades),
    prepare: async payload => {
      const target = snap.characters.find(c => c.id === payload.targetId);
      const result = VaultCore.planBatch(snap.items, grades, payload.ids, target, payload.categories, payload.limit, payload.reserve);
      if (!result.batch.length) throw new Error('No hay espacio libre para esta tanda.');
      plan = { ...payload, batch: result.batch, token: crypto.randomUUID(), target };
      return structuredClone(plan);
    },
    transfer: async token => {
      if (!plan || plan.token !== token) throw new Error('La tanda venció.');
      stopped = false; let moved = 0;
      for (const item of plan.batch) {
        if (stopped) break;
        progress({ moved, total: plan.batch.length, name: item.name });
        await new Promise(resolve => setTimeout(resolve, 550));
        item.owner = plan.target.id; item.ownerName = plan.target.name;
        plan.target.occupied[item.bucket]++; moved++;
        progress({ moved, total: plan.batch.length, name: item.name, completedId: item.id });
      }
      return { moved, stopped, snapshot: structuredClone(snap) };
    },
    improve: async id => {
      const record=grades[id];
      if (!record) throw new Error('No hay nota para esta copia.');
      if (!record.bestGrade) record.bestGrade='B';
      record.currentGrade=record.bestGrade; record.grade=record.bestGrade; record.higherRankPossible=false; record.at=Date.now();
      return {status:'simulated'};
    },
    stop: async () => { stopped = true; },
    search: async () => { throw new Error('La vista previa no se conecta a DIM. Instala la extensión para usar esta función.'); },
    sync: async () => { throw new Error('Esta demo usa notas de prueba. La sincronización real está disponible en la extensión.'); },
    onProgress: callback => { progress = callback; }
  };
  mountVaultCleaner(document.getElementById('app'), '../panel.css', adapter, true);
})();
