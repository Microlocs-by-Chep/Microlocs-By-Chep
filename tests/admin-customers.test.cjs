const {test}=require('node:test');const assert=require('node:assert/strict');
const id='00000000-0000-0000-0000-000000000002';let calendarReads=0,calendarUnavailable=false;
const calendarPath=require.resolve('../api/_calendar');
const event=(email,extra={})=>({id:email,summary:'Retie — Test client',description:`Customer: Test client\nEmail: ${email}\nService: Retie\nComplimentary drink: Tea\nColour: Copper`,start:{dateTime:'2026-01-12T05:00:00Z'},end:{dateTime:'2026-01-12T08:00:00Z'},...extra});
require.cache[calendarPath]={id:calendarPath,filename:calendarPath,loaded:true,exports:{eventsBetween:async()=>{calendarReads++;if(calendarUnavailable)throw new Error("Google Calendar is not connected yet");return [event('CLIENT@example.com'),event('other@example.com'),event('client@example.com',{extendedProperties:{private:{kind:'unavailability'}}})]},assignedEmployee:()=> 'Chep'}};
const handler=require('../api/admin-customers');
const profile={user_id:id,email:'client@example.com',full_name:'Test Client',phone:'0700000000',birthday:'1990-01-01',reminder_weeks:6};
async function request(query={},options={}){
 const previous=global.fetch;let rpc;calendarUnavailable=Boolean(options.calendarUnavailable);
 global.fetch=async(url,init)=>{
  if(url.includes('/auth/v1/user'))return {ok:true,json:async()=>({id:'test-admin'})};
  if(url.includes('/rest/v1/admin_users'))return {ok:true,json:async()=>options.nonAdmin?[]:[{user_id:'test-admin'}]};
  rpc=JSON.parse(init.body);assert.equal(init.headers.Authorization,'Bearer local-test');
  return {ok:!options.missingMigration,json:async()=>options.missingMigration?{code:'PGRST202'}:(options.profiles||[profile])};
 };
 const res={setHeader(name,value){this.headers={...this.headers,[name]:value}},status(code){this.code=code;return this},json(body){this.body=body;return this}};
 try{await handler({method:options.method||'GET',query,headers:options.unsigned?{}:{authorization:'Bearer local-test'}},res);return {...res,rpc}}finally{global.fetch=previous;calendarUnavailable=false}
}
test('customer list is admin-only and never loads calendar data',async()=>{
 const before=calendarReads;let res=await request();assert.equal(res.code,200);assert.equal(res.body.customers[0].email,profile.email);assert.equal(res.headers['Cache-Control'],'no-store');assert.equal(calendarReads,before);
 assert.equal((await request({}, {unsigned:true})).code,401);assert.equal((await request({}, {nonAdmin:true})).code,401);assert.equal((await request({}, {method:'POST'})).code,405);
});
test('customer search and pagination send bounded arguments to the database',async()=>{
 const res=await request({search:' Client ',page:'2'},{profiles:Array.from({length:51},()=>profile)});assert.equal(res.code,200);assert.equal(res.body.customers.length,50);assert.equal(res.body.hasMore,true);assert.deepEqual(res.rpc,{p_search:'Client',p_offset:100,p_user_id:null});
 for(const query of [{search:'x'.repeat(101)},{page:'-1'},{id:'not-a-uuid'}])assert.equal((await request(query)).code,400);
});
test('customer detail includes only matching bookings with drink and options',async()=>{
 const res=await request({id});assert.equal(res.code,200);assert.equal(res.body.customer.user_id,id);assert.equal(res.body.appointments.length,1);assert.equal(res.body.appointments[0].beverage,'Tea');assert.match(res.body.appointments[0].booking_notes,/Colour: Copper/);assert.equal(res.body.points,100);assert.equal(res.rpc.p_user_id,id);
});
test('missing account and unapplied database update give explicit outcomes',async()=>{
 assert.equal((await request({id},{profiles:[]})).code,404);
 const res=await request({}, {missingMigration:true});assert.equal(res.code,503);assert.match(res.body.error,/database update/);
});

test('profile remains visible when booking history cannot load',async()=>{
 const res=await request({id},{calendarUnavailable:true});assert.equal(res.code,200);assert.equal(res.body.customer.user_id,id);assert.equal(res.body.appointments,null);assert.equal(res.body.points,null);assert.match(res.body.historyError,/not connected/);
});
