const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../core.js');
const ranks=['S','A','B','C','D','F'];
const item=(n,changes={},data={})=>({id:String(6917530200400000000n+BigInt(n)),hash:900,weapon:true,owner:'vault',
  locked:false,equipped:false,bucket:'kinetic',power:550,...changes,
  weaponData:{complete:true,tier:0,adept:false,holofoil:false,element:1,masterwork:5,masterworkType:'Range',features:'standard mods',
    base:[[1,50],[2,35]],columns:Array.from({length:5},(_,index)=>({index,type:index+100,category:index+200,
      options:[{hash:index+300,name:'Perk '+index}]})),...data}});
const grades=(items,letter='S')=>Object.fromEntries(items.map(i=>[i.id,{grade:letter,bestGrade:letter,currentGrade:'C',at:Date.now()}]));
const target={id:'hunter',capacity:{kinetic:10,energy:10,power:10},occupied:{kinetic:1,energy:1,power:1}};
test('S duplicates retain one stable anchor; a C with maximum S stays outside rank cleanup',()=>{
  const items=[item(1),item(2),item(3)],g=grades(items),a=C.weaponAnalysis(items,g);
  assert.equal(a.records[items[0].id].state,'keep');
  for(const i of items.slice(1))assert.equal(a.records[i.id].keeperId,items[0].id);
  const plan=C.planBatch(items,g,items.map(i=>i.id),target,ranks,9,false,'duplicates');
  assert.deepEqual(plan.batch.map(i=>i.id),items.slice(1).map(i=>i.id));assert.deepEqual(plan.keeperIds,[items[0].id]);
  assert.equal(C.planBatch(items,g,items.map(i=>i.id),target,['C','D','F']).batch.length,0);
});
test('A higher maximum alone never discards another perk roll',()=>{
  const a=item(1),b=item(2,{}, {columns:item(2).weaponData.columns.map(c=>c.index===4 ? {...c,options:[{hash:999}]} : c)});
  const g=grades([a,b]);g[b.id].bestGrade='F';g[b.id].currentGrade='F';
  assert.ok(Object.values(C.weaponAnalysis([a,b],g).records).every(r=>r.state==='keep'));
});
test('A retained copy must cover every option in every corresponding column, including unselected perks',()=>{
  const small=item(1),large=item(2,{}, {columns:item(2).weaponData.columns.map(c=>c.index===3 ? {...c,options:[...c.options,{hash:998}]} : c)});
  const g=grades([small,large]),a=C.weaponAnalysis([small,large],g);
  assert.equal(a.records[small.id].keeperId,large.id);assert.equal(a.records[large.id].state,'keep');
  const third=item(3,{}, {columns:item(3).weaponData.columns.map(c=>c.index===4 ? {...c,options:[...c.options,{hash:999}]} : c)});
  assert.equal(C.weaponAnalysis([small,large,third],grades([small,large,third])).records[third.id].state,'keep');
});
test('Lower confirmed maxima cannot replace better-ranked copies, including plus and minus ranks',()=>{
  const small=item(1),large=item(2,{}, {columns:item(2).weaponData.columns.map(c=>({...c,options:[...c.options,{hash:1000+c.index}]}))});
  const g=grades([small,large]);g[small.id].bestGrade='S+';g[large.id].bestGrade='S-';
  assert.ok(Object.values(C.weaponAnalysis([small,large],g).records).every(r=>r.state==='keep'));
});
test('Missing, stale, future and conflicting maxima on either side prevent duplicate recommendations',()=>{
  const items=[item(1),item(2)];
  for(const index of [0,1])for(const delta of [{bestGrade:null},{bestAt:Date.now()-C.MAX_GRADE_AGE-1000},{at:Date.now()+70000},{bestGrade:'F',currentGrade:'S'}]){
    const g=grades(items);Object.assign(g[items[index].id],delta);
    assert.ok(Object.values(C.weaponAnalysis(items,g).records).every(r=>r.state!=='duplicate'));
  }
});
test('Different masterworks, tiers, adept/holofoil variants, mod access, frame stats and item hashes are kept',()=>{
  const first=item(1);
  const items=[first,...[{masterworkType:'Stability'},{tier:5},{adept:true},{holofoil:true},{features:'artifice mod'},
    {base:[[1,51],[2,34]]},{element:2}].map((delta,n)=>item(n+2,{},delta)),item(20,{hash:901}),item(21,{bucket:'energy'})];
  assert.ok(Object.values(C.weaponAnalysis(items,grades(items)).records).every(r=>r.state==='keep'));
});
test('Power and existing masterwork investment may not be lost',()=>{
  const low=item(1),high=item(2,{power:551},{masterwork:4}),g=grades([low,high]);
  assert.ok(Object.values(C.weaponAnalysis([low,high],g).records).every(r=>r.state==='keep'));
  const invested=item(3,{}, {masterwork:10}),a=C.weaponAnalysis([low,invested],grades([low,invested]));
  assert.equal(a.records[low.id].keeperId,invested.id);
});
test('Weapon cleanup protections remain; character-held protected copies can anchor duplicates',()=>{
  for(const delta of [{locked:true},{locked:undefined},{tag:'favorite'},{tag:'keep'},{tag:'archive'},{inLoadout:true},
    {exotic:true},{crafted:true},{deepsight:true},{equipped:true},{postmaster:true},{notransfer:true}]){
    const kept=item(1,delta),other=item(2),a=C.weaponAnalysis([kept,other],grades([kept,other]));
    assert.equal(a.records[kept.id].state,'protected');
  }
  const kept=item(1,{locked:true,owner:'hunter',equipped:true}),dupe=item(2);
  assert.equal(C.weaponAnalysis([kept,dupe],grades([kept,dupe])).records[dupe.id].keeperId,kept.id);
});
test('Postmaster, unknown equipment and incomplete metadata cannot supply a replacement',()=>{
  for(const changes of [{postmaster:true},{notransfer:true},{equipped:undefined}]){
    const items=[item(1,changes),item(2)];assert.equal(C.weaponAnalysis(items,grades(items)).records[items[1].id].state,'keep');
  }
  for(const delta of [{complete:false},{masterwork:null},{columns:[]},{masterworkType:''},{adept:undefined}]){
    const items=[item(1,{},delta),item(2)],a=C.weaponAnalysis(items,grades(items));
    assert.equal(a.records[items[0].id].state,'review');assert.equal(a.records[items[1].id].state,'keep');
  }
});
test('Duplicate batches honor rank filters, sizing and capacity without selecting retained copies',()=>{
  const items=['kinetic','energy','power'].flatMap((bucket,j)=>Array.from({length:12},(_,n)=>item(j*100+n,{bucket,hash:900+j}))),g=grades(items),ids=items.map(i=>i.id);
  const per=C.planBatch(items,g,ids,target,ranks,9,false,'duplicates','slot');
  assert.equal(per.batch.length,27);assert.ok(per.batch.every(i=>!per.keeperIds.includes(i.id)));
  assert.equal(C.planBatch(items,g,ids,target,ranks,9,false,'duplicates','total').batch.length,9);
  assert.equal(C.planBatch(items,g,ids,target,['F'],9,false,'duplicates','total').batch.length,0);
  assert.equal(C.planBatch(items,g,ids,target,ranks,27,true,'duplicates','total').batch.length,24);
});
