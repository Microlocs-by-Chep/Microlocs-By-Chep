// Run after the changed sitemap pages and key file are live: node scripts/submit-indexnow.cjs
// IndexNow notifies participating engines; acceptance does not guarantee indexing.
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const host='microlocsbychep.com';
const key="41717528712ae6a5204f01d20c1d7bdd";
const keyLocation=`https://${host}/${key}.txt`;
async function main(){
 const keyResponse=await fetch(keyLocation,{signal:AbortSignal.timeout(20000)});
 if(!keyResponse.ok||(await keyResponse.text()).trim()!==key)throw new Error('The IndexNow key is not live. Deploy before submitting.');
 const urls=[...fs.readFileSync(path.join(root,'sitemap.xml'),'utf8').matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);
 for(const url of urls){if(new URL(url).host!==host)throw new Error('Unexpected sitemap host');}
 const response=await fetch('https://api.indexnow.org/indexnow',{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify({host,key,keyLocation,urlList:urls}),signal:AbortSignal.timeout(20000)});
 console.log(`IndexNow HTTP ${response.status}: ${urls.length} URLs`);
 if(![200,202].includes(response.status))throw new Error(await response.text());
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
