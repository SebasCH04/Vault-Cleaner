const {test} = require('node:test');
const assert = require('node:assert/strict');
const C = require('../core.js');
const item = (n, changes={}) => ({id:String(6917530200300900000n+BigInt(n)),hash:600,armor:true,weapon:false,
  owner:'vault',locked:false,equipped:false,bucket:C.ARMOR_SLOTS[0],power:550,
  armorData:{complete:true,classType:1,tier:4,setHash:100,setName:'Set A',archetypeHash:200,
    base:[30,0,0,20,25,0],potential:[30,5,5,20,25,5],masterwork:0,features:'mods+tuning-A'},...changes});
const data = (n, changes)=>item(n,{armorData:{...item(n).armorData,...changes}});
const exotic = (n, changes={}, armorChanges={})=>item(n,{exotic:true,hash:700,...changes,
  armorData:{...item(n).armorData,generation:3,tier:0,setHash:null,setName:'',exoticPerks:[[4,777]],...armorChanges}});
const target = {id:'hunter',classType:1,capacity:Object.fromEntries(C.ARMOR_SLOTS.map(b=>[b,10])),occupied:Object.fromEntries(C.ARMOR_SLOTS.map(b=>[b,1]))};
test('Identical copies keep one deterministic anchor; all discarded copies point to it',()=>{
  const items=[item(1),item(2),item(3)]; const a=C.armorAnalysis(items);
  assert.equal(a.records[items[0].id].state,'keep');
  for(const i of items.slice(1)) {assert.equal(a.records[i.id].state,'duplicate');assert.equal(a.records[i.id].keeperId,items[0].id);}
  const plan=C.planBatch(items,{},items.map(i=>i.id),target,[],9,false,'clean','slot','armor');
  assert.deepEqual(plan.batch.map(i=>i.id),items.slice(1).map(i=>i.id));assert.deepEqual(plan.keeperIds,[items[0].id]);
});
test('A protected character-held equivalent serves as the retained copy',()=>{
  const kept=item(1,{owner:'hunter',locked:true,equipped:true}), duplicate=item(2);
  const a=C.armorAnalysis([duplicate,kept]);
  assert.equal(a.records[kept.id].state,'protected');assert.equal(a.records[duplicate.id].keeperId,kept.id);
});
test('Strict improvements are compared stat by stat, not by total',()=>{
  const better=item(1), lower=data(2,{base:[28,0,0,18,24,0]});
  const alternative=data(3,{base:[31,0,0,19,25,0]});
  const a=C.armorAnalysis([better,lower,alternative]);
  assert.equal(a.records[lower.id].state,'duplicate');assert.equal(a.records[better.id].state,'keep');assert.equal(a.records[alternative.id].state,'keep');
});
test('Distinct tuning, tier, archetype, tertiary stat, set, class, slot and item definitions stay separate',()=>{
  const changes=[{features:'other tuning'},{tier:5},{archetypeHash:201},{base:[30,20,0,0,25,0]},{setHash:101},{classType:0}];
  const items=[item(1),...changes.map((a,index)=>data(index+2,a)),item(20,{hash:601}),item(21,{bucket:C.ARMOR_SLOTS[1]})];
  const a=C.armorAnalysis(items);assert.ok(Object.values(a.records).every(r=>r.state==='keep'));
});
test('Unknown and legacy data never become cleanup candidates',()=>{
  for(const delta of [{complete:false},{base:[30,null,0,20,25,0]},{classType:null},{setHash:null},{features:''},{tier:null},{masterwork:null}]) {
    const unknown=data(2,delta);assert.equal(C.armorAnalysis([item(1),unknown]).records[unknown.id].state,'review');
  }
  const invalid=item(2,{id:'600'});assert.equal(C.armorAnalysis([item(1),invalid]).records[invalid.id].state,'review');
});
test('Locks, favorites, loadouts, unknown states and special locations remain protected',()=>{
  for(const delta of [{locked:true},{locked:undefined},{tag:'favorite'},{tag:'keep'},{tag:'archive'},{inLoadout:true},{equipped:true},{equipped:undefined},{postmaster:true},{notransfer:true}]) {
    const protectedItem=item(2,delta);assert.equal(C.armorAnalysis([item(1),protectedItem]).records[protectedItem.id].state,'protected');
  }
});
test('Setless exotics, including untiered Armor 3.0, keep one copy and admit only verified redundant rolls',()=>{
  for(const tier of [0,5]) {
    const kept=exotic(1,{}, {tier}),same=exotic(2,{}, {tier}),lower=exotic(3,{}, {tier,base:[28,0,0,18,23,0]});
    const items=[lower,same,kept],a=C.armorAnalysis(items);
    assert.equal(a.records[kept.id].state,'keep');
    for(const i of [same,lower]) assert.equal(a.records[i.id].keeperId,kept.id);
    assert.equal(a.sets.length,0);
    const plan=C.planBatch(items,{},items.map(i=>i.id),target,[],9,false,'clean','slot','armor');
    assert.deepEqual(plan.batch.map(i=>i.id),[lower.id,same.id]);assert.deepEqual(plan.keeperIds,[kept.id]);
  }
});
test('Exotic archetypes, tuning, intrinsic perks and tradeoff rolls remain separate',()=>{
  const kept=exotic(1),variants=[exotic(2,{}, {archetypeHash:201}),exotic(3,{}, {features:'different tuning'}),
    exotic(4,{}, {exoticPerks:[[4,778]]}),exotic(5,{}, {base:[31,0,0,19,25,0]}),exotic(6,{hash:701}),
    exotic(7,{}, {tier:5}),exotic(8,{}, {base:[30,20,0,0,25,0]})];
  assert.ok(Object.values(C.armorAnalysis([kept,...variants]).records).every(r=>r.state==='keep'));
});
test('Exotic class-item perk combinations require both verified perks',()=>{
  const opts={bucket:C.ARMOR_SLOTS[4]},perks=[[4,777],[5,888]];
  const kept=exotic(1,opts,{exoticPerks:perks}),duplicate=exotic(2,opts,{exoticPerks:perks});
  const variant=exotic(3,opts,{exoticPerks:[[4,777],[5,889]]}),incomplete=exotic(4,opts,{exoticPerks:[[4,777]]});
  const a=C.armorAnalysis([kept,duplicate,variant,incomplete]);
  assert.equal(a.records[duplicate.id].keeperId,kept.id);assert.equal(a.records[variant.id].state,'keep');
  assert.equal(a.records[incomplete.id].state,'review');
});
test('Exotic locks and loadouts remain protected and can anchor redundant unlocked vault copies',()=>{
  for(const delta of [{locked:true},{tag:'favorite'},{inLoadout:true},{owner:'hunter',equipped:true}]) {
    const kept=exotic(1,delta),same=exotic(2),a=C.armorAnalysis([same,kept]);
    assert.equal(a.records[kept.id].state,'protected');assert.equal(a.records[same.id].keeperId,kept.id);
  }
});
test('Legacy or incomplete exotic metadata stays in Review and cannot justify dismantling a copy',()=>{
  for(const delta of [{generation:2},{complete:false},{exoticPerks:[]},{exoticPerks:[[4,null]]},{tier:null},{archetypeHash:null}]) {
    const unknown=exotic(2,{},delta),kept=exotic(1),a=C.armorAnalysis([kept,unknown]);
    assert.equal(a.records[unknown.id].state,'review');assert.equal(a.records[kept.id].state,'keep');
  }
});
test('Postmaster and non-transferable copies cannot be the surviving replacement',()=>{
  const sole=item(2);
  for(const delta of [{postmaster:true},{notransfer:true},{equipped:undefined}]) {
    const a=C.armorAnalysis([item(1,delta),sole]);assert.equal(a.records[sole.id].state,'keep');
  }
});
test('Highest Power and masterwork investment are retained',()=>{
  const low=item(1,{power:549}),high=item(2,{power:550});
  assert.equal(C.armorAnalysis([low,high]).records[high.id].state,'keep');
  const invested=data(2,{base:[28,0,0,18,23,0],masterwork:5});
  assert.equal(C.armorAnalysis([item(1),invested]).records[invested.id].state,'keep');
});
test('Complete and incomplete sets preserve their distinct slots after cleanup',()=>{
  const items=C.ARMOR_SLOTS.flatMap((bucket,index)=>[item(index*2,{bucket,hash:600+index}),item(index*2+1,{bucket,hash:600+index})]);
  items.push(data(20,{setHash:101}));
  const a=C.armorAnalysis(items);assert.equal(a.sets[0].slots.length,5);assert.equal(a.sets[0].retained.length,5);assert.equal(a.sets[1].retained.length,1);
  const plan=C.planBatch(items,{},items.map(i=>i.id),target,[],9,false,'clean','slot','armor');
  assert.equal(plan.batch.length,5);assert.ok(plan.batch.every(i=>!plan.keeperIds.includes(i.id)));
});
test('Armor batches use five slots: 45 per slot, or a single total limit',()=>{
  const items=C.ARMOR_SLOTS.flatMap((bucket,index)=>Array.from({length:12},(_,n)=>item(index*100+n,{bucket,hash:600+index})));
  const ids=items.map(i=>i.id);
  assert.equal(C.planBatch(items,{},ids,target,[],9,false,'clean','slot','armor').batch.length,45);
  assert.equal(C.planBatch(items,{},ids,target,[],9,false,'clean','total','armor').batch.length,9);
  assert.equal(C.planBatch(items,{},ids,target,[],45,false,'clean','total','armor').batch.length,45);
  assert.equal(C.planBatch(items,{},ids,target,[],45,true,'clean','total','armor').batch.length,40);
});
test('Armor cannot cross class or unknown target class; weapons keep their original mode',()=>{
  const items=[item(1),item(2)];
  for(const classType of [0,2,null]) assert.equal(C.planBatch(items,{},[items[1].id],{...target,classType},[],9,false,'clean','slot','armor').batch.length,0);
  assert.equal(C.planBatch(items,{},items.map(i=>i.id),target,[],9,false,'manual','slot').batch.length,0);
});
test('Manual armor transfer is explicit and still obeys class, slot capacity and location',()=>{
  const exotic=item(1,{exotic:true,locked:true}),postmaster=item(2,{postmaster:true});
  assert.equal(C.planBatch([exotic,postmaster],{},[exotic.id,postmaster.id],target,[],9,false,'manual','slot','armor').batch.length,1);
  assert.equal(C.planBatch([exotic],{},[exotic.id],{...target,occupied:{[exotic.bucket]:10}},[],9,false,'manual','slot','armor').batch.length,0);
});
