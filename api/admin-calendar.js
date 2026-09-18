const {eventsBetween,assignedEmployee}=require("./_calendar");
const SUPABASE_URL=process.env.SUPABASE_URL||"https://jqcqdpgzirrhitqqzdgn.supabase.co";
const SUPABASE_KEY=process.env.SUPABASE_PUBLISHABLE_KEY||"sb_publishable_EdBUU4jPfp7jwfandF_5GQ_kdBnGmWm";
async function requireAdmin(req){
 const authorization=req.headers.authorization||"";
 if(!authorization.startsWith("Bearer "))throw new Error("Sign in required");
 const headers={apikey:SUPABASE_KEY,Authorization:authorization};
 const userResponse=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers}),user=await userResponse.json();
 if(!userResponse.ok||!user.id)throw new Error("Your session has expired");
 const adminResponse=await fetch(`${SUPABASE_URL}/rest/v1/admin_users?user_id=eq.${encodeURIComponent(user.id)}&select=user_id`,{headers}),admins=await adminResponse.json();
 if(!adminResponse.ok||!admins.length)throw new Error("This account is not authorised as an admin");
}
const field=(event,label)=>{const match=String(event.description||"").match(new RegExp(`^${label}:\\s*(.+)$`,"im"));return match?match[1].trim():""};
module.exports=async(req,res)=>{
 if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
 try{
  await requireAdmin(req);const {start,end}=req.query;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start||"")||!/^\d{4}-\d{2}-\d{2}$/.test(end||""))return res.status(400).json({error:"Choose a valid week"});
  const begins=new Date(`${start}T00:00:00+03:00`),finishes=new Date(`${end}T23:59:59+03:00`);
  if((finishes-begins)!==6*86400000-1000)return res.status(400).json({error:"The period must run Monday through Saturday"});
  const now=new Date(),events=await eventsBetween(begins.toISOString(),finishes.toISOString());
  const calendar=events.map(event=>{const startsAt=new Date(event.start?.dateTime||event.start?.date),endsAt=new Date(event.end?.dateTime||event.end?.date),summary=String(event.summary||"Calendar appointment"),description=String(event.description||""),worker=assignedEmployee(event)||"Unassigned",phone=field(event,"Phone")||(summary.match(/(?:\+?254|0)[17]\d(?:[\s-]?\d){7}/)||[])[0]||"",email=field(event,"Email")||(description.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)||[])[0]||"";return {calendar_event_id:event.id,worker,customer_name:field(event,"Customer")||summary.split("—").pop().trim(),service:field(event,"Service")||(/retie/i.test(summary)?"Retie":"Appointment"),customer_phone:phone,customer_email:email,booking_notes:field(event,"Hair details")||description.trim(),starts_at:startsAt.toISOString(),completed_at:endsAt.toISOString(),completed:endsAt<=now}});
  const jobs=calendar.filter(event=>event.completed).map(({starts_at,completed,...job})=>({...job,week_start:start,week_end:end}));
  res.setHeader("Cache-Control","no-store");return res.status(200).json({jobs,calendar});
 }catch(error){return res.status(/authorised|Sign in|expired/.test(error.message)?401:503).json({error:error.message})}
};
