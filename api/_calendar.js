const crypto=require("crypto");
const CALENDAR_ID=process.env.GOOGLE_CALENDAR_ID;
const EMAIL=process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY=(process.env.GOOGLE_PRIVATE_KEY||"").replace(/\\n/g,"\n");
const encode=value=>Buffer.from(JSON.stringify(value)).toString("base64url");
async function accessToken(){
 if(!CALENDAR_ID||!EMAIL||!PRIVATE_KEY)throw new Error("Google Calendar is not connected yet");
 const now=Math.floor(Date.now()/1000),header=encode({alg:"RS256",typ:"JWT"}),payload=encode({iss:EMAIL,scope:"https://www.googleapis.com/auth/calendar",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600});
 const unsigned=header+"."+payload,signature=crypto.sign("RSA-SHA256",Buffer.from(unsigned),PRIVATE_KEY).toString("base64url");
 const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:unsigned+"."+signature})});
 const data=await response.json();if(!response.ok)throw new Error(data.error_description||"Calendar authentication failed");return data.access_token;
}
async function eventsBetween(start,end){
 const token=await accessToken(),url=new URL("https://www.googleapis.com/calendar/v3/calendars/"+encodeURIComponent(CALENDAR_ID)+"/events");
 url.search=new URLSearchParams({timeMin:start,timeMax:end,singleEvents:"true",orderBy:"startTime",maxResults:"2500"}).toString();
 const response=await fetch(url,{headers:{Authorization:"Bearer "+token}}),data=await response.json();
 if(!response.ok)throw new Error(data.error?.message||"Could not read calendar");
 return (data.items||[]).filter(event=>event.status!=="cancelled"&&event.transparency!=="transparent");
}
const overlaps=(event,start,end)=>new Date(event.start.dateTime||event.start.date)<end&&new Date(event.end.dateTime||event.end.date)>start;
async function createEvent(event){
 const token=await accessToken(),url=new URL("https://www.googleapis.com/calendar/v3/calendars/"+encodeURIComponent(CALENDAR_ID)+"/events");
 url.searchParams.set("sendUpdates","all");
 const response=await fetch(url,{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(event)}),data=await response.json();
 if(!response.ok)throw new Error(data.error?.message||"Could not create calendar booking");return data;
}
module.exports={eventsBetween,overlaps,createEvent};
