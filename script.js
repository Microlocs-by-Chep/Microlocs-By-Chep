const WHATSAPP='254711498400';
const form=document.getElementById('bookingForm');
const serviceSelect=document.getElementById('serviceSelect');
const selectedService=document.getElementById('selectedService');

document.querySelectorAll('[data-service]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const service=btn.dataset.service;
    serviceSelect.value=service;
    selectedService.textContent=service;
    document.getElementById('booking').scrollIntoView({behavior:'smooth'});
  });
});
serviceSelect.addEventListener('change',()=>selectedService.textContent=serviceSelect.value||'Select a service below');

form.addEventListener('submit',(e)=>{
  e.preventDefault();
  const data=new FormData(form);
  const text=`Hello Microlocs by Chep!%0A%0AI'd like to request an appointment.%0A%0A*Name:* ${encodeURIComponent(data.get('name'))}%0A*Phone:* ${encodeURIComponent(data.get('phone'))}%0A*Service:* ${encodeURIComponent(data.get('service'))}%0A*Preferred date:* ${encodeURIComponent(data.get('date'))}%0A*Preferred time:* ${encodeURIComponent(data.get('time'))}%0A*Hair details:* ${encodeURIComponent(data.get('notes')||'Not provided')}`;
  window.open(`https://wa.me/${WHATSAPP}?text=${text}`,'_blank');
});

const dateInput=document.querySelector('input[name="date"]');
if(dateInput){const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());dateInput.min=d.toISOString().split('T')[0];}
