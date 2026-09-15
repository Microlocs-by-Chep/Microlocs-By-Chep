const {eventsBetween,overlaps,createEvent}=require("./_calendar");
module.exports=async(req,res)=>{
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
 try{
  const {name,phone,notes="",service,duration,start,hairLength="",hairVolume="",extensionInches="",colour=""}=req.body||{},hours=Number(duration);
  if(!name||!phone||!["Retie","Installation","Extensions","Colouring","Consultation"].includes(service)||![1,3,6].includes(hours)||!start)return res.status(400).json({error:"Complete all booking details"});
  const begins=new Date(start),ends=new Date(begins.getTime()+hours*3600000);
  if(!Number.isFinite(begins.getTime())||begins<Date.now())return res.status(400).json({error:"Choose a future appointment"});
  const events=await eventsBetween(begins.toISOString(),ends.toISOString()),busy=events.filter(event=>overlaps(event,begins,ends)).length;
  if(busy>=3)return res.status(409).json({error:"That time has just filled up. Please select another available time."});
  await createEvent({summary:`${service} — ${name}`,description:`Customer: ${name}\nPhone: ${phone}\nService: ${service}\nDuration: ${hours} hours\nHair length: ${hairLength||"Not selected"}\nHair volume: ${hairVolume||"Not selected"}\nExtension inches: ${extensionInches||"Not selected"}\nColour: ${colour||"Not selected"}\nHair details: ${notes||"Not provided"}\nAssigned staff position: ${busy+1} of 3`,start:{dateTime:begins.toISOString(),timeZone:"Africa/Nairobi"},end:{dateTime:ends.toISOString(),timeZone:"Africa/Nairobi"}});
  return res.status(201).json({dateLabel:begins.toLocaleDateString("en-KE",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"Africa/Nairobi"}),timeLabel:begins.toLocaleTimeString("en-KE",{hour:"numeric",minute:"2-digit",timeZone:"Africa/Nairobi"})});
 }catch(error){return res.status(503).json({error:error.message})}
};