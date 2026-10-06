const {test}=require('node:test');
const assert=require('node:assert/strict');
let event;
const calendarPath=require.resolve('../api/_calendar');
require.cache[calendarPath]={id:calendarPath,filename:calendarPath,loaded:true,exports:{
 eventsBetween:async()=>[],overlaps:()=>false,assignedEmployee:()=>'',withCalendarLock:async operation=>operation(),
 createEvent:async value=>{event=value;return {id:'test-event',invitationSent:false}}
}};
const book=require('../api/book');
const base={name:'Test client',email:'test@example.com',phone:'0700000000',service:'Retie',employee:'Chep',duration:3,start:'2099-01-12T05:00:00Z',beverage:'Tea'};
async function reserve(extra={}){
 const res={status(code){this.code=code;return this},json(body){this.body=body;return this}};
 await book({method:'POST',body:{...base,...extra}},res);assert.equal(res.code,201);return res;
}
test('drink is saved and irrelevant unselected options are omitted',async()=>{
 await reserve();assert.match(event.description,/Complimentary drink: Tea/);
 assert.doesNotMatch(event.description,/Hair length:|Extension inches:|Estimated booking total:/);
 assert.match(event.description,/Stylist: Chep/);
});
test('all selected service options and estimate reach the salon calendar',async()=>{
 await reserve({service:'Installation',duration:8,hairLength:'Long',hairVolume:'Full / bulky',addExtensions:'Yes',extensionInches:'20 inches',extensionVolume:'Medium',addColouring:'Yes',colour:'Copper',notes:'Sensitive scalp',estimatedTotal:49500});
 for(const value of ['Hair length: Long','Hair volume: Full / bulky','Add extensions: Yes','Extension inches: 20 inches','Extension volume: Medium','Add colouring: Yes','Colour: Copper','Hair details: Sensitive scalp','KSh 49,500'])assert.ok(event.description.includes(value),value);
});
test('specialty preferences and identical details reach emailed Google link and ICS',async()=>{
 const previousFetch=global.fetch,previousKey=process.env.RESEND_API_KEY;
 let sent;process.env.RESEND_API_KEY='local-test-only';
 global.fetch=async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');const message=JSON.parse(options.body);if(message.to.includes("test@example.com"))sent=message;return {ok:true}};
 try{
  const res=await reserve({service:'Microtwists',duration:6,specialtyLength:'Long',specialtyVolume:'Full',notes:'Keep ends loose',estimatedTotal:20000});
  assert.equal(res.body.emailSent,true);
  assert.match(event.description,/Preferred length: Long/);assert.match(event.description,/Preferred volume: Full/);
  const link=sent.html.match(/href="([^"]*calendar\.google\.com[^"]*)"/)[1].replaceAll('&amp;','&');
  assert.equal(new URL(link).searchParams.get('details'),event.description);
  const ics=Buffer.from(sent.attachments[0].content,'base64').toString();
  assert.match(ics,/Complimentary drink: Tea/);assert.match(ics,/Preferred volume: Full/);assert.match(ics,/KSh 20\\,000/);
 }finally{global.fetch=previousFetch;if(previousKey===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=previousKey}
});
