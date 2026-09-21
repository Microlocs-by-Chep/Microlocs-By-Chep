(()=>{
 const URL="https://jqcqdpgzirrhitqqzdgn.supabase.co";
 const KEY="sb_publishable_EdBUU4jPfp7jwfandF_5GQ_kdBnGmWm";
 const section=document.querySelector("#account");
 if(!section)return;
 const params=new URLSearchParams(location.hash.slice(1));
 const recoveryToken=params.get("type")==="recovery"?params.get("access_token"):null;
 const message=(form,text,isError=false)=>{const node=form.querySelector(".account-message");if(node){node.textContent=text;node.style.color=isError?"#a33b30":"#477143"}};

 async function requestReset(email){
  const response=await fetch(`${URL}/auth/v1/recover?redirect_to=${encodeURIComponent("https://microlocsbychep.com/")}`,{method:"POST",headers:{apikey:KEY,"Content-Type":"application/json"},body:JSON.stringify({email})});
  if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.msg||data.message||data.error_description||"Could not send the reset email")}
 }

 function addForgotLink(){
  const form=section.querySelector("#customerLogin");
  if(!form||form.querySelector("#forgotPassword"))return;
  const button=document.createElement("button");
  button.type="button";button.id="forgotPassword";button.className="forgot-password";button.textContent="Forgot password? Email me a reset link";
  button.onclick=()=>{form.innerHTML=`<h3>Reset your password</h3><p>Enter the Gmail address used for your customer account. We will email you a secure reset link.</p><label>Email<input name="reset_email" type="email" autocomplete="email" required></label><button class="button darkbtn" type="submit">Send reset link</button><button class="forgot-password" type="button" id="backToLogin">Back to sign in</button><p class="account-message" aria-live="polite"></p>`;form.onsubmit=async event=>{event.preventDefault();const submit=form.querySelector('button[type="submit"]');submit.disabled=true;message(form,"Sending your reset link…");try{await requestReset(new FormData(form).get("reset_email"));message(form,"If an account exists for that email, the reset link has been sent. Check your inbox and spam folder.")}catch(error){message(form,error.message,true)}finally{submit.disabled=false}};form.querySelector("#backToLogin").onclick=()=>location.reload()};
  form.querySelector(".account-actions")?.insertAdjacentElement("afterend",button);
 }

 async function showNewPassword(){
  localStorage.removeItem("microlocsCustomerSession");sessionStorage.removeItem("microlocsCustomerSession");
  section.innerHTML=`<div class="shell customer-login"><div><p class="eyebrow">CUSTOMER’S ACCOUNT</p><h2>Choose a new <i>password.</i></h2><p>Your recovery link has been confirmed. Create a password with at least six characters.</p></div><form id="newPasswordForm"><label>New password<input name="password" type="password" minlength="6" autocomplete="new-password" required></label><label>Confirm password<input name="confirm_password" type="password" minlength="6" autocomplete="new-password" required></label><button class="button darkbtn" type="submit">Save new password</button><p class="account-message" aria-live="polite"></p></form></div>`;
  const form=section.querySelector("#newPasswordForm");
  form.onsubmit=async event=>{event.preventDefault();const values=Object.fromEntries(new FormData(form));if(values.password!==values.confirm_password)return message(form,"The two passwords do not match.",true);const submit=form.querySelector("button");submit.disabled=true;message(form,"Saving your new password…");try{const response=await fetch(`${URL}/auth/v1/user`,{method:"PUT",headers:{apikey:KEY,Authorization:`Bearer ${recoveryToken}`,"Content-Type":"application/json"},body:JSON.stringify({password:values.password})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.msg||data.message||data.error_description||"This reset link has expired");history.replaceState(null,"","/#account");form.innerHTML='<h3>Password updated</h3><p>Your new password is ready. You can now return to the customer account and sign in.</p><button class="button darkbtn" type="button" id="returnToLogin">Return to sign in</button>';form.querySelector("#returnToLogin").onclick=()=>location.reload()}catch(error){message(form,error.message,true);submit.disabled=false}};
 }

 if(recoveryToken)showNewPassword();else{addForgotLink();new MutationObserver(addForgotLink).observe(section,{childList:true,subtree:true})}
})();
