const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
let events=[],reads=0;
const calendarPath=require.resolve('../api/_calendar');
require.cache[calendarPath]={id:calendarPath,filename:calendarPath,loaded:true,exports:{eventsBetween:async()=>{reads++;return events},assignedEmployee:()=> 'Chep'}};
const handler=require('../api/admin-calendar');
const event=description=>({id:'test-event',summary:'Retie — Test client',description,start:{dateTime:'2020-01-06T05:00:00Z'},end:{dateTime:'2020-01-06T08:00:00Z'}});
async function request(authorized=true){
 const previous=global.fetch;
 global.fetch=async url=>({ok:true,json:async()=>url.includes('/auth/v1/user')?{id:'test-admin'}:[{user_id:'test-admin'}]});
 const res={setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}};
 try{await handler({method:'GET',headers:authorized?{authorization:'Bearer local-test'}:{},query:{start:'2020-01-06',end:'2020-01-11'}},res);return res}finally{global.fetch=previous}
}
test('admin gets drink and selected options; completed job uses existing schema',async()=>{
 events=[event('Customer: Test client\nEmail: test@example.com\nService: Installation\nDuration: 8 hours\nComplimentary drink: Coffee\nHair length: Long\nHair volume: Full / bulky\nAdd extensions: Yes\nExtension inches: 20 inches\nAdd colouring: Yes\nColour: Copper\nHair details: Sensitive scalp\nEstimated booking total: KSh 49,500')];
 const res=await request();assert.equal(res.code,200);
 const booking=res.body.calendar[0];assert.equal(booking.beverage,'Coffee');assert.equal(booking.stylist,'Chep');assert.equal(booking.hair_details,'Sensitive scalp');
 assert.deepEqual(booking.booking_options.map(x=>x.label),['Duration','Hair length','Hair volume','Add extensions','Extension inches','Add colouring','Colour','Estimated booking total']);
 const job=res.body.jobs[0];assert.match(job.booking_notes,/Complimentary drink: Coffee/);assert.match(job.booking_notes,/Colour: Copper/);
 for(const key of ['beverage','booking_options','hair_details','stylist','starts_at','completed'])assert.ok(!(key in job),key+' must not be sent to commission_jobs');
});
test('legacy and empty drink fields do not invent a selection',async()=>{
 events=[event('Customer: Test client\nComplimentary drink: \nHair length: Not selected\nColour: Not selected\nHair details: Not provided')];
 const res=await request();assert.equal(res.code,200);assert.equal(res.body.calendar[0].beverage,'');assert.deepEqual(res.body.calendar[0].booking_options,[]);assert.equal(res.body.calendar[0].hair_details,'');
});
test('calendar details remain protected by admin authentication',async()=>{
 const before=reads;const res=await request(false);assert.equal(res.code,401);assert.equal(reads,before);
});
function adminContext(){
 const nodes=new Map();const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',hidden:false,value:'',checked:false,querySelector:child=>node(selector+' '+child),insertAdjacentHTML(){}});return nodes.get(selector)};
 const context=vm.createContext({console,Intl,Date,localStorage:{getItem:()=>null,removeItem(){}},document:{querySelector:node,querySelectorAll:()=>[]}});
 vm.runInContext(fs.readFileSync(require.resolve('../admin.js'),'utf8'),context);return {context,node};
}
test('admin calendar renders drink, options, notes, and correct stylist safely',()=>{
 const {context,node}=adminContext();context.bookings=[{calendar_event_id:'test',customer_name:'<img onerror=alert(1)>',service:'Installation',worker:'Unassigned',stylist:'Chep',starts_at:'2020-01-06T05:00:00Z',beverage:'Tea',booking_options:[{label:'Colour',value:'Copper'},{label:'Preferred volume',value:'Full'}],hair_details:'<script>notes</script>'}];
 vm.runInContext('renderCalendar(bookings)',context);const html=node('#weeklyCalendar').innerHTML;
 for(const text of ['Drink:</b> Tea','View booking details','Copper','Preferred volume','Installation · Chep','&lt;script&gt;notes'])assert.ok(html.includes(text),text);
 assert.ok(!html.includes('<img onerror'));assert.ok(!html.includes('<script>notes'));
 context.bookings[0].beverage='';context.bookings[0].booking_options=[];vm.runInContext('renderCalendar(bookings)',context);
 assert.match(node('#weeklyCalendar').innerHTML,/Drink:<\/b> Not recorded/);assert.match(node('#weeklyCalendar').innerHTML,/No selected options recorded/);
});

test('unavailable periods appear separately and never become commission jobs',async()=>{
 const blocked=event('Stylist: Chep\nReason: Day off');blocked.extendedProperties={private:{employee:'Chep',kind:'unavailability'}};
 events=[blocked];const res=await request();assert.equal(res.code,200);assert.equal(res.body.calendar.length,0);assert.equal(res.body.jobs.length,0);assert.equal(res.body.unavailable[0].reason,'Day off');
});
test('admin renders unavailable periods with a make-available action and escaped reasons',()=>{
 const {context,node}=adminContext();context.periods=[{id:'blocked',employee:'Chep',start:'2099-01-12T05:00:00Z',end:'2099-01-12T18:00:00Z',reason:'<script>leave</script>'}];
 vm.runInContext('renderUnavailable(periods)',context);const html=node('#unavailablePeriods').innerHTML;
 assert.match(html,/Chep/);assert.match(html,/Make available/);assert.match(html,/&lt;script&gt;leave/);assert.ok(!html.includes('<script>leave'));
});
test('admin customer list and account history escape names, drinks and notes',()=>{
 const {context,node}=adminContext();
 context.customers=[{user_id:'test-id',email:'test@example.com',full_name:'<img onerror=alert(1)>',phone:'0700000000'}];
 vm.runInContext('renderCustomerList(customers)',context);assert.match(node('#customerList').innerHTML,/&lt;img/);assert.ok(!node('#customerList').innerHTML.includes('<img'));
 context.account={customer:{email:'test@example.com',full_name:'Client',reminder_weeks:6,birthday:'1990-01-01'},points:100,appointments:[{service:'Retie',starts_at:'2026-01-12T05:00:00Z',ends_at:'2026-01-12T08:00:00Z',completed:true,beverage:'<script>Tea</script>',booking_notes:'Colour: Copper\n<script>notes</script>',stylist:'Chep'}]};
 vm.runInContext('renderCustomerAccount(account)',context);const html=node('#customerAccountDetail').innerHTML;
 for(const text of ['Birthday','Loyalty points','100','Completed appointments','Copper','&lt;script&gt;Tea'])assert.ok(html.includes(text),text);assert.ok(!html.includes('<script>'));
});

test('admin account does not report zero points or empty history when calendar is unavailable',()=>{
 const {context,node}=adminContext();context.account={customer:{email:'test@example.com',full_name:'Client'},appointments:null,points:null,historyError:'Google Calendar is not connected yet'};
 vm.runInContext('renderCustomerAccount(account)',context);const html=node('#customerAccountDetail').innerHTML;assert.match(html,/Client/);assert.match(html,/Unavailable/);assert.match(html,/not connected/);assert.ok(!html.includes('No appointments in this period.'));
});
