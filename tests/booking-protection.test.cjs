const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
// Disposable local key only: every fetch in this file goes to the in-memory server.
process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL='local-test@example.com';
process.env.GOOGLE_PRIVATE_KEY=crypto.generateKeyPairSync('rsa',{modulusLength:1024}).privateKey.export({type:'pkcs8',format:'pem'});
delete process.env.RESEND_API_KEY;
const calendar=require('../api/_calendar');
const book=require('../api/book');
const attendant=require('../api/attendant-availability');
const availability=require('../api/availability');
const {remainingCapacity}=require('../api/_booking-availability');
const LOCK='microlocsbookinglock';
const base={name:'Local test',email:'test@example.com',phone:'0700000000',service:'Retie',employee:'Bree',duration:3,start:'2099-01-12T05:00:00Z',beverage:'Tea'};
const appointment=(employee,start,end)=>({id:crypto.randomUUID(),start:{dateTime:start},end:{dateTime:end},extendedProperties:{private:{employee}}});
function fakeGoogle(seed=[]){
 let events=new Map(seed.map(event=>[event.id,event])),sequence=0;
 const reply=(status,data)=>({ok:status>=200&&status<300,status,json:async()=>structuredClone(data)});
 const fetch=async(input,options={})=>{
  const url=new URL(input),method=options.method||'GET';
  if(url.hostname==='oauth2.googleapis.com')return reply(200,{access_token:'local-token'});
  const body=options.body&&JSON.parse(options.body);
  if(url.pathname==='/auth/v1/user')return reply(200,{id:'test-admin'});
  if(url.pathname==='/rest/v1/admin_users')return reply(200,[{user_id:'test-admin'}]);
  const id=decodeURIComponent(url.pathname.split('/events/')[1]||'');
  if(method==='GET'&&id)return events.has(id)?reply(200,events.get(id)):reply(404,{});
  if(method==='GET')return reply(200,{items:[...events.values()].filter(event=>new Date(event.start.dateTime)<new Date(url.searchParams.get('timeMax'))&&new Date(event.end.dateTime)>new Date(url.searchParams.get('timeMin')))});
  if(method==='POST'){
   const eventId=body.id||crypto.randomUUID();if(events.has(eventId))return reply(409,{});
   const event={...body,id:eventId,etag:String(++sequence)};events.set(eventId,event);return reply(200,event);
  }
  if(method==='PATCH'){
   const event=events.get(id);if(!event)return reply(404,{});
   assert.ok(options.headers['If-Match'],'lock writes must be conditional');
   if(options.headers['If-Match']!==event.etag)return reply(412,{});
   const updated={...event,...body,etag:String(++sequence)};events.set(id,updated);return reply(200,updated);
  }
  if(method==='DELETE'){events.delete(id);return reply(204,{})}
  throw new Error('Unexpected request '+method+' '+url.pathname);
 };
 return {fetch,events};
}
async function inCalendar(seed,run){const prior=global.fetch,fake=fakeGoogle(seed);global.fetch=fake.fetch;try{return await run(fake)}finally{global.fetch=prior}}
async function call(handler,method,body,query={},authenticated=true){const res={setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}};await handler({method,body,query,headers:authenticated?{authorization:'Bearer local-test'}:{}},res);return res}
test('concurrent same-attendant requests save exactly one appointment',async()=>{
 await inCalendar([],async fake=>{
  const responses=await Promise.all([call(book,'POST',base),call(book,'POST',base)]);
  assert.deepEqual(responses.map(res=>res.code).sort(),[201,409]);
  assert.equal([...fake.events.values()].filter(event=>event.id!==LOCK).length,1);
  assert.equal(fake.events.get(LOCK).extendedProperties.private.lockOwner,'');
 });
});
test('no more than two simultaneous appointments across attendants',async()=>{
 await inCalendar([],async fake=>{
  assert.equal((await call(book,'POST',base)).code,201);
  const results=await Promise.all(['Joan','Chep'].map(employee=>call(book,'POST',{...base,employee})));
  assert.deepEqual(results.map(res=>res.code).sort(),[201,409]);
  assert.equal([...fake.events.values()].filter(event=>event.id!==LOCK).length,2);
 });
});
test('unavailable attendant loses slots and bookings; others remain bookable; removal restores slots',async()=>{
 await inCalendar([],async fake=>{
  const body={employee:'Bree',start:'2099-01-12T05:00:00Z',end:'2099-01-12T18:00:00Z',reason:'Day off'};
  const saved=await call(attendant,'POST',body);assert.equal(saved.code,200);
  const query={date:'2099-01-12',duration:'3',employee:'Bree'};
  assert.equal((await call(availability,'GET',null,query)).body.slots.length,0);
  assert.equal((await call(book,'POST',base)).code,409);
  assert.equal((await call(book,'POST',{...base,employee:'Joan'})).code,201);
  const removed=await call(attendant,'DELETE',{...body,id:saved.body.id});assert.equal(removed.code,200);
  assert.ok((await call(availability,'GET',null,query)).body.slots.length>0);
 });
});
test('marking an attendant unavailable does not overwrite an existing appointment',async()=>{
 await inCalendar([],async()=>{
  assert.equal((await call(book,'POST',base)).code,201);
  const response=await call(attendant,'POST',{employee:'Bree',start:base.start,end:'2099-01-12T08:00:00Z'});
  assert.equal(response.code,409);assert.match(response.body.error,/already has a booking/);
 });
});
test('availability writes require an admin and removal cannot delete an ordinary booking',async()=>{
 const seed=appointment('Bree',base.start,'2099-01-12T08:00:00Z');
 await inCalendar([seed],async fake=>{
  const body={employee:'Bree',start:base.start,end:'2099-01-12T08:00:00Z',id:seed.id};
  assert.equal((await call(attendant,'POST',body,{},false)).code,401);
  assert.equal((await call(attendant,'DELETE',body)).code,404);assert.ok(fake.events.has(seed.id));
 });
});
test('peak capacity counts overlapping appointments, not successive appointments',()=>{
 const events=[appointment('Bree','2099-01-12T05:00:00Z','2099-01-12T06:00:00Z'),appointment('Joan','2099-01-12T06:00:00Z','2099-01-12T07:00:00Z')];
 assert.equal(remainingCapacity(events,new Date(base.start),new Date('2099-01-12T08:00:00Z'),'Chep'),1);
 assert.equal(remainingCapacity(events,new Date('2099-01-12T07:00:00Z'),new Date('2099-01-12T08:00:00Z'),'Bree'),2);
});
test('uncertain write outcome retains the lock instead of risking a double booking',async()=>{
 await inCalendar([],async fake=>{
  const prior=console.error;console.error=()=>{};
  try{await assert.rejects(calendar.withCalendarLock(async()=>{throw new Error('connection lost during insert')}),/connection lost/)}finally{console.error=prior}
  assert.ok(fake.events.get(LOCK).extendedProperties.private.lockOwner);
  await assert.rejects(calendar.withCalendarLock(async()=>{}),/calendar is busy/);
 });
});
