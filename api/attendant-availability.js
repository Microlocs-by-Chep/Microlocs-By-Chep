const {requireAdmin}=require('./_admin-auth');
const {eventsBetween,assignedEmployee,overlaps,createEvent,deleteEvent,withCalendarLock}=require('./_calendar');
const {isUnavailability}=require('./_booking-availability');
module.exports=async(req,res)=>{
 if(!['POST','DELETE'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
 try{
  await requireAdmin(req);
  const {employee,start,end,reason='',id}=req.body||{};
  if(!['Bree','Joan','Chep'].includes(employee))return res.status(400).json({error:'Choose an attendant'});
  const begins=new Date(start),ends=new Date(end);
  if(!Number.isFinite(+begins)||!Number.isFinite(+ends)||ends<=begins||(req.method==='POST'&&ends<=Date.now())||ends-begins>366*86400000)return res.status(400).json({error:'Choose a valid upcoming start and end time (up to one year)'});
  if(req.method==='DELETE'&&(!id||typeof id!=='string'||id.length>1024))return res.status(400).json({error:'Choose an unavailable period to remove'});
  const result=await withCalendarLock(async()=>{
   const events=await eventsBetween(begins.toISOString(),ends.toISOString());
   if(req.method==='DELETE'){
    const block=events.find(event=>event.id===id&&isUnavailability(event)&&assignedEmployee(event)===employee);
    if(!block)throw Object.assign(new Error('Unavailable period not found. Refresh the calendar.'),{statusCode:404});
    await deleteEvent(block.id);return {removed:true};
   }
   if(events.some(event=>!isUnavailability(event)&&assignedEmployee(event)===employee&&overlaps(event,begins,ends)))throw Object.assign(new Error('This attendant already has a booking during that period. Choose another time or resolve the booking first.'),{statusCode:409});
   const block=await createEvent({summary:`Unavailable — ${employee}`,description:`Stylist: ${employee}\nReason: ${String(reason).trim().slice(0,500)||'Not provided'}`,start:{dateTime:begins.toISOString(),timeZone:'Africa/Nairobi'},end:{dateTime:ends.toISOString(),timeZone:'Africa/Nairobi'},extendedProperties:{private:{employee,kind:'unavailability'}}});
   return {saved:true,id:block.id};
  });
  return res.status(200).json(result);
 }catch(error){return res.status(/authorised|Sign in|expired/.test(error.message)?401:(error.statusCode||503)).json({error:error.message})}
};
