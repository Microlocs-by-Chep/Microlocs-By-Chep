(()=>{
 // Counts website browsers only; account/admin pages are not tracked separately.
 try{
  if(navigator.globalPrivacyControl||navigator.doNotTrack==='1')return;
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Nairobi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if(sessionStorage.getItem('microlocsVisitRecorded')===day)return;
  let visitor=localStorage.getItem('microlocsWebsiteVisitor');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(visitor||'')){visitor=crypto.randomUUID();localStorage.setItem('microlocsWebsiteVisitor',visitor)}
  fetch('https://jqcqdpgzirrhitqqzdgn.supabase.co/rest/v1/rpc/record_website_visit',{
   method:'POST',credentials:'omit',keepalive:true,
   headers:{apikey:'sb_publishable_EdBUU4jPfp7jwfandF_5GQ_kdBnGmWm','Content-Type':'application/json'},
   body:JSON.stringify({p_visitor_id:visitor})
  }).then(response=>{if(response.ok)sessionStorage.setItem('microlocsVisitRecorded',day)}).catch(()=>{});
 }catch{/* Visitor counting must never prevent browsing or booking. */}
})();
