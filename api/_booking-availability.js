const {overlaps,assignedEmployee}=require('./_calendar');
const isUnavailability=event=>event.extendedProperties?.private?.kind==='unavailability';
function remainingCapacity(events,start,end,employee){
 const busy=events.filter(event=>overlaps(event,start,end));
 if(busy.some(event=>assignedEmployee(event)===employee))return 0;
 const boundaries=[];
 for(const event of busy.filter(event=>!isUnavailability(event))){
  boundaries.push([Math.max(+start,+new Date(event.start.dateTime||event.start.date)),1]);
  boundaries.push([Math.min(+end,+new Date(event.end.dateTime||event.end.date)),-1]);
 }
 boundaries.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 let count=0,peak=0;for(const [,change] of boundaries){count+=change;peak=Math.max(peak,count)}
 return Math.max(0,2-peak);
}
module.exports={isUnavailability,remainingCapacity};
