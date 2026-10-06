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
module.exports={requireAdmin};
