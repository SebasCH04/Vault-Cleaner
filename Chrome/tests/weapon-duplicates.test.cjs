const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../core.js');
const ranks=['S','A','B','C','D','F'];
const item=(n,changes={})=>({id:String(6917530200400000000n+BigInt(n)),hash:900,name:'Example Rifle',weapon:true,owner:'vault',locked:false,equipped:false,bucket:'kinetic',power:550,...changes});
const grades=(items,letter='S')=>Object.fromEntries(items.map(i=>[i.id,{grade:letter,bestGrade:letter,currentGrade:letter,at:Date.now()}]));
const score=(g,i,value)=>Object.assign(g[i.id],{bestOverall:value,bestOverallGrade:g[i.id].bestGrade,bestOverallAt:Date.now()});
const target={id:'hunter',capacity:{kinetic:10,energy:10,power:10},occupied:{kinetic:1,energy:1,power:1}};
test('Duplicate ranking uses full rank order S+ > S > S- > A+ > A > A- and onward',()=>{
 const labels=['S+','S','S-','A+','A','A-','B+','B','B-','C+','C','C-','D+','D','D-','F+','F','F-'];
 const items=labels.map((_,n)=>item(n)),g=grades(items);items.forEach((i,n)=>Object.assign(g[i.id],{bestGrade:labels[n],currentGrade:labels[n]}));
 const a=C.weaponAnalysis(items,g);assert.equal(a.records[items[0].id].state,'keep');
 for(const i of items.slice(1))assert.equal(a.records[i.id].keeperId,items[0].id);
 const plan=C.planBatch(items,g,items.map(i=>i.id),target,ranks,27,false,'duplicates','total');
 assert.ok(plan.batch.every(i=>i.id!==items[0].id));assert.deepEqual(plan.keeperIds,[items[0].id]);
});
test('Different perks, incomplete sockets, masterwork, tier and Power do not block a lower-ranked copy',()=>{
 const kept=item(1,{power:540}),other=item(2,{power:550,weaponData:{complete:false,tier:5,masterworkType:'Stability',masterwork:10,features:'different'}});
 const g=grades([kept,other]);Object.assign(g[other.id],{bestGrade:'A',currentGrade:'A'});
 assert.equal(C.weaponAnalysis([kept,other],g).records[other.id].keeperId,kept.id);
});
test('Maximum S on a current C compares as S and stays outside C/D/F rank cleanup',()=>{
 const items=[item(1),item(2)],g=grades(items);g[items[0].id].currentGrade='C';Object.assign(g[items[1].id],{bestGrade:'A',currentGrade:'A'});
 assert.equal(C.weaponAnalysis(items,g).records[items[1].id].keeperId,items[0].id);
 assert.equal(C.planBatch(items,g,items.map(i=>i.id),target,['C','D','F']).batch.length,0);
});
test('Confirmed maximum Overall breaks ties only within the same exact rank',()=>{
 const items=[item(1),item(2),item(3)],g=grades(items,'A');[91.25,93.75,93.5].forEach((v,n)=>score(g,items[n],v));
 const a=C.weaponAnalysis(items,g);assert.equal(a.records[items[1].id].state,'keep');
 assert.equal(a.records[items[0].id].keeperId,items[1].id);assert.equal(a.records[items[2].id].keeperId,items[1].id);
 g[items[0].id].bestGrade=g[items[0].id].currentGrade='A+';score(g,items[0],10);
 assert.equal(C.weaponAnalysis(items,g).records[items[1].id].keeperId,items[0].id);
});
test('Equal maximum and Overall are not discarded until the user chooses a keeper',()=>{
 const items=[item(1),item(2),item(3)],g=grades(items);items.forEach(i=>score(g,i,95));
 const a=C.weaponAnalysis(items,g);assert.ok(Object.values(a.records).every(r=>r.state==='tie'));assert.equal(a.groups[0].needsChoice,true);
 assert.equal(C.planBatch(items,g,items.map(i=>i.id),target,ranks,9,false,'duplicates').batch.length,0);
 const choices={[C.weaponFamily(items[2])]:items[2].id},chosen=C.weaponAnalysis(items,g,Date.now(),choices);
 assert.equal(chosen.records[items[2].id].state,'keep');
 for(const i of items.slice(0,2))assert.equal(chosen.records[i.id].keeperId,items[2].id);
 const plan=C.planBatch(items,g,items.map(i=>i.id),target,ranks,9,false,'duplicates','slot','weapons',choices);
 assert.deepEqual(plan.batch.map(i=>i.id),items.slice(0,2).map(i=>i.id));assert.deepEqual(plan.keeperIds,[items[2].id]);
});
test('Missing Overall does not invent a winner and still admits strictly lower grades',()=>{
 const items=[item(1),item(2),item(3)],g=grades(items);Object.assign(g[items[2].id],{bestGrade:'A',currentGrade:'A'});
 const a=C.weaponAnalysis(items,g);assert.equal(a.records[items[0].id].state,'tie');assert.equal(a.records[items[1].id].state,'tie');assert.equal(a.records[items[2].id].state,'duplicate');
});
test('Known lower Overall is discarded with a verified anchor while missing scores remain unresolved',()=>{
 const items=[item(1),item(2),item(3)],g=grades(items);score(g,items[0],95);score(g,items[1],90);
 const a=C.weaponAnalysis(items,g);assert.equal(a.records[items[1].id].keeperId,items[0].id);
 assert.deepEqual(new Set(a.groups[0].contenderIds),new Set([items[0].id,items[2].id]));
 const choices={[C.weaponFamily(items[1])]:items[1].id};assert.equal(C.weaponAnalysis(items,g,Date.now(),choices).groups[0].keeperId,null);
});
test('Current Overall, expired Overall and scores bound to another maximum cannot break ties',()=>{
 const items=[item(1),item(2)];
 for(const delta of [{currentOverall:99,currentOverallGrade:'S',currentOverallAt:Date.now()},
  {bestOverall:99,bestOverallGrade:'S',bestOverallAt:Date.now()-C.MAX_GRADE_AGE-1},
  {bestOverall:99,bestOverallGrade:'A',bestOverallAt:Date.now()},
  {bestOverall:101,bestOverallGrade:'S',bestOverallAt:Date.now()}]){
  const g=grades(items);Object.assign(g[items[0].id],delta);assert.ok(Object.values(C.weaponAnalysis(items,g).records).every(r=>r.state==='tie'));
 }
});
test('Missing, stale, future and conflicting maxima cannot anchor or enter duplicate cleanup',()=>{
 const items=[item(1),item(2)];
 for(const index of [0,1])for(const delta of [{bestGrade:null},{bestAt:Date.now()-C.MAX_GRADE_AGE-1000},{at:Date.now()+70000},{bestGrade:'F',currentGrade:'S'}]){
  const g=grades(items);Object.assign(g[items[index].id],delta);assert.ok(Object.values(C.weaponAnalysis(items,g).records).every(r=>r.state!=='duplicate'));
 }
});
test('Same display name with different hashes or slots is not merged',()=>{
 const items=[item(1),item(2,{hash:901}),item(3,{bucket:'energy'})],g=grades(items);
 assert.ok(Object.values(C.weaponAnalysis(items,g).records).every(r=>r.state==='keep'));
});
test('Weapon cleanup protections remain even when a protected copy has a lower rank',()=>{
 for(const delta of [{locked:true},{locked:undefined},{tag:'favorite'},{tag:'keep'},{tag:'archive'},{inLoadout:true},{exotic:true},{crafted:true},{deepsight:true},{equipped:true},{postmaster:true},{notransfer:true}]){
  const items=[item(1),item(2,delta)],g=grades(items);Object.assign(g[items[1].id],{bestGrade:'A',currentGrade:'A'});
  assert.equal(C.weaponAnalysis(items,g).records[items[1].id].state,'protected');
 }
});
test('Character-held best copy can anchor vault copies; special locations and unknown states cannot',()=>{
 const held=item(1,{owner:'hunter',equipped:true,locked:true}),dupe=item(2),g=grades([held,dupe]);Object.assign(g[dupe.id],{bestGrade:'A',currentGrade:'A'});
 assert.equal(C.weaponAnalysis([held,dupe],g).records[dupe.id].keeperId,held.id);
 for(const delta of [{postmaster:true},{notransfer:true},{equipped:undefined}])assert.equal(C.weaponAnalysis([item(1,delta),dupe],g).records[dupe.id].state,'keep');
});
test('Saved choices are ignored if removed, lower-scoring or stale after new ranks arrive',()=>{
 const items=[item(1),item(2)],g=grades(items),key=C.weaponFamily(items[0]),choices={[key]:items[1].id};
 score(g,items[0],95);score(g,items[1],90);
 assert.equal(C.weaponAnalysis(items,g,Date.now(),choices).records[items[1].id].keeperId,items[0].id);
 assert.equal(C.weaponAnalysis([items[0]],g,Date.now(),choices).records[items[0].id].state,'keep');
});
test('Duplicate batches honor filters, all three slots, total sizing, capacity and manual ties',()=>{
 const items=['kinetic','energy','power'].flatMap((bucket,j)=>Array.from({length:12},(_,n)=>item(j*100+n,{bucket,hash:900+j}))),g=grades(items),ids=items.map(i=>i.id);
 const choices=Object.fromEntries(items.filter((_,n)=>n%12===0).map(i=>[C.weaponFamily(i),i.id]));
 const per=C.planBatch(items,g,ids,target,ranks,9,false,'duplicates','slot','weapons',choices);
 assert.equal(per.batch.length,27);assert.ok(per.batch.every(i=>!per.keeperIds.includes(i.id)));
 assert.equal(C.planBatch(items,g,ids,target,ranks,9,false,'duplicates','total','weapons',choices).batch.length,9);
 assert.equal(C.planBatch(items,g,ids,target,['F'],9,false,'duplicates','total','weapons',choices).batch.length,0);
 assert.equal(C.planBatch(items,g,ids,target,ranks,27,true,'duplicates','total','weapons',choices).batch.length,24);
});
test('Overall validation accepts 0, 100 and decimal percentages and rejects malformed values',()=>{
 for(const value of [0,100,95.25,'95.25%','95,25%'])assert.notEqual(C.normalizeOverall(value),null);
 for(const value of [null,undefined,-1,101,NaN,Infinity,'A 95%','95% 70%',''])assert.equal(C.normalizeOverall(value),null);
});
