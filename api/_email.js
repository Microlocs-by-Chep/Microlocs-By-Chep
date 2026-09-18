const FROM="Microlocs by Chep <appointments@bookings.microlocsbychep.com>";
const LOCATION="Kipro Centre, 2nd Floor, Shop B6, Westlands, Nairobi";
const clean=value=>String(value||"").replace(/[\\;,\n]/g,character=>({"\\":"\\\\",";":"\\;",",":"\\,","\n":"\\n"}[character]));
const stamp=date=>new Date(date).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
const htmlEscape=value=>String(value||"").replace(/[&<>"']/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[character]));

async function sendBookingConfirmation({eventId,name,email,phone,service,employee,begins,ends,dateLabel,timeLabel}){
 if(!process.env.RESEND_API_KEY)return false;
 const details=`Service: ${service}\nStylist: ${employee}\nPhone: ${phone}`;
 const uid=`${eventId||Date.now()}@microlocsbychep.com`;
 const ics=[
  "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Microlocs by Chep//Bookings//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH",
  "BEGIN:VEVENT",`UID:${clean(uid)}`,`DTSTAMP:${stamp(new Date())}`,`DTSTART:${stamp(begins)}`,`DTEND:${stamp(ends)}`,
  `SUMMARY:${clean(`${service} with ${employee} — Microlocs by Chep`)}`,`DESCRIPTION:${clean(details)}`,`LOCATION:${clean(LOCATION)}`,
  "STATUS:CONFIRMED","END:VEVENT","END:VCALENDAR"
 ].join("\r\n");
 const googleUrl="https://calendar.google.com/calendar/render?"+new URLSearchParams({action:"TEMPLATE",text:`${service} with ${employee} — Microlocs by Chep`,dates:`${stamp(begins)}/${stamp(ends)}`,details,location:LOCATION}).toString();
 const response=await fetch("https://api.resend.com/emails",{
  method:"POST",
  headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json","Idempotency-Key":`booking-${uid}`},
  body:JSON.stringify({
   from:FROM,to:[email],reply_to:"chepletingbev@gmail.com",subject:"Your Microlocs by Chep appointment is confirmed",
   html:`<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#211b18"><h1 style="font-size:26px">Your appointment is confirmed</h1><p>Hi ${htmlEscape(name)},</p><p>We have reserved your appointment with Microlocs by Chep.</p><div style="background:#f7f2eb;padding:20px;border-radius:12px;line-height:1.7"><strong>${htmlEscape(service)}</strong><br>${htmlEscape(dateLabel)} at ${htmlEscape(timeLabel)}<br>Stylist: ${htmlEscape(employee)}<br>${htmlEscape(LOCATION)}</div><p><a href="${htmlEscape(googleUrl)}" style="display:inline-block;background:#211b18;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none">Add to Google Calendar</a></p><p>Your calendar file is also attached. To make changes, reply to this email or WhatsApp 0711 498 400.</p></div>`,
   attachments:[{filename:"microlocs-appointment.ics",content:Buffer.from(ics).toString("base64")}]
  })
 });
 return response.ok;
}

module.exports={sendBookingConfirmation};
