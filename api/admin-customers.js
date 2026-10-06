const {requireAdmin}=require('./_admin-auth');
const {eventsBetween,assignedEmployee}=require('./_calendar');
const {isUnavailability}=require('./_booking-availability');
const SUPABASE_URL=process.env.SUPABASE_URL||'https://jqcqdpgzirrhitqqzdgn.supabase.co';
const SUPABASE_KEY=process.env.SUPABASE_PUBLISHABLE_KEY||'sb_publishable_EdBUU4jPfp7jwfandF_5GQ_kdBnGmWm';
const field=(event,label)=>{const match=String(event.description||'').match(new RegExp(`^${label}:[ \\t]*([^\\r\\n]+)$`,'im'));return match?match[1].trim():''};
module.exports=async(req,res)=>{
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 res.setHeader('Cache-Control','no-store');
 try{
  await requireAdmin(req);
  const {search='',page='0',id=''}=req.query||{};
  if(typeof search!=='string'||search.length>100||!/^\d{1,4}$/.test(String(page))||Number(page)>2000||typeof id!=='string'||(id&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))return res.status(400).json({error:'Choose a valid customer or search'});
  const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_customer_accounts`,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:req.headers.authorization,'Content-Type':'application/json'},body:JSON.stringify({p_search:id?'':search.trim(),p_offset:id?0:Number(page)*50,p_user_id:id||null})});
  const profiles=await response.json();
  if(!response.ok){
   if(profiles.code==='PGRST202'||profiles.code==='42883')throw new Error('Customer account access needs the admin customer accounts database update.');
   throw new Error('Could not load customer accounts. Please try again.');
  }
  if(!id)return res.status(200).json({customers:profiles.slice(0,50),hasMore:profiles.length>50});
  const customer=profiles[0];if(!customer)return res.status(404).json({error:'Customer account not found'});
  const now=new Date(),start=new Date(now),end=new Date(now);start.setFullYear(start.getFullYear()-2);end.setFullYear(end.getFullYear()+1);
  let events;
  try{events=await eventsBetween(start.toISOString(),end.toISOString())}catch(error){
   return res.status(200).json({customer,appointments:null,points:null,historyError:"Booking history is unavailable. "+error.message,historyStart:start.toISOString(),historyEnd:end.toISOString()});
  }
  const email=String(customer.email||'').trim().toLowerCase();
  const appointments=events.filter(event=>!isUnavailability(event)&&email&&field(event,'Email').toLowerCase()===email).map(event=>({id:event.id,service:field(event,'Service')||(event.summary||'Appointment').split('—')[0].trim(),stylist:assignedEmployee(event),starts_at:new Date(event.start.dateTime||event.start.date).toISOString(),ends_at:new Date(event.end.dateTime||event.end.date).toISOString(),completed:new Date(event.end.dateTime||event.end.date)<=now,beverage:field(event,'Complimentary drink'),booking_notes:event.description||''})).sort((a,b)=>new Date(b.starts_at)-new Date(a.starts_at));
  return res.status(200).json({customer,appointments,points:appointments.length*100,historyStart:start.toISOString(),historyEnd:end.toISOString()});
 }catch(error){return res.status(/authorised|Sign in|expired/.test(error.message)?401:503).json({error:error.message})}
};
