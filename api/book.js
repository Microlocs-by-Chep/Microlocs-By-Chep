const {eventsBetween,overlaps,assignedEmployee,createEvent}=require("./_calendar");
const {sendBookingConfirmation}=require("./_email");
module.exports=async(req,res)=>{
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
 try{
  const {name,email,phone,notes="",service,employee,duration,start,hairLength="",hairVolume="",extensionInches="",extensionVolume="",colour=""}=req.body||{},hours=Number(duration),customerEmail=String(email||"").trim().toLowerCase();
  if(!name||!phone||!/^\S+@\S+\.\S+$/.test(customerEmail)||!["Retie","Installation","Microtwists","Microbraiding","Consultation"].includes(service)||!["Bree","Joan","Chep"].includes(employee)||![1,3,6,8].includes(hours)||!start)return res.status(400).json({error:"Complete all booking details, including a valid email address"});
  const begins=new Date(start),ends=new Date(begins.getTime()+hours*3600000);
  if(!Number.isFinite(begins.getTime())||begins<Date.now())return res.status(400).json({error:"Choose a future appointment"});
  const events=await eventsBetween(begins.toISOString(),ends.toISOString()),busy=events.filter(event=>overlaps(event,begins,ends)),stylistBusy=busy.some(event=>assignedEmployee(event)===employee);
  if(stylistBusy||busy.length>=2)return res.status(409).json({error:"That time has just filled up. Please select another available time."});
  const event=await createEvent({summary:`${service} — ${name}`,description:`Customer: ${name}\nEmail: ${customerEmail}\nPhone: ${phone}\nService: ${service}\nDuration: ${hours} hours\nStylist: ${employee}\nHair length: ${hairLength||"Not selected"}\nHair volume: ${hairVolume||"Not selected"}\nExtension inches: ${extensionInches||"Not selected"}\nExtension volume: ${extensionVolume||"Not selected"}\nColour: ${colour||"Not selected"}\nHair details: ${notes||"Not provided"}`,start:{dateTime:begins.toISOString(),timeZone:"Africa/Nairobi"},end:{dateTime:ends.toISOString(),timeZone:"Africa/Nairobi"},attendees:[{email:customerEmail,displayName:name}],guestsCanModify:false,guestsCanInviteOthers:false,extendedProperties:{private:{employee}}});
  const dateLabel=begins.toLocaleDateString("en-KE",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"Africa/Nairobi"}),timeLabel=begins.toLocaleTimeString("en-KE",{hour:"numeric",minute:"2-digit",timeZone:"Africa/Nairobi"});
  let emailSent=false;try{emailSent=await sendBookingConfirmation({eventId:event.id,name,email:customerEmail,phone,service,employee,begins,ends,dateLabel,timeLabel})}catch{}
  return res.status(201).json({dateLabel,timeLabel,calendarSaved:true,calendarEventId:event.id,calendarLink:event.htmlLink||null,invitationSent:event.invitationSent,emailSent});
 }catch(error){return res.status(503).json({error:error.message})}
};
