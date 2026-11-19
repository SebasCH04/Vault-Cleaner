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
test('Cleaning uses the best available rank instead of the equipped one', () => {
  const rescued = {[id]:{grade:'D',currentGrade:'D',bestGrade:'A',at:now}};
  assert.equal(C.gradeFor(base,rescued),'A');
  assert.ok(!C.eligible(base,rescued,['C','D','F']));
  assert.ok(C.eligible(base,rescued,['A']));
  const stillLow = {[id]:{grade:'F',currentGrade:'F',bestGrade:'C+',at:now}};
  assert.ok(C.eligible(base,stillLow,['C']));
  assert.ok(!C.eligible(base,stillLow,['F']));
});
test('Missing maximum, legacy notes and higher rank warnings stay protected', () => {
  for (const record of [{grade:'D',at:now},{grade:'F',higherRankPossible:true,at:now}]) {
    assert.ok(!C.eligible(base,{[id]:record},['C','D','F']));
    assert.ok(C.reasons(base,{[id]:record}).some(reason=>/máximo/i.test(reason)));
  }
});
test('Contradictory maximum below the current rank is rejected, including plus/minus', () => {
  for (const [currentGrade,bestGrade] of [['A','D'],['C+','C-'],['S+','S']]) {
    const records = {[id]:{grade:bestGrade,currentGrade,bestGrade,at:now}};
    assert.equal(C.gradeDetails(base,records).best,null);
    assert.ok(!C.eligible(base,records,['S','A','B','C','D','F']));
  }
});
test('A confirmed Best Available note works without guessing an equipped rank', () => {
  const records = {[id]:{grade:'D+',basis:'best',bestGrade:'D+',at:now}};
  assert.equal(C.gradeDetails(base,records).current,null);
  assert.ok(C.eligible(base,records,['D']));
});
test('Batch planning excludes a selected D that can reach A', () => {
  const records = {[id]:{grade:'D',currentGrade:'D',bestGrade:'A',at:now}};
  const target={id:'c',capacity:{energy:10},occupied:{energy:1}};
  assert.equal(C.planBatch([base],records,[id],target,['D'],9,true).batch.length,0);
});
test('Best-only copies with alternative perks stay visible as pending checks',()=>{
 const records={[id]:{grade:'A',bestGrade:'A',basis:'best',at:now}};
 assert.equal(C.improvementFor({...base,alternativePerks:true},records),'check');
 assert.equal(C.improvementFor({...base,alternativePerks:false},records),'none');
 assert.equal(C.improvementFor(base,{[id]:{...records[id],currentGrade:'D'}}),'improvable');
 assert.equal(C.improvementFor(base,{[id]:{...records[id],currentGrade:'A'}}),'none');
});
test('Refreshing a current rank does not extend the lifetime of an old maximum',()=>{
 const records={[id]:{grade:'D',currentGrade:'D',currentAt:now,bestGrade:'A',bestAt:now-C.MAX_GRADE_AGE-1,at:now}};
 assert.equal(C.gradeDetails(base,records).best,null);
 assert.equal(C.eligible(base,records,['D']),false);
});
