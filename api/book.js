const {eventsBetween,createEvent,withCalendarLock}=require("./_calendar");
const {remainingCapacity}=require("./_booking-availability");
const {sendBookingConfirmation,sendSalonBookingNotification}=require("./_email");
module.exports=async(req,res)=>{
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
 try{
  const {name,email,phone,notes="",service,employee,duration,start,hairLength="",hairVolume="",extensionInches="",extensionVolume="",colour="",beverage="",specialtyLength="",specialtyVolume="",addExtensions="",addColouring="",estimatedTotal=null}=req.body||{},hours=Number(duration),customerEmail=String(email||"").trim().toLowerCase();
  if(!name||!phone||!/^\S+@\S+\.\S+$/.test(customerEmail)||!["Retie","Installation","Microtwists","Microbraiding","Consultation"].includes(service)||!["Bree","Joan","Chep"].includes(employee)||![1,3,6,8].includes(hours)||!start)return res.status(400).json({error:"Complete all booking details, including a valid email address"});
  const begins=new Date(start),ends=new Date(begins.getTime()+hours*3600000);
  if(!Number.isFinite(begins.getTime())||begins<Date.now())return res.status(400).json({error:"Choose a future appointment"});
  const details=[`Customer: ${name}`,`Email: ${customerEmail}`,`Phone: ${phone}`,`Service: ${service}`,`Duration: ${hours} hours`,`Stylist: ${employee}`,`Complimentary drink: ${beverage||"Not selected"}`];
  for(const [label,value] of [["Hair length",hairLength],["Hair volume",hairVolume],["Preferred length",specialtyLength],["Preferred volume",specialtyVolume],["Add extensions",addExtensions],["Extension inches",extensionInches],["Extension volume",extensionVolume],["Add colouring",addColouring],["Colour",colour],["Hair details",notes]]){
   if(value)details.push(`${label}: ${value}`);
  }
  const estimate=Number(estimatedTotal);
  if(Number.isFinite(estimate)&&estimate>0)details.push(`Estimated booking total: KSh ${estimate.toLocaleString("en-KE")} (estimate, subject to confirmation)`);
  const description=details.join("\n");
  const event=await withCalendarLock(async()=>{
   const events=await eventsBetween(begins.toISOString(),ends.toISOString());
   if(!remainingCapacity(events,begins,ends,employee))throw Object.assign(new Error("That attendant is unavailable or the time has filled up. Please select another available time."),{statusCode:409});
   return createEvent({summary:`${service} — ${name}`,description,start:{dateTime:begins.toISOString(),timeZone:"Africa/Nairobi"},end:{dateTime:ends.toISOString(),timeZone:"Africa/Nairobi"},attendees:[{email:customerEmail,displayName:name}],guestsCanModify:false,guestsCanInviteOthers:false,extendedProperties:{private:{employee}}});
  });
  const dateLabel=begins.toLocaleDateString("en-KE",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"Africa/Nairobi"}),timeLabel=begins.toLocaleTimeString("en-KE",{hour:"numeric",minute:"2-digit",timeZone:"Africa/Nairobi"});
  const notification={eventId:event.id,name,email:customerEmail,phone,service,employee,begins,ends,dateLabel,timeLabel,description};
  const results=await Promise.allSettled([sendBookingConfirmation(notification),sendSalonBookingNotification(notification)]);
  const emailSent=results[0].status==="fulfilled"&&results[0].value===true,salonEmailSent=results[1].status==="fulfilled"&&results[1].value===true;
  if(process.env.RESEND_API_KEY&&!salonEmailSent)console.error("Salon booking notification could not be sent; the calendar booking is saved.");
  return res.status(201).json({dateLabel,timeLabel,calendarSaved:true,calendarEventId:event.id,calendarLink:event.htmlLink||null,invitationSent:event.invitationSent,emailSent,salonEmailSent});
 }catch(error){return res.status(error.statusCode||503).json({error:error.message})}
};
