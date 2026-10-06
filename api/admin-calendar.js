const {eventsBetween,assignedEmployee}=require("./_calendar");
const {isUnavailability}=require("./_booking-availability");
const {requireAdmin}=require("./_admin-auth");
const field=(event,label)=>{const match=String(event.description||"").match(new RegExp(`^${label}:[ \t]*([^\\r\\n]+)$`,"im"));return match?match[1].trim():""};
const selectedField=(event,label)=>{
 const value=field(event,label);
 return /^(not selected|not provided)$/i.test(value)?"":value;
};
const optionLabels=["Duration","Hair length","Hair volume","Preferred length","Preferred volume","Add extensions","Extension inches","Extension volume","Add colouring","Colour","Estimated booking total"];
const bookingOptions=event=>optionLabels.flatMap(label=>{const value=selectedField(event,label);return value?[{label,value}]:[]});
module.exports=async(req,res)=>{
 if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
 try{
  await requireAdmin(req);const {start,end}=req.query;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start||"")||!/^\d{4}-\d{2}-\d{2}$/.test(end||""))return res.status(400).json({error:"Choose a valid week"});
  const begins=new Date(`${start}T00:00:00+03:00`),finishes=new Date(`${end}T23:59:59+03:00`);
  if((finishes-begins)!==6*86400000-1000)return res.status(400).json({error:"The period must run Monday through Saturday"});
  const now=new Date(),events=await eventsBetween(begins.toISOString(),finishes.toISOString());
  const unavailable=events.filter(isUnavailability).map(event=>({id:event.id,employee:assignedEmployee(event),start:event.start.dateTime||event.start.date,end:event.end.dateTime||event.end.date,reason:field(event,"Reason")}));
  const calendar=events.filter(event=>!isUnavailability(event)).map(event=>{const startsAt=new Date(event.start?.dateTime||event.start?.date),endsAt=new Date(event.end?.dateTime||event.end?.date),summary=String(event.summary||"Calendar appointment"),description=String(event.description||""),assigned=assignedEmployee(event),worker=["Bree","Joan"].includes(assigned)?assigned:"Unassigned",phone=field(event,"Phone")||(summary.match(/(?:\+?254|0)[17]\d(?:[\s-]?\d){7}/)||[])[0]||"",email=field(event,"Email")||(description.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)||[])[0]||"";return {calendar_event_id:event.id,worker,customer_name:field(event,"Customer")||summary.split("—").pop().trim(),service:field(event,"Service")||(/retie/i.test(summary)?"Retie":"Appointment"),customer_phone:phone,customer_email:email,booking_notes:description.trim(),beverage:selectedField(event,"Complimentary drink"),booking_options:bookingOptions(event),hair_details:selectedField(event,"Hair details"),stylist:assigned,starts_at:startsAt.toISOString(),completed_at:endsAt.toISOString(),completed:endsAt<=now}});
  const jobs=calendar.filter(event=>event.completed).map(({starts_at,completed,beverage,booking_options,hair_details,stylist,...job})=>({...job,week_start:start,week_end:end}));
  res.setHeader("Cache-Control","no-store");return res.status(200).json({jobs,calendar,unavailable});
 }catch(error){return res.status(/authorised|Sign in|expired/.test(error.message)?401:503).json({error:error.message})}
};
