const {eventsBetween,overlaps,assignedEmployee}=require("./_calendar");
module.exports=async(req,res)=>{
 try{
  const {date,duration,employee}=req.query,hours=Number(duration),employees=["Bree","Joan","Chep"];
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date||"")||![1,3,6,8].includes(hours)||!employees.includes(employee))return res.status(400).json({error:"Choose a valid service and date"});
  const dayStart=new Date(date+"T08:00:00+03:00"),dayEnd=new Date(date+"T21:00:00+03:00"),events=await eventsBetween(dayStart.toISOString(),dayEnd.toISOString()),slots=[];
  for(let hour=8;hour<=17&&hour+hours<=21;hour++){const start=new Date(date+`T${String(hour).padStart(2,"0")}:00:00+03:00`),end=new Date(start.getTime()+hours*3600000),busy=events.filter(event=>overlaps(event,start,end)),stylistBusy=busy.some(event=>assignedEmployee(event)===employee),available=!stylistBusy&&busy.length<2?2-busy.length:0;if(available>0)slots.push({start:start.toISOString(),label:start.toLocaleTimeString("en-KE",{hour:"numeric",minute:"2-digit",timeZone:"Africa/Nairobi"}),available})}
  res.setHeader("Cache-Control","no-store");return res.status(200).json({slots});
 }catch(error){return res.status(503).json({error:error.message})}
};
