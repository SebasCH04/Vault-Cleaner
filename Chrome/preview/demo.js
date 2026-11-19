(() => {
  'use strict';
  const now = Date.now();
  const names = ['Midnight Coup', 'The Recluse', 'Edge Transit', 'Blast Furnace', 'The Mountaintop', 'Hammerhead', 'Forbearance', 'Succession', 'Luna’s Howl', 'Hung Jury SR4', 'Elsie’s Rifle', 'Falling Guillotine', 'Indebted Kindness', 'Apex Predator', '1000 Yard Stare', 'Sunshot', 'Graviton Lance', 'Khvostov 7G-0X'];
  const types = ['Hand cannon', 'Submachine gun', 'Grenade launcher', 'Pulse rifle', 'Grenade launcher', 'Machine gun', 'Grenade launcher', 'Sniper rifle', 'Hand cannon', 'Scout rifle', 'Pulse rifle', 'Sword', 'Sidearm', 'Rocket launcher', 'Sniper rifle', 'Hand cannon', 'Pulse rifle', 'Auto rifle'];
  const letters = ['F','D','C','D','F','C','A','S','B','C','D','F',null,'B','D','A',null,null];
  const perks = [['Explosive Payload','Kinetic Tremors'], ['Subsistence','Desperate Measures'], ['Auto-Loading Holster','Bait and Switch'], ['Headseeker','Frenzy'], ['Overflow','Vorpal Weapon'], ['Envious Assassin','Killing Tally']];
  let snap = {
    source: 'demo', canTransfer: true, warnings: [], at: now,
    items: names.map((name, i) => ({ id: String(6917530200000000000n + BigInt(i)), hash: i+1, name, type: types[i], bucket: ['kinetic','energy','power'][i % 3], bucketName: ['Kinetic','Energy','Power'][i % 3], owner: 'vault', ownerName: 'Vault', weapon: true, locked: i === 9, equipped: false, tag: i === 10 ? 'favorite' : '', inLoadout: i === 11, exotic: i >= 15, crafted: i === 14, deepsight: false, notransfer: false, postmaster: false, power: 550, perks: perks[i % perks.length] })),
    characters: [
      { id: 'hunter', name: 'Hunter · active', classType:1, current: true, isVault: false, capacity: { kinetic:10, energy:10, power:10 }, occupied: { kinetic:5, energy:6, power:7 } },
      { id: 'warlock', name: 'Warlock', classType:2, current: false, isVault: false, capacity: { kinetic:10, energy:10, power:10 }, occupied: { kinetic:1, energy:1, power:1 } }
    ]
  };
  const grades = {};
  snap.items.forEach((item, i) => { if (letters[i]) grades[item.id] = { grade: letters[i], bestGrade:letters[i], currentGrade:letters[i], basis: 'best', at: now, source: 'demo' }; });
  Object.assign(grades[snap.items[6].id],{grade:'S',bestGrade:'S',currentGrade:'C'});
  Object.assign(grades[snap.items[13].id],{grade:'B-',bestGrade:'B-',currentGrade:'D'});
  // Rank and Overall decide the retained copy even with different perks or masterworks.
  const rollColumns = ['Adaptive Frame','Arrowhead Brake','Accurized Rounds','Explosive Payload','Kinetic Tremors'].map((name,index)=>({
    index,type:1100+index,category:1200+index,name:index ? 'Perk slot '+index : 'Frame',options:[{hash:1300+index,name}]}));
  const weaponData = {complete:true,tier:0,adept:false,holofoil:false,element:1,masterwork:10,masterworkType:'Range',masterworkName:'Range',
    base:[[1,50],[2,35]],columns:rollColumns,features:'standard mods'};
  for(let n=0;n<4;n++) {
    const item={id:String(6917530200000020000n+BigInt(n)),hash:903,name:'Midnight Coup',type:'Hand cannon',bucket:'kinetic',bucketName:'Kinetic',
      owner:'vault',ownerName:'Vault',weapon:true,locked:n===0,equipped:false,power:550,perks:['Explosive Payload','Kinetic Tremors'],
      weaponData:structuredClone(weaponData)};
    if(n===2){item.weaponData.masterwork=5;item.weaponData.columns[4].options=[{hash:1304,name:'Kinetic Tremors'}];}
    else item.weaponData.columns[4].options.push({hash:1314,name:'Frenzy'});
    if(n===3)item.weaponData.masterworkType=item.weaponData.masterworkName='Stability';
    const rank=n===2 ? 'A' : 'S';
    snap.items.push(item);grades[item.id]={grade:rank,bestGrade:rank,currentGrade:n===1 ? 'C' : rank,basis:'best',at:now,source:'demo',
      bestOverall:[95,91,87,93][n],bestOverallGrade:rank,bestOverallAt:now};
  }
  for (let n=0;n<2;n++) {
    const item={id:String(6917530200000020010n+BigInt(n)),hash:904,name:'The Recluse',type:'Submachine gun',bucket:'kinetic',bucketName:'Kinetic',
      owner:'vault',ownerName:'Vault',weapon:true,locked:false,equipped:false,power:550,perks:n ? ['Subsistence','Frenzy'] : ['Subsistence','Desperate Measures']};
    snap.items.push(item);grades[item.id]={grade:'A',bestGrade:'A',currentGrade:'A',basis:'best',at:now,source:'demo',bestOverall:82,bestOverallGrade:'A',bestOverallAt:now};
  }
  // Illustrative armor rolls: a complete set, duplicates, distinct archetypes,
  // unique tuning choices, legacy armor and comparable exotic copies.
  const armorNames = ['Tecsec Mask','Tecsec Grips','Tecsec Vest','Tecsec Strides','Tecsec Cloak'];
  const armor = [];
  function addArmor(slot, overrides = {}) {
    const item = { id:String(6917530200000010000n+BigInt(armor.length)),hash:800+slot,name:armorNames[slot],
      type:'Armor',bucket:VaultCore.ARMOR_SLOTS[slot],bucketName:['Helmet','Arms','Chest','Legs','Class Item'][slot],
      owner:'vault',ownerName:'Vault',armor:true,weapon:false,locked:false,equipped:false,power:550,perks:[],
      armorData:{complete:true,classType:1,className:'Hunter',generation:3,tier:4,setHash:100,setName:'Tecsec',
        archetypeHash:200,archetypeName:'Powerhouse',base:[30,0,0,20,25,0],potential:[30,5,5,20,25,5],masterwork:0,tuningOptions:[],features:'standard-mod-slots'},...overrides };
    armor.push(item); return item;
  }
  for (let slot=0;slot<5;slot++) addArmor(slot,slot === 0 ? {locked:true} : {});
  addArmor(0); addArmor(0,{armorData:{...armor[0].armorData,base:[28,0,0,18,23,0],potential:[28,5,5,18,23,5]}});
  addArmor(1);
  addArmor(0,{armorData:{...armor[0].armorData,archetypeHash:201,archetypeName:'Brawler',base:[0,25,0,0,20,30],potential:[5,25,5,5,20,30]}});
  for (const tuned of ['weapons','super']) addArmor(0,{armorData:{...armor[0].armorData,tier:5,tuningOptions:[1,2,3],features:'tuning-'+tuned}});
  addArmor(2,{hash:900,name:'Legacy Vest',armorData:{...armor[0].armorData,complete:false,generation:2,tier:0,setHash:null,setName:'',archetypeHash:null,archetypeName:''}});
  const exoticData = {...armor[0].armorData,tier:0,setHash:null,setName:'',exoticPerks:[[4,10001]],features:'cross-counter+standard-mod-slots'};
  const exotic = {hash:901,name:'Exotic Gauntlets',exotic:true,perks:['Cross Counter'],armorData:exoticData};
  addArmor(1,exotic); addArmor(1,exotic);
  addArmor(1,{...exotic,armorData:{...exoticData,base:[28,0,0,18,23,0],potential:[28,5,5,18,23,5]}});
  addArmor(1,{...exotic,armorData:{...exoticData,archetypeHash:201,archetypeName:'Brawler',base:[0,25,0,0,20,30],potential:[5,25,5,5,20,30]}});
  addArmor(3,{hash:902,name:'Other Set Strides',armorData:{...armor[0].armorData,setHash:101,setName:'Aion Renewal'}});
  snap.items.push(...armor);
  for (const character of snap.characters) for (const bucket of VaultCore.ARMOR_SLOTS) { character.capacity[bucket] = 10; character.occupied[bucket] = 1; }
  let plan = null, progress = () => {}, stopped = false, keepers = {};
  const adapter = {
    snapshot: async () => structuredClone(snap), grades: async () => structuredClone(grades),
    keepers: async () => structuredClone(keepers), saveKeepers: async choices => {keepers=structuredClone(choices);},
    prepare: async payload => {
      const target = snap.characters.find(c => c.id === payload.targetId);
      const result = VaultCore.planBatch(snap.items, grades, payload.ids, target, payload.categories, payload.limit, payload.reserve, payload.mode, payload.batchMode, payload.kind, payload.keeperChoices);
      if (!result.batch.length) throw new Error('No space is available for this batch.');
      const analysis = payload.kind === 'armor' ? VaultCore.armorAnalysis(snap.items) : payload.mode === 'duplicates' ? VaultCore.weaponAnalysis(snap.items,grades,Date.now(),payload.keeperChoices) : null;
      const replacements = analysis && payload.mode !== 'manual' ? Object.fromEntries(result.batch.map(i=>[i.id,analysis.records[i.id].keeperId])) : {};
      plan = { ...payload, ...result, replacements, token: crypto.randomUUID(), target };
      return structuredClone(plan);
    },
    transfer: async token => {
      if (!plan || plan.token !== token) throw new Error('The batch expired.');
      stopped = false; let moved = 0;
      for (const item of plan.batch) {
        if (stopped) break;
        progress({ moved, total: plan.batch.length, name: item.name });
        await new Promise(resolve => setTimeout(resolve, 550));
        item.owner = plan.target.id; item.ownerName = plan.target.name;
        plan.target.occupied[item.bucket]++; moved++;
        progress({ moved, total: plan.batch.length, name: item.name, completedId: item.id, snapshot: structuredClone(snap) });
      }
      return { moved, stopped, snapshot: structuredClone(snap) };
    },
    stop: async () => { stopped = true; },
    search: async () => { throw new Error('This preview does not connect to DIM. Install the extension to use this feature.'); },
    sync: async () => { throw new Error('This demo uses sample ranks. Live syncing is available in the extension.'); },
    onProgress: callback => { progress = callback; }
  };
  mountVaultCleaner(document.getElementById('app'), '../panel.css', adapter, true);
})();
