const {deleteEvent,withCalendarLock}=require("./_calendar");
const {requireAdmin}=require("./_admin-auth");
module.exports=async(req,res)=>{
 if(req.method!=="DELETE")return res.status(405).json({error:"Method not allowed"});
 try{await requireAdmin(req);const eventId=String(req.query.id||"").trim();if(!eventId||eventId.length>1024)return res.status(400).json({error:"Choose a valid booking"});await withCalendarLock(()=>deleteEvent(eventId));return res.status(200).json({deleted:true})}
 catch(error){return res.status(/authorised|Sign in|expired/.test(error.message)?401:(error.statusCode||503)).json({error:error.message})}
};
