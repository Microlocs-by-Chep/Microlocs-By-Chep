const ACCESS_TOKEN=process.env.INSTAGRAM_ACCESS_TOKEN;
const USER_ID=process.env.INSTAGRAM_USER_ID;

module.exports=async(req,res)=>{
 if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
 if(!ACCESS_TOKEN)return res.status(503).json({error:"Instagram is not connected yet"});
 try{
  const fields="id,caption,media_type,media_url,permalink,thumbnail_url,timestamp";
  const endpoint=USER_ID?`https://graph.facebook.com/v21.0/${encodeURIComponent(USER_ID)}/media`:"https://graph.instagram.com/me/media";
  const url=new URL(endpoint);
  url.search=new URLSearchParams({fields,limit:"12",access_token:ACCESS_TOKEN}).toString();
  const response=await fetch(url),data=await response.json();
  if(!response.ok)throw new Error(data.error?.message||"Could not load Instagram");
  const posts=(data.data||[]).map(post=>({url:post.media_type==="VIDEO"?post.thumbnail_url:post.media_url,permalink:post.permalink,caption:(post.caption||"Microlocs by Chep").split("\n")[0].slice(0,100)})).filter(post=>post.url&&post.permalink);
  res.setHeader("Cache-Control","s-maxage=900, stale-while-revalidate=3600");
  return res.status(200).json({posts});
 }catch(error){return res.status(502).json({error:error.message})}
};
