const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../core.js');
const id = '6917530200300167753';
const now = Date.now();
const base = { id, weapon:true, owner:'vault', locked:false, equipped:false, bucket:'energy' };
const grades = { [id]:{grade:'D',bestGrade:'D',at:now} };
test('Instance IDs remain exact strings; numbers and hashes are rejected', () => {
  assert.equal(C.normalizeId(id),id); assert.equal(C.normalizeId(Number(id)),null); assert.equal(C.normalizeId('1648948519'),null);
});
test('Grades require a complete valid value, never a letter inside a word', () => {
  for (const bad of ['God Roll','Bad','Good','Average',1,'']) assert.equal(C.normalizeGrade(bad),null);
  assert.equal(C.normalizeGrade(' d+ '),'D+');
});
test('JSON capture handles wrapped instance grades without evaluating hashes', () => {
  const data={data:{weapons:[{itemInstanceId:id,quality:'C+'},{id:'1648948519',grade:'F'}]}};
  assert.deepEqual({...C.extractGrades(data)},{[id]:'C+'});
  assert.equal(Object.keys(C.extractGrades([{id:Number(id),grade:'D'}])).length,0);
});
test('Extract keyed grade dictionaries', () => { assert.equal(C.extractGrades({[id]:{grade:'A'}})[id],'A'); });
test('C D F eligibility requires the exact copy and a fresh grade', () => {
  assert.ok(C.eligible(base,grades,['D'])); assert.ok(!C.eligible(base,grades,['C']));
  assert.ok(!C.eligible({...base,id:'6917530200300167754'},grades,['D']));
  assert.equal(C.gradeFor(base,{[id]:{grade:'F',at:now-C.MAX_GRADE_AGE-1}},now),null);
});
test('Future timestamps and ungraded items are excluded', () => {
  assert.equal(C.gradeFor(base,{[id]:{grade:'F',at:now+100000}},now),null);
  assert.ok(!C.eligible(base,{},['F']));
});
for (const [field,value] of [['locked',true],['equipped',true],['inLoadout',true],['crafted',true],['exotic',true],['deepsight',true],['notransfer',true],['postmaster',true],['tag','favorite'],['tag','keep'],['tag','archive'],['owner','character']]) {
  test(`Protect ${field}=${value}`,()=>assert.ok(!C.eligible({...base,[field]:value},grades,['D'])));
}
test('Unknown lock and equipment states fail closed', () => {
  assert.ok(!C.eligible({...base,locked:undefined},grades,['D']));
  assert.ok(!C.eligible({...base,equipped:undefined},grades,['D']));
});
test('Space accounting does not overfill individual buckets', () => {
  const items = Array.from({length:5},(_,i)=>({...base,id:String(BigInt(id)+BigInt(i))}));
  const g=Object.fromEntries(items.map(i=>[i.id,{grade:'F',bestGrade:'F',at:now}]));
  const target={id:'c',isVault:false,capacity:{energy:10},occupied:{energy:8}};
  assert.equal(C.planBatch(items,g,items.map(i=>i.id),target,['F'],9,true).batch.length,1);
  assert.equal(C.planBatch(items,g,items.map(i=>i.id),target,['F'],9,false).batch.length,2);
  assert.equal(C.planBatch(items,g,items.map(i=>i.id),{...target,occupied:{energy:10}},['F'],9,false).batch.length,0);
});
test('Unknown capacities do not permit transfers', () => {
  assert.equal(C.planBatch([base],grades,[id],{id:'c',capacity:{},occupied:{}},['D']).batch.length,0);
});
test('Search uses instance IDs and rejects injected syntax', () => {
  assert.equal(C.exactSearch([id,id,'0) or is:weapon']),`(id:${id})`);
  assert.throws(()=>C.exactSearch([]));
});
test('A C that can reach S is classified as S and excluded from C/D/F cleaning', () => {
  const records={[id]:{grade:'C',currentGrade:'C',bestGrade:'S',at:now}};
  assert.equal(C.gradeFor(base,records),'S');
  assert.ok(!C.eligible(base,records,['C','D','F']));
  assert.ok(C.eligible(base,records,['S']));
});
test('An unconfirmed displayed C is protected until the maximum is known', () => {
  const records={[id]:{grade:'C',basis:'displayed',at:now}};
  assert.ok(!C.eligible(base,records,['C']));
  assert.ok(C.reasons(base,records).some(reason=>/maximum/i.test(reason)));
});
test('A confirmed Best Available capture works without inventing a current rank', () => {
  const records={[id]:{grade:'D+',bestGrade:'D+',basis:'best',at:now}};
  assert.equal(C.gradeDetails(base,records).current,null);
  assert.ok(C.eligible(base,records,['D']));
});
test('Current and maximum timestamps expire separately', () => {
  const records={[id]:{grade:'C',currentGrade:'C',currentAt:now,bestGrade:'S',bestAt:now-C.MAX_GRADE_AGE-1,at:now}};
  assert.equal(C.gradeDetails(base,records).best,null);
  assert.ok(!C.eligible(base,records,['C']));
});
test('Contradictory maxima and plus/minus ordering do not permit cleaning', () => {
  for(const [currentGrade,bestGrade] of [['S','C'],['C+','C-']]) {
    const records={[id]:{grade:bestGrade,currentGrade,bestGrade,at:now}};
    assert.equal(C.gradeDetails(base,records).best,null);
    assert.ok(!C.eligible(base,records,['S','C']));
  }
});
const buckets=['kinetic','energy','power'];
const many=buckets.flatMap((bucket,j)=>Array.from({length:12},(_,i)=>({...base,bucket,id:String(BigInt(id)+BigInt(j*100+i))})));
const manyGrades=Object.fromEntries(many.map(item=>[item.id,{grade:'F',bestGrade:'F',at:now}]));
const roomy={id:'c',capacity:{kinetic:10,energy:10,power:10},occupied:{kinetic:1,energy:1,power:1}};
test('A full batch holds 9 per slot and 27 total even when grouped by slot', () => {
  const plan=C.planBatch(many,manyGrades,many.map(i=>i.id),roomy,['F'],9,false);
  assert.equal(plan.batch.length,27);assert.deepEqual(plan.counts,{kinetic:9,energy:9,power:9});
  assert.equal(plan.skipped.length,9);
});
test('A smaller per-slot limit applies independently to all three slots', () => {
  const plan=C.planBatch(many,manyGrades,many.map(i=>i.id),roomy,['F'],3,false);
  assert.equal(plan.batch.length,9);assert.deepEqual(plan.counts,{kinetic:3,energy:3,power:3});
});
test('A total limit of 9 means 9 weapons, rather than 9 from each slot', () => {
  const plan=C.planBatch(many,manyGrades,many.map(i=>i.id),roomy,['F'],9,false,'clean','total');
  assert.equal(plan.batch.length,9);
  assert.deepEqual(plan.counts,{kinetic:9});
  assert.equal(plan.skipped.length,27);
});
test('Total batches can mix slots while preserving the selected copies', () => {
  const mixed=Array.from({length:12},(_,i)=>buckets.map(bucket=>many.find(item=>item.bucket===bucket && item.id===String(BigInt(id)+BigInt(buckets.indexOf(bucket)*100+i))))).flat();
  const selected=mixed.slice(0,7).map(item=>item.id);
  const plan=C.planBatch(mixed,manyGrades,selected,roomy,['F'],5,false,'clean','total');
  assert.deepEqual(plan.batch.map(item=>item.id),selected.slice(0,5));
  assert.deepEqual(plan.counts,{kinetic:2,energy:2,power:1});
});
test('A full slot does not stop a total batch from filling other slots', () => {
  const target={...roomy,occupied:{kinetic:10,energy:6,power:2}};
  const plan=C.planBatch(many,manyGrades,many.map(i=>i.id),target,['F'],9,false,'clean','total');
  assert.equal(plan.batch.length,9);assert.deepEqual(plan.counts,{energy:4,power:5});
});
test('A total limit of 27 still respects each slot and extra reserve', () => {
  const plan=C.planBatch(many,manyGrades,many.map(i=>i.id),roomy,['F'],27,true,'clean','total');
  assert.equal(plan.batch.length,24);assert.deepEqual(plan.counts,{kinetic:8,energy:8,power:8});
});
test('A manual total batch limits ungraded selected weapons', () => {
  const selected=many.filter((_,i)=>[0,14,29].includes(i)).map(item=>item.id);
  const plan=C.planBatch(many,{},selected,roomy,[],2,false,'manual','total');
  assert.deepEqual(plan.batch.map(item=>item.id),selected.slice(0,2));
  assert.deepEqual(plan.counts,{kinetic:1,energy:1});
});
test('Existing inventory limits each slot and a full slot does not block other slots', () => {
  const target={...roomy,occupied:{kinetic:10,energy:6,power:2}};
  const plan=C.planBatch(many,manyGrades,many.map(i=>i.id),target,['F'],9,false);
  assert.equal(plan.batch.length,12);assert.deepEqual(plan.counts,{energy:4,power:8});
});
test('The optional extra reserve reduces a clear inventory to 8 per slot', () => {
  const plan=C.planBatch(many,manyGrades,many.map(i=>i.id),roomy,['F'],9,true);
  assert.equal(plan.batch.length,24);assert.deepEqual(plan.counts,{kinetic:8,energy:8,power:8});
});
test('Manual transfer allows S, ungraded and cleanup-protected weapons', () => {
  const protectedItem={...base,locked:true,tag:'favorite',inLoadout:true,crafted:true,exotic:true};
  assert.equal(C.canSelect(protectedItem,{},['F'],'manual'),true);
  assert.equal(C.canSelect(protectedItem,{},['F'],'clean'),false);
  const records={[id]:{grade:'S',bestGrade:'S',at:now}};
  assert.equal(C.canSelect(base,records,['F'],'manual'),true);
  assert.equal(C.canSelect(base,records,['F'],'clean'),false);
});
test('Manual transfer still rejects unavailable copies and non-weapons', () => {
  for(const change of [{owner:'character'},{weapon:false},{notransfer:true},{postmaster:true},{equipped:true},{equipped:undefined}]) {
    assert.equal(C.canSelect({...base,...change},{},[],'manual'),false);
  }
});
test('Manual plans include only the exact copies selected and respect slot capacity', () => {
  const picked=many.filter((_,i)=>i===0 || i===14 || i===29).map(item=>item.id);
  const plan=C.planBatch(many,{},picked,roomy,[],9,false,'manual');
  assert.deepEqual(plan.batch.map(item=>item.id),picked);
  assert.deepEqual(plan.counts,{kinetic:1,energy:1,power:1});
});
