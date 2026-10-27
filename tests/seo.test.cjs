const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const base='https://microlocsbychep.com/';
const locations=[...read('sitemap.xml').matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);
const pages=locations.map(url=>({url,file:new URL(url).pathname==='/'?'index.html':new URL(url).pathname.slice(1)}));
const plain=value=>value.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();

test('every sitemap page exists, is indexable and has a matching unique canonical',()=>{
 assert.equal(new Set(locations).size,4);
 assert.equal(read('sitemap.xml'),read('public/sitemap.xml'));
 for(const {url,file} of pages){
  assert.ok(url.startsWith(base));const source=read(file);
  assert.equal([...source.matchAll(/<h1[ >]/g)].length,1,file);
  assert.equal([...source.matchAll(/rel="canonical"/g)].length,1,file);
  assert.ok(source.includes(`rel="canonical" href="${url}"`),file);
  assert.doesNotMatch(source,/name="robots"[^>]*content="[^"]*noindex/);
  assert.match(source,/<title>[^<]+<\/title>/);
  assert.match(source,/<meta name="description" content="[^"]+">/);
  const ids=[...source.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length,file+' has duplicate IDs');
 }
});
test('public local links resolve and all guide pages can be discovered from home and llms.txt',()=>{
 for(const {file} of pages){
  const source=read(file);
  for(const [,href] of source.matchAll(/(?:href|src)="([^"#]+)"/g)){
   if(/^(https?:|mailto:|tel:|data:)/.test(href))continue;
   const target=new URL(href,base+file).pathname;
   assert.ok(fs.existsSync(path.join(root,target==='/'?'index.html':target.slice(1))),file+': '+href);
  }
 }
 for(const {url,file} of pages.filter(p=>p.file!=='index.html')){
  assert.ok(read('index.html').includes(`href="/${file}"`));
  assert.ok(read('llms.txt').includes(url));
 }
 assert.match(read('robots.txt'),/Allow: \/\s/);
 assert.match(read('robots.txt'),/Sitemap: https:\/\/microlocsbychep.com\/sitemap.xml/);
});
test('local business data and every FAQ answer are present in HTML without JavaScript',()=>{
 const source=read('index.html');
 const graph=JSON.parse(source.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])['@graph'];
 const business=graph.find(e=>e['@type']==='HairSalon');
 assert.match(business.address.streetAddress,/Kipro Centre.*Shop B6.*Westlands/);
 assert.match(source,/<strong>Kipro Centre<\/strong><small>2nd Floor, Shop B6<br>Westlands, Nairobi<\/small>/);
 assert.ok(source.includes(business.telephone));
 assert.ok(source.includes('Monday–Saturday · 7:00 AM–9:00 PM'));
 assert.equal(business.openingHoursSpecification.opens,'07:00');
 assert.equal(business.openingHoursSpecification.closes,'21:00');
 const faq=source.match(/<section class="section faq-section" id="faq">(.*?)<\/section>/s)[1];
 const answers=[...faq.matchAll(/<summary>(.*?)<\/summary>(.*?)<\/details>/gs)];
 const structured=graph.find(e=>e['@type']==='FAQPage').mainEntity;
 assert.ok(answers.length>=6);assert.equal(structured.length,answers.length);
 for(let i=0;i<answers.length;i++){
  assert.equal(structured[i].name,plain(answers[i][1]));
  assert.equal(structured[i].acceptedAnswer.text,plain(answers[i][2]));
 }
});
test('guide structured data identifies the page and factual business without invented ratings',()=>{
 for(const {url,file} of pages){
  const graph=JSON.parse(read(file).match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])['@graph'];
  assert.ok(graph.some(e=>e.url===url));
  const serialized=JSON.stringify(graph);
  assert.doesNotMatch(serialized,/aggregateRating|reviewCount|ratingValue/);
 }
 assert.match(read('microlocs-vs-sisterlocks.html'),/does not claim Sisterlocks® certification/);
 assert.match(read('admin.html'),/content="noindex,nofollow"/);
 const config=JSON.parse(read('vercel.json'));
 assert.ok(config.redirects.some(r=>r.source==='/index.html'&&r.destination==='/'&&r.permanent));
 assert.ok(config.headers.some(r=>r.source==='/admin'&&r.headers.some(h=>h.key==='X-Robots-Tag'&&h.value.includes('noindex'))));
});

test('service guides resolve business identity and accurately describe the offered method',()=>{
 const homeGraph=JSON.parse(read('index.html').match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])['@graph'];
 const business=homeGraph.find(e=>e['@type']==='HairSalon');
 assert.doesNotMatch(business.description,/sister loc installations/i);
 for(const {file} of pages.filter(p=>p.file!=='index.html')){
  const graph=JSON.parse(read(file).match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])['@graph'];
  assert.deepEqual(graph.find(e=>e['@type']==='HairSalon'),business);
  assert.ok(graph.some(e=>e['@type']==='WebSite'));
  for(const service of graph.filter(e=>e['@type']==='Service'))assert.equal(service.provider['@id'],business['@id']);
 }
 assert.match(read('microlocs-installation-nairobi.html'),/<caption>Microlocs by Chep installation estimates<\/caption>/);
 assert.match(read('microlocs-vs-sisterlocks.html'),/href="https:\/\/www.sisterlocks.com\/"/);
});
